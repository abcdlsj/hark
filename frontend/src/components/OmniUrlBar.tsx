import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState, RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, keymap, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { Check, ChevronDown, KeyRound, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
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
    minHeight: "34px",
    height: "auto",
    fontSize: "12.5px",
    backgroundColor: "transparent",
    color: "var(--ink-1)",
    padding: "0",
  },
  ".cm-content": {
    padding: "6px 0",
    fontFamily: "var(--font-mono)",
    caretColor: "var(--accent-text)",
    lineHeight: "22px",
  },
  ".cm-line": { padding: "0" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    overflowX: "auto",
    overflowY: "hidden",
  },
});

export function OmniUrlBar() {
  const { url, method, env, vars, running, sendRequest, cancelRequest, patchEditor, openVars } = useStore(
    useShallow((s) => ({
      url: s.editor?.url ?? "",
      method: s.editor?.method ?? "GET",
      env: s.env,
      vars: s.vars,
      running: s.running,
      sendRequest: s.sendRequest,
      cancelRequest: s.cancelRequest,
      patchEditor: s.patchEditor,
      openVars: s.openVars,
    })),
  );
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const wrapCompartment = useRef(new Compartment());
  const [focused, setFocused] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  const hoverTimer = useRef<number | null>(null);

  const mMeta = methodMeta(method);
  const varsKey = useMemo(() => vars.map((v) => `${v.key}:${v.value}:${v.secret}`).join("|"), [vars]);

  const measureOverflow = useCallback(() => {
    const instance = view.current;
    if (!instance) return;
    const scroller = instance.scrollDOM;
    setOverflowing(scroller.scrollWidth > scroller.clientWidth + 2);
  }, []);

  useEffect(() => {
    if (!host.current) return;
    const compartment = wrapCompartment.current;

    const state = EditorState.create({
      doc: url,
      extensions: [
        history(),
        keymap.of([
          {
            key: "Enter",
            run: (v) => {
              v.contentDOM.blur();
              void useStore.getState().sendRequest();
              return true;
            },
          },
          {
            key: "Escape",
            run: (v) => {
              v.contentDOM.blur();
              return true;
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        urlBarTheme,
        compartment.of([]),
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
          if (update.focusChanged) {
            const nextFocused = update.view.hasFocus;
            setFocused(nextFocused);
            update.view.dispatch({
              effects: compartment.reconfigure(nextFocused ? EditorView.lineWrapping : []),
            });
            if (!nextFocused) {
              update.view.scrollDOM.scrollLeft = 0;
              window.requestAnimationFrame(measureOverflow);
            }
          }
        }),
        EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)),
      ],
    });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;

    const ro = new ResizeObserver(() => measureOverflow());
    ro.observe(instance.scrollDOM);
    window.requestAnimationFrame(measureOverflow);

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
      ro.disconnect();
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      instance.dom.removeEventListener("mousemove", onMouseMove);
      instance.dom.removeEventListener("mouseleave", onMouseLeave);
      instance.dom.removeEventListener("mousedown", onMouseDown);
      instance.destroy();
      view.current = null;
      setFocused(false);
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
    if (!focused) {
      window.requestAnimationFrame(measureOverflow);
    }
  }, [url, focused, measureOverflow]);

  const hoverVar = hover ? vars.find((v) => v.key === hover.key) : undefined;

  return (
    <div className={cx("relative shrink-0 border-b border-line bg-canvas px-3 py-2.5", running && "inflight-bar")}>
      <div className="flex items-start gap-2">
        {/* Fixed-height anchor slot so expanding long URLs on focus never shifts layout below */}
        <div className="relative h-[36px] min-w-0 flex-1">
          <div
            className={cx(
              "absolute inset-x-0 top-0 flex min-h-[36px] items-stretch overflow-hidden rounded-md border transition-colors",
              focused
                ? "z-30 border-accent bg-canvas shadow-[var(--shadow-pop)] ring-2 ring-accent/15"
                : "h-[36px] border-line-strong bg-subtle/50 hover:border-ink3/50",
            )}
          >
            {/* Intrinsic-width Method selector — tight hug for GET/PUT/POST, grows cleanly for OPTIONS */}
            <div className="flex shrink-0 items-start border-r border-line bg-chrome">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="motion flex h-[34px] min-w-[64px] shrink-0 items-center justify-between gap-1.5 px-2.5 hover:bg-subtle"
                  >
                    <span className={cx("mono text-[11.5px] font-bold tracking-[0.02em]", mMeta.textClass)}>
                      {mMeta.label}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-ink3" strokeWidth={2} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={6} className="popover-surface floating-pop z-50 min-w-[126px] rounded-lg p-1">
                    {METHODS.map((item) => {
                      const itemMeta = methodMeta(item);
                      return (
                        <DropdownMenu.Item
                          key={item}
                          onSelect={() => patchEditor((doc) => ({ ...doc, method: item }))}
                          className={cx(
                            "motion mono flex cursor-default items-center justify-between rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold outline-none data-[highlighted]:bg-subtle",
                            itemMeta.textClass,
                          )}
                        >
                          <span>{item}</span>
                          {item === method && <Check className="h-3.5 w-3.5" strokeWidth={2.2} />}
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            {/* URL input: single-line with overflow fade when blurred, full wrapped view when focused */}
            <div
              title={!focused && overflowing ? url : undefined}
              className={cx(
                "relative flex min-w-0 flex-1 px-2.5",
                focused
                  ? "scroll url-cm-wrapped max-h-[168px] items-start overflow-y-auto"
                  : "url-cm-single items-center overflow-hidden",
              )}
            >
              <div ref={host} className="min-w-0 flex-1" />
              {!url && (
                <span className="pointer-events-none absolute left-2.5 top-[7px] mono text-[12px] text-ink3">
                  {"{{base_url}}/v1/orders/refund"}
                </span>
              )}
              {!focused && overflowing && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-subtle via-subtle/80 to-transparent"
                />
              )}
            </div>
          </div>
        </div>

        {/* Fixed width so Send ⇄ Cancel never shifts the URL input */}
        <div className="w-[88px] shrink-0">
          {running ? (
            <button
              type="button"
              onClick={() => void cancelRequest()}
              title="Cancel request (Esc)"
              className="motion flex h-[36px] w-full items-center justify-center gap-1.5 rounded-md border border-rose/35 bg-rose-soft px-2.5 text-[12px] font-semibold text-rose hover:border-rose/55"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendRequest()}
              title="Send request (⌘↵)"
              className="motion flex h-[36px] w-full items-center justify-center gap-1.5 rounded-md bg-accent px-2.5 text-[12px] font-semibold text-white hover:bg-accent-hover"
            >
              <span>Send</span>
              <span className="mono rounded bg-white/15 px-1 py-[1px] text-[10px] font-medium text-white/90">
                ⌘↵
              </span>
            </button>
          )}
        </div>
      </div>

      {hover && (
        <div
          className="popover-surface fixed z-50 w-[280px] rounded-lg p-2.5"
          style={{ left: Math.min(hover.x + 12, window.innerWidth - 300), top: hover.y + 16 }}
          onMouseEnter={() => {
            if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="mono truncate text-[12px] font-semibold text-ink">{hover.key}</span>
            <span className="mono inline-flex shrink-0 items-center gap-1 rounded border border-line bg-subtle px-1.5 py-[1px] text-[10px] text-ink2">
              {hoverVar?.secret && <KeyRound className="h-2.5 w-2.5 text-violet" />}
              {hoverVar?.scope ?? "undefined"}
            </span>
          </div>
          <div className="scroll mt-1.5 max-h-[84px] overflow-y-auto break-all rounded border border-line bg-subtle px-2 py-1 mono text-[11px] leading-relaxed text-ink2">
            {hoverVar?.secret ? "[KEYCHAIN_SECRET]" : hoverVar?.value || "Not defined"}
          </div>
          <button
            type="button"
            onClick={() => {
              setHover(null);
              openVars(hover.key);
            }}
            className="motion mt-2 w-full rounded-md border border-line bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
          >
            {hoverVar?.secret ? "Update keychain secret…" : "Edit variable…"}
          </button>
        </div>
      )}
    </div>
  );
}
