package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"
)

func (a *App) getTypeSafeDecision() TypeSafeDecision {
	a.typeSafeMu.RLock()
	defer a.typeSafeMu.RUnlock()
	d := a.typeSafe
	d.Configured = a.typeSafeConfigured()
	return d
}

func typeSafeStateFingerprint(state any) string {
	b, _ := json.Marshal(state)
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])[:20]
}

func (a *App) maybeTypeSafeEvaluate(parent context.Context, force bool, reason string) TypeSafeDecision {
	key := a.typeSafeKey()
	if key == "" {
		a.setConnectorState("typesafe", "disconnected", "")
		return a.getTypeSafeDecision()
	}
	cfg := a.store.getSettings()
	if !force && !cfg.TypeSafeAuto {
		return a.getTypeSafeDecision()
	}
	state := a.typeSafeState()
	fingerprint := typeSafeStateFingerprint(state)
	now := a.nowUTC()
	day := now.Format("2006-01-02")
	a.typeSafeMu.Lock()
	if a.typeSafeDay != day {
		a.typeSafeDay = day
		a.typeSafeCalls = 0
	}
	if a.typeSafeRunning {
		d := a.typeSafe
		a.typeSafeMu.Unlock()
		return d
	}
	minInterval := time.Duration(cfg.TypeSafeMinIntervalSec) * time.Second
	if minInterval < time.Minute {
		minInterval = time.Minute
	}
	if !force && a.typeSafeLastHash == fingerprint && !a.typeSafe.EvaluatedAt.IsZero() && now.Sub(a.typeSafe.EvaluatedAt) < minInterval {
		d := a.typeSafe
		d.Configured = true
		a.typeSafeMu.Unlock()
		return d
	}
	if cfg.TypeSafeDailyBudget > 0 && a.typeSafeCalls >= cfg.TypeSafeDailyBudget && !force {
		d := a.typeSafe
		d.Configured = true
		d.Mode = "budget-paused"
		d.Reason = "daily-budget"
		d.CallsToday = a.typeSafeCalls
		d.DailyBudget = cfg.TypeSafeDailyBudget
		d.BudgetRemaining = 0
		a.typeSafe = d
		a.typeSafeMu.Unlock()
		return d
	}
	a.typeSafeRunning = true
	a.typeSafeMu.Unlock()
	a.setConnectorState("typesafe", "connecting", "")

	ctx, cancel := context.WithTimeout(parent, 20*time.Second)
	defer cancel()
	started := time.Now()
	decision, err := newTypeSafeClient(key).evaluate(ctx, state)
	decision.Configured = true
	decision.EvaluatedAt = a.nowUTC()
	decision.Fingerprint = fingerprint
	decision.LatencyMs = time.Since(started).Milliseconds()
	decision.Mode = map[bool]string{true: "operator", false: "native-auto"}[force]
	decision.Reason = reason
	if err != nil {
		a.setConnectorState("typesafe", "degraded", classifyProviderError(err))
		decision.Source = "TypeSafe AI / Jev"
		decision.Error = err.Error()
		decision.ProviderErrorClass = classifyProviderError(err)
	}
	a.typeSafeMu.Lock()
	a.typeSafeRunning = false
	a.typeSafeCalls++
	a.typeSafeLastHash = fingerprint
	decision.CallsToday = a.typeSafeCalls
	decision.DailyBudget = cfg.TypeSafeDailyBudget
	decision.BudgetRemaining = cfg.TypeSafeDailyBudget - a.typeSafeCalls
	if decision.BudgetRemaining < 0 {
		decision.BudgetRemaining = 0
	}
	a.typeSafe = decision
	a.typeSafeMu.Unlock()
	if err == nil {
		a.setConnectorState("typesafe", "live", "")
	}
	a.broadcast("typesafe")
	return decision
}

func (a *App) typeSafeState() map[string]any {
	gh := a.store.getGitHub()
	probes := a.store.getProbes()
	intel := a.intel.Evaluate(gh, probes, a.store.getSettings())
	latest := latestWorkflowRuns(gh.WorkflowRuns)
	failing := make([]map[string]any, 0)
	needs := 0
	for _, x := range latest {
		if isWorkflowFailure(x.Conclusion) {
			needs++
			created := ""
			if !x.CreatedAt.IsZero() {
				created = x.CreatedAt.UTC().Format(time.RFC3339)
			}
			failing = append(failing, map[string]any{"repo": x.Repo, "workflow": x.Name, "conclusion": x.Conclusion, "created_at": created, "sha": x.SHA})
		}
	}
	sort.Slice(failing, func(i, j int) bool { return fmt.Sprint(failing[i]["repo"]) < fmt.Sprint(failing[j]["repo"]) })
	if len(failing) > 8 {
		failing = failing[:8]
	}
	degraded := make([]map[string]any, 0)
	for _, p := range probes {
		if p.Status == "down" || p.Status == "degraded" {
			needs++
			degraded = append(degraded, map[string]any{"name": p.Name, "status": p.Status, "http_status": p.HTTPStatus, "latency_ms": p.LatencyMs})
		}
	}
	top := map[string]any{}
	if intel.Top != nil {
		top = map[string]any{"scope": intel.Top.Scope, "kind": intel.Top.Kind, "priority": intel.Top.PriorityScore, "risk": intel.Top.RiskScore, "confidence": intel.Top.Confidence, "title": intel.Top.Title}
	}
	return map[string]any{
		"contract":                     "aftergraph.war-room.system-state/0.1",
		"github_source":                gh.Source,
		"github_authenticated":         gh.Authenticated,
		"github_observed_at":           gh.ObservedAt.Format(time.RFC3339),
		"repository_count":             len(gh.Repos),
		"open_prs":                     gh.OpenPRs,
		"open_issues":                  gh.OpenIssues,
		"commits_24h":                  gh.Commits24h,
		"needs_you":                    needs,
		"failing_latest_workflows":     failing,
		"degraded_service_probes":      degraded,
		"operational_intelligence_top": top,
		"policy_note":                  "Observation-only triage. TypeSafe output may rank or route review, but cannot grant authority, execute work, or constitute verification evidence.",
	}
}

func classifyProviderError(err error) string {
	if err == nil {
		return ""
	}
	msg := strings.ToLower(err.Error())
	switch {
	case errors.Is(err, context.DeadlineExceeded), strings.Contains(msg, "timeout"):
		return "timeout"
	case strings.Contains(msg, "401"), strings.Contains(msg, "403"):
		return "auth"
	case strings.Contains(msg, "429"):
		return "rate-limit"
	case strings.Contains(msg, " 5"), strings.Contains(msg, "returned 5"):
		return "server"
	case strings.Contains(msg, "decode"):
		return "protocol"
	default:
		return "network-or-provider"
	}
}
