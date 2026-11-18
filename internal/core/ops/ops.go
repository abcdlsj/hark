// Package ops is the semantic layer shared by the CLI and the desktop app.
// Every mutation and every request goes through here, so `apic run` in a
// terminal and ⌘↵ in the desktop window behave identically.
package ops

import (
	"fmt"
	"strings"
	"sync"

	"github.com/abcdlsj/apic/internal/core/curlx"
	"github.com/abcdlsj/apic/internal/core/exec"
	"github.com/abcdlsj/apic/internal/core/history"
	"github.com/abcdlsj/apic/internal/core/model"
	"github.com/abcdlsj/apic/internal/core/secret"
	"github.com/abcdlsj/apic/internal/core/store"
	"github.com/abcdlsj/apic/internal/core/vars"
)

// Event names pushed to the desktop frontend.
const (
	EventAPISaved     = "api:saved"
	EventAPIDeleted   = "api:deleted"
	EventRunCompleted = "run:completed"
	EventEnvChanged   = "env:changed"
)

// Actor values recorded in metadata and history.
const (
	ActorAgent = "agent"
	ActorHuman = "human"
)

// Emitter receives events. The desktop forwards them to the webview; the CLI
// leaves it nil.
type Emitter func(name string, data any)

// Ops binds a workspace, its history database and the keychain together.
type Ops struct {
	Store   *store.Store
	DB      *history.DB
	Secrets *secret.Store
	Actor   string
	Emit    Emitter

	mu sync.Mutex
}

// New opens (or creates) everything a workspace needs.
func New(root string, db *history.DB, emit Emitter) (*Ops, error) {
	st, err := store.Open(root)
	if err != nil {
		return nil, err
	}
	if db == nil {
		db, err = history.Open(st.HistoryPath())
		if err != nil {
			return nil, err
		}
	}
	return &Ops{
		Store:   st,
		DB:      db,
		Secrets: secret.New(st.Root()),
		Actor:   ActorAgent,
		Emit:    emit,
	}, nil
}

// Close releases the history database.
func (o *Ops) Close() error {
	if o.DB != nil {
		return o.DB.Close()
	}
	return nil
}

// Root is the workspace directory.
func (o *Ops) Root() string { return o.Store.Root() }

// WorkspaceName is the label shown in the window header.
func (o *Ops) WorkspaceName() string { return o.Store.Name() }

// CurrentEnv is the selected environment.
func (o *Ops) CurrentEnv() (string, error) {
	envs, err := o.Store.Envs()
	if err != nil {
		return "", err
	}
	return envs.Current, nil
}

// SetEnv switches the current environment.
func (o *Ops) SetEnv(name string) error {
	envs, err := o.Store.Envs()
	if err != nil {
		return err
	}
	if name != "" {
		if _, ok := envs.Environments[name]; !ok {
			return fmt.Errorf("unknown environment %q", name)
		}
	}
	envs.Current = name
	if err := o.Store.SaveEnvs(envs); err != nil {
		return err
	}
	o.emit(EventEnvChanged, map[string]string{"env": name})
	return nil
}

// Resolver builds a variable resolver for one environment plus overrides.
func (o *Ops) Resolver(env string, overrides map[string]string) (*vars.Resolver, error) {
	envs, err := o.Store.Envs()
	if err != nil {
		return nil, err
	}
	return vars.New(envs, envs.EffectiveEnv(env), overrides, o.Secrets), nil
}

// ListItem is one compact row of the collection tree.
type ListItem struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Method     string `json:"method"`
	URL        string `json:"url"`
	LastStatus int    `json:"last_status"`
	UpdatedBy  string `json:"updated_by"`
	UpdatedAt  string `json:"updated_at"`
}

// List returns saved APIs, optionally filtered by ID prefix.
func (o *Ops) List(prefix string) ([]ListItem, error) {
	apis, err := o.Store.List()
	if err != nil {
		return nil, err
	}
	statuses, err := o.DB.LastStatuses()
	if err != nil {
		return nil, err
	}
	prefix = strings.TrimSuffix(strings.TrimSpace(prefix), "/")
	out := make([]ListItem, 0, len(apis))
	for _, a := range apis {
		if prefix != "" && a.ID != prefix && !strings.HasPrefix(a.ID, prefix+"/") {
			continue
		}
		out = append(out, ListItem{
			ID:         a.ID,
			Name:       a.Name,
			Method:     a.Method,
			URL:        a.URL,
			LastStatus: statuses[a.ID],
			UpdatedBy:  a.Meta.UpdatedBy,
			UpdatedAt:  a.Meta.UpdatedAt,
		})
	}
	return out, nil
}

// Show loads one API.
func (o *Ops) Show(id string) (*model.API, error) {
	return o.Store.Load(id)
}

// Delete removes one API and notifies the desktop.
func (o *Ops) Delete(id string) error {
	if err := o.Store.Delete(id); err != nil {
		return err
	}
	o.emit(EventAPIDeleted, map[string]string{"id": id})
	return nil
}

// ExportCurl renders an API as a cURL command. With resolve set, placeholders
// are replaced by their real environment values.
func (o *Ops) ExportCurl(api *model.API, env string, resolve bool) (string, error) {
	req := &curlx.Request{
		Method: api.Method, URL: api.URL, Query: api.Query, Headers: api.Headers,
		Body: api.Body, Auth: api.Auth,
	}
	opts := curlx.ExportOptions{}
	if resolve {
		r, err := o.Resolver(env, nil)
		if err != nil {
			return "", err
		}
		opts.Resolve = func(key string) (string, bool) { return r.Lookup(key) }
	}
	return curlx.Export(req, opts), nil
}

// History returns the newest execution records.
func (o *Ops) History(limit int) ([]history.Log, error) {
	return o.DB.Recent(limit)
}

// GetLog loads one execution record for snapshot viewing.
func (o *Ops) GetLog(id int64) (*history.Log, error) {
	return o.DB.Get(id)
}

// envs helper for callers that need a mutable copy.
func (o *Ops) envs() (*model.Envs, error) {
	return o.Store.Envs()
}

func (o *Ops) emit(name string, data any) {
	if o.Emit != nil {
		o.Emit(name, data)
	}
}

// recordRun stores an execution and emits the completion event.
func (o *Ops) recordRun(res *exec.Result) (int64, error) {
	log := history.Record(res)
	id, err := o.DB.Append(log)
	if err != nil {
		return 0, err
	}
	o.emit(EventRunCompleted, map[string]any{
		"id":          id,
		"api_id":      res.APIID,
		"actor":       res.Actor,
		"status":      res.Status,
		"duration_ms": res.DurationMS,
		"env":         res.Env,
	})
	return id, nil
}
