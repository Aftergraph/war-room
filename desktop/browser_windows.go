//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func openAppWindow(url string) error {
	candidates := []string{filepath.Join(os.Getenv("ProgramFiles(x86)"), "Microsoft", "Edge", "Application", "msedge.exe"), filepath.Join(os.Getenv("ProgramFiles"), "Microsoft", "Edge", "Application", "msedge.exe")}
	for _, p := range candidates {
		if p != "" {
			if _, err := os.Stat(p); err == nil {
				return exec.Command(p, "--app="+url, "--start-maximized").Start()
			}
		}
	}
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
