package main

import (
	"fmt"
	"strings"
	"time"
)

type ConnectorState struct {
	ID                   string    `json:"id"`
	State                string    `json:"state"`
	Since                time.Time `json:"since"`
	StableSince          time.Time `json:"stableSince,omitempty"`
	LastObservedAt       time.Time `json:"lastObservedAt,omitempty"`
	ErrorClass           string    `json:"errorClass,omitempty"`
	ConsecutiveFailures  int       `json:"consecutiveFailures,omitempty"`
	LastSuccessAt        time.Time `json:"lastSuccessAt,omitempty"`
	LastFailureAt        time.Time `json:"lastFailureAt,omitempty"`
	LastRecoveryMs       int64     `json:"lastRecoveryMs,omitempty"`
	LastTransitionReason string    `json:"lastTransitionReason,omitempty"`
}

var connectorStates = map[string]bool{"disconnected": true, "connecting": true, "live": true, "degraded": true, "stale": true}

var connectorTransitions = map[string]map[string]bool{
	"":             {"disconnected": true, "connecting": true, "live": true, "degraded": true, "stale": true},
	"disconnected": {"disconnected": true, "connecting": true, "live": true, "degraded": true},
	"connecting":   {"connecting": true, "live": true, "degraded": true, "disconnected": true},
	"live":         {"live": true, "connecting": true, "degraded": true, "stale": true, "disconnected": true},
	"degraded":     {"degraded": true, "connecting": true, "live": true, "stale": true, "disconnected": true},
	"stale":        {"stale": true, "connecting": true, "live": true, "degraded": true, "disconnected": true},
}

func normalizeConnectorState(v string) string {
	v = strings.ToLower(strings.TrimSpace(v))
	if connectorStates[v] {
		return v
	}
	return "degraded"
}

func connectorTransitionAllowed(from, to string) bool {
	allowed, ok := connectorTransitions[from]
	return ok && allowed[to]
}

func (a *App) transitionConnector(id, state, errClass, reason string) error {
	id = strings.TrimSpace(id)
	if id == "" {
		return fmt.Errorf("connector id is required")
	}
	now := a.nowUTC()
	state = normalizeConnectorState(state)
	reason = strings.TrimSpace(reason)
	if reason == "" {
		reason = "unspecified"
	}

	a.connectorMu.Lock()
	if a.connectors == nil {
		a.connectors = map[string]ConnectorState{}
	}
	prev := a.connectors[id]
	if !connectorTransitionAllowed(prev.State, state) {
		a.connectorMu.Unlock()
		return fmt.Errorf("invalid connector transition %s: %s -> %s", id, prev.State, state)
	}
	before := prev.State
	beforeSince := prev.Since
	if prev.ID == "" {
		prev.ID = id
		prev.Since = now
		beforeSince = now
	}
	if prev.State != state {
		prev.State = state
		prev.Since = now
	}
	prev.ErrorClass = errClass
	prev.LastTransitionReason = reason
	if state == "live" {
		if before != "live" {
			if !beforeSince.IsZero() && (before == "degraded" || before == "stale" || before == "connecting") {
				d := now.Sub(beforeSince)
				if d < 0 {
					d = 0
				}
				prev.LastRecoveryMs = d.Milliseconds()
			}
			prev.StableSince = now
		} else if prev.StableSince.IsZero() {
			prev.StableSince = prev.Since
		}
		prev.LastObservedAt = now
		prev.LastSuccessAt = now
		prev.ConsecutiveFailures = 0
	} else if state == "degraded" || state == "stale" {
		if before == "live" && before != state {
			prev.StableSince = time.Time{}
		}
		prev.LastFailureAt = now
		prev.ConsecutiveFailures++
	} else if before == "live" && before != state {
		prev.StableSince = time.Time{}
	}
	a.connectors[id] = prev
	a.connectorMu.Unlock()

	if before != state {
		a.recordDiagnosticEvent("connector.transition", id, before+"->"+state, reason, errClass)
	}
	return nil
}

// setConnectorState remains as the compatibility wrapper for existing call sites.
// All connector mutations still flow through the transition invariant above.
func (a *App) setConnectorState(id, state, errClass string) {
	_ = a.transitionConnector(id, state, errClass, "runtime-observation")
}

func (a *App) connectorSnapshot() map[string]ConnectorState {
	a.connectorMu.RLock()
	defer a.connectorMu.RUnlock()
	out := make(map[string]ConnectorState, len(a.connectors))
	for k, v := range a.connectors {
		out[k] = v
	}
	return out
}
