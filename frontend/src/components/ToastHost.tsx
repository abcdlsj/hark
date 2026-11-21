import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store";
import { Button, cx } from "./Primitives";

export function ToastHost() {
  const { toast, dismissToast } = useStore(
    useShallow((s) => ({ toast: s.toast, dismissToast: s.dismissToast })),
  );

  useEffect(() => {
    if (!toast) return;
    const ms = toast.action ? 6500 : 3200;
    const id = window.setTimeout(() => dismissToast(), ms);
    return () => window.clearTimeout(id);
  }, [toast, dismissToast]);

  if (!toast) return null;

  const dotColor =
    toast.tone === "success"
      ? "bg-emerald"
      : toast.tone === "warn"
        ? "bg-amber"
        : toast.tone === "error"
          ? "bg-rose"
          : "bg-accent";

  return (
    <div
      key={toast.id}
      role="status"
      className="popover-surface anim-toast fixed bottom-9 right-3 z-50 flex max-w-[460px] items-center gap-2.5 rounded-lg py-2 pl-3 pr-2.5"
    >
      <span className={cx("h-2 w-2 shrink-0 rounded-full", dotColor)} />
      <span className="text-[12px] font-medium text-ink">{toast.text}</span>
      {toast.action && (
        <Button
          size="xs"
          variant="primary"
          onClick={() => {
            toast.action?.run();
            dismissToast();
          }}
        >
          {toast.action.label}
        </Button>
      )}
    </div>
  );
}
