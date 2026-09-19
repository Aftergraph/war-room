package main

import "strings"

var canonicalDomains = []string{
	"Institution & Governance",
	"Execution & Runtime",
	"Evidence & Verification",
	"Integration & Capability",
	"Intelligence & Research",
	"Product & Experience",
	"Infrastructure & Delivery",
	"Business & Operations",
	"Brand & Public Surface",
}

func inferDomain(repo string) string {
	r := strings.ToLower(repo)
	contains := func(xs ...string) bool {
		for _, x := range xs {
			if strings.Contains(r, x) {
				return true
			}
		}
		return false
	}
	switch {
	case contains("governance", "aie", "trust-gateway", "authority", "policy"):
		return "Institution & Governance"
	case contains("sentinel", "evidence", "verification", "assurance"):
		return "Evidence & Verification"
	case contains("integration", "hub", "mcp", "capability", "connector", "skill"):
		return "Integration & Capability"
	case contains("runtime", "works", "continuum", "cron-fabric", "relay", "execution"):
		return "Execution & Runtime"
	case contains("research", "afm", "model-registry", "llm", "mission-bench"):
		return "Intelligence & Research"
	case contains("studio", "fihim", "wi-", "work-intelligence", "veranza"):
		return "Product & Experience"
	case contains("forge", "infra", "runner", "deploy", "ops-platform"):
		return "Infrastructure & Delivery"
	case contains("business", "rendetalje", "renos", "billing"):
		return "Business & Operations"
	case contains("brand", "docs", "aftergraph.org", ".github", "website"):
		return "Brand & Public Surface"
	default:
		return "Execution & Runtime"
	}
}
