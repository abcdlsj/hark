import { Activity, ArrowRight, Braces, FileBraces, Loader2, Plus, SearchX, Square } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { splitDuration } from "../lib/format";
import { Button, cx, Kbd } from "./Primitives";

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("animate-spin", className)} strokeWidth={2.2} />;
}

/** Full-bleed structural skeleton shown only on initial bootstrap before IPC data arrives. */
export function WorkspaceBootSkeleton({ sidebarOpen }: { sidebarOpen: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {sidebarOpen && (
        <aside className="flex w-[252px] shrink-0 flex-col border-r border-line bg-chrome">
          <div className="flex h-[38px] items-center justify-between border-b border-line px-3">
            <SkeletonLine className="h-4 w-32" />
            <SkeletonLine className="h-5 w-5" />
          </div>
          <div className="flex h-[34px] items-center border-b border-line bg-canvas px-3">
            <SkeletonLine className="h-3.5 w-full" />
          </div>
          <div className="flex-1 space-y-2.5 p-3">
            <SkeletonLine className="h-3 w-16" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <SkeletonLine className="h-3.5 w-8" />
                <SkeletonLine className="h-3.5 flex-1" />
              </div>
            ))}
          </div>
        </aside>
      )}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas p-6">
        <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
          <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <SkeletonLine className="h-6 w-40" />
                <SkeletonLine className="h-5 w-16" />
              </div>
              <SkeletonLine className="h-3.5 w-64" />
            </div>
            <div className="flex items-center gap-2">
              <SkeletonLine className="h-[32px] w-28 rounded-md" />
              <SkeletonLine className="h-[32px] w-32 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-lg border border-line bg-chrome/60 p-3.5">
                <SkeletonLine className="h-3 w-20" />
                <SkeletonLine className="h-6 w-14" />
                <SkeletonLine className="h-3 w-28" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[0, 1].map((card) => (
              <div key={card} className="space-y-2.5 rounded-lg border border-line bg-canvas p-4">
                <SkeletonLine className="h-4 w-28" />
                {[0, 1, 2, 3].map((row) => (
                  <SkeletonLine key={row} className="h-8 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Calm, authoritative in-flight state: clean progress bar, live elapsed time, clear cancel. */
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
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <div className="inflight-bar flex h-[38px] shrink-0 items-center justify-between border-b border-line bg-chrome/60 px-3">
        <div className="flex items-center gap-2 text-[12px]">
          <Spinner className="h-3.5 w-3.5 text-accent-text" />
          <span className="font-medium text-ink">Sending request…</span>
          <span className="mono text-[11.5px] text-ink3">
            {split.num} {split.unit}
          </span>
        </div>

        <Button size="xs" variant="danger" onClick={onCancel}>
          <Square className="h-2.5 w-2.5 fill-current" />
          <span>Cancel</span>
          <Kbd className="border-rose/30 bg-rose/10 text-rose">Esc</Kbd>
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <Spinner className="h-5 w-5 text-accent-text" />
        <div className="mt-3 text-[12.5px] font-medium text-ink">Waiting for response…</div>
        <div className="mt-1 mono text-[11.5px] text-ink3">
          Elapsed {split.num} {split.unit} · Go httptrace active
        </div>
      </div>
    </div>
  );
}

/** Hoppscotch-inspired shortcuts table for the empty response inspector. */
export function InspectorEmptyState() {
  const rows: { label: string; keys: string[] }[] = [
    { label: "Send Request", keys: ["⌘", "↵"] },
    { label: "Save Endpoint", keys: ["⌘", "S"] },
    { label: "Command Palette", keys: ["⌘", "K"] },
    { label: "Switch Environment", keys: ["⌘", "E"] },
    { label: "Import cURL from Clipboard", keys: ["⌘", "V"] },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-6">
      <div className="grid grid-cols-[auto_auto] items-center gap-x-5 gap-y-2.5 text-[12px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <span className="text-right text-ink3">{row.label}</span>
            <span className="flex items-center gap-1">
              {row.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Quiet empty-state mark for Navigator & Body None. */
function EmptyMark({ icon }: { icon: ReactNode }) {
  return (
    <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-md border border-line bg-chrome text-ink3">
      {icon}
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
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-5 text-center">
      <EmptyMark icon={<Braces className="h-4 w-4" strokeWidth={1.8} />} />

      <div className="text-[12.5px] font-semibold text-ink">This request does not have a body</div>
      <p className="mt-1 max-w-[270px] text-[11.5px] leading-relaxed text-ink3">
        Choose a content type above or start with a JSON payload or multipart form fields.
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
  const icon = filtered ? (
    <SearchX className="h-4 w-4" strokeWidth={1.8} />
  ) : mode === "endpoints" ? (
    <FileBraces className="h-4 w-4" strokeWidth={1.8} />
  ) : (
    <Activity className="h-4 w-4" strokeWidth={1.8} />
  );

  return (
    <div className="flex flex-col items-center px-4 py-8 text-center">
      <EmptyMark icon={icon} />

      <div className="text-[12px] font-semibold text-ink">
        {filtered
          ? "No matching items"
          : mode === "endpoints"
            ? "No saved endpoints"
            : "No activity yet"}
      </div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink3">
        {filtered
          ? "Try a different keyword or clear the filter."
          : mode === "endpoints"
            ? "Create a request or paste a cURL command anywhere."
            : "Human and AI agent runs will stream here live."}
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
