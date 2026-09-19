package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type IntelligenceEngine struct {
	mu      sync.RWMutex
	path    string
	model   IntelligenceModel
	history []IntelligenceFeedbackRecord
}

type IntelligenceModel struct {
	Version       string             `json:"version"`
	Bias          float64            `json:"bias"`
	Weights       map[string]float64 `json:"weights"`
	LearningRate  float64            `json:"learningRate"`
	FeedbackCount int                `json:"feedbackCount"`
	UpdatedAt     time.Time          `json:"updatedAt"`
}

type IntelligenceFeature struct {
	Name         string  `json:"name"`
	Value        float64 `json:"value"`
	Weight       float64 `json:"weight"`
	Contribution float64 `json:"contribution"`
	Evidence     string  `json:"evidence"`
}

type IntelligenceCandidate struct {
	ID                string                `json:"id"`
	Scope             string                `json:"scope"`
	Domain            string                `json:"domain"`
	Kind              string                `json:"kind"`
	Title             string                `json:"title"`
	Summary           string                `json:"summary"`
	RecommendedAction string                `json:"recommendedAction"`
	RiskScore         float64               `json:"riskScore"`
	PriorityScore     float64               `json:"priorityScore"`
	Confidence        float64               `json:"confidence"`
	LearningState     string                `json:"learningState"`
	Features          []IntelligenceFeature `json:"features"`
	Evidence          []string              `json:"evidence"`
	URL               string                `json:"url,omitempty"`
	GeneratedAt       time.Time             `json:"generatedAt"`
}

type DomainIntelligence struct {
	Name       string  `json:"name"`
	RiskScore  float64 `json:"riskScore"`
	Confidence float64 `json:"confidence"`
	Candidates int     `json:"candidates"`
}

type IntelligenceSummary struct {
	Version       string                  `json:"version"`
	GeneratedAt   time.Time               `json:"generatedAt"`
	Mode          string                  `json:"mode"`
	LearningState string                  `json:"learningState"`
	FeedbackCount int                     `json:"feedbackCount"`
	Top           *IntelligenceCandidate  `json:"top,omitempty"`
	Candidates    []IntelligenceCandidate `json:"candidates"`
	Domains       []DomainIntelligence    `json:"domains"`
	Model         IntelligenceModel       `json:"model"`
	Guardrails    []string                `json:"guardrails"`
}

type IntelligenceFeedbackRequest struct {
	CandidateID         string             `json:"candidateId"`
	ShouldHaveAttention bool               `json:"shouldHaveAttention"`
	Features            map[string]float64 `json:"features"`
}

type IntelligenceFeedbackRecord struct {
	CandidateID         string             `json:"candidateId"`
	ShouldHaveAttention bool               `json:"shouldHaveAttention"`
	Prediction          float64            `json:"prediction"`
	Features            map[string]float64 `json:"features"`
	ObservedAt          time.Time          `json:"observedAt"`
}

func defaultIntelligenceModel() IntelligenceModel {
	// Priors are intentionally conservative and interpretable. They are not
	// claimed as calibrated probabilities. Feedback can adapt ranking weights.
	return IntelligenceModel{
		Version:      "operational-intelligence/0.1",
		Bias:         -2.35,
		LearningRate: 0.08,
		Weights: map[string]float64{
			"ci_failure":        2.60,
			"repeat_failure":    1.45,
			"service_degraded":  2.20,
			"unverified_change": 1.35,
			"source_gap":        0.95,
			"freshness_gap":     0.85,
			"issue_pressure":    0.55,
			"activity_velocity": 0.45,
			"recent_change":     0.30,
		},
		UpdatedAt: time.Now().UTC(),
	}
}

func newIntelligenceEngine(baseDir string) *IntelligenceEngine {
	e := &IntelligenceEngine{path: filepath.Join(baseDir, "intelligence-model.json"), model: defaultIntelligenceModel()}
	var persisted struct {
		Model   IntelligenceModel            `json:"model"`
		History []IntelligenceFeedbackRecord `json:"history"`
	}
	if b, err := os.ReadFile(e.path); err == nil && json.Unmarshal(b, &persisted) == nil && persisted.Model.Version != "" {
		e.model = persisted.Model
		if e.model.Weights == nil {
			e.model.Weights = defaultIntelligenceModel().Weights
		}
		e.history = persisted.History
	}
	return e
}

func (e *IntelligenceEngine) saveLocked() error {
	payload := struct {
		Model   IntelligenceModel            `json:"model"`
		History []IntelligenceFeedbackRecord `json:"history"`
	}{e.model, e.history}
	b, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	tmp := e.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0600); err != nil {
		return err
	}
	return os.Rename(tmp, e.path)
}

func clamp01(v float64) float64 {
	if v < 0 {
		return 0
	}
	if v > 1 {
		return 1
	}
	return v
}

func sigmoid(x float64) float64 {
	if x >= 0 {
		z := math.Exp(-x)
		return 1 / (1 + z)
	}
	z := math.Exp(x)
	return z / (1 + z)
}

func (e *IntelligenceEngine) learningStateLocked() string {
	switch {
	case e.model.FeedbackCount == 0:
		return "prior-only"
	case e.model.FeedbackCount < 20:
		return "online-learning"
	default:
		// "trained" deliberately avoids claiming probability calibration.
		return "feedback-trained"
	}
}

func candidateID(repo, kind string) string {
	h := sha256.Sum256([]byte(strings.ToLower(repo + "\x00" + kind)))
	return "oi_" + hex.EncodeToString(h[:])[:12]
}

func repoWorkflowMap(runs []WorkflowRun) map[string][]WorkflowRun {
	out := map[string][]WorkflowRun{}
	for _, w := range runs {
		out[w.Repo] = append(out[w.Repo], w)
	}
	for k := range out {
		sort.Slice(out[k], func(i, j int) bool { return out[k][i].CreatedAt.After(out[k][j].CreatedAt) })
		if len(out[k]) > 5 {
			out[k] = out[k][:5]
		}
	}
	return out
}

func featureEvidence(name string, value float64, repo Repo, gh GitHubSnapshot, runs []WorkflowRun, probes []ProbeResult, activityCount int) string {
	switch name {
	case "ci_failure":
		if len(runs) == 0 {
			return "No recent workflow evidence observed"
		}
		return "Latest workflow: " + runs[0].Name + " / " + runs[0].Conclusion
	case "repeat_failure":
		return "Recent workflow failure density"
	case "service_degraded":
		return "HTTP probe mapped to repository domain"
	case "unverified_change":
		return "Recent source change without a recent successful workflow observation"
	case "source_gap":
		return "Repository provenance: " + repo.Source
	case "freshness_gap":
		return "GitHub observation age from " + gh.ObservedAt.UTC().Format(time.RFC3339)
	case "issue_pressure":
		return "Open issue count: " + itoa(repo.OpenIssues)
	case "activity_velocity":
		return "Observed 24h repository events: " + itoa(activityCount)
	case "recent_change":
		if repo.PushedAt.IsZero() {
			return "Last push unobserved"
		}
		return "Last push: " + repo.PushedAt.UTC().Format(time.RFC3339)
	default:
		return "Observed system signal"
	}
}

func itoa(v int) string {
	if v == 0 {
		return "0"
	}
	neg := v < 0
	if neg {
		v = -v
	}
	var b [24]byte
	i := len(b)
	for v > 0 {
		i--
		b[i] = byte('0' + v%10)
		v /= 10
	}
	if neg {
		i--
		b[i] = '-'
	}
	return string(b[i:])
}
