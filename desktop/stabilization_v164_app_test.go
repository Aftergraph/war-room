package main

import (
	"strings"
	"testing"
	"time"
)

func TestDeterministicClockControlsAgentStaleness(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	fixed := time.Date(2026, 9, 19, 10, 0, 0, 0, time.UTC)
	a.now = func() time.Time { return fixed }
	a.store.now = a.now
	if err := a.upsertAgent(AgentSession{ID: "worker-1", State: "running", LastHeartbeat: fixed.Add(-10 * time.Second)}); err != nil {
		t.Fatal(err)
	}
	if got := a.agentSnapshot().Sessions[0].State; got != "running" {
		t.Fatalf("state=%s", got)
	}
	a.now = func() time.Time { return fixed.Add(2 * time.Minute) }
	if got := a.agentSnapshot().Sessions[0].State; got != "stale" {
		t.Fatalf("state=%s", got)
	}
}

func TestGitHubConnectorPersistsProviderStateAndRotatesOnTokenChange(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	one := a.githubConnector("token-one")
	one.requestCount = 7
	if got := a.githubConnector("token-one"); got != one || got.requestCount != 7 {
		t.Fatal("connector state not preserved")
	}
	two := a.githubConnector("token-two")
	if two == one {
		t.Fatal("connector not rotated")
	}
	if two.requestCount != 0 {
		t.Fatalf("new connector inherited state: %d", two.requestCount)
	}
}

func TestDiagnosticsNeverSerializeVaultSecrets(t *testing.T) {
	a, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	secret := "super-secret-token-value"
	if err := a.vault.Set("github.token", secret); err != nil {
		t.Fatal(err)
	}
	if err := a.vault.Set("typesafe.api_key", secret+"-ts"); err != nil {
		t.Fatal(err)
	}
	out := string(a.diagnosticsJSON())
	if strings.Contains(out, secret) || strings.Contains(out, "api_key") || strings.Contains(out, "github.token") {
		t.Fatalf("secret leaked: %s", out)
	}
	if !strings.Contains(out, `"configured":true`) {
		t.Fatalf("missing bounded configured signal: %s", out)
	}
}
