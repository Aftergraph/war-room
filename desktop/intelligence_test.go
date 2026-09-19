package main

import (
	"math"
	"testing"
	"time"
)

func testSettings() Settings {
	return Settings{GitHubOrg: "Aftergraph", RefreshSeconds: 300, WorkflowRepoCap: 20}
}

func TestIntelligenceRanksFailingCI(t *testing.T) {
	now := time.Now().UTC()
	gh := GitHubSnapshot{
		ObservedAt: now, Source: "GitHub REST API", Authenticated: true,
		Repos: []Repo{
			{Name: "runtime", FullName: "Aftergraph/runtime", Domain: "Execution / Runtime", Source: "GitHub live", PushedAt: now.Add(-20 * time.Minute)},
			{Name: "docs", FullName: "Aftergraph/docs", Domain: "Brand / Public Surface", Source: "GitHub live", PushedAt: now.Add(-20 * time.Minute)},
		},
		WorkflowRuns: []WorkflowRun{
			{Repo: "runtime", Name: "Verify", Conclusion: "failure", CreatedAt: now.Add(-10 * time.Minute), URL: "https://example.invalid/fail"},
			{Repo: "docs", Name: "Verify", Conclusion: "success", CreatedAt: now.Add(-10 * time.Minute)},
		},
		Activities: []ActivityItem{
			{Repo: "runtime", Type: "commit", Timestamp: now.Add(-15 * time.Minute)},
			{Repo: "docs", Type: "commit", Timestamp: now.Add(-15 * time.Minute)},
		},
	}
	e := newIntelligenceEngine(t.TempDir())
	got := e.Evaluate(gh, nil, testSettings())
	if got.Top == nil {
		t.Fatal("expected top candidate")
	}
	if got.Top.Scope != "runtime" {
		t.Fatalf("expected runtime on top, got %s", got.Top.Scope)
	}
	if got.Top.Kind != "ci_failure" {
		t.Fatalf("expected ci_failure, got %s", got.Top.Kind)
	}
	if got.Top.PriorityScore < 50 {
		t.Fatalf("expected material priority, got %.2f", got.Top.PriorityScore)
	}
}

func TestIntelligenceUnknownPrivateStateIsNotHealthy(t *testing.T) {
	now := time.Now().UTC()
	gh := GitHubSnapshot{
		ObservedAt: now.Add(-2 * time.Hour), Source: "GitHub REST API", Authenticated: false,
		Repos: []Repo{{Name: "private-core", FullName: "Aftergraph/private-core", Private: true, Visibility: "private", Domain: "Execution / Runtime", Source: "bootstrap snapshot"}},
	}
	e := newIntelligenceEngine(t.TempDir())
	got := e.Evaluate(gh, nil, testSettings())
	found := false
	for _, c := range got.Candidates {
		if c.Scope == "private-core" && c.Kind == "coverage_gap" {
			found = true
			if c.Confidence >= 0.7 {
				t.Fatalf("expected reduced confidence, got %.2f", c.Confidence)
			}
		}
	}
	if !found {
		t.Fatal("expected coverage-gap candidate for unobserved private repository")
	}
}

func TestIntelligenceFeedbackLearnsRankingWeights(t *testing.T) {
	e := newIntelligenceEngine(t.TempDir())
	before := e.model.Weights["ci_failure"]
	_, err := e.ApplyFeedback(IntelligenceFeedbackRequest{
		CandidateID:         "oi_test",
		ShouldHaveAttention: true,
		Features:            map[string]float64{"ci_failure": 1},
	})
	if err != nil {
		t.Fatal(err)
	}
	after := e.model.Weights["ci_failure"]
	if math.Abs(after-before) < 1e-9 {
		t.Fatalf("expected online learner to update weight: %.4f -> %.4f", before, after)
	}
	if e.model.FeedbackCount != 1 {
		t.Fatalf("expected feedback count 1, got %d", e.model.FeedbackCount)
	}
}

func TestIntelligenceGuardrailIsRankingOnly(t *testing.T) {
	e := newIntelligenceEngine(t.TempDir())
	got := e.Evaluate(GitHubSnapshot{ObservedAt: time.Now().UTC()}, nil, testSettings())
	want := "ranking-only: no execution authority"
	found := false
	for _, g := range got.Guardrails {
		if g == want {
			found = true
		}
	}
	if !found {
		t.Fatalf("missing guardrail %q", want)
	}
}
