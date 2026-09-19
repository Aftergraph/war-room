package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStateEnvelopeRoundTripAndLegacyMigration(t *testing.T) {
	dir := t.TempDir()
	fixed := time.Date(2026, 9, 19, 0, 0, 0, 0, time.UTC)
	s := &Store{baseDir: dir, now: func() time.Time { return fixed }}
	if err := s.writeJSON("state.json", map[string]string{"value": "next"}); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	var env stateEnvelope
	if err := decodeEnvelopeOnly(raw, &env); err != nil {
		t.Fatal(err)
	}
	if env.Schema != stateSchema || env.Version != 1 || !env.WrittenAt.Equal(fixed) {
		t.Fatalf("bad envelope: %+v", env)
	}
	var got map[string]string
	if err := s.readJSON("state.json", &got); err != nil {
		t.Fatal(err)
	}
	if got["value"] != "next" {
		t.Fatalf("got=%v", got)
	}

	if err := os.WriteFile(filepath.Join(dir, "legacy.json"), []byte(`{"value":"legacy"}`), 0600); err != nil {
		t.Fatal(err)
	}
	got = nil
	if err := s.readJSON("legacy.json", &got); err != nil {
		t.Fatal(err)
	}
	if got["value"] != "legacy" {
		t.Fatalf("legacy=%v", got)
	}
}

func decodeEnvelopeOnly(b []byte, env *stateEnvelope) error { return json.Unmarshal(b, env) }

func TestPersistenceFaultRecoveryAcrossJournalPhases(t *testing.T) {
	phases := []string{"journal-prepared", "primary-backed-up-before-journal", "journal-primary-backed-up", "primary-replaced", "journal-committed", "dir-synced"}
	for _, phase := range phases {
		t.Run(phase, func(t *testing.T) {
			dir := t.TempDir()
			s := &Store{baseDir: dir, now: time.Now}
			if err := s.writeJSON("state.json", map[string]string{"value": "old"}); err != nil {
				t.Fatal(err)
			}
			fired := false
			s.fault = func(file, at string) error {
				if at == phase && !fired {
					fired = true
					return errors.New("injected")
				}
				return nil
			}
			if err := s.writeJSON("state.json", map[string]string{"value": "new"}); err == nil {
				t.Fatal("expected injected failure")
			}
			recovered := &Store{baseDir: dir, now: time.Now}
			if err := recovered.recoverPersistenceJournal(); err != nil {
				t.Fatal(err)
			}
			var got map[string]string
			if err := recovered.readJSON("state.json", &got); err != nil {
				t.Fatal(err)
			}
			if got["value"] != "old" && got["value"] != "new" {
				t.Fatalf("invalid recovered generation: %v", got)
			}
			if _, err := os.Stat(filepath.Join(dir, persistenceJournalName)); !errors.Is(err, os.ErrNotExist) {
				t.Fatalf("journal remains: %v", err)
			}
		})
	}
}
