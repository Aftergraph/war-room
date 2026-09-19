package main

import (
	"crypto/sha256"
	"encoding/hex"
)

func tokenFingerprint(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

// githubConnector owns long-lived provider state (rate limit, retry counters)
// across reconciliations. The raw token never participates in logs/diagnostics.
func (a *App) githubConnector(token string) *GitHubClient {
	fp := tokenFingerprint(token)
	a.githubMu.Lock()
	defer a.githubMu.Unlock()
	if a.githubClient == nil || a.githubTokenHash != fp {
		a.githubClient = newGitHubClient(token)
		a.githubClient.now = a.now
		if a.wait != nil {
			a.githubClient.wait = a.wait
		}
		a.githubTokenHash = fp
	}
	return a.githubClient
}

func (a *App) resetGitHubConnector() {
	a.githubMu.Lock()
	a.githubClient = nil
	a.githubTokenHash = ""
	a.githubMu.Unlock()
}
