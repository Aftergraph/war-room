package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestStateDirectorySingleInstanceLock(t *testing.T) {
	dir := t.TempDir()
	unlock, err := acquireStateLock(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer unlock()
	if _, err := acquireStateLock(dir); err == nil {
		t.Fatal("expected second state lock acquisition to fail")
	}
}

func TestConnectorTracksFailuresAndRecovery(t *testing.T) {
	now := time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC)
	a := &App{now: func() time.Time { return now }, connectors: map[string]ConnectorState{}}
	a.setConnectorState("github", "degraded", "network")
	now = now.Add(time.Second)
	a.setConnectorState("github", "degraded", "server")
	got := a.connectorSnapshot()["github"]
	if got.ConsecutiveFailures != 2 {
		t.Fatalf("failures=%d", got.ConsecutiveFailures)
	}
	if got.LastFailureAt.IsZero() {
		t.Fatal("missing last failure")
	}
	now = now.Add(time.Second)
	a.setConnectorState("github", "live", "")
	got = a.connectorSnapshot()["github"]
	if got.ConsecutiveFailures != 0 {
		t.Fatalf("recovery did not reset failures: %d", got.ConsecutiveFailures)
	}
	if !got.LastSuccessAt.Equal(now) {
		t.Fatalf("last success=%s want %s", got.LastSuccessAt, now)
	}
}

func TestStateEnvelopePropertyRoundTrip(t *testing.T) {
	base := time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 500; i++ {
		in := Settings{GitHubOrg: "Aftergraph", RefreshSeconds: 60 + i%500, WorkflowRepoCap: 1 + i%60, RepoDomains: map[string]string{"repo": strings.Repeat("x", i%17)}}
		b, err := encodeStateFile(base.Add(time.Duration(i)*time.Second), in)
		if err != nil {
			t.Fatal(err)
		}
		var out Settings
		migrated, err := decodeStateFileForName("settings.json", b, &out)
		if err != nil {
			t.Fatal(err)
		}
		if migrated {
			t.Fatal("enveloped state incorrectly marked migrated")
		}
		if out.GitHubOrg != in.GitHubOrg || out.RefreshSeconds != in.RefreshSeconds || out.WorkflowRepoCap != in.WorkflowRepoCap || out.RepoDomains["repo"] != in.RepoDomains["repo"] {
			t.Fatalf("round trip mismatch at %d", i)
		}
	}
}

func TestGitHubRetryUsesInjectedClockAndWait(t *testing.T) {
	var calls atomic.Int32
	doer := roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		n := calls.Add(1)
		code := http.StatusServiceUnavailable
		body := `{"message":"retry"}`
		if n >= 2 {
			code = http.StatusOK
			body = `{}`
		}
		return &http.Response{StatusCode: code, Status: http.StatusText(code), Header: make(http.Header), Body: ioNopCloser{strings.NewReader(body)}}, nil
	})
	g := newGitHubClientWithDoer("", doer)
	fixed := time.Date(2026, 9, 19, 1, 2, 3, 0, time.UTC)
	g.now = func() time.Time { return fixed }
	var waits atomic.Int32
	g.wait = func(ctx context.Context, d time.Duration) error { waits.Add(1); return nil }
	var out map[string]any
	if err := g.req(context.Background(), "/x", &out); err != nil {
		t.Fatal(err)
	}
	if waits.Load() != 1 {
		t.Fatalf("waits=%d", waits.Load())
	}
}

func TestLifecycleCancellationClosesStream(t *testing.T) {
	dir := t.TempDir()
	a, err := newApp(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if a.stateUnlock != nil {
			a.stateUnlock()
			a.stateUnlock = nil
		}
	}()
	ctx, cancel := context.WithCancel(context.Background())
	a.lifecycleMu.Lock()
	a.lifecycleCtx = ctx
	a.lifecycleCancel = cancel
	a.lifecycleMu.Unlock()
	srv := httptest.NewServer(a.routes())
	defer srv.Close()
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/stream", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	cancel()
	done := make(chan struct{})
	go func() { defer close(done); _ = resp.Body.Close() }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not close after lifecycle cancellation")
	}
}

func FuzzDecodeStateEnvelope(f *testing.F) {
	f.Add([]byte(`{"schema":"aftergraph.war-room.state","version":1,"writtenAt":"2026-09-19T00:00:00Z","payload":{"githubOrg":"Aftergraph"}}`))
	f.Fuzz(func(t *testing.T, b []byte) {
		var out map[string]any
		_, _ = decodeStateFileForName("settings.json", b, &out)
	})
}

func TestDiagnosticsConnectorCountersAreSecretFree(t *testing.T) {
	dir := t.TempDir()
	a, err := newApp(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if a.stateUnlock != nil {
			a.stateUnlock()
			a.stateUnlock = nil
		}
	}()
	a.setConnectorState("github", "degraded", "network")
	b, _ := json.Marshal(a.diagnostics())
	s := string(b)
	if !strings.Contains(s, "consecutiveFailures") {
		t.Fatal("connector failure counter missing")
	}
	if strings.Contains(strings.ToLower(s), "apikey_") || strings.Contains(strings.ToLower(s), "ghp_") {
		t.Fatal("diagnostics contain secret-like material")
	}
}

// Minimal response body helpers avoid pulling in extra test dependencies.
type ioNopCloser struct{ *strings.Reader }

func (ioNopCloser) Close() error { return nil }

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f roundTripperFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

var _ = filepath.Separator
