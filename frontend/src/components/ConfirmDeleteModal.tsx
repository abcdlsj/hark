import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useStore } from "../store";
import { Button, IconButton } from "./Primitives";
import { Spinner } from "./VisualStates";

export function ConfirmDeleteModal() {
  const { confirmDeleteId, set, deleteApi } = useStore(
    useShallow((s) => ({
      confirmDeleteId: s.confirmDeleteId,
      set: s.set,
      deleteApi: s.deleteApi,
    })),
  );
  const [busy, setBusy] = useState(false);

  const open = Boolean(confirmDeleteId);

  const close = () => {
    if (busy) return;
    set({ confirmDeleteId: null });
  };

  const confirm = async () => {
    if (!confirmDeleteId || busy) return;
    setBusy(true);
    try {
      await deleteApi(confirmDeleteId);
      set({ confirmDeleteId: null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content className="modal-surface dialog-content fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-[400px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px]">
          <div className="flex h-[44px] items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-rose" strokeWidth={1.9} />
              <Dialog.Title className="text-[13px] font-semibold text-ink">
                Delete endpoint
              </Dialog.Title>
            </div>
            <IconButton size="xs" onClick={close} disabled={busy}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>

          <div className="space-y-3 p-4">
            <Dialog.Description className="text-[12.5px] leading-relaxed text-ink2">
              Remove <span className="mono font-semibold text-ink">{confirmDeleteId}</span> from this workspace? Its
              YAML file under <span className="mono text-ink2">collections/</span> will be deleted from disk.
            </Dialog.Description>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={() => void confirm()} disabled={busy}>
                {busy ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                <span>{busy ? "Deleting…" : "Delete"}</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
