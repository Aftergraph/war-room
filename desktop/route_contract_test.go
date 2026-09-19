package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func requestRoute(t *testing.T, a *App, method, path, body string, authorized bool) *httptest.ResponseRecorder {
	t.Helper()
	var r *http.Request
	if body == "" {
		r = loopbackTestRequest(method, path, nil)
	} else {
		r = loopbackTestRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	}
	if authorized {
		r.Header.Set("X-WarRoom-Session", a.session)
	}
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	return w
}

func TestSessionAndHealthContracts(t *testing.T) {
	a := testApp(t)
	w := requestRoute(t, a, http.MethodGet, "/api/session", "", false)
	if w.Code != http.StatusOK {
		t.Fatalf("session status=%d", w.Code)
	}
	var s map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s["session"] != a.session || s["version"] != version {
		t.Fatalf("session response=%v", s)
	}

	w = requestRoute(t, a, http.MethodPost, "/api/session", "", false)
	if w.Code != http.StatusMethodNotAllowed {
		t.Fatalf("session POST=%d", w.Code)
	}

	w = requestRoute(t, a, http.MethodGet, "/api/health", "", false)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"ok":true`) {
		t.Fatalf("health=%d %s", w.Code, w.Body.String())
	}
}

func TestSettingsMutationClampsUnsafeBoundsAndPersists(t *testing.T) {
	a := testApp(t)
	body := `{"githubOrg":"Aftergraph","refreshSeconds":1,"workflowRepoCap":999,"repoDomains":{},"typeSafeMinIntervalSec":1,"typeSafeDailyBudget":5000,"agentStaleSeconds":1,"assistantOllamaUrl":"","probes":[]}`
	w := requestRoute(t, a, http.MethodPut, "/api/settings", body, true)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	got := a.store.getSettings()
	if got.RefreshSeconds != 60 || got.WorkflowRepoCap != 60 || got.TypeSafeMinIntervalSec != 60 || got.TypeSafeDailyBudget != 1000 || got.AgentStaleSeconds != 15 {
		t.Fatalf("bounds not clamped: %+v", got)
	}
	if got.AssistantOllamaURL != "http://127.0.0.1:11434" {
		t.Fatalf("ollama default=%q", got.AssistantOllamaURL)
	}
}

func TestSettingsAndMetricsRejectMalformedOrUnauthorizedWrites(t *testing.T) {
	a := testApp(t)
	w := requestRoute(t, a, http.MethodPut, "/api/settings", `{"githubOrg":"Aftergraph"}`, false)
	if w.Code != http.StatusForbidden {
		t.Fatalf("settings unauthorized=%d", w.Code)
	}

	w = requestRoute(t, a, http.MethodPost, "/api/metrics", `{"name":"VSR","source":"x"} {"extra":true}`, true)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("metrics trailing JSON=%d body=%s", w.Code, w.Body.String())
	}

	w = requestRoute(t, a, http.MethodPost, "/api/metrics", `{"name":"VSR"}`, true)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("metrics missing source=%d", w.Code)
	}
}

func TestGitHubConnectionReadAndDeleteDoNotLeakCredential(t *testing.T) {
	a := testApp(t)
	if err := a.vault.Set("github.token", "super-secret-token"); err != nil {
		t.Fatal(err)
	}
	w := requestRoute(t, a, http.MethodGet, "/api/github/connection", "", false)
	if w.Code != http.StatusOK || strings.Contains(w.Body.String(), "super-secret-token") || !strings.Contains(w.Body.String(), `"configured":true`) {
		t.Fatalf("GET status=%d body=%s", w.Code, w.Body.String())
	}
	w = requestRoute(t, a, http.MethodDelete, "/api/github/connection", "", true)
	if w.Code != http.StatusOK {
		t.Fatalf("DELETE status=%d body=%s", w.Code, w.Body.String())
	}
	if _, err := a.vault.Get("github.token"); err == nil {
		t.Fatal("token still present after delete")
	}
}
