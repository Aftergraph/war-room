package main

import (
	"context"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
)

func (g *GitHubClient) syncWorkflows(ctx context.Context, s *GitHubSnapshot, cap int) {
	if cap < 1 {
		return
	}
	if cap > len(s.Repos) {
		cap = len(s.Repos)
	}
	var mu sync.Mutex
	sem := make(chan struct{}, 6)
	var wg sync.WaitGroup
	for i := 0; i < cap; i++ {
		r := s.Repos[i]
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			var x struct {
				Runs []struct {
					Name       string    `json:"name"`
					Event      string    `json:"event"`
					Status     string    `json:"status"`
					Conclusion string    `json:"conclusion"`
					HeadBranch string    `json:"head_branch"`
					HeadSHA    string    `json:"head_sha"`
					HTMLURL    string    `json:"html_url"`
					CreatedAt  time.Time `json:"created_at"`
					UpdatedAt  time.Time `json:"updated_at"`
				} `json:"workflow_runs"`
			}
			if err := g.req(ctx, "/repos/"+url.PathEscape(strings.Split(r.FullName, "/")[0])+"/"+url.PathEscape(r.Name)+"/actions/runs?per_page=5", &x); err != nil {
				return
			}
			mu.Lock()
			for _, w := range x.Runs {
				s.WorkflowRuns = append(s.WorkflowRuns, WorkflowRun{Repo: r.Name, Name: w.Name, Event: w.Event, Status: w.Status, Conclusion: w.Conclusion, Branch: w.HeadBranch, SHA: shortSHA(w.HeadSHA), URL: w.HTMLURL, CreatedAt: w.CreatedAt, UpdatedAt: w.UpdatedAt})
			}
			mu.Unlock()
		}()
	}
	wg.Wait()
	sort.Slice(s.WorkflowRuns, func(i, j int) bool { return s.WorkflowRuns[i].CreatedAt.After(s.WorkflowRuns[j].CreatedAt) })
	if len(s.WorkflowRuns) > 100 {
		s.WorkflowRuns = s.WorkflowRuns[:100]
	}
	clock := time.Now
	if g.now != nil {
		clock = g.now
	}
	cut := clock().Add(-24 * time.Hour)
	for _, w := range s.WorkflowRuns {
		if w.CreatedAt.Before(cut) {
			continue
		}
		switch w.Conclusion {
		case "success":
			s.CISuccess24h++
		case "failure", "cancelled", "timed_out", "action_required", "startup_failure":
			s.CIFailure24h++
		}
	}
}
