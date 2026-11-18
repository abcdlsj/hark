# apic development plan

Derived from the product spec. Each step is independently verifiable with `go test ./...`.

## Milestone 0 · Repository skeleton

- [x] `gh repo create abcdlsj/apic`, committer identity `abcdlsj <lisongjianshuai@gmail.com>`
- [x] One repository, two entry points: `cmd/desktop` (Wails v3), `cmd/apic` (Cobra CLI), `internal/core` (pure Go core)
- [x] `build/`, `Taskfile.yml` and `frontend/` come from the Wails v3 react template with sample code removed

## Milestone 1 · Core loop and CLI first

| # | Step | Deliverable |
| --- | --- | --- |
| 1 | Data model and workspace | `internal/core/model`: `Envs`, `API`, `KV`; workspace resolution (`APIC_WORKSPACE` → ancestor probe → `~/.apic`) |
| 2 | YAML storage | `internal/core/store`: `collections/<module>/<action>.yaml` ↔ `api_id`; atomic writes (tmp + rename); `envs.yaml` read/write with cache invalidation |
| 3 | cURL both ways | `internal/core/curlx`: tokenizer + state machine; line continuations, quote stripping, `-d/-F/--json` implies POST, `{{var}}` protection |
| 4 | Variable system | `internal/core/vars`: `global` → environment → `-v` overrides; `{{var}}` render and reference scan |
| 5 | OS keychain | `internal/core/secret`: values for `secret: true` keys live only in the system credential store |
| 6 | Request execution | `internal/core/exec`: `httptrace` phase timings (DNS/TCP/TLS/TTFB/Download); secrets injected into the request byte stream only |
| 7 | Redaction and history | `internal/core/redact` + `internal/core/history`: reverse-scan known secrets; single-table `execution_logs` in `history.db` (pure Go sqlite) |
| 8 | Semantic operations | `internal/core/ops`: `Guide/List/Show/Save/Run/Vars`, shared by the desktop app and the CLI |
| 9 | Six CLI commands | `cmd/apic`: `guide`, `ls`, `show`, `save`, `run`, `var` (with `--stdin`, 4KB `--json` truncation, `--auto-var`) |

Exit criteria: `apic save orders/refund --stdin <<'EOF' ... EOF`, `apic run orders/refund --json` and `apic guide` all work from a terminal.

## Milestone 2 · Desktop canvas and design system

| # | Step | Deliverable |
| --- | --- | --- |
| 10 | Wails services | `cmd/desktop`: frameless immersive title bar; workspace, API, env, history and run services all delegate to `internal/core/ops` |
| 11 | Design system | Tailwind + CSS variables for the spec's color tokens, dual typefaces, 4px rhythm, no-shadow rule |
| 12 | Layout skeleton | 38px header + sidebar (tree + Activity Pulse) + omni-URL bar + tool tabs + request/response split |
| 13 | Key components | CodeMirror 6 single-line `{{var}}` pill URL bar, borderless spreadsheet KV grid, Body/Auth tabs, response inspector (Pretty/Raw/Headers + timing waterfall) |
| 14 | Interaction flows | ⌘V magic paste, ⌘K command palette, ⌘↵/⌘S/⌘N/⌘B/⌘E/⌘⇧C/Esc shortcuts, in-flight cancel |

## Milestone 3 · Dual-mode IPC and polish

| # | Step | Deliverable |
| --- | --- | --- |
| 15 | IPC protocol | `internal/core/ipc`: Unix socket + newline-delimited JSON; desktop is the only writer, CLI dials with a 5ms timeout |
| 16 | Live events | Wails events `api:saved_by_agent`, `run:completed`, `history:appended`; sidebar agent dot, live pulse stream |
| 17 | Snapshot replay | Click an `[A]` pulse row → read-only snapshot banner with "override current API" |
| 18 | Wrap-up | README, `apic guide` copy, packaging tasks, full tests and `gofmt` |
