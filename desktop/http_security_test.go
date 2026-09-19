package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func loopbackTestRequest(method, target string, body io.Reader) *http.Request {
	r := httptest.NewRequest(method, target, body)
	r.Host = "127.0.0.1:37621"
	return r
}

func TestLoopbackRequestPolicyRejectsHostAndCrossOriginSessionExfiltration(t *testing.T) {
	a := testApp(t)
	cases := []struct {
		name   string
		host   string
		origin string
		want   int
	}{
		{name: "loopback no origin", host: "127.0.0.1:37621", want: http.StatusOK},
		{name: "loopback same origin", host: "127.0.0.1:37621", origin: "http://127.0.0.1:37621", want: http.StatusOK},
		{name: "localhost host rejected", host: "localhost:37621", origin: "http://localhost:37621", want: http.StatusForbidden},
		{name: "dns rebind host", host: "attacker.example:37621", want: http.StatusForbidden},
		{name: "loopback host with nonnumeric port", host: "127.0.0.1:http", want: http.StatusForbidden},
		{name: "loopback host without port", host: "127.0.0.1", want: http.StatusForbidden},
		{name: "cross site origin", host: "127.0.0.1:37621", origin: "https://attacker.example", want: http.StatusForbidden},
		{name: "different loopback port", host: "127.0.0.1:37621", origin: "http://127.0.0.1:49999", want: http.StatusForbidden},
		{name: "origin path rejected", host: "127.0.0.1:37621", origin: "http://127.0.0.1:37621/path", want: http.StatusForbidden},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodGet, "/api/session", nil)
			r.Host = tc.host
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			w := httptest.NewRecorder()
			a.routes().ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status=%d want=%d body=%s", w.Code, tc.want, w.Body.String())
			}
		})
	}
}

func TestLoopbackRequestPolicyRejectsCrossOriginMutationEvenWithSession(t *testing.T) {
	a := testApp(t)
	r := httptest.NewRequest(http.MethodPost, "/api/metrics", nil)
	r.Host = "127.0.0.1:37621"
	r.Header.Set("Origin", "https://attacker.example")
	r.Header.Set("X-WarRoom-Session", a.session)
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d want=403 body=%s", w.Code, w.Body.String())
	}
}

func TestLoopbackRequestPolicyRejectsDuplicateOriginHeaders(t *testing.T) {
	a := testApp(t)
	r := httptest.NewRequest(http.MethodGet, "/api/session", nil)
	r.Host = "127.0.0.1:37621"
	r.Header.Add("Origin", "http://127.0.0.1:37621")
	r.Header.Add("Origin", "https://attacker.example")
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d want=403 body=%s", w.Code, w.Body.String())
	}
}
