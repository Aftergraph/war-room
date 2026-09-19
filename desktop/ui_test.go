package main

import (
	"strings"
	"testing"
)

func TestDesktopShellContainsProgressiveDisclosureSurfaces(t *testing.T) {
	html, err := webFS.ReadFile("web/index.html")
	if err != nil {
		t.Fatal(err)
	}
	body := string(html)
	for _, want := range []string{"Observed activity", "Needs You", "Search or ask War Room", "System context", "Metric ledger", "Repositories", "Operational intelligence", "What deserves attention next"} {
		if !strings.Contains(body, want) {
			t.Fatalf("shell missing %q", want)
		}
	}
}

func TestDesktopShellUsesCalmBrandTokens(t *testing.T) {
	css, err := webFS.ReadFile("web/styles.css")
	if err != nil {
		t.Fatal(err)
	}
	body := string(css)
	for _, want := range []string{"--bg:#080C14", "--cyan:#42C7E8", "--teal:#24C4AD", "prefers-reduced-motion"} {
		if !strings.Contains(body, want) {
			t.Fatalf("styles missing %q", want)
		}
	}
}

func TestDesktopShellDoesNotClaimLiveBeforeObservation(t *testing.T) {
	html, err := webFS.ReadFile("web/index.html")
	if err != nil {
		t.Fatal(err)
	}
	body := string(html)
	for _, forbidden := range []string{"Live topology", "LIVE VIEW"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("shell must not predeclare live state via %q", forbidden)
		}
	}
	if !strings.Contains(body, "Connecting") {
		t.Fatal("shell should begin in an explicit connecting state")
	}
}
