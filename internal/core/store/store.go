// Package store reads and writes a workspace on disk: constraint-free YAML for
// APIs and environments, with atomic replacement so a crash never leaves a
// half-written file behind.
package store

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/abcdlsj/apic/internal/core/model"
	"gopkg.in/yaml.v3"
)

// File names inside a workspace.
const (
	EnvsFile        = "envs.yaml"
	CollectionsDir  = "collections"
	HistoryFilename = "history.db"
)

// Store is a handle on one workspace. It is safe for concurrent use.
type Store struct {
	root string

	mu       sync.Mutex
	envs     *model.Envs
	envsMod  time.Time
	envsSize int64
}

// Open prepares a workspace directory, creating the skeleton on first use.
func Open(root string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(root, CollectionsDir), 0o755); err != nil {
		return nil, err
	}
	s := &Store{root: root}
	if _, err := os.Stat(s.EnvsPath()); errors.Is(err, fs.ErrNotExist) {
		def := &model.Envs{
			Current:      "default",
			Global:       map[string]model.EnvVar{"base_url": {Value: "http://localhost:8080"}},
			Environments: map[string]map[string]model.EnvVar{"default": {}},
		}
		if err := s.SaveEnvs(def); err != nil {
			return nil, err
		}
	}
	return s, nil
}

// Root is the workspace directory.
func (s *Store) Root() string { return s.root }

// Name is the last path element, shown in the frameless header.
func (s *Store) Name() string { return filepath.Base(s.root) }

// EnvsPath is <root>/envs.yaml.
func (s *Store) EnvsPath() string { return filepath.Join(s.root, EnvsFile) }

// HistoryPath is <root>/history.db.
func (s *Store) HistoryPath() string { return filepath.Join(s.root, HistoryFilename) }

// APIPath maps an API ID to its YAML file path.
func (s *Store) APIPath(id string) (string, error) {
	if err := model.ValidateID(id); err != nil {
		return "", err
	}
	p := filepath.Join(s.root, CollectionsDir, filepath.FromSlash(id)+".yaml")
	return p, nil
}

// List returns every API in the workspace sorted by ID.
func (s *Store) List() ([]model.API, error) {
	base := filepath.Join(s.root, CollectionsDir)
	var out []model.API
	err := filepath.WalkDir(base, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil
			}
			return err
		}
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".yaml") {
			return nil
		}
		rel, err := filepath.Rel(base, path)
		if err != nil {
			return err
		}
		id := strings.TrimSuffix(filepath.ToSlash(rel), ".yaml")
		api, err := s.Load(id)
		if err != nil {
			// A broken file should not hide the rest of the workspace.
			return nil
		}
		out = append(out, *api)
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

// Load reads one API by ID.
func (s *Store) Load(id string) (*model.API, error) {
	path, err := s.APIPath(id)
	if err != nil {
		return nil, err
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, fmt.Errorf("no such api: %s", id)
		}
		return nil, err
	}
	var api model.API
	if err := yaml.Unmarshal(raw, &api); err != nil {
		return nil, fmt.Errorf("%s: %w", id, err)
	}
	api.ID = id
	api.Normalize()
	return &api, nil
}

// Save writes an API atomically and stamps provenance.
func (s *Store) Save(api *model.API, actor string) error {
	if err := model.ValidateID(api.ID); err != nil {
		return err
	}
	api.Normalize()
	api.Meta.UpdatedBy = actor
	api.Meta.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	path, err := s.APIPath(api.ID)
	if err != nil {
		return err
	}
	raw, err := marshalYAML(api)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return writeAtomic(path, raw, 0o644)
}

// Delete removes an API file and prunes empty parent directories.
func (s *Store) Delete(id string) error {
	path, err := s.APIPath(id)
	if err != nil {
		return err
	}
	if err := os.Remove(path); err != nil {
		return err
	}
	base := filepath.Join(s.root, CollectionsDir)
	for dir := filepath.Dir(path); dir != base && strings.HasPrefix(dir, base); dir = filepath.Dir(dir) {
		if err := os.Remove(dir); err != nil {
			break
		}
	}
	return nil
}

// Envs returns the parsed envs.yaml, cached until the file changes on disk.
func (s *Store) Envs() (*model.Envs, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	st, err := os.Stat(s.EnvsPath())
	if err != nil {
		return nil, err
	}
	if s.envs != nil && st.ModTime().Equal(s.envsMod) && st.Size() == s.envsSize {
		return s.envs, nil
	}
	raw, err := os.ReadFile(s.EnvsPath())
	if err != nil {
		return nil, err
	}
	var envs model.Envs
	if err := yaml.Unmarshal(raw, &envs); err != nil {
		return nil, fmt.Errorf("envs.yaml: %w", err)
	}
	if envs.Global == nil {
		envs.Global = map[string]model.EnvVar{}
	}
	if envs.Environments == nil {
		envs.Environments = map[string]map[string]model.EnvVar{}
	}
	s.envs, s.envsMod, s.envsSize = &envs, st.ModTime(), st.Size()
	return &envs, nil
}

// SaveEnvs writes envs.yaml atomically.
func (s *Store) SaveEnvs(e *model.Envs) error {
	if e.Global == nil {
		e.Global = map[string]model.EnvVar{}
	}
	if e.Environments == nil {
		e.Environments = map[string]map[string]model.EnvVar{}
	}
	raw, err := marshalYAML(e)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(s.root, 0o755); err != nil {
		return err
	}
	if err := writeAtomic(s.EnvsPath(), raw, 0o644); err != nil {
		return err
	}
	s.mu.Lock()
	s.envs = nil
	s.mu.Unlock()
	return nil
}

// marshalYAML encodes with two-space indentation, which reads better in diffs.
func marshalYAML(v any) ([]byte, error) {
	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	if err := enc.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// writeAtomic writes data to a temp file in the same directory, fsyncs it, then
// renames it over the target.
func writeAtomic(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, "."+filepath.Base(path)+".tmp*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpName, perm); err != nil {
		return err
	}
	return os.Rename(tmpName, path)
}
