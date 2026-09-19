package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func (a *App) assistantStatus() AssistantStatus {
	a.assistantMu.RLock()
	cached := a.assistantStatusCache
	a.assistantMu.RUnlock()
	if !cached.CheckedAt.IsZero() && a.nowUTC().Sub(cached.CheckedAt) < 30*time.Second {
		return cached
	}
	st := a.detectAssistantStatus(a.lifecycle())
	a.assistantMu.Lock()
	a.assistantStatusCache = st
	a.assistantMu.Unlock()
	return st
}

func (a *App) detectAssistantStatus(parent context.Context) AssistantStatus {
	cfg := a.store.getSettings()
	st := AssistantStatus{Mode: "grounded-core", GroundedCore: true, CheckedAt: a.nowUTC(), OllamaURL: cfg.AssistantOllamaURL}
	if !cfg.AssistantLocalModel {
		a.setConnectorState("assistant", "disconnected", "")
		return st
	}
	base, err := validHTTPBase(cfg.AssistantOllamaURL)
	if err != nil {
		st.Error = err.Error()
		return st
	}
	a.setConnectorState("assistant", "connecting", "")
	ctx, cancel := context.WithTimeout(parent, 900*time.Millisecond)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/tags", nil)
	doer := a.assistantHTTP
	if doer == nil {
		doer = &http.Client{Timeout: time.Second}
	}
	resp, err := doer.Do(req)
	if err != nil {
		st.Error = "local model not observed"
		a.setConnectorState("assistant", "degraded", classifyProviderError(err))
		return st
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		st.Error = fmt.Sprintf("local model endpoint HTTP %d", resp.StatusCode)
		return st
	}
	var out struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil || len(out.Models) == 0 {
		st.Error = "no local model observed"
		return st
	}
	model := strings.TrimSpace(cfg.AssistantModel)
	if model == "" {
		model = out.Models[0].Name
	}
	st.LocalModelAvailable = true
	st.LocalModel = model
	st.Mode = "grounded-core + local-model"
	st.Error = ""
	a.setConnectorState("assistant", "live", "")
	return st
}

func (a *App) assistantStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, a.assistantStatus())
}

func (a *App) assistantHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var in struct {
		Query string `json:"query"`
	}
	if err := decodeJSON(r, &in); err != nil || strings.TrimSpace(in.Query) == "" {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "query is required"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 12*time.Second)
	defer cancel()
	jsonOut(w, http.StatusOK, a.answerAssistant(ctx, strings.TrimSpace(in.Query)))
}

func assistantResponse(answer string) AssistantResponse {
	return AssistantResponse{ID: randomToken()[:12], Answer: answer, Mode: "grounded-core", Confidence: 1, GeneratedAt: time.Now().UTC()}
}
