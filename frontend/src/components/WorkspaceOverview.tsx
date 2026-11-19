import {
  ArrowDownToLine,
  ArrowUpRight,
  Copy,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { relativeTime, splitDuration, statusMeta } from "../lib/format";
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
import { OverviewCardBlueprint } from "./VisualStates";

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
  } = useStore();

  const secretsCount = vars.filter((v) => v.secret).length;
  const recentWithStatus = history.filter((h) => h.status > 0);
  const okCount = recentWithStatus.filter((h) => h.status >= 200 && h.status < 300).length;
  const okRate = recentWithStatus.length > 0 ? Math.round((okCount / recentWithStatus.length) * 100) : 100;
  const healthRatio = recentWithStatus.length > 0 ? okCount / recentWithStatus.length : 0;
  const healthFill = okRate >= 90 ? "bg-emerald" : okRate >= 60 ? "bg-amber" : "bg-rose";

  return (
    <section className="island scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
        {/* Hero Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-[22px] font-bold tracking-[-0.025em] text-ink">
                {workspace || "hark workspace"}
              </h1>
              <EnvCapsule env={env} size="sm" />
            </div>
            <p className="mt-1 truncate mono text-[11.5px] text-ink3" title={root}>
              {root || "Resolving workspace…"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-0.5">
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
          <div className="flex items-center justify-between gap-3 rounded-[12px] border border-rose/30 bg-rose-soft px-4 py-3 text-[12.5px] text-rose">
            <span className="mono break-all">{bootError}</span>
            <Button variant="secondary" size="sm" onClick={() => void reloadWorkspace()}>
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Telemetry Metric Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-[12px] border border-line bg-subtle/70 p-4">
            <div className="eyebrow">Endpoints</div>
            <div className="mt-2">
              <MetricDisplay num={apis.length} unit={apis.length === 1 ? "route" : "routes"} size="lg" />
            </div>
            <div className="mt-2 text-[11.5px] text-ink3">YAML definitions in git</div>
          </div>

          <button
            type="button"
            onClick={() => openVars()}
            className="motion group rounded-[12px] border border-line bg-subtle/70 p-4 text-left hover:border-line-strong hover:bg-surface hover:shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">Variables</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2">
              <MetricDisplay num={vars.length} unit="keys" size="lg" />
            </div>
            <div className="mt-2 text-[11.5px] text-ink3">
              Active scope <span className="mono text-ink2">{env || "global"}</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openVars()}
            className="motion group rounded-[12px] border border-line bg-subtle/70 p-4 text-left hover:border-line-strong hover:bg-surface hover:shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow">OS Keychain</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-ink3 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <div className="mt-2">
              <MetricDisplay num={secretsCount} unit={secretsCount === 1 ? "secret" : "secrets"} size="lg" />
            </div>
            <div className="mt-2 text-[11.5px] text-ink3">Redacted from logs & YAML</div>
          </button>

          <div className="rounded-[12px] border border-line bg-subtle/70 p-4">
            <div className="flex items-center justify-between">
              <span className="eyebrow">2xx Health</span>
              <span className="mono text-[11px] font-semibold text-ink2">
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
              heightClass="h-[9px]"
              className="mt-2.5"
            />
          </div>
        </div>

        {/* Lower Split: Saved Endpoints + Recent Activity */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Saved Endpoints */}
          <div className="flex flex-col rounded-[12px] border border-line bg-subtle/45 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold tracking-tight text-ink">Saved Endpoints</span>
              <span className="mono text-[11px] text-ink3">{apis.length} total</span>
            </div>
            {apis.length === 0 ? (
              <div className="flex flex-1 flex-col justify-between gap-2 rounded-[10px] border border-dashed border-line-strong bg-surface/60 p-4">
                <OverviewCardBlueprint kind="endpoints" />
                <p className="text-[12px] leading-relaxed text-ink2">
                  Save requests from the UI or drive this workspace from your terminal or coding agent:
                </p>
                <pre className="overflow-x-auto rounded-[8px] bg-subtle p-2.5 mono text-[11px] leading-relaxed text-ink">
                  {`hark save orders/refund --stdin <<'EOF'\ncurl -X POST '{{base_url}}/v1/orders/refund' \\\n  -H 'Authorization: Bearer {{api_key}}'\nEOF`}
                </pre>
              </div>
            ) : (
              <div className="divide-y divide-line/70">
                {apis.slice(0, 8).map((item) => {
                  const sMeta = statusMeta(item.last_status);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void selectApi(item.id)}
                      className="motion group flex w-full items-center gap-2.5 py-2.5 text-left hover:px-1.5"
                    >
                      <MethodBadge method={item.method} short className="w-[44px] shrink-0 justify-center" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-ink group-hover:text-cobalt">
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
          <div className="flex flex-col rounded-[12px] border border-line bg-subtle/45 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] font-semibold tracking-tight text-ink">Recent Activity</span>
              <span className="mono text-[11px] text-ink3">Human & Agent runs</span>
            </div>
            {history.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center rounded-[10px] border border-dashed border-line-strong bg-surface/60 p-4 text-[12px] text-ink2">
                <OverviewCardBlueprint kind="activity" />
                <span className="font-medium text-ink">No requests executed yet.</span>
                <span className="mt-1 text-[11.5px] text-ink3">
                  Runs from both the desktop window and <span className="mono">hark run</span> stream here live.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-line/70">
                {history.slice(0, 7).map((log) => {
                  const dur = splitDuration(log.duration_ms);
                  const sMeta = statusMeta(log.status);
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => void openSnapshot(log.id)}
                      className="motion group flex w-full items-center gap-2.5 py-2.5 text-left hover:px-1.5"
                    >
                      <ActorTag actor={log.actor} size="xs" />
                      <MethodBadge method={log.method} short pill={false} />
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                        {log.api_id === "_adhoc" ? log.url : log.api_id}
                      </span>
                      <span className={cx("mono text-[11px] font-bold", sMeta.textClass)}>
                        {log.status || "ERR"}
                      </span>
                      <MetricDisplay num={dur.num} unit={dur.unit} size="sm" />
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
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[12px] border border-line bg-subtle/50 px-4 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-violet-soft text-violet">
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
