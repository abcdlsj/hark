package ipc

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/abcdlsj/hark/internal/core/ops"
)

func TestServeCallAndOffline(t *testing.T) {
	sock := filepath.Join(t.TempDir(), "ipc.sock")
	o, err := ops.New(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()

	if Online(sock) {
		t.Fatal("nothing should be listening yet")
	}

	srv, err := Serve(sock, NewHandler(o))
	if err != nil {
		t.Fatal(err)
	}
	if !Online(sock) {
		t.Fatal("server should answer")
	}

	resp, err := Call(sock, Request{Cmd: CmdGuide}, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Error != "" || !strings.Contains(resp.Text, "hark run") {
		t.Fatalf("guide response = %#v", resp)
	}

	save, err := Call(sock, Request{Cmd: CmdSave, Args: mustJSON(SaveArgs{
		ID: "ping", Curl: `curl -X POST 'https://x.dev/ping' -d 'a=1'`, AutoVar: false,
	})}, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if save.Error != "" || !strings.Contains(save.Text, "saved ping  POST") {
		t.Fatalf("save response = %#v", save)
	}

	ls, err := Call(sock, Request{Cmd: CmdLs, Args: mustJSON(LsArgs{})}, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(ls.Text, "ping") {
		t.Fatalf("ls response = %#v", ls)
	}
	var items []ops.ListItem
	if err := json.Unmarshal(ls.JSON, &items); err != nil {
		t.Fatalf("json payload: %v", err)
	}
	if len(items) != 1 || items[0].Method != "POST" {
		t.Fatalf("items = %#v", items)
	}

	bad, err := Call(sock, Request{Cmd: CmdShow, Args: mustJSON(ShowArgs{ID: "missing"})}, 5*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if bad.Error == "" {
		t.Fatal("expected an error for a missing api")
	}

	if err := srv.Close(); err != nil {
		t.Fatal(err)
	}
	if Online(sock) {
		t.Fatal("socket should be gone")
	}
}

func TestSecondServeIsRejected(t *testing.T) {
	sock := filepath.Join(t.TempDir(), "ipc.sock")
	o, err := ops.New(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	srv, err := Serve(sock, NewHandler(o))
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()
	if _, err := Serve(sock, NewHandler(o)); err == nil {
		t.Fatal("expected the second server to fail")
	}
}

func TestUnknownCommand(t *testing.T) {
	o, err := ops.New(t.TempDir(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	resp := NewHandler(o)(Request{Cmd: "nope"})
	if !strings.Contains(resp.Error, "unknown command") {
		t.Fatalf("resp = %#v", resp)
	}
}

func mustJSON(v any) json.RawMessage {
	raw, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return raw
}

// Requests that arrive on the socket are agent work, even though the desktop
// process performs the write.
func TestSocketRequestsAreStampedAsAgent(t *testing.T) {
	root := t.TempDir()
	o, err := ops.New(root, nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer o.Close()
	o.Actor = ops.ActorHuman

	// Unix socket paths are capped at ~104 bytes, so keep this one short.
	sock := filepath.Join(os.TempDir(), fmt.Sprintf("hark-test-%d.sock", time.Now().UnixNano()))
	srv, err := Serve(sock, NewHandler(o))
	if err != nil {
		t.Fatal(err)
	}
	defer srv.Close()

	if _, err := Call(sock, Request{Cmd: CmdSave, Args: mustJSON(SaveArgs{ID: "x/y", Curl: `curl https://x.dev`})}, 5*time.Second); err != nil {
		t.Fatal(err)
	}
	api, err := o.Store.Load("x/y")
	if err != nil {
		t.Fatal(err)
	}
	if api.Meta.UpdatedBy != ops.ActorAgent {
		t.Fatalf("updated_by = %q", api.Meta.UpdatedBy)
	}
}
