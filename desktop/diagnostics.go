package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type diagnosticFile struct {
	Name   string `json:"name"`
	Exists bool   `json:"exists"`
	Bytes  int64  `json:"bytes,omitempty"`
}

type DiagnosticEvent struct {
	At         time.Time `json:"at"`
	Kind       string    `json:"kind"`
	Subject    string    `json:"subject,omitempty"`
	Transition string    `json:"transition,omitempty"`
	Reason     string    `json:"reason,omitempty"`
	ErrorClass string    `json:"errorClass,omitempty"`
}

const diagnosticEventLimit = 128

func redactDiagnosticString(v string) string {
	return string(redactLogBytes([]byte(v)))
}

func (a *App) recordDiagnosticEvent(kind, subject, transition, reason, errClass string) {
	e := DiagnosticEvent{
		At: a.nowUTC(), Kind: redactDiagnosticString(kind), Subject: redactDiagnosticString(subject),
		Transition: redactDiagnosticString(transition), Reason: redactDiagnosticString(reason), ErrorClass: redactDiagnosticString(errClass),
	}
	a.diagMu.Lock()
	if len(a.diagEvents) >= diagnosticEventLimit {
		copy(a.diagEvents, a.diagEvents[len(a.diagEvents)-diagnosticEventLimit+1:])
		a.diagEvents = a.diagEvents[:diagnosticEventLimit-1]
	}
	a.diagEvents = append(a.diagEvents, e)
	a.diagMu.Unlock()
}

func (a *App) diagnosticEvents() []DiagnosticEvent {
	a.diagMu.RLock()
	defer a.diagMu.RUnlock()
	out := append([]DiagnosticEvent(nil), a.diagEvents...)
	return out
}

type runtimeDiagnostics struct {
	Version         string                    `json:"version"`
	ObservedAt      time.Time                 `json:"observedAt"`
	UptimeSec       int64                     `json:"uptimeSec"`
	GoVersion       string                    `json:"goVersion"`
	GOOS            string                    `json:"goos"`
	GOARCH          string                    `json:"goarch"`
	Goroutines      int                       `json:"goroutines"`
	HeapBytes       uint64                    `json:"heapBytes"`
	Connectors      map[string]map[string]any `json:"connectors"`
	StateFiles      []diagnosticFile          `json:"stateFiles"`
	StateLoadIssues []StateLoadIssue          `json:"stateLoadIssues,omitempty"`
	StateMigrations []StateMigration          `json:"stateMigrations,omitempty"`
	ConnectorStates map[string]ConnectorState `json:"connectorStates"`
	Events          []DiagnosticEvent         `json:"events,omitempty"`
}

func (a *App) diagnostics() runtimeDiagnostics {
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	cfg := a.store.getSettings()
	_, ghErr := a.vault.Get("github.token")
	_, tsErr := a.vault.Get("typesafe.api_key")
	issues, migrations := a.store.stateLoadDiagnostics()
	d := runtimeDiagnostics{
		Version: version, ObservedAt: a.nowUTC(), UptimeSec: int64(a.nowUTC().Sub(a.started.UTC()).Seconds()),
		GoVersion: runtime.Version(), GOOS: runtime.GOOS, GOARCH: runtime.GOARCH,
		Goroutines: runtime.NumGoroutine(), HeapBytes: ms.HeapAlloc,
		StateLoadIssues: issues, StateMigrations: migrations, ConnectorStates: a.connectorSnapshot(), Events: a.diagnosticEvents(),
		Connectors: map[string]map[string]any{
			"github":    {"configured": ghErr == nil, "source": a.store.getGitHub().Source},
			"typesafe":  {"configured": tsErr == nil, "auto": cfg.TypeSafeAuto},
			"works":     {"enabled": cfg.WorksEnabled, "configured": strings.TrimSpace(cfg.WorksURL) != ""},
			"assistant": {"localModelEnabled": cfg.AssistantLocalModel},
		},
	}
	for _, name := range []string{"settings.json", "github-snapshot.json", "metrics.json", "probes.json", "agents.json", persistenceJournalName} {
		f := diagnosticFile{Name: name}
		if info, err := os.Stat(filepath.Join(a.store.baseDir, name)); err == nil {
			f.Exists, f.Bytes = true, info.Size()
		}
		d.StateFiles = append(d.StateFiles, f)
	}
	return d
}

func (a *App) diagnosticsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, a.diagnostics())
}

func (a *App) diagnosticsJSON() []byte {
	b, _ := json.Marshal(a.diagnostics())
	return b
}
