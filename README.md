# apic

A local-first, quiet API workbench for humans and AI agents.

`apic` does three things and stops there: cURL in, cURL out; `{{placeholder}}`
isolation with secrets in the OS keychain; and one shared workspace that both
you and your agent can drive, from the desktop window or the CLI.

- **Desktop**: Wails v3 + React + Tailwind + CodeMirror 6, frameless, dark-first.
- **CLI**: `apic guide`, `ls`, `show`, `save`, `run`, `var` — the agent entry point.
- **Core**: one Go package tree (`internal/core`) behind both, so ⌘↵ and
  `apic run` behave identically.

## Status

Milestone 1 (core + CLI) is complete. Desktop canvas and IPC wiring follow
`docs/PLAN.md`.

## Install the CLI

```sh
go install github.com/abcdlsj/apic/cmd/apic@latest
```

## Workspace

A workspace is a directory you can commit to Git:

```
envs.yaml                          # global + per-environment placeholders
collections/<module>/<action>.yaml # one API per file; the path is the API ID
history.db                         # execution log, safe to delete
```

Resolution order: `--workspace`, `$APIC_WORKSPACE`, the nearest ancestor
containing `envs.yaml`, then `~/.apic`.

## Agent workflow

```sh
apic guide                     # what this workspace has, no secret values
apic save orders/refund --stdin <<'EOF'
curl -X POST '{{base_url}}/v1/orders/refund' \
  -H 'Authorization: Bearer {{api_key}}' \
  -H 'Content-Type: application/json' \
  --data-raw '{"order_id":"ord_9981"}'
EOF
apic ls
apic run orders/refund --json   # 4KB preview + temp file for the full body
```

## Development

```sh
go test ./...
go run ./cmd/apic guide
task dev        # Wails dev mode (desktop)
```
