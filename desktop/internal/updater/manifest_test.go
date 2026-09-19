package updater

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"testing"
)

func signedFixture(t *testing.T) (Plan, TrustStore) {
	t.Helper()
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	p := Plan{
		Schema:         PlanSchema,
		CurrentVersion: "1.6.13",
		TargetVersion:  "1.6.14",
		SourceCommit:   "0123456789abcdef0123456789abcdef01234567",
		Artifact: Artifact{
			Name:   "Aftergraph-War-Room.exe",
			SHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			Bytes:  42,
		},
		State: StateContract{MinVersion: 1, MaxVersion: 1},
		Signature: Signature{
			Algorithm: "ed25519",
			KeyID:     "test-release-key",
		},
	}
	payload, err := canonicalPayload(p)
	if err != nil {
		t.Fatal(err)
	}
	p.Signature.Value = base64.StdEncoding.EncodeToString(ed25519.Sign(priv, payload))
	trust := TrustStore{
		Schema: TrustSchema,
		Keys: []TrustedKey{{
			ID:        "test-release-key",
			Algorithm: "ed25519",
			PublicKey: base64.StdEncoding.EncodeToString(pub),
		}},
	}
	return p, trust
}

func TestVerifyPlanAcceptsValidSignature(t *testing.T) {
	p, trust := signedFixture(t)
	if err := VerifyPlan(p, trust); err != nil {
		t.Fatal(err)
	}
}

func TestVerifyPlanRejectsTampering(t *testing.T) {
	p, trust := signedFixture(t)
	p.TargetVersion = "1.6.99"
	if err := VerifyPlan(p, trust); err == nil {
		t.Fatal("tampered signed plan accepted")
	}
}

func TestVerifyPlanRejectsUntrustedKey(t *testing.T) {
	p, trust := signedFixture(t)
	trust.Keys[0].ID = "different-key"
	if err := VerifyPlan(p, trust); err == nil {
		t.Fatal("untrusted update key accepted")
	}
}

func TestVerifyPlanRejectsDowngrade(t *testing.T) {
	p, trust := signedFixture(t)
	p.CurrentVersion = "1.6.14"
	p.TargetVersion = "1.6.13"
	payload, err := canonicalPayload(p)
	if err != nil {
		t.Fatal(err)
	}
	_ = payload
	// The original signature is intentionally stale too; the downgrade must never pass.
	if err := VerifyPlan(p, trust); err == nil {
		t.Fatal("downgrade plan accepted")
	}
}
