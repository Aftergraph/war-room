//go:build !windows

package main

import (
	"os"
	"os/exec"
	"runtime"
)

func openAppWindow(url string) error {
	if os.Getenv("AFTERGRAPH_NO_BROWSER") == "1" {
		return nil
	}
	if runtime.GOOS == "darwin" {
		return exec.Command("open", url).Start()
	}
	return exec.Command("xdg-open", url).Start()
}
