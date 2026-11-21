import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { json } from "@codemirror/lang-json";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { tags } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "var(--ink-1)",
    fontSize: "12px",
  },
  ".cm-content": {
    padding: "8px 0",
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
    caretColor: "var(--accent-text)",
  },
  ".cm-line": {
    padding: "0 12px 0 10px",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
  },
});

const tokenHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--syn-key)" },
  { tag: tags.string, color: "var(--syn-str)" },
  { tag: tags.number, color: "var(--syn-num)" },
  { tag: [tags.bool, tags.null], color: "var(--syn-lit)" },
  { tag: tags.punctuation, color: "var(--ink-2)" },
  { tag: tags.invalid, color: "var(--rose)" },
]);

/** Clean CodeMirror 6 block editor for JSON and raw request/response bodies. */
export function CodeBlockEditor({
  value,
  onChange,
  readOnly = false,
  language = true,
  lineWrap = false,
}: {
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
  language?: boolean;
  lineWrap?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const wrapCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  const langCompartment = useRef(new Compartment());
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
        editorTheme,
        syntaxHighlighting(tokenHighlight),
        langCompartment.current.of(language ? json() : []),
        wrapCompartment.current.of(lineWrap ? EditorView.lineWrapping : []),
        readOnlyCompartment.current.of([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
    });
    const instance = new EditorView({ state, parent: host.current });
    view.current = instance;
    return () => {
      instance.destroy();
      view.current = null;
    };
    // Configuration changes are applied cleanly via Compartments below without destroying the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.dispatch({
      effects: wrapCompartment.current.reconfigure(lineWrap ? EditorView.lineWrapping : []),
    });
  }, [lineWrap]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.dispatch({
      effects: readOnlyCompartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    instance.dispatch({
      effects: langCompartment.current.reconfigure(language ? json() : []),
    });
  }, [language]);

  useEffect(() => {
    const instance = view.current;
    if (!instance) return;
    if (instance.state.doc.toString() !== value) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: value } });
    }
  }, [value]);

  return <div ref={host} className="h-full min-h-0 w-full bg-canvas" />;
}
