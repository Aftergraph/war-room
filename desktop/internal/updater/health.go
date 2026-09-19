package updater

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

type healthResponse struct {
	OK      bool   `json:"ok"`
	Version string `json:"version"`
}

type sessionResponse struct {
	Session string `json:"session"`
}

func NativeHealthCheck(localAppData string) HealthCheck {
	return func(ctx context.Context, installPath, targetVersion string) error {
		cmd := exec.Command(installPath)
		cmd.Env = append(os.Environ(), "WAR_ROOM_NO_BROWSER=1", "LOCALAPPDATA="+localAppData)
		if err := cmd.Start(); err != nil {
			return err
		}
		stopped := false
		defer func() {
			if !stopped && cmd.Process != nil {
				_ = cmd.Process.Kill()
				_, _ = cmd.Process.Wait()
			}
		}()

		client := &http.Client{Timeout: 750 * time.Millisecond}
		var base string
		deadline := time.NewTicker(250 * time.Millisecond)
		defer deadline.Stop()
		for base == "" {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-deadline.C:
				for port := 37621; port <= 37630; port++ {
					url := fmt.Sprintf("http://127.0.0.1:%d/api/health", port)
					resp, err := client.Get(url)
					if err != nil {
						continue
					}
					var health healthResponse
					decodeErr := json.NewDecoder(resp.Body).Decode(&health)
					resp.Body.Close()
					if decodeErr == nil && resp.StatusCode == http.StatusOK && health.OK && health.Version == targetVersion {
						base = fmt.Sprintf("http://127.0.0.1:%d", port)
						break
					}
				}
			}
		}

		resp, err := client.Get(base + "/api/session")
		if err != nil {
			return err
		}
		var ses sessionResponse
		if err := json.NewDecoder(resp.Body).Decode(&ses); err != nil {
			resp.Body.Close()
			return err
		}
		resp.Body.Close()
		if ses.Session == "" {
			return fmt.Errorf("health smoke returned empty session capability")
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/shutdown", bytes.NewReader(nil))
		if err != nil {
			return err
		}
		req.Header.Set("X-WarRoom-Session", ses.Session)
		resp, err = client.Do(req)
		if err != nil {
			return err
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			return fmt.Errorf("authenticated shutdown returned %d", resp.StatusCode)
		}

		done := make(chan error, 1)
		go func() { done <- cmd.Wait() }()
		select {
		case err := <-done:
			stopped = true
			if err != nil {
				return fmt.Errorf("updated executable exited with error after shutdown: %w", err)
			}
			return nil
		case <-ctx.Done():
			return ctx.Err()
		}
	}
}

func CanonicalLocalAppDataFromStateDir(stateDir string) (string, error) {
	clean := filepath.Clean(stateDir)
	if filepath.Base(clean) != "WarRoom" || filepath.Base(filepath.Dir(clean)) != "Aftergraph" {
		return "", fmt.Errorf("state-dir must end in Aftergraph%cWarRoom", os.PathSeparator)
	}
	return filepath.Dir(filepath.Dir(clean)), nil
}
