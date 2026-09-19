package main

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

func (a *App) answerAssistant(ctx context.Context, query string) AssistantResponse {
	gh := a.store.getGitHub()
	probes := a.store.getProbes()
	agents := a.agentSnapshot()
	cfg := a.store.getSettings()
	intel := a.intel.Evaluate(gh, probes, cfg)
	typeSafe := a.getTypeSafeDecision()
	t := strings.ToLower(strings.TrimSpace(query))
	latest := latestWorkflowRuns(gh.WorkflowRuns)
	fails := make([]WorkflowRun, 0)
	for _, w := range latest {
		if isWorkflowFailure(w.Conclusion) {
			fails = append(fails, w)
		}
	}
	addCoreSources := func(r *AssistantResponse) {
		r.Sources = []string{"GitHub system reality", "Agent Fabric", "Operational Intelligence", "TypeSafe/Jev decision fabric", "service probes"}
		r.Caveats = []string{"Assistant output is advisory. It cannot grant authority, execute work, or constitute verification evidence."}
	}

	if containsAny(t, "agent", "worker", "runner", "hermes", "vibe", "codex") {
		r := assistantResponse(fmt.Sprintf("Agent Fabric currently observes %d active session%s: %d running, %d waiting, %d blocked and %d stale. I only count sessions with an actual heartbeat or WORKS runner observation.", agents.Active, plural(agents.Active), agents.Running, agents.Waiting, agents.Blocked, agents.Stale))
		for i, x := range agents.Sessions {
			if i >= 6 {
				break
			}
			r.Objects = append(r.Objects, AssistantObject{Type: "agent", ID: x.ID, Title: x.Name, Subtitle: joinNonEmpty(x.Provider, x.Node, x.Repo), Status: x.State, URL: x.URL, Fields: map[string]string{"action": x.CurrentAction, "model": x.Model, "last heartbeat": humanAge(x.LastHeartbeat)}})
		}
		r.Actions = []AssistantAction{{Label: "Open Agents", Kind: "view", Target: "agents"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "attention", "needs you", "block", "problem", "fail", "incident") {
		needs := len(fails)
		for _, p := range probes {
			if p.Status == "down" || p.Status == "degraded" {
				needs++
			}
		}
		needs += agents.Blocked
		r := assistantResponse(fmt.Sprintf("I can currently ground %d attention item%s: %d failing latest workflow%s, %d blocked agent%s, plus any degraded service probes shown in Services.", needs, plural(needs), len(fails), plural(len(fails)), agents.Blocked, plural(agents.Blocked)))
		for i, w := range fails {
			if i >= 5 {
				break
			}
			r.Objects = append(r.Objects, AssistantObject{Type: "workflow", ID: w.Repo + "/" + w.Name, Title: w.Repo + " · " + w.Name, Subtitle: w.Branch, Status: w.Conclusion, URL: w.URL, Fields: map[string]string{"sha": w.SHA, "observed": humanAge(w.CreatedAt)}})
		}
		for _, x := range agents.Sessions {
			if x.State == "blocked" {
				r.Objects = append(r.Objects, AssistantObject{Type: "agent", ID: x.ID, Title: x.Name, Subtitle: x.CurrentAction, Status: "blocked", URL: x.URL})
			}
		}
		r.Actions = []AssistantAction{{Label: "Open Activity", Kind: "view", Target: "activity"}, {Label: "Open Agents", Kind: "view", Target: "agents"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "github", "changed", "today", "recent", "activity", "commit", "pull request", "pr") {
		cut := a.nowUTC().Add(-24 * time.Hour)
		recent := make([]ActivityItem, 0)
		for _, x := range gh.Activities {
			if x.Timestamp.After(cut) {
				recent = append(recent, x)
			}
		}
		r := assistantResponse(fmt.Sprintf("The current GitHub observation contains %d activity event%s in the last 24 hours, including %d commits. Reconciliation runs every %d seconds; this is near-live REST observation, not a GitHub push stream.", len(recent), plural(len(recent)), gh.Commits24h, coalesceInt(gh.ReconcileSeconds, cfg.RefreshSeconds)))
		for i, x := range recent {
			if i >= 6 {
				break
			}
			r.Objects = append(r.Objects, AssistantObject{Type: x.Type, ID: x.SHA, Title: x.Repo + " · " + x.Title, Subtitle: x.Actor, Status: x.State, URL: x.URL, Fields: map[string]string{"observed": humanAge(x.Timestamp)}})
		}
		r.Actions = []AssistantAction{{Label: "Open Activity", Kind: "view", Target: "activity"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "ci", "workflow", "actions") {
		r := assistantResponse(fmt.Sprintf("Of %d latest observed workflows, %d are failing. Workflow evidence is fetched from GitHub Actions for up to %d repositories per reconciliation.", len(latest), len(fails), cfg.WorkflowRepoCap))
		for i, x := range latest {
			if i >= 6 {
				break
			}
			r.Objects = append(r.Objects, AssistantObject{Type: "workflow", ID: x.Repo + "/" + x.Name, Title: x.Repo + " · " + x.Name, Subtitle: x.Event, Status: coalesce(x.Conclusion, x.Status), URL: x.URL, Fields: map[string]string{"sha": x.SHA, "branch": x.Branch}})
		}
		r.Actions = []AssistantAction{{Label: "Open Activity", Kind: "view", Target: "activity"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "jev", "typesafe", "decision", "confidence", "severity") {
		r := assistantResponse("TypeSafe/Jev is configured as a typed decision primitive, not as an authority source.")
		if typeSafe.Configured && !typeSafe.EvaluatedAt.IsZero() {
			r.Answer = fmt.Sprintf("The latest Jev decision routes attention to %q with %.0f%% route confidence. P(human review) is %.0f%%, evidence sufficiency %.0f%%, and severity is %.2f. This can rank or route review, but it cannot execute or verify work.", typeSafe.Route, typeSafe.RouteConfidence*100, typeSafe.HumanNeeded*100, typeSafe.EvidenceSufficient*100, typeSafe.SeverityScore)
			r.Objects = []AssistantObject{{Type: "typesafe-decision", ID: typeSafe.Fingerprint, Title: "Jev · " + typeSafe.Route, Subtitle: typeSafe.DominantSignal, Status: typeSafe.Mode, Fields: map[string]string{"route confidence": fmt.Sprintf("%.0f%%", typeSafe.RouteConfidence*100), "human review": fmt.Sprintf("%.0f%%", typeSafe.HumanNeeded*100), "evidence sufficient": fmt.Sprintf("%.0f%%", typeSafe.EvidenceSufficient*100), "latency": fmt.Sprintf("%d ms", typeSafe.LatencyMs)}}}
		}
		r.Actions = []AssistantAction{{Label: "Open Intelligence", Kind: "view", Target: "intelligence"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "next", "risk", "priorit", "recommend", "what should", "do next") {
		r := assistantResponse("Operational Intelligence currently has no source-backed candidate above its display threshold.")
		if intel.Top != nil {
			c := intel.Top
			r.Answer = fmt.Sprintf("The highest-ranked next move is: %s. Priority %.0f/100, risk %.0f%%, confidence %.0f%%. Recommended action: %s", c.Title, c.PriorityScore, c.RiskScore*100, c.Confidence*100, c.RecommendedAction)
			r.Objects = []AssistantObject{{Type: "intelligence-candidate", ID: c.ID, Title: c.Title, Subtitle: c.Domain, Status: c.Kind, URL: c.URL, Fields: map[string]string{"priority": fmt.Sprintf("%.0f/100", c.PriorityScore), "risk": fmt.Sprintf("%.0f%%", c.RiskScore*100), "confidence": fmt.Sprintf("%.0f%%", c.Confidence*100)}}}
		}
		r.Actions = []AssistantAction{{Label: "Open Intelligence", Kind: "view", Target: "intelligence"}}
		addCoreSources(&r)
		return r
	}
	if containsAny(t, "topology", "graph", "digital twin", "dependency", "blast radius") {
		r := assistantResponse(fmt.Sprintf("The digital twin currently projects %d repositories across %d operational domains, plus %d observed agent/worker sessions. GitHub relationships are organizational/domain projections; agent edges are only shown when a heartbeat or WORKS event supplies them.", len(gh.Repos), len(buildDomains(gh)), len(agents.Sessions)))
		r.Actions = []AssistantAction{{Label: "Open Topology", Kind: "view", Target: "topology"}}
		addCoreSources(&r)
		return r
	}
	for _, repo := range gh.Repos {
		if strings.Contains(t, strings.ToLower(repo.Name)) {
			r := assistantResponse(fmt.Sprintf("%s is classified under %s. Visibility is %s; last push is %s; current repository provenance is %s.", repo.Name, repo.Domain, coalesce(repo.Visibility, "unknown"), humanAge(repo.PushedAt), repo.Source))
			r.Objects = []AssistantObject{{Type: "repository", ID: repo.Name, Title: repo.Name, Subtitle: repo.Domain, Status: repo.Visibility, URL: repo.HTMLURL, Fields: map[string]string{"last push": humanAge(repo.PushedAt), "source": repo.Source}}}
			r.Actions = []AssistantAction{{Label: "Focus in Twin", Kind: "focus", Target: "repo:" + repo.Name}, {Label: "Open repository", Kind: "url", Target: repo.HTMLURL}}
			addCoreSources(&r)
			return r
		}
	}

	if containsAny(t, "repo", "repository") {
		repos := append([]Repo(nil), gh.Repos...)
		sort.Slice(repos, func(i, j int) bool { return repos[i].PushedAt.After(repos[j].PushedAt) })
		r := assistantResponse(fmt.Sprintf("War Room currently knows %d Aftergraph repositories. The most recently pushed observed repositories are shown below.", len(repos)))
		for i, x := range repos {
			if i >= 6 {
				break
			}
			r.Objects = append(r.Objects, AssistantObject{Type: "repository", ID: x.Name, Title: x.Name, Subtitle: x.Domain, Status: x.Visibility, URL: x.HTMLURL, Fields: map[string]string{"last push": humanAge(x.PushedAt), "source": x.Source}})
		}
		r.Actions = []AssistantAction{{Label: "Open Repositories", Kind: "view", Target: "repositories"}}
		addCoreSources(&r)
		return r
	}

	if st := a.assistantStatus(); st.LocalModelAvailable {
		if enriched, err := a.answerWithOllama(ctx, query, st); err == nil && strings.TrimSpace(enriched) != "" {
			r := assistantResponse(enriched)
			r.Mode = "grounded-local-model"
			r.Confidence = 0.7
			r.Sources = []string{"bounded War Room context", "local Ollama model: " + st.LocalModel}
			r.Caveats = []string{"Local-model prose is not verification evidence. Consequential claims must be checked against the structured objects and source views."}
			return r
		}
	}

	r := assistantResponse("I can inspect live GitHub activity, CI, repositories, the digital twin, connected agents/workers, service probes, Operational Intelligence and TypeSafe/Jev. Ask a concrete system question and I will stay inside those observed sources.")
	addCoreSources(&r)
	return r
}

func containsAny(s string, xs ...string) bool {
	for _, x := range xs {
		if strings.Contains(s, x) {
			return true
		}
	}
	return false
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func joinNonEmpty(xs ...string) string {
	out := make([]string, 0, len(xs))
	for _, x := range xs {
		if strings.TrimSpace(x) != "" {
			out = append(out, strings.TrimSpace(x))
		}
	}
	return strings.Join(out, " · ")
}

func coalesceInt(v, fallback int) int {
	if v > 0 {
		return v
	}
	return fallback
}

func coalesce(xs ...string) string {
	for _, x := range xs {
		if strings.TrimSpace(x) != "" {
			return strings.TrimSpace(x)
		}
	}
	return "—"
}

func humanAge(t time.Time) string {
	if t.IsZero() {
		return "unobserved"
	}
	d := time.Since(t)
	if d < 0 {
		return "future timestamp"
	}
	if d < time.Minute {
		return "just now"
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	}
	return fmt.Sprintf("%dd ago", int(d.Hours()/24))
}
