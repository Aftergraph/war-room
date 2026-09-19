package main

import (
	"os"
	"strings"
	"testing"
)

func TestCompactNavigationHasExplicitAccessibleNames(t *testing.T) {
	html, err := os.ReadFile("web/index.html")
	if err != nil {
		t.Fatal(err)
	}
	src := string(html)
	required := []string{
		`data-view="overview" aria-label="Now"`,
		`data-view="activity" aria-label="Activity"`,
		`data-view="topology" aria-label="Topology"`,
		`data-view="agents" aria-label="Agents &amp; workers"`,
		`data-view="intelligence" aria-label="Intelligence"`,
		`data-view="domains" aria-label="Systems"`,
		`data-view="repositories" aria-label="Repositories"`,
		`data-view="verification" aria-label="Evidence"`,
		`data-view="services" aria-label="Services"`,
		`data-view="connections" aria-label="Connections"`,
		`id="commandBtn" class="command-trigger" aria-label="Search or ask War Room"`,
	}
	for _, needle := range required {
		if !strings.Contains(src, needle) {
			t.Fatalf("missing explicit accessible name contract %q", needle)
		}
	}
}

func TestDynamicDomainShortcutsHaveExplicitAccessibleNames(t *testing.T) {
	js, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	src := string(js)
	if !strings.Contains(src, `class="nav-item domain-shortcut ${esc(x.status)}" data-domain="${esc(x.name)}" aria-label="${esc(shortDomain(x.name))}"`) {
		t.Fatal("dynamic domain shortcuts must expose an explicit accessible name")
	}
}
