//go:build windows

package main

import (
	"crypto/sha256"
	"fmt"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	lockKernel32     = syscall.NewLazyDLL("kernel32.dll")
	procCreateMutexW = lockKernel32.NewProc("CreateMutexW")
	procCloseHandle  = lockKernel32.NewProc("CloseHandle")
)

const errorAlreadyExists = 183

func acquireStateLock(baseDir string) (func(), error) {
	abs, err := filepath.Abs(baseDir)
	if err != nil {
		return nil, err
	}
	sum := sha256.Sum256([]byte(filepath.Clean(abs)))
	name, _ := syscall.UTF16PtrFromString(fmt.Sprintf("Local\\AftergraphWarRoom-%x", sum[:12]))
	h, _, callErr := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return nil, fmt.Errorf("create instance mutex: %v", callErr)
	}
	if errno, ok := callErr.(syscall.Errno); ok && errno == errorAlreadyExists {
		procCloseHandle.Call(h)
		return nil, fmt.Errorf("war room state directory is already locked")
	}
	return func() { procCloseHandle.Call(h) }, nil
}
