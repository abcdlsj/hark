import { useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { cx, VarSegments } from "./ui";

/**
 * A one-line input that keeps {{placeholders}} readable: a mirrored layer
 * renders the highlighted value and the real input sits on top with transparent
 * text, so the caret still behaves like a normal field.
 */
export function VarInput({
  value,
  onChange,
  placeholder,
  onPasteBlob,
  className,
  mono = true,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onPasteBlob?: (raw: string) => boolean;
  className?: string;
  mono?: boolean;
}) {
  const vars = useStore((s) => s.vars);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const secret = useMemo(() => new Set(vars.filter((v) => v.secret).map((v) => v.key)), [vars]);
  const defined = useMemo(() => new Set(vars.map((v) => v.key)), [vars]);

  return (
    <div className={cx("relative flex min-w-0 flex-1 items-center overflow-hidden", className)}>
      <div
        aria-hidden
        className={cx(
          "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre px-2 text-[12.5px] leading-[28px] text-ink",
          mono && "mono",
        )}
      >
        <span className="truncate">
          <VarSegments
            value={value}
            secret={(k) => secret.has(k)}
            undefinedKey={(k) => !defined.has(k)}
          />
        </span>
      </div>
      <input
        ref={input}
        value={value}
        spellCheck={false}
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
          "relative h-[28px] w-full min-w-0 bg-transparent px-2 text-[12.5px] leading-[28px] outline-none placeholder:text-ink3",
          mono && "mono",
          focused ? "text-ink caret-ink" : "text-transparent caret-transparent",
        )}
      />
    </div>
  );
}
