package main

import (
	"math"
	"sort"
	"time"
)

func (e *IntelligenceEngine) Evaluate(gh GitHubSnapshot, probes []ProbeResult, settings Settings) IntelligenceSummary {
	e.mu.RLock()
	model := e.model
	state := e.learningStateLocked()
	e.mu.RUnlock()

	now := time.Now().UTC()
	wf := repoWorkflowMap(gh.WorkflowRuns)
	activities := map[string]int{}
	recentActivity := map[string]bool{}
	cut24 := now.Add(-24 * time.Hour)
	cut6 := now.Add(-6 * time.Hour)
	for _, a := range gh.Activities {
		if a.Timestamp.After(cut24) {
			activities[a.Repo]++
		}
		if a.Timestamp.After(cut6) {
			recentActivity[a.Repo] = true
		}
	}
	degradedDomains := map[string]bool{}
	for _, p := range probes {
		if p.Status == "down" || p.Status == "degraded" {
			degradedDomains[p.Domain] = true
		}
	}
	freshnessSeconds := now.Sub(gh.ObservedAt).Seconds()
	refresh := float64(settings.RefreshSeconds)
	if refresh < 60 {
		refresh = 300
	}
	globalFreshnessGap := clamp01((freshnessSeconds - refresh*2) / (refresh * 4))

	candidates := make([]IntelligenceCandidate, 0, len(gh.Repos))
	domainAgg := map[string][]IntelligenceCandidate{}

	for _, repo := range gh.Repos {
		runs := wf[repo.Name]
		latestBad := 0.0
		repeatFail := 0.0
		latestGoodRecent := false
		if len(runs) > 0 {
			if isWorkflowFailure(runs[0].Conclusion) {
				latestBad = 1
			}
			failCount := 0
			for _, w := range runs {
				if isWorkflowFailure(w.Conclusion) {
					failCount++
				}
				if w.Conclusion == "success" && w.CreatedAt.After(cut24) {
					latestGoodRecent = true
				}
			}
			repeatFail = clamp01(float64(failCount) / math.Min(3, float64(len(runs))))
		}
		issuePressure := clamp01(float64(repo.OpenIssues) / 20.0)
		activityVelocity := clamp01(float64(activities[repo.Name]) / 8.0)
		recentChange := 0.0
		if !repo.PushedAt.IsZero() {
			age := now.Sub(repo.PushedAt)
			if age <= 6*time.Hour {
				recentChange = 1
			} else if age <= 24*time.Hour {
				recentChange = .65
			} else if age <= 7*24*time.Hour {
				recentChange = .25
			}
		} else if recentActivity[repo.Name] {
			recentChange = .8
		}
		sourceGap := 0.0
		if repo.Private && !gh.Authenticated {
			sourceGap = 1
		}
		if repo.Source != "GitHub live" && repo.Source != "GitHub live public" {
			sourceGap = math.Max(sourceGap, .7)
		}
		serviceDegraded := 0.0
		if degradedDomains[repo.Domain] {
			serviceDegraded = 1
		}
		unverifiedChange := 0.0
		if recentChange >= .65 && !latestGoodRecent {
			unverifiedChange = 1
		}

		fv := map[string]float64{
			"ci_failure":        latestBad,
			"repeat_failure":    repeatFail,
			"service_degraded":  serviceDegraded,
			"unverified_change": unverifiedChange,
			"source_gap":        sourceGap,
			"freshness_gap":     globalFreshnessGap,
			"issue_pressure":    issuePressure,
			"activity_velocity": activityVelocity,
			"recent_change":     recentChange,
		}

		logit := model.Bias
		features := make([]IntelligenceFeature, 0, len(fv))
		for name, value := range fv {
			weight := model.Weights[name]
			contribution := weight * value
			logit += contribution
			features = append(features, IntelligenceFeature{Name: name, Value: value, Weight: weight, Contribution: contribution, Evidence: featureEvidence(name, value, repo, gh, runs, probes, activities[repo.Name])})
		}
		sort.Slice(features, func(i, j int) bool { return math.Abs(features[i].Contribution) > math.Abs(features[j].Contribution) })
		risk := sigmoid(logit)
		confidence := clamp01(1 - .42*sourceGap - .32*globalFreshnessGap)
		if len(runs) == 0 && activities[repo.Name] == 0 {
			confidence *= .8
		}
		urgency := 1 + .28*math.Max(latestBad, serviceDegraded) + .12*unverifiedChange
		priority := math.Min(100, 100*risk*(.72+.28*confidence)*urgency)

		kind, title, summary, action := "observe", repo.Name+" is quiet", "No strong risk signal is currently observed.", "Keep observing; do not infer health from silence."
		url := repo.HTMLURL
		switch {
		case latestBad > 0:
			kind = "ci_failure"
			title = repo.Name + " has failing CI"
			summary = "The latest observed workflow failed; this is the strongest deterministic operational signal in the current feature set."
			action = "Inspect the failing workflow at its exact SHA, identify the first failing step, then verify the fix before clearing attention."
			if len(runs) > 0 && runs[0].URL != "" {
				url = runs[0].URL
			}
		case serviceDegraded > 0:
			kind = "service_degraded"
			title = repo.Domain + " has a degraded surface"
			summary = "A direct service probe is degraded or down for this domain."
			action = "Check the surface from the service view, then correlate with the owning repository before taking action."
		case unverifiedChange > 0:
			kind = "unverified_change"
			title = repo.Name + " changed without recent success evidence"
			summary = "Recent code activity is observed, but War Room does not currently have a recent successful workflow observation for this repository."
			action = "Confirm whether the change has an authoritative verification receipt or successful workflow before treating it as shipped."
		case sourceGap > .5:
			kind = "coverage_gap"
			title = repo.Name + " has an observation gap"
			summary = "Current source coverage is incomplete, so silence cannot be treated as healthy state."
			action = "Restore authenticated observation or a governed bridge before making consequential decisions from this repository state."
		case issuePressure > .5 && activityVelocity > .25:
			kind = "pressure"
			title = repo.Name + " has elevated work pressure"
			summary = "Issue pressure and activity are simultaneously elevated."
			action = "Review active work for collisions, blocked pull requests, and duplicated effort before adding more parallel work."
		}

		// Only surface meaningful candidates. Coverage gaps are kept at a lower
		// threshold because unknown private state is itself operationally relevant.
		if priority >= 24 || kind == "coverage_gap" && priority >= 18 {
			evidence := []string{repo.Source}
			if len(runs) > 0 {
				evidence = append(evidence, "workflow:"+runs[0].Name+":"+runs[0].Conclusion)
			}
			if activities[repo.Name] > 0 {
				evidence = append(evidence, "activity24h:"+itoa(activities[repo.Name]))
			}
			c := IntelligenceCandidate{
				ID: candidateID(repo.Name, kind), Scope: repo.Name, Domain: repo.Domain, Kind: kind,
				Title: title, Summary: summary, RecommendedAction: action,
				RiskScore: risk, PriorityScore: priority, Confidence: confidence,
				LearningState: state, Features: features, Evidence: evidence, URL: url, GeneratedAt: now,
			}
			candidates = append(candidates, c)
			domainAgg[repo.Domain] = append(domainAgg[repo.Domain], c)
		}
	}

	sort.Slice(candidates, func(i, j int) bool {
		if candidates[i].PriorityScore == candidates[j].PriorityScore {
			return candidates[i].Scope < candidates[j].Scope
		}
		return candidates[i].PriorityScore > candidates[j].PriorityScore
	})
	if len(candidates) > 24 {
		candidates = candidates[:24]
	}

	domains := make([]DomainIntelligence, 0, len(domainAgg))
	for name, cs := range domainAgg {
		maxRisk, conf := 0.0, 0.0
		for _, c := range cs {
			if c.RiskScore > maxRisk {
				maxRisk = c.RiskScore
			}
			conf += c.Confidence
		}
		domains = append(domains, DomainIntelligence{Name: name, RiskScore: maxRisk, Confidence: conf / float64(len(cs)), Candidates: len(cs)})
	}
	sort.Slice(domains, func(i, j int) bool { return domains[i].RiskScore > domains[j].RiskScore })

	var top *IntelligenceCandidate
	if len(candidates) > 0 {
		x := candidates[0]
		top = &x
	}
	return IntelligenceSummary{
		Version: model.Version, GeneratedAt: now, Mode: "observe-rank-explain", LearningState: state,
		FeedbackCount: model.FeedbackCount, Top: top, Candidates: candidates, Domains: domains, Model: model,
		Guardrails: []string{
			"ranking-only: no execution authority",
			"unknown is not healthy",
			"model output is not verification evidence",
			"feedback may adapt ranking weights but not authority or policy",
		},
	}
}
