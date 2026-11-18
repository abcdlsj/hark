import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ListItem } from "../lib/types";
import { useStore } from "../store";
import { cx, Kbd, MethodBadge } from "./Primitives";

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  method?: string;
  run: () => void;
}

function scoreMatch(text: string, query: string): number {
  if (!query) return 1;
  const hay = text.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");
  const at = hay.indexOf(needle);
  if (at >= 0) return 1000 - at;
  let i = 0;
  let gaps = 0;
  let last = -1;
  for (const ch of needle) {
    const next = hay.indexOf(ch, i);
    if (next < 0) return 0;
    if (last >= 0) gaps += next - last - 1;
    last = next;
    i = next + 1;
  }
  return 100 - gaps;
}

export function CommandPalette() {
  const {
    paletteOpen,
    editor,
    apis,
    environments,
    env,
    layout,
    theme,
    set,
    selectApi,
    newDraft,
    closeEditor,
    sendRequest,
    saveEditor,
    copyCurl,
    copyGuide,
    openVars,
    switchEnv,
    reloadWorkspace,
    pruneHistory,
    toggleTheme,
  } = useStore();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (paletteOpen) {
      setQuery("");
      setActive(0);
    }
  }, [paletteOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      {
        id: "new",
        label: "New request",
        hint: "⌘N",
        run: () => {
          newDraft();
          set({ paletteOpen: false });
        },
      },
      {
        id: "import-curl",
        label: "Import cURL command…",
        run: () => {
          set({ paletteOpen: false, curlModalOpen: true });
        },
      },
      {
        id: "vars",
        label: "Manage variables & OS keychain…",
        run: () => {
          set({ paletteOpen: false });
          openVars();
        },
      },
      {
        id: "guide",
        label: "Copy AI agent CLI guide",
        run: () => {
          set({ paletteOpen: false });
          void copyGuide();
        },
      },
      {
        id: "overview",
        label: "Go to workspace overview",
        run: () => {
          closeEditor();
          set({ paletteOpen: false });
        },
      },
      {
        id: "layout",
        label: layout === "split" ? "Switch to stacked layout" : "Switch to side-by-side layout",
        run: () => {
          set({ layout: layout === "split" ? "stack" : "split", paletteOpen: false });
        },
      },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to Porcelain Light theme" : "Switch to Velvet Obsidian Dark theme",
        run: () => {
          toggleTheme();
          set({ paletteOpen: false });
        },
      },
      {
        id: "reload",
        label: "Reload workspace from disk",
        run: () => {
          set({ paletteOpen: false });
          void reloadWorkspace();
        },
      },
      {
        id: "trim",
        label: "Trim history to 500 runs",
        run: () => {
          set({ paletteOpen: false });
          void pruneHistory(500);
        },
      },
    ];

    if (editor) {
      list.unshift(
        {
          id: "send",
          label: "Send current request",
          hint: "⌘↵",
          run: () => {
            set({ paletteOpen: false });
            void sendRequest();
          },
        },
        {
          id: "save",
          label: "Save current request",
          hint: "⌘S",
          run: () => {
            set({ paletteOpen: false });
            void saveEditor();
          },
        },
        {
          id: "curl",
          label: "Export current request as cURL",
          hint: "⌘⇧C",
          run: () => {
            set({ paletteOpen: false });
            void copyCurl(false);
          },
        },
        {
          id: "curl-resolved",
          label: "Export current request as cURL (resolved values)",
          run: () => {
            set({ paletteOpen: false });
            void copyCurl(true);
          },
        },
      );
    }

    for (const name of environments) {
      list.push({
        id: `env:${name}`,
        label: `Switch environment → ${name}`,
        hint: name === env ? "active" : undefined,
        run: () => {
          set({ paletteOpen: false });
          void switchEnv(name);
        },
      });
    }

    return list;
  }, [
    editor,
    environments,
    env,
    layout,
    theme,
    closeEditor,
    copyCurl,
    copyGuide,
    newDraft,
    openVars,
    pruneHistory,
    reloadWorkspace,
    saveEditor,
    sendRequest,
    set,
    switchEnv,
    toggleTheme,
  ]);

  const results = useMemo(() => {
    const actionsOnly = query.startsWith(">");
    const term = actionsOnly ? query.slice(1) : query;

    const apiHits: CommandItem[] = actionsOnly
      ? []
      : apis
          .map((item: ListItem) => ({ item, score: scoreMatch(`${item.id} ${item.name}`, term) }))
          .filter((r) => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ item }) => ({
            id: `api:${item.id}`,
            label: item.name && item.name !== item.id ? `${item.name} · ${item.id}` : item.id,
            method: item.method,
            run: () => {
              set({ paletteOpen: false });
              void selectApi(item.id);
            },
          }));

    const cmdHits = commands
      .map((cmd) => ({ cmd, score: scoreMatch(cmd.label, term) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);

    return [...apiHits, ...cmdHits].slice(0, 10);
  }, [apis, commands, query, selectApi, set]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      results[active]?.run();
    }
  };

  return (
    <Dialog.Root open={paletteOpen} onOpenChange={(open) => set({ paletteOpen: open })}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className="floating-surface dialog-content fixed left-1/2 top-[16%] z-50 w-[92vw] max-w-[540px] -translate-x-1/2 overflow-hidden rounded-[14px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex h-[46px] items-center gap-2.5 border-b border-line px-3.5">
            <Search className="h-4 w-4 shrink-0 text-ink3" strokeWidth={1.9} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search endpoints or type > for actions…"
              className="h-full w-full bg-transparent text-[13px] text-ink placeholder:text-ink3"
            />
          </div>

          <div className="scroll max-h-[320px] overflow-y-auto p-1.5">
            {results.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-ink3">No matching endpoints or commands.</div>
            ) : (
              results.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => result.run()}
                  className={cx(
                    "motion flex h-[36px] w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[12.5px]",
                    index === active ? "bg-cobalt-soft text-ink" : "text-ink2 hover:bg-subtle",
                  )}
                >
                  {result.method ? (
                    <MethodBadge method={result.method} short className="w-[44px] shrink-0 justify-center" />
                  ) : (
                    <span className="flex w-[44px] shrink-0 items-center justify-center text-ink3">
                      <CornerDownLeft className={cx("h-3.5 w-3.5", index !== active && "opacity-35")} />
                    </span>
                  )}
                  <span className={cx("min-w-0 flex-1 truncate", index === active && "font-medium")}>
                    {result.label}
                  </span>
                  {result.hint && (
                    <span className="mono shrink-0 text-[10.5px] text-ink3">{result.hint}</span>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="flex h-[32px] items-center gap-4 border-t border-line bg-subtle/60 px-3.5 text-[11px] text-ink3">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd> select
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>&gt;</Kbd> actions only
            </span>
            <span className="ml-auto inline-flex items-center gap-1">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
