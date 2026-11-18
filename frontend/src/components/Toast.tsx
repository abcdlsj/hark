import { useEffect } from "react";
import { useStore } from "../store";
import { cx } from "./ui";

/** Bottom-right micro toast: 3s, no animation bounce, optional single action. */
export function Toast() {
  const { toast, dismissToast } = useStore();

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismissToast(), toast.action ? 6000 : 3000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);

  if (!toast) return null;
  return (
    <div
      key={toast.id}
      className={cx(
        "overlay motion fixed bottom-3 right-3 z-50 flex max-w-[460px] items-center gap-2 rounded-[6px] px-2.5 py-1.5",
      )}
      role="status"
    >
      <span className="mono text-[11px] leading-relaxed text-ink2">{toast.text}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            dismissToast();
          }}
          className="motion shrink-0 rounded-[3px] border border-line px-1.5 py-0.5 mono text-[10.5px] text-ink hover:border-line-strong"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
