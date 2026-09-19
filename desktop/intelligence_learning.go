package main

import (
	"time"
)

func (e *IntelligenceEngine) ApplyFeedback(req IntelligenceFeedbackRequest) (IntelligenceModel, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	if req.Features == nil {
		req.Features = map[string]float64{}
	}
	score := e.model.Bias
	for name, value := range req.Features {
		score += e.model.Weights[name] * clamp01(value)
	}
	pred := sigmoid(score)
	y := 0.0
	if req.ShouldHaveAttention {
		y = 1
	}
	errTerm := y - pred
	lr := e.model.LearningRate
	if lr <= 0 || lr > .5 {
		lr = .08
	}
	// Constrained online logistic regression. Small L2 shrinkage prevents one
	// noisy label from causing extreme weights.
	const l2 = 0.002
	for name, value := range req.Features {
		if _, ok := e.model.Weights[name]; !ok {
			continue
		}
		w := e.model.Weights[name]
		w += lr * (errTerm*clamp01(value) - l2*w)
		if w > 4 {
			w = 4
		}
		if w < -4 {
			w = -4
		}
		e.model.Weights[name] = w
	}
	e.model.Bias += lr * errTerm
	if e.model.Bias > 3 {
		e.model.Bias = 3
	}
	if e.model.Bias < -5 {
		e.model.Bias = -5
	}
	e.model.FeedbackCount++
	e.model.UpdatedAt = time.Now().UTC()
	e.history = append(e.history, IntelligenceFeedbackRecord{CandidateID: req.CandidateID, ShouldHaveAttention: req.ShouldHaveAttention, Prediction: pred, Features: req.Features, ObservedAt: e.model.UpdatedAt})
	if len(e.history) > 500 {
		e.history = e.history[len(e.history)-500:]
	}
	if err := e.saveLocked(); err != nil {
		return e.model, err
	}
	return e.model, nil
}
