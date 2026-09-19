package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestConnectorTransitionInvariantAndReason(t *testing.T) {
	now := time.Date(2026, 9, 19, 2, 0, 0, 0, time.UTC)
	a := &App{now: func() time.Time { return now }, connectors: map[string]ConnectorState{}}
	if err := a.transitionConnector("github", "disconnected", "", "startup"); err != nil {
		t.Fatal(err)
	}
	if err := a.transitionConnector("github", "stale", "", "impossible-direct-jump"); err == nil {
		t.Fatal("expected disconnected -> stale to be rejected")
	}
	if err := a.transitionConnector("github", "connecting", "", "manual-sync"); err != nil {
		t.Fatal(err)
	}
	now = now.Add(time.Second)
	if err := a.transitionConnector("github", "live", "", "provider-success"); err != nil {
		t.Fatal(err)
	}
	got := a.connectorSnapshot()["github"]
	if got.State != "live" || got.LastTransitionReason != "provider-success" {
		t.Fatalf("unexpected connector state: %+v", got)
	}
	events := a.diagnosticEvents()
	if len(events) != 3 {
		t.Fatalf("transition events=%d want 3", len(events))
	}
}

func TestDiagnosticEventRingBoundedAndRedacted(t *testing.T) {
	a := &App{now: time.Now}
	for i := 0; i < diagnosticEventLimit+37; i++ {
		a.recordDiagnosticEvent("connector.transition", "github", "live->degraded", fmt.Sprintf("token=abcdefghijklmnopqrstuvwxyz0123456789-%d", i), "network")
	}
	events := a.diagnosticEvents()
	if len(events) != diagnosticEventLimit {
		t.Fatalf("events=%d want %d", len(events), diagnosticEventLimit)
	}
	b, _ := json.Marshal(events)
	if bytes.Contains(bytes.ToLower(b), []byte("abcdefghijklmnopqrstuvwxyz0123456789")) {
		t.Fatal("diagnostic ring leaked secret-like value")
	}
}

func TestStateGenerationMonotonicAndHighestValidWins(t *testing.T) {
	dir := t.TempDir()
	s, err := newStore(dir, GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	first := defaultSettings()
	first.GitHubOrg = "gen-one"
	if err := s.writeJSON("settings.json", first); err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(dir, "settings.json")
	g1 := fileStateGeneration(p)
	second := first
	second.GitHubOrg = "gen-two"
	if err := s.writeJSON("settings.json", second); err != nil {
		t.Fatal(err)
	}
	g2 := fileStateGeneration(p)
	if g2 <= g1 {
		t.Fatalf("generation did not increase: %d -> %d", g1, g2)
	}

	// Simulate an inverted durable layout: backup contains the newer generation.
	newer, err := encodeStateFileGeneration(time.Now(), g2+5, Settings{GitHubOrg: "newest"})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p+".bak", newer, 0600); err != nil {
		t.Fatal(err)
	}
	var out Settings
	if _, err := s.readJSONWithMigration("settings.json", &out); err != nil {
		t.Fatal(err)
	}
	if out.GitHubOrg != "newest" {
		t.Fatalf("highest generation not selected: %q", out.GitHubOrg)
	}
}

func TestRecoveryPromotesHighestGeneration(t *testing.T) {
	dir := t.TempDir()
	s := &Store{baseDir: dir, now: time.Now}
	primary, _ := encodeStateFileGeneration(time.Now(), 4, Settings{GitHubOrg: "old"})
	backup, _ := encodeStateFileGeneration(time.Now(), 9, Settings{GitHubOrg: "new"})
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), primary, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "settings.json.bak"), backup, 0600); err != nil {
		t.Fatal(err)
	}
	j := persistenceJournal{Version: 1, File: "settings.json", Phase: "committed", Generation: 9, StartedAt: time.Now()}
	if err := s.writePersistenceJournal(j); err != nil {
		t.Fatal(err)
	}
	if err := s.recoverPersistenceJournal(); err != nil {
		t.Fatal(err)
	}
	if got := fileStateGeneration(filepath.Join(dir, "settings.json")); got != 9 {
		t.Fatalf("recovered generation=%d want 9", got)
	}
}

func TestProcessLifecycleHelper(t *testing.T) {
	if os.Getenv("WAR_ROOM_PROCESS_HELPER") != "1" {
		return
	}
	base := os.Getenv("WAR_ROOM_PROCESS_BASE")
	a, err := newApp(base)
	if err != nil {
		t.Fatal(err)
	}
	if err := a.run(); err != nil {
		t.Fatal(err)
	}
}

func TestRealProcessSSEShutdownReleasesStateLock(t *testing.T) {
	if testing.Short() {
		t.Skip("process harness")
	}
	base := t.TempDir()
	worksConnected := make(chan struct{}, 1)
	works := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/v1/ui":
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte("ok"))
		case "/v1/ui/events":
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusOK)
			if f, ok := w.(http.Flusher); ok {
				_, _ = w.Write([]byte("event: runner\ndata: {\"id\":\"wrkr_test\",\"state\":\"running\"}\n\n"))
				f.Flush()
			}
			select {
			case worksConnected <- struct{}{}:
			default:
			}
			<-r.Context().Done()
		default:
			http.NotFound(w, r)
		}
	}))
	defer works.Close()
	seed, err := newStore(base, GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	cfg := seed.getSettings()
	cfg.WorksEnabled = true
	cfg.WorksURL = works.URL
	if err := seed.saveSettings(cfg); err != nil {
		t.Fatal(err)
	}

	exe, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	cmd := exec.Command(exe, "-test.run=^TestProcessLifecycleHelper$", "-test.v")
	cmd.Env = append(os.Environ(), "WAR_ROOM_PROCESS_HELPER=1", "WAR_ROOM_PROCESS_BASE="+base, "WAR_ROOM_NO_BROWSER=1")
	var childOut bytes.Buffer
	cmd.Stdout, cmd.Stderr = &childOut, &childOut
	if err := cmd.Start(); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if cmd.ProcessState == nil || !cmd.ProcessState.Exited() {
			_ = cmd.Process.Kill()
		}
	}()

	client := &http.Client{Timeout: 500 * time.Millisecond}
	var root string
	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) && root == "" {
		for p := 37621; p <= 37630; p++ {
			u := fmt.Sprintf("http://127.0.0.1:%d/api/health", p)
			resp, err := client.Get(u)
			if err == nil && resp.StatusCode == http.StatusOK {
				_ = resp.Body.Close()
				root = fmt.Sprintf("http://127.0.0.1:%d", p)
				break
			}
		}
		if root == "" {
			time.Sleep(50 * time.Millisecond)
		}
	}
	if root == "" {
		t.Fatalf("child did not become ready: %s", childOut.String())
	}

	resp, err := http.Get(root + "/api/session")
	if err != nil {
		t.Fatal(err)
	}
	var sess map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&sess); err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	streamReq, _ := http.NewRequest(http.MethodGet, root+"/api/stream", nil)
	streamResp, err := http.DefaultClient.Do(streamReq)
	if err != nil {
		t.Fatal(err)
	}
	lineCh := make(chan string, 1)
	go func() {
		s := bufio.NewScanner(streamResp.Body)
		if s.Scan() {
			lineCh <- s.Text()
		}
	}()
	select {
	case line := <-lineCh:
		if !strings.Contains(line, "event:") {
			t.Fatalf("unexpected SSE first line %q", line)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("SSE stream did not emit initial event")
	}
	select {
	case <-worksConnected:
	case <-time.After(3 * time.Second):
		t.Fatal("WORKS SSE did not become active")
	}

	shutReq, _ := http.NewRequest(http.MethodPost, root+"/api/shutdown", nil)
	shutReq.Header.Set("X-WarRoom-Session", sess["session"])
	shutResp, err := http.DefaultClient.Do(shutReq)
	if err != nil {
		t.Fatal(err)
	}
	_ = shutResp.Body.Close()

	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	select {
	case err := <-exited:
		if err != nil {
			t.Fatalf("child exit: %v output=%s", err, childOut.String())
		}
	case <-time.After(7 * time.Second):
		t.Fatalf("child did not exit boundedly: %s", childOut.String())
	}
	_ = streamResp.Body.Close()

	unlock, err := acquireStateLock(base)
	if err != nil {
		t.Fatalf("state lock leaked after process exit: %v", err)
	}
	unlock()
}
