package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"
)

const agentHeartbeatContract = "aftergraph.agent.heartbeat/0.1"

func normalizeAgentState(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	switch v {
	case "running", "working", "executing", "active":
		return "running"
	case "waiting", "queued", "ready":
		return "waiting"
	case "blocked", "needs_you", "needs-you", "error", "failed":
		return "blocked"
	case "idle", "paused", "done", "completed", "succeeded":
		return "idle"
	case "stale", "offline":
		return v
	default:
		return "unknown"
	}
}

func summarizeAgents(s AgentSnapshot, staleAfter time.Duration) AgentSnapshot {
	return summarizeAgentsAt(s, staleAfter, time.Now().UTC())
}

func summarizeAgentsAt(s AgentSnapshot, staleAfter time.Duration, now time.Time) AgentSnapshot {
	if s.Sessions == nil {
		s.Sessions = []AgentSession{}
	}
	if s.Events == nil {
		s.Events = []AgentEvent{}
	}
	if s.Sources == nil {
		s.Sources = []AgentSourceStatus{}
	}
	now = now.UTC()
	s.ObservedAt = now
	s.Active, s.Running, s.Waiting, s.Blocked, s.Stale = 0, 0, 0, 0, 0
	for i := range s.Sessions {
		x := &s.Sessions[i]
		x.State = normalizeAgentState(x.State)
		if !x.LastHeartbeat.IsZero() && now.Sub(x.LastHeartbeat) > staleAfter && x.State != "offline" {
			x.State = "stale"
		}
		switch x.State {
		case "running":
			s.Running++
			s.Active++
		case "waiting":
			s.Waiting++
			s.Active++
		case "blocked":
			s.Blocked++
			s.Active++
		case "stale", "offline":
			s.Stale++
		default:
			// Unknown/unrecognized presence is not evidence of activity.
		}
	}
	sort.Slice(s.Sessions, func(i, j int) bool {
		if s.Sessions[i].State != s.Sessions[j].State {
			rank := map[string]int{"blocked": 0, "running": 1, "waiting": 2, "idle": 3, "stale": 4, "offline": 5}
			return rank[s.Sessions[i].State] < rank[s.Sessions[j].State]
		}
		return s.Sessions[i].LastHeartbeat.After(s.Sessions[j].LastHeartbeat)
	})
	sort.Slice(s.Events, func(i, j int) bool { return s.Events[i].Timestamp.After(s.Events[j].Timestamp) })
	if len(s.Events) > 250 {
		s.Events = s.Events[:250]
	}
	if len(s.Sessions) > 120 {
		s.Sessions = s.Sessions[:120]
	}
	return s
}

func (a *App) agentSnapshot() AgentSnapshot {
	cfg := a.store.getSettings()
	stale := time.Duration(cfg.AgentStaleSeconds) * time.Second
	if stale < 15*time.Second {
		stale = 45 * time.Second
	}
	return summarizeAgentsAt(a.store.getAgents(), stale, a.nowUTC())
}

func (a *App) updateAgentSource(src AgentSourceStatus) {
	stale := time.Duration(a.store.getSettings().AgentStaleSeconds) * time.Second
	_ = a.store.mutateAgents(func(s *AgentSnapshot) error {
		found := false
		for i := range s.Sources {
			if s.Sources[i].ID == src.ID {
				// Source observations are monotonic. A late/out-of-order observation
				// must never regress a newer projection already accepted by War Room.
				if !s.Sources[i].LastObservedAt.IsZero() && !src.LastObservedAt.IsZero() && src.LastObservedAt.Before(s.Sources[i].LastObservedAt) {
					return nil
				}
				s.Sources[i] = src
				found = true
				break
			}
		}
		if !found {
			s.Sources = append(s.Sources, src)
		}
		*s = summarizeAgentsAt(*s, stale, a.nowUTC())
		return nil
	})
}

func (a *App) upsertAgent(x AgentSession) error {
	if strings.TrimSpace(x.ID) == "" {
		return errors.New("agent id is required")
	}
	if strings.TrimSpace(x.Name) == "" {
		x.Name = x.ID
	}
	if x.Kind == "" {
		x.Kind = "agent"
	}
	if x.Provider == "" {
		x.Provider = "Agent Bridge"
	}
	if x.Source == "" {
		x.Source = "agent heartbeat"
	}
	if x.LastHeartbeat.IsZero() {
		x.LastHeartbeat = a.nowUTC()
	}
	x.State = normalizeAgentState(x.State)
	if x.Progress < 0 {
		x.Progress = 0
	}
	if x.Progress > 1 {
		x.Progress = 1
	}
	stale := time.Duration(a.store.getSettings().AgentStaleSeconds) * time.Second
	return a.store.mutateAgents(func(s *AgentSnapshot) error {
		found := false
		for i := range s.Sessions {
			if s.Sessions[i].ID == x.ID {
				old := s.Sessions[i]
				// Once an agent starts publishing an ordered heartbeat sequence, the
				// projection becomes fail-closed for sequence-less, duplicate, and
				// late heartbeats. This prevents network reordering from regressing
				// CurrentAction/progress/state back to older truth.
				if old.Sequence > 0 && (x.Sequence == 0 || x.Sequence <= old.Sequence) {
					return nil
				}
				if x.StartedAt.IsZero() {
					x.StartedAt = old.StartedAt
				}
				s.Sessions[i] = x
				found = true
				break
			}
		}
		if !found {
			s.Sessions = append(s.Sessions, x)
		}
		*s = summarizeAgentsAt(*s, stale, a.nowUTC())
		return nil
	})
}

func (a *App) addAgentEvent(ev AgentEvent) error {
	now := a.nowUTC()
	if ev.Timestamp.IsZero() {
		ev.Timestamp = now
	}
	if ev.Timestamp.After(now.Add(5 * time.Minute)) {
		return errors.New("future timestamp exceeds 5 minute tolerance")
	}
	if ev.Source == "" {
		ev.Source = "Agent Bridge"
	}
	if ev.ID == "" {
		h := sha256.Sum256([]byte(ev.Source + "\x00" + ev.AgentID + "\x00" + ev.Kind + "\x00" + ev.Title + "\x00" + ev.Timestamp.Format(time.RFC3339Nano)))
		ev.ID = hex.EncodeToString(h[:8])
	}
	stale := time.Duration(a.store.getSettings().AgentStaleSeconds) * time.Second
	return a.store.mutateAgents(func(s *AgentSnapshot) error {
		for _, old := range s.Events {
			if old.ID == ev.ID {
				return nil
			}
		}
		s.Events = append(s.Events, ev)
		*s = summarizeAgentsAt(*s, stale, a.nowUTC())
		return nil
	})
}

func (a *App) ensureAgentBridgeToken() string {
	if v, err := a.vault.Get("agents.bridge_token"); err == nil && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	t := randomToken()
	_ = a.vault.Set("agents.bridge_token", t)
	return t
}

func (a *App) agentBridgeAllowed(r *http.Request) bool {
	token := a.ensureAgentBridgeToken()
	got := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
	return got != "" && subtleTokenEqual(got, token)
}

func subtleTokenEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	var v byte
	for i := 0; i < len(a); i++ {
		v |= a[i] ^ b[i]
	}
	return v == 0
}
