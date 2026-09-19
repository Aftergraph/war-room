//go:build windows

package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

var (
	crypt32       = syscall.NewLazyDLL("crypt32.dll")
	kernel32      = syscall.NewLazyDLL("kernel32.dll")
	procProtect   = crypt32.NewProc("CryptProtectData")
	procUnprotect = crypt32.NewProc("CryptUnprotectData")
	procLocalFree = kernel32.NewProc("LocalFree")
)

type Vault struct {
	path   string
	values map[string]string
}

func newVault(baseDir string) (*Vault, error) {
	v := &Vault{path: filepath.Join(baseDir, "vault.json"), values: map[string]string{}}
	b, err := os.ReadFile(v.path)
	if err == nil {
		_ = json.Unmarshal(b, &v.values)
	}
	return v, nil
}
func bytesToBlob(b []byte) *dataBlob {
	if len(b) == 0 {
		return &dataBlob{}
	}
	return &dataBlob{cbData: uint32(len(b)), pbData: &b[0]}
}
func blobToBytes(b *dataBlob) []byte {
	if b.cbData == 0 || b.pbData == nil {
		return nil
	}
	src := unsafe.Slice(b.pbData, b.cbData)
	out := append([]byte(nil), src...)
	return out
}
func protectBytes(in []byte) ([]byte, error) {
	var out dataBlob
	r, _, e := procProtect.Call(uintptr(unsafe.Pointer(bytesToBlob(in))), 0, 0, 0, 0, 0x1, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, e
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(out.pbData)))
	return blobToBytes(&out), nil
}
func unprotectBytes(in []byte) ([]byte, error) {
	var out dataBlob
	r, _, e := procUnprotect.Call(uintptr(unsafe.Pointer(bytesToBlob(in))), 0, 0, 0, 0, 0x1, uintptr(unsafe.Pointer(&out)))
	if r == 0 {
		return nil, e
	}
	defer procLocalFree.Call(uintptr(unsafe.Pointer(out.pbData)))
	return blobToBytes(&out), nil
}
func (v *Vault) Set(key, val string) error {
	enc, err := protectBytes([]byte(val))
	if err != nil {
		return err
	}
	v.values[key] = base64.StdEncoding.EncodeToString(enc)
	b, _ := json.MarshalIndent(v.values, "", "  ")
	return os.WriteFile(v.path, b, 0600)
}
func (v *Vault) Get(key string) (string, error) {
	x := v.values[key]
	if x == "" {
		return "", errors.New("secret not found")
	}
	raw, err := base64.StdEncoding.DecodeString(x)
	if err != nil {
		return "", err
	}
	plain, err := unprotectBytes(raw)
	return string(plain), err
}
func (v *Vault) Delete(key string) error {
	delete(v.values, key)
	b, _ := json.MarshalIndent(v.values, "", "  ")
	return os.WriteFile(v.path, b, 0600)
}
