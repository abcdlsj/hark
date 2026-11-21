import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { cx, VarTokens } from "./Primitives";

/**
 * Single-line field that renders {{var}} tokens as styled pills when blurred.
 * When `expandOnFocus` is enabled, focusing a long value smoothly unfolds into
 * an anchored multi-line editor overlay so the full text is readable and editable
 * without shifting surrounding table rows.
 */
export function VarField({
  value,
  onChange,
  placeholder,
  onPasteBlob,
  className,
  mono = true,
  expandOnFocus = false,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onPasteBlob?: (raw: string) => boolean;
  className?: string;
  mono?: boolean;
  expandOnFocus?: boolean;
}) {
  const vars = useStore((s) => s.vars);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const secret = useMemo(() => new Set(vars.filter((v) => v.secret).map((v) => v.key)), [vars]);
  const defined = useMemo(() => new Set(vars.map((v) => v.key)), [vars]);

  useLayoutEffect(() => {
    if (!expandOnFocus || !focused) return;
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "32px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 32), 140)}px`;
  }, [expandOnFocus, focused, value]);

  if (expandOnFocus) {
    return (
      <div className={cx("relative h-[32px] min-w-0 flex-1", className)}>
        {!focused && value && (
          <div
            aria-hidden
            className={cx(
              "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-2.5 text-[12px] leading-[32px] text-ink",
              mono && "mono",
            )}
          >
            <span className="truncate">
              <VarTokens
                value={value}
                secret={(k) => secret.has(k)}
                undefinedKey={(k) => !defined.has(k)}
              />
            </span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          spellCheck={false}
          title={!focused && value ? value : undefined}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/\r?\n/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (textareaRef.current) {
              textareaRef.current.style.height = "";
              textareaRef.current.scrollTop = 0;
              textareaRef.current.scrollLeft = 0;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Escape") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onPaste={(e) => {
            const raw = e.clipboardData.getData("text");
            if (onPasteBlob && onPasteBlob(raw)) {
              e.preventDefault();
            }
          }}
          className={cx(
            "w-full min-w-0 resize-none text-[12px] outline-none placeholder:text-ink3",
            mono && "mono",
            focused
              ? "scroll absolute inset-x-0 top-0 z-20 min-h-[32px] max-h-[140px] overflow-y-auto whitespace-pre-wrap break-all rounded-[4px] border border-accent bg-canvas px-2.5 py-[6px] leading-[1.5] text-ink caret-accent-text shadow-[var(--shadow-pop)]"
              : cx(
                  "relative h-[32px] overflow-hidden whitespace-nowrap bg-transparent px-2.5 leading-[32px]",
                  !value ? "text-ink caret-accent-text" : "text-transparent caret-transparent",
                ),
          )}
        />
      </div>
    );
  }

  return (
    <div className={cx("relative flex min-w-0 flex-1 items-center overflow-hidden", className)}>
      {!focused && value && (
        <div
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-2.5 text-[12px] leading-[32px] text-ink",
            mono && "mono",
          )}
        >
          <span className="truncate">
            <VarTokens
              value={value}
              secret={(k) => secret.has(k)}
              undefinedKey={(k) => !defined.has(k)}
            />
          </span>
        </div>
      )}
      <input
        value={value}
        spellCheck={false}
        title={!focused && value ? value : undefined}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPaste={(e) => {
          if (!onPasteBlob) return;
          const raw = e.clipboardData.getData("text");
          if (onPasteBlob(raw)) e.preventDefault();
        }}
        className={cx(
          "relative h-[32px] w-full min-w-0 bg-transparent px-2.5 text-[12px] leading-[32px] outline-none placeholder:text-ink3",
          mono && "mono",
          focused || !value ? "text-ink caret-accent-text" : "text-transparent caret-transparent",
        )}
      />
    </div>
  );
}
