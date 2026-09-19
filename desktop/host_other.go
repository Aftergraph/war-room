//go:build !windows

package main

import (
	"bufio"
	"context"
	"os"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

func observeHost(ctx context.Context) HostTelemetry {
	_ = ctx
	h := HostTelemetry{OS: runtime.GOOS, Arch: runtime.GOARCH, CPUPercent: -1, ObservedAt: time.Now().UTC(), Source: "local OS"}
	h.Hostname, _ = os.Hostname()
	if f, err := os.Open("/proc/meminfo"); err == nil {
		defer f.Close()
		var total, avail uint64
		s := bufio.NewScanner(f)
		for s.Scan() {
			p := strings.Fields(s.Text())
			if len(p) < 2 {
				continue
			}
			v, _ := strconv.ParseUint(p[1], 10, 64)
			switch strings.TrimSuffix(p[0], ":") {
			case "MemTotal":
				total = v * 1024
			case "MemAvailable":
				avail = v * 1024
			}
		}
		h.MemoryTotal = total
		h.MemoryFree = avail
		if total > 0 {
			h.MemoryUsed = 100 * (1 - float64(avail)/float64(total))
		}
	}
	var st syscall.Statfs_t
	if err := syscall.Statfs("/", &st); err == nil {
		h.DiskTotal = st.Blocks * uint64(st.Bsize)
		h.DiskFree = st.Bavail * uint64(st.Bsize)
		if h.DiskTotal > 0 {
			h.DiskUsed = 100 * (1 - float64(h.DiskFree)/float64(h.DiskTotal))
		}
	}
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	h.GoHeapBytes = ms.HeapAlloc
	return h
}
