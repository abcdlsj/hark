import { Activity, ArrowRight, Braces, FileBraces, Loader2, Plus, Radar, SearchX, Square } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { splitDuration } from "../lib/format";
import { Button, cx, Kbd, MetricDisplay } from "./Primitives";

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-[6px]", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} strokeWidth={2.2} />;
}

/** Full-frame skeleton shown only on initial bootstrap before IPC data arrives. */
export function WorkspaceBootSkeleton({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 px-2.5 pb-2.5">
      {sidebarOpen && (
        <aside className="island mr-2.5 flex w-[258px] shrink-0 flex-col overflow-hidden">
          <div className="flex h-[44px] items-center justify-between border-b border-line px-2.5">
            <SkeletonLine className="h-[26px] w-[162px] rounded-[9px]" />
            <SkeletonLine className="h-[28px] w-[28px] rounded-[8px]" />
          </div>
          <div className="border-b border-line/70 px-2.5 py-2">
            <SkeletonLine className="h-[30px] w-full rounded-[9px]" />
          </div>
          <div className="flex-1 space-y-3 p-3">
            <SkeletonLine className="h-3 w-16" />
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <SkeletonLine className="h-[18px] w-[42px] rounded-[5px]" />
                  <SkeletonLine className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
            <SkeletonLine className="mt-2 h-3 w-20" />
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <SkeletonLine className="h-[18px] w-[42px] rounded-[5px]" />
                  <SkeletonLine className="h-3.5 flex-1" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      <section className="island flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-7 w-44 rounded-[8px]" />
                <SkeletonLine className="h-6 w-20 rounded-full" />
              </div>
              <SkeletonLine className="h-3.5 w-72" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-[32px] w-28 rounded-[9px]" />
              <SkeletonLine className="h-[32px] w-32 rounded-[9px]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2.5 rounded-[12px] border border-line bg-subtle/60 p-4">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-6 w-16" />
                <SkeletonLine className="h-3 w-28" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((card) => (
              <div key={card} className="space-y-3 rounded-[12px] border border-line bg-subtle/40 p-4">
                <SkeletonLine className="h-4 w-28" />
                {[0, 1, 2, 3].map((row) => (
                  <SkeletonLine key={row} className="h-10 w-full rounded-[8px]" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const CODE_SKELETON_WIDTHS = [
  { indent: 0, width: "w-6" },
  { indent: 16, width: "w-36" },
  { indent: 16, width: "w-48" },
  { indent: 16, width: "w-56" },
  { indent: 32, width: "w-40" },
  { indent: 32, width: "w-52" },
  { indent: 32, width: "w-32" },
  { indent: 16, width: "w-10" },
  { indent: 16, width: "w-44" },
  { indent: 0, width: "w-6" },
];

/** Live in-flight telemetry + animated wave Gauge bar + code shimmer skeleton. */
export function InspectorLoadingState({
  startedAt,
  onCancel,
}: {
  startedAt: number | null;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(() => (startedAt ? Math.max(0, Date.now() - startedAt) : 0));

  useEffect(() => {
    const base = startedAt ?? Date.now();
    setElapsed(Math.max(0, Date.now() - base));
    const timer = window.setInterval(() => {
      setElapsed(Math.max(0, Date.now() - base));
    }, 50);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const split = splitDuration(elapsed);

  return (
    <div className="anim-fade-up flex min-h-0 flex-1 flex-col">
      {/* Live Telemetry Header */}
      <div className="shrink-0 space-y-2.5 border-b border-line bg-subtle/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-full bg-cobalt-soft px-2.5 py-[3px] text-[11.5px] font-semibold text-cobalt">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cobalt opacity-65" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cobalt" />
              </span>
              <span>Sending request…</span>
            </span>

            <Button size="xs" variant="danger" onClick={onCancel}>
              <Square className="h-2.5 w-2.5 fill-current" />
              <span>Cancel</span>
              <Kbd className="border-rose/25 bg-rose/10 text-rose">Esc</Kbd>
            </Button>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="eyebrow text-[9.5px]">Elapsed</div>
              <MetricDisplay num={split.num} unit={split.unit} size="md" />
            </div>
            <div className="text-right">
              <div className="eyebrow text-[9.5px]">Payload</div>
              <SkeletonLine className="mt-1.5 h-4 w-12" />
            </div>
          </div>
        </div>

        {/* Animated Wave Segmented Bar */}
        <div>
          <div className="flex items-center gap-[2.5px]">
            {Array.from({ length: 30 }).map((_, idx) => (
              <span
                key={idx}
                style={{ animationDelay: `${(idx % 12) * 55}ms` }}
                className={cx(
                  "tick-wave h-[10px] flex-1 rounded-[2.5px]",
                  idx % 3 === 0 ? "bg-violet/70" : "bg-cobalt/75",
                )}
              />
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10.5px] text-ink3">
            <span>Awaiting response headers & payload stream…</span>
            <span className="mono">httptrace active</span>
          </div>
        </div>
      </div>

      {/* Tab bar shimmer placeholder */}
      <div className="flex h-[40px] shrink-0 items-center justify-between border-b border-line bg-subtle/45 px-3.5">
        <div className="flex items-center gap-1 rounded-[10px] bg-muted p-[3px]">
          <span className="rounded-[7px] bg-surface px-2.5 py-1 text-[12px] font-medium text-ink2 shadow-xs">
            Pretty
          </span>
          <span className="px-2.5 py-1 text-[12px] font-medium text-ink3">Raw</span>
          <span className="px-2.5 py-1 text-[12px] font-medium text-ink3">Headers</span>
          <span className="px-2.5 py-1 text-[12px] font-medium text-ink3">Timing</span>
        </div>
        <SkeletonLine className="h-5 w-24 rounded-[6px]" />
      </div>

      {/* JSON Payload Shimmer Skeleton */}
      <div className="scroll flex-1 overflow-hidden px-3 py-3.5">
        <div className="space-y-2.5">
          {CODE_SKELETON_WIDTHS.map((line, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-5 text-right mono text-[11px] text-ink3/60">{i + 1}</span>
              <div style={{ marginLeft: `${line.indent}px` }} className="flex items-center gap-2">
                <SkeletonLine className={cx("h-[13px] rounded-[4px]", line.width)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Shared empty-state mark: a quiet icon tile. Skeletons are for loading only. */
function EmptyMark({
  icon,
  tone = "muted",
}: {
  icon: ReactNode;
  tone?: "cobalt" | "violet" | "amber" | "muted";
}) {
  const tones = {
    cobalt: "bg-cobalt-soft text-cobalt",
    violet: "bg-violet-soft text-violet",
    amber: "bg-amber-soft text-amber",
    muted: "bg-subtle text-ink3",
  };
  return (
    <div
      className={cx(
        "mb-3 flex h-10 w-10 items-center justify-center rounded-[11px] border border-line",
        tones[tone],
      )}
    >
      {icon}
    </div>
  );
}

/** Response inspector with nothing to show yet. */
export function InspectorEmptyState() {
  return (
    <div className="scroll anim-fade-up flex h-full flex-col items-center justify-center overflow-y-auto p-5 text-center">
      <EmptyMark icon={<Radar className="h-4.5 w-4.5" strokeWidth={1.8} />} tone="cobalt" />

      <div className="text-[13.5px] font-semibold tracking-tight text-ink">Ready to inspect</div>
      <p className="mt-1 max-w-[290px] text-[12px] leading-relaxed text-ink3">
        Send this request to inspect the response payload, headers, and network phase timings.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11.5px] text-ink2">
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⌘↵</Kbd> Send
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⌘S</Kbd> Save
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd>⌘V</Kbd> Paste cURL
        </span>
      </div>
    </div>
  );
}

/** Request body tab set to None. */
export function BodyNoneState({
  onSelectJson,
  onSelectForm,
}: {
  onSelectJson: () => void;
  onSelectForm: () => void;
}) {
  return (
    <div className="scroll anim-fade-up flex h-full flex-col items-center justify-center overflow-y-auto p-4 text-center">
      <EmptyMark icon={<Braces className="h-4.5 w-4.5" strokeWidth={1.8} />} tone="violet" />

      <div className="text-[13px] font-semibold text-ink">No payload attached</div>
      <p className="mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-ink3">
        Choose a body format above or start immediately with JSON or multipart form fields.
      </p>

      <div className="mt-3.5 flex items-center gap-2">
        <Button size="xs" variant="secondary" onClick={onSelectJson}>
          <span>JSON Body</span>
          <ArrowRight className="h-3 w-3 text-ink3" />
        </Button>
        <Button size="xs" variant="secondary" onClick={onSelectForm}>
          <span>Form Data</span>
        </Button>
      </div>
    </div>
  );
}

/** Navigator Endpoints & Activity tabs with no rows to show. */
export function NavigatorEmptyState({
  mode,
  filtered,
  onNew,
  onClearFilter,
}: {
  mode: "endpoints" | "activity";
  filtered: boolean;
  onNew: () => void;
  onClearFilter: () => void;
}) {
  const mark = filtered
    ? { icon: <SearchX className="h-4.5 w-4.5" strokeWidth={1.8} />, tone: "muted" as const }
    : mode === "endpoints"
      ? { icon: <FileBraces className="h-4.5 w-4.5" strokeWidth={1.8} />, tone: "cobalt" as const }
      : { icon: <Activity className="h-4.5 w-4.5" strokeWidth={1.8} />, tone: "violet" as const };

  return (
    <div className="anim-fade-up flex flex-col items-center px-3 py-8 text-center">
      <EmptyMark icon={mark.icon} tone={mark.tone} />

      <div className="text-[12.5px] font-semibold text-ink">
        {filtered
          ? "No matching items"
          : mode === "endpoints"
            ? "No saved endpoints"
            : "No activity yet"}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink3">
        {filtered
          ? "Try a different keyword or clear the search filter."
          : mode === "endpoints"
            ? "Create a draft or paste a cURL command anywhere."
            : "Human and AI agent runs will stream here automatically."}
      </p>

      {filtered ? (
        <Button size="xs" variant="secondary" onClick={onClearFilter} className="mt-3">
          Clear filter
        </Button>
      ) : mode === "endpoints" ? (
        <Button size="xs" variant="primary" onClick={onNew} className="mt-3">
          <Plus className="h-3 w-3" />
          <span>New Request</span>
        </Button>
      ) : null}
    </div>
  );
}
