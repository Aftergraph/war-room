package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"
)

func (g *GitHubClient) sync(ctx context.Context, org string, cfg Settings) GitHubSnapshot {
	mode := "credentialed-rest"
	if g.token == "" {
		mode = "public-rate-limited-rest"
	}
	now := time.Now
	if g.now != nil {
		now = g.now
	}
	s := GitHubSnapshot{ObservedAt: now().UTC(), Source: "GitHub REST API", Authenticated: g.token != "", ReconcileSeconds: cfg.RefreshSeconds, ObservationMode: mode}
	if g.token != "" {
		if login, err := g.validate(ctx); err == nil {
			s.Identity = login
		} else {
			s.Errors = append(s.Errors, "identity: "+err.Error())
		}
	}
	var repos []struct {
		Name          string    `json:"name"`
		FullName      string    `json:"full_name"`
		Private       bool      `json:"private"`
		Archived      bool      `json:"archived"`
		DefaultBranch string    `json:"default_branch"`
		HTMLURL       string    `json:"html_url"`
		UpdatedAt     time.Time `json:"updated_at"`
		PushedAt      time.Time `json:"pushed_at"`
		OpenIssues    int       `json:"open_issues_count"`
		Stars         int       `json:"stargazers_count"`
		Visibility    string    `json:"visibility"`
		Owner         struct {
			Login string `json:"login"`
		} `json:"owner"`
	}
	path := "/orgs/" + url.PathEscape(org) + "/repos?per_page=100&type=all&sort=updated"
	if err := g.req(ctx, path, &repos); err != nil {
		s.Errors = append(s.Errors, "repos: "+err.Error())
	} else {
		for _, r := range repos {
			d := inferDomain(r.Name)
			if x := cfg.RepoDomains[r.Name]; x != "" {
				d = x
			}
			s.Repos = append(s.Repos, Repo{Name: r.Name, FullName: r.FullName, Private: r.Private, Visibility: r.Visibility, Archived: r.Archived, DefaultBranch: r.DefaultBranch, HTMLURL: r.HTMLURL, UpdatedAt: r.UpdatedAt, PushedAt: r.PushedAt, OpenIssues: r.OpenIssues, Stars: r.Stars, Domain: d, Source: "GitHub live"})
		}
	}
	if g.token != "" {
		// User-repo inventory catches private organization repositories not returned by org listing for some token setups.
		var ur []struct {
			Name          string    `json:"name"`
			FullName      string    `json:"full_name"`
			Private       bool      `json:"private"`
			Archived      bool      `json:"archived"`
			DefaultBranch string    `json:"default_branch"`
			HTMLURL       string    `json:"html_url"`
			UpdatedAt     time.Time `json:"updated_at"`
			PushedAt      time.Time `json:"pushed_at"`
			OpenIssues    int       `json:"open_issues_count"`
			Stars         int       `json:"stargazers_count"`
			Visibility    string    `json:"visibility"`
			Owner         struct {
				Login string `json:"login"`
			} `json:"owner"`
		}
		if err := g.req(ctx, "/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=updated", &ur); err == nil {
			seen := map[string]bool{}
			for _, r := range s.Repos {
				seen[strings.ToLower(r.FullName)] = true
			}
			for _, r := range ur {
				if !strings.EqualFold(r.Owner.Login, org) || seen[strings.ToLower(r.FullName)] {
					continue
				}
				d := inferDomain(r.Name)
				if x := cfg.RepoDomains[r.Name]; x != "" {
					d = x
				}
				s.Repos = append(s.Repos, Repo{Name: r.Name, FullName: r.FullName, Private: r.Private, Visibility: r.Visibility, Archived: r.Archived, DefaultBranch: r.DefaultBranch, HTMLURL: r.HTMLURL, UpdatedAt: r.UpdatedAt, PushedAt: r.PushedAt, OpenIssues: r.OpenIssues, Stars: r.Stars, Domain: d, Source: "GitHub live"})
			}
		}
	}
	sort.Slice(s.Repos, func(i, j int) bool { return s.Repos[i].PushedAt.After(s.Repos[j].PushedAt) })
	g.syncSearches(ctx, org, &s)
	g.syncWorkflows(ctx, &s, cfg.WorkflowRepoCap)
	g.rateMu.Lock()
	s.RateLimitRemaining = g.rateRemaining
	s.RateLimitReset = g.rateReset
	s.RequestCount = g.requestCount
	s.RetryCount = g.retryCount
	s.BackoffCount = g.backoffCount
	s.LastErrorClass = g.lastErrorClass
	g.rateMu.Unlock()
	return s
}

func (g *GitHubClient) syncSearches(ctx context.Context, org string, s *GitHubSnapshot) {
	clock := time.Now
	if g.now != nil {
		clock = g.now
	}
	now := clock().UTC()
	d1 := now.Add(-24 * time.Hour).Format("2006-01-02")
	d7 := now.Add(-7 * 24 * time.Hour).Format("2006-01-02")
	type issueItem struct {
		HTMLURL   string    `json:"html_url"`
		Title     string    `json:"title"`
		State     string    `json:"state"`
		UpdatedAt time.Time `json:"updated_at"`
		User      struct {
			Login string `json:"login"`
		} `json:"user"`
		RepositoryURL string           `json:"repository_url"`
		PullRequest   *json.RawMessage `json:"pull_request"`
	}
	type issueSearch struct {
		Total int         `json:"total_count"`
		Items []issueItem `json:"items"`
	}
	q := func(raw string, out any) error {
		return g.req(ctx, "/search/issues?q="+url.QueryEscape(raw)+"&sort=updated&order=desc&per_page=50", out)
	}
	var prs issueSearch
	if err := q("org:"+org+" is:pr is:open", &prs); err == nil {
		s.OpenPRs = prs.Total
	} else {
		s.Errors = append(s.Errors, "open PRs: "+err.Error())
	}
	var issues issueSearch
	if err := q("org:"+org+" is:issue is:open", &issues); err == nil {
		s.OpenIssues = issues.Total
	} else {
		s.Errors = append(s.Errors, "open issues: "+err.Error())
	}
	var recentPR issueSearch
	if err := q("org:"+org+" is:pr updated:>="+d1, &recentPR); err == nil {
		s.PRsUpdated24h = recentPR.Total
		for _, it := range recentPR.Items {
			s.Activities = append(s.Activities, ActivityItem{Type: "pull_request", Repo: repoFromAPI(it.RepositoryURL), Title: it.Title, Actor: it.User.Login, State: it.State, URL: it.HTMLURL, Timestamp: it.UpdatedAt})
		}
	}
	var recentIssue issueSearch
	if err := q("org:"+org+" is:issue updated:>="+d1, &recentIssue); err == nil {
		s.IssuesUpdated24h = recentIssue.Total
		for _, it := range recentIssue.Items {
			s.Activities = append(s.Activities, ActivityItem{Type: "issue", Repo: repoFromAPI(it.RepositoryURL), Title: it.Title, Actor: it.User.Login, State: it.State, URL: it.HTMLURL, Timestamp: it.UpdatedAt})
		}
	}
	type commitItem struct {
		SHA        string `json:"sha"`
		HTMLURL    string `json:"html_url"`
		Repository struct {
			Name string `json:"name"`
		} `json:"repository"`
		Commit struct {
			Message   string `json:"message"`
			Committer struct {
				Name string    `json:"name"`
				Date time.Time `json:"date"`
			} `json:"committer"`
		} `json:"commit"`
		Author *struct {
			Login string `json:"login"`
		} `json:"author"`
	}
	type commitSearch struct {
		Total int          `json:"total_count"`
		Items []commitItem `json:"items"`
	}
	cq := func(date string, out *commitSearch) error {
		return g.req(ctx, "/search/commits?q="+url.QueryEscape("org:"+org+" committer-date:>="+date)+"&sort=committer-date&order=desc&per_page=50", out)
	}
	var c1 commitSearch
	if err := cq(d1, &c1); err == nil {
		s.Commits24h = c1.Total
		for _, it := range c1.Items {
			actor := it.Commit.Committer.Name
			if it.Author != nil && it.Author.Login != "" {
				actor = it.Author.Login
			}
			title := strings.Split(it.Commit.Message, "\n")[0]
			s.Activities = append(s.Activities, ActivityItem{Type: "commit", Repo: it.Repository.Name, Title: title, Actor: actor, URL: it.HTMLURL, Timestamp: it.Commit.Committer.Date, SHA: shortSHA(it.SHA)})
		}
	} else {
		s.Errors = append(s.Errors, "commits24h: "+err.Error())
	}
	var c7 commitSearch
	if err := cq(d7, &c7); err == nil {
		s.Commits7d = c7.Total
	}
	sort.Slice(s.Activities, func(i, j int) bool { return s.Activities[i].Timestamp.After(s.Activities[j].Timestamp) })
	if len(s.Activities) > 80 {
		s.Activities = s.Activities[:80]
	}
}

func repoFromAPI(u string) string {
	parts := strings.Split(strings.TrimRight(u, "/"), "/")
	if len(parts) > 0 {
		return parts[len(parts)-1]
	}
	return ""
}
func shortSHA(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}

// mergePublicSnapshot preserves the last observed private inventory when a GitHub
// sync is running without credentials. Public activity and repository state remain
// live, while private repositories retain explicit snapshot provenance instead of
// silently disappearing from the organization topology.
func mergePublicSnapshot(previous, live GitHubSnapshot) GitHubSnapshot {
	if live.Authenticated {
		return live
	}
	seen := make(map[string]bool, len(live.Repos))
	for _, r := range live.Repos {
		seen[strings.ToLower(r.FullName)] = true
	}
	retained := 0
	for _, r := range previous.Repos {
		if !r.Private || seen[strings.ToLower(r.FullName)] {
			continue
		}
		if r.Source == "" {
			r.Source = "retained private snapshot"
		} else if !strings.Contains(r.Source, "retained") {
			r.Source += " · retained while public-only"
		}
		live.Repos = append(live.Repos, r)
		retained++
	}
	if retained > 0 {
		live.Errors = append(live.Errors, fmt.Sprintf("%d private repositories retained from prior authenticated/bootstrap observation; connect GitHub for live private state", retained))
	}
	sort.Slice(live.Repos, func(i, j int) bool {
		if live.Repos[i].PushedAt.Equal(live.Repos[j].PushedAt) {
			return live.Repos[i].Name < live.Repos[j].Name
		}
		return live.Repos[i].PushedAt.After(live.Repos[j].PushedAt)
	})
	return live
}

func publicSyncConfig(cfg Settings) Settings {
	// Unauthenticated GitHub REST is limited to roughly 60 requests/hour. A full
	// organization reconciliation uses multiple search calls, so public mode is
	// intentionally slower rather than pretending to be live and exhausting the
	// provider budget after a few minutes.
	if cfg.WorkflowRepoCap > 5 {
		cfg.WorkflowRepoCap = 5
	}
	if cfg.RefreshSeconds < 900 {
		cfg.RefreshSeconds = 900
	}
	return cfg
}
