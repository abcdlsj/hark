import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  Copy,
  FileBraces,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { isDefaultWorkspace, relativeTime, splitDuration, statusMeta, workspaceLabel } from "../lib/format";
import { useStore } from "../store";
import {
  ActorTag,
  Button,
  cx,
  EnvCapsule,
  Kbd,
  MethodBadge,
  MetricDisplay,
  SegmentedBar,
} from "./Primitives";

export function WorkspaceOverview() {
  const {
    workspace,
    root,
    env,
    apis,
    vars,
    history,
    bootError,
    newDraft,
    selectApi,
    openSnapshot,
    openVars,
    copyGuide,
    reloadWorkspace,
    set,
  } = useStore(
    useShallow((s) => ({
      workspace: s.workspace,
      root: s.root,
      env: s.env,
      apis: s.apis,
      vars: s.vars,
      history: s.history,
      bootError: s.bootError,
      newDraft: s.newDraft,
      selectApi: s.selectApi,
      openSnapshot: s.openSnapshot,
      openVars: s.openVars,
      copyGuide: s.copyGuide,
      reloadWorkspace: s.reloadWorkspace,
      set: s.set,
    })),
  );

  const secretsCount = vars.filter((v) => v.secret).length;
  const recentWithStatus = history.filter((h) => h.status > 0);
  const okCount = recentWithStatus.filter((h) => h.status >= 200 && h.status < 300).length;
  const okRate = recentWithStatus.length > 0 ? Math.round((okCount / recentWithStatus.length) * 100) : 100;
  const healthRatio = recentWithStatus.length > 0 ? okCount / recentWithStatus.length : 0;
  const healthFill = okRate >= 90 ? "bg-emerald" : okRate >= 60 ? "bg-amber" : "bg-rose";

  return (
    <section className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas p-6">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
        {/* Workspace Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[20px] font-bold tracking-[-0.02em] text-ink">
                {workspaceLabel(workspace)}
              </h1>
              <EnvCapsule env={env} size="sm" />
            </div>
            <p className="mt-1 truncate mono text-[11.5px] text-ink3" title={root}>
              {isDefaultWorkspace(workspace) ? "Default workspace" : root || "Resolving workspace…"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="md" onClick={() => set({ curlModalOpen: true })}>
              <ArrowDownToLine className="h-3.5 w-3.5 text-ink3" strokeWidth={2} />
              <span>Import cURL</span>
            </Button>
            <Button variant="primary" size="md" onClick={newDraft}>
              <Plus className="h-4 w-4" strokeWidth={2.1} />
              <span>New Request</span>
              <Kbd className="border-white/25 bg-white/15 text-white">⌘N</Kbd>
            </Button>
          </div>
        </div>

        {/* Boot error diagnostic if present */}
        {bootError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose/30 bg-rose-soft px-3.5 py-2.5 text-[12px] text-rose">
            <span className="mono break-all">{bootError}</span>
            <Button variant="secondary" size="xs" onClick={() => void reloadWorkspace()}>
              <RefreshCw className="h-3 w-3" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Telemetry Summary Strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-chrome/60 p-3.5">
            <div className="eyebrow">Endpoints</div>
            <div className="mt-2">
              <MetricDisplay num={apis.length} unit={apis.length === 1 ? "route" : "routes"} size="lg" />
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink3">YAML definitions on disk</div>
          </div>

          <button
            type="button"
            onClick={() => openVars()}
            className="motion group rounded-lg border border-line bg-chrome/60 p-3.5 text-left hover:border-line-strong hover:bg-subtle/60"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Variables</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2">
              <MetricDisplay num={vars.length} unit="keys" size="lg" />
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink3">
              Scope <span className="mono text-ink2">{env || "global"}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openVars()}
            className="motion group rounded-lg border border-line bg-chrome/60 p-3.5 text-left hover:border-line-strong hover:bg-subtle/60"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">OS Keychain</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2">
              <MetricDisplay num={secretsCount} unit={secretsCount === 1 ? "secret" : "secrets"} size="lg" />
            </div>
            <div className="mt-1.5 text-[11.5px] text-ink3">Redacted from logs & YAML</div>
          </button>

          <div className="rounded-lg border border-line bg-chrome/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">2xx Health</span>
              <span className="mono text-[11px] font-medium text-ink2">
                {recentWithStatus.length > 0 ? `${okCount}/${recentWithStatus.length}` : "—"}
              </span>
            </div>
            <div className="mt-2">
              <MetricDisplay
                num={recentWithStatus.length > 0 ? okRate : "—"}
                unit={recentWithStatus.length > 0 ? "% ok" : ""}
                size="lg"
              />
            </div>
            <SegmentedBar
              ticks={20}
              ratio={healthRatio}
              fillClass={healthFill}
              heightClass="h-[6px]"
              className="mt-2.5"
            />
          </div>
        </div>

        {/* Lower Split: Saved Endpoints + Recent Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Saved Endpoints */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-canvas">
            <div className="flex h-[36px] items-center justify-between border-b border-line bg-chrome/60 px-3.5">
              <span className="text-[12px] font-semibold text-ink">Saved Endpoints</span>
              <span className="mono text-[11px] text-ink3">{apis.length} total</span>
            </div>
            {apis.length === 0 ? (
              <div className="flex flex-1 flex-col justify-between gap-2.5 p-4">
                <div className="flex items-center gap-2">
                  <FileBraces className="h-4 w-4 text-ink3" strokeWidth={1.8} />
                  <span className="text-[12px] font-semibold text-ink">Nothing saved yet</span>
                </div>
                <p className="text-[12px] leading-relaxed text-ink2">
                  Save requests from the UI or drive this workspace from your terminal or coding agent:
                </p>
                <pre className="overflow-x-auto rounded-md border border-line bg-chrome p-2.5 mono text-[11px] leading-relaxed text-ink">
                  {`hark save orders/refund --stdin <<'EOF'\ncurl -X POST '{{base_url}}/v1/orders/refund' \\\n  -H 'Authorization: Bearer {{api_key}}'\nEOF`}
                </pre>
              </div>
            ) : (
              <div className="divide-y divide-line-subtle">
                {apis.slice(0, 8).map((item) => {
                  const sMeta = statusMeta(item.last_status);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void selectApi(item.id)}
                      className="motion group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-subtle/60"
                    >
                      <MethodBadge method={item.method} short className="w-[38px] shrink-0 text-[10.5px]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-ink group-hover:text-accent-text">
                          {item.name || item.id}
                        </div>
                        <div className="truncate mono text-[11px] text-ink3">{item.id}</div>
                      </div>
                      {item.last_status > 0 && (
                        <span className={cx("mono text-[11px] font-semibold", sMeta.textClass)}>
                          {item.last_status}
                        </span>
                      )}
                      <ArrowUpRight className="h-3.5 w-3.5 text-ink3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-canvas">
            <div className="flex h-[36px] items-center justify-between border-b border-line bg-chrome/60 px-3.5">
              <span className="text-[12px] font-semibold text-ink">Recent Activity</span>
              <span className="mono text-[11px] text-ink3">Human & Agent runs</span>
            </div>
            {history.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center p-4 text-[12px] text-ink2">
                <div className="mb-1.5 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ink3" strokeWidth={1.8} />
                  <span className="font-semibold text-ink">No requests executed yet</span>
                </div>
                <span className="text-[11.5px] text-ink3">
                  Runs from both the desktop window and <span className="mono text-ink2">hark run</span> stream here live.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-line-subtle">
                {history.slice(0, 7).map((log) => {
                  const dur = splitDuration(log.duration_ms);
                  const sMeta = statusMeta(log.status);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => void openSnapshot(log.id)}
                      className="motion group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-subtle/60"
                    >
                      <ActorTag actor={log.actor} size="xs" />
                      <MethodBadge method={log.method} short className="w-[34px] shrink-0 text-[10px]" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">
                        {log.api_id === "_adhoc" ? log.url : log.api_id}
                      </span>
                      <span className={cx("mono text-[11px] font-semibold", sMeta.textClass)}>
                        {log.status || "ERR"}
                      </span>
                      <span className="mono text-[11px] text-ink2">
                        {dur.num}
                        <span className="ml-0.5 text-ink3">{dur.unit}</span>
                      </span>
                      <span className="mono hidden text-[10.5px] text-ink3 sm:inline">
                        {relativeTime(log.ts)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* AI Agent & CLI Briefing Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-chrome/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-violet/25 bg-violet-soft text-violet">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold text-ink">Shared Workspace for AI Agents & CLI</div>
              <div className="truncate text-[11.5px] text-ink3">
                Let coding agents inspect endpoints and run requests via <span className="mono text-ink2">hark guide</span>,{" "}
                <span className="mono text-ink2">hark ls</span>, and <span className="mono text-ink2">hark run</span>.
              </div>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={() => void copyGuide()}>
            <Copy className="h-3.5 w-3.5 text-ink3" />
            <span>Copy Agent Guide</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
