// Package vars resolves {{placeholder}} templates against the three variable
// levels: global, the selected environment, and per-call overrides.
package vars

import (
	"sort"
	"strings"

	"github.com/abcdlsj/apic/internal/core/model"
)

// SecretStore reads secret values from the OS keychain.
type SecretStore interface {
	Get(scope, key string) (string, error)
}

// Resolver merges the variable levels once and renders templates from them.
type Resolver struct {
	envs      *model.Envs
	env       string
	overrides map[string]string
	secrets   SecretStore

	table map[string]resolved
	used  map[string]string // plaintext secret value -> key, for redaction
}

type resolved struct {
	value  string
	secret bool
	scope  string
}

// New builds a resolver. secrets may be nil, in which case secret placeholders
// resolve to nothing and are reported as missing.
func New(envs *model.Envs, env string, overrides map[string]string, secrets SecretStore) *Resolver {
	r := &Resolver{envs: envs, env: env, overrides: overrides, secrets: secrets,
		table: map[string]resolved{}, used: map[string]string{}}
	if envs != nil {
		for k, v := range envs.Global {
			r.table[k] = resolved{value: v.Value, secret: v.Secret, scope: "global"}
		}
		if env != "" {
			for k, v := range envs.Environments[env] {
				r.table[k] = resolved{value: v.Value, secret: v.Secret, scope: env}
			}
		}
	}
	for k, v := range overrides {
		r.table[k] = resolved{value: v, scope: "cli"}
	}
	return r
}

// Env is the effective environment name.
func (r *Resolver) Env() string { return r.env }

// Keys lists every available placeholder key, sorted.
func (r *Resolver) Keys() []string {
	out := make([]string, 0, len(r.table))
	for k := range r.table {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// IsSecret reports whether a key is keychain-backed.
func (r *Resolver) IsSecret(key string) bool {
	if v, ok := r.table[key]; ok {
		return v.secret
	}
	return false
}

// Lookup resolves one placeholder value.
func (r *Resolver) Lookup(key string) (string, bool) {
	v, ok := r.table[key]
	if !ok {
		return "", false
	}
	if !v.secret {
		return v.value, true
	}
	if r.secrets == nil {
		return "", false
	}
	plain, err := r.secrets.Get(v.scope, key)
	if err != nil {
		return "", false
	}
	r.used[plain] = key
	return plain, true
}

// Masked returns a display value safe for logs and terminals.
func (r *Resolver) Masked(key string) string {
	if v, ok := r.table[key]; ok && v.secret {
		return "[KEYCHAIN_SECRET]"
	}
	if v, ok := r.table[key]; ok {
		return v.value
	}
	return ""
}

// Refs lists the placeholder keys referenced by a string, sorted.
func Refs(s string) []string {
	seen := map[string]bool{}
	var out []string
	for _, seg := range strings.Split(s, "{{")[1:] {
		i := strings.Index(seg, "}}")
		if i < 0 {
			break
		}
		key := strings.TrimSpace(seg[:i])
		if key != "" && !seen[key] {
			seen[key] = true
			out = append(out, key)
		}
	}
	sort.Strings(out)
	return out
}

// Render substitutes every known placeholder and reports the unknown ones. The
// original placeholder text stays in place when a key cannot be resolved, so a
// half-configured environment never silently sends a literal empty string.
func (r *Resolver) Render(s string) (string, []string) {
	var missing []string
	seenMissing := map[string]bool{}
	out := replaceAll(s, func(key string) (string, bool) {
		if v, ok := r.Lookup(key); ok {
			return v, true
		}
		if !seenMissing[key] {
			seenMissing[key] = true
			missing = append(missing, key)
		}
		return "", false
	})
	sort.Strings(missing)
	return out, missing
}

// UsedSecrets returns plaintext secret values seen so far, keyed by secret
// value. Redaction uses it to scrub output.
func (r *Resolver) UsedSecrets() map[string]string {
	out := make(map[string]string, len(r.used))
	for k, v := range r.used {
		out[k] = v
	}
	return out
}

func replaceAll(s string, resolve func(key string) (string, bool)) string {
	var b strings.Builder
	for {
		start := strings.Index(s, "{{")
		if start < 0 {
			b.WriteString(s)
			break
		}
		end := strings.Index(s[start+2:], "}}")
		if end < 0 {
			b.WriteString(s)
			break
		}
		end += start + 2
		b.WriteString(s[:start])
		key := strings.TrimSpace(s[start+2 : end])
		if v, ok := resolve(key); ok {
			b.WriteString(v)
		} else {
			b.WriteString(s[start : end+2])
		}
		s = s[end+2:]
	}
	return b.String()
}
