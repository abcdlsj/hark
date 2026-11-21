import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUpFromLine, ChevronDown, ChevronRight, Copy, Folder, MoreHorizontal, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { relativeTime, splitDuration, statusMeta } from "../lib/format";
import type { ListItem, Log } from "../lib/types";
import { useStore } from "../store";
import { ActorTag, cx, EnvCapsule, IconButton, MethodBadge, Tip, UnderlineTabs } from "./Primitives";
import { NavigatorEmptyState, Spinner } from "./VisualStates";

interface Group {
  name: string;
  items: ListItem[];
}

function groupByModule(items: ListItem[]): Group[] {
  const map = new Map<string, ListItem[]>();
  for (const item of items) {
    const i = item.id.lastIndexOf("/");
    const mod = i > 0 ? item.id.slice(0, i) : "";
    const list = map.get(mod) ?? [];
    list.push(item);
    map.set(mod, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({ name, items: list.sort((x, y) => x.id.localeCompare(y.id)) }));
}

export function Navigator() {
  const {
    apis,
    history,
    selectedId,
    snapshotId,
    agentIds,
    loadingApiId,
    loadingSnapshotId,
    sidebarTab,
    sidebarQuery,
    selectApi,
    newDraft,
    duplicateApi,
    copyCurl,
    openSnapshot,
    set,
  } = useStore(
    useShallow((s) => ({
      apis: s.apis,
      history: s.history,
      selectedId: s.selectedId,
      snapshotId: s.snapshot?.id ?? null,
      agentIds: s.agentIds,
      loadingApiId: s.loadingApiId,
      loadingSnapshotId: s.loadingSnapshotId,
      sidebarTab: s.sidebarTab,
      sidebarQuery: s.sidebarQuery,
      selectApi: s.selectApi,
      newDraft: s.newDraft,
      duplicateApi: s.duplicateApi,
      copyCurl: s.copyCurl,
      openSnapshot: s.openSnapshot,
      set: s.set,
    })),
  );

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, []);

  const query = sidebarQuery.trim().toLowerCase();

  const filteredApis = useMemo(() => {
    if (!query) return apis;
    return apis.filter(
      (a) =>
        a.id.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.method.toLowerCase().includes(query) ||
        a.url.toLowerCase().includes(query),
    );
  }, [apis, query]);

  const groups = useMemo(() => groupByModule(filteredApis), [filteredApis]);

  const filteredHistory = useMemo(() => {
    if (!query) return history;
    return history.filter(
      (h) =>
        h.api_id.toLowerCase().includes(query) ||
        h.method.toLowerCase().includes(query) ||
        h.url.toLowerCase().includes(query) ||
        h.actor.toLowerCase().includes(query),
    );
  }, [history, query]);

  const agentUnseenCount = agentIds.length;

  return (
    <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-chrome">
      {/* Underline Tab Bar + New Button */}
      <div className="flex h-[38px] shrink-0 items-center justify-between gap-2 border-b border-line px-2.5">
        <UnderlineTabs
          compact
          value={sidebarTab}
          onChange={(tab) => set({ sidebarTab: tab })}
          items={[
            { id: "endpoints", label: "Endpoints", badge: apis.length },
            {
              id: "activity",
              label: "Activity",
              badge: history.length,
              indicator: agentUnseenCount > 0,
            },
          ]}
        />
        <Tip label="New request (⌘N)">
          <IconButton size="xs" variant="secondary" onClick={newDraft}>
            <Plus className="h-3.5 w-3.5" strokeWidth={2.1} />
          </IconButton>
        </Tip>
      </div>

      {/* Integrated Filter Input */}
      <div className="flex h-[34px] shrink-0 items-center gap-2 border-b border-line bg-canvas px-2.5 focus-within:bg-canvas">
        <Search className="h-3.5 w-3.5 shrink-0 text-ink3" strokeWidth={1.85} />
        <input
          value={sidebarQuery}
          onChange={(e) => set({ sidebarQuery: e.target.value })}
          placeholder={sidebarTab === "endpoints" ? "Filter endpoints…" : "Filter activity…"}
          spellCheck={false}
          className="h-full w-full min-w-0 bg-transparent text-[12px] text-ink placeholder:text-ink3"
        />
        {sidebarQuery && (
          <button
            type="button"
            onClick={() => set({ sidebarQuery: "" })}
            className="text-ink3 hover:text-ink"
            title="Clear filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* List Body */}
      <div className="scroll min-h-0 flex-1 overflow-y-auto py-1.5">
        {sidebarTab === "endpoints" ? (
          groups.length === 0 ? (
            <NavigatorEmptyState
              mode="endpoints"
              filtered={Boolean(query)}
              onNew={newDraft}
              onClearFilter={() => set({ sidebarQuery: "" })}
            />
          ) : (
            <div className="space-y-1">
              {groups.map((group) => {
                const isCollapsed = group.name !== "" && Boolean(collapsed[group.name]) && !query;
                return (
                  <div key={group.name || "_root"}>
                    {group.name !== "" && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsed((prev) => ({ ...prev, [group.name]: !prev[group.name] }))
                        }
                        className="motion group flex h-[26px] w-full items-center gap-1.5 px-2.5 text-left text-ink2 hover:bg-subtle hover:text-ink"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3 shrink-0 text-ink3" />
                        ) : (
                          <ChevronDown className="h-3 w-3 shrink-0 text-ink3" />
                        )}
                        <Folder className="h-3 w-3 shrink-0 text-ink3" strokeWidth={1.8} />
                        <span className="truncate text-[11.5px] font-semibold tracking-tight">
                          {group.name}
                        </span>
                        <span className="ml-auto mono text-[10px] text-ink3">{group.items.length}</span>
                      </button>
                    )}

                    {!isCollapsed && (
                      <div>
                        {group.items.map((item) => {
                          const active = item.id === selectedId;
                          const action = item.id.slice(item.id.lastIndexOf("/") + 1);
                          const hasAgentDot = agentIds.includes(item.id);
                          const sMeta = statusMeta(item.last_status);

                          return (
                            <div
                              key={item.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => void selectApi(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void selectApi(item.id);
                              }}
                              title={`${item.name && item.name !== item.id ? `${item.name} (${item.id})\n` : `${item.id}\n`}${item.method} ${item.url}`}
                              className={cx(
                                "motion group relative flex h-[30px] cursor-default items-center gap-2 pr-2",
                                group.name ? "pl-5" : "pl-3",
                                active
                                  ? "bg-subtle text-ink before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-accent"
                                  : "text-ink2 hover:bg-subtle/70 hover:text-ink",
                              )}
                            >
                              <MethodBadge
                                method={item.method}
                                short
                                className="w-[34px] shrink-0 text-left text-[10px]"
                              />
                              <span
                                className={cx(
                                  "min-w-0 flex-1 truncate text-[12px]",
                                  active ? "font-semibold text-ink" : "font-normal",
                                )}
                              >
                                {item.name && item.name !== item.id ? item.name : action}
                              </span>

                              <div className="flex shrink-0 items-center gap-1">
                                {loadingApiId === item.id && <Spinner className="h-3 w-3 text-accent-text" />}
                                {hasAgentDot && loadingApiId !== item.id && (
                                  <span
                                    title="Updated by AI agent"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded bg-violet-soft text-violet"
                                  >
                                    <Sparkles className="h-2.5 w-2.5" />
                                  </span>
                                )}
                                {item.last_status > 0 && loadingApiId !== item.id && (
                                  <span className={cx("mono text-[10px] font-semibold group-hover:hidden", sMeta.textClass)}>
                                    {item.last_status}
                                  </span>
                                )}

                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="hidden h-5 w-5 items-center justify-center rounded text-ink3 hover:bg-muted hover:text-ink group-hover:flex"
                                      title="Endpoint actions"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      align="end"
                                      sideOffset={4}
                                      className="popover-surface floating-pop z-50 min-w-[185px] rounded-lg p-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DropdownMenu.Item
                                        onSelect={() => void duplicateApi(item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-subtle"
                                      >
                                        <Copy className="h-3.5 w-3.5 text-ink3" />
                                        <span>Duplicate…</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onSelect={() => void copyCurl(false, item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-subtle"
                                      >
                                        <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                                        <span>Export cURL ({"{{vars}}"})</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onSelect={() => void copyCurl(true, item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink"
                                      >
                                        <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                                        <span>Export cURL (resolved)</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Separator className="my-1 h-px bg-line" />
                                      <DropdownMenu.Item
                                        onSelect={() => set({ confirmDeleteId: item.id })}
                                        className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-rose outline-none data-[highlighted]:bg-rose-soft"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Delete…</span>
                                      </DropdownMenu.Item>
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : filteredHistory.length === 0 ? (
          <NavigatorEmptyState
            mode="activity"
            filtered={Boolean(query)}
            onNew={newDraft}
            onClearFilter={() => set({ sidebarQuery: "" })}
          />
        ) : (
          <div className="divide-y divide-line-subtle">
            {filteredHistory.map((log) => (
              <ActivityRow
                key={log.id}
                log={log}
                now={now}
                active={snapshotId === log.id}
                loading={loadingSnapshotId === log.id}
                onClick={() => void openSnapshot(log.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function ActivityRow({
  log,
  now,
  active,
  loading,
  onClick,
}: {
  log: Log;
  now: number;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const name = log.api_id === "_adhoc" ? "Adhoc" : log.api_id.slice(log.api_id.lastIndexOf("/") + 1);
  const dur = splitDuration(log.duration_ms);
  const sMeta = statusMeta(log.status);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${log.method} ${log.url}`}
      className={cx(
        "motion relative flex w-full flex-col gap-1 px-3 py-2 text-left",
        active
          ? "bg-subtle before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-accent"
          : "hover:bg-subtle/70",
      )}
    >
      <div className="flex items-center gap-1.5">
        <MethodBadge method={log.method} short className="w-[34px] shrink-0 text-[10px]" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{name}</span>
        {loading ? (
          <Spinner className="h-3 w-3 text-accent-text" />
        ) : (
          <span className={cx("mono text-[11px] font-semibold", sMeta.textClass)}>
            {log.status || (log.error ? "ERR" : "—")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink3">
        <div className="flex min-w-0 items-center gap-1.5">
          <ActorTag actor={log.actor} size="xs" />
          <EnvCapsule env={log.env} size="xs" />
          <span className="truncate">{relativeTime(log.ts, now)}</span>
        </div>
        <span className="mono shrink-0 text-ink2">
          {dur.num}
          <span className="ml-0.5 text-ink3">{dur.unit}</span>
        </span>
      </div>
    </button>
  );
}
