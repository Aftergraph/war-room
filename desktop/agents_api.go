package main

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"
)

func (a *App) agentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method", http.StatusMethodNotAllowed)
		return
	}
	jsonOut(w, http.StatusOK, a.agentSnapshot())
}

func (a *App) agentHeartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.agentBridgeAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var in struct {
		Contract string       `json:"contract"`
		Agent    AgentSession `json:"agent"`
	}
	if err := decodeJSON(r, &in); err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if in.Contract != "" && in.Contract != agentHeartbeatContract {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "unsupported heartbeat contract"})
		return
	}
	in.Agent.LastHeartbeat = a.nowUTC()
	in.Agent.Source = "Agent Bridge"
	if err := a.upsertAgent(in.Agent); err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	a.updateAgentSource(AgentSourceStatus{ID: "agent-bridge", Name: "Agent Bridge", Kind: "heartbeat", Status: "live", LastObservedAt: in.Agent.LastHeartbeat})
	a.broadcast("agents")
	jsonOut(w, http.StatusOK, map[string]any{"ok": true, "contract": agentHeartbeatContract, "observedAt": in.Agent.LastHeartbeat})
}

func (a *App) agentEventHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.agentBridgeAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var ev AgentEvent
	if err := decodeJSON(r, &ev); err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if strings.TrimSpace(ev.Kind) == "" || strings.TrimSpace(ev.Title) == "" {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": "kind and title are required"})
		return
	}
	ev.Source = "Agent Bridge"
	if err := a.addAgentEvent(ev); err != nil {
		jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	// Source liveness is the time War Room observed the bridge, not a caller-
	// supplied event occurrence timestamp. Event time remains useful provenance,
	// but cannot manufacture freshness.
	observed := a.nowUTC()
	a.updateAgentSource(AgentSourceStatus{ID: "agent-bridge", Name: "Agent Bridge", Kind: "heartbeat", Status: "live", LastObservedAt: observed})
	a.broadcast("agents")
	jsonOut(w, http.StatusCreated, ev)
}

func (a *App) agentBridgeHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		out := map[string]any{
			"configured": true,
			"contract":   agentHeartbeatContract,
			"heartbeat":  "/api/agents/heartbeat",
			"event":      "/api/agents/event",
			"storage":    "Windows DPAPI current-user scope",
		}
		if r.URL.Query().Get("reveal") == "1" {
			if !a.mutAllowed(r) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			out["token"] = a.ensureAgentBridgeToken()
		}
		jsonOut(w, http.StatusOK, out)
	case http.MethodPost:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		t := randomToken()
		if err := a.vault.Set("agents.bridge_token", t); err != nil {
			jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		jsonOut(w, http.StatusOK, map[string]any{"token": t, "contract": agentHeartbeatContract, "rotated": true})
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}

func validHTTPBase(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return "", errors.New("http(s) URL required")
	}
	u.Path = strings.TrimRight(u.Path, "/")
	u.RawQuery, u.Fragment = "", ""
	return strings.TrimRight(u.String(), "/"), nil
}

func (a *App) worksConnectionHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		cfg := a.store.getSettings()
		_, err := a.vault.Get("works.token")
		jsonOut(w, http.StatusOK, map[string]any{"configured": cfg.WorksEnabled && cfg.WorksURL != "", "enabled": cfg.WorksEnabled, "url": cfg.WorksURL, "tokenConfigured": err == nil})
	case http.MethodPost:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		var in struct {
			URL     string `json:"url"`
			Token   string `json:"token"`
			Enabled bool   `json:"enabled"`
		}
		if err := decodeJSON(r, &in); err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		base, err := validHTTPBase(in.URL)
		if err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
			return
		}
		token := strings.TrimSpace(in.Token)
		if token == "" {
			token, _ = a.vault.Get("works.token")
		}
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		if err := validateWorks(ctx, base, token); err != nil {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": "WORKS validation failed: " + err.Error()})
			return
		}
		cfg := a.store.getSettings()
		cfg.WorksURL, cfg.WorksEnabled = base, in.Enabled
		if err := a.store.saveSettings(cfg); err != nil {
			jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		if strings.TrimSpace(in.Token) != "" {
			if err := a.vault.Set("works.token", strings.TrimSpace(in.Token)); err != nil {
				jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
		}
		jsonOut(w, http.StatusOK, map[string]any{"configured": true, "enabled": in.Enabled, "url": base, "stream": base + "/v1/ui/events"})
	case http.MethodDelete:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		cfg := a.store.getSettings()
		cfg.WorksEnabled = false
		_ = a.store.saveSettings(cfg)
		_ = a.vault.Delete("works.token")
		jsonOut(w, http.StatusOK, map[string]bool{"configured": false})
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}
