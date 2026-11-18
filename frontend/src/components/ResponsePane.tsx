import * as Popover from "@radix-ui/react-popover";
import { useMemo } from "react";
import { contentType, humanBytes, humanMS, prettyBody } from "../lib/format";
import { useStore } from "../store";
import type { RunView, Timings } from "../lib/types";
import { cx, Dot, TabButton } from "./ui";
import { JsonEditor } from "./JsonEditor";

export function ResponsePane() {
  const { run, snapshot, running, responseView, set } = useStore();

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

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-line px-3">
        {view ? (
          <>
            <span
              className={cx(
                "mono text-[11.5px]",
                view.status < 300 ? "text-get" : view.status < 400 ? "text-post" : "text-del",
              )}
            >
              {view.status} {view.status_text}
            </span>
            <span className="text-ink3">·</span>
            <TimingsHover timings={view.timings} label={humanMS(view.duration_ms)} />
            <span className="text-ink3">·</span>
            <span className="mono text-[11px] text-ink2">{humanBytes(view.size)}</span>
            {snapshot && <Dot tone="secret" />}
            {view.truncated && <span className="mono text-[10px] text-put">capped at 8MB</span>}
            {view.error && <span className="mono truncate text-[10.5px] text-del">{view.error}</span>}
          </>
        ) : (
          <span className="mono text-[11px] text-ink3">{running ? "Sending…" : "No response yet"}</span>
        )}
        <div className="ml-auto flex h-full items-center">
          <TabButton active={responseView === "pretty"} onClick={() => set({ responseView: "pretty" })}>
            Pretty
          </TabButton>
          <TabButton active={responseView === "raw"} onClick={() => set({ responseView: "raw" })}>
            Raw
          </TabButton>
          <TabButton active={responseView === "headers"} onClick={() => set({ responseView: "headers" })}>
            Headers
          </TabButton>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {!view ? (
          <EmptyState />
        ) : responseView === "headers" ? (
          <HeadersView headers={view.response_headers} />
        ) : responseView === "raw" ? (
          <RawView view={view} />
        ) : (
          <PrettyView view={view} />
        )}
      </div>
    </section>
  );
}

function PrettyView({ view }: { view: RunView }) {
  const ctype = contentType(view.response_headers);
  const { text } = prettyBody(view.body);
  const isJSON = ctype.includes("json") || text !== view.body;
  if (!view.body) {
    return <div className="px-3 py-2 text-[11px] text-ink3">Empty body.</div>;
  }
  if (isJSON) return <JsonEditor value={text} readOnly />;
  return (
    <pre className="scroll h-full overflow-auto whitespace-pre-wrap break-words px-3 py-2 mono text-[12px] leading-[1.55] text-ink">
      {view.body}
    </pre>
  );
}

function RawView({ view }: { view: RunView }) {
  const raw = useMemo(() => {
    const lines: string[] = [];
    lines.push(`${view.method} ${view.url}`);
    lines.push("");
    for (const [k, values] of Object.entries(view.request_headers ?? {})) {
      for (const v of values) lines.push(`${k}: ${v}`);
    }
    lines.push("");
    lines.push("--- response ---");
    for (const [k, values] of Object.entries(view.response_headers ?? {})) {
      for (const v of values) lines.push(`${k}: ${v}`);
    }
    lines.push("");
    lines.push(view.body);
    return lines.join("\n");
  }, [view]);
  return (
    <pre className="scroll h-full overflow-auto whitespace-pre-wrap break-words px-3 py-2 mono text-[11.5px] leading-[1.55] text-ink2">
      {raw}
    </pre>
  );
}

function HeadersView({ headers }: { headers?: Record<string, string[]> }) {
  const rows = Object.entries(headers ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (rows.length === 0) return <div className="px-3 py-2 text-[11px] text-ink3">No headers.</div>;
  return (
    <div className="scroll h-full overflow-auto">
      {rows.map(([key, values]) => (
        <div key={key} className="grid grid-cols-[32%_1fr] border-b border-line text-[11.5px]">
          <span className="px-3 py-1 mono text-ink2">{key}</span>
          <span className="border-l border-line px-3 py-1 mono break-all text-ink">{values.join(", ")}</span>
        </div>
      ))}
    </div>
  );
}

function TimingsHover({ timings, label }: { timings: Timings; label: string }) {
  const phases: [string, number][] = [
    ["DNS", timings?.dns_ms ?? 0],
    ["TCP", timings?.tcp_ms ?? 0],
    ["TLS", timings?.tls_ms ?? 0],
    ["TTFB", timings?.ttfb_ms ?? 0],
    ["Download", timings?.download_ms ?? 0],
  ];
  const max = Math.max(...phases.map(([, v]) => v), 1);
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="mono text-[11px] text-ink2 hover:text-ink">
          {label}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={6} className="overlay z-50 w-[200px] rounded-[8px] p-2">
          {phases.map(([name, value]) => (
            <div key={name} className="flex items-center gap-2 py-0.5">
              <span className="w-[62px] mono text-[10.5px] text-ink3">{name}</span>
              <span className="h-[3px] flex-1 bg-line">
                <span className="block h-full bg-ink3" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
              </span>
              <span className="w-[46px] text-right mono text-[10px] text-ink2">{value.toFixed(1)}</span>
            </div>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-start justify-center pt-[14%]">
      <div className="mono text-[11.5px] leading-[2] text-ink3">
        <div>⌘↵ Send Request</div>
        <div>⌘V Paste cURL</div>
        <div>⌘K Command Palette</div>
      </div>
    </div>
  );
}
