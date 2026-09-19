package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sync"
)

var logSecretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]+|apikey_[A-Za-z0-9_=-]+)`),
	regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9._~+/-]+=*`),
	regexp.MustCompile(`(?i)(api[_-]?key|token|authorization)(["'=:\s]+)[A-Za-z0-9._~+/-]{20,}`),
}

func redactLogBytes(p []byte) []byte {
	out := append([]byte(nil), p...)
	for _, re := range logSecretPatterns {
		out = re.ReplaceAllFunc(out, func(m []byte) []byte {
			lower := bytes.ToLower(m)
			if bytes.HasPrefix(lower, []byte("bearer ")) {
				return []byte("Bearer [REDACTED]")
			}
			if idx := bytes.IndexAny(m, "'=:\t "); idx >= 0 && !bytes.HasPrefix(lower, []byte("github_pat_")) && !bytes.HasPrefix(lower, []byte("ghp_")) && !bytes.HasPrefix(lower, []byte("apikey_")) {
				return append(append([]byte(nil), m[:idx+1]...), []byte("[REDACTED]")...)
			}
			return []byte("[REDACTED]")
		})
	}
	return out
}

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
