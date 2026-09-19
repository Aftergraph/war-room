package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCoreReadHandlersAndMethodContracts(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	a.now = func() time.Time { return time.Date(2026, 9, 19, 12, 0, 0, 0, time.UTC) }
	a.store.now = a.now
	for _, path := range []string{"/api/health", "/api/diagnostics", "/api/agents", "/api/session"} {
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, path, nil)
		a.routes().ServeHTTP(rr, req)
		if rr.Code != 200 {
			t.Fatalf("%s status=%d body=%s", path, rr.Code, rr.Body.String())
		}
		rr = httptest.NewRecorder()
		req = httptest.NewRequest(http.MethodPatch, path, nil)
		a.routes().ServeHTTP(rr, req)
		if rr.Code != http.StatusMethodNotAllowed {
			t.Fatalf("%s patch=%d", path, rr.Code)
		}
	}
}

func TestAgentBridgeHeartbeatUsesInjectedClockAndStrictContract(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	fixed := time.Date(2026, 9, 19, 12, 34, 56, 0, time.UTC)
	a.now = func() time.Time { return fixed }
	a.store.now = a.now
	token := a.ensureAgentBridgeToken()
	body := `{"contract":"aftergraph.agent.heartbeat/0.1","agent":{"id":"codex","name":"Codex","state":"running"}}`
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/agents/heartbeat", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	a.routes().ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("status=%d body=%s", rr.Code, rr.Body.String())
	}
	got := a.store.getAgents()
	if len(got.Sessions) != 1 || !got.Sessions[0].LastHeartbeat.Equal(fixed) {
		t.Fatalf("heartbeat=%+v", got)
	}

	rr = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/agents/heartbeat", strings.NewReader(`{"contract":"bad","agent":{"id":"x"}}`))
	req.Header.Set("Authorization", "Bearer "+token)
	a.routes().ServeHTTP(rr, req)
	if rr.Code != 400 {
		t.Fatalf("bad contract status=%d", rr.Code)
	}
}

func TestStateEnvelopeRejectsFutureVersion(t *testing.T) {
	payload, _ := json.Marshal(map[string]string{"value": "x"})
	raw, _ := json.Marshal(stateEnvelope{Schema: stateSchema, Version: 99, WrittenAt: time.Now(), Payload: payload})
	var got map[string]string
	if err := decodeStateFile(raw, &got); err == nil || !strings.Contains(err.Error(), "unsupported state version") {
		t.Fatalf("err=%v", err)
	}
}

func TestDecodeJSONRejectsUnknownAndTrailingValues(t *testing.T) {
	var out struct {
		Name string `json:"name"`
	}
	req := httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"name":"ok","extra":1}`))
	if err := decodeJSON(req, &out); err == nil {
		t.Fatal("expected unknown field rejection")
	}
	req = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(`{"name":"ok"}{"name":"two"}`))
	if err := decodeJSON(req, &out); err == nil {
		t.Fatal("expected trailing value rejection")
	}
}
