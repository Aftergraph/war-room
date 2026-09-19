//go:build !windows

package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
)

// Development fallback only. Release target is Windows and uses DPAPI in secrets_windows.go.
type Vault struct {
	path   string
	values map[string]string
}

func newVault(baseDir string) (*Vault, error) {
	v := &Vault{path: filepath.Join(baseDir, "vault.dev.json"), values: map[string]string{}}
	b, err := os.ReadFile(v.path)
	if err == nil {
		_ = json.Unmarshal(b, &v.values)
	}
	return v, nil
}
func (v *Vault) Set(k, x string) error {
	v.values[k] = x
	b, _ := json.MarshalIndent(v.values, "", "  ")
	return os.WriteFile(v.path, b, 0600)
}
func (v *Vault) Get(k string) (string, error) {
	x := v.values[k]
	if x == "" {
		return "", errors.New("secret not found")
	}
	return x, nil
}
func (v *Vault) Delete(k string) error {
	delete(v.values, k)
	b, _ := json.MarshalIndent(v.values, "", "  ")
	return os.WriteFile(v.path, b, 0600)
}
