package ops

import (
	"fmt"
	"strings"
)

// Guide renders the self-describing prompt an agent reads first. It lists
// environments and placeholder names but never values.
func (o *Ops) Guide() (string, error) {
	envs, err := o.Store.Envs()
	if err != nil {
		return "", err
	}
	envNames := envs.EnvNames()
	for i, n := range envNames {
		if n == envs.Current {
			envNames[i] = n + "*"
		}
	}

	var keys []string
	secret := map[string]bool{}
	for k, v := range envs.Global {
		keys = append(keys, k)
		secret[k] = secret[k] || v.Secret
	}
	for _, vars := range envs.Environments {
		for k, v := range vars {
			if _, ok := secret[k]; !ok {
				keys = append(keys, k)
			}
			secret[k] = secret[k] || v.Secret
		}
	}
	sortStrings(keys)
	labels := make([]string, 0, len(keys))
	for _, k := range keys {
		if secret[k] {
			labels = append(labels, k+" (keychain)")
			continue
		}
		labels = append(labels, k)
	}

	var b strings.Builder
	fmt.Fprintf(&b, "# hark — local API workbench\n\n")
	fmt.Fprintf(&b, "workspace: %s\n", o.Store.Name())
	fmt.Fprintf(&b, "env: %s\n", orDash(envs.Current))
	fmt.Fprintf(&b, "environments: %s\n", orDash(strings.Join(envNames, ", ")))
	fmt.Fprintf(&b, "variables: %s\n\n", orDash(strings.Join(labels, ", ")))
	b.WriteString("Commands\n")
	b.WriteString("  hark ls [--prefix <dir>]                            list APIs\n")
	b.WriteString("  hark show <api_id> [--curl]                         inspect one API\n")
	b.WriteString("  hark save <api_id> --stdin [--name <t>] [--auto-var] save a cURL from stdin\n")
	b.WriteString("  hark run <api_id> | --curl '<cmd>' [-e env] [-v k=v] [--json]\n")
	b.WriteString("  hark var ls [-e env] | hark var set <k>=<v> [-e env] [--secret]\n\n")
	b.WriteString("Rules\n")
	b.WriteString("  Use {{var}} placeholders instead of literals; saved cURL keeps them.\n")
	b.WriteString("  Prefer --stdin with a heredoc for cURL: no quoting or escaping issues.\n")
	b.WriteString("  --json prints status, duration, key headers and a body preview;\n")
	b.WriteString("  'truncated: true' means read the full response from the given path.\n")
	return b.String(), nil
}

func orDash(s string) string {
	if strings.TrimSpace(s) == "" {
		return "-"
	}
	return s
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}
