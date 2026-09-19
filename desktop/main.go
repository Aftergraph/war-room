package main

import (
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		home, _ := os.UserHomeDir()
		base = filepath.Join(home, ".aftergraph")
	}
	base = filepath.Join(base, "Aftergraph", "WarRoom")
	app, err := newApp(base)
	if err != nil {
		_ = os.WriteFile(filepath.Join(os.TempDir(), "aftergraph-war-room-error.txt"), []byte(err.Error()), 0600)
		return
	}
	if err := app.run(); err != nil {
		_ = os.WriteFile(filepath.Join(os.TempDir(), "aftergraph-war-room-error.txt"), []byte(fmt.Sprint(err)), 0600)
	}
}
