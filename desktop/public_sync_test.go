package main

import "testing"

func TestMergePublicSnapshotRetainsPrivateTopology(t *testing.T) {
	previous := GitHubSnapshot{Repos: []Repo{
		{Name: "public-a", FullName: "Aftergraph/public-a", Private: false, Source: "bootstrap"},
		{Name: "private-a", FullName: "Aftergraph/private-a", Private: true, Source: "bootstrap snapshot"},
	}}
	live := GitHubSnapshot{Source: "GitHub REST API", Authenticated: false, Repos: []Repo{
		{Name: "public-a", FullName: "Aftergraph/public-a", Private: false, Source: "GitHub live"},
	}}
	got := mergePublicSnapshot(previous, live)
	if len(got.Repos) != 2 {
		t.Fatalf("got %d repos, want 2", len(got.Repos))
	}
	var retained *Repo
	for i := range got.Repos {
		if got.Repos[i].Name == "private-a" {
			retained = &got.Repos[i]
		}
	}
	if retained == nil || !retained.Private {
		t.Fatalf("private repository was not retained: %+v", got.Repos)
	}
	if len(got.Errors) == 0 {
		t.Fatal("expected explicit partial-observation warning")
	}
}

func TestPublicSyncConfigCapsWorkflowRequests(t *testing.T) {
	cfg := Settings{WorkflowRepoCap: 20}
	got := publicSyncConfig(cfg)
	if got.WorkflowRepoCap != 5 {
		t.Fatalf("got cap %d, want 5", got.WorkflowRepoCap)
	}
	if cfg.WorkflowRepoCap != 20 {
		t.Fatal("publicSyncConfig mutated input")
	}
}
