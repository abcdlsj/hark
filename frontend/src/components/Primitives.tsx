import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import { ChevronDown, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { methodMeta, statusMeta } from "../lib/format";

export const cx = clsx;
export const TooltipProvider = Tooltip.Provider;

export function Tip({
  label,
  children,
  side = "bottom",
}: {
  label: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip.Root delayDuration={260}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="popover-surface floating-pop z-50 rounded-md px-2 py-1 text-[11px] font-medium text-ink"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "mono inline-flex min-h-[17px] min-w-[17px] items-center justify-center rounded border border-line-strong bg-subtle px-1 py-[1px] text-[10px] font-medium leading-none text-ink2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/**
 * Renders one label out of several in a single grid cell so the widest variant
 * sets the box. Inactive labels stay mounted (invisible) to prevent layout shift.
 */
export function SwapText({
  value,
  options,
  className,
}: {
  value: string;
  options: string[];
  className?: string;
}) {
  const labels = options.includes(value) ? options : [...options, value];
  return (
    <span className={cx("inline-grid", className)}>
      {labels.map((label) => (
        <span
          key={label}
          aria-hidden={label !== value}
          className={cx("col-start-1 row-start-1", label !== value && "invisible")}
        >
          {label}
        </span>
      ))}
    </span>
  );
}

export function IconButton({
  children,
  onClick,
  active,
  variant = "ghost",
  size = "sm",
  className,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  variant?: "ghost" | "secondary";
  size?: "xs" | "sm";
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  const dims = size === "xs" ? "h-[24px] w-[24px]" : "h-[28px] w-[28px]";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        "motion inline-flex shrink-0 items-center justify-center rounded-md border",
        dims,
        active
          ? "border-line-strong bg-subtle text-ink"
          : variant === "secondary"
            ? "border-line bg-canvas text-ink2 hover:border-line-strong hover:bg-subtle hover:text-ink"
            : "border-transparent text-ink2 hover:bg-subtle hover:text-ink",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  size = "sm",
  className,
  title,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const sizes = {
    xs: "h-[24px] px-2 text-[11px] rounded",
    sm: "h-[28px] px-2.5 text-[12px] rounded-md",
    md: "h-[32px] px-3.5 text-[12.5px] rounded-md",
  };
  const variants = {
    primary: "border border-transparent bg-accent text-white font-semibold hover:bg-accent-hover",
    secondary: "border border-line bg-canvas text-ink hover:border-line-strong hover:bg-subtle",
    ghost: "border border-transparent text-ink2 hover:bg-subtle hover:text-ink",
    danger: "border border-rose/30 bg-rose-soft text-rose hover:border-rose/50",
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "motion inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium",
        sizes[size],
        variants[variant],
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export interface BarSegment {
  key: string;
  value: number;
  colorClass: string;
  label?: string;
}

/**
 * Clean proportional bar for health ratios and network phase breakdowns.
 */
export function SegmentedBar({
  ticks = 28,
  ratio,
  fillClass = "bg-accent",
  segments,
  heightClass = "h-[8px]",
  className,
}: {
  ticks?: number;
  ratio?: number;
  fillClass?: string;
  segments?: BarSegment[];
  heightClass?: string;
  className?: string;
}) {
  if (segments && segments.length > 0) {
    const positive = segments.filter((s) => s.value > 0);
    const total = positive.reduce((acc, s) => acc + s.value, 0);
    if (total <= 0) {
      return <div className={cx("w-full overflow-hidden rounded-[2px] bg-tick-track", heightClass, className)} />;
    }
    return (
      <div className={cx("flex w-full items-stretch gap-[1.5px] overflow-hidden rounded-[2px] bg-tick-track", heightClass, className)}>
        {positive.map((seg) => (
          <span
            key={seg.key}
            title={seg.label ? `${seg.label}: ${seg.value.toFixed(1)} ms` : undefined}
            style={{ width: `${Math.max((seg.value / total) * 100, 2)}%` }}
            className={cx("h-full transition-[width] duration-200", seg.colorClass)}
          />
        ))}
      </div>
    );
  }

  const clamped = Math.max(0, Math.min(1, ratio ?? 0));
  const filled = Math.round(clamped * ticks);
  return (
    <div className={cx("flex items-center gap-[2px]", className)}>
      {Array.from({ length: ticks }).map((_, idx) => (
        <span
          key={idx}
          className={cx("flex-1 rounded-[1.5px]", heightClass, idx < filled ? fillClass : "bg-tick-track")}
        />
      ))}
    </div>
  );
}

/** Split telemetry numeral: tabular figure + muted unit suffix. */
export function MetricDisplay({
  num,
  unit,
  size = "md",
  className,
}: {
  num: string | number;
  unit?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const numSize = size === "lg" ? "text-[20px]" : size === "sm" ? "text-[12px]" : "text-[15px]";
  const unitSize = size === "lg" ? "text-[11.5px]" : size === "sm" ? "text-[10.5px]" : "text-[11px]";
  return (
    <span className={cx("inline-flex items-baseline mono tabular leading-none", className)}>
      <span className={cx("font-semibold tracking-[-0.02em] text-ink", numSize)}>{num}</span>
      {unit && <span className={cx("ml-1 font-normal text-ink3", unitSize)}>{unit}</span>}
    </span>
  );
}

export function MethodBadge({
  method,
  short = false,
  pill = false,
  className,
}: {
  method: string;
  short?: boolean;
  pill?: boolean;
  className?: string;
}) {
  const meta = methodMeta(method);
  if (!pill) {
    return (
      <span className={cx("mono text-[10.5px] font-semibold tracking-[0.02em]", meta.textClass, className)}>
        {short ? meta.short : meta.label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "mono inline-flex items-center justify-center rounded px-1.5 py-[1px] text-[10px] font-semibold tracking-[0.02em]",
        meta.pillClass,
        className,
      )}
    >
      {short ? meta.short : meta.label}
    </span>
  );
}

export function StatusCapsule({
  status,
  text,
  hasError,
}: {
  status: number;
  text?: string;
  hasError?: boolean;
}) {
  if (!status && hasError) {
    return (
      <span className="mono inline-flex items-center gap-1.5 rounded border border-rose/25 bg-rose-soft px-2 py-[2px] text-[11.5px] font-semibold text-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-rose" />
        ERR
      </span>
    );
  }
  const meta = statusMeta(status);
  return (
    <span
      className={cx(
        "mono inline-flex items-center gap-1.5 rounded border border-current/15 px-2 py-[2px] text-[11.5px] font-semibold",
        meta.pillClass,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      <span>{status || "—"}</span>
      {text && <span className="font-medium opacity-85">{text}</span>}
    </span>
  );
}

export function ActorTag({
  actor,
  size = "sm",
}: {
  actor: string;
  size?: "xs" | "sm";
  compact?: boolean;
}) {
  const isAgent = actor === "agent";
  const sizing = size === "xs" ? "px-1.5 py-[1px] text-[9.5px]" : "px-1.5 py-[2px] text-[10px]";
  if (isAgent) {
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center gap-1 rounded border border-violet/25 bg-violet-soft font-semibold uppercase tracking-[0.05em] text-violet",
          sizing,
        )}
      >
        <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} />
        Agent
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded border border-line bg-subtle font-medium uppercase tracking-[0.05em] text-ink3",
        sizing,
      )}
    >
      Human
    </span>
  );
}

export function EnvCapsule({
  env,
  size = "sm",
  interactive = false,
  busy = false,
}: {
  env: string;
  size?: "xs" | "sm";
  interactive?: boolean;
  busy?: boolean;
}) {
  const name = env || "default";
  const isProd = /prod|production|live/i.test(name);
  const isStaging = /stag|stage|dev|test/i.test(name);
  const style = isProd
    ? "border-amber/35 bg-amber-soft text-amber"
    : isStaging
      ? "border-line bg-canvas text-ink"
      : "border-line bg-canvas text-ink";
  const dot = isProd ? "bg-amber" : isStaging ? "bg-emerald" : "bg-accent";

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border font-medium",
        size === "xs" ? "h-[20px] px-1.5 text-[10.5px]" : "h-[28px] px-2.5 text-[11.5px]",
        style,
        interactive && !isProd && "hover:border-line-strong hover:bg-subtle",
      )}
    >
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="mono truncate max-w-[120px]">{name}</span>
      {busy ? (
        <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current/25 border-t-current" />
      ) : interactive ? (
        <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
      ) : null}
    </span>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: ReactNode;
  indicator?: boolean;
}

/**
 * Hoppscotch-style flat underline tab strip: zero visual clutter, crisp 2px active indicator.
 */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  compact = false,
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div role="tablist" className={cx("flex h-full items-stretch gap-1", className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.id)}
            className={cx(
              "motion relative inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 text-[12px]",
              compact ? "px-2" : "px-2.5",
              active
                ? "border-accent font-semibold text-ink"
                : "border-transparent font-medium text-ink2 hover:text-ink",
            )}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== null && (
              <span
                className={cx(
                  "mono rounded border px-1 py-[0.5px] text-[10px] leading-tight",
                  active
                    ? "border-line-strong bg-subtle text-ink"
                    : "border-line bg-subtle/70 text-ink3",
                )}
              >
                {item.badge}
              </span>
            )}
            {item.indicator && !item.badge && (
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Highlights {{var}} placeholders inline using the shared .var-pill design token. */
export function VarTokens({
  value,
  secret,
  undefinedKey,
}: {
  value: string;
  secret?: (k: string) => boolean;
  undefinedKey?: (k: string) => boolean;
}) {
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
            className="var-pill"
            data-secret={String(isSecret)}
            data-undefined={String(isUndefined)}
          >
            {isSecret ? `🔒 ${key}` : key}
          </span>
        );
      })}
    </>
  );
}
