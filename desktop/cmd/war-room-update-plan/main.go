package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"aftergraph/warroom-desktop/internal/updater"
)

func main() {
	var (
		current  = flag.String("current", "", "current desktop version")
		target   = flag.String("target", "", "target desktop version")
		source   = flag.String("source-commit", "", "exact target source commit")
		artifact = flag.String("artifact", "", "target Aftergraph-War-Room.exe")
		keyID    = flag.String("key-id", "", "trusted release key id")
		stateMin = flag.Int("state-min", 1, "minimum supported state schema")
		stateMax = flag.Int("state-max", 1, "maximum supported state schema")
		out      = flag.String("out", "UPDATE-PLAN.json", "output update plan")
	)
	flag.Parse()
	if *current == "" || *target == "" || *source == "" || *artifact == "" || *keyID == "" {
		fail("current, target, source-commit, artifact and key-id are required")
	}
	privateB64 := os.Getenv("WAR_ROOM_UPDATE_SIGNING_KEY_B64")
	if privateB64 == "" {
		fail("WAR_ROOM_UPDATE_SIGNING_KEY_B64 is required")
	}
	privateKey, err := base64.StdEncoding.DecodeString(privateB64)
	if err != nil || len(privateKey) != ed25519.PrivateKeySize {
		fail("WAR_ROOM_UPDATE_SIGNING_KEY_B64 must contain a base64 Ed25519 private key")
	}
	body, err := os.ReadFile(*artifact)
	if err != nil {
		fail("read artifact: %v", err)
	}
	sum := sha256.Sum256(body)
	plan := updater.Plan{
		Schema:         updater.PlanSchema,
		CurrentVersion: *current,
		TargetVersion:  *target,
		SourceCommit:   *source,
		Artifact: updater.Artifact{
			Name:   filepath.Base(*artifact),
			SHA256: hex.EncodeToString(sum[:]),
			Bytes:  int64(len(body)),
		},
		State: updater.StateContract{MinVersion: *stateMin, MaxVersion: *stateMax},
	}
	plan, err = updater.SignPlan(plan, *keyID, ed25519.PrivateKey(privateKey))
	if err != nil {
		fail("sign plan: %v", err)
	}
	encoded, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		fail("encode plan: %v", err)
	}
	encoded = append(encoded, '\n')
	if err := os.WriteFile(*out, encoded, 0600); err != nil {
		fail("write plan: %v", err)
	}
	fmt.Printf("signed update plan %s -> %s for %s\n", plan.CurrentVersion, plan.TargetVersion, plan.Artifact.SHA256)
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
