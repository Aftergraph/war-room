package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"time"
)

func jsonOut(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func decodeJSON(r *http.Request, v any) error {
	d := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		return err
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		if err == nil {
			return fmt.Errorf("request body must contain exactly one JSON value")
		}
		return fmt.Errorf("invalid trailing JSON: %w", err)
	}
	return nil
}
func (a *App) mutAllowed(r *http.Request) bool { return r.Header.Get("X-WarRoom-Session") == a.session }
func (a *App) sessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, map[string]string{"session": a.session, "version": version})
}
func (a *App) healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, map[string]any{"ok": true, "version": version, "startedAt": a.started.UTC(), "go": runtime.Version()})
}
func (a *App) summaryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, a.buildSummary())
}

func (a *App) intelligenceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, a.intel.Evaluate(a.store.getGitHub(), a.store.getProbes(), a.store.getSettings()))
}

func (a *App) intelligenceFeedbackHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var req IntelligenceFeedbackRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.CandidateID) == "" {
		http.Error(w, "candidateId is required", http.StatusBadRequest)
		return
	}
	model, err := a.intel.ApplyFeedback(req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	a.broadcast("intelligence")
	jsonOut(w, http.StatusOK, map[string]any{"ok": true, "model": model})
}

func (a *App) syncHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if !a.syncMu.TryLock() {
		jsonOut(w, http.StatusConflict, map[string]string{"error": "sync already running"})
		return
	}
	defer a.syncMu.Unlock()
	ctx, cancel := context.WithTimeout(r.Context(), 75*time.Second)
	defer cancel()
	token, _ := a.vault.Get("github.token")
	cfg := a.store.getSettings()
	previous := a.store.getGitHub()
	syncCfg := cfg
	if token == "" {
		syncCfg = publicSyncConfig(cfg)
	}
	snap := a.githubConnector(token).sync(ctx, cfg.GitHubOrg, syncCfg)
	if token == "" && len(snap.Repos) > 0 {
		snap = mergePublicSnapshot(a.store.getGitHub(), snap)
	}
	if len(snap.Repos) == 0 && len(snap.Errors) > 0 {
		jsonOut(w, http.StatusBadGateway, snap)
		return
	}
	_ = a.store.saveGitHub(snap)
	probes := runProbes(ctx, cfg.Probes)
	_ = a.store.setProbes(probes)
	if githubHasActivityDelta(previous, snap) {
		a.broadcast("github-activity")
	} else {
		a.broadcast("sync")
	}
	go a.maybeTypeSafeEvaluate(a.lifecycle(), false, "operator-sync")
	jsonOut(w, http.StatusOK, snap)
}
func (a *App) githubConnectionHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		_, err := a.vault.Get("github.token")
		jsonOut(w, http.StatusOK, map[string]any{"configured": err == nil})
	case http.MethodPost:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		var in struct {
			Token string `json:"token"`
		}
		if err := decodeJSON(r, &in); err != nil || strings.TrimSpace(in.Token) == "" {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": "token required"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		login, err := newGitHubClient(strings.TrimSpace(in.Token)).validate(ctx)
		if err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": "GitHub validation failed: " + err.Error()})
			return
		}
		if err := a.vault.Set("github.token", strings.TrimSpace(in.Token)); err != nil {
			jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		a.resetGitHubConnector()
		jsonOut(w, http.StatusOK, map[string]any{"configured": true, "identity": login, "storage": "Windows DPAPI user scope"})
	case http.MethodDelete:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		_ = a.vault.Delete("github.token")
		a.resetGitHubConnector()
		jsonOut(w, http.StatusOK, map[string]bool{"configured": false})
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}
func (a *App) settingsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jsonOut(w, http.StatusOK, a.store.getSettings())
	case http.MethodPut:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		var x Settings
		if err := decodeJSON(r, &x); err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if err := a.store.saveSettings(x); err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		jsonOut(w, http.StatusOK, a.store.getSettings())
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}
func (a *App) metricsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		jsonOut(w, http.StatusOK, a.store.getMetrics())
	case http.MethodPost:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		var x MetricSample
		if err := decodeJSON(r, &x); err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		if x.Name == "" || x.Source == "" {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": "name and source are required"})
			return
		}
		if x.ObservedAt.IsZero() {
			x.ObservedAt = a.nowUTC()
		}
		if err := a.store.addMetric(x); err != nil {
			jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		a.broadcast("metric")
		jsonOut(w, http.StatusCreated, x)
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}
func (a *App) probesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	p := runProbes(ctx, a.store.getSettings().Probes)
	_ = a.store.setProbes(p)
	a.broadcast("probes")
	jsonOut(w, http.StatusOK, p)
}
func (a *App) streamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	f, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	ch := make(chan string, 4)
	a.sseMu.Lock()
	a.sse[ch] = struct{}{}
	a.sseMu.Unlock()
	defer func() { a.sseMu.Lock(); delete(a.sse, ch); a.sseMu.Unlock() }()
	fmt.Fprint(w, "event: ready\ndata: {}\n\n")
	f.Flush()
	tick := time.NewTicker(25 * time.Second)
	defer tick.Stop()
	for {
		select {
		case ev := <-ch:
			fmt.Fprintf(w, "event: update\ndata: %q\n\n", ev)
			f.Flush()
		case <-tick.C:
			fmt.Fprint(w, "event: ping\ndata: {}\n\n")
			f.Flush()
		case <-r.Context().Done():
			return
		case <-a.lifecycle().Done():
			return
		}
	}
}
func (a *App) shutdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	jsonOut(w, http.StatusOK, map[string]bool{"shuttingDown": true})
	go a.shutdownGracefully()
}

func (a *App) shutdownGracefully() {
	a.shutdownOnce.Do(func() {
		a.lifecycleMu.RLock()
		cancel := a.lifecycleCancel
		srv := a.server
		a.lifecycleMu.RUnlock()
		if cancel != nil {
			cancel()
		}
		if srv != nil {
			ctx, done := context.WithTimeout(context.Background(), 5*time.Second)
			_ = srv.Shutdown(ctx)
			done()
		}
	})
}
