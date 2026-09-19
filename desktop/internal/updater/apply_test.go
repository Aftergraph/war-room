package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func artifactFor(t *testing.T, path string) Artifact {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(b)
	return Artifact{
		Name:   filepath.Base(path),
		SHA256: hex.EncodeToString(sum[:]),
		Bytes:  int64(len(b)),
	}
}

func writeStateFixture(t *testing.T, dir string, version int) {
	t.Helper()
	if err := os.MkdirAll(dir, 0700); err != nil {
		t.Fatal(err)
	}
	body := []byte(`{"schema":"aftergraph.war-room.state","version":`)
	body = append(body, []byte(string(rune('0'+version)))...)
	body = append(body, []byte(`,"payload":{}}`)...)
	if err := os.WriteFile(filepath.Join(dir, "settings.json"), body, 0600); err != nil {
		t.Fatal(err)
	}
}

func TestApplySuccessSnapshotsStateAndArchivesPreviousExecutable(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	backupDir := filepath.Join(root, "backup")
	install := filepath.Join(root, "Aftergraph-War-Room.exe")
	candidate := filepath.Join(root, "candidate.exe")
	writeStateFixture(t, stateDir, 1)
	if err := os.WriteFile(install, []byte("old-binary"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(candidate, []byte("new-binary"), 0700); err != nil {
		t.Fatal(err)
	}
	plan := Plan{
		TargetVersion: "1.6.14",
		SourceCommit:  "commit",
		Artifact:      artifactFor(t, candidate),
		State:         StateContract{MinVersion: 1, MaxVersion: 1},
	}
	receipt, err := Apply(context.Background(), ApplyOptions{
		Plan:          plan,
		CandidatePath: candidate,
		InstallPath:   install,
		StateDir:      stateDir,
		BackupDir:     backupDir,
		HealthCheck: func(_ context.Context, installed, target string) error {
			b, err := os.ReadFile(installed)
			if err != nil {
				return err
			}
			if string(b) != "new-binary" || target != "1.6.14" {
				return errors.New("installed candidate mismatch")
			}
			return nil
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !receipt.Applied || receipt.RolledBack {
		t.Fatalf("receipt=%+v", receipt)
	}
	if got, _ := os.ReadFile(install); string(got) != "new-binary" {
		t.Fatalf("installed=%q", got)
	}
	if got, _ := os.ReadFile(filepath.Join(backupDir, "bin", filepath.Base(install))); string(got) != "old-binary" {
		t.Fatalf("backup executable=%q", got)
	}
	if _, err := os.Stat(filepath.Join(backupDir, "state", "settings.json")); err != nil {
		t.Fatal(err)
	}
}

func TestApplyHealthFailureRestoresPreviousExecutable(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	backupDir := filepath.Join(root, "backup")
	install := filepath.Join(root, "Aftergraph-War-Room.exe")
	candidate := filepath.Join(root, "candidate.exe")
	writeStateFixture(t, stateDir, 1)
	if err := os.WriteFile(install, []byte("old-binary"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(candidate, []byte("broken-new-binary"), 0700); err != nil {
		t.Fatal(err)
	}
	plan := Plan{
		TargetVersion: "1.6.14",
		SourceCommit:  "commit",
		Artifact:      artifactFor(t, candidate),
		State:         StateContract{MinVersion: 1, MaxVersion: 1},
	}
	receipt, err := Apply(context.Background(), ApplyOptions{
		Plan:          plan,
		CandidatePath: candidate,
		InstallPath:   install,
		StateDir:      stateDir,
		BackupDir:     backupDir,
		HealthCheck: func(context.Context, string, string) error {
			return errors.New("health failed")
		},
	})
	if err == nil {
		t.Fatal("failed candidate accepted")
	}
	if receipt.Applied || !receipt.RolledBack {
		t.Fatalf("receipt=%+v", receipt)
	}
	if got, _ := os.ReadFile(install); string(got) != "old-binary" {
		t.Fatalf("rollback installed=%q", got)
	}
}

func TestApplyRejectsIncompatibleStateBeforeSwap(t *testing.T) {
	root := t.TempDir()
	stateDir := filepath.Join(root, "state")
	backupDir := filepath.Join(root, "backup")
	install := filepath.Join(root, "Aftergraph-War-Room.exe")
	candidate := filepath.Join(root, "candidate.exe")
	writeStateFixture(t, stateDir, 2)
	_ = os.WriteFile(install, []byte("old-binary"), 0700)
	_ = os.WriteFile(candidate, []byte("new-binary"), 0700)
	plan := Plan{
		TargetVersion: "1.6.14",
		SourceCommit:  "commit",
		Artifact:      artifactFor(t, candidate),
		State:         StateContract{MinVersion: 1, MaxVersion: 1},
	}
	_, err := Apply(context.Background(), ApplyOptions{
		Plan:          plan,
		CandidatePath: candidate,
		InstallPath:   install,
		StateDir:      stateDir,
		BackupDir:     backupDir,
		HealthCheck:   func(context.Context, string, string) error { return nil },
	})
	if err == nil {
		t.Fatal("incompatible state version accepted")
	}
	if got, _ := os.ReadFile(install); string(got) != "old-binary" {
		t.Fatalf("install changed before preflight completed: %q", got)
	}
}
