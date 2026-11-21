# Hark

A local-first, quiet API workbench for humans and AI agents.

`hark` does three things and stops there: cURL in, cURL out; `{{placeholder}}`
isolation with secrets in the OS keychain; and one shared workspace that both
you and your agent can drive, from the desktop window or the CLI.

- **Desktop**: Wails v3 + React + Tailwind + CodeMirror 6, frameless, light with
  a dark theme toggle.
- **CLI**: `hark guide`, `ls`, `show`, `save`, `run`, `var` — the agent entry point.
- **Core**: one Go package tree (`internal/core`) behind both, so ⌘↵ and
  `hark run` behave identically.

## Desktop

```sh
task build      # bin/Hark.app (macOS), or the platform equivalent
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

On macOS, through the tap:

```sh
brew install --cask abcdlsj/tap/hark
```

Prebuilt desktop apps for macOS, Windows and Linux are attached to every
[release](https://github.com/abcdlsj/hark/releases). The CLI installs with Go and
stays lowercase, so `hark run` reads the same in a terminal and in the window:

```sh
go install github.com/abcdlsj/hark/cmd/hark@latest
```

## Workspace

A workspace is a directory you can commit to Git:

```
envs.yaml                          # global + per-environment placeholders
collections/<module>/<action>.yaml # one API per file; the path is the API ID
history.db                         # execution log, safe to delete
```

Resolution order: `--workspace`, `$HARK_WORKSPACE`, the nearest ancestor
containing `envs.yaml`, then `~/.hark`.

## Agent workflow

```sh
hark guide                     # what this workspace has, no secret values
hark save orders/refund --stdin <<'EOF'
curl -X POST '{{base_url}}/v1/orders/refund' \
  -H 'Authorization: Bearer {{api_key}}' \
  -H 'Content-Type: application/json' \
  --data-raw '{"order_id":"ord_9981"}'
EOF
hark ls
hark run orders/refund --json   # 4KB preview + temp file for the full body
```

## Development

```sh
go test ./...
go run ./cmd/hark guide
task dev        # Wails dev mode (desktop)
```

The icon is generated, not hand-drawn: edit `build/icon/generate.mjs`, then
`node build/icon/generate.mjs && rsvg-convert -w 1024 -h 1024 build/appicon.svg -o build/appicon.png`.
`task build` turns that PNG into `icons.icns` and `icon.ico`.

Releasing is a tag: `git tag v0.2.0 && git push origin v0.2.0`. The release
workflow builds macOS (universal), Windows and Linux, stamps the version into
the platform metadata, writes `hark.rb` from the dmg checksum and attaches both
to the GitHub release. Copy that `hark.rb` into `Casks/` of
[abcdlsj/homebrew-tap](https://github.com/abcdlsj/homebrew-tap) after a release.
