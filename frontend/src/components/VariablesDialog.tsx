import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { useStore } from "../store";
import type { VarItem } from "../lib/types";
import { cx, Ghost } from "./ui";

/** Environment variables, including keychain-backed secrets. */
export function VariablesDialog() {
  const { varsOpen, varFocus, set, vars, env, environments, setVar } = useStore();
  const [scope, setScope] = useState(env || "global");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [secret, setSecret] = useState(false);

  useEffect(() => {
    if (!varsOpen) return;
    const found = vars.find((v) => v.key === varFocus);
    setKey(varFocus ?? "");
    setScope(found?.scope ?? env ?? "global");
    setSecret(found?.secret ?? false);
    setValue("");
  }, [varsOpen, varFocus, vars, env]);

  const commit = () => {
    if (!key.trim()) return;
    void setVar(scope, key.trim(), value, secret).then(() => {
      setValue("");
      set({ varFocus: key.trim() });
    });
  };

  return (
    <Dialog.Root open={varsOpen} onOpenChange={(open) => set({ varsOpen: open, varFocus: open ? useStore.getState().varFocus : null })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Content className="overlay fixed left-1/2 top-[14%] z-50 w-[560px] -translate-x-1/2 rounded-[8px] p-0">
          <div className="flex h-[34px] items-center justify-between border-b border-line px-3">
            <Dialog.Title className="text-[12px] text-ink">Variables</Dialog.Title>
            <span className="mono text-[10.5px] text-ink3">env {env}</span>
          </div>

          <div className="scroll max-h-[240px] overflow-y-auto">
            <div className="grid h-[26px] grid-cols-[1fr_1fr_90px_60px] items-center border-b border-line text-[10.5px] uppercase tracking-wide text-ink3">
              <span className="px-3">Key</span>
              <span className="px-1.5">Value</span>
              <span className="px-1.5">Scope</span>
              <span className="px-1.5">Type</span>
            </div>
            {vars.map((item: VarItem) => (
              <button
                key={`${item.scope}:${item.key}`}
                type="button"
                onClick={() => {
                  setKey(item.key);
                  setScope(item.scope);
                  setSecret(item.secret);
                  setValue("");
                  set({ varFocus: item.key });
                }}
                className={cx(
                  "grid h-[28px] w-full grid-cols-[1fr_1fr_90px_60px] items-center border-b border-line text-left text-[11.5px] hover:bg-elevated",
                  varFocus === item.key ? "bg-elevated text-ink" : "text-ink2",
                )}
              >
                <span className="truncate px-3 mono">{item.key}</span>
                <span className="truncate px-1.5 mono">{item.secret ? "[KEYCHAIN_SECRET]" : item.value}</span>
                <span className="px-1.5 mono text-[10.5px] text-ink3">{item.scope}</span>
                <span className="px-1.5 mono text-[10.5px] text-ink3">{item.secret ? "secret" : "text"}</span>
              </button>
            ))}
            {vars.length === 0 && <div className="px-3 py-2 text-[11px] text-ink3">No variables yet.</div>}
          </div>

          <div className="space-y-2 border-t border-line p-3">
            <div className="flex items-center gap-1.5">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="base_url"
                spellCheck={false}
                className="h-[26px] w-[160px] rounded-[4px] border border-line bg-surface px-1.5 mono text-[11.5px] text-ink outline-none placeholder:text-ink3 focus:border-line-strong"
              />
              <span className="text-ink3">=</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                }}
                placeholder={secret ? "secret value (stored in the OS keychain)" : "value"}
                type={secret ? "password" : "text"}
                spellCheck={false}
                className="h-[26px] min-w-0 flex-1 rounded-[4px] border border-line bg-surface px-1.5 mono text-[11.5px] text-ink outline-none placeholder:text-ink3 focus:border-line-strong"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="h-[24px] rounded-[4px] border border-line bg-surface px-1 text-[11px] text-ink2 outline-none"
              >
                <option value="global">global</option>
                {environments.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSecret((v) => !v)}
                className={cx(
                  "motion h-[24px] rounded-[4px] border px-2 text-[11px]",
                  secret ? "border-secret/50 text-secret" : "border-line text-ink2 hover:text-ink",
                )}
              >
                {secret ? "OS keychain" : "Plain text"}
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <Ghost onClick={() => set({ varsOpen: false })}>Close</Ghost>
                <Ghost onClick={commit}>Save variable</Ghost>
              </div>
            </div>
            <p className="text-[10.5px] leading-relaxed text-ink3">
              Secret values live only in the system credential store. YAML keeps the key name and a
              secret marker, never the value.
            </p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
