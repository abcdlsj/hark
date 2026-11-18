import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import type { ReactNode } from "react";

export const cx = clsx;

export const TooltipProvider = Tooltip.Provider;

export function Tip({ label, children, side = "bottom" }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip.Root delayDuration={250}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="overlay z-50 rounded-[5px] px-2 py-1 text-[11px] text-ink2"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** Ghost button: 1px line, no fill, hover lifts to --bg-elevated. */
export function Ghost({
  children,
  onClick,
  active,
  className,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "motion inline-flex h-[26px] items-center gap-1 rounded-[5px] border px-2.5 text-[12px]",
        active
          ? "border-line-strong bg-elevated text-ink"
          : "border-line text-ink2 hover:border-line-strong hover:bg-elevated/60 hover:text-ink",
        disabled && "opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Text-only tab with a 1.5px underline, used by composer and inspector. */
export function TabButton({
  active,
  onClick,
  children,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "motion relative flex h-full shrink-0 items-center gap-1 whitespace-nowrap px-2.5 text-[12.5px]",
        active ? "text-ink" : "text-ink2 hover:text-ink",
      )}
    >
      {children}
      {hint !== undefined && hint !== null && <span className="mono text-[10px] text-ink3">{hint}</span>}
      {active && <span className="absolute inset-x-2 bottom-0 h-[2px] bg-ink" />}
    </button>
  );
}

export function Dot({ tone = "var" }: { tone?: "var" | "secret" | "undefined" | "agent" }) {
  const color =
    tone === "secret"
      ? "bg-secret"
      : tone === "undefined"
        ? "bg-undefined"
        : tone === "agent"
          ? "bg-var"
          : "bg-var";
  return <span className={cx("inline-block h-[5px] w-[5px] rounded-full", color)} />;
}

export function MethodText({ method, className, short }: { method: string; className?: string; short?: boolean }) {
  const m = method.toUpperCase();
  const palette: Record<string, string> = {
    GET: "text-get",
    POST: "text-post",
    PUT: "text-put",
    PATCH: "text-patch",
    DELETE: "text-del",
  };
  const label = short ? (m === "DELETE" ? "DEL" : m === "OPTIONS" ? "OPT" : m === "PATCH" ? "PAT" : m) : m;
  return (
    <span className={cx("mono text-[11px] tracking-tight", palette[m] ?? "text-ink2", className)}>{label}</span>
  );
}

export function StatusText({ status }: { status: number }) {
  const tone = !status ? "text-ink3" : status < 300 ? "text-get" : status < 400 ? "text-post" : "text-del";
  return <span className={cx("mono text-[11.5px]", tone)}>{status || "—"}</span>;
}

export function Divider({ vertical = false }: { vertical?: boolean }) {
  return vertical ? <span className="h-3.5 w-px shrink-0 bg-line" /> : <span className="h-px w-full bg-line" />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="mono rounded-[3px] border border-line px-1 py-0.5 text-[10px] leading-none text-ink3">
      {children}
    </span>
  );
}

/** Splits a value into plain and {{var}} segments for inline highlighting. */
export function VarSegments({ value, secret, undefinedKey }: { value: string; secret?: (k: string) => boolean; undefinedKey?: (k: string) => boolean }) {
  const parts = value.split(/(\{\{\s*[^}]+\s*\}\})/g).filter((p) => p !== "");
  return (
    <>
      {parts.map((part, i) => {
        const m = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(part);
        if (!m) return <span key={i}>{part}</span>;
        const key = m[1];
        const isSecret = secret?.(key) ?? false;
        const isUndefined = undefinedKey?.(key) ?? false;
        return (
          <span
            key={i}
            data-secret={isSecret}
            data-undefined={isUndefined}
            className={cx(
              "rounded-[3px] px-[3px]",
              isUndefined
                ? "border-b border-dashed border-undefined text-undefined"
                : isSecret
                  ? "bg-secret-bg text-secret"
                  : "bg-var-bg text-var",
            )}
          >
            {key}
          </span>
        );
      })}
    </>
  );
}
