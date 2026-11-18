import { Check, Plus, Trash2 } from "lucide-react";
import { splitHeaderBlob } from "../lib/format";
import type { KV } from "../lib/types";
import { cx } from "./Primitives";
import { VarField } from "./VarField";

const isOn = (kv: KV): boolean => kv.enabled !== false;

/** Breathable key-value table with inline {{var}} highlighting and bulk Key: Value paste. */
export function KVTable({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value or {{variable}}",
  emptyHint = "Tip: paste multi-line Key: Value headers into any value cell.",
}: {
  rows: KV[];
  onChange: (next: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyHint?: string;
}) {
  const filledCount = rows.filter((r) => r.key !== "" || r.value !== "").length;
  const display: (KV | null)[] = [...rows, null];

  const update = (index: number, patch: Partial<KV>) => {
    const next = [...rows];
    if (index >= next.length) {
      next.push({ key: "", value: "", enabled: true });
    }
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid h-[30px] shrink-0 grid-cols-[36px_36%_1fr_34px] items-center border-b border-line bg-subtle/60">
        <span />
        <span className="eyebrow px-2.5">Key</span>
        <span className="eyebrow border-l border-line px-2.5">Value</span>
        <span />
      </div>

      <div className="scroll min-h-0 flex-1 overflow-y-auto">
        {display.map((row, index) =>
          row === null ? (
            <div
              key="__new"
              className="grid h-[36px] grid-cols-[36px_36%_1fr_34px] items-center border-b border-line/70 bg-subtle/25"
            >
              <span className="flex items-center justify-center text-ink3">
                <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <div className="flex h-full items-center">
                <VarField
                  value=""
                  onChange={(key) => update(index, { key, enabled: true })}
                  placeholder={keyPlaceholder}
                />
              </div>
              <div className="flex h-full items-center border-l border-line/70">
                <VarField
                  value=""
                  onChange={(value) => update(index, { value, enabled: true })}
                  placeholder={valuePlaceholder}
                  onPasteBlob={(raw) => {
                    const parsed = splitHeaderBlob(raw);
                    if (!parsed) return false;
                    onChange([...rows, ...parsed.map((p) => ({ ...p, enabled: true }))]);
                    return true;
                  }}
                />
              </div>
              <span />
            </div>
          ) : (
            <div
              key={index}
              className={cx(
                "motion group grid h-[36px] grid-cols-[36px_36%_1fr_34px] items-center border-b border-line/70 hover:bg-subtle/45",
                !isOn(row) && "opacity-45",
              )}
            >
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isOn(row)}
                  onClick={() => update(index, { enabled: !isOn(row) })}
                  className={cx(
                    "motion flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border",
                    isOn(row)
                      ? "border-cobalt bg-cobalt text-white"
                      : "border-line-strong bg-surface text-transparent",
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={2.8} />
                </button>
              </div>
              <div className="flex h-full items-center">
                <VarField value={row.key} onChange={(key) => update(index, { key })} placeholder="key" />
              </div>
              <div className="flex h-full items-center border-l border-line/70">
                <VarField
                  value={row.value}
                  onChange={(value) => update(index, { value })}
                  placeholder="value"
                  onPasteBlob={(raw) => {
                    const parsed = splitHeaderBlob(raw);
                    if (!parsed) return false;
                    const next = [
                      ...rows.slice(0, index),
                      ...parsed.map((p) => ({ ...p, enabled: true })),
                      ...rows.slice(index + 1),
                    ];
                    onChange(next);
                    return true;
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                title="Remove row"
                className="motion invisible flex h-full items-center justify-center text-ink3 hover:text-rose group-hover:visible"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ),
        )}

        {filledCount === 0 && (
          <div className="px-4 py-3 text-[11.5px] leading-relaxed text-ink3">{emptyHint}</div>
        )}
      </div>
    </div>
  );
}
