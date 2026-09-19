package main

import "testing"

func TestBootstrapInventoryCoversCurrentAftergraphOrg(t *testing.T) {
	s := bootstrapSnapshot()
	if len(s.Repos) != 33 {
		t.Fatalf("got %d repos, want 33", len(s.Repos))
	}
	seen := map[string]bool{}
	for _, r := range s.Repos {
		if seen[r.FullName] {
			t.Fatalf("duplicate repository %s", r.FullName)
		}
		seen[r.FullName] = true
		if r.Domain == "" {
			t.Fatalf("repository %s has no domain", r.FullName)
		}
	}
	for _, required := range []string{"Aftergraph/war-room", "Aftergraph/runtime", "Aftergraph/brand", "Aftergraph/works-execution", "Aftergraph/fihim"} {
		if !seen[required] {
			t.Fatalf("missing required repository %s", required)
		}
	}
}
