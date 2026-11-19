// Command hark is the agent-facing CLI for the hark API workbench.
//
// Every command forwards to a running desktop app when one answers on the IPC
// socket, so the desktop stays the single writer for the workspace. Otherwise it
// writes to disk itself and exits; there is no background daemon.
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"github.com/abcdlsj/hark/internal/core/ipc"
	"github.com/abcdlsj/hark/internal/core/ops"
	"github.com/abcdlsj/hark/internal/core/workspace"
	"github.com/spf13/cobra"
)

var (
	flagWorkspace string
	flagJSON      bool
)

func main() {
	root := &cobra.Command{
		Use:           "hark",
		Short:         "Local-first API workbench for humans and agents",
		SilenceUsage:  true,
		SilenceErrors: true,
	}
	root.PersistentFlags().StringVar(&flagWorkspace, "workspace", "", "workspace directory (default: $HARK_WORKSPACE, nearest envs.yaml, or ~/.hark)")
	root.PersistentFlags().BoolVar(&flagJSON, "json", false, "machine-readable output")

	root.AddCommand(
		guideCmd(),
		lsCmd(),
		showCmd(),
		saveCmd(),
		runCmd(),
		varCmd(),
		envCmd(),
	)

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, "error: "+err.Error())
		os.Exit(1)
	}
}

// execute routes a request to the desktop when it is running, otherwise runs it
// in-process against the workspace.
func execute(req ipc.Request) error {
	socket, err := ipc.SocketPath()
	if err == nil && ipc.Online(socket) {
		resp, err := ipc.Call(socket, req, 0)
		if err != nil {
			return err
		}
		if resp.Error != "" {
			return fmt.Errorf("%s", resp.Error)
		}
		printResponse(*resp)
		return nil
	}
	root, err := workspace.Resolve(flagWorkspace)
	if err != nil {
		return err
	}
	o, err := ops.New(root, nil, nil)
	if err != nil {
		return err
	}
	defer o.Close()
	o.Actor = ops.ActorAgent

	resp := ipc.NewHandler(o)(req)
	if resp.Error != "" {
		return fmt.Errorf("%s", resp.Error)
	}
	printResponse(resp)
	return nil
}

func printResponse(resp ipc.Response) {
	if flagJSON && len(resp.JSON) > 0 {
		var buf bytes.Buffer
		if err := json.Indent(&buf, resp.JSON, "", " "); err == nil {
			os.Stdout.Write(buf.Bytes())
			fmt.Println()
			return
		}
		os.Stdout.Write(resp.JSON)
		fmt.Println()
		return
	}
	if resp.Text != "" {
		fmt.Print(resp.Text)
	}
}

// mustMarshal encodes command arguments; a failure here is a programming error.
func mustMarshal(v any) json.RawMessage {
	raw, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return raw
}
