import { useMemo, useState } from "react";
import { useStore } from "../store";
import type { ListItem, Log } from "../lib/types";
import { clockTime, humanMS, methodPrefix } from "../lib/format";
import { cx, Dot, MethodText, StatusText } from "./ui";

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

export function Sidebar() {
  const { apis, history, selectedId, select, agentIds, openSnapshot, newDraft } = useStore();
  const groups = useMemo(() => groupByModule(apis), [apis]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pulseOpen, setPulseOpen] = useState(true);

  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex h-[34px] shrink-0 items-center justify-between pl-3 pr-2">
        <span className="text-[10.5px] uppercase tracking-wide text-ink3">Collections</span>
        <button
          type="button"
          onClick={newDraft}
          title="New request (⌘N)"
          className="motion flex h-5 w-5 items-center justify-center rounded-[4px] text-[13px] leading-none text-ink2 hover:bg-elevated hover:text-ink"
        >
          +
        </button>
      </div>

      <div className="scroll min-h-0 flex-1 overflow-y-auto pb-2">
        {groups.length === 0 && (
          <div className="px-3 py-2 text-[11.5px] leading-relaxed text-ink3">
            No requests yet. Paste a cURL anywhere, or run{" "}
            <span className="mono text-ink2">apic save orders/refund --stdin</span>.
          </div>
        )}
        {groups.map((group) => {
          const isCollapsed = group.name !== "" && collapsed[group.name];
          return (
            <div key={group.name || "_root"} className="mb-0.5">
              {group.name !== "" && (
                <button
                  type="button"
                  onClick={() => setCollapsed((prev) => ({ ...prev, [group.name]: !prev[group.name] }))}
                  className="motion flex h-[26px] w-full items-center gap-1 pl-2 pr-2 text-left text-[11.5px] text-ink2 hover:text-ink"
                >
                  <span className="w-2 text-[9px] text-ink3">{isCollapsed ? "▸" : "▾"}</span>
                  <span className="truncate">{group.name}</span>
                </button>
              )}
              {!isCollapsed &&
                group.items.map((item) => {
                  const active = item.id === selectedId;
                  const action = item.id.slice(item.id.lastIndexOf("/") + 1);
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void select(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void select(item.id);
                      }}
                      title={`${item.method} ${item.url}`}
                      className={cx(
                        "motion group flex h-[28px] cursor-default items-center gap-1 pr-2 text-[12px]",
                        group.name !== "" ? "pl-6" : "pl-3",
                        active ? "bg-elevated text-ink" : "text-ink2 hover:bg-elevated/60 hover:text-ink",
                      )}
                    >
                      <MethodText method={item.method} className="w-9 shrink-0 text-[10px]" />
                      <span className="truncate">{action}</span>
                      <span className="ml-auto flex items-center gap-1.5 pl-1">
                        {item.last_status ? (
                          <span
                            className={cx(
                              "mono text-[10px]",
                              item.last_status < 300
                                ? "text-get"
                                : item.last_status < 400
                                  ? "text-post"
                                  : "text-del",
                            )}
                          >
                            {item.last_status}
                          </span>
                        ) : null}
                        {agentIds.includes(item.id) && <Dot tone="agent" />}
                      </span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      <div
        className={cx("flex shrink-0 flex-col border-t border-line", pulseOpen ? "h-[28%] min-h-[120px]" : "h-[26px]")}
      >
        <button
          type="button"
          onDoubleClick={() => setPulseOpen((v) => !v)}
          onClick={() => setPulseOpen(true)}
          className="flex h-[26px] shrink-0 items-center justify-between px-3 text-[10.5px] uppercase tracking-wide text-ink3"
          title="Double-click to collapse"
        >
          <span>Activity pulse</span>
          <span className="text-[9px]">{pulseOpen ? "▾" : "▸"}</span>
        </button>
        {pulseOpen && (
          <div className="scroll min-h-0 flex-1 overflow-y-auto pb-1">
            {history.length === 0 && <div className="px-3 py-1 text-[11px] text-ink3">Nothing yet.</div>}
            {history.map((log) => (
              <PulseRow key={log.id} log={log} onClick={() => void openSnapshot(log.id)} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function PulseRow({ log, onClick }: { log: Log; onClick: () => void }) {
  const agent = log.actor === "agent";
  const name = log.api_id === "_adhoc" ? "adhoc" : log.api_id.slice(log.api_id.lastIndexOf("/") + 1);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      title={`${log.method} ${log.url} · ${clockTime(log.ts)} · ${humanMS(log.duration_ms)}`}
      className="motion flex h-[26px] cursor-default items-center gap-1.5 px-2.5 text-[11px] text-ink2 hover:bg-elevated"
    >
      <span
        className={cx(
          "mono flex h-[13px] w-[13px] shrink-0 items-center justify-center rounded-[2px] text-[9px]",
          agent ? "border border-secret/40 text-secret" : "border border-line text-ink3",
        )}
      >
        {agent ? "A" : "H"}
      </span>
      <MethodText method={log.method} className="w-8 shrink-0 text-[9.5px]" />
      <span className="truncate text-[11px]">{name}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="mono text-[10px] text-ink3">{clockTime(log.ts)}</span>
        <StatusText status={log.status} />
      </span>
    </div>
  );
}

export { methodPrefix };
