package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func (a *App) answerWithOllama(ctx context.Context, query string, st AssistantStatus) (string, error) {
	base, err := validHTTPBase(st.OllamaURL)
	if err != nil {
		return "", err
	}
	contextJSON, _ := json.Marshal(a.assistantContext())
	prompt := "You are the local Aftergraph War Room assistant. Answer only from the JSON system context below. If the context does not support a claim, explicitly say it is unobserved. Never claim authority, execution, verification, or health beyond the evidence. Be concise.\n\nSYSTEM CONTEXT:\n" + string(contextJSON) + "\n\nUSER:\n" + query
	body, _ := json.Marshal(map[string]any{"model": st.LocalModel, "stream": false, "messages": []map[string]string{{"role": "user", "content": prompt}}, "options": map[string]any{"temperature": 0.1}})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/chat", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	doer := a.assistantHTTP
	if doer == nil {
		doer = &http.Client{Timeout: 10 * time.Second}
	}
	resp, err := doer.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<10))
		return "", fmt.Errorf("ollama HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var out struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Message.Content), nil
}

func (a *App) assistantContext() map[string]any {
	gh := a.store.getGitHub()
	agents := a.agentSnapshot()
	latest := latestWorkflowRuns(gh.WorkflowRuns)
	if len(latest) > 20 {
		latest = latest[:20]
	}
	acts := gh.Activities
	if len(acts) > 20 {
		acts = acts[:20]
	}
	return map[string]any{
		"observed_at":        a.nowUTC().Format(time.RFC3339),
		"github":             map[string]any{"source": gh.Source, "authenticated": gh.Authenticated, "repos": len(gh.Repos), "commits_24h": gh.Commits24h, "open_prs": gh.OpenPRs, "open_issues": gh.OpenIssues, "activities": acts, "latest_workflows": latest},
		"agents":             agents,
		"typesafe":           a.getTypeSafeDecision(),
		"intelligence_top":   a.intel.Evaluate(gh, a.store.getProbes(), a.store.getSettings()).Top,
		"service_probes":     a.store.getProbes(),
		"epistemic_boundary": "Unknown is not healthy. Model output is not evidence. No assistant output grants authority or constitutes verification.",
	}
}
