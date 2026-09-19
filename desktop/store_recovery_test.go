package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestStoreReadJSONRecoversFromBackupWhenPrimaryCorrupt(t *testing.T) {
	dir := t.TempDir()
	s := &Store{baseDir: dir}
	if err := os.WriteFile(filepath.Join(dir, "state.json"), []byte(`{"broken":`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "state.json.bak"), []byte(`{"value":"known-good"}`), 0600); err != nil {
		t.Fatal(err)
	}
	var got struct {
		Value string `json:"value"`
	}
	if err := s.readJSON("state.json", &got); err != nil {
		t.Fatal(err)
	}
	if got.Value != "known-good" {
		t.Fatalf("value=%q", got.Value)
	}
}

func TestStoreReadJSONRecoversInterruptedReplaceFromBackup(t *testing.T) {
	dir := t.TempDir()
	s := &Store{baseDir: dir}
	if err := os.WriteFile(filepath.Join(dir, "state.json.bak"), []byte(`{"value":"previous"}`), 0600); err != nil {
		t.Fatal(err)
	}
	var got struct {
		Value string `json:"value"`
	}
	if err := s.readJSON("state.json", &got); err != nil {
		t.Fatal(err)
	}
	if got.Value != "previous" {
		t.Fatalf("value=%q", got.Value)
	}
}

func TestStoreWriteJSONKeepsPreviousGenerationAsBackup(t *testing.T) {
	dir := t.TempDir()
	s := &Store{baseDir: dir}
	if err := s.writeJSON("state.json", map[string]string{"value": "one"}); err != nil {
		t.Fatal(err)
	}
	if err := s.writeJSON("state.json", map[string]string{"value": "two"}); err != nil {
		t.Fatal(err)
	}
	var current, previous struct {
		Value string `json:"value"`
	}
	b, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := decodeStateFile(b, &current); err != nil {
		t.Fatal(err)
	}
	b, err = os.ReadFile(filepath.Join(dir, "state.json.bak"))
	if err != nil {
		t.Fatal(err)
	}
	if err := decodeStateFile(b, &previous); err != nil {
		t.Fatal(err)
	}
	if current.Value != "two" || previous.Value != "one" {
		t.Fatalf("current=%q previous=%q", current.Value, previous.Value)
	}
}

func TestStoreRecoveryJournalRestoresBackupAfterInterruptedPrimaryMove(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "state.json.bak"), []byte(`{"value":"previous"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "state.json.tmp"), []byte(`{"value":"next"}`), 0600); err != nil {
		t.Fatal(err)
	}
	j := persistenceJournal{Version: 1, File: "state.json", Phase: "primary-backed-up"}
	b, _ := json.Marshal(j)
	if err := os.WriteFile(filepath.Join(dir, persistenceJournalName), b, 0600); err != nil {
		t.Fatal(err)
	}
	s := &Store{baseDir: dir}
	if err := s.recoverPersistenceJournal(); err != nil {
		t.Fatal(err)
	}
	var got struct {
		Value string `json:"value"`
	}
	b, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got.Value != "previous" {
		t.Fatalf("value=%q", got.Value)
	}
	if _, err := os.Stat(filepath.Join(dir, "state.json.tmp")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("tmp still exists: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, persistenceJournalName)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("journal still exists: %v", err)
	}
}

func TestStoreRecoveryJournalKeepsCommittedPrimary(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "state.json"), []byte(`{"value":"next"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "state.json.bak"), []byte(`{"value":"previous"}`), 0600); err != nil {
		t.Fatal(err)
	}
	j := persistenceJournal{Version: 1, File: "state.json", Phase: "committed"}
	b, _ := json.Marshal(j)
	if err := os.WriteFile(filepath.Join(dir, persistenceJournalName), b, 0600); err != nil {
		t.Fatal(err)
	}
	s := &Store{baseDir: dir}
	if err := s.recoverPersistenceJournal(); err != nil {
		t.Fatal(err)
	}
	var got struct {
		Value string `json:"value"`
	}
	b, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got.Value != "next" {
		t.Fatalf("value=%q", got.Value)
	}
}
