package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"aftergraph/warroom-desktop/internal/updater"
)

func main() {
	var (
		planPath      = flag.String("plan", "", "signed update-plan JSON")
		candidatePath = flag.String("candidate", "", "downloaded candidate executable")
		installPath   = flag.String("install", "", "installed Aftergraph-War-Room.exe path")
		stateDir      = flag.String("state-dir", "", "War Room state directory")
		backupDir     = flag.String("backup-dir", "", "update backup directory")
		verifyOnly    = flag.Bool("verify-only", false, "verify signed plan and candidate without applying")
	)
	flag.Parse()
	if *planPath == "" || *candidatePath == "" {
		fail("plan and candidate are required")
	}
	plan, err := updater.LoadPlan(*planPath)
	if err != nil {
		fail("load plan: %v", err)
	}
	if err := updater.VerifyPlan(plan, updater.ProductionTrustStore()); err != nil {
		fail("verify signed update plan: %v", err)
	}
	if err := updater.VerifyArtifact(*candidatePath, plan.Artifact); err != nil {
		fail("verify update artifact: %v", err)
	}
	if *verifyOnly {
		fmt.Printf("verified signed update plan %s -> %s for %s\n", plan.CurrentVersion, plan.TargetVersion, plan.SourceCommit)
		return
	}
	if *installPath == "" || *stateDir == "" {
		fail("install and state-dir are required unless --verify-only is used")
	}
	if *backupDir == "" {
		*backupDir = filepath.Join(filepath.Dir(*stateDir), "WarRoom-Update-Backups", plan.TargetVersion+"-"+time.Now().UTC().Format("20060102T150405Z"))
	}
	localAppData, err := updater.CanonicalLocalAppDataFromStateDir(*stateDir)
	if err != nil {
		fail("derive LOCALAPPDATA: %v", err)
	}
	receipt, err := updater.Apply(context.Background(), updater.ApplyOptions{
		Plan:          plan,
		CandidatePath: *candidatePath,
		InstallPath:   *installPath,
		StateDir:      *stateDir,
		BackupDir:     *backupDir,
		HealthCheck:   updater.NativeHealthCheck(localAppData),
	})
	if err != nil {
		fail("apply update: %v", err)
	}
	b, _ := json.MarshalIndent(receipt, "", "  ")
	fmt.Println(string(b))
}

func fail(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
