package main

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"io/fs"
	"log"
	"net/http"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

//go:embed web/*
var webFS embed.FS

var version = "1.6.10"

type App struct {
	store                *Store
	vault                *Vault
	started              time.Time
	session              string
	server               *http.Server
	log                  *log.Logger
	syncMu               sync.Mutex
	hostMu               sync.RWMutex
	host                 HostTelemetry
	sseMu                sync.Mutex
	sse                  map[chan string]struct{}
	intel                *IntelligenceEngine
	typeSafeMu           sync.RWMutex
	typeSafe             TypeSafeDecision
	typeSafeRunning      bool
	typeSafeLastHash     string
	typeSafeDay          string
	typeSafeCalls        int
	assistantMu          sync.RWMutex
	assistantStatusCache AssistantStatus
	assistantHTTP        httpDoer
	worksHTTP            httpDoer
	lifecycleCtx         context.Context
	now                  func() time.Time
	githubMu             sync.Mutex
	githubClient         *GitHubClient
	githubTokenHash      string
	connectorMu          sync.RWMutex
	connectors           map[string]ConnectorState
	diagMu               sync.RWMutex
	diagEvents           []DiagnosticEvent
	wait                 func(context.Context, time.Duration) error
	lifecycleMu          sync.RWMutex
	lifecycleCancel      context.CancelFunc
	bgWG                 sync.WaitGroup
	stateUnlock          func()
	shutdownOnce         sync.Once
}

func newApp(baseDir string) (*App, error) {
	unlock, err := acquireStateLock(baseDir)
	if err != nil {
		return nil, err
	}
	st, err := newStore(baseDir, bootstrapSnapshot())
	if err != nil {
		unlock()
		return nil, err
	}
	v, err := newVault(baseDir)
	if err != nil {
		unlock()
		return nil, err
	}
	logWriter := newRotatingLogWriter(filepath.Join(baseDir, "war-room.log"), 2<<20, 3)
	a := &App{store: st, vault: v, started: time.Now(), session: randomToken(), log: log.New(logWriter, "", log.LstdFlags|log.LUTC), sse: map[chan string]struct{}{}, intel: newIntelligenceEngine(baseDir), now: time.Now, connectors: map[string]ConnectorState{}, wait: waitForRetry, stateUnlock: unlock}
	a.setConnectorState("github", "disconnected", "")
	a.setConnectorState("works", "disconnected", "")
	a.setConnectorState("typesafe", "disconnected", "")
	a.setConnectorState("assistant", "disconnected", "")
	return a, nil
}
func (a *App) nowUTC() time.Time {
	if a.now != nil {
		return a.now().UTC()
	}
	return time.Now().UTC()
}
func randomToken() string { b := make([]byte, 32); _, _ = rand.Read(b); return hex.EncodeToString(b) }
func (a *App) lifecycle() context.Context {
	a.lifecycleMu.RLock()
	ctx := a.lifecycleCtx
	a.lifecycleMu.RUnlock()
	if ctx != nil {
		return ctx
	}
	return context.Background()
}
func (a *App) spawn(fn func()) { a.bgWG.Add(1); go func() { defer a.bgWG.Done(); fn() }() }
func waitContext(ctx context.Context, d time.Duration) bool {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func (a *App) waitDuration(ctx context.Context, d time.Duration) bool {
	wait := a.wait
	if wait == nil {
		wait = waitForRetry
	}
	return wait(ctx, d) == nil
}
func (a *App) broadcast(event string) {
	a.sseMu.Lock()
	defer a.sseMu.Unlock()
	for ch := range a.sse {
		select {
		case ch <- event:
		default:
		}
	}
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/session", a.sessionHandler)
	mux.HandleFunc("/api/health", a.healthHandler)
	mux.HandleFunc("/api/diagnostics", a.diagnosticsHandler)
	mux.HandleFunc("/api/summary", a.summaryHandler)
	mux.HandleFunc("/api/github/sync", a.syncHandler)
	mux.HandleFunc("/api/github/connection", a.githubConnectionHandler)
	mux.HandleFunc("/api/settings", a.settingsHandler)
	mux.HandleFunc("/api/metrics", a.metricsHandler)
	mux.HandleFunc("/api/probes/run", a.probesHandler)
	mux.HandleFunc("/api/stream", a.streamHandler)
	mux.HandleFunc("/api/intelligence", a.intelligenceHandler)
	mux.HandleFunc("/api/intelligence/feedback", a.intelligenceFeedbackHandler)
	mux.HandleFunc("/api/typesafe/connection", a.typeSafeConnectionHandler)
	mux.HandleFunc("/api/typesafe/evaluate", a.typeSafeEvaluateHandler)
	mux.HandleFunc("/api/agents", a.agentsHandler)
	mux.HandleFunc("/api/agents/heartbeat", a.agentHeartbeatHandler)
	mux.HandleFunc("/api/agents/event", a.agentEventHandler)
	mux.HandleFunc("/api/agents/bridge", a.agentBridgeHandler)
	mux.HandleFunc("/api/works/connection", a.worksConnectionHandler)
	mux.HandleFunc("/api/assistant/status", a.assistantStatusHandler)
	mux.HandleFunc("/api/assistant/query", a.assistantHandler)
	mux.HandleFunc("/api/shutdown", a.shutdownHandler)
	webRoot, _ := fs.Sub(webFS, "web")
	fileServer := http.FileServer(http.FS(webRoot))
	mux.Handle("/", fileServer)
	return securityHeaders(mux)
}
func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
		next.ServeHTTP(w, r)
	})
}
func (a *App) buildSummary() Summary {
	gh := a.store.getGitHub()
	metrics := latestMetrics(a.store.getMetrics())
	probes := a.store.getProbes()
	a.hostMu.RLock()
	host := a.host
	a.hostMu.RUnlock()
	domains := buildDomains(gh)
	state := "offline snapshot"
	if gh.Source == "GitHub REST API" {
		if gh.Authenticated {
			state = "GitHub connected"
		} else {
			state = "GitHub public-only"
		}
	}
	needs := 0
	for _, w := range latestWorkflowRuns(gh.WorkflowRuns) {
		if isWorkflowFailure(w.Conclusion) {
			needs++
		}
	}
	for _, p := range probes {
		if p.Status == "down" || p.Status == "degraded" {
			needs++
		}
	}
	intel := a.intel.Evaluate(gh, probes, a.store.getSettings())
	agents := a.agentSnapshot()
	needs += agents.Blocked
	return Summary{Now: a.nowUTC(), StartedAt: a.started.UTC(), Version: version, GitHub: gh, Domains: domains, Metrics: metrics, Probes: probes, Host: host, NeedsYou: needs, ConnectionState: state, Intelligence: intel, TypeSafe: a.getTypeSafeDecision(), Agents: agents, Assistant: a.assistantStatus()}
}
func latestMetrics(all []MetricSample) []MetricSample {
	m := map[string]MetricSample{}
	for _, x := range all {
		key := x.Domain + "\x00" + x.Name
		if old, ok := m[key]; !ok || x.ObservedAt.After(old.ObservedAt) {
			m[key] = x
		}
	}
	out := make([]MetricSample, 0, len(m))
	for _, x := range m {
		out = append(out, x)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
func isWorkflowFailure(conclusion string) bool {
	switch conclusion {
	case "failure", "timed_out", "action_required", "startup_failure":
		return true
	default:
		return false
	}
}

func githubActivityKey(x ActivityItem) string {
	return strings.Join([]string{x.Type, x.Repo, x.URL, x.SHA, x.State, x.Timestamp.UTC().Format(time.RFC3339Nano)}, "\x00")
}

func workflowActivityKey(x WorkflowRun) string {
	return strings.Join([]string{x.Repo, x.Name, x.Status, x.Conclusion, x.SHA, x.UpdatedAt.UTC().Format(time.RFC3339Nano)}, "\x00")
}

func githubHasActivityDelta(previous, current GitHubSnapshot) bool {
	oldA := make(map[string]struct{}, len(previous.Activities))
	for _, x := range previous.Activities {
		oldA[githubActivityKey(x)] = struct{}{}
	}
	for _, x := range current.Activities {
		if _, ok := oldA[githubActivityKey(x)]; !ok {
			return true
		}
	}
	oldW := make(map[string]struct{}, len(previous.WorkflowRuns))
	for _, x := range previous.WorkflowRuns {
		oldW[workflowActivityKey(x)] = struct{}{}
	}
	for _, x := range current.WorkflowRuns {
		if _, ok := oldW[workflowActivityKey(x)]; !ok {
			return true
		}
	}
	return false
}

func latestWorkflowRuns(runs []WorkflowRun) []WorkflowRun {
	latest := map[string]WorkflowRun{}
	for _, w := range runs {
		key := w.Repo + "\x00" + w.Name
		old, ok := latest[key]
		if !ok || w.CreatedAt.After(old.CreatedAt) {
			latest[key] = w
		}
	}
	out := make([]WorkflowRun, 0, len(latest))
	for _, w := range latest {
		out = append(out, w)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	return out
}

func buildDomains(gh GitHubSnapshot) []DomainSummary {
	m := map[string]*DomainSummary{}
	for _, n := range canonicalDomains {
		m[n] = &DomainSummary{Name: n, Status: "unobserved"}
	}
	for _, r := range gh.Repos {
		d := r.Domain
		if m[d] == nil {
			m[d] = &DomainSummary{Name: d}
		}
		x := m[d]
		x.RepoCount++
		x.OpenIssues += r.OpenIssues
		if r.Private {
			x.PrivateRepos++
		} else {
			x.PublicRepos++
		}
	}
	cut := time.Now().Add(-24 * time.Hour)
	for _, a := range gh.Activities {
		for _, r := range gh.Repos {
			if r.Name == a.Repo && a.Timestamp.After(cut) {
				m[r.Domain].Activity24h++
				break
			}
		}
	}
	for _, w := range latestWorkflowRuns(gh.WorkflowRuns) {
		for _, r := range gh.Repos {
			if r.Name == w.Repo {
				if w.Conclusion == "success" {
					m[r.Domain].CIHealthy++
				} else if isWorkflowFailure(w.Conclusion) {
					m[r.Domain].CIFailing++
				}
				break
			}
		}
	}
	out := make([]DomainSummary, 0, len(m))
	for _, d := range m {
		if d.CIFailing > 0 {
			d.Status = "attention"
		} else if d.RepoCount > 0 {
			d.Status = "observed"
		}
		out = append(out, *d)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}
