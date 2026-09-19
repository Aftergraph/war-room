package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) Do(r *http.Request) (*http.Response, error) { return f(r) }

func testResponse(code int, body string) *http.Response {
	return &http.Response{StatusCode: code, Status: http.StatusText(code), Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}

func TestGitHubClientRetriesTransientGET(t *testing.T) {
	var mu sync.Mutex
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		mu.Lock()
		calls++
		n := calls
		mu.Unlock()
		if r.Method != http.MethodGet {
			t.Fatalf("method=%s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer tok" {
			t.Fatalf("auth missing")
		}
		if n < 3 {
			return testResponse(http.StatusServiceUnavailable, `{"message":"try later"}`), nil
		}
		return testResponse(http.StatusOK, `{"login":"aftergraph-test"}`), nil
	})
	got, err := newGitHubClientWithDoer("tok", doer).validate(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got != "aftergraph-test" {
		t.Fatalf("login=%q", got)
	}
	if calls != 3 {
		t.Fatalf("calls=%d want 3", calls)
	}
}

func TestGitHubClientDoesNotRetryPermanentFailure(t *testing.T) {
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return testResponse(http.StatusUnauthorized, `{"message":"bad credentials"}`), nil
	})
	_, err := newGitHubClientWithDoer("tok", doer).validate(context.Background())
	if err == nil || !strings.Contains(err.Error(), "Unauthorized") {
		t.Fatalf("err=%v", err)
	}
	if calls != 1 {
		t.Fatalf("calls=%d want 1", calls)
	}
}

func TestGitHubClientStopsOnCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return nil, context.Canceled
	})
	_, err := newGitHubClientWithDoer("tok", doer).validate(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err=%v", err)
	}
	if calls != 1 {
		t.Fatalf("calls=%d want 1", calls)
	}
}

func TestTypeSafeClientInjectedProviderFailure(t *testing.T) {
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.Method != http.MethodPost {
			t.Fatalf("method=%s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer key" {
			t.Fatalf("auth missing")
		}
		return testResponse(http.StatusTooManyRequests, `rate limited`), nil
	})
	_, err := newTypeSafeClientWithDoer("key", doer).evaluate(context.Background(), map[string]any{"x": 1})
	if err == nil || !strings.Contains(err.Error(), "429") {
		t.Fatalf("err=%v", err)
	}
	if calls != 1 {
		t.Fatalf("calls=%d; POST evaluation must not auto-retry", calls)
	}
}

func TestGitHubClientExportsRetryMetrics(t *testing.T) {
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if calls == 1 {
			return testResponse(http.StatusServiceUnavailable, `{"message":"try later"}`), nil
		}
		return testResponse(http.StatusOK, `{"login":"aftergraph-test"}`), nil
	})
	g := newGitHubClientWithDoer("tok", doer)
	if _, err := g.validate(context.Background()); err != nil {
		t.Fatal(err)
	}
	g.rateMu.Lock()
	defer g.rateMu.Unlock()
	if g.requestCount != 2 || g.retryCount != 1 || g.backoffCount != 1 {
		t.Fatalf("requests=%d retries=%d backoffs=%d", g.requestCount, g.retryCount, g.backoffCount)
	}
	if g.lastErrorClass != "server" {
		t.Fatalf("lastErrorClass=%q", g.lastErrorClass)
	}
}

func TestProviderErrorClassification(t *testing.T) {
	cases := []struct {
		err  error
		want string
	}{
		{context.DeadlineExceeded, "timeout"},
		{errors.New("TypeSafe API returned 401: bad key"), "auth"},
		{errors.New("TypeSafe API returned 429: rate limited"), "rate-limit"},
		{errors.New("decode TypeSafe response: malformed"), "protocol"},
		{errors.New("dial tcp: lookup failed"), "network-or-provider"},
	}
	for _, tc := range cases {
		if got := classifyProviderError(tc.err); got != tc.want {
			t.Fatalf("%v: got %q want %q", tc.err, got, tc.want)
		}
	}
}
