package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTypeSafeEvaluateTypedDecision(t *testing.T) {
	old := typeSafeEndpoint
	defer func() { typeSafeEndpoint = old }()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("auth = %q", got)
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		qs, ok := body["questions"].(map[string]any)
		if !ok || len(qs) != 5 {
			t.Fatalf("questions=%#v", body["questions"])
		}
		json.NewEncoder(w).Encode(map[string]any{
			"model": "jev-test",
			"answers": map[string]any{
				"attention_route":      map[string]any{"type": "choice", "choice": "human_review", "confidence": 0.91, "probabilities": map[string]float64{"human_review": 0.91, "monitor": 0.09}},
				"human_review_needed":  map[string]any{"type": "noul", "noul": 0.87},
				"evidence_sufficient":  map[string]any{"type": "noul", "noul": 0.78},
				"dominant_signal":      map[string]any{"type": "choice", "choice": "ci_failure", "confidence": 0.89, "probabilities": map[string]float64{"ci_failure": 0.89, "none": 0.11}},
				"operational_severity": map[string]any{"type": "score", "score": 2.1, "confidence": 0.82, "legend": map[string]string{"0": "Nominal", "1": "Watch", "2": "Degraded", "3": "Critical"}, "probabilities": map[string]float64{"2": 0.8, "3": 0.2}},
			},
			"usage": map[string]int{"input_tokens": 123, "output_tokens": 7},
		})
	}))
	defer srv.Close()
	typeSafeEndpoint = srv.URL
	got, err := newTypeSafeClient("test-key").evaluate(context.Background(), map[string]any{"needs_you": 1})
	if err != nil {
		t.Fatal(err)
	}
	if got.Route != "human_review" || got.HumanNeeded != 0.87 || got.EvidenceSufficient != 0.78 || got.DominantSignal != "ci_failure" || got.Model != "jev-test" {
		t.Fatalf("unexpected %#v", got)
	}
	if got.InputTokens != 123 || got.OutputTokens != 7 {
		t.Fatalf("usage %#v", got)
	}
}

func TestTypeSafeMissingKeyFailsClosed(t *testing.T) {
	_, err := newTypeSafeClient("").evaluate(context.Background(), "state")
	if err == nil {
		t.Fatal("expected missing-key error")
	}
}

func TestTypeSafeEvaluateRequiresSessionCapability(t *testing.T) {
	dir := t.TempDir()
	app, err := newApp(dir)
	if err != nil {
		t.Fatal(err)
	}
	req := loopbackTestRequest(http.MethodPost, "/api/typesafe/evaluate", nil)
	rr := httptest.NewRecorder()
	app.routes().ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("status=%d want 403", rr.Code)
	}
}

func TestNativeTypeSafeAutoEvaluationIsFingerprintBounded(t *testing.T) {
	old := typeSafeEndpoint
	defer func() { typeSafeEndpoint = old }()
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		json.NewEncoder(w).Encode(map[string]any{
			"model": "jev-test",
			"answers": map[string]any{
				"attention_route":      map[string]any{"type": "choice", "choice": "monitor", "confidence": 0.8, "probabilities": map[string]float64{"monitor": 0.8, "no_action": 0.2}},
				"human_review_needed":  map[string]any{"type": "noul", "noul": 0.25},
				"evidence_sufficient":  map[string]any{"type": "noul", "noul": 0.85},
				"dominant_signal":      map[string]any{"type": "choice", "choice": "change_risk", "confidence": 0.72, "probabilities": map[string]float64{"change_risk": 0.72, "none": 0.28}},
				"operational_severity": map[string]any{"type": "score", "score": 1.0, "confidence": 0.75, "legend": map[string]string{"0": "Nominal", "1": "Watch"}, "probabilities": map[string]float64{"1": 0.75, "0": 0.25}},
			},
		})
	}))
	defer srv.Close()
	typeSafeEndpoint = srv.URL

	app, err := newApp(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if err := app.vault.Set("typesafe.api_key", "test-key"); err != nil {
		t.Fatal(err)
	}
	first := app.maybeTypeSafeEvaluate(context.Background(), false, "test-auto")
	if first.Mode != "native-auto" || first.Route != "monitor" || first.CallsToday != 1 {
		t.Fatalf("unexpected first decision %#v", first)
	}
	second := app.maybeTypeSafeEvaluate(context.Background(), false, "test-auto")
	if calls != 1 || second.CallsToday != 1 || second.Fingerprint != first.Fingerprint {
		t.Fatalf("dedupe failed calls=%d first=%#v second=%#v", calls, first, second)
	}
}
