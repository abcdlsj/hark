import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/bridge";
import { useStore } from "../store";
import type { ListItem } from "../lib/types";
import { cx, Kbd, MethodText } from "./ui";

interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Subsequence match, so "ord ref" finds orders/refund. */
function score(text: string, query: string): number {
  if (!query) return 1;
  const hay = text.toLowerCase();
  const needle = query.toLowerCase().replace(/\s+/g, "");
  // A contiguous hit always outranks a scattered subsequence.
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
    palette,
    set,
    select,
    newDraft,
    switchEnv,
    environments,
    env,
    apis,
    layout,
    theme,
    toggleTheme,
    copyCurl,
    send,
    save,
    openVars,
    notify,
  } = useStore();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (palette) {
      setQuery("");
      setActive(0);
    }
  }, [palette]);

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: "new",
        label: "New request",
        hint: "⌘N",
        run: () => {
          newDraft();
          set({ palette: false });
        },
      },
      {
        id: "send",
        label: "Send current request",
        hint: "⌘↵",
        run: () => {
          set({ palette: false });
          void send();
        },
      },
      {
        id: "save",
        label: "Save current request",
        hint: "⌘S",
        run: () => {
          set({ palette: false });
          void save();
        },
      },
      {
        id: "curl",
        label: "Copy current request as cURL",
        hint: "⌘⇧C",
        run: () => {
          set({ palette: false });
          void copyCurl(false);
        },
      },
      {
        id: "guide",
        label: "Copy agent CLI guide prompt",
        run: () => {
          void api.guide().then((text) => {
            void navigator.clipboard.writeText(text);
            notify("Copied the agent guide");
          });
          set({ palette: false });
        },
      },
      {
        id: "vars",
        label: "Manage environment variables…",
        run: () => {
          set({ palette: false });
          openVars();
        },
      },
      {
        id: "layout",
        label: layout === "split" ? "Switch to stacked layout" : "Switch to side-by-side layout",
        run: () => {
          set({ layout: layout === "split" ? "stack" : "split", palette: false });
        },
      },
      {
        id: "theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        run: () => {
          toggleTheme();
          set({ palette: false });
        },
      },
      {
        id: "trim",
        label: "Trim history to 500 runs",
        run: () => {
          void api.prune(500).then(() => notify("History trimmed"));
          set({ palette: false });
        },
      },
    ];
    for (const name of environments) {
      base.push({
        id: `env:${name}`,
        label: `Switch environment → ${name}`,
        hint: name === env ? "current" : undefined,
        run: () => {
          void switchEnv(name);
          set({ palette: false });
        },
      });
    }
    return base;
  }, [environments, env, layout, theme, copyCurl, newDraft, notify, openVars, save, send, set, switchEnv, toggleTheme]);

  const results = useMemo(() => {
    const actionsOnly = query.startsWith(">");
    const term = actionsOnly ? query.slice(1) : query;
    const apiHits = actionsOnly
      ? []
      : apis
      .map((item: ListItem) => ({ item, s: score(`${item.id} ${item.name}`, term) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ item }) => ({
        id: `api:${item.id}`,
        label: item.id,
        hint: item.method,
        run: () => {
          void select(item.id);
          set({ palette: false });
        },
      }));
    const cmdHits = commands
      .map((cmd) => ({ cmd, s: score(cmd.label, term) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(({ cmd }) => cmd);
    return [...apiHits, ...cmdHits].slice(0, 8);
  }, [apis, commands, query, select, set]);

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
    <Dialog.Root open={palette} onOpenChange={(open) => set({ palette: open })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content
          className="overlay motion fixed left-1/2 top-[18%] z-50 w-[520px] -translate-x-1/2 overflow-hidden rounded-[8px]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search requests or type > for actions"
            className="h-[38px] w-full border-b border-line bg-transparent px-3 text-[12.5px] text-ink outline-none placeholder:text-ink3"
          />
          <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
            {results.length === 0 && <div className="px-3 py-2 text-[11.5px] text-ink3">Nothing matches.</div>}
            {results.map((result, index) => (
              <div
                key={result.id}
                onMouseEnter={() => setActive(index)}
                onClick={() => result.run()}
                className={cx(
                  "mx-1 flex h-[28px] cursor-default items-center gap-2 rounded-[4px] px-2 text-[12px]",
                  index === active ? "bg-elevated text-ink" : "text-ink2",
                )}
              >
                {result.hint && /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(result.hint) ? (
                  <MethodText method={result.hint} className="w-9 shrink-0 text-[10px]" />
                ) : (
                  <span className="w-9 shrink-0 text-[10px] text-ink3">{index === active ? "↵" : ""}</span>
                )}
                <span className="truncate">{result.label}</span>
                {result.hint && !/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/.test(result.hint) && (
                  <span className="ml-auto mono text-[10px] text-ink3">{result.hint}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex h-[26px] items-center gap-3 border-t border-line px-3 text-[10px] text-ink3">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> run
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> close
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
