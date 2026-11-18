// Package workspace decides which directory holds the collections, envs.yaml
// and history.db, and where the per-user IPC socket lives.
package workspace

import (
	"os"
	"path/filepath"
)

// Marker is the file that identifies a directory as an apic workspace.
const Marker = "envs.yaml"

// Resolve returns the workspace root. Precedence:
//
//  1. explicit path
//  2. $APIC_WORKSPACE
//  3. the nearest ancestor of the current directory containing envs.yaml
//  4. <home>/.apic
func Resolve(explicit string) (string, error) {
	if explicit != "" {
		return absExpand(explicit)
	}
	if env := os.Getenv("APIC_WORKSPACE"); env != "" {
		return absExpand(env)
	}
	if cwd, err := os.Getwd(); err == nil {
		for dir := cwd; ; dir = filepath.Dir(dir) {
			if _, err := os.Stat(filepath.Join(dir, Marker)); err == nil {
				return dir, nil
			}
			if filepath.Dir(dir) == dir {
				break
			}
		}
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".apic"), nil
}

// ConfigDir is where per-machine, non-synced state lives (IPC socket, recent
// workspaces).
func ConfigDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "apic"), nil
}

func absExpand(p string) (string, error) {
	if p == "~" || len(p) > 1 && p[0] == '~' && p[1] == '/' {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		p = filepath.Join(home, p[1:])
	}
	return filepath.Abs(p)
}
