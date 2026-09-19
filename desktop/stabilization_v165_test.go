package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestGitHubRetryUsesInjectedSleeperAndClock(t *testing.T) {
	calls := 0
	waits := 0
	g := newGitHubClientWithDoer("tok", roundTripFunc(func(_ *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testResponse(503, "down"), nil
		}
		return testResponse(200, `{"login":"ok"}`), nil
	}))
	fixed := time.Date(2026, 9, 19, 1, 2, 3, 0, time.UTC)
	g.now = func() time.Time { return fixed }
	g.wait = func(ctx context.Context, d time.Duration) error {
		waits++
		if d <= 0 {
			t.Fatal("non-positive wait")
		}
		return nil
	}
	login, err := g.validate(context.Background())
	if err != nil || login != "ok" {
		t.Fatalf("login=%q err=%v", login, err)
	}
	if waits != 1 || calls != 2 {
		t.Fatalf("waits=%d calls=%d", waits, calls)
	}
}

func TestConnectorLifecycleStateMachine(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 19, 1, 0, 0, 0, time.UTC)
	a.now = func() time.Time { return now }
	a.setConnectorState("github", "connecting", "")
	first := a.connectorSnapshot()["github"]
	now = now.Add(time.Minute)
	a.setConnectorState("github", "live", "")
	second := a.connectorSnapshot()["github"]
	if first.State != "connecting" || second.State != "live" || !second.Since.Equal(now) || !second.LastObservedAt.Equal(now) {
		t.Fatalf("states=%#v %#v", first, second)
	}
	now = now.Add(time.Minute)
	a.setConnectorState("github", "live", "")
	third := a.connectorSnapshot()["github"]
	if !third.Since.Equal(second.Since) || !third.LastObservedAt.Equal(now) {
		t.Fatalf("live refresh=%#v", third)
	}
}

func TestStoreSurfacesCorruptStateLoadIssueAndLegacyMigration(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), []byte(`{"githubOrg":"Aftergraph"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "metrics.json"), []byte(`{broken`), 0600); err != nil {
		t.Fatal(err)
	}
	s, err := newStore(dir, GitHubSnapshot{})
	if err != nil {
		t.Fatal(err)
	}
	issues, migrations := s.stateLoadDiagnostics()
	if len(issues) != 1 || issues[0].File != "metrics.json" {
		t.Fatalf("issues=%#v", issues)
	}
	found := false
	for _, m := range migrations {
		if m.File == "settings.json" && m.From == "legacy-raw-json" {
			found = true
		}
	}
	if !found {
		t.Fatalf("migrations=%#v", migrations)
	}
}

func TestRotatingLoggerRedactsAndRotates(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "war-room.log")
	w := newRotatingLogWriter(path, 90, 2)
	secret := "api" + "key_abcdefghijklmnopqrstuvwxyz_1234567890"
	if _, err := w.Write([]byte("Authorization: Bearer super-secret-token-123456789\n")); err != nil {
		t.Fatal(err)
	}
	if _, err := w.Write([]byte("key=" + secret + " some payload that forces rotation because this line is intentionally long\n")); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{path, path + ".1", path + ".2"} {
		if b, err := os.ReadFile(p); err == nil {
			s := string(b)
			if strings.Contains(s, secret) || strings.Contains(s, "super-secret-token") {
				t.Fatalf("secret leaked in %s: %s", p, s)
			}
		}
	}
	if _, err := os.Stat(path + ".1"); err != nil {
		t.Fatalf("rotation missing: %v", err)
	}
}

func TestJournalCrashHelper(t *testing.T) {
	if os.Getenv("WARROOM_CRASH_HELPER") != "1" {
		return
	}
	dir := os.Getenv("WARROOM_CRASH_DIR")
	phase := os.Getenv("WARROOM_CRASH_PHASE")
	s := &Store{baseDir: dir, now: time.Now}
	s.fault = func(file, at string) error {
		if at == phase {
			os.Exit(88)
		}
		return nil
	}
	_ = s.writeJSON("state.json", map[string]string{"value": "new"})
	os.Exit(0)
}

func TestProcessLevelCrashRecovery(t *testing.T) {
	phases := []string{"journal-prepared", "primary-backed-up-before-journal", "primary-replaced", "journal-committed"}
	for _, phase := range phases {
		t.Run(phase, func(t *testing.T) {
			dir := t.TempDir()
			s := &Store{baseDir: dir, now: time.Now}
			if err := s.writeJSON("state.json", map[string]string{"value": "old"}); err != nil {
				t.Fatal(err)
			}
			cmd := exec.Command(os.Args[0], "-test.run=^TestJournalCrashHelper$")
			cmd.Env = append(os.Environ(), "WARROOM_CRASH_HELPER=1", "WARROOM_CRASH_DIR="+dir, "WARROOM_CRASH_PHASE="+phase)
			err := cmd.Run()
			var ee *exec.ExitError
			if !errors.As(err, &ee) || ee.ExitCode() != 88 {
				t.Fatalf("helper err=%v", err)
			}
			recovered := &Store{baseDir: dir, now: time.Now}
			if err := recovered.recoverPersistenceJournal(); err != nil {
				t.Fatal(err)
			}
			var got map[string]string
			if err := recovered.readJSON("state.json", &got); err != nil {
				t.Fatal(err)
			}
			if got["value"] != "old" && got["value"] != "new" {
				t.Fatalf("generation=%v", got)
			}
		})
	}
}

func TestGitHubReconcileFullEmptyProtocol(t *testing.T) {
	fixed := time.Date(2026, 9, 19, 1, 0, 0, 0, time.UTC)
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		p := r.URL.Path
		switch {
		case p == "/orgs/Aftergraph/repos":
			return testResponse(200, `[{"name":"runtime","full_name":"Aftergraph/runtime","private":false,"archived":false,"default_branch":"main","html_url":"https://github.com/Aftergraph/runtime","updated_at":"2026-09-19T00:00:00Z","pushed_at":"2026-09-19T00:00:00Z","open_issues_count":1,"stargazers_count":0,"visibility":"public","owner":{"login":"Aftergraph"}}]`), nil
		case p == "/search/issues":
			return testResponse(200, `{"total_count":0,"items":[]}`), nil
		case p == "/search/commits":
			return testResponse(200, `{"total_count":0,"items":[]}`), nil
		case strings.Contains(p, "/actions/runs"):
			return testResponse(200, `{"workflow_runs":[]}`), nil
		default:
			return testResponse(404, `{"message":"not found"}`), nil
		}
	})
	g := newGitHubClientWithDoer("", doer)
	g.now = func() time.Time { return fixed }
	g.wait = func(context.Context, time.Duration) error { return nil }
	cfg := defaultSettings()
	cfg.WorkflowRepoCap = 5
	snap := g.sync(context.Background(), "Aftergraph", cfg)
	if len(snap.Repos) != 1 || snap.Repos[0].Name != "runtime" {
		t.Fatalf("repos=%#v", snap.Repos)
	}
	if !snap.ObservedAt.Equal(fixed) || snap.ObservationMode != "public-rate-limited-rest" {
		t.Fatalf("snapshot=%#v", snap)
	}
}

func TestCoreHandlersMethodAndMutationContracts(t *testing.T) {
	a := testApp(t)
	type tc struct {
		method, path, body string
		auth               bool
		want               int
	}
	cases := []tc{
		{http.MethodGet, "/api/assistant/status", "", false, 200},
		{http.MethodPost, "/api/assistant/status", "", false, 405},
		{http.MethodGet, "/api/agents/bridge", "", false, 200},
		{http.MethodPost, "/api/agents/bridge", `{}`, false, 403},
		{http.MethodPost, "/api/agents/bridge", `{}`, true, 200},
		{http.MethodGet, "/api/works/connection", "", false, 200},
		{http.MethodDelete, "/api/works/connection", "", false, 403},
		{http.MethodDelete, "/api/works/connection", "", true, 200},
		{http.MethodPost, "/api/agents/event", `{"kind":"progress","title":"tick"}`, false, 403},
		{http.MethodPost, "/api/agents/event", `{"kind":"progress","title":"tick"}`, true, 201},
		{http.MethodPost, "/api/probes/run", `{}`, false, 403},
		{http.MethodPost, "/api/shutdown", `{}`, false, 403},
	}
	h := a.routes()
	for _, c := range cases {
		req := loopbackTestRequest(c.method, c.path, strings.NewReader(c.body))
		if c.auth {
			req.Header.Set("X-WarRoom-Session", a.session)
			req.Header.Set("Authorization", "Bearer "+a.ensureAgentBridgeToken())
		}
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != c.want {
			t.Fatalf("%s %s code=%d want=%d body=%s", c.method, c.path, rr.Code, c.want, rr.Body.String())
		}
	}
}

func TestSettingsMetricsAndDiagnosticsHandlers(t *testing.T) {
	a := testApp(t)
	h := a.routes()
	do := func(method, path, body string, auth bool) *httptest.ResponseRecorder {
		req := loopbackTestRequest(method, path, strings.NewReader(body))
		if auth {
			req.Header.Set("X-WarRoom-Session", a.session)
		}
		rr := httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		return rr
	}
	if rr := do(http.MethodGet, "/api/settings", "", false); rr.Code != 200 {
		t.Fatal(rr.Code)
	}
	cfg := defaultSettings()
	cfg.RefreshSeconds = 1
	b, _ := json.Marshal(cfg)
	if rr := do(http.MethodPut, "/api/settings", string(b), true); rr.Code != 200 || !strings.Contains(rr.Body.String(), `"refreshSeconds":60`) {
		t.Fatalf("settings=%d %s", rr.Code, rr.Body.String())
	}
	if rr := do(http.MethodPost, "/api/metrics", `{"name":"latency","value":12,"source":"test"}`, true); rr.Code != 201 {
		t.Fatalf("metric=%d %s", rr.Code, rr.Body.String())
	}
	if rr := do(http.MethodGet, "/api/metrics", "", false); rr.Code != 200 || !strings.Contains(rr.Body.String(), "latency") {
		t.Fatalf("metrics=%d %s", rr.Code, rr.Body.String())
	}
	if rr := do(http.MethodGet, "/api/diagnostics", "", false); rr.Code != 200 || !strings.Contains(rr.Body.String(), "connectorStates") {
		t.Fatalf("diag=%d %s", rr.Code, rr.Body.String())
	}
}

func TestTypeSafeConnectionReadAndDelete(t *testing.T) {
	a := testApp(t)
	h := a.routes()
	req := loopbackTestRequest(http.MethodGet, "/api/typesafe/connection", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatal(rr.Code)
	}
	req = loopbackTestRequest(http.MethodDelete, "/api/typesafe/connection", nil)
	req.Header.Set("X-WarRoom-Session", a.session)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != 200 {
		t.Fatalf("delete=%d %s", rr.Code, rr.Body.String())
	}
}

func TestSSEStreamReadyUpdateAndCancel(t *testing.T) {
	a := testApp(t)
	ctx, cancel := context.WithCancel(context.Background())
	req := loopbackTestRequest(http.MethodGet, "/api/stream", nil).WithContext(ctx)
	rr := httptest.NewRecorder()
	done := make(chan struct{})
	go func() { a.streamHandler(rr, req); close(done) }()
	deadline := time.Now().Add(time.Second)
	for {
		a.sseMu.Lock()
		n := len(a.sse)
		a.sseMu.Unlock()
		if n > 0 {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("stream did not register")
		}
		time.Sleep(time.Millisecond)
	}
	a.broadcast("test-event")
	time.Sleep(5 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("stream did not stop")
	}
	body := rr.Body.String()
	if !strings.Contains(body, "event: ready") || !strings.Contains(body, "test-event") {
		t.Fatalf("stream=%q", body)
	}
}
