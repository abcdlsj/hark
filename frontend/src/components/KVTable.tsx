import { Check, Plus, Trash2 } from "lucide-react";
import { splitHeaderBlob } from "../lib/format";
import type { KV } from "../lib/types";
import { cx, IconButton, Tip } from "./Primitives";
import { VarField } from "./VarField";

const isOn = (kv: KV): boolean => kv.enabled !== false;

/** Structured key-value grid with inline {{var}} highlighting, focus-expanding values, and bulk paste. */
export function KVTable({
  title,
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value or {{variable}}",
  emptyHint = "Tip: paste multi-line Key: Value headers into any value cell.",
}: {
  title?: string;
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

  const addEmptyRow = () => {
    onChange([...rows, { key: "", value: "", enabled: true }]);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      {/* Hoppscotch-style section sub-header */}
      {title && (
        <div className="flex h-[32px] shrink-0 items-center justify-between border-b border-line bg-chrome/60 px-3">
          <span className="text-[11.5px] font-semibold text-ink2">{title}</span>
          <div className="flex items-center gap-0.5">
            {rows.length > 0 && (
              <Tip label="Clear all rows">
                <IconButton size="xs" onClick={() => onChange([])}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </IconButton>
              </Tip>
            )}
            <Tip label="Add row">
              <IconButton size="xs" onClick={addEmptyRow}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              </IconButton>
            </Tip>
          </div>
        </div>
      )}

      {/* Column Headers */}
      <div className="grid h-[28px] shrink-0 grid-cols-[36px_36%_1fr_34px] items-center border-b border-line bg-subtle/40">
        <span />
        <span className="eyebrow px-2.5">Key</span>
        <span className="eyebrow border-l border-line px-2.5">Value</span>
        <span />
      </div>

      {/* Rows */}
      <div className="scroll min-h-0 flex-1 overflow-y-auto pb-8">
        {display.map((row, index) =>
          row === null ? (
            <div
              key="__new"
              className="grid h-[34px] grid-cols-[36px_36%_1fr_34px] items-center border-b border-line-subtle bg-chrome/30 focus-within:bg-canvas"
            >
              <span className="flex items-center justify-center text-ink3">
                <Plus className="h-3 w-3" strokeWidth={1.8} />
              </span>
              <div className="flex h-full min-w-0 items-center">
                <VarField
                  value=""
                  onChange={(key) => update(index, { key, enabled: true })}
                  placeholder={keyPlaceholder}
                />
              </div>
              <div className="flex h-full min-w-0 items-center border-l border-line-subtle">
                <VarField
                  value=""
                  expandOnFocus
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
                "motion group grid h-[34px] grid-cols-[36px_36%_1fr_34px] items-center border-b border-line-subtle hover:bg-subtle/35 focus-within:bg-subtle/45",
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
                    "motion flex h-[14px] w-[14px] items-center justify-center rounded-[3px] border",
                    isOn(row)
                      ? "border-accent bg-accent text-white"
                      : "border-line-strong bg-canvas text-transparent hover:border-ink3",
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={2.8} />
                </button>
              </div>
              <div className="flex h-full min-w-0 items-center">
                <VarField value={row.key} onChange={(key) => update(index, { key })} placeholder="key" />
              </div>
              <div className="flex h-full min-w-0 items-center border-l border-line-subtle">
                <VarField
                  value={row.value}
                  expandOnFocus
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
                className="motion flex h-full items-center justify-center text-ink3 opacity-0 hover:text-rose group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          ),
        )}

        {filledCount === 0 && (
          <div className="px-3.5 py-3 text-[11.5px] leading-relaxed text-ink3">{emptyHint}</div>
        )}
      </div>
    </div>
  );
}
