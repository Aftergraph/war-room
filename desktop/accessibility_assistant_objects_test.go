package main

import (
	"os"
	"strings"
	"testing"
)

func TestStructuredAssistantObjectsExposeScreenReaderSemantics(t *testing.T) {
	b, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	required := []string{
		"role=\"group\" aria-label=\"${esc(type+': '+title)}\"",
		"class=\"assistant-object-mark\" aria-hidden=\"true\"",
		"aria-label=\"${esc('Open source for '+title)}\"",
	}
	for _, needle := range required {
		if !strings.Contains(src, needle) {
			t.Fatalf("structured assistant object accessibility contract missing %q", needle)
		}
	}
	if strings.Contains(src, "class=\"assistant-object-mark\">") {
		t.Fatal("assistant object exposes decorative mark to accessibility tree")
	}
}
