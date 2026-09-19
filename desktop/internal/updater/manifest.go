package updater

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

const (
	PlanSchema  = "aftergraph.war-room.desktop.update-plan/1.0"
	TrustSchema = "aftergraph.war-room.desktop.update-trust/1.0"
)

type Artifact struct {
	Name   string `json:"name"`
	SHA256 string `json:"sha256"`
	Bytes  int64  `json:"bytes"`
}

type StateContract struct {
	MinVersion int `json:"minVersion"`
	MaxVersion int `json:"maxVersion"`
}

type Signature struct {
	Algorithm string `json:"algorithm"`
	KeyID     string `json:"keyId"`
	Value     string `json:"value"`
}

type Plan struct {
	Schema         string        `json:"schema"`
	CurrentVersion string        `json:"currentVersion"`
	TargetVersion  string        `json:"targetVersion"`
	SourceCommit   string        `json:"sourceCommit"`
	Artifact       Artifact      `json:"artifact"`
	State          StateContract `json:"state"`
	Signature      Signature     `json:"signature"`
}

type TrustedKey struct {
	ID        string `json:"id"`
	Algorithm string `json:"algorithm"`
	PublicKey string `json:"publicKey"`
}

type TrustStore struct {
	Schema string       `json:"schema"`
	Keys   []TrustedKey `json:"keys"`
}

func LoadPlan(path string) (Plan, error) {
	var p Plan
	b, err := os.ReadFile(path)
	if err != nil {
		return p, err
	}
	if err := json.Unmarshal(b, &p); err != nil {
		return p, err
	}
	return p, nil
}

func LoadTrustStore(path string) (TrustStore, error) {
	var t TrustStore
	b, err := os.ReadFile(path)
	if err != nil {
		return t, err
	}
	if err := json.Unmarshal(b, &t); err != nil {
		return t, err
	}
	return t, nil
}

func canonicalPayload(p Plan) ([]byte, error) {
	p.Signature = Signature{}
	return json.Marshal(p)
}

func VerifyPlan(p Plan, trust TrustStore) error {
	if p.Schema != PlanSchema {
		return fmt.Errorf("unsupported update plan schema %q", p.Schema)
	}
	if trust.Schema != TrustSchema {
		return fmt.Errorf("unsupported update trust schema %q", trust.Schema)
	}
	if p.CurrentVersion == "" || p.TargetVersion == "" || p.SourceCommit == "" {
		return errors.New("update plan identity is incomplete")
	}
	if compareVersion(p.TargetVersion, p.CurrentVersion) <= 0 {
		return fmt.Errorf("target version %s must be newer than current version %s", p.TargetVersion, p.CurrentVersion)
	}
	if len(p.Artifact.SHA256) != 64 || p.Artifact.Bytes <= 0 || p.Artifact.Name == "" {
		return errors.New("update artifact contract is incomplete")
	}
	if p.State.MinVersion <= 0 || p.State.MaxVersion < p.State.MinVersion {
		return errors.New("invalid state compatibility range")
	}
	if p.Signature.Algorithm != "ed25519" || p.Signature.KeyID == "" || p.Signature.Value == "" {
		return errors.New("signed update plan required")
	}
	var key *TrustedKey
	for i := range trust.Keys {
		if trust.Keys[i].ID == p.Signature.KeyID {
			key = &trust.Keys[i]
			break
		}
	}
	if key == nil {
		return fmt.Errorf("update signing key %q is not trusted", p.Signature.KeyID)
	}
	if key.Algorithm != "ed25519" {
		return fmt.Errorf("unsupported trusted key algorithm %q", key.Algorithm)
	}
	pub, err := base64.StdEncoding.DecodeString(key.PublicKey)
	if err != nil || len(pub) != ed25519.PublicKeySize {
		return errors.New("invalid trusted ed25519 public key")
	}
	sig, err := base64.StdEncoding.DecodeString(p.Signature.Value)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return errors.New("invalid update plan signature encoding")
	}
	payload, err := canonicalPayload(p)
	if err != nil {
		return err
	}
	if !ed25519.Verify(ed25519.PublicKey(pub), payload, sig) {
		return errors.New("update plan signature verification failed")
	}
	return nil
}

func compareVersion(a, b string) int {
	pa, oka := parseVersion(a)
	pb, okb := parseVersion(b)
	if !oka || !okb {
		return strings.Compare(a, b)
	}
	for i := 0; i < 3; i++ {
		if pa[i] < pb[i] {
			return -1
		}
		if pa[i] > pb[i] {
			return 1
		}
	}
	return 0
}

func parseVersion(v string) ([3]int, bool) {
	var out [3]int
	parts := strings.Split(strings.TrimPrefix(v, "v"), ".")
	if len(parts) != 3 {
		return out, false
	}
	for i, part := range parts {
		n, err := strconv.Atoi(part)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}
