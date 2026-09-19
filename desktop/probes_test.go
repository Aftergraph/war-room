package main

import (
	"context"
	"errors"
	"net/http"
	"testing"
)

func TestRunProbesWithInjectedTransportClassifiesStates(t *testing.T) {
	configs := []ProbeConfig{
		{ID: "up", Name: "up", URL: "https://up.local", Enabled: true},
		{ID: "bad", Name: "bad", URL: "https://bad.local", Enabled: true},
		{ID: "down", Name: "down", URL: "https://down.local", Enabled: true},
		{ID: "off", Name: "off", URL: "https://off.local", Enabled: false},
	}
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Host {
		case "up.local":
			return testResponse(http.StatusNoContent, ""), nil
		case "bad.local":
			return testResponse(http.StatusInternalServerError, "no"), nil
		case "down.local":
			return nil, errors.New("dial failed")
		default:
			t.Fatalf("unexpected host %s", r.URL.Host)
			return nil, nil
		}
	})
	got := runProbesWithDoer(context.Background(), configs, doer)
	if len(got) != 3 {
		t.Fatalf("len=%d", len(got))
	}
	state := map[string]string{}
	for _, p := range got {
		state[p.ID] = p.Status
	}
	if state["up"] != "up" || state["bad"] != "degraded" || state["down"] != "down" {
		t.Fatalf("states=%v", state)
	}
}

func TestRunProbesRejectsMalformedURLAsError(t *testing.T) {
	got := runProbesWithDoer(context.Background(), []ProbeConfig{{ID: "x", Name: "x", URL: "://bad", Enabled: true}}, roundTripFunc(func(r *http.Request) (*http.Response, error) {
		t.Fatal("transport should not be called")
		return nil, nil
	}))
	if len(got) != 1 || got[0].Status != "error" {
		t.Fatalf("got=%#v", got)
	}
}
