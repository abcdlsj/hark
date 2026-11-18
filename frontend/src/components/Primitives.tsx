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
    <Tooltip.Root delayDuration={240}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="floating-surface floating-pop z-50 rounded-[8px] px-2.5 py-1 text-[11px] font-medium text-ink"
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
        "mono inline-flex items-center justify-center rounded-[5px] border border-line bg-subtle px-1.5 py-[2px] text-[10px] font-medium leading-none text-ink3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function IconButton({
  children,
  onClick,
  active,
  variant = "ghost",
  className,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  variant?: "ghost" | "secondary";
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cx(
        "motion inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[8px] border",
        active
          ? "border-line-strong bg-surface text-ink shadow-xs"
          : variant === "secondary"
            ? "border-line bg-surface text-ink2 shadow-2xs hover:border-line-strong hover:bg-subtle hover:text-ink"
            : "border-transparent text-ink2 hover:border-line hover:bg-surface/80 hover:text-ink",
        disabled ? "pointer-events-none opacity-40" : "active:scale-[0.96]",
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
    xs: "h-[24px] px-2 text-[11px] rounded-[6px]",
    sm: "h-[28px] px-2.5 text-[12px] rounded-[8px]",
    md: "h-[32px] px-3.5 text-[12.5px] rounded-[9px]",
  };
  const variants = {
    primary: "border border-transparent bg-cobalt text-white font-medium hover:brightness-110 shadow-xs",
    secondary: "border border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink hover:bg-subtle",
    ghost: "border border-transparent text-ink2 hover:bg-muted/70 hover:text-ink",
    danger: "border border-rose/25 bg-rose-soft text-rose hover:border-rose/40",
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
        disabled ? "pointer-events-none opacity-40" : "active:scale-[0.96]",
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
 * Gauge-inspired segmented discrete tick bar.
 * Supports either single-ratio fill (`ratio` 0..1) or proportional multi-phase `segments`.
 */
export function SegmentedBar({
  ticks = 28,
  ratio,
  fillClass = "bg-cobalt",
  segments,
  heightClass = "h-[11px]",
  className,
}: {
  ticks?: number;
  ratio?: number;
  fillClass?: string;
  segments?: BarSegment[];
  heightClass?: string;
  className?: string;
}) {
  const tickColors: { color: string; title?: string }[] = [];

  if (segments && segments.length > 0) {
    const positive = segments.filter((s) => s.value > 0);
    const total = positive.reduce((acc, s) => acc + s.value, 0);
    if (total <= 0) {
      for (let i = 0; i < ticks; i++) tickColors.push({ color: "bg-tick-track" });
    } else {
      // Fair largest-remainder allocation with minimum 1 tick per non-zero phase when possible.
      const counts = positive.map((s) => {
        const exact = (s.value / total) * ticks;
        return { s, exact, count: Math.floor(exact) };
      });
      for (const c of counts) {
        if (c.count === 0) c.count = 1;
      }
      let sum = counts.reduce((acc, c) => acc + c.count, 0);
      while (sum > ticks) {
        const largest = counts.reduce((best, c) => (c.count > best.count ? c : best), counts[0]);
        if (largest.count <= 1) break;
        largest.count -= 1;
        sum -= 1;
      }
      while (sum < ticks) {
        const best = counts.reduce(
          (pick, c) => (c.exact - c.count > pick.exact - pick.count ? c : pick),
          counts[0],
        );
        best.count += 1;
        sum += 1;
      }
      for (const c of counts) {
        for (let i = 0; i < c.count && tickColors.length < ticks; i++) {
          tickColors.push({
            color: c.s.colorClass,
            title: c.s.label ? `${c.s.label}: ${c.s.value.toFixed(1)} ms` : undefined,
          });
        }
      }
    }
  } else {
    const clamped = Math.max(0, Math.min(1, ratio ?? 0));
    const filled = Math.round(clamped * ticks);
    for (let i = 0; i < ticks; i++) {
      tickColors.push({ color: i < filled ? fillClass : "bg-tick-track" });
    }
  }

  return (
    <div className={cx("flex items-center gap-[2.5px]", className)}>
      {tickColors.map((tick, idx) => (
        <span
          key={idx}
          title={tick.title}
          className={cx("flex-1 rounded-[2.5px] transition-colors duration-300", heightClass, tick.color)}
        />
      ))}
    </div>
  );
}

/** Gauge-style split telemetry numeral: bold primary figure + muted unit suffix. */
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
  const numSize = size === "lg" ? "text-[22px]" : size === "sm" ? "text-[14px]" : "text-[18px]";
  const unitSize = size === "lg" ? "text-[12px]" : size === "sm" ? "text-[10.5px]" : "text-[11px]";
  return (
    <span className={cx("inline-flex items-baseline tabular leading-none", className)}>
      <span className={cx("font-bold tracking-[-0.02em] text-ink", numSize)}>{num}</span>
      {unit && <span className={cx("ml-1 font-normal text-ink3", unitSize)}>{unit}</span>}
    </span>
  );
}

export function MethodBadge({
  method,
  short = false,
  pill = true,
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
      <span className={cx("mono text-[10.5px] font-semibold tracking-[0.03em]", meta.textClass, className)}>
        {short ? meta.short : meta.label}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "mono inline-flex items-center justify-center rounded-[5px] px-1.5 py-[2px] text-[10px] font-semibold tracking-[0.03em]",
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
      <span className="mono inline-flex items-center gap-1.5 rounded-full bg-rose-soft px-2.5 py-[3px] text-[11.5px] font-semibold text-rose">
        <span className="h-1.5 w-1.5 rounded-full bg-rose" />
        ERR
      </span>
    );
  }
  const meta = statusMeta(status);
  return (
    <span
      className={cx(
        "mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold",
        meta.pillClass,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      <span>{status || "—"}</span>
      {text && <span className="font-normal opacity-80">{text}</span>}
    </span>
  );
}

export function ActorTag({
  actor,
  size = "sm",
  compact = false,
}: {
  actor: string;
  size?: "xs" | "sm";
  compact?: boolean;
}) {
  const isAgent = actor === "agent";
  const sizing = size === "xs" ? "px-1.5 py-[1px] text-[9.5px]" : "px-2 py-[2px] text-[10px]";
  if (isAgent) {
    return (
      <span
        className={cx(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-soft font-bold uppercase tracking-[0.07em] text-violet",
          sizing,
        )}
      >
        <Sparkles className="h-2.5 w-2.5" strokeWidth={2.2} />
        {compact ? "Agent" : "Agent"}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center rounded-full bg-muted font-semibold uppercase tracking-[0.07em] text-ink3",
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
}: {
  env: string;
  size?: "xs" | "sm";
  interactive?: boolean;
}) {
  const name = env || "default";
  const isProd = /prod|production|live/i.test(name);
  const isStaging = /stag|stage|dev|test/i.test(name);
  const style = isProd
    ? "bg-gradient-to-r from-amber/15 to-rose/15 text-amber border-amber/25"
    : isStaging
      ? "bg-gradient-to-r from-cobalt/15 to-emerald/15 text-cobalt border-cobalt/25"
      : "bg-gradient-to-r from-cobalt/12 to-violet/12 text-cobalt border-cobalt/20";
  const dot = isProd ? "bg-amber" : isStaging ? "bg-emerald" : "bg-cobalt";

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold tracking-tight",
        size === "xs" ? "h-[20px] px-2 text-[10px]" : "h-[28px] px-2.5 text-[11px]",
        style,
      )}
    >
      <span className={cx("h-1.5 w-1.5 rounded-full", dot)} />
      <span className="mono">{name}</span>
      {interactive && <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={2} />}
    </span>
  );
}

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  badge?: ReactNode;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  size = "sm",
  className,
}: {
  items: SegmentedTabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <div
      className={cx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-[10px] bg-muted p-[3px]",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cx(
              "motion inline-flex items-center gap-1.5 whitespace-nowrap rounded-[7px] font-medium",
              size === "xs" ? "h-[22px] px-2 text-[11px]" : "h-[25px] px-2.5 text-[12px]",
              active ? "bg-surface text-ink shadow-xs" : "text-ink2 hover:text-ink",
            )}
          >
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== null && (
              <span className={cx("mono text-[10px]", active ? "text-ink2" : "text-ink3")}>{item.badge}</span>
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
