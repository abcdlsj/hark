package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/abcdlsj/apic/internal/core/curlx"
	"github.com/abcdlsj/apic/internal/core/exec"
	"github.com/abcdlsj/apic/internal/core/history"
	"github.com/abcdlsj/apic/internal/core/ipc"
	"github.com/abcdlsj/apic/internal/core/model"
	"github.com/abcdlsj/apic/internal/core/ops"
	"github.com/abcdlsj/apic/internal/core/workspace"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// AppService is the only bridge between the webview and the core. Every method
// that mutates the workspace or sends a request goes through ops, so the
// desktop stays the single writer while it runs.
type AppService struct {
	app *application.App

	mu   sync.Mutex
	o    *ops.Ops
	srv  *ipc.Server
	root string

	cancelMu sync.Mutex
	cancel   context.CancelFunc
}

// Bootstrap is everything the first paint needs.
type Bootstrap struct {
	Workspace    string         `json:"workspace"`
	Root         string         `json:"root"`
	Env          string         `json:"env"`
	Environments []string       `json:"environments"`
	APIs         []ops.ListItem `json:"apis"`
	Vars         []ops.VarItem  `json:"vars"`
	History      []history.Log  `json:"history"`
	Guide        string         `json:"guide"`
	Platform     string         `json:"platform"`
}

// SaveOut reports the side effects of a save.
type SaveOut struct {
	ID       string   `json:"id"`
	Replaced []string `json:"replaced,omitempty"`
	NewToken string   `json:"new_token,omitempty"`
}

// RunRequest runs the editor buffer as-is.
type RunRequest struct {
	API   model.API `json:"api"`
	Env   string    `json:"env,omitempty"`
	Actor string    `json:"actor,omitempty"`
}

// RunView is one completed execution, shaped for the inspector.
type RunView struct {
	LogID           int64               `json:"log_id"`
	APIID           string              `json:"api_id"`
	Method          string              `json:"method"`
	URL             string              `json:"url"`
	Env             string              `json:"env"`
	Actor           string              `json:"actor"`
	Status          int                 `json:"status"`
	StatusText      string              `json:"status_text"`
	DurationMS      float64             `json:"duration_ms"`
	Size            int64               `json:"size"`
	Timings         exec.Timings        `json:"timings"`
	RequestHeaders  map[string][]string `json:"request_headers"`
	ResponseHeaders map[string][]string `json:"response_headers"`
	Body            string              `json:"body"`
	Truncated       bool                `json:"truncated"`
	Error           string              `json:"error,omitempty"`
}

// ParseOut is a cURL import, ready for the editor.
type ParseOut struct {
	API      model.API `json:"api"`
	Warnings []string  `json:"warnings,omitempty"`
	Replaced []string  `json:"replaced,omitempty"`
	NewToken string    `json:"new_token,omitempty"`
}

// Platform reports the OS so the header can draw the right window controls.
func (s *AppService) Platform() string { return runtime.GOOS }

// start opens the workspace and starts the IPC socket.
func (s *AppService) start() error {
	root, err := workspace.Resolve("")
	if err != nil {
		return err
	}
	if err := s.open(root); err != nil {
		return err
	}
	socket, err := ipc.SocketPath()
	if err != nil {
		return err
	}
	srv, err := ipc.Serve(socket, func(req ipc.Request) ipc.Response {
		o := s.ops()
		if o == nil {
			return ipc.Response{Error: "workspace not ready"}
		}
		return ipc.NewHandler(o)(req)
	})
	if err != nil {
		// A second instance must not stop the app from opening.
		fmt.Fprintln(os.Stderr, "ipc:", err)
	}
	s.mu.Lock()
	s.srv = srv
	s.mu.Unlock()
	return nil
}

func (s *AppService) stop() {
	s.mu.Lock()
	srv, o := s.srv, s.o
	s.srv, s.o = nil, nil
	s.mu.Unlock()
	if srv != nil {
		srv.Close()
	}
	if o != nil {
		o.Close()
	}
}

// open replaces the current workspace.
func (s *AppService) open(root string) error {
	o, err := ops.New(root, nil, func(name string, data any) {
		if s.app != nil {
			// All payloads are objects; the frontend treats them as untyped maps.
			if m, ok := data.(map[string]any); ok {
				s.app.Event.Emit(name, m)
				return
			}
			s.app.Event.Emit(name, map[string]any{"value": data})
		}
	})
	if err != nil {
		return err
	}
	o.Actor = ops.ActorHuman

	s.mu.Lock()
	prev := s.o
	s.o, s.root = o, root
	s.mu.Unlock()
	if prev != nil {
		prev.Close()
	}
	s.remember(root)
	return nil
}

func (s *AppService) ops() *ops.Ops {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.o
}

// Bootstrap loads the window state in one round trip.
func (s *AppService) Bootstrap() (Bootstrap, error) {
	o := s.ops()
	if o == nil {
		return Bootstrap{}, errors.New("workspace not ready")
	}
	envs, err := o.Store.Envs()
	if err != nil {
		return Bootstrap{}, err
	}
	apis, err := o.List("")
	if err != nil {
		return Bootstrap{}, err
	}
	vars, err := o.Vars("")
	if err != nil {
		return Bootstrap{}, err
	}
	logs, err := o.History(40)
	if err != nil {
		return Bootstrap{}, err
	}
	guide, err := o.Guide()
	if err != nil {
		return Bootstrap{}, err
	}
	return Bootstrap{
		Workspace:    o.WorkspaceName(),
		Root:         o.Root(),
		Env:          envs.Current,
		Environments: envs.EnvNames(),
		APIs:         apis,
		Vars:         vars,
		History:      logs,
		Guide:        guide,
		Platform:     runtime.GOOS,
	}, nil
}

// Reload re-reads the workspace from disk, for changes made while the app was
// closed or by another process.
func (s *AppService) Reload() (Bootstrap, error) { return s.Bootstrap() }

// ListAPIs returns collection rows.
func (s *AppService) ListAPIs(prefix string) ([]ops.ListItem, error) {
	o := s.ops()
	if o == nil {
		return nil, errors.New("workspace not ready")
	}
	return o.List(prefix)
}

// GetAPI loads one API for the editor.
func (s *AppService) GetAPI(id string) (model.API, error) {
	o := s.ops()
	if o == nil {
		return model.API{}, errors.New("workspace not ready")
	}
	api, err := o.Show(id)
	if err != nil {
		return model.API{}, err
	}
	return *api, nil
}

// SaveAPI persists an editor buffer.
func (s *AppService) SaveAPI(api model.API, autoVar bool) (SaveOut, error) {
	o := s.ops()
	if o == nil {
		return SaveOut{}, errors.New("workspace not ready")
	}
	res, err := o.Save(ops.SaveParams{ID: api.ID, API: &api, AutoVar: autoVar})
	if err != nil {
		return SaveOut{}, err
	}
	return SaveOut{ID: res.API.ID, Replaced: res.Replaced, NewToken: res.NewToken}, nil
}

// DeleteAPI removes one API.
func (s *AppService) DeleteAPI(id string) error {
	o := s.ops()
	if o == nil {
		return errors.New("workspace not ready")
	}
	return o.Delete(id)
}

// Run sends the editor buffer and records the execution.
func (s *AppService) Run(req RunRequest) (RunView, error) {
	o := s.ops()
	if o == nil {
		return RunView{}, errors.New("workspace not ready")
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelMu.Lock()
	s.cancel = cancel
	s.cancelMu.Unlock()
	defer func() {
		s.cancelMu.Lock()
		s.cancel = nil
		s.cancelMu.Unlock()
		cancel()
	}()

	actor := req.Actor
	if actor == "" {
		actor = ops.ActorHuman
	}
	out, err := o.Run(ctx, ops.RunParams{API: &req.API, ID: req.API.ID, Env: req.Env, Actor: actor})
	if err != nil {
		return RunView{}, err
	}
	r := out.Result
	return RunView{
		LogID:           out.LogID,
		APIID:           r.APIID,
		Method:          r.Method,
		URL:             r.URL,
		Env:             r.Env,
		Actor:           r.Actor,
		Status:          r.Status,
		StatusText:      r.StatusText,
		DurationMS:      r.DurationMS,
		Size:            r.Size,
		Timings:         r.Timings,
		RequestHeaders:  r.RequestHeaders,
		ResponseHeaders: r.ResponseHeader,
		Body:            r.BodyText,
		Truncated:       r.Truncated,
		Error:           r.Error,
	}, nil
}

// CancelRun aborts the in-flight request.
func (s *AppService) CancelRun() {
	s.cancelMu.Lock()
	cancel := s.cancel
	s.cancelMu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// ExportCurl renders a saved API as cURL.
func (s *AppService) ExportCurl(id string, resolve bool) (string, error) {
	o := s.ops()
	if o == nil {
		return "", errors.New("workspace not ready")
	}
	api, err := o.Show(id)
	if err != nil {
		return "", err
	}
	return s.ExportCurlFor(*api, resolve)
}

// ExportCurlFor renders an unsaved editor buffer as cURL.
func (s *AppService) ExportCurlFor(api model.API, resolve bool) (string, error) {
	o := s.ops()
	if o == nil {
		return "", errors.New("workspace not ready")
	}
	return o.ExportCurl(&api, "", resolve)
}

// ParseCurl turns a pasted command into editor content, folding known hosts
// into placeholders.
func (s *AppService) ParseCurl(command string) (ParseOut, error) {
	o := s.ops()
	if o == nil {
		return ParseOut{}, errors.New("workspace not ready")
	}
	parsed, err := curlx.Parse(command)
	if err != nil {
		return ParseOut{}, err
	}
	envs, err := o.Store.Envs()
	if err != nil {
		return ParseOut{}, err
	}
	table := envs.Resolve(envs.Current, nil)
	api := model.API{
		Method:  parsed.Method,
		URL:     parsed.URL,
		Query:   parsed.Query,
		Headers: parsed.Headers,
		Body:    parsed.Body,
		Auth:    parsed.Auth,
	}
	api.URL = curlx.ReplaceHardcodedValues(api.URL, table).Value
	for i := range api.Headers {
		api.Headers[i].Value = curlx.ReplaceHardcodedValues(api.Headers[i].Value, table).Value
	}
	api.Body.Content = curlx.ReplaceHardcodedValues(api.Body.Content, table).Value
	api.Normalize()
	out := ParseOut{API: api, Warnings: parsed.Warnings}
	if token, _ := curlx.DetectPlaintextToken(api.Headers); token != "" {
		out.NewToken = token
	}
	return out, nil
}

// SetEnv switches the current environment.
func (s *AppService) SetEnv(name string) error {
	o := s.ops()
	if o == nil {
		return errors.New("workspace not ready")
	}
	return o.SetEnv(name)
}

// Vars lists placeholders with secrets masked.
func (s *AppService) Vars(env string) ([]ops.VarItem, error) {
	o := s.ops()
	if o == nil {
		return nil, errors.New("workspace not ready")
	}
	return o.Vars(env)
}

// SetVar writes a placeholder.
func (s *AppService) SetVar(scope, key, value string, secret bool) error {
	o := s.ops()
	if o == nil {
		return errors.New("workspace not ready")
	}
	return o.SetVar(scope, key, value, secret)
}

// History returns recent executions for the pulse.
func (s *AppService) History(limit int) ([]history.Log, error) {
	o := s.ops()
	if o == nil {
		return nil, errors.New("workspace not ready")
	}
	return o.History(limit)
}

// GetLog loads one execution for snapshot viewing.
func (s *AppService) GetLog(id int64) (history.Log, error) {
	o := s.ops()
	if o == nil {
		return history.Log{}, errors.New("workspace not ready")
	}
	log, err := o.GetLog(id)
	if err != nil {
		return history.Log{}, err
	}
	return *log, nil
}

// PruneHistory trims the execution log.
func (s *AppService) PruneHistory(keep int) error {
	o := s.ops()
	if o == nil {
		return errors.New("workspace not ready")
	}
	return o.DB.Prune(keep)
}

// Guide is the agent briefing, also copied by the command palette.
func (s *AppService) Guide() (string, error) {
	o := s.ops()
	if o == nil {
		return "", errors.New("workspace not ready")
	}
	return o.Guide()
}

// UseWorkspace switches to an explicit directory.
func (s *AppService) UseWorkspace(path string) (Bootstrap, error) {
	if path == "" {
		return Bootstrap{}, errors.New("no workspace path given")
	}
	if err := s.open(path); err != nil {
		return Bootstrap{}, err
	}
	return s.Bootstrap()
}

// PickWorkspace opens a native directory picker.
func (s *AppService) PickWorkspace() (Bootstrap, error) {
	if s.app == nil {
		return Bootstrap{}, errors.New("app not ready")
	}
	dir, err := s.app.Dialog.OpenFile().
		CanChooseDirectories(true).
		CanChooseFiles(false).
		SetTitle("Choose an apic workspace").
		PromptForSingleSelection()
	if err != nil || dir == "" {
		return Bootstrap{}, err
	}
	return s.UseWorkspace(dir)
}

// RecentWorkspaces lists recently opened workspaces, newest first.
func (s *AppService) RecentWorkspaces() []string {
	path, err := recentsPath()
	if err != nil {
		return nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var list []string
	_ = json.Unmarshal(raw, &list)
	return list
}

func (s *AppService) remember(root string) {
	path, err := recentsPath()
	if err != nil {
		return
	}
	list := s.RecentWorkspaces()
	out := []string{root}
	for _, p := range list {
		if p != root {
			out = append(out, p)
		}
	}
	if len(out) > 8 {
		out = out[:8]
	}
	raw, err := json.Marshal(out)
	if err != nil {
		return
	}
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	_ = os.WriteFile(path, raw, 0o644)
}

func recentsPath() (string, error) {
	dir, err := workspace.ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "recent.json"), nil
}
