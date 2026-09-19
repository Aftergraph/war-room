//go:build windows

package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"runtime"
	"time"
)

func observeHost(ctx context.Context) HostTelemetry {
	h := HostTelemetry{OS: runtime.GOOS, Arch: runtime.GOARCH, ObservedAt: time.Now().UTC(), Source: "Windows CIM"}
	h.Hostname, _ = os.Hostname()
	script := `$os=Get-CimInstance Win32_OperatingSystem;$cpu=(Get-CimInstance Win32_Processor|Measure-Object -Property LoadPercentage -Average).Average;$d=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'";[pscustomobject]@{cpu=[double]$cpu;memTotal=[double]$os.TotalVisibleMemorySize*1024;memFree=[double]$os.FreePhysicalMemory*1024;diskTotal=[double]$d.Size;diskFree=[double]$d.FreeSpace}|ConvertTo-Json -Compress`
	cctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	b, err := exec.CommandContext(cctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script).Output()
	if err != nil {
		h.Error = err.Error()
		return h
	}
	var x struct {
		CPU, MemTotal, MemFree, DiskTotal, DiskFree float64 `json:"-"`
	}
	var raw map[string]float64
	if err := json.Unmarshal(b, &raw); err != nil {
		h.Error = err.Error()
		return h
	}
	h.CPUPercent = raw["cpu"]
	h.MemoryTotal = uint64(raw["memTotal"])
	h.MemoryFree = uint64(raw["memFree"])
	h.DiskTotal = uint64(raw["diskTotal"])
	h.DiskFree = uint64(raw["diskFree"])
	if h.MemoryTotal > 0 {
		h.MemoryUsed = 100 * (1 - float64(h.MemoryFree)/float64(h.MemoryTotal))
	}
	if h.DiskTotal > 0 {
		h.DiskUsed = 100 * (1 - float64(h.DiskFree)/float64(h.DiskTotal))
	}
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	h.GoHeapBytes = ms.HeapAlloc
	_ = x
	return h
}
