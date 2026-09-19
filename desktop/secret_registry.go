package main

import "regexp"

type secretType struct {
	ID            string
	VaultKeys     []string
	LabelPatterns []*regexp.Regexp
	ValuePatterns []*regexp.Regexp
}

var secretTypes = []secretType{
	{
		ID:        "github-token",
		VaultKeys: []string{"github.token"},
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(github[._ -]?token|gh[._ -]?token)(\s*["']?\s*[:=]\s*["']?\s*)([A-Za-z0-9._~+/=-]{4,})`),
		},
		ValuePatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)github_pat_[A-Za-z0-9_]{10,}`),
			regexp.MustCompile(`(?i)gh[pousr]_[A-Za-z0-9]{10,}`),
		},
	},
	{
		ID:        "works-token",
		VaultKeys: []string{"works.token"},
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(works[._ -]?token)(\s*["']?\s*[:=]\s*["']?\s*)([^\s"',;}]{4,})`),
		},
	},
	{
		ID:        "typesafe-api-key",
		VaultKeys: []string{"typesafe.api_key"},
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(typesafe[._ -]?(?:api[._ -]?key|key))(\s*["']?\s*[:=]\s*["']?\s*)([^\s"',;}]{4,})`),
		},
		ValuePatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)apikey_[A-Za-z0-9_=-]{10,}`),
		},
	},
	{
		ID:        "agent-bridge-token",
		VaultKeys: []string{"agents.bridge_token"},
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(agents?[._ -]?bridge[._ -]?token)(\s*["']?\s*[:=]\s*["']?\s*)([^\s"',;}]{4,})`),
		},
	},
	{
		ID: "war-room-session",
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(x-warroom-session|war[._ -]?room[._ -]?session)(\s*["']?\s*[:=]\s*["']?\s*)([^\s"',;}]{4,})`),
		},
	},
	{
		ID: "bearer-transport",
		ValuePatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)Bearer\s+[A-Za-z0-9._~+/-]+=*`),
		},
	},
	{
		ID: "generic-named-secret",
		LabelPatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(api[_ -]?key|token|authorization)(\s*["']?\s*[:=]\s*["']?\s*)([^\s"',;}]{4,})`),
		},
	},
}

func registeredVaultSecretKeys() map[string]struct{} {
	out := map[string]struct{}{}
	for _, typ := range secretTypes {
		for _, key := range typ.VaultKeys {
			out[key] = struct{}{}
		}
	}
	return out
}

func redactRegisteredSecrets(p []byte) []byte {
	out := append([]byte(nil), p...)
	for _, typ := range secretTypes {
		for _, re := range typ.ValuePatterns {
			out = re.ReplaceAll(out, []byte("[REDACTED]"))
		}
		for _, re := range typ.LabelPatterns {
			out = re.ReplaceAll(out, []byte("$1$2[REDACTED]"))
		}
	}
	return out
}
