import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { ChevronDown, KeyRound, Send, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { methodMeta } from "../lib/format";
import type { VarItem } from "../lib/types";
import { useStore } from "../store";
import { cx } from "./Primitives";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

class PillWidget extends WidgetType {
  constructor(
    readonly keyName: string,
    readonly secret: boolean,
    readonly defined: boolean,
    readonly value: string,
    readonly scope: string,
  ) {
    super();
  }

  eq(other: PillWidget): boolean {
    return (
      other.keyName === this.keyName &&
      other.secret === this.secret &&
      other.defined === this.defined &&
      other.value === this.value &&
      other.scope === this.scope
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "var-pill";
    el.dataset.var = this.keyName;
    el.dataset.secret = String(this.secret);
    el.dataset.undefined = String(!this.defined);
    el.textContent = this.secret ? `🔒 ${this.keyName}` : this.keyName;
    el.title = this.defined
      ? `${this.keyName} · ${this.scope}${this.secret ? " · keychain" : ""}`
      : `${this.keyName} · undefined in current environment`;
    return el;
  }
}

function buildPills(view: EditorView, lookup: (key: string) => VarItem | undefined): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const text = view.state.doc.toString();
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const key = match[1];
    const found = lookup(key);
    const widget = new PillWidget(
      key,
      found?.secret ?? false,
      Boolean(found),
      found?.value ?? "",
      found?.scope ?? "",
    );
    builder.add(match.index, match.index + match[0].length, Decoration.replace({ widget }));
  }
  return builder.finish();
}

function pillPlugin(vars: VarItem[]) {
  const lookup = (key: string): VarItem | undefined => vars.find((v) => v.key === key);
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildPills(view, lookup);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = buildPills(update.view, lookup);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

const urlBarTheme = EditorView.theme({
  "&": {
    height: "36px",
    fontSize: "13px",
    backgroundColor: "transparent",
    color: "var(--ink-1)",
    padding: "0",
  },
  ".cm-content": {
    padding: "7px 0",
    fontFamily: "var(--font-mono)",
    caretColor: "var(--cobalt)",
    lineHeight: "22px",
  },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflowX: "auto", overflowY: "hidden" },
});

export function OmniUrlBar() {
  const { editor, env, vars, running, sendRequest, cancelRequest, patchEditor, openVars } = useStore();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const url = editor?.url ?? "";
  const method = editor?.method ?? "GET";
  const mMeta = methodMeta(method);
  const varsKey = useMemo(() => vars.map((v) => `${v.key}:${v.value}:${v.secret}`).join("|"), [vars]);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: url,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        urlBarTheme,
        pillPlugin(vars),
        EditorView.contentAttributes.of({
          spellcheck: "false",
          autocapitalize: "off",
          "aria-label": "Request URL",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            patchEditor((doc) => ({ ...doc, url: update.state.doc.toString() }));
          }
        }),
        EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)),
      ],
    });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;

    const onMouseMove = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("[data-var]") as HTMLElement | null;
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      if (!target) {
        setHover(null);
        return;
      }
      const key = target.dataset.var ?? "";
      hoverTimer.current = window.setTimeout(() => {
        setHover({ key, x: event.clientX, y: event.clientY });
      }, 140);
    };
    const onMouseLeave = () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      setHover(null);
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("[data-var]") as HTMLElement | null;
      if (target?.dataset.var) {
        event.preventDefault();
        openVars(target.dataset.var);
      }
    };

    instance.dom.addEventListener("mousemove", onMouseMove);
    instance.dom.addEventListener("mouseleave", onMouseLeave);
    instance.dom.addEventListener("mousedown", onMouseDown);
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      instance.dom.removeEventListener("mousemove", onMouseMove);
      instance.dom.removeEventListener("mouseleave", onMouseLeave);
      instance.dom.removeEventListener("mousedown", onMouseDown);
      instance.destroy();
      view.current = null;
    };
    // Rebuild on variable/env changes so pill styling reflects current environment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varsKey, env]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    if (instance.state.doc.toString() !== url) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: url } });
    }
  }, [url]);

  const hoverVar = hover ? vars.find((v) => v.key === hover.key) : undefined;

  return (
    <div className="relative px-3.5 pb-3 pt-1">
      <div
        className={cx(
          "relative flex h-[44px] items-center gap-2 rounded-[12px] border border-line bg-subtle/80 p-1 focus-within:border-cobalt/45 focus-within:bg-surface focus-within:shadow-xs",
          running && "inflight-shimmer",
        )}
      >
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="motion flex h-[34px] w-[84px] shrink-0 items-center justify-between rounded-[9px] border border-line bg-surface px-2 shadow-2xs hover:border-line-strong"
            >
              <span className={cx("mono text-[11px] font-bold tracking-[0.03em]", mMeta.textClass)}>
                {mMeta.label}
              </span>
              <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className="floating-surface floating-pop z-50 min-w-[128px] rounded-[11px] p-1">
              {METHODS.map((item) => {
                const itemMeta = methodMeta(item);
                return (
                  <DropdownMenu.Item
                    key={item}
                    onSelect={() => patchEditor((doc) => ({ ...doc, method: item }))}
                    className={cx(
                      "motion mono flex cursor-default items-center justify-between rounded-[7px] px-2.5 py-1.5 text-[11.5px] font-semibold outline-none data-[highlighted]:bg-muted",
                      itemMeta.textClass,
                    )}
                  >
                    <span>{item}</span>
                    {item === method && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </DropdownMenu.Item>
                );
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <div className="relative flex min-w-0 flex-1 items-center px-1">
          <div ref={host} className="min-w-0 flex-1" />
          {!url && (
            <span className="pointer-events-none absolute left-1 mono text-[12.5px] text-ink3">
              {"{{base_url}}/v1/orders/refund"}
            </span>
          )}
        </div>

        {running ? (
          <button
            type="button"
            onClick={() => void cancelRequest()}
            className="motion flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border border-rose/30 bg-rose-soft px-3 text-[12px] font-semibold text-rose hover:border-rose/50"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>Cancel</span>
            <span className="mono text-[10px] opacity-75">Esc</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void sendRequest()}
            className="motion flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] bg-cobalt px-3 text-[12px] font-semibold text-white shadow-xs hover:brightness-110 active:scale-[0.98]"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.1} />
            <span>Send</span>
            <span className="mono rounded-[5px] bg-white/18 px-1 py-[1px] text-[10px] font-medium">⌘↵</span>
          </button>
        )}
      </div>

      {hover && (
        <div
          className="floating-surface anim-fade-up fixed z-50 w-[260px] rounded-[11px] p-2.5"
          style={{ left: Math.min(hover.x + 12, window.innerWidth - 280), top: hover.y + 16 }}
          onMouseEnter={() => {
            if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="mono truncate text-[12px] font-semibold text-ink">{hover.key}</span>
            <span className="mono inline-flex items-center gap-1 rounded-full bg-muted px-2 py-[1px] text-[10px] text-ink2">
              {hoverVar?.secret && <KeyRound className="h-2.5 w-2.5 text-violet" />}
              {hoverVar?.scope ?? "undefined"}
            </span>
          </div>
          <div className="mt-1.5 truncate rounded-[6px] bg-subtle px-2 py-1 mono text-[11px] text-ink2">
            {hoverVar?.secret ? "[KEYCHAIN_SECRET]" : hoverVar?.value || "Not defined"}
          </div>
          <button
            type="button"
            onClick={() => {
              setHover(null);
              openVars(hover.key);
            }}
            className="motion mt-2 w-full rounded-[7px] border border-line bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
          >
            {hoverVar?.secret ? "Update keychain secret…" : "Edit variable…"}
          </button>
        </div>
      )}
    </div>
  );
}
