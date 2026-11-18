import { Check, Copy, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
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
  MetricDisplay,
  SegmentedBar,
  SegmentedTabs,
  StatusCapsule,
  SwapText,
} from "./Primitives";
import { InspectorEmptyBlueprint, InspectorLoadingState } from "./VisualStates";

interface PhaseSpec {
  key: keyof Timings;
  label: string;
  short: string;
  colorClass: string;
  dotClass: string;
}

const PHASES: PhaseSpec[] = [
  { key: "dns_ms", label: "DNS Lookup", short: "DNS", colorClass: "bg-sky", dotClass: "bg-sky" },
  { key: "tcp_ms", label: "TCP Handshake", short: "TCP", colorClass: "bg-cobalt", dotClass: "bg-cobalt" },
  { key: "tls_ms", label: "TLS Handshake", short: "TLS", colorClass: "bg-violet", dotClass: "bg-violet" },
  { key: "ttfb_ms", label: "Server Wait · TTFB", short: "TTFB", colorClass: "bg-emerald", dotClass: "bg-emerald" },
  { key: "download_ms", label: "Content Download", short: "DL", colorClass: "bg-amber", dotClass: "bg-amber" },
];

export function ResponseInspector() {
  const { run, snapshot, running, runStartedAt, inspectorTab, cancelRequest, set, notify } = useStore();
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
      <section className="island flex min-h-0 flex-1 flex-col overflow-hidden">
        <InspectorLoadingState startedAt={runStartedAt} onCancel={() => void cancelRequest()} />
      </section>
    );
  }

  return (
    <section className="island flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Telemetry Hero Strip */}
      {view ? (
        <div key={view.log_id} className="anim-fade-up shrink-0 space-y-2.5 border-b border-line bg-subtle/40 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <StatusCapsule status={view.status} text={view.status_text} hasError={Boolean(view.error)} />
              <ActorTag actor={view.actor} compact />
              <EnvCapsule env={view.env} size="xs" />
              {snapshot && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-violet">
                  <Sparkles className="h-3 w-3" />
                  <span>{relativeTime(snapshot.ts)}</span>
                </span>
              )}
              {view.truncated && (
                <span className="mono rounded-full bg-amber-soft px-2 py-[2px] text-[10px] font-semibold text-amber">
                  8 MB cap
                </span>
              )}
            </div>

            <div className="flex items-center gap-5">
              {dur && (
                <div className="text-right">
                  <div className="eyebrow text-[9.5px]">Latency</div>
                  <MetricDisplay num={dur.num} unit={dur.unit} size="md" />
                </div>
              )}
              {size && (
                <div className="text-right">
                  <div className="eyebrow text-[9.5px]">Payload</div>
                  <MetricDisplay num={size.num} unit={size.unit} size="md" />
                </div>
              )}
            </div>
          </div>

          {/* Gauge Segmented Timing Bar */}
          <button
            type="button"
            onClick={() => set({ inspectorTab: "timing" })}
            title="View full network phase timing breakdown"
            className="group block w-full text-left"
          >
            <SegmentedBar ticks={30} segments={timingSegments} heightClass="h-[10px]" />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-ink3">
              <div className="flex flex-wrap items-center gap-3">
                {PHASES.map((p) => {
                  const val = view.timings?.[p.key] ?? 0;
                  if (val <= 0) return null;
                  return (
                    <span key={p.key} className="inline-flex items-center gap-1">
                      <span className={cx("h-1.5 w-1.5 rounded-full", p.dotClass)} />
                      <span className="font-medium text-ink2">{p.short}</span>
                      <span className="mono">{val.toFixed(1)}ms</span>
                    </span>
                  );
                })}
              </div>
              <span className="font-medium text-ink3 group-hover:text-cobalt">Timing details →</span>
            </div>
          </button>

          {view.error && (
            <div className="rounded-[8px] border border-rose/25 bg-rose-soft px-2.5 py-1.5 mono text-[11.5px] text-rose">
              {view.error}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[44px] shrink-0 items-center justify-between border-b border-line bg-subtle/40 px-4">
          <span className="eyebrow">Response Inspector</span>
          <span className="mono text-[11px] text-ink3">
            {running ? "Executing request…" : "Ready"}
          </span>
        </div>
      )}

      {/* Inspector Tabs & Utility Strip */}
      <div className="flex h-[40px] shrink-0 items-center justify-between gap-2 border-b border-line bg-subtle/45 px-3.5">
        <SegmentedTabs
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

        <div className="flex items-center gap-2">
          {ctype && (
            <span className="hidden max-w-[180px] truncate rounded-[6px] bg-muted px-2 py-[2px] mono text-[10.5px] text-ink2 sm:inline">
              {ctype.split(";")[0]}
            </span>
          )}
          {view?.body && (
            <Button size="xs" variant="secondary" onClick={() => void copyBody()}>
              {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
              <SwapText value={copied ? "Copied" : "Copy"} options={["Copy", "Copied"]} />
            </Button>
          )}
        </div>
      </div>

      {/* Response Content */}
      <div key={view ? `${view.log_id}:${inspectorTab}` : "empty"} className="anim-fade-up min-h-0 flex-1">
        {!view ? (
          <InspectorEmptyBlueprint />
        ) : inspectorTab === "headers" ? (
          <HeadersView view={view} />
        ) : inspectorTab === "raw" ? (
          <RawView view={view} />
        ) : inspectorTab === "timing" ? (
          <TimingView timings={view.timings} totalMS={view.duration_ms} />
        ) : (
          <PrettyView view={view} />
        )}
      </div>
    </section>
  );
}

function PrettyView({ view }: { view: RunView }) {
  const ctype = contentType(view.response_headers);
  const { text, json } = prettyBody(view.body);
  const isJSON = ctype.includes("json") || json;

  if (!view.body) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[12.5px] text-ink3">
        Empty response body.
      </div>
    );
  }
  if (isJSON) {
    return <CodeBlockEditor value={text} readOnly language />;
  }
  return (
    <pre className="scroll h-full overflow-auto whitespace-pre-wrap break-words px-4 py-3 mono text-[12.5px] leading-[1.65] text-ink">
      {view.body}
    </pre>
  );
}

function RawView({ view }: { view: RunView }) {
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
    <pre className="scroll h-full overflow-auto whitespace-pre-wrap break-words px-4 py-3 mono text-[12px] leading-[1.65] text-ink2">
      {raw}
    </pre>
  );
}

function HeadersView({ view }: { view: RunView }) {
  const resRows = Object.entries(view.response_headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const reqRows = Object.entries(view.request_headers ?? {}).sort(([a], [b]) => a.localeCompare(b));

  if (resRows.length === 0 && reqRows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[12.5px] text-ink3">
        No headers recorded.
      </div>
    );
  }

  return (
    <div className="scroll h-full overflow-y-auto p-4 space-y-5">
      <HeaderGroup title="Response Headers" rows={resRows} />
      <HeaderGroup title="Request Headers (Redacted)" rows={reqRows} />
    </div>
  );
}

function HeaderGroup({ title, rows }: { title: string; rows: [string, string[]][] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[11px] border border-line bg-surface">
      <div className="border-b border-line bg-subtle/60 px-3 py-2">
        <span className="eyebrow">{title}</span>
      </div>
      <div className="divide-y divide-line/70">
        {rows.map(([key, values]) => (
          <div key={key} className="grid grid-cols-[36%_1fr] text-[12px]">
            <span className="px-3 py-2 mono font-medium text-ink2 break-all">{key}</span>
            <span className="border-l border-line/70 px-3 py-2 mono break-all text-ink">
              {values.join(", ")}
            </span>
          </div>
        ))}
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
    <div className="scroll h-full overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between rounded-[12px] border border-line bg-subtle/60 px-4 py-3">
        <div>
          <div className="eyebrow">Total Round-Trip</div>
          <p className="mt-0.5 text-[11.5px] text-ink3">Measured via Go httptrace</p>
        </div>
        <MetricDisplay num={totalSplit.num} unit={totalSplit.unit} size="lg" />
      </div>

      <div className="divide-y divide-line rounded-[12px] border border-line bg-surface px-4">
        {values.map((phase) => {
          const share = Math.round((phase.ms / sum) * 100);
          return (
            <div key={phase.key} className="py-3.5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={cx("h-2 w-2 rounded-full", phase.dotClass)} />
                  <span className="text-[12.5px] font-semibold text-ink">{phase.label}</span>
                  <span className="mono text-[11px] text-ink3">{share}%</span>
                </div>
                <MetricDisplay num={phase.ms.toFixed(1)} unit="ms" size="sm" />
              </div>
              <SegmentedBar
                ticks={28}
                ratio={phase.ms / maxPhase}
                fillClass={phase.colorClass}
                heightClass="h-[11px]"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
