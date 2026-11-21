import { Columns2, PanelLeft, Rows2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { relativeTime } from "../lib/format";
import { useStore } from "../store";
import { cx, Kbd, Tip } from "./Primitives";

export function StatusBar() {
  const {
    sidebarOpen,
    layout,
    hasEditor,
    root,
    agentUnseenCount,
    lastSyncedAt,
    set,
  } = useStore(
    useShallow((s) => ({
      sidebarOpen: s.sidebarOpen,
      layout: s.layout,
      hasEditor: Boolean(s.editor),
      root: s.root,
      agentUnseenCount: s.agentIds.length,
      lastSyncedAt: s.lastSyncedAt,
      set: s.set,
    })),
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <footer className="flex h-[26px] shrink-0 items-center justify-between gap-3 border-t border-line bg-chrome px-2 text-[11px] text-ink3">
      {/* Left: Sidebar toggle + IPC sync state + Agent notifications */}
      <div className="flex min-w-0 items-center gap-2">
        <Tip label={sidebarOpen ? "Hide sidebar (⌘B)" : "Show sidebar (⌘B)"} side="top">
          <button
            type="button"
            onClick={() => set({ sidebarOpen: !sidebarOpen })}
            className={cx(
              "motion relative inline-flex h-[20px] items-center gap-1 rounded px-1.5 hover:bg-subtle hover:text-ink",
              sidebarOpen ? "text-ink2" : "text-ink3",
            )}
          >
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span className="hidden sm:inline">Sidebar</span>
            {!sidebarOpen && agentUnseenCount > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-violet" />
            )}
          </button>
        </Tip>

        <span className="h-3 w-px bg-line" />

        <span className="inline-flex shrink-0 items-center gap-1.5 text-ink2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
          <span>IPC live</span>
        </span>

        <span className="hidden text-ink3 sm:inline">
          synced <span className="font-medium text-ink2">{relativeTime(lastSyncedAt, now)}</span>
        </span>

        {agentUnseenCount > 0 && (
          <>
            <span className="h-3 w-px bg-line" />
            <button
              type="button"
              onClick={() => set({ sidebarOpen: true, sidebarTab: "activity" })}
              className="motion inline-flex items-center gap-1 rounded bg-violet-soft px-1.5 py-[1px] font-medium text-violet hover:brightness-95"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>{agentUnseenCount} agent {agentUnseenCount === 1 ? "update" : "updates"}</span>
            </button>
          </>
        )}
      </div>

      {/* Right: Workspace path + Layout toggle + Command Palette hint */}
      <div className="flex min-w-0 items-center gap-2">
        {root && (
          <span
            title={root}
            className="hidden max-w-[320px] truncate mono text-[10.5px] text-ink3 md:inline"
          >
            {root}
          </span>
        )}

        {hasEditor && (
          <>
            <span className="hidden h-3 w-px bg-line md:inline-block" />
            <div className="inline-flex items-center rounded border border-line bg-canvas p-[1px]">
              <Tip label="Side-by-side layout" side="top">
                <button
                  type="button"
                  onClick={() => set({ layout: "split" })}
                  className={cx(
                    "motion inline-flex h-[18px] w-[22px] items-center justify-center rounded-[3px]",
                    layout === "split" ? "bg-subtle text-ink" : "text-ink3 hover:text-ink2",
                  )}
                >
                  <Columns2 className="h-3 w-3" strokeWidth={1.9} />
                </button>
              </Tip>
              <Tip label="Stacked layout" side="top">
                <button
                  type="button"
                  onClick={() => set({ layout: "stack" })}
                  className={cx(
                    "motion inline-flex h-[18px] w-[22px] items-center justify-center rounded-[3px]",
                    layout === "stack" ? "bg-subtle text-ink" : "text-ink3 hover:text-ink2",
                  )}
                >
                  <Rows2 className="h-3 w-3" strokeWidth={1.9} />
                </button>
              </Tip>
            </div>
          </>
        )}

        <span className="h-3 w-px bg-line" />

        <button
          type="button"
          onClick={() => set({ paletteOpen: true })}
          className="motion inline-flex h-[20px] items-center gap-1 rounded px-1 text-ink3 hover:bg-subtle hover:text-ink2"
        >
          <span>Commands</span>
          <Kbd className="min-h-[15px] min-w-[15px] px-1 text-[9.5px]">⌘K</Kbd>
        </button>
      </div>
    </footer>
  );
}
