import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { OmniUrl } from "./components/OmniUrl";
import { Composer } from "./components/Composer";
import { ResponsePane } from "./components/ResponsePane";
import { CommandPalette } from "./components/CommandPalette";
import { VariablesDialog } from "./components/VariablesDialog";
import { SnapshotBanner } from "./components/SnapshotBanner";
import { Toast } from "./components/Toast";
import { TooltipProvider } from "./components/ui";

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable || Boolean(el.closest(".cm-editor"));
};

export function App() {
  const {
    boot,
    theme,
    sidebar,
    layout,
    editor,
    newDraft,
    send,
    save,
    cancel,
    running,
    set,
    copyCurl,
    pasteCurl,
    error,
  } = useStore();
  const [split, setSplit] = useState(0.52);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1200);
  const dragging = useRef(false);
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1200);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Global shortcuts. ⌘↵ and ⌘S work from inside editors too.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void send();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        set({ palette: !useStore.getState().palette });
        return;
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newDraft();
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        set({ sidebar: !useStore.getState().sidebar });
        return;
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        set({ envMenu: !useStore.getState().envMenu });
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copyCurl(false);
        return;
      }
      if (event.key === "Escape") {
        if (running) {
          void cancel();
          return;
        }
        if (useStore.getState().snapshot) {
          set({ snapshot: null });
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancel, copyCurl, newDraft, running, save, send, set]);

  // Magic paste: a cURL command on the clipboard anywhere outside a text field.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (!text.trim().toLowerCase().startsWith("curl")) return;
      event.preventDefault();
      void pasteCurl(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pasteCurl]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current || !shell.current) return;
      const rect = shell.current.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      setSplit(Math.min(0.8, Math.max(0.2, ratio)));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const sideBySide = layout === "split" && wide;

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-canvas text-ink">
        <Header />
        <div className="flex min-h-0 flex-1">
          {sidebar && <Sidebar />}
          <main className="flex min-w-0 flex-1 flex-col">
            <SnapshotBanner />
            {!editor ? (
              <EmptyWorkspace error={error} onNew={newDraft} />
            ) : (
              <>
                <OmniUrl />
                <div ref={shell} className="flex min-h-0 flex-1 flex-col">
                  {sideBySide ? (
                    <div className="flex min-h-0 flex-1">
                      <div className="flex min-w-0 flex-col" style={{ width: `${split * 100}%` }}>
                        <Composer />
                      </div>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        onMouseDown={() => {
                          dragging.current = true;
                          document.body.style.cursor = "col-resize";
                        }}
                        className="motion w-px shrink-0 cursor-col-resize bg-line hover:bg-line-strong"
                      />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <ResponsePane />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex min-h-[42%] flex-1 flex-col border-b border-line">
                        <Composer />
                      </div>
                      <div className="flex min-h-[34%] flex-1 flex-col">
                        <ResponsePane />
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
        <CommandPalette />
        <VariablesDialog />
        <Toast />
      </div>
    </TooltipProvider>
  );
}

function EmptyWorkspace({ error, onNew }: { error: string | null; onNew: () => void }) {
  return (
    <div className="flex h-full flex-col items-start justify-start gap-3 px-6 pt-[10%]">
      {error ? (
        <p className="mono text-[11.5px] leading-relaxed text-del">{error}</p>
      ) : (
        <>
          <p className="text-[12.5px] text-ink2">No request open.</p>
          <div className="mono text-[11.5px] leading-[2] text-ink3">
            <div>⌘N New request</div>
            <div>⌘V Paste cURL</div>
            <div>⌘K Command palette</div>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="motion mt-1 rounded-[5px] border border-line px-2.5 py-1 text-[11.5px] text-ink2 hover:border-line-strong hover:text-ink"
          >
            New request
          </button>
        </>
      )}
    </div>
  );
}
