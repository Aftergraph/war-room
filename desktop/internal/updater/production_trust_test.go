package updater

import (
	"encoding/base64"
	"os"
	"testing"
)

func TestOfficialReleaseRequiresProductionUpdateTrust(t *testing.T) {
	if os.Getenv("WAR_ROOM_OFFICIAL_RELEASE") != "1" {
		t.Skip("official release trust gate not requested")
	}
	trust := ProductionTrustStore()
	if trust.Schema != TrustSchema {
		t.Fatalf("production trust schema=%q", trust.Schema)
	}
	if len(trust.Keys) == 0 {
		t.Fatal("official release blocked: no production update trust key is pinned")
	}
	seen := map[string]bool{}
	for _, key := range trust.Keys {
		if key.ID == "" || seen[key.ID] {
			t.Fatalf("invalid or duplicate production update key id %q", key.ID)
		}
		seen[key.ID] = true
		if key.Algorithm != "ed25519" {
			t.Fatalf("production update key %q uses unsupported algorithm %q", key.ID, key.Algorithm)
		}
		raw, err := base64.StdEncoding.DecodeString(key.PublicKey)
		if err != nil || len(raw) != 32 {
			t.Fatalf("production update key %q has invalid Ed25519 public key", key.ID)
		}
	}
}
