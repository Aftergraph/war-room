package main

import (
	"context"
	"net/http"
	"time"
)

func runProbes(ctx context.Context, configs []ProbeConfig) []ProbeResult {
	return runProbesWithDoer(ctx, configs, &http.Client{Timeout: 8 * time.Second})
}

func runProbesWithDoer(ctx context.Context, configs []ProbeConfig, client httpDoer) []ProbeResult {
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	out := make([]ProbeResult, 0, len(configs))
	for _, p := range configs {
		if !p.Enabled {
			continue
		}
		start := time.Now()
		r := ProbeResult{ID: p.ID, Name: p.Name, URL: p.URL, Domain: p.Domain, ObservedAt: time.Now().UTC(), Status: "unknown"}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.URL, nil)
		if err != nil {
			r.Status = "error"
			r.Error = err.Error()
			out = append(out, r)
			continue
		}
		req.Header.Set("User-Agent", "Aftergraph-War-Room-Probe/1.0")
		resp, err := client.Do(req)
		r.LatencyMs = time.Since(start).Milliseconds()
		if err != nil {
			r.Status = "down"
			r.Error = err.Error()
			out = append(out, r)
			continue
		}
		r.HTTPStatus = resp.StatusCode
		_ = resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 400 {
			r.Status = "up"
		} else {
			r.Status = "degraded"
		}
		out = append(out, r)
	}
	return out
}
