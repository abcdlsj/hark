import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { useStore } from "../store";
import type { KV } from "../lib/types";
import { prettyBody } from "../lib/format";
import { cx, Ghost, TabButton } from "./ui";
import { JsonEditor } from "./JsonEditor";
import { KVGrid } from "./KVGrid";
import { VarInput } from "./VarInput";
import { OmniUrl } from "./OmniUrl";

const BODY_TYPES = ["none", "json", "form", "urlencoded", "raw"] as const;

const counts = (rows?: KV[]): number => (rows ?? []).filter((r) => r.enabled !== false && r.key !== "").length;

function formRows(content: string): KV[] {
  return content
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((line) => {
      const i = line.indexOf("=");
      if (i < 0) return { key: line.trim(), value: "", enabled: true };
      return { key: line.slice(0, i), value: line.slice(i + 1), enabled: true };
    });
}

const formContent = (rows: KV[]): string =>
  rows
    .filter((r) => r.enabled !== false && r.key !== "")
    .map((r) => `${r.key}=${r.value}`)
    .join("\n");

export function Composer() {
  const { editor, patch, tab, set, copyCurl, pasteCurl } = useStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  if (!editor) return null;

  const setRows = (field: "query" | "headers", rows: KV[]) => patch((api) => ({ ...api, [field]: rows }));
  const body = editor.body ?? { type: "none", content: "" };
  const auth = editor.auth ?? { type: "none" };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-line pl-3.5 pr-2.5">
        <ApiIdentity />
        <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
          <Ghost onClick={() => setImportOpen(true)} title="Import a cURL command (⌘V anywhere also works)">
            Import
          </Ghost>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                title="Copy as cURL (⌘⇧C)"
                className="motion flex h-[26px] items-center gap-1 rounded-[5px] border border-line px-2.5 text-[12px] text-ink2 hover:border-line-strong hover:bg-elevated/60 hover:text-ink"
              >
                cURL <span className="text-[8px]">▾</span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="overlay z-50 min-w-[230px] rounded-[8px] p-1">
                <DropdownMenu.Item
                  onSelect={() => void copyCurl(false)}
                  className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-elevated"
                >
                  Copy with {"{{placeholders}}"}
                  <span className="ml-1 mono text-[10px] text-ink3">⌘⇧C</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => void copyCurl(true)}
                  className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-ink"
                >
                  Copy with real environment values
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <OmniUrl />

      <div className="flex h-[36px] shrink-0 items-center gap-2 border-b border-line pl-3 pr-2">
        <div className="flex h-full shrink-0 items-center gap-0.5">
          <TabButton active={tab === "params"} onClick={() => set({ tab: "params" })} hint={counts(editor.query) ? `· ${counts(editor.query)}` : undefined}>
            Params
          </TabButton>
          <TabButton active={tab === "headers"} onClick={() => set({ tab: "headers" })} hint={counts(editor.headers) ? `· ${counts(editor.headers)}` : undefined}>
            Headers
          </TabButton>
          <TabButton active={tab === "body"} onClick={() => set({ tab: "body" })} hint={body.type !== "none" ? "•" : undefined}>
            Body
          </TabButton>
          <TabButton active={tab === "auth"} onClick={() => set({ tab: "auth" })} hint={auth.type !== "none" ? "•" : undefined}>
            Auth
          </TabButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "params" && (
          <KVGrid rows={editor.query ?? []} onChange={(rows) => setRows("query", rows)} placeholder="Add query param…" />
        )}
        {tab === "headers" && (
          <KVGrid rows={editor.headers ?? []} onChange={(rows) => setRows("headers", rows)} placeholder="Add header…" />
        )}
        {tab === "body" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-[28px] shrink-0 items-center gap-1 border-b border-line px-2.5">
              {BODY_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patch((api) => ({ ...api, body: { type, content: api.body?.content ?? "" } }))}
                  className={cx(
                    "motion rounded-[3px] px-1.5 py-0.5 mono text-[11px]",
                    body.type === type ? "bg-elevated text-ink" : "text-ink2 hover:bg-elevated/60 hover:text-ink",
                  )}
                >
                  {type}
                </button>
              ))}
              <div className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <Ghost
                  onClick={() => {
                    const { text, json } = prettyBody(body.content);
                    if (json) patch((api) => ({ ...api, body: { ...api.body, content: text } }));
                  }}
                  title="Format JSON"
                >
                  Format
                </Ghost>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {body.type === "form" ? (
                <KVGrid
                  rows={formRows(body.content)}
                  onChange={(rows) => patch((api) => ({ ...api, body: { ...api.body, type: "form", content: formContent(rows) } }))}
                  placeholder="Add form field…"
                />
              ) : body.type === "none" ? (
                <div className="px-3.5 py-2 text-[11.5px] text-ink3">This request has no body.</div>
              ) : (
                <JsonEditor
                  value={body.content}
                  language={body.type === "json"}
                  onChange={(content) => patch((api) => ({ ...api, body: { ...api.body, content } }))}
                />
              )}
            </div>
          </div>
        )}
        {tab === "auth" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3.5">
            <div className="flex items-center gap-1.5">
              {[
                { id: "none", label: "None" },
                { id: "bearer", label: "Bearer Token" },
                { id: "basic", label: "Basic Auth" },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    patch((api) => ({
                      ...api,
                      auth:
                        option.id === "bearer"
                          ? { type: "bearer", token: api.auth?.token || "{{api_key}}" }
                          : option.id === "basic"
                            ? { type: "basic", username: api.auth?.username || "", password: api.auth?.password || "" }
                            : { type: "none" },
                    }))
                  }
                  className={cx(
                    "motion rounded-[5px] border px-2.5 py-1 text-[12px]",
                    auth.type === option.id
                      ? "border-line-strong bg-elevated text-ink"
                      : "border-line text-ink2 hover:border-line-strong hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {auth.type === "bearer" && (
              <label className="flex items-center gap-2.5 text-[11.5px] text-ink2">
                <span className="w-[70px]">Token</span>
                <div className="flex h-[28px] flex-1 items-center rounded-[5px] border border-line bg-canvas">
                  <VarInput value={auth.token ?? ""} onChange={(token) => patch((api) => ({ ...api, auth: { ...api.auth, token } }))} placeholder="{{api_key}}" />
                </div>
              </label>
            )}
            {auth.type === "basic" && (
              <>
                <label className="flex items-center gap-2.5 text-[11.5px] text-ink2">
                  <span className="w-[70px]">Username</span>
                  <div className="flex h-[28px] flex-1 items-center rounded-[5px] border border-line bg-canvas">
                    <VarInput value={auth.username ?? ""} onChange={(username) => patch((api) => ({ ...api, auth: { ...api.auth, username } }))} />
                  </div>
                </label>
                <label className="flex items-center gap-2.5 text-[11.5px] text-ink2">
                  <span className="w-[70px]">Password</span>
                  <div className="flex h-[28px] flex-1 items-center rounded-[5px] border border-line bg-canvas">
                    <VarInput value={auth.password ?? ""} onChange={(password) => patch((api) => ({ ...api, auth: { ...api.auth, password } }))} />
                  </div>
                </label>
              </>
            )}
            <p className="mt-1 max-w-[520px] text-[11px] leading-relaxed text-ink3">
              Auth only maintains the Authorization header. Secrets stay in the OS keychain and are
              redacted from every log and response.
            </p>
          </div>
        )}
      </div>

      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="overlay fixed left-1/2 top-[18%] z-50 w-[520px] -translate-x-1/2 rounded-[8px] p-3">
            <Dialog.Title className="mb-2 text-[12.5px] text-ink">Paste a cURL command</Dialog.Title>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="curl -X POST '{{base_url}}/v1/orders' -H 'Content-Type: application/json' --data-raw '{...}'"
              spellCheck={false}
              rows={8}
              className="scroll w-full resize-none rounded-[5px] border border-line bg-canvas p-2 mono text-[11.5px] text-ink outline-none placeholder:text-ink3 focus:border-line-strong"
            />
            <div className="mt-2 flex justify-end gap-1.5">
              <Ghost onClick={() => setImportOpen(false)}>Cancel</Ghost>
              <Ghost
                onClick={() => {
                  setImportOpen(false);
                  void pasteCurl(importText);
                  setImportText("");
                }}
              >
                Import
              </Ghost>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

/** The current request's title and id, one quiet line that opens an editor. */
function ApiIdentity() {
  const { editor, patch, dirty } = useStore();
  const [open, setOpen] = useState(false);
  if (!editor) return null;
  const id = editor.id.trim();
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Rename this request"
          className="motion flex min-w-0 max-w-[60%] shrink items-center gap-2 rounded-[4px] px-1 py-1 text-left hover:bg-elevated"
        >
          <span className={cx("truncate text-[13px]", editor.name ? "font-medium text-ink" : "text-ink3")}>
            {editor.name || id || "Untitled request"}
          </span>
          {id && <span className="truncate mono text-[11px] text-ink3">{id}</span>}
          {dirty && <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-put" title="Unsaved changes" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={6} className="overlay z-50 w-[340px] rounded-[8px] p-2.5">
          <label className="flex items-center gap-2 text-[11px] text-ink2">
            <span className="w-[42px]">ID</span>
            <input
              value={editor.id}
              onChange={(e) => patch((api) => ({ ...api, id: e.target.value }))}
              placeholder="orders/refund"
              spellCheck={false}
              className="h-[26px] min-w-0 flex-1 rounded-[4px] border border-line bg-canvas px-2 mono text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-line-strong"
            />
          </label>
          <label className="mt-1.5 flex items-center gap-2 text-[11px] text-ink2">
            <span className="w-[42px]">Title</span>
            <input
              value={editor.name}
              onChange={(e) => patch((api) => ({ ...api, name: e.target.value }))}
              placeholder="Refund an order"
              spellCheck={false}
              className="h-[26px] min-w-0 flex-1 rounded-[4px] border border-line bg-canvas px-2 text-[12px] text-ink outline-none placeholder:text-ink3 focus:border-line-strong"
            />
          </label>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink3">
            The ID is the file path under <span className="mono">collections/</span>, for example{" "}
            <span className="mono">orders/refund</span>.
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
