package main

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDurableWriteFailureDoesNotPublishSettings(t *testing.T) {
	dir := t.TempDir()
	s, err := newStore(dir, GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	before := s.getSettings()
	s.fault = func(file, phase string) error {
		if file == "settings.json" && phase == "tmp-synced" {
			return errors.New("injected durable write failure")
		}
		return nil
	}
	next := before
	next.GitHubOrg = "must-not-publish"
	if err := s.saveSettings(next); err == nil {
		t.Fatal("expected persistence failure")
	}
	if got := s.getSettings().GitHubOrg; got != before.GitHubOrg {
		t.Fatalf("in-memory settings published before durable write: got %q want %q", got, before.GitHubOrg)
	}
}

func TestDurableWriteFailureDoesNotPublishAgentMutation(t *testing.T) {
	dir := t.TempDir()
	s, err := newStore(dir, GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	s.fault = func(file, phase string) error {
		if file == "agents.json" && phase == "tmp-synced" {
			return errors.New("injected durable write failure")
		}
		return nil
	}
	if err := s.mutateAgents(func(v *AgentSnapshot) error {
		v.Sessions = append(v.Sessions, AgentSession{ID: "ghost", State: "running"})
		return nil
	}); err == nil {
		t.Fatal("expected persistence failure")
	}
	if got := s.getAgents(); len(got.Sessions) != 0 {
		t.Fatalf("failed agent mutation leaked into memory: %+v", got.Sessions)
	}
}

func TestCorruptPersistenceJournalIsQuarantined(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, persistenceJournalName), []byte(`{broken`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "settings.json.tmp"), []byte("uncommitted"), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := newStore(dir, GitHubSnapshot{})
	if err != nil {
		t.Fatalf("corrupt journal must be quarantined, not brick startup: %v", err)
	}
	issues, _ := s.stateLoadDiagnostics()
	if len(issues) == 0 || issues[0].File != persistenceJournalName || !strings.Contains(issues[0].Error, "quarantined") {
		t.Fatalf("missing quarantine diagnostic: %#v", issues)
	}
	if _, err := os.Stat(filepath.Join(dir, "settings.json.tmp")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("uncommitted tmp survived quarantine: %v", err)
	}
	matches, err := filepath.Glob(filepath.Join(dir, persistenceJournalName+".corrupt-*"))
	if err != nil || len(matches) != 1 {
		t.Fatalf("quarantined journal count=%d err=%v", len(matches), err)
	}
}

func TestPersistenceJournalRejectsEscapingOrJournalTarget(t *testing.T) {
	for _, target := range []string{"../settings.json", persistenceJournalName} {
		t.Run(strings.ReplaceAll(target, "/", "_"), func(t *testing.T) {
			if err := validPersistenceJournal(persistenceJournal{Version: 1, File: target, Phase: "prepared"}); err == nil {
				t.Fatalf("target %q unexpectedly accepted", target)
			}
		})
	}
}

func TestAgentHeartbeatSequenceRejectsLateDuplicateAndSequenceLessRegression(t *testing.T) {
	a := testApp(t)
	now := time.Date(2026, 9, 19, 2, 0, 0, 0, time.UTC)
	a.now = func() time.Time { return now }
	a.store.now = a.now
	if err := a.upsertAgent(AgentSession{ID: "worker", Sequence: 2, State: "running", CurrentAction: "new", Progress: .8}); err != nil {
		t.Fatal(err)
	}
	for _, late := range []AgentSession{
		{ID: "worker", Sequence: 1, State: "blocked", CurrentAction: "old", Progress: .1},
		{ID: "worker", Sequence: 2, State: "blocked", CurrentAction: "duplicate", Progress: .2},
		{ID: "worker", Sequence: 0, State: "blocked", CurrentAction: "sequence-less", Progress: .3},
	} {
		if err := a.upsertAgent(late); err != nil {
			t.Fatal(err)
		}
	}
	got := a.store.getAgents().Sessions[0]
	if got.Sequence != 2 || got.CurrentAction != "new" || got.State != "running" || got.Progress != .8 {
		t.Fatalf("late heartbeat regressed projection: %+v", got)
	}
	if err := a.upsertAgent(AgentSession{ID: "worker", Sequence: 3, State: "waiting", CurrentAction: "newer", Progress: .9}); err != nil {
		t.Fatal(err)
	}
	got = a.store.getAgents().Sessions[0]
	if got.Sequence != 3 || got.CurrentAction != "newer" || got.State != "waiting" {
		t.Fatalf("newer heartbeat was not accepted: %+v", got)
	}
}

func TestAgentSourceObservationDoesNotRegress(t *testing.T) {
	a := testApp(t)
	base := time.Date(2026, 9, 19, 2, 0, 0, 0, time.UTC)
	a.now = func() time.Time { return base.Add(10 * time.Second) }
	a.store.now = a.now
	newer := AgentSourceStatus{ID: "agent-bridge", Status: "live", LastObservedAt: base.Add(8 * time.Second)}
	older := AgentSourceStatus{ID: "agent-bridge", Status: "degraded", LastObservedAt: base.Add(2 * time.Second), Error: "late packet"}
	a.updateAgentSource(newer)
	a.updateAgentSource(older)
	got := a.store.getAgents().Sources[0]
	if got.Status != "live" || !got.LastObservedAt.Equal(newer.LastObservedAt) {
		t.Fatalf("older source observation regressed projection: %+v", got)
	}
}

func TestAgentEventRejectsExcessiveFutureTimestamp(t *testing.T) {
	a := testApp(t)
	now := time.Date(2026, 9, 19, 2, 0, 0, 0, time.UTC)
	a.now = func() time.Time { return now }
	a.store.now = a.now
	err := a.addAgentEvent(AgentEvent{Kind: "progress", Title: "future", Timestamp: now.Add(5*time.Minute + time.Nanosecond)})
	if err == nil || !strings.Contains(err.Error(), "future timestamp") {
		t.Fatalf("expected future timestamp rejection, got %v", err)
	}
	if got := a.store.getAgents(); len(got.Events) != 0 {
		t.Fatalf("future event persisted: %+v", got.Events)
	}
}

func TestConnectorRecoveryLatencyAndStableAnchor(t *testing.T) {
	now := time.Date(2026, 9, 19, 2, 0, 0, 0, time.UTC)
	a := &App{now: func() time.Time { return now }, connectors: map[string]ConnectorState{}}
	if err := a.transitionConnector("github", "degraded", "network", "provider-failure"); err != nil {
		t.Fatal(err)
	}
	now = now.Add(3 * time.Second)
	if err := a.transitionConnector("github", "live", "", "provider-success"); err != nil {
		t.Fatal(err)
	}
	first := a.connectorSnapshot()["github"]
	if first.LastRecoveryMs != 3000 || !first.StableSince.Equal(now) {
		t.Fatalf("recovery telemetry=%+v", first)
	}
	stable := first.StableSince
	now = now.Add(4 * time.Second)
	if err := a.transitionConnector("github", "live", "", "provider-observation"); err != nil {
		t.Fatal(err)
	}
	second := a.connectorSnapshot()["github"]
	if !second.StableSince.Equal(stable) || second.LastRecoveryMs != 3000 {
		t.Fatalf("repeated live observation reset recovery anchor: %+v", second)
	}
}
