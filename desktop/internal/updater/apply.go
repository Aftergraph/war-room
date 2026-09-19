package updater

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type HealthCheck func(context.Context, string, string) error

type ApplyOptions struct {
	Plan          Plan
	CandidatePath string
	InstallPath   string
	StateDir      string
	BackupDir     string
	HealthCheck   HealthCheck
}

type Receipt struct {
	TargetVersion string `json:"targetVersion"`
	SourceCommit  string `json:"sourceCommit"`
	InstallPath   string `json:"installPath"`
	BackupDir     string `json:"backupDir"`
	Applied       bool   `json:"applied"`
	RolledBack    bool   `json:"rolledBack"`
}

func VerifyArtifact(path string, artifact Artifact) error {
	info, err := os.Stat(path)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("update artifact must be a regular file")
	}
	if info.Size() != artifact.Bytes {
		return fmt.Errorf("artifact size mismatch: got %d want %d", info.Size(), artifact.Bytes)
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(b)
	got := hex.EncodeToString(sum[:])
	if !strings.EqualFold(got, artifact.SHA256) {
		return fmt.Errorf("artifact sha256 mismatch: got %s want %s", got, artifact.SHA256)
	}
	return nil
}

func Apply(ctx context.Context, opt ApplyOptions) (Receipt, error) {
	r := Receipt{
		TargetVersion: opt.Plan.TargetVersion,
		SourceCommit:  opt.Plan.SourceCommit,
		InstallPath:   opt.InstallPath,
		BackupDir:     opt.BackupDir,
	}
	if opt.HealthCheck == nil {
		return r, errors.New("post-install health check is required")
	}
	if err := VerifyArtifact(opt.CandidatePath, opt.Plan.Artifact); err != nil {
		return r, err
	}
	if err := PreflightState(opt.StateDir, opt.Plan.State); err != nil {
		return r, err
	}
	if err := SnapshotState(opt.StateDir, opt.BackupDir); err != nil {
		return r, fmt.Errorf("snapshot state: %w", err)
	}
	info, err := os.Stat(opt.InstallPath)
	if err != nil {
		return r, fmt.Errorf("inspect current install: %w", err)
	}
	if !info.Mode().IsRegular() {
		return r, errors.New("current install must be a regular file")
	}

	installDir := filepath.Dir(opt.InstallPath)
	stage := filepath.Join(installDir, ".aftergraph-war-room-update-"+opt.Plan.TargetVersion+".exe")
	previous := filepath.Join(installDir, ".aftergraph-war-room-previous.exe")
	_ = os.Remove(stage)
	_ = os.Remove(previous)
	if err := copyFile(opt.CandidatePath, stage, info.Mode().Perm()); err != nil {
		return r, fmt.Errorf("stage update: %w", err)
	}
	if err := VerifyArtifact(stage, opt.Plan.Artifact); err != nil {
		_ = os.Remove(stage)
		return r, fmt.Errorf("verify staged update: %w", err)
	}
	if err := os.Rename(opt.InstallPath, previous); err != nil {
		_ = os.Remove(stage)
		return r, fmt.Errorf("move current executable aside: %w", err)
	}
	restore := func() error {
		_ = os.Remove(opt.InstallPath)
		if err := os.Rename(previous, opt.InstallPath); err != nil {
			return err
		}
		r.RolledBack = true
		return nil
	}
	if err := os.Rename(stage, opt.InstallPath); err != nil {
		_ = restore()
		return r, fmt.Errorf("install staged executable: %w", err)
	}
	if err := VerifyArtifact(opt.InstallPath, opt.Plan.Artifact); err != nil {
		rollbackErr := restore()
		if rollbackErr != nil {
			return r, fmt.Errorf("verify installed artifact: %v; rollback failed: %w", err, rollbackErr)
		}
		return r, fmt.Errorf("verify installed artifact: %w", err)
	}
	checkCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if err := opt.HealthCheck(checkCtx, opt.InstallPath, opt.Plan.TargetVersion); err != nil {
		rollbackErr := restore()
		if rollbackErr != nil {
			return r, fmt.Errorf("post-install health check: %v; rollback failed: %w", err, rollbackErr)
		}
		return r, fmt.Errorf("post-install health check failed; previous executable restored: %w", err)
	}
	if err := copyFile(previous, filepath.Join(opt.BackupDir, "bin", filepath.Base(opt.InstallPath)), info.Mode().Perm()); err != nil {
		rollbackErr := restore()
		if rollbackErr != nil {
			return r, fmt.Errorf("archive previous executable: %v; rollback failed: %w", err, rollbackErr)
		}
		return r, fmt.Errorf("archive previous executable: %w", err)
	}
	if err := os.Remove(previous); err != nil {
		return r, fmt.Errorf("remove adjacent previous executable after backup: %w", err)
	}
	r.Applied = true
	return r, nil
}
