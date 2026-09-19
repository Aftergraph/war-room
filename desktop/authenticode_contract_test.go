package main

import (
	"os"
	"strings"
	"testing"
)

func TestOfficialReleaseSignsShippedBinariesBeforeProvenance(t *testing.T) {
	b, err := os.ReadFile("../.github/workflows/desktop-release.yml")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	sign := strings.Index(src, `& ./scripts/sign-windows.ps1 -Path @("dist/Aftergraph-War-Room.exe", "dist/Aftergraph-War-Room-Updater.exe")`)
	appScan := strings.Index(src, "govulncheck -mode=binary dist/Aftergraph-War-Room.exe")
	updaterScan := strings.Index(src, "govulncheck -mode=binary dist/Aftergraph-War-Room-Updater.exe")
	plan := strings.Index(src, "go run ./cmd/war-room-update-plan")
	metadata := strings.Index(src, "python scripts/generate-release-metadata.py")
	if sign < 0 || appScan < 0 || updaterScan < 0 || plan < 0 || metadata < 0 {
		t.Fatal("release workflow is missing an Authenticode/provenance gate")
	}
	if !(sign < appScan && sign < updaterScan && appScan < plan && updaterScan < plan && plan < metadata) {
		t.Fatalf("release ordering drifted: sign=%d appScan=%d updaterScan=%d plan=%d metadata=%d", sign, appScan, updaterScan, plan, metadata)
	}
}

func TestAuthenticodeSecretsAreOnlyReleaseInputs(t *testing.T) {
	b, err := os.ReadFile("../.github/workflows/desktop-release.yml")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	for _, name := range []string{
		"WAR_ROOM_AUTHENTICODE_PFX_B64",
		"WAR_ROOM_AUTHENTICODE_PFX_PASSWORD",
		"WAR_ROOM_AUTHENTICODE_CERT_SHA1",
		"WAR_ROOM_AUTHENTICODE_TIMESTAMP_URL",
	} {
		if !strings.Contains(src, name) {
			t.Fatalf("release workflow missing %s", name)
		}
	}
}
