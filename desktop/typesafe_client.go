package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var typeSafeEndpoint = "https://api.typesafe.ai/v1/systemone"

type TypeSafeDecision struct {
	Configured               bool               `json:"configured"`
	Model                    string             `json:"model,omitempty"`
	Source                   string             `json:"source,omitempty"`
	EvaluatedAt              time.Time          `json:"evaluatedAt,omitempty"`
	Route                    string             `json:"route,omitempty"`
	RouteConfidence          float64            `json:"routeConfidence,omitempty"`
	RouteProbabilities       map[string]float64 `json:"routeProbabilities,omitempty"`
	HumanNeeded              float64            `json:"humanNeeded,omitempty"`
	EvidenceSufficient       float64            `json:"evidenceSufficient,omitempty"`
	DominantSignal           string             `json:"dominantSignal,omitempty"`
	DominantSignalConfidence float64            `json:"dominantSignalConfidence,omitempty"`
	SeverityScore            float64            `json:"severityScore,omitempty"`
	SeverityConfidence       float64            `json:"severityConfidence,omitempty"`
	SeverityLegend           map[string]string  `json:"severityLegend,omitempty"`
	SeverityProb             map[string]float64 `json:"severityProbabilities,omitempty"`
	InputTokens              int                `json:"inputTokens,omitempty"`
	OutputTokens             int                `json:"outputTokens,omitempty"`
	LatencyMs                int64              `json:"latencyMs,omitempty"`
	Fingerprint              string             `json:"fingerprint,omitempty"`
	Mode                     string             `json:"mode,omitempty"`
	Reason                   string             `json:"reason,omitempty"`
	CallsToday               int                `json:"callsToday,omitempty"`
	DailyBudget              int                `json:"dailyBudget,omitempty"`
	BudgetRemaining          int                `json:"budgetRemaining,omitempty"`
	Error                    string             `json:"error,omitempty"`
	ProviderErrorClass       string             `json:"providerErrorClass,omitempty"`
}

type typeSafeRequest struct {
	Model     string         `json:"model"`
	State     any            `json:"state"`
	Questions map[string]any `json:"questions"`
}

type typeSafeResponse struct {
	Model   string                     `json:"model"`
	Answers map[string]json.RawMessage `json:"answers"`
	Usage   struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

type typeSafeChoiceAnswer struct {
	Type          string             `json:"type"`
	Choice        string             `json:"choice"`
	Confidence    float64            `json:"confidence"`
	Probabilities map[string]float64 `json:"probabilities"`
}

type typeSafeNoulAnswer struct {
	Type string  `json:"type"`
	Noul float64 `json:"noul"`
}

type typeSafeScoreAnswer struct {
	Type          string             `json:"type"`
	Score         float64            `json:"score"`
	Confidence    float64            `json:"confidence"`
	Legend        map[string]string  `json:"legend"`
	Probabilities map[string]float64 `json:"probabilities"`
}

type typeSafeClient struct {
	apiKey string
	client httpDoer
}

func newTypeSafeClient(apiKey string) *typeSafeClient {
	return newTypeSafeClientWithDoer(apiKey, &http.Client{Timeout: 18 * time.Second})
}

func newTypeSafeClientWithDoer(apiKey string, doer httpDoer) *typeSafeClient {
	if doer == nil {
		doer = &http.Client{Timeout: 18 * time.Second}
	}
	return &typeSafeClient{apiKey: strings.TrimSpace(apiKey), client: doer}
}

func (c *typeSafeClient) evaluate(ctx context.Context, state any) (TypeSafeDecision, error) {
	if c.apiKey == "" {
		return TypeSafeDecision{}, errors.New("TypeSafe API key is not configured")
	}
	payload := typeSafeRequest{
		Model: "jev-latest",
		State: state,
		Questions: map[string]any{
			"attention_route": map[string]any{
				"type":         "choice",
				"instructions": "Choose the operational review route for this observed system state. Do not infer missing evidence. Select urgent_review only for an observed active failure or safety-critical degradation; human_review for material ambiguous or blocked work; monitor for a meaningful signal that does not require a person yet; no_action when the supplied observations do not justify intervention.",
				"criteria": map[string]string{
					"no_action":     "No observed evidence justifies intervention.",
					"monitor":       "Keep observing; a signal exists but human action is not justified yet.",
					"human_review":  "A person should review the evidence before consequential action.",
					"urgent_review": "Observed evidence warrants prompt human review.",
				},
			},
			"human_review_needed": map[string]any{
				"type":         "noul",
				"instructions": "Given only the supplied observations, is human review warranted before the next consequential system action?",
				"criteria": map[string]string{
					"true":  "The evidence warrants a human review gate.",
					"false": "The supplied evidence does not warrant a human review gate.",
				},
			},
			"evidence_sufficient": map[string]any{
				"type":         "noul",
				"instructions": "Given only the supplied observations, is there enough direct evidence to make an operational triage decision without inventing missing state? This is a model judgment about sufficiency, not verification evidence.",
				"criteria": map[string]string{
					"true":  "The supplied state contains enough direct observations for triage.",
					"false": "Material missing or stale observations make triage underdetermined.",
				},
			},
			"dominant_signal": map[string]any{
				"type":         "choice",
				"instructions": "Choose the single dominant observed signal. Prefer deterministic observations over inferred concerns. If no supplied signal is materially dominant, choose none.",
				"criteria": map[string]string{
					"ci_failure":          "A latest workflow failure is the dominant signal.",
					"service_degradation": "A directly observed degraded or down service is dominant.",
					"source_gap":          "Missing, stale, or unauthenticated source coverage is dominant.",
					"change_risk":         "Recent change plus incomplete verification is dominant.",
					"none":                "No single observed signal dominates.",
				},
			},
			"operational_severity": map[string]any{
				"type":         "score",
				"instructions": "Score the current observed operational severity. Treat missing or stale evidence as uncertainty, not as health.",
				"criteria": []string{
					"Nominal: no material observed problem.",
					"Watch: weak or incomplete signal; continue observing.",
					"Degraded: a material observed failure or blocker exists.",
					"Critical: multiple or high-impact observed failures require immediate attention.",
				},
			},
		},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return TypeSafeDecision{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, typeSafeEndpoint, bytes.NewReader(b))
	if err != nil {
		return TypeSafeDecision{}, err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Aftergraph-War-Room/1.5")
	resp, err := c.client.Do(req)
	if err != nil {
		return TypeSafeDecision{}, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return TypeSafeDecision{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(raw))
		if len(msg) > 500 {
			msg = msg[:500]
		}
		return TypeSafeDecision{}, fmt.Errorf("TypeSafe API returned %d: %s", resp.StatusCode, msg)
	}
	var out typeSafeResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe response: %w", err)
	}
	var route typeSafeChoiceAnswer
	var human typeSafeNoulAnswer
	var sufficient typeSafeNoulAnswer
	var dominant typeSafeChoiceAnswer
	var severity typeSafeScoreAnswer
	if err := json.Unmarshal(out.Answers["attention_route"], &route); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe choice: %w", err)
	}
	if err := json.Unmarshal(out.Answers["human_review_needed"], &human); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe noul: %w", err)
	}
	if err := json.Unmarshal(out.Answers["evidence_sufficient"], &sufficient); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe evidence sufficiency: %w", err)
	}
	if err := json.Unmarshal(out.Answers["dominant_signal"], &dominant); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe dominant signal: %w", err)
	}
	if err := json.Unmarshal(out.Answers["operational_severity"], &severity); err != nil {
		return TypeSafeDecision{}, fmt.Errorf("decode TypeSafe score: %w", err)
	}
	return TypeSafeDecision{
		Configured:               true,
		Model:                    out.Model,
		Source:                   "TypeSafe AI / Jev",
		EvaluatedAt:              time.Now().UTC(),
		Route:                    route.Choice,
		RouteConfidence:          clampProbability(route.Confidence),
		RouteProbabilities:       route.Probabilities,
		HumanNeeded:              clampProbability(human.Noul),
		EvidenceSufficient:       clampProbability(sufficient.Noul),
		DominantSignal:           dominant.Choice,
		DominantSignalConfidence: clampProbability(dominant.Confidence),
		SeverityScore:            severity.Score,
		SeverityConfidence:       clampProbability(severity.Confidence),
		SeverityLegend:           severity.Legend,
		SeverityProb:             severity.Probabilities,
		InputTokens:              out.Usage.InputTokens,
		OutputTokens:             out.Usage.OutputTokens,
	}, nil
}

func clampProbability(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}
