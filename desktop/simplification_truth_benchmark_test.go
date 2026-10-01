package main

import (
	"os"
	"strings"
	"testing"
)

func TestSimplificationTruthBenchmarkContracts(t *testing.T) {
	b, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)

	required := map[string]int{
		"function latestObservedWorkflows(d){return latestWorkflowRuns(d.github.workflowRuns||[])}":        1,
		"function isBadProbe(p){return p.status==='down'||p.status==='degraded'}":                          1,
		"function countBadWorkflows(runs=[]){return runs.filter(w=>isBadConclusion(w.conclusion)).length}": 1,
		"function isInactiveAgent(x){return['stale','offline'].includes(x.state)}":                         1,
		"function repoCount(d){return d.github.repos?.length||0}":                                          1,
		"function domainCount(d){return d.domains?.length||0}":                                             1,
		"function needsYouCount(d){return d.needsYou||0}":                                                  1,
	}
	for needle, want := range required {
		if got := strings.Count(src, needle); got != want {
			t.Fatalf("contract count for %q = %d, want %d", needle, got, want)
		}
	}

	for _, forbidden := range []string{
		"function latestObservedWorkflows(d){return latestObservedWorkflows(d)}",
		"function isBadProbe(p){return isBadProbe(p)}",
		"function countBadWorkflows(runs=[]){return countBadWorkflows(runs)}",
		"function isInactiveAgent(x){return isInactiveAgent(x)}",
		"function repoCount(d){return repoCount(d)}",
		"function domainCount(d){return domainCount(d)}",
		"function needsYouCount(d){return needsYouCount(d)}",
	} {
		if strings.Contains(src, forbidden) {
			t.Fatalf("recursive simplifier regression found: %q", forbidden)
		}
	}

	callCounts := map[string]int{
		"latestObservedWorkflows(d)": 7,
		"countBadWorkflows(":         4,
		"isInactiveAgent(":           3,
		"repoCount(":                 4,
		"domainCount(":               4,
		"needsYouCount(":             5,
		".filter(isBadProbe)":        2,
	}
	for needle, want := range callCounts {
		if got := strings.Count(src, needle); got != want {
			t.Fatalf("usage count for %q = %d, want %d", needle, got, want)
		}
	}
}
