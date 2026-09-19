package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

func validateWorks(ctx context.Context, base, token string) error {
	return validateWorksWithDoer(ctx, base, token, &http.Client{Timeout: 7 * time.Second})
}

func validateWorksWithDoer(ctx context.Context, base, token string, doer httpDoer) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/ui", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if doer == nil {
		doer = &http.Client{Timeout: 7 * time.Second}
	}
	resp, err := doer.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}

func (a *App) worksLoop(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}
		cfg := a.store.getSettings()
		if !cfg.WorksEnabled || strings.TrimSpace(cfg.WorksURL) == "" {
			a.updateAgentSource(AgentSourceStatus{ID: "works", Name: "WORKS execution fabric", Kind: "works-sse", URL: cfg.WorksURL, Status: "disabled"})
			a.setConnectorState("works", "disconnected", "")
			if !a.waitDuration(ctx, 4*time.Second) {
				return
			}
			continue
		}
		base, err := validHTTPBase(cfg.WorksURL)
		if err != nil {
			a.updateAgentSource(AgentSourceStatus{ID: "works", Name: "WORKS execution fabric", Kind: "works-sse", URL: cfg.WorksURL, Status: "error", Error: err.Error()})
			a.setConnectorState("works", "degraded", "config")
			if !a.waitDuration(ctx, 5*time.Second) {
				return
			}
			continue
		}
		token, _ := a.vault.Get("works.token")
		a.setConnectorState("works", "connecting", "")
		err = a.consumeWorksEvents(ctx, base, token)
		if ctx.Err() != nil {
			return
		}
		a.updateAgentSource(AgentSourceStatus{ID: "works", Name: "WORKS execution fabric", Kind: "works-sse", URL: base, Status: "reconnecting", Error: errorString(err)})
		a.setConnectorState("works", "degraded", classifyProviderError(err))
		if !a.waitDuration(ctx, 3*time.Second) {
			return
		}
	}
}

func errorString(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func (a *App) consumeWorksEvents(ctx context.Context, base, token string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/v1/ui/events", nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Accept", "text/event-stream")
	doer := a.worksHTTP
	if doer == nil {
		doer = &http.Client{Timeout: 0}
	}
	resp, err := doer.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 16<<10))
		return fmt.Errorf("WORKS SSE HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	a.updateAgentSource(AgentSourceStatus{ID: "works", Name: "WORKS execution fabric", Kind: "works-sse", URL: base, Status: "live", LastObservedAt: a.nowUTC()})
	a.setConnectorState("works", "live", "")
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 4096), 512<<10)
	var eventName string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			eventName = ""
			continue
		}
		if strings.HasPrefix(line, "event:") {
			eventName = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" {
			continue
		}
		a.consumeWorksFrame(base, eventName, []byte(data))
	}
	return scanner.Err()
}

func stringField(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			s := strings.TrimSpace(fmt.Sprint(v))
			if s != "" && s != "<nil>" {
				return s
			}
		}
	}
	return ""
}

func boolField(m map[string]any, k string) bool {
	v, ok := m[k]
	if !ok {
		return false
	}
	b, _ := strconv.ParseBool(fmt.Sprint(v))
	return b
}

func (a *App) consumeWorksFrame(base, eventName string, raw []byte) {
	var m map[string]any
	if json.Unmarshal(raw, &m) != nil {
		return
	}
	now := a.nowUTC()
	switch eventName {
	case "runner":
		id := stringField(m, "id", "worker_id", "runner_id")
		if id == "" {
			return
		}
		state := stringField(m, "state", "status")
		if boolField(m, "stale") {
			state = "stale"
		}
		if state == "" {
			state = "waiting"
		}
		x := AgentSession{ID: "works:" + id, Name: id, Kind: "worker", Provider: "WORKS", Node: stringField(m, "pool", "node", "hostname"), State: state, CurrentAction: stringField(m, "current_work", "work_id", "lease_id"), WorkID: stringField(m, "work_id"), LastHeartbeat: now, Source: "WORKS /v1/ui/events", URL: base + "/v1/ui/runners"}
		_ = a.upsertAgent(x)
		a.updateAgentSource(AgentSourceStatus{ID: "works", Name: "WORKS execution fabric", Kind: "works-sse", URL: base, Status: "live", LastObservedAt: now})
		a.broadcast("agents")
	case "work":
		id := stringField(m, "id", "work_id")
		state := stringField(m, "state", "status")
		title := "WORKS work changed"
		if id != "" {
			title = id + " → " + state
		}
		_ = a.addAgentEvent(AgentEvent{ID: "works:" + id + ":" + state + ":" + now.Format("150405.000"), Kind: "work", Title: title, State: state, Repo: stringField(m, "repo", "repository"), WorkID: id, Timestamp: now, Source: "WORKS", URL: base + "/v1/ui"})
		a.broadcast("agents")
	}
}
