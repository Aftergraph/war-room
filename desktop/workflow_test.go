package main

import (
	"testing"
	"time"
)

func TestLatestWorkflowRunsKeepsNewestPerRepoWorkflow(t *testing.T) {
	base := time.Date(2026, 9, 18, 20, 0, 0, 0, time.UTC)
	runs := []WorkflowRun{
		{Repo: "runtime", Name: "CI", Conclusion: "failure", CreatedAt: base.Add(-2 * time.Hour)},
		{Repo: "runtime", Name: "CI", Conclusion: "success", CreatedAt: base.Add(-time.Hour)},
		{Repo: "runtime", Name: "CodeQL", Conclusion: "failure", CreatedAt: base.Add(-30 * time.Minute)},
		{Repo: "studio", Name: "CI", Conclusion: "success", CreatedAt: base.Add(-15 * time.Minute)},
	}
	got := latestWorkflowRuns(runs)
	if len(got) != 3 {
		t.Fatalf("got %d runs, want 3", len(got))
	}
	for _, r := range got {
		if r.Repo == "runtime" && r.Name == "CI" && r.Conclusion != "success" {
			t.Fatalf("stale failure survived: %+v", r)
		}
	}
	if got[0].Repo != "studio" || got[0].Name != "CI" {
		t.Fatalf("runs not sorted newest first: %+v", got)
	}
}

func TestNeedsYouIgnoresSupersededWorkflowFailure(t *testing.T) {
	base := time.Now().UTC()
	runs := []WorkflowRun{
		{Repo: "runtime", Name: "CI", Conclusion: "failure", CreatedAt: base.Add(-time.Hour)},
		{Repo: "runtime", Name: "CI", Conclusion: "success", CreatedAt: base},
	}
	failures := 0
	for _, r := range latestWorkflowRuns(runs) {
		if isWorkflowFailure(r.Conclusion) {
			failures++
		}
	}
	if failures != 0 {
		t.Fatalf("got %d current failures, want 0", failures)
	}
}
