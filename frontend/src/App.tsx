import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CommandPalette } from "./components/CommandPalette";
import { ConfirmDeleteModal } from "./components/ConfirmDeleteModal";
import { CurlImportModal } from "./components/CurlImportModal";
import { Navigator } from "./components/Navigator";
import { cx, TooltipProvider } from "./components/Primitives";
import { RequestWorkbench } from "./components/RequestWorkbench";
import { ResponseInspector } from "./components/ResponseInspector";
import { StatusBar } from "./components/StatusBar";
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
    stackRatio,
    hasEditor,
    running,
    boot,
    newDraft,
    sendRequest,
    saveEditor,
    cancelRequest,
    copyCurl,
    importCurl,
    set,
  } = useStore(
    useShallow((s) => ({
      booted: s.booted,
      theme: s.theme,
      sidebarOpen: s.sidebarOpen,
      layout: s.layout,
      splitRatio: s.splitRatio,
      stackRatio: s.stackRatio,
      hasEditor: Boolean(s.editor),
      running: s.running,
      boot: s.boot,
      newDraft: s.newDraft,
      sendRequest: s.sendRequest,
      saveEditor: s.saveEditor,
      cancelRequest: s.cancelRequest,
      copyCurl: s.copyCurl,
      importCurl: s.importCurl,
      set: s.set,
    })),
  );

  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1040);
  const [draggingAxis, setDraggingAxis] = useState<"h" | "v" | null>(null);
  const draggingRef = useRef<"h" | "v" | null>(null);
  const splitContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1040);
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
      const axis = draggingRef.current;
      if (!axis || !splitContainer.current) return;
      const rect = splitContainer.current.getBoundingClientRect();
      if (axis === "v" && rect.width > 0) {
        const ratio = (event.clientX - rect.left) / rect.width;
        set({ splitRatio: Math.min(0.75, Math.max(0.25, ratio)) });
      } else if (axis === "h" && rect.height > 0) {
        const ratio = (event.clientY - rect.top) / rect.height;
        set({ stackRatio: Math.min(0.75, Math.max(0.25, ratio)) });
      }
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      setDraggingAxis(null);
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [set]);

  const startDrag = (axis: "h" | "v") => {
    draggingRef.current = axis;
    setDraggingAxis(axis);
    document.body.style.cursor = axis === "v" ? "col-resize" : "row-resize";
  };

  const sideBySide = layout === "split" && wide;

  return (
    <TooltipProvider>
      <div className="flex h-full w-full flex-col overflow-hidden bg-canvas text-ink">
        <TopBar />

        {!booted ? (
          <WorkspaceBootSkeleton sidebarOpen={sidebarOpen} />
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div
              aria-hidden={!sidebarOpen}
              className={cx(
                "shrink-0 overflow-hidden transition-[width] duration-150 ease-out",
                sidebarOpen ? "w-[252px]" : "pointer-events-none w-0",
              )}
            >
              <Navigator />
            </div>

            <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
              {!hasEditor ? (
                <WorkspaceOverview />
              ) : (
                <div ref={splitContainer} className="flex min-h-0 flex-1 overflow-hidden">
                  {sideBySide ? (
                    <div className="flex min-h-0 flex-1 overflow-hidden">
                      <div className="flex min-w-0 flex-col overflow-hidden" style={{ width: `${splitRatio * 100}%` }}>
                        <RequestWorkbench />
                      </div>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        data-dragging={draggingAxis === "v"}
                        onMouseDown={() => startDrag("v")}
                        className="pane-splitter-v"
                      />
                      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                        <ResponseInspector />
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                      <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: `${stackRatio * 100}%` }}>
                        <RequestWorkbench />
                      </div>
                      <div
                        role="separator"
                        aria-orientation="horizontal"
                        data-dragging={draggingAxis === "h"}
                        onMouseDown={() => startDrag("h")}
                        className="pane-splitter-h"
                      />
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <ResponseInspector />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </main>
          </div>
        )}

        <StatusBar />

        <CommandPalette />
        <VariablesModal />
        <CurlImportModal />
        <ConfirmDeleteModal />
        <ToastHost />
      </div>
    </TooltipProvider>
  );
}
