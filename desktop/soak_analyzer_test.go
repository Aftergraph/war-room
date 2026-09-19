package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

type soakAnalysis struct {
	EvidenceComplete          bool            `json:"evidenceComplete"`
	ClosureVerdict            string          `json:"closureVerdict"`
	ObservedSampleSpanSec     float64         `json:"observedSampleSpanSec"`
	RecomputedNonLiveRowCount int             `json:"recomputedNonLiveRowCount"`
	Completeness              map[string]bool `json:"completeness"`
	TrendFlags                []string        `json:"trendFlags"`
}

func pythonCommand(t *testing.T) string {
	t.Helper()
	for _, name := range []string{"python", "python3"} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	t.Fatal("python interpreter not found")
	return ""
}

func writeSoakEvidence(t *testing.T, duration int, samples int, nonLiveAt int) (string, string) {
	t.Helper()
	dir := t.TempDir()
	receiptPath := filepath.Join(dir, "receipt.json")
	samplesPath := filepath.Join(dir, "samples.ndjson")
	receipt := map[string]any{
		"schema":               "aftergraph.war-room.desktop.soak-receipt/1.0",
		"targetVersion":        "1.6.14",
		"sourceCommit":         "0123456789abcdef0123456789abcdef01234567",
		"appSha256":            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"durationSec":          duration,
		"intervalSec":          30,
		"validSamples":         samples,
		"collectionErrors":     0,
		"sourceNonLiveSamples": 0,
	}
	b, err := json.Marshal(receipt)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(receiptPath, b, 0o600); err != nil {
		t.Fatal(err)
	}

	var buf bytes.Buffer
	for i := 0; i < samples; i++ {
		live := i != nonLiveAt
		row := map[string]any{
			"sample":             i + 1,
			"elapsedSec":         i * 30,
			"workingSetBytes":    58_000_000 + (i%7)*120_000,
			"privateBytes":       61_000_000 + (i%5)*130_000,
			"goHeapBytes":        2_500_000 + (i%11)*90_000,
			"handleCount":        418 + (i % 6),
			"threadCount":        19 + (i % 2),
			"githubSource":       "GitHub REST API",
			"githubAuthenticated": true,
			"worksConfigured":    true,
			"worksEnabled":       true,
			"worksSourceStatus":  "live",
			"bridgeSourceStatus": "live",
			"agentsStale":        0,
			"connectorStates": map[string]any{
				"github": map[string]any{
					"state":          "live",
					"lastRecoveryMs": 7000,
				},
			},
		}
		if !live {
			row["bridgeSourceStatus"] = "offline"
		}
		line, err := json.Marshal(row)
		if err != nil {
			t.Fatal(err)
		}
		buf.Write(line)
		buf.WriteByte('\n')
	}
	if err := os.WriteFile(samplesPath, buf.Bytes(), 0o600); err != nil {
		t.Fatal(err)
	}
	return receiptPath, samplesPath
}

func runSoakAnalyzer(t *testing.T, receipt, samples string, extra ...string) (int, soakAnalysis, string) {
	t.Helper()
	args := []string{
		"scripts/analyze-soak.py",
		"--receipt", receipt,
		"--samples", samples,
	}
	args = append(args, extra...)
	cmd := exec.Command(pythonCommand(t), args...)
	out, err := cmd.CombinedOutput()
	exit := 0
	if err != nil {
		var exitErr *exec.ExitError
		if ok := errorAs(err, &exitErr); ok {
			exit = exitErr.ExitCode()
		} else {
			t.Fatalf("analyzer invocation failed: %v\n%s", err, out)
		}
	}
	var parsed soakAnalysis
	_ = json.Unmarshal(out, &parsed)
	return exit, parsed, string(out)
}

func errorAs(err error, target **exec.ExitError) bool {
	e, ok := err.(*exec.ExitError)
	if !ok {
		return false
	}
	*target = e
	return true
}

func TestSoakAnalyzerCompleteEvidenceDoesNotAutoClose(t *testing.T) {
	receipt, samples := writeSoakEvidence(t, 7200, 241, -1)
	exit, result, raw := runSoakAnalyzer(t, receipt, samples,
		"--expected-commit", "0123456789abcdef0123456789abcdef01234567",
		"--expected-sha256", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	)
	if exit != 0 {
		t.Fatalf("expected complete evidence exit 0, got %d: %s", exit, raw)
	}
	if !result.EvidenceComplete {
		t.Fatalf("expected evidenceComplete=true: %s", raw)
	}
	if result.ObservedSampleSpanSec != 7200 {
		t.Fatalf("unexpected observed span %.0f", result.ObservedSampleSpanSec)
	}
	if result.ClosureVerdict != "NOT_EMITTED" {
		t.Fatalf("analyzer must not auto-close WR-QA-001, got %q", result.ClosureVerdict)
	}
}

func TestSoakAnalyzerRejectsProvenanceMismatch(t *testing.T) {
	receipt, samples := writeSoakEvidence(t, 7200, 241, -1)
	exit, _, raw := runSoakAnalyzer(t, receipt, samples,
		"--expected-commit", "ffffffffffffffffffffffffffffffffffffffff",
	)
	if exit != 2 {
		t.Fatalf("expected provenance error exit 2, got %d: %s", exit, raw)
	}
}

func TestSoakAnalyzerRejectsReceiptOnlyDurationClaim(t *testing.T) {
	receipt, samples := writeSoakEvidence(t, 7200, 121, -1) // only one hour of observed samples
	exit, result, raw := runSoakAnalyzer(t, receipt, samples)
	if exit != 1 {
		t.Fatalf("expected incomplete evidence exit 1, got %d: %s", exit, raw)
	}
	if result.EvidenceComplete {
		t.Fatalf("short observed span must not be complete: %s", raw)
	}
	if result.Completeness["observedSampleSpanAtLeast2h"] {
		t.Fatalf("observedSampleSpanAtLeast2h unexpectedly true: %s", raw)
	}
}

func TestSoakAnalyzerFlagsNonLiveConnectorEvidence(t *testing.T) {
	receipt, samples := writeSoakEvidence(t, 7200, 241, 100)
	exit, result, raw := runSoakAnalyzer(t, receipt, samples)
	if exit != 1 {
		t.Fatalf("expected non-live evidence exit 1, got %d: %s", exit, raw)
	}
	if result.RecomputedNonLiveRowCount != 1 {
		t.Fatalf("expected one non-live row, got %d: %s", result.RecomputedNonLiveRowCount, raw)
	}
	if result.Completeness["recomputedSourceNonLiveSamplesZero"] {
		t.Fatalf("non-live connector sample was not reflected in completeness: %s", raw)
	}
}

func TestSoakAnalyzerInvocationShape(t *testing.T) {
	if _, err := os.Stat("scripts/analyze-soak.py"); err != nil {
		t.Fatal(err)
	}
	if testing.Verbose() {
		fmt.Println("soak analyzer contract present")
	}
}
