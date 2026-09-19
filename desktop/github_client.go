package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type GitHubClient struct {
	token          string
	http           httpDoer
	rateMu         sync.Mutex
	rateRemaining  int
	rateReset      time.Time
	requestCount   int
	retryCount     int
	backoffCount   int
	lastErrorClass string
	wait           func(context.Context, time.Duration) error
	now            func() time.Time
}

func newGitHubClient(token string) *GitHubClient {
	return newGitHubClientWithDoer(token, &http.Client{Timeout: 18 * time.Second})
}

func newGitHubClientWithDoer(token string, doer httpDoer) *GitHubClient {
	if doer == nil {
		doer = &http.Client{Timeout: 18 * time.Second}
	}
	return &GitHubClient{token: token, http: doer, wait: waitForRetry, now: time.Now}
}

func (g *GitHubClient) req(ctx context.Context, path string, out any) error {
	const attempts = 3
	policy := retryPolicy{Attempts: attempts, BaseWait: 120 * time.Millisecond, MaxWait: 2 * time.Second}
	var lastErr error
	for attempt := 0; attempt < attempts; attempt++ {
		g.rateMu.Lock()
		g.requestCount++
		g.rateMu.Unlock()
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com"+path, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
		req.Header.Set("User-Agent", "Aftergraph-War-Room/1.6")
		if g.token != "" {
			req.Header.Set("Authorization", "Bearer "+g.token)
		}
		resp, err := g.http.Do(req)
		if err != nil {
			lastErr = err
			g.recordProviderError("network")
			if attempt+1 < attempts && retryableNetworkError(err) {
				g.recordRetry()
				wait := g.wait
				if wait == nil {
					wait = waitForRetry
				}
				if err := wait(ctx, retryDelay(nil, attempt, policy)); err != nil {
					return err
				}
				continue
			}
			return err
		}
		g.rateMu.Lock()
		if x := resp.Header.Get("X-RateLimit-Remaining"); x != "" {
			g.rateRemaining, _ = strconv.Atoi(x)
		}
		if x := resp.Header.Get("X-RateLimit-Reset"); x != "" {
			if n, e := strconv.ParseInt(x, 10, 64); e == nil {
				g.rateReset = time.Unix(n, 0).UTC()
			}
		}
		g.rateMu.Unlock()
		b, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		_ = resp.Body.Close()
		if readErr != nil {
			return readErr
		}
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("GitHub %s: %s", resp.Status, strings.TrimSpace(string(b)))
			g.recordProviderError(classifyHTTPStatus(resp.StatusCode))
			if attempt+1 < attempts && retryableGETStatus(resp.StatusCode) {
				g.recordRetry()
				wait := g.wait
				if wait == nil {
					wait = waitForRetry
				}
				if err := wait(ctx, retryDelay(resp, attempt, policy)); err != nil {
					return err
				}
				continue
			}
			return lastErr
		}
		if out != nil {
			if err := json.Unmarshal(b, out); err != nil {
				return err
			}
		}
		return nil
	}
	return lastErr
}

func (g *GitHubClient) validate(ctx context.Context) (string, error) {
	var u struct {
		Login string `json:"login"`
	}
	if err := g.req(ctx, "/user", &u); err != nil {
		return "", err
	}
	return u.Login, nil
}

func (g *GitHubClient) recordRetry() {
	g.rateMu.Lock()
	g.retryCount++
	g.backoffCount++
	g.rateMu.Unlock()
}

func (g *GitHubClient) recordProviderError(class string) {
	g.rateMu.Lock()
	g.lastErrorClass = class
	g.rateMu.Unlock()
}

func classifyHTTPStatus(status int) string {
	switch {
	case status == http.StatusTooManyRequests:
		return "rate-limit"
	case status >= 500:
		return "server"
	case status == http.StatusUnauthorized || status == http.StatusForbidden:
		return "auth"
	case status >= 400:
		return "client"
	default:
		return ""
	}
}
