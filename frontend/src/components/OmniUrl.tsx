import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { useEffect, useMemo, useRef, useState } from "react";
import { methodClass } from "../lib/format";
import { useStore } from "../store";
import type { VarItem } from "../lib/types";
import { cx } from "./ui";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

class PillWidget extends WidgetType {
  constructor(
    readonly key: string,
    readonly secret: boolean,
    readonly defined: boolean,
    readonly value: string,
    readonly scope: string,
  ) {
    super();
  }

  eq(other: PillWidget): boolean {
    return (
      other.key === this.key &&
      other.secret === this.secret &&
      other.defined === this.defined &&
      other.value === this.value &&
      other.scope === this.scope
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "var-pill";
    el.dataset.var = this.key;
    el.dataset.secret = String(this.secret);
    el.dataset.undefined = String(!this.defined);
    el.textContent = this.secret ? `🔒 ${this.key}` : this.key;
    el.title = this.defined
      ? `${this.key} · ${this.scope}${this.secret ? " · keychain" : ""}`
      : `${this.key} · undefined in this environment`;
    return el;
  }
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
        if (update.docChanged) this.decorations = buildPills(update.view, lookup);
      }
    },
    { decorations: (v) => v.decorations },
  );
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

const baseTheme = EditorView.theme({
  "&": {
    height: "32px",
    fontSize: "12.5px",
    backgroundColor: "transparent",
    color: "var(--apic-ink)",
    padding: "0",
  },
  ".cm-content": {
    padding: "6px 0",
    fontFamily: "var(--font-mono)",
    caretColor: "var(--apic-ink)",
    lineHeight: "20px",
  },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflowX: "auto", overflowY: "hidden" },
  ".cm-placeholder": { color: "var(--apic-ink3)" },
});

export function OmniUrl() {
  const { editor, env, vars, running, send, cancel, patch, openVars } = useStore();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const url = editor?.url ?? "";
  const varsKey = useMemo(() => vars.map((v) => `${v.key}:${v.value}:${v.secret}`).join("|"), [vars]);

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: url,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        baseTheme,
        pillPlugin(vars),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off", "aria-label": "Request URL" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            patch((api) => ({ ...api, url: update.state.doc.toString() }));
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
      }, 150);
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
      instance.dom.removeEventListener("mousemove", onMouseMove);
      instance.dom.removeEventListener("mouseleave", onMouseLeave);
      instance.dom.removeEventListener("mousedown", onMouseDown);
      instance.destroy();
      view.current = null;
    };
    // Rebuilding on vars/env change refreshes pill state (secret, undefined).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varsKey, env]);

  // External value changes (selecting another API) replace the document.
  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    if (instance.state.doc.toString() !== url) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: url } });
    }
  }, [url]);

  const hoverVar = hover ? vars.find((v) => v.key === hover.key) : undefined;

  return (
    <div className="relative flex h-[50px] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3.5">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="motion flex h-[32px] w-[92px] items-center justify-between rounded-[5px] border border-line-strong bg-canvas px-2.5 hover:bg-elevated"
          >
            <span className={cx("mono text-[11.5px] font-medium tracking-[0.04em]", methodClass(editor?.method ?? "GET"))}>
              {editor?.method ?? "GET"}
            </span>
            <span className="text-[8px] text-ink3">▾</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className="overlay z-50 min-w-[110px] rounded-[8px] p-1">
            {METHODS.map((method) => (
              <DropdownMenu.Item
                key={method}
                onSelect={() => patch((doc) => ({ ...doc, method }))}
                className="motion mono cursor-default rounded-[4px] px-2 py-1 text-[11px] outline-none data-[highlighted]:bg-elevated"
              >
                <span className={methodClass(method)}>{method}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="relative flex h-[34px] min-w-0 flex-1 items-center rounded-[5px] border border-line bg-canvas px-1.5 focus-within:border-line-strong">
        <div ref={host} className="min-w-0 flex-1" />
        {!url && (
          <span className="pointer-events-none absolute left-2.5 mono text-[13px] text-ink3">
            {"{{base_url}}/v1/orders/refund"}
          </span>
        )}
      </div>

      {running ? (
        <button
          type="button"
          onClick={() => void cancel()}
          className="motion flex h-[32px] items-center gap-2 rounded-[5px] border border-line-strong bg-elevated px-3.5 text-[12px] text-ink"
        >
          Cancel <span className="mono text-[10px] text-ink3">Esc</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void send()}
          className="motion flex h-[32px] items-center gap-2 rounded-[5px] border border-line-strong bg-elevated px-3.5 text-[12px] font-medium text-ink hover:border-ink3"
        >
          Send <span className="mono text-[10px] font-normal text-ink3">⌘↵</span>
        </button>
      )}

      {running && <span className="inflight-line pointer-events-none absolute inset-x-0 bottom-0 h-px" />}

      {hover && (
        <div
          className="overlay fixed z-50 w-[240px] rounded-[5px] p-2"
          style={{ left: Math.min(hover.x + 10, window.innerWidth - 260), top: hover.y + 16 }}
          onMouseEnter={() => {
            if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-center justify-between">
            <span className="mono text-[11.5px] text-ink">{hover.key}</span>
            <span className="mono text-[10px] text-ink3">
              {hoverVar?.scope ?? "undefined"}
              {hoverVar?.secret ? " · keychain" : ""}
            </span>
          </div>
          <div className="mt-1 truncate mono text-[11px] text-ink2">
            {hoverVar?.secret ? "[KEYCHAIN_SECRET]" : hoverVar?.value || "—"}
          </div>
          <button
            type="button"
            onClick={() => {
              setHover(null);
              openVars(hover.key);
            }}
            className="motion mt-1.5 w-full rounded-[4px] border border-line px-2 py-1 text-[11px] text-ink2 hover:border-line-strong hover:text-ink"
          >
            {hoverVar?.secret ? "Update secret…" : "Edit value…"}
          </button>
        </div>
      )}
    </div>
  );
}

export async function importClipboardCurl(): Promise<string | null> {
  try {
    const text = await navigator.clipboard.readText();
    return text.trim().toLowerCase().startsWith("curl") ? text : null;
  } catch {
    return null;
  }
}
