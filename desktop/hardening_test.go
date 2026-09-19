package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestStoreReadSnapshotsDoNotAliasInternalState(t *testing.T) {
	st, err := newStore(t.TempDir(), GitHubSnapshot{
		Repos:      []Repo{{Name: "runtime"}},
		Activities: []ActivityItem{{Type: "commit", Repo: "runtime"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	cfg := st.getSettings()
	cfg.RepoDomains["runtime"] = "mutated"
	cfg.Probes[0].Name = "mutated"
	freshCfg := st.getSettings()
	if _, ok := freshCfg.RepoDomains["runtime"]; ok {
		t.Fatal("settings RepoDomains leaked a mutable map alias")
	}
	if freshCfg.Probes[0].Name == "mutated" {
		t.Fatal("settings Probes leaked a mutable slice alias")
	}

	gh := st.getGitHub()
	gh.Repos[0].Name = "mutated"
	gh.Activities[0].Repo = "mutated"
	freshGH := st.getGitHub()
	if freshGH.Repos[0].Name != "runtime" || freshGH.Activities[0].Repo != "runtime" {
		t.Fatal("GitHub snapshot leaked mutable slice aliases")
	}
}

func TestConcurrentAgentUpdatesDoNotLoseSessionsOrEvents(t *testing.T) {
	app, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	const n = 40
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		i := i
		wg.Add(2)
		go func() {
			defer wg.Done()
			if err := app.upsertAgent(AgentSession{ID: fmt.Sprintf("agent-%02d", i), State: "running", LastHeartbeat: time.Now().UTC()}); err != nil {
				t.Errorf("upsert agent: %v", err)
			}
		}()
		go func() {
			defer wg.Done()
			if err := app.addAgentEvent(AgentEvent{ID: fmt.Sprintf("event-%02d", i), AgentID: fmt.Sprintf("agent-%02d", i), Kind: "progress", Title: "tick", Timestamp: time.Now().UTC()}); err != nil {
				t.Errorf("add event: %v", err)
			}
		}()
	}
	wg.Wait()
	s := app.store.getAgents()
	if got := len(s.Sessions); got != n {
		t.Fatalf("sessions=%d want=%d", got, n)
	}
	if got := len(s.Events); got != n {
		t.Fatalf("events=%d want=%d", got, n)
	}
}

func TestWaitContextCancelsPromptly(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	start := time.Now()
	if waitContext(ctx, time.Second) {
		t.Fatal("waitContext should report cancellation")
	}
	if time.Since(start) > 100*time.Millisecond {
		t.Fatal("waitContext did not react promptly to cancellation")
	}
}

func TestDecodeJSONRejectsTrailingValues(t *testing.T) {
	req := loopbackTestRequest(http.MethodPost, "/", strings.NewReader(`{"value":1} {"value":2}`))
	var dst struct {
		Value int `json:"value"`
	}
	if err := decodeJSON(req, &dst); err == nil {
		t.Fatal("expected trailing JSON to be rejected")
	}
}

func TestStoreNestedCollectionsDoNotAliasInternalState(t *testing.T) {
	st, err := newStore(t.TempDir(), GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	labels := map[string]string{"k": "v"}
	if err := st.addMetric(MetricSample{Name: "m", Source: "test", Labels: labels}); err != nil {
		t.Fatal(err)
	}
	labels["k"] = "caller-mutated"
	gotMetrics := st.getMetrics()
	if gotMetrics[0].Labels["k"] != "v" {
		t.Fatalf("metric save retained caller alias: %#v", gotMetrics[0].Labels)
	}
	gotMetrics[0].Labels["k"] = "read-mutated"
	if fresh := st.getMetrics()[0].Labels["k"]; fresh != "v" {
		t.Fatalf("metric read leaked nested alias: %q", fresh)
	}

	input := AgentSnapshot{Sessions: []AgentSession{{ID: "a", Capabilities: []string{"read"}, Metadata: map[string]string{"node": "one"}}}, Events: []AgentEvent{{ID: "e", Metadata: map[string]string{"kind": "x"}}}}
	if err := st.saveAgents(input); err != nil {
		t.Fatal(err)
	}
	input.Sessions[0].Capabilities[0] = "caller-mutated"
	input.Sessions[0].Metadata["node"] = "caller-mutated"
	snap := st.getAgents()
	if snap.Sessions[0].Capabilities[0] != "read" || snap.Sessions[0].Metadata["node"] != "one" {
		t.Fatalf("agent save retained caller alias: %#v", snap.Sessions[0])
	}
	snap.Sessions[0].Capabilities[0] = "read-mutated"
	snap.Sessions[0].Metadata["node"] = "read-mutated"
	snap.Events[0].Metadata["kind"] = "read-mutated"
	fresh := st.getAgents()
	if fresh.Sessions[0].Capabilities[0] != "read" || fresh.Sessions[0].Metadata["node"] != "one" || fresh.Events[0].Metadata["kind"] != "x" {
		t.Fatal("agent getter leaked nested mutable state")
	}
}
