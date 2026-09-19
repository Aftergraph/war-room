package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"
)

func (a *App) hostLoop(ctx context.Context) {
	for {
		h := observeHost(ctx)
		a.hostMu.Lock()
		a.host = h
		a.hostMu.Unlock()
		a.broadcast("host")
		if !a.waitDuration(ctx, 15*time.Second) {
			return
		}
	}
}

func (a *App) background(ctx context.Context) {
	cfg := a.store.getSettings()
	_ = a.store.setProbes(runProbes(ctx, cfg.Probes))

	// One best-effort startup sync gives a fresh public GitHub plane even before
	// credentials are configured. Private inventory is retained from the bundled
	// authenticated snapshot until a credentialed sync can refresh it.
	startupCtx, cancelStartup := context.WithTimeout(ctx, 45*time.Second)
	token, _ := a.vault.Get("github.token")
	syncCfg := cfg
	if token == "" {
		syncCfg = publicSyncConfig(cfg)
	}
	if a.syncMu.TryLock() {
		a.setConnectorState("github", "connecting", "")
		s := a.githubConnector(token).sync(startupCtx, cfg.GitHubOrg, syncCfg)
		if token == "" && len(s.Repos) > 0 {
			s = mergePublicSnapshot(a.store.getGitHub(), s)
		}
		if len(s.Repos) > 0 {
			_ = a.store.saveGitHub(s)
			a.setConnectorState("github", "live", "")
		} else if len(s.Errors) > 0 {
			a.setConnectorState("github", "degraded", s.LastErrorClass)
		}
		a.syncMu.Unlock()
		a.broadcast("sync")
	}
	cancelStartup()
	go a.maybeTypeSafeEvaluate(ctx, false, "startup")

	for {
		cfg := a.store.getSettings()
		token, _ := a.vault.Get("github.token")
		effective := cfg
		if token == "" {
			effective = publicSyncConfig(cfg)
		}
		d := time.Duration(effective.RefreshSeconds) * time.Second
		if a.waitDuration(ctx, d) {
			token, _ = a.vault.Get("github.token")
			if a.syncMu.TryLock() {
				a.setConnectorState("github", "connecting", "")
				previous := a.store.getGitHub()
				syncCfg := cfg
				if token == "" {
					syncCfg = publicSyncConfig(cfg)
				}
				s := a.githubConnector(token).sync(ctx, cfg.GitHubOrg, syncCfg)
				if token == "" && len(s.Repos) > 0 {
					s = mergePublicSnapshot(a.store.getGitHub(), s)
				}
				if len(s.Repos) > 0 {
					_ = a.store.saveGitHub(s)
					a.setConnectorState("github", "live", "")
				} else if len(s.Errors) > 0 {
					a.setConnectorState("github", "degraded", s.LastErrorClass)
				}
				_ = a.store.setProbes(runProbes(ctx, cfg.Probes))
				a.syncMu.Unlock()
				if githubHasActivityDelta(previous, s) {
					a.broadcast("github-activity")
				} else {
					a.broadcast("sync")
				}
				go a.maybeTypeSafeEvaluate(ctx, false, "background-sync")
			}
		} else {
			return
		}
	}
}
func (a *App) run() error {
	ln, err := listenLocal()
	if err != nil {
		return err
	}
	addr := ln.Addr().String()
	url := "http://" + addr + "/"
	ctx, cancel := context.WithCancel(context.Background())
	a.lifecycleMu.Lock()
	a.lifecycleCtx = ctx
	a.lifecycleCancel = cancel
	a.lifecycleMu.Unlock()
	a.server = &http.Server{Handler: a.routes(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 75 * time.Second, MaxHeaderBytes: 1 << 20}
	defer func() {
		cancel()
		a.bgWG.Wait()
		if a.stateUnlock != nil {
			a.stateUnlock()
			a.stateUnlock = nil
		}
	}()
	a.spawn(func() { a.background(ctx) })
	a.spawn(func() { a.hostLoop(ctx) })
	a.spawn(func() { a.worksLoop(ctx) })
	if os.Getenv("WAR_ROOM_NO_BROWSER") != "1" {
		a.spawn(func() {
			if !a.waitDuration(ctx, 350*time.Millisecond) {
				return
			}
			if err := openAppWindow(url); err != nil {
				a.log.Printf("open browser: %v", err)
			}
		})
	}
	a.log.Printf("War Room %s listening on %s", version, url)
	err = a.server.Serve(ln)
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
func listenLocal() (net.Listener, error) {
	for p := 37621; p < 37631; p++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ln, nil
		}
	}
	return net.Listen("tcp", "127.0.0.1:0")
}
