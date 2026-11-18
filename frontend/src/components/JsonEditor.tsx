import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const quiet = EditorView.theme({
  "&": { height: "100%", backgroundColor: "transparent", color: "var(--apic-ink)", fontSize: "12.5px" },
  ".cm-content": { padding: "6px 0", fontFamily: "var(--font-mono)", lineHeight: "1.5", caretColor: "var(--apic-ink)" },
  ".cm-line": { padding: "0 8px 0 4px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { overflow: "auto" },
});

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--apic-syn-key)" },
  { tag: tags.string, color: "var(--apic-syn-string)" },
  { tag: tags.number, color: "var(--apic-syn-number)" },
  { tag: [tags.bool, tags.null], color: "var(--apic-syn-literal)" },
  { tag: tags.punctuation, color: "var(--apic-ink-2)" },
  { tag: tags.invalid, color: "var(--apic-delete)" },
]);

/** Read/write JSON editor with the chrome stripped: line numbers only. */
export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  language = true,
}: {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  language?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        quiet,
        syntaxHighlighting(highlight),
        ...(language ? [json()] : []),
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
        }),
      ],
    });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // The document is synced below, so this effect only runs on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, language]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    if (instance.state.doc.toString() !== value) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="h-full min-h-0 w-full" />;
}
