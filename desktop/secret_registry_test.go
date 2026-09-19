package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestSecretRegistryRedactionCorpus(t *testing.T) {
	cases := []struct {
		name   string
		input  string
		secret string
	}{
		{"github opaque", "github.token=opaque-github-token-1234567890", "opaque-github-token-1234567890"},
		{"github fine grained", "credential github_pat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "github_pat_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"},
		{"github legacy", "credential ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456", "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456"},
		{"works opaque", "works.token='opaque-works-token-1234567890'", "opaque-works-token-1234567890"},
		{"typesafe labeled", "typesafe.api_key: opaque-typesafe-key-1234567890", "opaque-typesafe-key-1234567890"},
		{"typesafe formatted", "provider=apikey_abcdefghijklmnopqrstuvwxyz_1234567890", "apikey_abcdefghijklmnopqrstuvwxyz_1234567890"},
		{"agent bridge", "agents.bridge_token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"},
		{"session", "X-WarRoom-Session: fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210", "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"},
		{"bearer", "Authorization: Bearer bearer-secret-token-1234567890", "bearer-secret-token-1234567890"},
		{"generic json", "{\"token\":\"opaque-json-token-1234567890\"}", "opaque-json-token-1234567890"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := string(redactLogBytes([]byte(tc.input)))
			if strings.Contains(got, tc.secret) {
				t.Fatalf("secret leaked: %q", got)
			}
			if !strings.Contains(got, "[REDACTED]") {
				t.Fatalf("redaction marker missing: %q", got)
			}
		})
	}
}

func TestSecretRegistryCoversEveryVaultCredentialKeyUsedBySource(t *testing.T) {
	registered := registeredVaultSecretKeys()
	access := regexp.MustCompile(`vault\.(?:Get|Set|Delete)\("([^"]+)"`)
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]struct{}{}
	for _, path := range files {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		for _, match := range access.FindAllSubmatch(body, -1) {
			found[string(match[1])] = struct{}{}
		}
	}
	for key := range found {
		if _, ok := registered[key]; !ok {
			t.Errorf("vault credential %q is used by source but absent from secret registry", key)
		}
	}
	for key := range registered {
		if _, ok := found[key]; !ok {
			t.Errorf("secret registry vault key %q has no production vault access", key)
		}
	}
}
