package main

import (
	_ "embed"
	"encoding/json"
	"time"
)

//go:embed defaults/repo-inventory.json
var repoInventoryJSON []byte

type repositoryInventory struct {
	Organization string `json:"organization"`
	ObservedAt   string `json:"observedAt"`
	Source       string `json:"source"`
	Repositories []struct {
		Name       string `json:"name"`
		Visibility string `json:"visibility"`
	} `json:"repositories"`
}

func bootstrapSnapshot() GitHubSnapshot {
	var inv repositoryInventory
	if err := json.Unmarshal(repoInventoryJSON, &inv); err != nil {
		return GitHubSnapshot{ObservedAt: time.Now().UTC(), Source: "bootstrap inventory parse failure", Errors: []string{err.Error()}}
	}
	observedAt, err := time.Parse(time.RFC3339, inv.ObservedAt)
	if err != nil {
		observedAt = time.Now().UTC()
	}
	org := inv.Organization
	if org == "" {
		org = "Aftergraph"
	}
	repos := make([]Repo, 0, len(inv.Repositories))
	for _, n := range inv.Repositories {
		repos = append(repos, Repo{
			Name:          n.Name,
			FullName:      org + "/" + n.Name,
			Visibility:    n.Visibility,
			Private:       n.Visibility == "private",
			DefaultBranch: "main",
			HTMLURL:       "https://github.com/" + org + "/" + n.Name,
			Domain:        inferDomain(n.Name),
			Source:        "bootstrap snapshot",
		})
	}
	return GitHubSnapshot{ObservedAt: observedAt, Source: inv.Source, Repos: repos}
}
