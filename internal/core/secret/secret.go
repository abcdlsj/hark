// Package secret stores placeholder values in the operating system credential
// store: macOS Keychain, Windows Credential Manager, Linux Secret Service.
package secret

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/zalando/go-keyring"
)

// Store maps (workspace, scope, key) to a credential entry. Values never land
// on disk in plain text.
type Store struct {
	workspace string
	service   string
}

// New returns a keychain store scoped to one workspace directory.
func New(workspaceRoot string) *Store {
	return &Store{
		workspace: filepath.Base(workspaceRoot),
		service:   "apic",
	}
}

// account is human-recognisable in Keychain Access while still collision-free
// across workspaces: base name plus scope and key.
func (s *Store) account(scope, key string) string {
	return fmt.Sprintf("%s/%s/%s", s.workspace, scope, key)
}

// Set writes a secret value.
func (s *Store) Set(scope, key, value string) error {
	return keyring.Set(s.service, s.account(scope, key), value)
}

// Get reads a secret value. It returns an empty string with an error when the
// item is missing.
func (s *Store) Get(scope, key string) (string, error) {
	v, err := keyring.Get(s.service, s.account(scope, key))
	if err != nil {
		return "", err
	}
	return v, nil
}

// Delete removes a secret value.
func (s *Store) Delete(scope, key string) error {
	err := keyring.Delete(s.service, s.account(scope, key))
	if err != nil && !strings.Contains(err.Error(), "not found") {
		return err
	}
	return nil
}
