package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestAssistantGroundsAgentQueryInObservedSessions(t *testing.T) {
	a := testApp(t)
	_ = a.upsertAgent(AgentSession{ID: "works:w1", Name: "WORKS worker", Kind: "worker", Provider: "WORKS", State: "running", CurrentAction: "wrk_123", LastHeartbeat: time.Now().UTC(), Source: "test"})
	r := loopbackTestRequest(http.MethodPost, "/api/assistant/query", strings.NewReader(`{"query":"what are the agents doing?"}`))
	r.Header.Set("X-WarRoom-Session", a.session)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var out AssistantResponse
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.Answer, "1 active") || len(out.Objects) != 1 || out.Objects[0].Type != "agent" {
		t.Fatalf("assistant response not grounded in agent state: %+v", out)
	}
	for _, action := range out.Actions {
		if action.Kind != "view" && action.Kind != "focus" && action.Kind != "url" {
			t.Fatalf("unexpected authority-bearing action: %+v", action)
		}
	}
}

func TestAssistantSpecificRepoBeatsGenericRepoListing(t *testing.T) {
	a := testApp(t)
	r := loopbackTestRequest(http.MethodPost, "/api/assistant/query", strings.NewReader(`{"query":"tell me about runtime repo"}`))
	r.Header.Set("X-WarRoom-Session", a.session)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	var out AssistantResponse
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if len(out.Objects) != 1 || out.Objects[0].ID != "runtime" {
		t.Fatalf("wanted exact runtime repository object, got %+v", out.Objects)
	}
}

func TestGitHubActivityDelta(t *testing.T) {
	now := time.Now().UTC()
	prev := GitHubSnapshot{Activities: []ActivityItem{{Type: "commit", Repo: "runtime", URL: "u1", Timestamp: now}}}
	same := prev
	if githubHasActivityDelta(prev, same) {
		t.Fatal("same snapshot reported delta")
	}
	next := prev
	next.Activities = append([]ActivityItem(nil), prev.Activities...)
	next.Activities = append(next.Activities, ActivityItem{Type: "pull_request", Repo: "fihim", URL: "u2", Timestamp: now.Add(time.Second)})
	if !githubHasActivityDelta(prev, next) {
		t.Fatal("new activity was not detected")
	}
}
