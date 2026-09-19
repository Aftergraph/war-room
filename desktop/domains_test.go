package main

import "testing"

func TestInferDomain(t *testing.T) {
	cases := map[string]string{"sentinel": "Evidence & Verification", "runtime": "Execution & Runtime", "brand": "Brand & Public Surface", "rendetalje": "Business & Operations", "afm": "Intelligence & Research", "fihim": "Product & Experience", "after-graph-governance": "Institution & Governance"}
	for in, want := range cases {
		if got := inferDomain(in); got != want {
			t.Fatalf("%s => %s want %s", in, got, want)
		}
	}
}
func TestBootstrapHonesty(t *testing.T) {
	s := bootstrapSnapshot()
	if len(s.Repos) < 20 {
		t.Fatal("expected bootstrap repo inventory")
	}
	if s.Commits24h != 0 || s.OpenPRs != 0 {
		t.Fatal("bootstrap must not fabricate live KPIs")
	}
}
