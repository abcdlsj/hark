import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUpFromLine, ChevronDown, ChevronRight, Copy, MoreHorizontal, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { relativeTime, splitDuration, statusMeta } from "../lib/format";
import type { ListItem, Log } from "../lib/types";
import { useStore } from "../store";
import { ActorTag, cx, EnvCapsule, IconButton, MethodBadge, MetricDisplay, SegmentedTabs, Tip } from "./Primitives";
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
    snapshot,
    agentIds,
    loadingApiId,
    loadingSnapshotId,
    sidebarTab,
    sidebarQuery,
    lastSyncedAt,
    selectApi,
    newDraft,
    duplicateApi,
    deleteApi,
    copyCurl,
    openSnapshot,
    set,
  } = useStore();

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
    <aside className="island flex w-[258px] shrink-0 flex-col overflow-hidden">
      {/* Top tab switch + New button */}
      <div className="flex h-[44px] shrink-0 items-center justify-between gap-2 border-b border-line px-2.5">
        <SegmentedTabs
          size="xs"
          value={sidebarTab}
          onChange={(tab) => set({ sidebarTab: tab })}
          items={[
            { id: "endpoints", label: "Endpoints", badge: apis.length },
            {
              id: "activity",
              label: "Activity",
              badge: (
                <span className="inline-flex items-center gap-1">
                  <span>{history.length}</span>
                  {agentUnseenCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-violet" />}
                </span>
              ),
            },
          ]}
        />
        <Tip label="New request (⌘N)">
          <IconButton variant="secondary" onClick={newDraft}>
            <Plus className="h-4 w-4" strokeWidth={2} />
          </IconButton>
        </Tip>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 border-b border-line/70 px-2.5 py-2">
        <div className="flex h-[30px] items-center gap-1.5 rounded-[9px] border border-line bg-subtle px-2.5 focus-within:border-cobalt/45 focus-within:bg-surface">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink3" strokeWidth={1.9} />
          <input
            value={sidebarQuery}
            onChange={(e) => set({ sidebarQuery: e.target.value })}
            placeholder={sidebarTab === "endpoints" ? "Filter endpoints…" : "Filter activity…"}
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-[12px] text-ink placeholder:text-ink3"
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
      </div>

      {/* List Body */}
      <div className="scroll min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sidebarTab === "endpoints" ? (
          groups.length === 0 ? (
            <NavigatorEmptyState
              mode="endpoints"
              filtered={Boolean(query)}
              onNew={newDraft}
              onClearFilter={() => set({ sidebarQuery: "" })}
            />
          ) : (
            <div className="space-y-2">
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
                        className="motion group mb-0.5 flex h-[24px] w-full items-center gap-1.5 rounded-[7px] px-2 text-left hover:bg-subtle"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3 text-ink3 group-hover:text-ink2" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-ink3 group-hover:text-ink2" />
                        )}
                        <span className="eyebrow truncate text-[10px] tracking-[0.08em] text-ink3 group-hover:text-ink2">
                          {group.name}
                        </span>
                        <span className="ml-auto mono text-[10px] text-ink3">{group.items.length}</span>
                      </button>
                    )}

                    {!isCollapsed && (
                      <div className="space-y-0.5">
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
                              title={`${item.method} ${item.url}`}
                              className={cx(
                                "motion group flex h-[34px] cursor-default items-center gap-2 rounded-[9px] px-2",
                                active
                                  ? "bg-cobalt-soft/85 text-ink"
                                  : "text-ink2 hover:bg-subtle hover:text-ink",
                              )}
                            >
                              <MethodBadge
                                method={item.method}
                                short
                                className="w-[42px] shrink-0 justify-center text-[9.5px]"
                              />
                              <span
                                className={cx(
                                  "min-w-0 flex-1 truncate text-[12.5px]",
                                  active ? "font-semibold text-ink" : "font-medium",
                                )}
                              >
                                {item.name && item.name !== item.id ? item.name : action}
                              </span>

                              <div className="flex shrink-0 items-center gap-1">
                                {loadingApiId === item.id && <Spinner className="h-3 w-3 text-cobalt" />}
                                {hasAgentDot && loadingApiId !== item.id && (
                                  <span
                                    title="Updated by AI agent"
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-violet-soft text-violet"
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
                                      className="hidden h-5 w-5 items-center justify-center rounded-[5px] text-ink3 hover:bg-surface hover:text-ink group-hover:flex"
                                      title="Endpoint actions"
                                    >
                                      <MoreHorizontal className="h-3.5 w-3.5" />
                                    </button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      align="end"
                                      sideOffset={4}
                                      className="floating-surface floating-pop z-50 min-w-[180px] rounded-[11px] p-1"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <DropdownMenu.Item
                                        onSelect={() => void duplicateApi(item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-muted"
                                      >
                                        <Copy className="h-3.5 w-3.5 text-ink3" />
                                        <span>Duplicate…</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onSelect={() => void copyCurl(false, item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-muted"
                                      >
                                        <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                                        <span>Export cURL ({"{{placeholders}}"})</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Item
                                        onSelect={() => void copyCurl(true, item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-muted data-[highlighted]:text-ink"
                                      >
                                        <ArrowUpFromLine className="h-3.5 w-3.5 text-ink3" />
                                        <span>Export cURL (resolved)</span>
                                      </DropdownMenu.Item>
                                      <DropdownMenu.Separator className="my-1 h-px bg-line" />
                                      <DropdownMenu.Item
                                        onSelect={() => void deleteApi(item.id)}
                                        className="motion flex cursor-default items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12px] text-rose outline-none data-[highlighted]:bg-rose-soft"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span>Delete</span>
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
          <div className="divide-y divide-line/80">
            {filteredHistory.map((log) => (
              <ActivityRow
                key={log.id}
                log={log}
                now={now}
                active={snapshot?.id === log.id}
                loading={loadingSnapshotId === log.id}
                onClick={() => void openSnapshot(log.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ambient relative timestamp footer (Gauge-inspired) */}
      <div className="flex h-[32px] shrink-0 items-center justify-between border-t border-line bg-subtle/50 px-3 text-[11px] text-ink3">
        <span>
          updated <strong className="font-semibold text-ink2">{relativeTime(lastSyncedAt, now)}</strong>
        </span>
        {agentUnseenCount > 0 ? (
          <button
            type="button"
            onClick={() => set({ sidebarTab: "activity" })}
            className="inline-flex items-center gap-1 font-semibold text-violet hover:underline"
          >
            <Sparkles className="h-2.5 w-2.5" />
            <span>{agentUnseenCount} agent</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
            <span>IPC live</span>
          </span>
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
      className={cx(
        "motion flex w-full flex-col gap-1.5 rounded-[9px] px-2 py-2.5 text-left",
        active ? "bg-cobalt-soft/80" : "hover:bg-subtle",
      )}
    >
      <div className="flex items-center gap-1.5">
        <ActorTag actor={log.actor} compact />
        <MethodBadge method={log.method} short pill={false} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{name}</span>
        {loading ? (
          <Spinner className="h-3 w-3 text-cobalt" />
        ) : (
          <span className={cx("mono text-[11px] font-bold", sMeta.textClass)}>
            {log.status || (log.error ? "ERR" : "—")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-ink3">
        <div className="flex min-w-0 items-center gap-1.5">
          <EnvCapsule env={log.env} size="xs" />
          <span>{relativeTime(log.ts, now)}</span>
        </div>
        <MetricDisplay num={dur.num} unit={dur.unit} size="sm" />
      </div>
    </button>
  );
}
