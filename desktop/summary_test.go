package main

import (
	"testing"
	"time"
)

func TestLatestMetrics(t *testing.T) {
	now := time.Now()
	x := []MetricSample{{Name: "VSR", Domain: "Research", Value: 1, ObservedAt: now.Add(-time.Hour)}, {Name: "VSR", Domain: "Research", Value: 2, ObservedAt: now}}
	out := latestMetrics(x)
	if len(out) != 1 || out[0].Value != 2 {
		t.Fatalf("unexpected: %+v", out)
	}
}
func TestDomains(t *testing.T) {
	s := bootstrapSnapshot()
	d := buildDomains(s)
	if len(d) < 8 {
		t.Fatalf("expected domains, got %d", len(d))
	}
}
