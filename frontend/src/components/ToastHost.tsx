import { useEffect } from "react";
import { useStore } from "../store";
import { Button, cx } from "./Primitives";

export function ToastHost() {
  const { toast, dismissToast } = useStore();

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
          : "bg-cobalt";

  return (
    <div
      key={toast.id}
      role="status"
      className="floating-surface anim-toast fixed bottom-4 right-4 z-50 flex max-w-[460px] items-center gap-2.5 rounded-full py-2 pl-3.5 pr-2.5"
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
