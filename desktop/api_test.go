package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func testApp(t *testing.T) *App {
	t.Helper()
	a, err := newApp(filepath.Join(t.TempDir(), "warroom"))
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestSummaryRouteReturnsBootstrapRealityAndSecurityHeaders(t *testing.T) {
	a := testApp(t)
	r := loopbackTestRequest(http.MethodGet, "/api/summary", nil)
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Content-Security-Policy"); !strings.Contains(got, "default-src 'self'") {
		t.Fatalf("missing strict CSP: %q", got)
	}
	if got := w.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options=%q", got)
	}
	var s Summary
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	if len(s.GitHub.Repos) != 33 {
		t.Fatalf("repos=%d want=33", len(s.GitHub.Repos))
	}
	if len(s.Domains) != len(canonicalDomains) {
		t.Fatalf("domains=%d want=%d", len(s.Domains), len(canonicalDomains))
	}
}

func TestMutationRequiresPerRunSessionCapability(t *testing.T) {
	a := testApp(t)
	body := `{"name":"VSR","value":0.84,"unit":"ratio","domain":"Evidence & Verification","source":"test"}`

	r := loopbackTestRequest(http.MethodPost, "/api/metrics", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("without capability status=%d want=403", w.Code)
	}

	r = loopbackTestRequest(http.MethodPost, "/api/metrics", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-WarRoom-Session", a.session)
	w = httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusCreated {
		t.Fatalf("with capability status=%d body=%s", w.Code, w.Body.String())
	}
	if got := a.store.getMetrics(); len(got) != 1 || got[0].ObservedAt.IsZero() {
		t.Fatalf("metric not persisted with evidence timestamp: %+v", got)
	}
}

func TestIntelligenceSummaryAndFeedbackBoundary(t *testing.T) {
	a := testApp(t)
	r := loopbackTestRequest(http.MethodGet, "/api/intelligence", nil)
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("intelligence GET status=%d body=%s", w.Code, w.Body.String())
	}
	var intel IntelligenceSummary
	if err := json.Unmarshal(w.Body.Bytes(), &intel); err != nil {
		t.Fatal(err)
	}
	if intel.Version != "operational-intelligence/0.1" {
		t.Fatalf("version=%q", intel.Version)
	}

	body := `{"candidateId":"oi_test","shouldHaveAttention":true,"features":{"ci_failure":1}}`
	r = loopbackTestRequest(http.MethodPost, "/api/intelligence/feedback", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("feedback without capability status=%d want=403", w.Code)
	}

	r = loopbackTestRequest(http.MethodPost, "/api/intelligence/feedback", strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("X-WarRoom-Session", a.session)
	w = httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("feedback with capability status=%d body=%s", w.Code, w.Body.String())
	}
	if a.intel.model.FeedbackCount != 1 {
		t.Fatalf("feedback count=%d want=1", a.intel.model.FeedbackCount)
	}
}
