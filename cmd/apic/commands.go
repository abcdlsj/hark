package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/abcdlsj/apic/internal/core/ipc"
	"github.com/spf13/cobra"
)

func guideCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "guide",
		Short: "Print the collaboration guide for agents",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdGuide})
		},
	}
}

func lsCmd() *cobra.Command {
	var prefix string
	cmd := &cobra.Command{
		Use:   "ls",
		Short: "List saved APIs",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdLs, Args: mustMarshal(ipc.LsArgs{Prefix: prefix})})
		},
	}
	cmd.Flags().StringVar(&prefix, "prefix", "", "only APIs under this collection directory")
	return cmd
}

func showCmd() *cobra.Command {
	var asCurl bool
	cmd := &cobra.Command{
		Use:   "show <api_id>",
		Short: "Show one API, or export it as cURL",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdShow, Args: mustMarshal(ipc.ShowArgs{ID: args[0], Curl: asCurl})})
		},
	}
	cmd.Flags().BoolVar(&asCurl, "curl", false, "print a cURL command that keeps {{placeholders}}")
	return cmd
}

func saveCmd() *cobra.Command {
	var (
		curlFlag  string
		fromStdin bool
		name      string
		autoVar   bool
		env       string
	)
	cmd := &cobra.Command{
		Use:   "save <api_id>",
		Short: "Save an API from a cURL command",
		Long: "Save an API from a cURL command.\n\n" +
			"Prefer --stdin with a heredoc: shell quoting inside a long cURL command is\n" +
			"the single most common source of broken saves.",
		Args: cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			curl := curlFlag
			if fromStdin {
				raw, err := io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}
				curl = string(raw)
			}
			if strings.TrimSpace(curl) == "" {
				return fmt.Errorf("pass --curl '<command>' or --stdin")
			}
			return execute(ipc.Request{Cmd: ipc.CmdSave, Args: mustMarshal(ipc.SaveArgs{
				ID: args[0], Name: name, Curl: curl, AutoVar: autoVar, Env: env,
			})})
		},
	}
	cmd.Flags().StringVar(&curlFlag, "curl", "", "cURL command to import")
	cmd.Flags().BoolVar(&fromStdin, "stdin", false, "read the cURL command from stdin")
	cmd.Flags().StringVar(&name, "name", "", "human title for the API")
	cmd.Flags().BoolVar(&autoVar, "auto-var", true, "fold hard-coded environment URLs into {{placeholders}}")
	cmd.Flags().StringVarP(&env, "env", "e", "", "environment used for auto-var")
	return cmd
}

func runCmd() *cobra.Command {
	var (
		curlFlag  string
		fromStdin bool
		env       string
		overrides []string
	)
	cmd := &cobra.Command{
		Use:   "run [<api_id>]",
		Short: "Execute a saved API or a one-off cURL command",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			curl := curlFlag
			if fromStdin {
				raw, err := io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}
				curl = string(raw)
			}
			vars, err := parseOverrides(overrides)
			if err != nil {
				return err
			}
			var id string
			if len(args) == 1 {
				id = args[0]
			}
			if id == "" && strings.TrimSpace(curl) == "" {
				return fmt.Errorf("pass an api id, --curl or --stdin")
			}
			return execute(ipc.Request{Cmd: ipc.CmdRun, Args: mustMarshal(ipc.RunArgs{
				ID: id, Curl: curl, Env: env, Overrides: vars, JSON: flagJSON,
			})})
		},
	}
	cmd.Flags().StringVar(&curlFlag, "curl", "", "cURL command to run once")
	cmd.Flags().BoolVar(&fromStdin, "stdin", false, "read the cURL command from stdin")
	cmd.Flags().StringVarP(&env, "env", "e", "", "environment to resolve placeholders from")
	cmd.Flags().StringArrayVarP(&overrides, "var", "v", nil, "override a placeholder: key=value (repeatable)")
	return cmd
}

func varCmd() *cobra.Command {
	var (
		env    string
		scope  string
		secret bool
	)
	cmd := &cobra.Command{
		Use:   "var",
		Short: "Inspect or set placeholders",
	}
	ls := &cobra.Command{
		Use:   "ls",
		Short: "List placeholder keys (secret values are masked)",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdVarLs, Args: mustMarshal(ipc.VarLsArgs{Env: env})})
		},
	}
	set := &cobra.Command{
		Use:   "set <key>=<value>",
		Short: "Set a placeholder value",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			key, value, ok := strings.Cut(args[0], "=")
			if !ok || strings.TrimSpace(key) == "" {
				return fmt.Errorf("expected key=value")
			}
			if scope == "" {
				scope = "global"
			}
			return execute(ipc.Request{Cmd: ipc.CmdVarSet, Args: mustMarshal(ipc.VarSetArgs{
				Key: strings.TrimSpace(key), Value: value, Scope: scope, Secret: secret,
			})})
		},
	}
	cmd.PersistentFlags().StringVarP(&env, "env", "e", "", "environment")
	set.Flags().StringVar(&scope, "scope", "", "write to this environment instead of global")
	set.Flags().BoolVar(&secret, "secret", false, "store the value in the OS keychain")
	cmd.AddCommand(ls, set)
	return cmd
}

func envCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "env",
		Short: "Inspect or switch environments",
	}
	ls := &cobra.Command{
		Use:   "ls",
		Short: "List environments",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdEnvLs})
		},
	}
	use := &cobra.Command{
		Use:   "use <name>",
		Short: "Switch the current environment",
		Args:  cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return execute(ipc.Request{Cmd: ipc.CmdEnvUse, Args: mustMarshal(ipc.EnvUseArgs{Name: args[0]})})
		},
	}
	cmd.AddCommand(ls, use)
	return cmd
}

func parseOverrides(pairs []string) (map[string]string, error) {
	if len(pairs) == 0 {
		return nil, nil
	}
	out := make(map[string]string, len(pairs))
	for _, p := range pairs {
		k, v, ok := strings.Cut(p, "=")
		if !ok || strings.TrimSpace(k) == "" {
			return nil, fmt.Errorf("--var expects key=value, got %q", p)
		}
		out[strings.TrimSpace(k)] = v
	}
	return out, nil
}
