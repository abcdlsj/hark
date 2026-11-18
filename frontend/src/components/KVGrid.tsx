import type { KV } from "../lib/types";
import { splitHeaderBlob } from "../lib/format";
import { cx } from "./ui";
import { VarInput } from "./VarInput";

const isOn = (kv: KV): boolean => kv.enabled !== false;

/**
 * A borderless spreadsheet: one row per parameter, 1px grid lines, and an
 * always-present trailing blank row that grows the table as you type.
 */
export function KVGrid({
  rows,
  onChange,
  placeholder = "Add param…",
}: {
  rows: KV[];
  onChange: (next: KV[]) => void;
  placeholder?: string;
}) {
  const filled = rows.filter((r) => r.key !== "" || r.value !== "");
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
    const next = rows.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid h-[24px] shrink-0 grid-cols-[30px_32%_1fr_26px] items-center border-b border-line">
        <span />
        <span className="eyebrow px-2">Key</span>
        <span className="eyebrow border-l border-line px-2">Value</span>
        <span />
      </div>
      <div className="scroll min-h-0 flex-1 overflow-y-auto">
        {display.map((row, index) =>
          row === null ? (
            <div key="__blank" className="grid h-[30px] grid-cols-[30px_32%_1fr_26px] border-b border-line">
              <span />
              <div className="flex items-center">
                <VarInput value="" onChange={(key) => update(index, { key, enabled: true })} placeholder={placeholder} />
              </div>
              <div className="flex items-center border-l border-line" />
              <span />
            </div>
          ) : (
            <div
              key={index}
              className={cx(
                "group grid h-[30px] grid-cols-[30px_32%_1fr_26px] border-b border-line",
                !isOn(row) && "opacity-45",
              )}
            >
              <label className="flex cursor-default items-center justify-center">
                <input
                  type="checkbox"
                  checked={isOn(row)}
                  onChange={(e) => update(index, { enabled: e.target.checked })}
                  className="h-[12px] w-[12px] appearance-none rounded-[2px] border border-line-strong checked:border-var checked:bg-var-bg"
                />
              </label>
              <div className="flex items-center">
                <VarInput value={row.key} onChange={(key) => update(index, { key })} placeholder="key" />
              </div>
              <div className="flex items-center border-l border-line">
                <VarInput
                  value={row.value}
                  onChange={(value) => update(index, { value })}
                  placeholder="value"
                  onPasteBlob={(raw) => {
                    const parsed = splitHeaderBlob(raw);
                    if (!parsed) return false;
                    const next = [...rows.slice(0, index), ...parsed.map((p) => ({ ...p, enabled: true })), ...rows.slice(index + 1)];
                    onChange(next);
                    return true;
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                title="Remove"
                className="motion invisible flex items-center justify-center text-[11px] text-ink3 hover:text-del group-hover:visible"
              >
                ×
              </button>
            </div>
          ),
        )}
        {filled.length === 0 && (
          <div className="px-3.5 py-2 text-[11.5px] text-ink3">
            Empty. Paste a block of <span className="mono">Key: Value</span> lines into any value cell to fill rows.
          </div>
        )}
      </div>
    </div>
  );
}
