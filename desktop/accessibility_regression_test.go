package main

import (
	"os"
	"strings"
	"testing"
)

func TestPaletteDecorativeIconsAreHiddenFromAccessibilityTree(t *testing.T) {
	b, err := os.ReadFile("web/app.js")
	if err != nil {
		t.Fatal(err)
	}
	src := string(b)
	if !strings.Contains(src, `class="pal-icon" aria-hidden="true"`) {
		t.Fatal("palette decorative icons must be aria-hidden")
	}
	if strings.Contains(src, `class="pal-icon">`) {
		t.Fatal("palette exposes a decorative icon to the accessible name")
	}
}
