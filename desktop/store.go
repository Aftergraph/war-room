package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Store struct {
	mu         sync.RWMutex
	persistMu  sync.Mutex
	baseDir    string
	now        func() time.Time
	fault      func(file, phase string) error
	settings   Settings
	github     GitHubSnapshot
	metrics    []MetricSample
	probes     []ProbeResult
	agents     AgentSnapshot
	loadIssues []StateLoadIssue
	migrations []StateMigration
}

type StateLoadIssue struct {
	File  string `json:"file"`
	Error string `json:"error"`
}

type StateMigration struct {
	File string `json:"file"`
	From string `json:"from"`
	To   string `json:"to"`
}

var knownStateFiles = map[string]bool{
	"settings.json": true, "github-snapshot.json": true, "metrics.json": true, "probes.json": true, "agents.json": true,
}

func newStore(baseDir string, bootstrap GitHubSnapshot) (*Store, error) {
	if err := os.MkdirAll(baseDir, 0700); err != nil {
		return nil, err
	}
	s := &Store{baseDir: baseDir, github: bootstrap, now: time.Now}
	if err := s.recoverPersistenceJournal(); err != nil {
		return nil, err
	}
	s.settings = defaultSettings()
	s.loadState("settings.json", &s.settings)
	s.loadState("github-snapshot.json", &s.github)
	s.loadState("metrics.json", &s.metrics)
	s.loadState("probes.json", &s.probes)
	s.loadState("agents.json", &s.agents)
	return s, nil
}

func defaultSettings() Settings {
	return Settings{
		GitHubOrg: "Aftergraph", RefreshSeconds: 60, WorkflowRepoCap: 33,
		RepoDomains: map[string]string{}, TypeSafeAuto: true, TypeSafeMinIntervalSec: 300, TypeSafeDailyBudget: 60,
		AgentStaleSeconds: 45, AssistantLocalModel: true, AssistantOllamaURL: "http://127.0.0.1:11434",
		Probes: []ProbeConfig{
			{ID: "aftergraph-org", Name: "aftergraph.org", URL: "https://aftergraph.org", Domain: "Brand & Public Surface", Enabled: true},
			{ID: "aftergraph-docs", Name: "docs.aftergraph.org", URL: "https://docs.aftergraph.org", Domain: "Brand & Public Surface", Enabled: true},
		},
	}
}

func (s *Store) path(name string) string { return filepath.Join(s.baseDir, name) }

const stateSchema = "aftergraph.war-room.state"
const stateSchemaVersion = 1

type stateEnvelope struct {
	Schema     string          `json:"schema"`
	Version    int             `json:"version"`
	Generation uint64          `json:"generation,omitempty"`
	WrittenAt  time.Time       `json:"writtenAt"`
	Payload    json.RawMessage `json:"payload"`
}

func (s *Store) nowUTC() time.Time {
	if s.now != nil {
		return s.now().UTC()
	}
	return time.Now().UTC()
}

func decodeStateFileForName(name string, b []byte, v any) (bool, error) {
	var env stateEnvelope
	if err := json.Unmarshal(b, &env); err == nil && env.Schema != "" {
		if env.Schema != stateSchema {
			return false, fmt.Errorf("unsupported state schema %q", env.Schema)
		}
		if env.Version != stateSchemaVersion {
			return false, fmt.Errorf("unsupported state version %d", env.Version)
		}
		if len(env.Payload) == 0 {
			return false, errors.New("state envelope payload missing")
		}
		return false, json.Unmarshal(env.Payload, v)
	}
	// Raw JSON is accepted as migration input by the generic persistence helper.
	// Startup migration accounting is restricted to the canonical state files.
	if err := json.Unmarshal(b, v); err != nil {
		return false, err
	}
	return true, nil
}

func decodeStateFile(b []byte, v any) error {
	_, err := decodeStateFileForName("settings.json", b, v)
	return err
}

func encodeStateFileGeneration(now time.Time, generation uint64, v any) ([]byte, error) {
	payload, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	if generation == 0 {
		generation = 1
	}
	return json.MarshalIndent(stateEnvelope{Schema: stateSchema, Version: stateSchemaVersion, Generation: generation, WrittenAt: now.UTC(), Payload: payload}, "", "  ")
}

func encodeStateFile(now time.Time, v any) ([]byte, error) {
	return encodeStateFileGeneration(now, 1, v)
}

func stateGeneration(b []byte) uint64 {
	var env stateEnvelope
	if err := json.Unmarshal(b, &env); err != nil || env.Schema != stateSchema || env.Version != stateSchemaVersion {
		return 0
	}
	return env.Generation
}

func fileStateGeneration(path string) uint64 {
	b, err := os.ReadFile(path)
	if err != nil {
		return 0
	}
	return stateGeneration(b)
}

func (s *Store) injectFault(file, phase string) error {
	if s.fault == nil {
		return nil
	}
	return s.fault(file, phase)
}
func (s *Store) readJSON(name string, v any) error {
	_, err := s.readJSONWithMigration(name, v)
	return err
}

func (s *Store) readJSONWithMigration(name string, v any) (bool, error) {
	type candidate struct {
		path       string
		generation uint64
		primary    bool
	}
	primary := s.path(name)
	paths := []candidate{{path: primary, generation: fileStateGeneration(primary), primary: true}, {path: primary + ".bak", generation: fileStateGeneration(primary + ".bak")}}
	if paths[1].generation > paths[0].generation {
		paths[0], paths[1] = paths[1], paths[0]
	}
	var errs []error
	missing := 0
	for _, c := range paths {
		b, err := os.ReadFile(c.path)
		if err != nil {
			if errors.Is(err, os.ErrNotExist) {
				missing++
			} else {
				errs = append(errs, err)
			}
			continue
		}
		migrated, err := decodeStateFileForName(name, b, v)
		if err == nil {
			return migrated, nil
		}
		errs = append(errs, err)
	}
	if len(errs) == 0 && missing == len(paths) {
		return false, os.ErrNotExist
	}
	return false, errors.Join(errs...)
}

func (s *Store) loadState(name string, v any) {
	migrated, err := s.readJSONWithMigration(name, v)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			s.loadIssues = append(s.loadIssues, StateLoadIssue{File: name, Error: err.Error()})
		}
		return
	}
	if migrated && knownStateFiles[name] {
		s.migrations = append(s.migrations, StateMigration{File: name, From: "legacy-raw-json", To: fmt.Sprintf("%s/v%d", stateSchema, stateSchemaVersion)})
	}
}

func (s *Store) stateLoadDiagnostics() ([]StateLoadIssue, []StateMigration) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]StateLoadIssue(nil), s.loadIssues...), append([]StateMigration(nil), s.migrations...)
}

type persistenceJournal struct {
	Version    int       `json:"version"`
	File       string    `json:"file"`
	Phase      string    `json:"phase"`
	Generation uint64    `json:"generation,omitempty"`
	StartedAt  time.Time `json:"startedAt"`
}

const persistenceJournalName = ".persistence-journal.json"

func (s *Store) writePersistenceJournal(j persistenceJournal) error {
	b, err := json.Marshal(j)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(s.path(persistenceJournalName), os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	return closeErr
}

func (s *Store) clearPersistenceJournal() {
	_ = os.Remove(s.path(persistenceJournalName))
	if d, err := os.Open(s.baseDir); err == nil {
		_ = d.Sync()
		_ = d.Close()
	}
}

func (s *Store) quarantinePersistenceJournal(cause error) error {
	journal := s.path(persistenceJournalName)
	stamp := s.nowUTC().Format("20060102T150405.000000000Z")
	quarantine := s.path(persistenceJournalName + ".corrupt-" + stamp)
	if err := os.Rename(journal, quarantine); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("quarantine persistence journal: %w", err)
	}
	for name := range knownStateFiles {
		_ = os.Remove(s.path(name) + ".tmp")
	}
	s.loadIssues = append(s.loadIssues, StateLoadIssue{File: persistenceJournalName, Error: "quarantined: " + cause.Error()})
	return nil
}

func validPersistenceJournal(j persistenceJournal) error {
	if j.Version != 1 {
		return fmt.Errorf("unsupported persistence journal version %d", j.Version)
	}
	if j.File == "" || filepath.Base(j.File) != j.File || j.File == persistenceJournalName || filepath.Ext(j.File) != ".json" {
		return errors.New("invalid persistence journal target")
	}
	switch j.Phase {
	case "prepared", "primary-backed-up", "committed":
		return nil
	default:
		return fmt.Errorf("invalid persistence journal phase %q", j.Phase)
	}
}

func (s *Store) recoverPersistenceJournal() error {
	b, err := os.ReadFile(s.path(persistenceJournalName))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var j persistenceJournal
	if err := json.Unmarshal(b, &j); err != nil {
		return s.quarantinePersistenceJournal(fmt.Errorf("decode persistence journal: %w", err))
	}
	if err := validPersistenceJournal(j); err != nil {
		return s.quarantinePersistenceJournal(err)
	}
	primary := s.path(j.File)
	tmp := primary + ".tmp"
	backup := primary + ".bak"
	pg, bg := fileStateGeneration(primary), fileStateGeneration(backup)

	// Generations make recovery position-independent: if both durable files
	// exist, the highest valid committed generation wins. A tmp file is never
	// promoted by recovery because it may represent an uncommitted prepare.
	_, primaryErr := os.Stat(primary)
	_, backupErr := os.Stat(backup)
	if bg > pg {
		stale := primary + ".stale"
		_ = os.Remove(stale)
		if primaryErr == nil {
			_ = os.Rename(primary, stale)
		}
		if err := os.Rename(backup, primary); err != nil {
			return fmt.Errorf("promote generation %d for %s: %w", bg, j.File, err)
		}
		_ = os.Remove(stale)
	} else if errors.Is(primaryErr, os.ErrNotExist) && backupErr == nil {
		if err := os.Rename(backup, primary); err != nil {
			return fmt.Errorf("restore %s from backup: %w", j.File, err)
		}
	}
	_ = os.Remove(tmp)
	s.clearPersistenceJournal()
	return nil
}

func (s *Store) writeJSON(name string, v any) error {
	s.persistMu.Lock()
	defer s.persistMu.Unlock()
	if name == "" || filepath.Base(name) != name || name == persistenceJournalName {
		return errors.New("invalid persistence filename")
	}
	primary := s.path(name)
	tmp := primary + ".tmp"
	backup := primary + ".bak"
	nextGeneration := fileStateGeneration(primary)
	if bg := fileStateGeneration(backup); bg > nextGeneration {
		nextGeneration = bg
	}
	nextGeneration++
	b, err := encodeStateFileGeneration(s.nowUTC(), nextGeneration, v)
	if err != nil {
		return err
	}
	f, err := os.OpenFile(tmp, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	if err := s.injectFault(name, "tmp-synced"); err != nil {
		_ = os.Remove(tmp)
		return err
	}

	j := persistenceJournal{Version: 1, File: name, Phase: "prepared", Generation: nextGeneration, StartedAt: s.nowUTC()}
	if err := s.writePersistenceJournal(j); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if err := s.injectFault(name, "journal-prepared"); err != nil {
		return err
	}

	_ = os.Remove(backup)
	hadPrimary := false
	if _, statErr := os.Stat(primary); statErr == nil {
		hadPrimary = true
		if err := os.Rename(primary, backup); err != nil {
			_ = os.Remove(tmp)
			s.clearPersistenceJournal()
			return err
		}
		if err := s.injectFault(name, "primary-backed-up-before-journal"); err != nil {
			return err
		}
		j.Phase = "primary-backed-up"
		if err := s.writePersistenceJournal(j); err != nil {
			_ = os.Rename(backup, primary)
			_ = os.Remove(tmp)
			s.clearPersistenceJournal()
			return err
		}
		if err := s.injectFault(name, "journal-primary-backed-up"); err != nil {
			return err
		}
	} else if !errors.Is(statErr, os.ErrNotExist) {
		_ = os.Remove(tmp)
		return statErr
	}
	if err := os.Rename(tmp, primary); err != nil {
		if hadPrimary {
			_ = os.Rename(backup, primary)
		}
		_ = os.Remove(tmp)
		s.clearPersistenceJournal()
		return err
	}
	if err := s.injectFault(name, "primary-replaced"); err != nil {
		return err
	}
	j.Phase = "committed"
	if err := s.writePersistenceJournal(j); err != nil {
		// The primary is already durable. Leave the journal behind so startup
		// recovery can observe and clear it without rolling back committed data.
		return err
	}
	if err := s.injectFault(name, "journal-committed"); err != nil {
		return err
	}
	if d, openErr := os.Open(s.baseDir); openErr == nil {
		_ = d.Sync()
		_ = d.Close()
	}
	if err := s.injectFault(name, "dir-synced"); err != nil {
		return err
	}
	s.clearPersistenceJournal()
	return nil
}
func (s *Store) getSettings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v := s.settings
	v.RepoDomains = cloneStringMap(s.settings.RepoDomains)
	v.Probes = append([]ProbeConfig(nil), s.settings.Probes...)
	return v
}

func cloneStringMap(in map[string]string) map[string]string {
	if in == nil {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func cloneMetrics(in []MetricSample) []MetricSample {
	out := append([]MetricSample(nil), in...)
	for i := range out {
		out[i].Labels = cloneStringMap(out[i].Labels)
	}
	return out
}

func cloneAgentSnapshot(in AgentSnapshot) AgentSnapshot {
	out := in
	out.Sessions = append([]AgentSession(nil), in.Sessions...)
	for i := range out.Sessions {
		out.Sessions[i].Capabilities = append([]string(nil), out.Sessions[i].Capabilities...)
		out.Sessions[i].Metadata = cloneStringMap(out.Sessions[i].Metadata)
	}
	out.Events = append([]AgentEvent(nil), in.Events...)
	for i := range out.Events {
		out.Events[i].Metadata = cloneStringMap(out.Events[i].Metadata)
	}
	out.Sources = append([]AgentSourceStatus(nil), in.Sources...)
	return out
}
func (s *Store) saveSettings(v Settings) error {
	if v.GitHubOrg == "" {
		return errors.New("githubOrg is required")
	}
	if v.RefreshSeconds < 60 {
		v.RefreshSeconds = 60
	}
	if v.WorkflowRepoCap < 1 {
		v.WorkflowRepoCap = 1
	}
	if v.WorkflowRepoCap > 60 {
		v.WorkflowRepoCap = 60
	}
	if v.TypeSafeMinIntervalSec < 60 {
		v.TypeSafeMinIntervalSec = 60
	}
	if v.TypeSafeDailyBudget < 1 {
		v.TypeSafeDailyBudget = 1
	}
	if v.TypeSafeDailyBudget > 1000 {
		v.TypeSafeDailyBudget = 1000
	}
	if v.AgentStaleSeconds < 15 {
		v.AgentStaleSeconds = 15
	}
	if v.AgentStaleSeconds > 3600 {
		v.AgentStaleSeconds = 3600
	}
	if v.AssistantOllamaURL == "" {
		v.AssistantOllamaURL = "http://127.0.0.1:11434"
	}
	v.RepoDomains = cloneStringMap(v.RepoDomains)
	v.Probes = append([]ProbeConfig(nil), v.Probes...)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeJSON("settings.json", v); err != nil {
		return err
	}
	s.settings = v
	return nil
}
func (s *Store) getGitHub() GitHubSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v := s.github
	v.Repos = append([]Repo(nil), s.github.Repos...)
	v.Activities = append([]ActivityItem(nil), s.github.Activities...)
	v.WorkflowRuns = append([]WorkflowRun(nil), s.github.WorkflowRuns...)
	v.Errors = append([]string(nil), s.github.Errors...)
	return v
}
func (s *Store) saveGitHub(v GitHubSnapshot) error {
	v.Repos = append([]Repo(nil), v.Repos...)
	v.Activities = append([]ActivityItem(nil), v.Activities...)
	v.WorkflowRuns = append([]WorkflowRun(nil), v.WorkflowRuns...)
	v.Errors = append([]string(nil), v.Errors...)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeJSON("github-snapshot.json", v); err != nil {
		return err
	}
	s.github = v
	return nil
}
func (s *Store) addMetric(m MetricSample) error {
	if m.ObservedAt.IsZero() {
		m.ObservedAt = s.nowUTC()
	}
	m.Labels = cloneStringMap(m.Labels)
	s.mu.Lock()
	defer s.mu.Unlock()
	next := append(cloneMetrics(s.metrics), m)
	if len(next) > 2000 {
		next = next[len(next)-2000:]
	}
	if err := s.writeJSON("metrics.json", next); err != nil {
		return err
	}
	s.metrics = next
	return nil
}
func (s *Store) getMetrics() []MetricSample {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneMetrics(s.metrics)
}
func (s *Store) setProbes(p []ProbeResult) error {
	p = append([]ProbeResult(nil), p...)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeJSON("probes.json", p); err != nil {
		return err
	}
	s.probes = p
	return nil
}
func (s *Store) getProbes() []ProbeResult {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]ProbeResult(nil), s.probes...)
}

func (s *Store) getAgents() AgentSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return cloneAgentSnapshot(s.agents)
}

func (s *Store) saveAgents(v AgentSnapshot) error {
	v = cloneAgentSnapshot(v)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.writeJSON("agents.json", v); err != nil {
		return err
	}
	s.agents = v
	return nil
}

// mutateAgents serializes read-modify-write updates to agent state. This avoids
// lost heartbeats/events when WORKS SSE and Agent Bridge update concurrently.
func (s *Store) mutateAgents(fn func(*AgentSnapshot) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	v := cloneAgentSnapshot(s.agents)
	if err := fn(&v); err != nil {
		return err
	}
	if err := s.writeJSON("agents.json", v); err != nil {
		return err
	}
	s.agents = v
	return nil
}
