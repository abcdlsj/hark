import { useEffect, useRef, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { CurlImportModal } from "./components/CurlImportModal";
import { Navigator } from "./components/Navigator";
import { cx, TooltipProvider } from "./components/Primitives";
import { RequestWorkbench } from "./components/RequestWorkbench";
import { ResponseInspector } from "./components/ResponseInspector";
import { ToastHost } from "./components/ToastHost";
import { TopBar } from "./components/TopBar";
import { VariablesModal } from "./components/VariablesModal";
import { WorkspaceBootSkeleton } from "./components/VisualStates";
import { WorkspaceOverview } from "./components/WorkspaceOverview";
import { useStore } from "./store";

const isTypingTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return el.isContentEditable || Boolean(el.closest(".cm-editor"));
};

export function App() {
  const {
    booted,
    theme,
    sidebarOpen,
    layout,
    splitRatio,
    editor,
    running,
    boot,
    newDraft,
    sendRequest,
    saveEditor,
    cancelRequest,
    copyCurl,
    importCurl,
    set,
  } = useStore();

  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1120);
  const dragging = useRef(false);
  const splitContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1120);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter") {
        event.preventDefault();
        void sendRequest();
        return;
      }
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveEditor();
        return;
      }
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        set({ paletteOpen: !useStore.getState().paletteOpen });
        return;
      }
      if (mod && event.key.toLowerCase() === "n") {
        event.preventDefault();
        newDraft();
        return;
      }
      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        set({ sidebarOpen: !useStore.getState().sidebarOpen });
        return;
      }
      if (mod && event.key.toLowerCase() === "e") {
        event.preventDefault();
        set({ envMenuOpen: !useStore.getState().envMenuOpen });
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void copyCurl(false);
        return;
      }
      if (event.key === "Escape") {
        if (running) {
          void cancelRequest();
          return;
        }
        if (useStore.getState().snapshot) {
          set({ snapshot: null });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelRequest, copyCurl, newDraft, running, saveEditor, sendRequest, set]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (!text.trim().toLowerCase().startsWith("curl")) return;
      event.preventDefault();
      void importCurl(text);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [importCurl]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragging.current || !splitContainer.current) return;
      const rect = splitContainer.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = (event.clientX - rect.left) / rect.width;
      set({ splitRatio: Math.min(0.76, Math.max(0.24, ratio)) });
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [set]);

  const sideBySide = layout === "split" && wide;

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-frame text-ink">
        <TopBar />

        {!booted ? (
          <WorkspaceBootSkeleton sidebarOpen={sidebarOpen} />
        ) : (
          <div className="flex min-h-0 flex-1 px-2.5 pb-2.5">
            <div
              aria-hidden={!sidebarOpen}
              className={cx(
                "shrink-0 overflow-hidden transition-[width,margin,opacity] duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]",
                sidebarOpen ? "mr-2.5 w-[258px] opacity-100" : "pointer-events-none mr-0 w-0 opacity-0",
              )}
            >
              <div
                className={cx(
                  "flex h-full w-[258px] transition-transform duration-220 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  sidebarOpen ? "translate-x-0" : "-translate-x-3",
                )}
              >
                <Navigator />
              </div>
            </div>

            <main key={editor ? "workbench" : "overview"} className="anim-fade-up flex min-w-0 flex-1 flex-col">
              {!editor ? (
                <WorkspaceOverview />
              ) : (
                <div ref={splitContainer} className="flex min-h-0 flex-1 flex-col">
                  {sideBySide ? (
                    <div className="flex min-h-0 flex-1">
                      <div className="flex min-w-0 flex-col" style={{ width: `${splitRatio * 100}%` }}>
                        <RequestWorkbench />
                      </div>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        onMouseDown={() => {
                          dragging.current = true;
                          document.body.style.cursor = "col-resize";
                        }}
                        className="group flex w-2.5 shrink-0 cursor-col-resize items-center justify-center"
                      >
                        <span className="motion h-10 w-[3px] rounded-full bg-line group-hover:h-16 group-hover:bg-cobalt/60" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <ResponseInspector />
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                      <div className="flex min-h-[45%] flex-1 flex-col">
                        <RequestWorkbench />
                      </div>
                      <div className="flex min-h-[38%] flex-1 flex-col">
                        <ResponseInspector />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}

        <CommandPalette />
        <VariablesModal />
        <CurlImportModal />
        <ToastHost />
      </div>
    </TooltipProvider>
  );
}
