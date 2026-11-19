package ops

import (
	"fmt"
	"sort"
	"strings"

	"github.com/abcdlsj/hark/internal/core/model"
)

// VarItem is one placeholder as shown to a human or an agent. Secret values
// are masked; they never leave the machine in text form.
type VarItem struct {
	Key    string `json:"key"`
	Value  string `json:"value"`
	Scope  string `json:"scope"`
	Secret bool   `json:"secret"`
}

// Vars returns the merged placeholder table for an environment, global keys
// first, then environment overrides.
func (o *Ops) Vars(env string) ([]VarItem, error) {
	envs, err := o.Store.Envs()
	if err != nil {
		return nil, err
	}
	env = envs.EffectiveEnv(env)
	seen := map[string]VarItem{}
	for k, v := range envs.Global {
		seen[k] = VarItem{Key: k, Value: maskValue(v), Scope: "global", Secret: v.Secret}
	}
	if env != "" {
		for k, v := range envs.Environments[env] {
			seen[k] = VarItem{Key: k, Value: maskValue(v), Scope: env, Secret: v.Secret}
		}
	}
	out := make([]VarItem, 0, len(seen))
	for _, v := range seen {
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out, nil
}

// SetVar writes a placeholder. scope "global" (or empty) writes to the global
// block; any other value writes to that environment.
func (o *Ops) SetVar(scope, key, value string, secret bool) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("variable name must not be empty")
	}
	envs, err := o.envs()
	if err != nil {
		return err
	}
	if scope == "" {
		scope = "global"
	}
	target := envs.Global
	if scope != "global" {
		if envs.Environments == nil {
			envs.Environments = map[string]map[string]model.EnvVar{}
		}
		if envs.Environments[scope] == nil {
			envs.Environments[scope] = map[string]model.EnvVar{}
		}
		target = envs.Environments[scope]
	}
	if secret {
		if err := o.Secrets.Set(scope, key, value); err != nil {
			return fmt.Errorf("keychain: %w", err)
		}
		target[key] = model.EnvVar{Secret: true}
	} else {
		if prev, ok := target[key]; ok && prev.Secret {
			_ = o.Secrets.Delete(scope, key)
		}
		target[key] = model.EnvVar{Value: value}
	}
	if err := o.Store.SaveEnvs(envs); err != nil {
		return err
	}
	o.emit(EventEnvChanged, map[string]string{"env": envs.Current, "scope": scope, "key": key})
	return nil
}

// EnsureEnv creates an environment if it does not exist yet.
func (o *Ops) EnsureEnv(name string) error {
	envs, err := o.envs()
	if err != nil {
		return err
	}
	if _, ok := envs.Environments[name]; ok {
		return nil
	}
	envs.Environments[name] = map[string]model.EnvVar{}
	return o.Store.SaveEnvs(envs)
}

// EnvNames lists environments, marking the current one.
func (o *Ops) EnvNames() (current string, names []string, err error) {
	envs, err := o.envs()
	if err != nil {
		return "", nil, err
	}
	return envs.Current, envs.EnvNames(), nil
}

func maskValue(v model.EnvVar) string {
	if v.Secret {
		return "[KEYCHAIN_SECRET]"
	}
	return v.Value
}
