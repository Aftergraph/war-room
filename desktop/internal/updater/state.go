package updater

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

const stateSchema = "aftergraph.war-room.state"

type stateEnvelope struct {
	Schema  string `json:"schema"`
	Version int    `json:"version"`
}

func PreflightState(stateDir string, contract StateContract) error {
	if contract.MinVersion <= 0 || contract.MaxVersion < contract.MinVersion {
		return errors.New("invalid state compatibility range")
	}
	return filepath.WalkDir(stateDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() || !strings.HasSuffix(strings.ToLower(d.Name()), ".json") {
			return nil
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		var env stateEnvelope
		if json.Unmarshal(b, &env) != nil || env.Schema != stateSchema {
			return nil
		}
		if env.Version < contract.MinVersion || env.Version > contract.MaxVersion {
			return fmt.Errorf("%s uses unsupported state version %d (target supports %d..%d)", d.Name(), env.Version, contract.MinVersion, contract.MaxVersion)
		}
		return nil
	})
}

func SnapshotState(stateDir, backupDir string) error {
	stateAbs, err := filepath.Abs(stateDir)
	if err != nil {
		return err
	}
	backupAbs, err := filepath.Abs(backupDir)
	if err != nil {
		return err
	}
	rel, err := filepath.Rel(stateAbs, backupAbs)
	if err == nil && rel != "." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) && rel != ".." {
		return errors.New("backup directory must not be inside the live state directory")
	}
	if err := os.MkdirAll(backupAbs, 0700); err != nil {
		return err
	}
	return filepath.WalkDir(stateAbs, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(stateAbs, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		dst := filepath.Join(backupAbs, "state", rel)
		if d.IsDir() {
			return os.MkdirAll(dst, 0700)
		}
		return copyFile(path, dst, 0600)
	})
}

func copyFile(src, dst string, mode os.FileMode) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	if err := os.MkdirAll(filepath.Dir(dst), 0700); err != nil {
		return err
	}
	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	syncErr := out.Sync()
	closeErr := out.Close()
	if copyErr != nil {
		return copyErr
	}
	if syncErr != nil {
		return syncErr
	}
	return closeErr
}
