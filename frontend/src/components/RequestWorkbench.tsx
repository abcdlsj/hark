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
import { useShallow } from "zustand/react/shallow";
import { clockTime, prettyBody, suggestApiId } from "../lib/format";
import type { KV } from "../lib/types";
import { useStore } from "../store";
import { CodeBlockEditor } from "./CodeBlockEditor";
import { KVTable } from "./KVTable";
import { OmniUrlBar } from "./OmniUrlBar";
import { ActorTag, Button, cx, IconButton, Kbd, SwapText, Tip, UnderlineTabs } from "./Primitives";
import { VarField } from "./VarField";
import { BodyNoneState, Spinner } from "./VisualStates";

const BODY_TYPES = [
  { id: "none", label: "None", hint: "No request payload" },
  { id: "json", label: "application/json", short: "JSON" },
  { id: "form", label: "multipart/form-data", short: "Form" },
  { id: "urlencoded", label: "application/x-www-form-urlencoded", short: "URL Encoded" },
  { id: "raw", label: "text/plain", short: "Raw" },
] as const;

const AUTH_TYPES = [
  { id: "none", label: "None" },
  { id: "bearer", label: "Bearer Token" },
  { id: "basic", label: "Basic Auth" },
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
    copyCurl,
    closeSnapshot,
    applySnapshotToEditor,
    closeEditor,
    set,
  } = useStore(
    useShallow((s) => ({
      editor: s.editor,
      dirty: s.dirty,
      saving: s.saving,
      selectedId: s.selectedId,
      snapshot: s.snapshot,
      composerTab: s.composerTab,
      layout: s.layout,
      savePopoverOpen: s.savePopoverOpen,
      patchEditor: s.patchEditor,
      saveEditor: s.saveEditor,
      copyCurl: s.copyCurl,
      closeSnapshot: s.closeSnapshot,
      applySnapshotToEditor: s.applySnapshotToEditor,
      closeEditor: s.closeEditor,
      set: s.set,
    })),
  );

  if (!editor) return null;

  const body = editor.body ?? { type: "none", content: "" };
  const auth = editor.auth ?? { type: "none" };
  const queryCount = activeCount(editor.query);
  const headerCount = activeCount(editor.headers);
  const isAgentEdited = editor.meta?.updated_by === "agent";

  const currentBodyType = BODY_TYPES.find((t) => t.id === body.type) ?? BODY_TYPES[0];
  const currentAuthType = AUTH_TYPES.find((t) => t.id === (auth.type || "none")) ?? AUTH_TYPES[0];

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      {/* Snapshot Banner when inspecting historical execution */}
      {snapshot && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-violet/25 bg-violet-soft px-3 py-1.5 text-[11.5px]">
          <div className="flex items-center gap-2">
            <ActorTag actor={snapshot.actor} size="xs" />
            <span className="text-ink">
              Historical snapshot from <span className="mono font-semibold">{clockTime(snapshot.ts)}</span>
              {snapshot.env ? (
                <>
                  {" "}
                  in <span className="mono font-semibold">{snapshot.env}</span>
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
              <span>Exit</span>
            </Button>
          </div>
        </div>
      )}

      {/* Compact Identity & Actions Header */}
      <div className="flex h-[38px] shrink-0 items-center justify-between gap-2 border-b border-line bg-chrome/60 px-3">
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

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="xs"
            variant={dirty ? "primary" : "secondary"}
            disabled={saving}
            onClick={() => void saveEditor()}
            title="Save endpoint (⌘S)"
            className="h-[26px] px-2.5 text-[11.5px]"
          >
            {saving ? <Spinner className="h-3 w-3" /> : <Save className="h-3 w-3" strokeWidth={2} />}
            <SwapText value={saving ? "Saving…" : dirty ? "Save" : "Saved"} options={["Save", "Saved"]} />
          </Button>

          {/* Unified Import / Export cURL control */}
          <div className="inline-flex h-[26px] shrink-0 items-center divide-x divide-line overflow-hidden rounded border border-line bg-canvas">
            <Tip label="Import cURL command (⌘V)">
              <button
                type="button"
                onClick={() => set({ curlModalOpen: true })}
                className="motion inline-flex h-full items-center gap-1 px-2 text-[11.5px] font-medium text-ink2 hover:bg-subtle hover:text-ink"
              >
                <ArrowDownToLine className="h-3 w-3 text-ink3" strokeWidth={1.9} />
                <span>Import</span>
              </button>
            </Tip>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  title="Export as cURL (⌘⇧C)"
                  className="motion inline-flex h-full items-center gap-1 px-2 text-[11.5px] font-medium text-ink2 hover:bg-subtle hover:text-ink"
                >
                  <ArrowUpFromLine className="h-3 w-3 text-ink3" strokeWidth={1.9} />
                  <span>Export</span>
                  <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="popover-surface floating-pop z-50 min-w-[240px] rounded-lg p-1.5">
                  <DropdownMenu.Label className="eyebrow px-2 py-1">Export as cURL</DropdownMenu.Label>
                  <DropdownMenu.Item
                    onSelect={() => void copyCurl(false)}
                    className="motion flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-ink outline-none data-[highlighted]:bg-subtle"
                  >
                    <span className="inline-flex items-center gap-2">
                      <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                      <span>With {"{{placeholders}}"}</span>
                    </span>
                    <Kbd>⌘⇧C</Kbd>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => void copyCurl(true)}
                    className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink"
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
              <IconButton size="xs" variant="secondary" title="More options" className="h-[26px] w-[26px]">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="popover-surface floating-pop z-50 min-w-[205px] rounded-lg p-1.5">
                <DropdownMenu.Item
                  onSelect={() => set({ layout: layout === "split" ? "stack" : "split" })}
                  className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-subtle"
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
                  className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-subtle"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-ink3" />
                  <span>Back to workspace overview</span>
                </DropdownMenu.Item>
                {selectedId && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-line" />
                    <DropdownMenu.Item
                      onSelect={() => set({ confirmDeleteId: selectedId })}
                      className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-rose outline-none data-[highlighted]:bg-rose-soft"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete endpoint…</span>
                    </DropdownMenu.Item>
                  </>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Unified Request Bar */}
      <OmniUrlBar />

      {/* Flat Underline Section Tabs */}
      <div className="flex h-[36px] shrink-0 items-center justify-between border-b border-line bg-canvas px-3">
        <UnderlineTabs
          value={composerTab}
          onChange={(tab) => set({ composerTab: tab })}
          items={[
            { id: "params", label: "Parameters", badge: queryCount > 0 ? queryCount : undefined },
            {
              id: "body",
              label: "Body",
              badge: body.type !== "none" ? body.type.toUpperCase() : undefined,
            },
            { id: "headers", label: "Headers", badge: headerCount > 0 ? headerCount : undefined },
            {
              id: "auth",
              label: "Authorization",
              indicator: auth.type !== "none",
            },
          ]}
        />
      </div>

      {/* Active Composer Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {composerTab === "params" && (
          <KVTable
            title="Query Parameters"
            rows={editor.query ?? []}
            onChange={(query) => patchEditor((doc) => ({ ...doc, query }))}
            keyPlaceholder="Parameter name"
            valuePlaceholder="Value or {{variable}}"
            emptyHint="Add URL query parameters or variables like {{page_cursor}}."
          />
        )}

        {composerTab === "headers" && (
          <KVTable
            title="Header List"
            rows={editor.headers ?? []}
            onChange={(headers) => patchEditor((doc) => ({ ...doc, headers }))}
            keyPlaceholder="Header name"
            valuePlaceholder="Header value or {{token}}"
            emptyHint="Tip: paste multi-line Key: Value headers into any value cell to auto-split."
          />
        )}

        {composerTab === "body" && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Hoppscotch-style compact Content-Type dropdown toolbar (never overflows in narrow split panes) */}
            <div className="flex h-[32px] shrink-0 items-center justify-between gap-2 border-b border-line bg-chrome/60 px-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[11.5px] font-semibold text-ink2">Content Type</span>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      className="motion inline-flex h-[22px] max-w-[230px] items-center gap-1.5 rounded border border-line bg-canvas px-2 text-[11.5px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
                    >
                      <span className="truncate mono text-[11px]">{currentBodyType.label}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-ink3" strokeWidth={2} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content align="start" sideOffset={5} className="popover-surface floating-pop z-50 min-w-[240px] rounded-lg p-1">
                      {BODY_TYPES.map((t) => {
                        const active = body.type === t.id;
                        return (
                          <DropdownMenu.Item
                            key={t.id}
                            onSelect={() =>
                              patchEditor((doc) => ({
                                ...doc,
                                body: { type: t.id, content: doc.body?.content ?? "" },
                              }))
                            }
                            className={cx(
                              "motion flex cursor-default items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-[12px] outline-none data-[highlighted]:bg-subtle",
                              active ? "font-semibold text-ink" : "text-ink2",
                            )}
                          >
                            <span className="mono text-[11.5px]">{t.label}</span>
                            {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent-text" strokeWidth={2.2} />}
                          </DropdownMenu.Item>
                        );
                      })}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              {body.type === "json" && (
                <Tip label="Format JSON payload">
                  <Button
                    size="xs"
                    variant="ghost"
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

            <div className="min-h-0 flex-1 overflow-hidden">
              {body.type === "none" ? (
                <BodyNoneState
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
            <div className="flex h-[32px] shrink-0 items-center gap-2 border-b border-line bg-chrome/60 px-3">
              <span className="shrink-0 text-[11.5px] font-semibold text-ink2">Auth Type</span>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="motion inline-flex h-[22px] items-center gap-1.5 rounded border border-line bg-canvas px-2 text-[11.5px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
                  >
                    <span>{currentAuthType.label}</span>
                    <ChevronDown className="h-3 w-3 shrink-0 text-ink3" strokeWidth={2} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={5} className="popover-surface floating-pop z-50 min-w-[165px] rounded-lg p-1">
                    {AUTH_TYPES.map((t) => {
                      const active = (auth.type || "none") === t.id;
                      return (
                        <DropdownMenu.Item
                          key={t.id}
                          onSelect={() =>
                            patchEditor((doc) => ({
                              ...doc,
                              auth:
                                t.id === "bearer"
                                  ? { type: "bearer", token: doc.auth?.token || "{{api_key}}" }
                                  : t.id === "basic"
                                    ? {
                                        type: "basic",
                                        username: doc.auth?.username || "",
                                        password: doc.auth?.password || "",
                                      }
                                    : { type: "none" },
                            }))
                          }
                          className={cx(
                            "motion flex cursor-default items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px] outline-none data-[highlighted]:bg-subtle",
                            active ? "font-semibold text-ink" : "text-ink2",
                          )}
                        >
                          <span>{t.label}</span>
                          {active && <Check className="h-3.5 w-3.5 shrink-0 text-accent-text" strokeWidth={2.2} />}
                        </DropdownMenu.Item>
                      );
                    })}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>

            <div className="scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
              {auth.type === "none" && (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <div className="text-[12.5px] font-medium text-ink2">This request does not use authorization</div>
                  <p className="mt-1 max-w-[300px] text-[11.5px] text-ink3">
                    Select Bearer Token or Basic Auth above to generate an <span className="mono">Authorization</span> header at runtime.
                  </p>
                </div>
              )}

              {auth.type === "bearer" && (
                <div className="border-b border-line-subtle">
                  <div className="flex h-[36px] items-center border-b border-line-subtle px-3">
                    <label className="flex w-[104px] shrink-0 items-center gap-1.5 text-[12px] font-medium text-ink2">
                      <KeyRound className="h-3.5 w-3.5 text-violet" />
                      <span>Token</span>
                    </label>
                    <div className="flex h-full min-w-0 flex-1 items-center border-l border-line-subtle">
                      <VarField
                        value={auth.token ?? ""}
                        expandOnFocus
                        onChange={(token) =>
                          patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, token } }))
                        }
                        placeholder="{{api_key}}"
                      />
                    </div>
                  </div>
                </div>
              )}

              {auth.type === "basic" && (
                <div className="border-b border-line-subtle">
                  <div className="flex h-[36px] items-center border-b border-line-subtle px-3">
                    <label className="w-[104px] shrink-0 text-[12px] font-medium text-ink2">Username</label>
                    <div className="flex h-full min-w-0 flex-1 items-center border-l border-line-subtle">
                      <VarField
                        value={auth.username ?? ""}
                        expandOnFocus
                        onChange={(username) =>
                          patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, username } }))
                        }
                        placeholder="{{basic_user}}"
                      />
                    </div>
                  </div>
                  <div className="flex h-[36px] items-center px-3">
                    <label className="w-[104px] shrink-0 text-[12px] font-medium text-ink2">Password</label>
                    <div className="flex h-full min-w-0 flex-1 items-center border-l border-line-subtle">
                      <VarField
                        value={auth.password ?? ""}
                        expandOnFocus
                        onChange={(password) =>
                          patchEditor((doc) => ({ ...doc, auth: { ...doc.auth, password } }))
                        }
                        placeholder="{{basic_pass}}"
                      />
                    </div>
                  </div>
                </div>
              )}

              {auth.type !== "none" && (
                <p className="max-w-[520px] px-3.5 py-3 text-[11.5px] leading-relaxed text-ink3">
                  Authorization is injected as a request header at execution time. Store credentials in the OS keychain via{" "}
                  <span className="mono text-ink2">{"{{api_key}}"}</span> so secrets stay redacted in YAML files and logs.
                </p>
              )}
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
  const titleHint = cleanId
    ? editorName && editorName !== cleanId
      ? `${editorName} (${cleanId})`
      : cleanId
    : "Click to name & save endpoint";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void onSave(draftId, draftName);
  };

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title={titleHint}
          className="motion -ml-1.5 flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-subtle"
        >
          <span
            className={cx(
              "truncate text-[12.5px] font-semibold tracking-[-0.01em]",
              editorName || cleanId ? "text-ink" : "text-ink3",
            )}
          >
            {editorName || cleanId || "Untitled Request"}
          </span>
          {dirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber"
              title="Unsaved changes"
            />
          )}
          {cleanId && editorName && editorName !== cleanId && (
            <span className="hidden truncate mono text-[11px] text-ink3 sm:inline">
              {cleanId}
            </span>
          )}
          {isAgentEdited && <ActorTag actor="agent" size="xs" />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="bottom" align="start" sideOffset={6} className="popover-surface floating-pop z-50 w-[350px] rounded-lg p-3.5">
          <form onSubmit={submit} className="space-y-3">
            <div>
              <div className="eyebrow mb-1">Endpoint ID</div>
              <input
                autoFocus
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
                placeholder="orders/refund"
                spellCheck={false}
                className="h-[32px] w-full rounded-md border border-line-strong bg-subtle px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-accent focus:bg-canvas"
              />
            </div>

            <div>
              <div className="eyebrow mb-1">Display Title</div>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Refund an order"
                spellCheck={false}
                className="h-[32px] w-full rounded-md border border-line-strong bg-subtle px-2.5 text-[12.5px] text-ink placeholder:text-ink3 focus:border-accent focus:bg-canvas"
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
                <SwapText value={saving ? "Saving…" : "Save Endpoint"} options={["Save Endpoint", "Saving…"]} />
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
