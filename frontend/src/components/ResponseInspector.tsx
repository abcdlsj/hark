import { Check, Copy, Sparkles, WrapText } from "lucide-react";
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { contentType, prettyBody, relativeTime, splitBytes, splitDuration } from "../lib/format";
import type { RunView, Timings } from "../lib/types";
import { useStore } from "../store";
import { CodeBlockEditor } from "./CodeBlockEditor";
import {
  ActorTag,
  type BarSegment,
  Button,
  cx,
  EnvCapsule,
  IconButton,
  MetricDisplay,
  SegmentedBar,
  StatusCapsule,
  SwapText,
  Tip,
  UnderlineTabs,
} from "./Primitives";
import { InspectorEmptyState, InspectorLoadingState } from "./VisualStates";

interface PhaseSpec {
  key: keyof Timings;
  label: string;
  short: string;
  colorClass: string;
  dotClass: string;
}

const PHASES: PhaseSpec[] = [
  { key: "dns_ms", label: "DNS Lookup", short: "DNS", colorClass: "bg-sky", dotClass: "bg-sky" },
  { key: "tcp_ms", label: "TCP Handshake", short: "TCP", colorClass: "bg-accent", dotClass: "bg-accent" },
  { key: "tls_ms", label: "TLS Handshake", short: "TLS", colorClass: "bg-violet", dotClass: "bg-violet" },
  { key: "ttfb_ms", label: "Server Wait · TTFB", short: "TTFB", colorClass: "bg-emerald", dotClass: "bg-emerald" },
  { key: "download_ms", label: "Content Download", short: "DL", colorClass: "bg-amber", dotClass: "bg-amber" },
];

export function ResponseInspector() {
  const {
    run,
    snapshot,
    running,
    runStartedAt,
    inspectorTab,
    responseWrap,
    cancelRequest,
    set,
    notify,
  } = useStore(
    useShallow((s) => ({
      run: s.run,
      snapshot: s.snapshot,
      running: s.running,
      runStartedAt: s.runStartedAt,
      inspectorTab: s.inspectorTab,
      responseWrap: s.responseWrap,
      cancelRequest: s.cancelRequest,
      set: s.set,
      notify: s.notify,
    })),
  );
  const [copied, setCopied] = useState(false);

  const view: RunView | null = useMemo(() => {
    if (snapshot) {
      return {
        log_id: snapshot.id,
        api_id: snapshot.api_id,
        method: snapshot.method,
        url: snapshot.url,
        env: snapshot.env,
        actor: snapshot.actor,
        status: snapshot.status,
        status_text: "",
        duration_ms: snapshot.duration_ms,
        size: snapshot.size,
        timings: snapshot.timings,
        request_headers: snapshot.request_headers,
        response_headers: snapshot.response_headers,
        body: snapshot.response_preview ?? "",
        truncated: false,
        error: snapshot.error,
      };
    }
    return run;
  }, [run, snapshot]);

  const dur = view ? splitDuration(view.duration_ms) : null;
  const size = view ? splitBytes(view.size) : null;
  const ctype = view ? contentType(view.response_headers) : "";

  const timingSegments: BarSegment[] = useMemo(() => {
    if (!view?.timings) return [];
    return PHASES.map((p) => ({
      key: p.key,
      label: p.short,
      value: Math.max(0, view.timings[p.key] ?? 0),
      colorClass: p.colorClass,
    }));
  }, [view]);

  const hasTimings = timingSegments.some((s) => s.value > 0);

  const copyBody = async () => {
    if (!view?.body) return;
    try {
      await navigator.clipboard.writeText(view.body);
      setCopied(true);
      notify("Response body copied", "success");
      window.setTimeout(() => setCopied(false), 1400);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  if (running) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
        <InspectorLoadingState startedAt={runStartedAt} onCancel={() => void cancelRequest()} />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      {/* Compact Hoppscotch-style Response Metadata Strip */}
      {view ? (
        <div className="shrink-0">
          <div className="flex min-h-[38px] flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line bg-chrome/60 px-3 py-1.5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
              <div className="flex items-center gap-1.5">
                <span className="text-ink3">Status:</span>
                <StatusCapsule status={view.status} text={view.status_text} hasError={Boolean(view.error)} />
              </div>

              {dur && (
                <div className="flex items-center gap-1">
                  <span className="text-ink3">Time:</span>
                  <span className="mono font-semibold text-ink">
                    {dur.num} <span className="font-normal text-ink3">{dur.unit}</span>
                  </span>
                </div>
              )}

              {size && (
                <div className="flex items-center gap-1">
                  <span className="text-ink3">Size:</span>
                  <span className="mono font-semibold text-ink">
                    {size.num} <span className="font-normal text-ink3">{size.unit}</span>
                  </span>
                </div>
              )}

              {view.truncated && (
                <span className="mono rounded border border-amber/30 bg-amber-soft px-1.5 py-[1px] text-[10px] font-semibold text-amber">
                  8 MB cap
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <EnvCapsule env={view.env} size="xs" />
              <ActorTag actor={view.actor} size="xs" />
              {snapshot && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-violet">
                  <Sparkles className="h-3 w-3" />
                  <span>{relativeTime(snapshot.ts)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Slim clickable timing breakdown bar */}
          {hasTimings && (
            <button
              type="button"
              onClick={() => set({ inspectorTab: "timing" })}
              title="Open detailed network phase timing breakdown"
              className="motion group flex w-full items-center gap-3 border-b border-line bg-canvas px-3 py-1.5 text-left hover:bg-subtle/50"
            >
              <SegmentedBar segments={timingSegments} heightClass="h-[5px]" className="max-w-[180px] flex-1" />
              <div className="hidden min-w-0 flex-1 items-center gap-2.5 overflow-hidden text-[10.5px] text-ink3 sm:flex">
                {PHASES.map((p) => {
                  const val = view.timings?.[p.key] ?? 0;
                  if (val <= 0) return null;
                  return (
                    <span key={p.key} className="inline-flex shrink-0 items-center gap-1">
                      <span className={cx("h-1.5 w-1.5 rounded-full", p.dotClass)} />
                      <span className="text-ink2">{p.short}</span>
                      <span className="mono">{val.toFixed(1)}ms</span>
                    </span>
                  );
                })}
              </div>
              <span className="ml-auto shrink-0 text-[10.5px] font-medium text-ink3 group-hover:text-accent-text">
                Timing →
              </span>
            </button>
          )}

          {view.error && (
            <div className="break-words border-b border-rose/25 bg-rose-soft px-3 py-2 mono text-[11.5px] text-rose select-text">
              {view.error}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-line bg-chrome/60 px-3">
          <span className="text-[12px] font-semibold text-ink2">Response</span>
          <span className="mono text-[11px] text-ink3">Ready</span>
        </div>
      )}

      {/* Flat Underline Tabs & Utility Actions */}
      <div className="flex h-[36px] shrink-0 items-center justify-between gap-2 border-b border-line bg-canvas px-3">
        <UnderlineTabs
          value={inspectorTab}
          onChange={(tab) => set({ inspectorTab: tab })}
          items={[
            { id: "pretty", label: "Pretty" },
            { id: "raw", label: "Raw" },
            {
              id: "headers",
              label: "Headers",
              badge: view ? Object.keys(view.response_headers ?? {}).length : undefined,
            },
            { id: "timing", label: "Timing" },
          ]}
        />

        <div className="flex items-center gap-1.5">
          {ctype && (
            <span
              title={ctype}
              className="hidden max-w-[170px] truncate rounded border border-line bg-subtle px-1.5 py-[1px] mono text-[10.5px] text-ink2 sm:inline"
            >
              {ctype.split(";")[0]}
            </span>
          )}
          {view?.body && (inspectorTab === "pretty" || inspectorTab === "raw") && (
            <Tip label={responseWrap ? "Disable line wrap" : "Enable line wrap"}>
              <IconButton
                size="xs"
                active={responseWrap}
                onClick={() => set({ responseWrap: !responseWrap })}
              >
                <WrapText className="h-3.5 w-3.5" strokeWidth={1.85} />
              </IconButton>
            </Tip>
          )}
          {view?.body && (
            <Button size="xs" variant="secondary" onClick={() => void copyBody()}>
              {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
              <SwapText value={copied ? "Copied" : "Copy"} options={["Copy", "Copied"]} />
            </Button>
          )}
        </div>
      </div>

      {/* Response Content (anchored — no vertical jump on tab switch) */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {!view ? (
          <InspectorEmptyState />
        ) : inspectorTab === "headers" ? (
          <HeadersView view={view} />
        ) : inspectorTab === "raw" ? (
          <RawView view={view} wrap={responseWrap} />
        ) : inspectorTab === "timing" ? (
          <TimingView timings={view.timings} totalMS={view.duration_ms} />
        ) : (
          <PrettyView view={view} wrap={responseWrap} />
        )}
      </div>
    </section>
  );
}

const MAX_PRETTY_BYTES = 1_500_000;

function PrettyView({ view, wrap }: { view: RunView; wrap: boolean }) {
  const ctype = contentType(view.response_headers);
  const { text, json } = useMemo(() => {
    if (!view.body || view.body.length > MAX_PRETTY_BYTES) {
      return { text: view.body, json: false };
    }
    return prettyBody(view.body);
  }, [view.body]);
  const isJSON = (ctype.includes("json") || json) && view.body.length <= MAX_PRETTY_BYTES;

  if (!view.body) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[12px] text-ink3">
        Empty response body.
      </div>
    );
  }
  if (isJSON) {
    return <CodeBlockEditor value={text} readOnly language lineWrap={wrap} />;
  }
  return (
    <pre
      className={cx(
        "scroll h-full overflow-auto px-3.5 py-2.5 mono text-[12px] leading-[1.6] text-ink",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
      )}
    >
      {view.body}
    </pre>
  );
}

function RawView({ view, wrap }: { view: RunView; wrap: boolean }) {
  const raw = useMemo(() => {
    const lines: string[] = [];
    lines.push(`> ${view.method} ${view.url}`);
    for (const [k, values] of Object.entries(view.request_headers ?? {})) {
      for (const v of values) lines.push(`> ${k}: ${v}`);
    }
    lines.push("");
    lines.push(`< HTTP ${view.status} ${view.status_text}`.trim());
    for (const [k, values] of Object.entries(view.response_headers ?? {})) {
      for (const v of values) lines.push(`< ${k}: ${v}`);
    }
    lines.push("");
    lines.push(view.body);
    return lines.join("\n");
  }, [view]);

  return (
    <pre
      className={cx(
        "scroll h-full overflow-auto px-3.5 py-2.5 mono text-[12px] leading-[1.6] text-ink2",
        wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
      )}
    >
      {raw}
    </pre>
  );
}

function HeadersView({ view }: { view: RunView }) {
  const resRows = Object.entries(view.response_headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const reqRows = Object.entries(view.request_headers ?? {}).sort(([a], [b]) => a.localeCompare(b));

  if (resRows.length === 0 && reqRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[12px] text-ink3">
        No headers recorded.
      </div>
    );
  }

  return (
    <div className="scroll h-full overflow-y-auto">
      <HeaderGroup title="Response Headers" rows={resRows} />
      <HeaderGroup title="Request Headers (Redacted)" rows={reqRows} />
    </div>
  );
}

function HeaderGroup({ title, rows }: { title: string; rows: [string, string[]][] }) {
  const notify = useStore((s) => s.notify);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (rows.length === 0) return null;

  const copyValue = async (key: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      notify(`Copied ${key}`, "success");
      window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1200);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  return (
    <div className="border-b border-line">
      <div className="flex h-[30px] items-center justify-between border-b border-line bg-chrome/60 px-3">
        <span className="text-[11.5px] font-semibold text-ink2">{title}</span>
        <span className="mono text-[10.5px] text-ink3">{rows.length}</span>
      </div>
      <div className="divide-y divide-line-subtle">
        {rows.map(([key, values]) => {
          const joined = values.join(", ");
          return (
            <div key={key} className="group grid grid-cols-[36%_1fr_30px] items-start text-[12px] hover:bg-subtle/35">
              <span className="select-text px-3 py-1.5 mono font-medium text-ink2 break-all">{key}</span>
              <span className="select-text border-l border-line-subtle px-3 py-1.5 mono break-all text-ink">
                {joined}
              </span>
              <button
                type="button"
                title={`Copy ${key} value`}
                onClick={() => void copyValue(key, joined)}
                className="motion flex h-full min-h-[28px] items-center justify-center text-ink3 opacity-0 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
              >
                {copiedKey === key ? (
                  <Check className="h-3 w-3 text-emerald" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimingView({ timings, totalMS }: { timings: Timings; totalMS: number }) {
  const values = PHASES.map((p) => ({ ...p, ms: Math.max(0, timings?.[p.key] ?? 0) }));
  const maxPhase = Math.max(...values.map((v) => v.ms), 1);
  const sum = values.reduce((acc, v) => acc + v.ms, 0) || totalMS || 1;
  const totalSplit = splitDuration(totalMS);

  return (
    <div className="scroll h-full overflow-y-auto p-3.5 space-y-3.5">
      <div className="flex items-center justify-between rounded-lg border border-line bg-chrome/60 px-3.5 py-2.5">
        <div>
          <div className="eyebrow">Total Round-Trip</div>
          <p className="mt-0.5 text-[11.5px] text-ink3">Measured via Go httptrace</p>
        </div>
        <MetricDisplay num={totalSplit.num} unit={totalSplit.unit} size="lg" />
      </div>

      <div className="divide-y divide-line-subtle rounded-lg border border-line bg-canvas px-3.5">
        {values.map((phase) => {
          const share = Math.round((phase.ms / sum) * 100);
          return (
            <div key={phase.key} className="py-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cx("h-2 w-2 rounded-full", phase.dotClass)} />
                  <span className="text-[12px] font-medium text-ink">{phase.label}</span>
                  <span className="mono text-[10.5px] text-ink3">{share}%</span>
                </div>
                <MetricDisplay num={phase.ms.toFixed(1)} unit="ms" size="sm" />
              </div>
              <div className="h-[6px] w-full overflow-hidden rounded-[2px] bg-tick-track">
                <div
                  className={cx("h-full rounded-[2px]", phase.colorClass)}
                  style={{ width: `${Math.max((phase.ms / maxPhase) * 100, phase.ms > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
