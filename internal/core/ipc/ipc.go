// Package ipc connects the CLI to a running desktop app over a Unix domain
// socket. When the app is up it is the single writer for the workspace; when it
// is down the CLI writes to disk itself.
package ipc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/abcdlsj/hark/internal/core/model"
	"github.com/abcdlsj/hark/internal/core/workspace"
)

// Command names.
const (
	CmdGuide  = "guide"
	CmdLs     = "ls"
	CmdShow   = "show"
	CmdSave   = "save"
	CmdRun    = "run"
	CmdVarLs  = "var.ls"
	CmdVarSet = "var.set"
	CmdEnvLs  = "env.ls"
	CmdEnvUse = "env.use"
)

// ProbeTimeout is how long the CLI waits to decide whether the app is running.
const ProbeTimeout = 5 * time.Millisecond

// Request is one CLI command in wire form.
type Request struct {
	Cmd  string          `json:"cmd"`
	Args json.RawMessage `json:"args,omitempty"`
}

// Response carries rendered text for humans and a structured payload for
// agents using --json.
type Response struct {
	Text  string          `json:"text,omitempty"`
	JSON  json.RawMessage `json:"json,omitempty"`
	Error string          `json:"error,omitempty"`
}

// Args for each command.
type (
	LsArgs struct {
		Prefix string `json:"prefix,omitempty"`
	}
	ShowArgs struct {
		ID   string `json:"id"`
		Curl bool   `json:"curl,omitempty"`
	}
	SaveArgs struct {
		ID      string     `json:"id"`
		Name    string     `json:"name,omitempty"`
		Curl    string     `json:"curl,omitempty"`
		API     *model.API `json:"api,omitempty"`
		AutoVar bool       `json:"auto_var,omitempty"`
		Env     string     `json:"env,omitempty"`
	}
	RunArgs struct {
		ID        string            `json:"id,omitempty"`
		Curl      string            `json:"curl,omitempty"`
		Env       string            `json:"env,omitempty"`
		Overrides map[string]string `json:"overrides,omitempty"`
		JSON      bool              `json:"json,omitempty"`
	}
	VarLsArgs struct {
		Env string `json:"env,omitempty"`
	}
	VarSetArgs struct {
		Key    string `json:"key"`
		Value  string `json:"value"`
		Scope  string `json:"scope,omitempty"`
		Secret bool   `json:"secret,omitempty"`
	}
	EnvUseArgs struct {
		Name string `json:"name"`
	}
)

// SocketPath is the well-known path of the desktop IPC socket.
func SocketPath() (string, error) {
	dir, err := workspace.ConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "ipc.sock"), nil
}

// Handler answers one request.
type Handler func(Request) Response

// Server is the desktop side of the socket.
type Server struct {
	path string
	ln   net.Listener
	wg   sync.WaitGroup
}

// Serve starts listening. A stale socket file from a crashed process is
// replaced.
func Serve(path string, handler Handler) (*Server, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	if _, err := os.Stat(path); err == nil {
		// Someone may still own it; only remove when nobody answers.
		if conn, err := net.DialTimeout("unix", path, ProbeTimeout); err == nil {
			conn.Close()
			return nil, fmt.Errorf("another hark instance is already listening on %s", path)
		}
		_ = os.Remove(path)
	}
	ln, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	_ = os.Chmod(path, 0o600)
	s := &Server{path: path, ln: ln}
	s.wg.Add(1)
	go s.accept(handler)
	return s, nil
}

func (s *Server) accept(handler Handler) {
	defer s.wg.Done()
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		go func() {
			defer conn.Close()
			reader := bufio.NewReader(conn)
			line, err := reader.ReadBytes('\n')
			if err != nil && len(line) == 0 {
				return
			}
			var req Request
			if err := json.Unmarshal(line, &req); err != nil {
				writeResponse(conn, Response{Error: "bad request: " + err.Error()})
				return
			}
			writeResponse(conn, handler(req))
		}()
	}
}

func writeResponse(conn net.Conn, resp Response) {
	data, err := json.Marshal(resp)
	if err != nil {
		data, _ = json.Marshal(Response{Error: err.Error()})
	}
	_, _ = conn.Write(append(data, '\n'))
}

// Close stops the server and removes the socket file.
func (s *Server) Close() error {
	err := s.ln.Close()
	_ = os.Remove(s.path)
	s.wg.Wait()
	return err
}

// Online reports whether a desktop app answers on the socket.
func Online(path string) bool {
	conn, err := net.DialTimeout("unix", path, ProbeTimeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// Call sends one request and waits for the reply. A long default timeout keeps
// slow API runs from being cut off.
func Call(path string, req Request, timeout time.Duration) (*Response, error) {
	conn, err := net.DialTimeout("unix", path, ProbeTimeout)
	if err != nil {
		return nil, err
	}
	defer conn.Close()
	if timeout == 0 {
		timeout = 10 * time.Minute
	}
	_ = conn.SetDeadline(time.Now().Add(timeout))
	data, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	if _, err := conn.Write(append(data, '\n')); err != nil {
		return nil, err
	}
	line, err := bufio.NewReader(conn).ReadBytes('\n')
	if err != nil {
		return nil, err
	}
	var resp Response
	if err := json.Unmarshal(line, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}
