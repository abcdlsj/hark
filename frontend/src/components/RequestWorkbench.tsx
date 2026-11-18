import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronDown,
  Columns2,
  KeyRound,
  LayoutGrid,
  MoreHorizontal,
  Rows2,
  Save,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { clockTime, prettyBody, suggestApiId } from "../lib/format";
import type { KV } from "../lib/types";
import { useStore } from "../store";
import { CodeBlockEditor } from "./CodeBlockEditor";
import { KVTable } from "./KVTable";
import { OmniUrlBar } from "./OmniUrlBar";
import { ActorTag, Button, cx, IconButton, Kbd, SegmentedTabs, Tip } from "./Primitives";
import { VarField } from "./VarField";
import { BodyNoneBlueprint, Spinner } from "./VisualStates";

const BODY_TYPES = [
  { id: "none", label: "None" },
  { id: "json", label: "JSON" },
  { id: "form", label: "Form" },
  { id: "urlencoded", label: "URL Encoded" },
  { id: "raw", label: "Raw" },
] as const;

const activeCount = (rows?: KV[]): number =>
  (rows ?? []).filter((r) => r.enabled !== false && r.key.trim() !== "").length;

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

export function RequestWorkbench() {
  const {
    editor,
    dirty,
    saving,
    selectedId,
    snapshot,
    composerTab,
    layout,
    savePopoverOpen,
    patchEditor,
    saveEditor,
    deleteApi,
    copyCurl,
    closeSnapshot,
    applySnapshotToEditor,
    closeEditor,
    set,
  } = useStore();

  if (!editor) return null;

  const body = editor.body ?? { type: "none", content: "" };
  const auth = editor.auth ?? { type: "none" };
  const queryCount = activeCount(editor.query);
  const headerCount = activeCount(editor.headers);
  const isAgentEdited = editor.meta?.updated_by === "agent";

  return (
    <section className="island flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Snapshot Banner when inspecting historical execution */}
      {snapshot && (
        <div className="anim-slide-down flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-violet/20 bg-violet-soft/60 px-3.5 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <ActorTag actor={snapshot.actor} />
            <span className="text-ink">
              Snapshot from <span className="mono font-medium">{clockTime(snapshot.ts)}</span>
              {snapshot.env ? (
                <>
                  {" "}
                  in <span className="mono font-medium">{snapshot.env}</span>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="xs" variant="secondary" onClick={applySnapshotToEditor}>
              Apply URL & Method
            </Button>
            <Button size="xs" variant="ghost" onClick={closeSnapshot}>
              <X className="h-3 w-3" />
              <span>Exit Snapshot</span>
            </Button>
          </div>
        </div>
      )}

      {/* Identity & Actions Strip */}
      <div className="flex min-h-[52px] shrink-0 items-center gap-2 px-3.5 py-1.5">
        <IdentityPopover
          open={savePopoverOpen}
          onOpenChange={(open) => set({ savePopoverOpen: open })}
          editorId={editor.id}
          editorName={editor.name}
          editorUrl={editor.url}
          editorMethod={editor.method}
          dirty={dirty}
          saving={saving}
          isAgentEdited={isAgentEdited}
          onSave={saveEditor}
        />

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant={dirty ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => void saveEditor()}
            title="Save endpoint (⌘S)"
          >
            {saving ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
            <span>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</span>
            {dirty && !saving && <Kbd className="border-white/25 bg-white/15 text-white">⌘S</Kbd>}
          </Button>

          {/* Unified Import / Export cURL control */}
          <div className="inline-flex h-[28px] shrink-0 items-center divide-x divide-line overflow-hidden rounded-[8px] border border-line bg-surface shadow-2xs">
            <Tip label="Import cURL command (⌘V)">
              <button
                type="button"
                onClick={() => set({ curlModalOpen: true })}
                className="motion inline-flex h-full items-center gap-1.5 px-2.5 text-[12px] font-medium text-ink2 hover:bg-subtle hover:text-ink"
              >
                <ArrowDownToLine className="h-3.5 w-3.5 text-ink3" strokeWidth={1.9} />
                <span>Import</span>
              </button>
            </Tip>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Export as cURL (⌘⇧C)"
                  className="motion inline-flex h-full items-center gap-1.5 px-2.5 text-[12px] font-medium text-ink2 hover:bg-subtle hover:text-ink"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" strokeWidth={1.9} />
                  <span>Export</span>
                  <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="floating-surface floating-pop z-50 min-w-[250px] rounded-[12px] p-1.5">
                  <DropdownMenu.Label className="eyebrow px-2.5 py-1">Export as cURL</DropdownMenu.Label>
                  <DropdownMenu.Item
                    onSelect={() => void copyCurl(false)}
                    className="motion flex cursor-default items-center justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none data-[highlighted]:bg-muted"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                      <span>With {"{{placeholders}}"}</span>
                    </span>
                    <Kbd>⌘⇧C</Kbd>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => void copyCurl(true)}
                    className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-muted data-[highlighted]:text-ink"
                  >
                    <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                    <span>With resolved values</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <IconButton variant="secondary" title="More options">
                <MoreHorizontal className="h-4 w-4" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="floating-surface floating-pop z-50 min-w-[210px] rounded-[12px] p-1.5">
                <DropdownMenu.Item
                  onSelect={() => set({ layout: layout === "split" ? "stack" : "split" })}
                  className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-muted"
                >
                  {layout === "split" ? (
                    <Rows2 className="h-3.5 w-3.5 text-ink3" />
                  ) : (
                    <Columns2 className="h-3.5 w-3.5 text-ink3" />
                  )}
                  <span>{layout === "split" ? "Switch to stacked layout" : "Switch to side-by-side layout"}</span>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={closeEditor}
                  className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-muted"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-ink3" />
                  <span>Back to workspace overview</span>
                </DropdownMenu.Item>
                {selectedId && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-line" />
                    <DropdownMenu.Item
                      onSelect={() => void deleteApi(selectedId)}
                      className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] text-rose outline-none data-[highlighted]:bg-rose-soft"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete endpoint</span>
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Unified Omni URL Capsule */}
      <OmniUrlBar />

      {/* Composer Section Tabs */}
      <div className="flex h-[40px] shrink-0 items-center justify-between border-y border-line bg-subtle/45 px-3.5">
        <SegmentedTabs
          value={composerTab}
          onChange={(tab) => set({ composerTab: tab })}
          items={[
            { id: "params", label: "Params", badge: queryCount > 0 ? queryCount : undefined },
            { id: "headers", label: "Headers", badge: headerCount > 0 ? headerCount : undefined },
            {
              id: "body",
              label: "Body",
              badge:
                body.type !== "none" ? (
                  <span className="uppercase">{body.type}</span>
                ) : undefined,
            },
            {
              id: "auth",
              label: "Auth",
              badge:
                auth.type !== "none" ? (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet" />
                ) : undefined,
            },
          ]}
        />
      </div>

      {/* Active Composer Body */}
      <div className="flex min-h-0 flex-1 flex-col">
        {composerTab === "params" && (
          <KVTable
            rows={editor.query ?? []}
            onChange={(query) => patchEditor((doc) => ({ ...doc, query }))}
            keyPlaceholder="Query parameter"
            valuePlaceholder="Value or {{variable}}"
            emptyHint="Add URL query parameters or variables like {{page_cursor}}."
          />
        )}

        {composerTab === "headers" && (
          <KVTable
            rows={editor.headers ?? []}
            onChange={(headers) => patchEditor((doc) => ({ ...doc, headers }))}
            keyPlaceholder="Header name"
            valuePlaceholder="Header value or {{token}}"
            emptyHint="Tip: paste multi-line Key: Value headers into any value cell to auto-split."
          />
        )}

        {composerTab === "body" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-line bg-surface px-3.5">
              <SegmentedTabs
                size="xs"
                value={body.type as (typeof BODY_TYPES)[number]["id"]}
                onChange={(type) =>
                  patchEditor((doc) => ({
                    ...doc,
                    body: { type, content: doc.body?.content ?? "" },
                  }))
                }
                items={BODY_TYPES.map((t) => ({ id: t.id, label: t.label }))}
              />
              {body.type === "json" && (
                <Tip label="Format JSON payload">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      const { text, json } = prettyBody(body.content);
                      if (json) {
                        patchEditor((doc) => ({ ...doc, body: { ...doc.body, content: text } }));
                      }
                    }}
                  >
                    <Wand2 className="h-3 w-3" />
                    <span>Prettify</span>
                  </Button>
                </Tip>
              )}
            </div>

            <div className="min-h-0 flex-1">
              {body.type === "none" ? (
                <BodyNoneBlueprint
                  onSelectJson={() =>
                    patchEditor((doc) => ({
                      ...doc,
                      body: {
                        type: "json",
                        content: doc.body?.content?.trim() ? doc.body.content : "{\n  \n}",
                      },
                    }))
                  }
                  onSelectForm={() =>
                    patchEditor((doc) => ({
                      ...doc,
                      body: { type: "form", content: doc.body?.content ?? "" },
                    }))
                  }
                />
              ) : body.type === "form" ? (
                <KVTable
                  rows={formRows(body.content)}
                  onChange={(rows) =>
                    patchEditor((doc) => ({
                      ...doc,
                      body: { type: "form", content: formContent(rows) },
                    }))
                  }
                  keyPlaceholder="Field name"
                  valuePlaceholder="Value or @/path/to/file"
                  emptyHint="Multipart form fields. Prefix a value with @ to upload a local file."
                />
              ) : (
                <CodeBlockEditor
                  value={body.content}
                  language={body.type === "json"}
                  onChange={(content) =>
                    patchEditor((doc) => ({ ...doc, body: { ...doc.body, content } }))
                  }
                />
              )}
            </div>
          </div>
        )}

        {composerTab === "auth" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-[38px] shrink-0 items-center justify-between border-b border-line bg-surface px-3.5">
              <SegmentedTabs
                size="xs"
                value={(auth.type || "none") as "none" | "bearer" | "basic"}
                onChange={(nextType) =>
                  patchEditor((doc) => ({
                    ...doc,
                    auth:
                      nextType === "bearer"
                        ? { type: "bearer", token: doc.auth?.token || "{{api_key}}" }
                        : nextType === "basic"
                          ? {
                              type: "basic",
                              username: doc.auth?.username || "",
                              password: doc.auth?.password || "",
                            }
                          : { type: "none" },
                  }))
                }
                items={[
                  { id: "none", label: "No Auth" },
                  { id: "bearer", label: "Bearer Token" },
                  { id: "basic", label: "Basic Auth" },
                ]}
              />
            </div>

            <div className="scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">

            {auth.type === "bearer" && (
              <div className="max-w-[540px] space-y-1.5 rounded-[12px] border border-line bg-subtle/50 p-3.5">
                <div className="eyebrow flex items-center gap-1.5">
                  <KeyRound className="h-3 w-3 text-violet" />
                  <span>Bearer Token</span>
                </div>
                <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface">
                  <VarField
                    value={auth.token ?? ""}
                    onChange={(token) =>
                      patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, token } }))
                    }
                    placeholder="{{api_key}}"
                  />
                </div>
              </div>
            )}

            {auth.type === "basic" && (
              <div className="max-w-[540px] space-y-3 rounded-[12px] border border-line bg-subtle/50 p-3.5">
                <label className="block space-y-1">
                  <span className="eyebrow">Username</span>
                  <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface">
                    <VarField
                      value={auth.username ?? ""}
                      onChange={(username) =>
                        patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, username } }))
                      }
                      placeholder="{{basic_user}}"
                    />
                  </div>
                </label>
                <label className="block space-y-1">
                  <span className="eyebrow">Password</span>
                  <div className="flex h-[34px] items-center rounded-[8px] border border-line bg-surface">
                    <VarField
                      value={auth.password ?? ""}
                      onChange={(password) =>
                        patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, password } }))
                      }
                      placeholder="{{basic_pass}}"
                    />
                  </div>
                </label>
              </div>
            )}

            <p className="max-w-[540px] text-[11.5px] leading-relaxed text-ink3">
              Auth generates the <span className="mono text-ink2">Authorization</span> header at runtime. Keep secrets in
              the OS keychain via <span className="mono text-ink2">{"{{api_key}}"}</span> so they stay redacted across
              YAML and execution logs.
            </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function IdentityPopover({
  open,
  onOpenChange,
  editorId,
  editorName,
  editorUrl,
  editorMethod,
  dirty,
  saving,
  isAgentEdited,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editorId: string;
  editorName: string;
  editorUrl: string;
  editorMethod: string;
  dirty: boolean;
  saving: boolean;
  isAgentEdited: boolean;
  onSave: (overrideId?: string, overrideName?: string) => Promise<boolean>;
}) {
  const [draftId, setDraftId] = useState(editorId);
  const [draftName, setDraftName] = useState(editorName);

  useEffect(() => {
    if (!open) return;
    setDraftId(editorId.trim() ? editorId : suggestApiId(editorUrl, editorMethod));
    setDraftName(editorName);
  }, [open, editorId, editorName, editorUrl, editorMethod]);

  const cleanId = editorId.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave(draftId, draftName);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Edit endpoint ID & title"
          className="motion -ml-1.5 flex min-w-0 flex-1 flex-col items-start justify-center rounded-[9px] px-2 py-1 text-left hover:bg-subtle"
        >
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <span
              className={cx(
                "truncate text-[14px] font-bold leading-tight tracking-[-0.015em]",
                editorName || cleanId ? "text-ink" : "text-ink3",
              )}
            >
              {editorName || cleanId || "Untitled Request"}
            </span>
            {dirty && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-amber"
                title="Unsaved changes"
              />
            )}
          </div>
          {(cleanId || isAgentEdited) && (
            <div className="mt-0.5 flex w-full min-w-0 items-center gap-1.5">
              {cleanId && (
                <span className="truncate mono text-[10.5px] font-medium text-ink3">
                  {cleanId}
                </span>
              )}
              {isAgentEdited && <ActorTag actor="agent" size="xs" />}
            </div>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={8} className="floating-surface floating-pop z-50 w-[360px] rounded-[13px] p-3.5">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <div className="eyebrow mb-1">Endpoint ID</div>
              <input
                autoFocus
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="orders/refund"
                spellCheck={false}
                className="h-[32px] w-full rounded-[8px] border border-line bg-subtle px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-cobalt/50 focus:bg-surface"
              />
            </div>

            <div>
              <div className="eyebrow mb-1">Display Title</div>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Refund an order"
                spellCheck={false}
                className="h-[32px] w-full rounded-[8px] border border-line bg-subtle px-2.5 text-[12.5px] text-ink placeholder:text-ink3 focus:border-cobalt/50 focus:bg-surface"
              />
            </div>

            <p className="text-[11px] leading-relaxed text-ink3">
              Saved as <span className="mono text-ink2">collections/{draftId.trim() || "module/action"}.yaml</span>
            </p>

            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="primary" disabled={saving}>
                {saving ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                <span>{saving ? "Saving…" : "Save Endpoint"}</span>
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
