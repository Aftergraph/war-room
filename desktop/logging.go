package main

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

func redactLogBytes(p []byte) []byte { return redactRegisteredSecrets(p) }

type rotatingLogWriter struct {
	mu       sync.Mutex
	path     string
	maxBytes int64
	backups  int
}

func newRotatingLogWriter(path string, maxBytes int64, backups int) *rotatingLogWriter {
	if maxBytes <= 0 {
		maxBytes = 2 << 20
	}
	if backups < 1 {
		backups = 3
	}
	return &rotatingLogWriter{path: path, maxBytes: maxBytes, backups: backups}
}

func (w *rotatingLogWriter) Write(p []byte) (int, error) {
	clean := redactLogBytes(p)
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(w.path), 0700); err != nil {
		return 0, err
	}
	if info, err := os.Stat(w.path); err == nil && info.Size()+int64(len(clean)) > w.maxBytes {
		if err := w.rotate(); err != nil {
			return 0, err
		}
	}
	f, err := os.OpenFile(w.path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return 0, err
	}
	n, err := f.Write(clean)
	closeErr := f.Close()
	if err != nil {
		return n, err
	}
	if closeErr != nil {
		return n, closeErr
	}
	// Satisfy io.Writer semantics relative to caller input; redaction may alter length.
	return len(p), nil
}

func (w *rotatingLogWriter) rotate() error {
	_ = os.Remove(fmt.Sprintf("%s.%d", w.path, w.backups))
	for i := w.backups - 1; i >= 1; i-- {
		old := fmt.Sprintf("%s.%d", w.path, i)
		next := fmt.Sprintf("%s.%d", w.path, i+1)
		if _, err := os.Stat(old); err == nil {
			_ = os.Rename(old, next)
		}
	}
	if _, err := os.Stat(w.path); err == nil {
		return os.Rename(w.path, w.path+".1")
	}
	return nil
}
