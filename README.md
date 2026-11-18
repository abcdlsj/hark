# apic

A local-first, quiet API workbench for humans and AI agents.

`apic` does three things and stops there: cURL in, cURL out; `{{placeholder}}`
isolation with secrets in the OS keychain; and one shared workspace that both
you and your agent can drive, from the desktop window or the CLI.

- **Desktop**: Wails v3 + React + Tailwind + CodeMirror 6, frameless, light with
  a dark theme toggle.
- **CLI**: `apic guide`, `ls`, `show`, `save`, `run`, `var` — the agent entry point.
- **Core**: one Go package tree (`internal/core`) behind both, so ⌘↵ and
  `apic run` behave identically.

## Desktop

```sh
task build      # bin/apic.app (macOS), or the platform equivalent
task dev        # Wails dev mode with Vite hot reload
```

The window is frameless: 44px header, 258px sidebar (⌘B), a workspace overview
as the landing page, one-line URL bar with `{{placeholder}}` pills,
spreadsheet-style key/value grid, request/response split (drag the divider;
stacks below 1200px), and a response inspector with per-phase timings.

Shortcuts: ⌘↵ send · ⌘S save · ⌘K palette · ⌘N new · ⌘B sidebar · ⌘E
environment · ⌘⇧C copy cURL · Esc cancel or leave a snapshot. Pasting a `curl`
command anywhere outside a text field imports it.

While the window is open it owns the workspace through `ipc.sock`, so agent
writes appear live: a dot on changed APIs, rows in Activity Pulse, and a
read-only snapshot banner when you open an agent run.

## Install

Prebuilt desktop apps for macOS, Windows and Linux are attached to every
[release](https://github.com/abcdlsj/apic/releases). The CLI installs with Go:

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

Releasing is a tag: `git tag v0.1.0 && git push origin v0.1.0`. The release
workflow builds macOS (universal), Windows and Linux, stamps the version into
the platform metadata and attaches the archives to the GitHub release.
