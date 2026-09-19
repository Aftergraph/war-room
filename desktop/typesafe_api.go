package main

import (
	"net/http"
	"os"
	"strings"
)

func (a *App) typeSafeKey() string {
	if v, err := a.vault.Get("typesafe.api_key"); err == nil && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return strings.TrimSpace(os.Getenv("TYPESAFE_API_KEY"))
}

func (a *App) typeSafeConfigured() bool { return a.typeSafeKey() != "" }

func (a *App) typeSafeConnectionHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		source := ""
		if _, err := a.vault.Get("typesafe.api_key"); err == nil {
			source = "vault"
		} else if strings.TrimSpace(os.Getenv("TYPESAFE_API_KEY")) != "" {
			source = "environment"
		}
		cfg := a.store.getSettings()
		jsonOut(w, http.StatusOK, map[string]any{"configured": source != "", "source": source, "model": "jev-latest", "native": true, "auto": cfg.TypeSafeAuto, "minIntervalSec": cfg.TypeSafeMinIntervalSec, "dailyBudget": cfg.TypeSafeDailyBudget, "decision": a.getTypeSafeDecision()})
	case http.MethodPost:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		var in struct {
			APIKey string `json:"apiKey"`
		}
		if err := decodeJSON(r, &in); err != nil || strings.TrimSpace(in.APIKey) == "" {
			jsonOut(w, http.StatusBadRequest, map[string]string{"error": "apiKey required"})
			return
		}
		if err := a.vault.Set("typesafe.api_key", strings.TrimSpace(in.APIKey)); err != nil {
			jsonOut(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		go a.maybeTypeSafeEvaluate(a.lifecycle(), true, "credential-activated")
		jsonOut(w, http.StatusOK, map[string]any{"configured": true, "storage": "Windows DPAPI user scope", "model": "jev-latest", "native": true})
	case http.MethodDelete:
		if !a.mutAllowed(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		_ = a.vault.Delete("typesafe.api_key")
		a.typeSafeMu.Lock()
		a.typeSafe = TypeSafeDecision{}
		a.typeSafeMu.Unlock()
		jsonOut(w, http.StatusOK, map[string]bool{"configured": false})
	default:
		http.Error(w, "method", http.StatusMethodNotAllowed)
	}
}

func (a *App) typeSafeEvaluateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !a.mutAllowed(r) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if a.typeSafeKey() == "" {
		jsonOut(w, http.StatusPreconditionFailed, map[string]string{"error": "TypeSafe API key is not configured"})
		return
	}
	decision := a.maybeTypeSafeEvaluate(r.Context(), true, "operator")
	if decision.Error != "" {
		jsonOut(w, http.StatusBadGateway, decision)
		return
	}
	jsonOut(w, http.StatusOK, decision)
}
