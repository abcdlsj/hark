// Package model defines the on-disk data model shared by the CLI and the
// desktop app.
//
// Two kinds of files live in a workspace:
//
//	envs.yaml                          global + per-environment placeholders
//	collections/<module>/<action>.yaml one API; its path is its ID
package model

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// KV is one row in a query, header, or form table.
type KV struct {
	Key     string `yaml:"key" json:"key"`
	Value   string `yaml:"value" json:"value"`
	Enabled *bool  `yaml:"enabled,omitempty" json:"enabled,omitempty"`
}

// IsEnabled reports whether the row takes part in the request. A missing
// enabled flag means enabled, which keeps hand-written YAML short.
func (kv KV) IsEnabled() bool {
	return kv.Enabled == nil || *kv.Enabled
}

// EnabledValue returns a pointer to v, for callers building KV values.
func EnabledValue(v bool) *bool { return &v }

// Body types.
const (
	BodyNone       = "none"
	BodyJSON       = "json"
	BodyForm       = "form"
	BodyURLEncoded = "urlencoded"
	BodyRaw        = "raw"
)

// Body is the request payload.
type Body struct {
	Type    string `yaml:"type" json:"type"`
	Content string `yaml:"content,omitempty" json:"content"`
}

// Auth types. Auth is sugar over the Authorization header.
const (
	AuthNone   = "none"
	AuthBearer = "bearer"
	AuthBasic  = "basic"
)

// Auth describes how Authorization is produced.
type Auth struct {
	Type     string `yaml:"type" json:"type"`
	Token    string `yaml:"token,omitempty" json:"token,omitempty"`
	Username string `yaml:"username,omitempty" json:"username,omitempty"`
	Password string `yaml:"password,omitempty" json:"password,omitempty"`
}

// Meta records provenance so the desktop can flag agent-made changes.
type Meta struct {
	UpdatedBy string `yaml:"updated_by,omitempty" json:"updated_by,omitempty"`
	UpdatedAt string `yaml:"updated_at,omitempty" json:"updated_at,omitempty"`
}

// API is one saved request.
type API struct {
	// ID is derived from the file path and is not stored in the YAML.
	ID      string `yaml:"-" json:"id"`
	Name    string `yaml:"name" json:"name"`
	Method  string `yaml:"method" json:"method"`
	URL     string `yaml:"url" json:"url"`
	Headers []KV   `yaml:"headers,omitempty" json:"headers,omitempty"`
	Query   []KV   `yaml:"query,omitempty" json:"query,omitempty"`
	Body    Body   `yaml:"body,omitempty" json:"body"`
	Auth    Auth   `yaml:"auth,omitempty" json:"auth"`
	Meta    Meta   `yaml:"meta,omitempty" json:"meta"`
}

// Normalize fills defaults so every consumer sees the same shape.
func (a *API) Normalize() {
	a.Method = strings.ToUpper(strings.TrimSpace(a.Method))
	if a.Method == "" {
		a.Method = "GET"
	}
	if a.Body.Type == "" {
		a.Body.Type = BodyNone
	}
	if a.Auth.Type == "" {
		a.Auth.Type = AuthNone
	}
	if a.Name == "" {
		a.Name = a.ID
	}
}

// Module returns the collection directory an API belongs to.
func (a *API) Module() string {
	if i := strings.LastIndex(a.ID, "/"); i >= 0 {
		return a.ID[:i]
	}
	return ""
}

// Action returns the last path segment of an API ID.
func (a *API) Action() string {
	if i := strings.LastIndex(a.ID, "/"); i >= 0 {
		return a.ID[i+1:]
	}
	return a.ID
}

// EnvVar is one placeholder value. Secret variables keep their value in the OS
// keychain; the YAML file only carries secret: true.
type EnvVar struct {
	Value  string `yaml:"value,omitempty" json:"value,omitempty"`
	Secret bool   `yaml:"secret,omitempty" json:"secret,omitempty"`
}

// UnmarshalYAML accepts either a plain scalar (non-secret) or a mapping with
// value/secret keys.
func (v *EnvVar) UnmarshalYAML(node *yaml.Node) error {
	if node.Kind == yaml.ScalarNode {
		return node.Decode(&v.Value)
	}
	type raw EnvVar
	var r raw
	if err := node.Decode(&r); err != nil {
		return err
	}
	*v = EnvVar(r)
	return nil
}

// MarshalYAML keeps non-secret variables as plain scalars and writes secret
// ones as {secret: true} so no value ever lands in plain text.
func (v EnvVar) MarshalYAML() (any, error) {
	if v.Secret {
		return map[string]bool{"secret": true}, nil
	}
	return v.Value, nil
}

// Envs is the whole envs.yaml file.
type Envs struct {
	Current      string                       `yaml:"current" json:"current"`
	Global       map[string]EnvVar            `yaml:"global,omitempty" json:"global,omitempty"`
	Environments map[string]map[string]EnvVar `yaml:"environments,omitempty" json:"environments,omitempty"`
}

// EnvNames returns environment names in YAML order-insensitive sorted form.
func (e *Envs) EnvNames() []string {
	names := make([]string, 0, len(e.Environments))
	for name := range e.Environments {
		names = append(names, name)
	}
	sortStrings(names)
	return names
}

// Resolve builds the flat placeholder map for one environment. Precedence is
// overrides > environment > global, matching docs §6.3.
func (e *Envs) Resolve(env string, overrides map[string]string) map[string]EnvVar {
	out := make(map[string]EnvVar, len(e.Global)+8)
	for k, v := range e.Global {
		out[k] = v
	}
	if env != "" {
		for k, v := range e.Environments[env] {
			out[k] = v
		}
	}
	for k, v := range overrides {
		out[k] = EnvVar{Value: v}
	}
	return out
}

// EffectiveEnv returns env if set, otherwise the file's current environment.
func (e *Envs) EffectiveEnv(env string) string {
	if env != "" {
		return env
	}
	return e.Current
}

// ValidateID checks that an API ID is a clean relative path with 1..n segments.
func ValidateID(id string) error {
	if id == "" {
		return fmt.Errorf("api id must not be empty")
	}
	if strings.HasPrefix(id, "/") || strings.HasSuffix(id, "/") {
		return fmt.Errorf("api id %q must not start or end with /", id)
	}
	for _, seg := range strings.Split(id, "/") {
		if seg == "" || seg == "." || seg == ".." {
			return fmt.Errorf("api id %q has an empty or relative segment", id)
		}
		for _, r := range seg {
			switch {
			case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			case r == '-', r == '_', r == '.':
			default:
				return fmt.Errorf("api id %q: character %q is not allowed", id, r)
			}
		}
	}
	return nil
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
