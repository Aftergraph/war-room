package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAgentBridgeHeartbeatAndStaleProjection(t *testing.T) {
	a := testApp(t)
	token := a.ensureAgentBridgeToken()
	body := `{"contract":"aftergraph.agent.heartbeat/0.1","agent":{"id":"hermes:vds","name":"Hermes VDS","kind":"agent","provider":"Hermes","state":"running","currentAction":"review governance","repo":"after-graph-governance"}}`
	r := httptest.NewRequest(http.MethodPost, "/api/agents/heartbeat", strings.NewReader(body))
	r.Header.Set("Authorization", "Bearer "+token)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("heartbeat status=%d body=%s", w.Code, w.Body.String())
	}
	s := a.agentSnapshot()
	if s.Active != 1 || s.Running != 1 || len(s.Sessions) != 1 {
		t.Fatalf("unexpected agent snapshot: %+v", s)
	}
	if s.Sessions[0].Repo != "after-graph-governance" || s.Sessions[0].Source != "Agent Bridge" {
		t.Fatalf("heartbeat provenance lost: %+v", s.Sessions[0])
	}

	x := s.Sessions[0]
	x.LastHeartbeat = time.Now().Add(-2 * time.Minute)
	if err := a.upsertAgent(x); err != nil {
		t.Fatal(err)
	}
	s = a.agentSnapshot()
	if s.Stale != 1 || s.Active != 0 || s.Sessions[0].State != "stale" {
		t.Fatalf("stale heartbeat not projected fail-closed: %+v", s)
	}
}

func TestWorksFramesProjectRunnerAndWorkEvent(t *testing.T) {
	a := testApp(t)
	a.consumeWorksFrame("http://works.local", "runner", []byte(`{"id":"wrkr_1","pool":"aftergraph-ci","state":"running","work_id":"wrk_abc"}`))
	a.consumeWorksFrame("http://works.local", "work", []byte(`{"id":"wrk_abc","state":"SUCCEEDED","repo":"runtime"}`))
	s := a.agentSnapshot()
	if len(s.Sessions) != 1 || s.Sessions[0].ID != "works:wrkr_1" || s.Sessions[0].Provider != "WORKS" {
		t.Fatalf("runner projection unexpected: %+v", s.Sessions)
	}
	if len(s.Events) != 1 || s.Events[0].WorkID != "wrk_abc" || s.Events[0].Repo != "runtime" {
		t.Fatalf("work event projection unexpected: %+v", s.Events)
	}
}

func TestAgentBridgeRejectsWrongToken(t *testing.T) {
	a := testApp(t)
	r := httptest.NewRequest(http.MethodPost, "/api/agents/heartbeat", strings.NewReader(`{"agent":{"id":"x"}}`))
	r.Header.Set("Authorization", "Bearer wrong")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d want=403", w.Code)
	}
}

func TestAgentSnapshotRoute(t *testing.T) {
	a := testApp(t)
	_ = a.upsertAgent(AgentSession{ID: "codex:1", Name: "Codex", State: "waiting", LastHeartbeat: time.Now().UTC(), Source: "test"})
	r := httptest.NewRequest(http.MethodGet, "/api/agents", nil)
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d", w.Code)
	}
	var s AgentSnapshot
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if s.Active != 1 || s.Waiting != 1 {
		t.Fatalf("snapshot=%+v", s)
	}
}

func TestAgentSnapshotUsesStableEmptyCollections(t *testing.T) {
	got := summarizeAgents(AgentSnapshot{}, 45*time.Second)
	if got.Sessions == nil || got.Events == nil || got.Sources == nil {
		t.Fatalf("nil collections leak unstable JSON shape: %#v", got)
	}
}

func TestUnknownAgentStateRemainsUnknownAndInactive(t *testing.T) {
	now := time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC)
	s := summarizeAgentsAt(AgentSnapshot{Sessions: []AgentSession{{ID: "worker:x", State: "mystery", LastHeartbeat: now}}}, 45*time.Second, now)
	if len(s.Sessions) != 1 || s.Sessions[0].State != "unknown" {
		t.Fatalf("unrecognized state must project as unknown: %+v", s.Sessions)
	}
	if s.Active != 0 || s.Running != 0 || s.Waiting != 0 || s.Blocked != 0 {
		t.Fatalf("unknown state must not manufacture active presence: %+v", s)
	}
}
