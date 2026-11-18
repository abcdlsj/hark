import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDownToLine, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "../store";
import { Button, IconButton, Kbd } from "./Primitives";
import { Spinner } from "./VisualStates";

export function CurlImportModal() {
  const { curlModalOpen, importingCurl, set, importCurl } = useStore();
  const [text, setText] = useState("");

  const handleImport = async () => {
    const trimmed = text.trim();
    if (!trimmed || importingCurl) return;
    const ok = await importCurl(trimmed);
    if (ok) {
      set({ curlModalOpen: false });
      setText("");
    }
  };

  return (
    <Dialog.Root open={curlModalOpen} onOpenChange={(open) => set({ curlModalOpen: open })}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="floating-surface dialog-content fixed left-1/2 top-[16%] z-50 w-[92vw] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-[14px]">
          <div className="flex h-[48px] items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-cobalt-soft text-cobalt">
                <ArrowDownToLine className="h-4 w-4" strokeWidth={2} />
              </div>
              <Dialog.Title className="text-[14px] font-bold tracking-tight text-ink">
                Import cURL Command
              </Dialog.Title>
            </div>
            <IconButton onClick={() => set({ curlModalOpen: false })}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          <div className="space-y-3 p-4">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleImport();
                }
              }}
              placeholder={"curl -X POST 'https://api.example.com/v1/orders' \\\n  -H 'Authorization: Bearer {{api_key}}' \\\n  -H 'Content-Type: application/json' \\\n  --data-raw '{\"order_id\":\"ord_123\"}'"}
              spellCheck={false}
              rows={8}
              className="scroll w-full resize-none rounded-[10px] border border-line bg-subtle p-3 mono text-[12px] leading-relaxed text-ink placeholder:text-ink3 focus:border-cobalt/50 focus:bg-surface"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-ink3">
                Known base URLs and tokens match workspace variables automatically.
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => set({ curlModalOpen: false })}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={() => void handleImport()} disabled={!text.trim() || importingCurl}>
                  {importingCurl ? <Spinner className="h-3.5 w-3.5" /> : <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={2} />}
                  <span>{importingCurl ? "Parsing…" : "Import cURL"}</span>
                  {!importingCurl && <Kbd className="border-white/25 bg-white/15 text-white">⌘↵</Kbd>}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
