package main

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestValidateWorksUsesInjectedTransportAndAuth(t *testing.T) {
	calls := 0
	doer := roundTripFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		if r.URL.String() != "http://works.local/v1/ui" {
			t.Fatalf("url=%s", r.URL.String())
		}
		if r.Header.Get("Authorization") != "Bearer works-token" {
			t.Fatalf("auth=%q", r.Header.Get("Authorization"))
		}
		return testResponse(http.StatusOK, "ok"), nil
	})
	if err := validateWorksWithDoer(context.Background(), "http://works.local", "works-token", doer); err != nil {
		t.Fatal(err)
	}
	if calls != 1 {
		t.Fatalf("calls=%d", calls)
	}
}

func TestConsumeWorksEventsProjectsRunnerAndWork(t *testing.T) {
	app := testApp(t)
	stream := strings.Join([]string{
		"event: runner",
		`data: {"id":"worker-1","pool":"lenovo","state":"running","work_id":"wrk_123"}`,
		"",
		"event: work",
		`data: {"id":"wrk_123","state":"SUCCEEDED","repo":"runtime"}`,
		"",
	}, "\n")
	app.worksHTTP = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Accept") != "text/event-stream" {
			t.Fatalf("accept=%q", r.Header.Get("Accept"))
		}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(stream))}, nil
	})
	if err := app.consumeWorksEvents(context.Background(), "http://works.local", ""); err != nil {
		t.Fatal(err)
	}
	snap := app.agentSnapshot()
	if len(snap.Sessions) != 1 || snap.Sessions[0].ID != "works:worker-1" || snap.Sessions[0].WorkID != "wrk_123" {
		t.Fatalf("sessions=%#v", snap.Sessions)
	}
	if len(snap.Events) != 1 || snap.Events[0].WorkID != "wrk_123" {
		t.Fatalf("events=%#v", snap.Events)
	}
	foundLive := false
	for _, src := range snap.Sources {
		if src.ID == "works" && src.Status == "live" {
			foundLive = true
		}
	}
	if !foundLive {
		t.Fatalf("sources=%#v", snap.Sources)
	}
}

func TestAssistantInjectedTransportStatusFailureFallsBackGrounded(t *testing.T) {
	app := testApp(t)
	cfg := app.store.getSettings()
	cfg.AssistantLocalModel = true
	cfg.AssistantOllamaURL = "http://ollama.local"
	if err := app.store.saveSettings(cfg); err != nil {
		t.Fatal(err)
	}
	app.assistantHTTP = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return testResponse(http.StatusServiceUnavailable, "down"), nil
	})
	got := app.detectAssistantStatus(context.Background())
	if got.LocalModelAvailable || got.Mode != "grounded-core" || !strings.Contains(got.Error, "503") {
		t.Fatalf("status=%#v", got)
	}
}

func TestAssistantInjectedTransportProducesBoundedLocalAnswer(t *testing.T) {
	app := testApp(t)
	app.assistantHTTP = roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if strings.HasSuffix(r.URL.Path, "/api/chat") {
			return testResponse(http.StatusOK, `{"message":{"content":"Grounded local synthesis."}}`), nil
		}
		return testResponse(http.StatusOK, `{"models":[{"name":"qwen-test"}]}`), nil
	})
	st := AssistantStatus{LocalModelAvailable: true, LocalModel: "qwen-test", OllamaURL: "http://ollama.local"}
	got, err := app.answerWithOllama(context.Background(), "summarize", st)
	if err != nil {
		t.Fatal(err)
	}
	if got != "Grounded local synthesis." {
		t.Fatalf("answer=%q", got)
	}
}
