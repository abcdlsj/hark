import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { VarItem } from "../lib/types";
import { useStore } from "../store";
import { Button, cx, EnvCapsule, IconButton, SwapText } from "./Primitives";
import { Spinner } from "./VisualStates";

export function VariablesModal() {
  const { varsOpen, varFocus, vars, env, environments, savingVar, set, saveVar } = useStore();
  const [scope, setScope] = useState(env || "global");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [secret, setSecret] = useState(false);
  const [filterScope, setFilterScope] = useState<string>("all");

  useEffect(() => {
    if (!varsOpen) return;
    const found = vars.find((v) => v.key === varFocus);
    setKey(varFocus ?? "");
    setScope(found?.scope ?? env ?? "global");
    setSecret(found?.secret ?? false);
    setValue("");
    setFilterScope("all");
  }, [varsOpen, varFocus, vars, env]);

  const filteredVars = useMemo(() => {
    if (filterScope === "all") return vars;
    return vars.filter((v) => v.scope === filterScope);
  }, [vars, filterScope]);

  const scopes = useMemo(() => ["all", "global", ...environments.filter((e) => e !== "global")], [environments]);

  const commit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleanKey = key.trim();
    if (!cleanKey) return;
    void saveVar(scope, cleanKey, value, secret).then(() => {
      setValue("");
      set({ varFocus: cleanKey });
    });
  };

  return (
    <Dialog.Root
      open={varsOpen}
      onOpenChange={(open) => set({ varsOpen: open, varFocus: open ? useStore.getState().varFocus : null })}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content className="floating-surface dialog-content fixed left-1/2 top-[12%] z-50 w-[92vw] max-w-[620px] -translate-x-1/2 overflow-hidden rounded-[14px]">
          {/* Header */}
          <div className="flex h-[48px] items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-violet-soft text-violet">
                <KeyRound className="h-4 w-4" />
              </div>
              <Dialog.Title className="text-[14px] font-bold tracking-tight text-ink">
                Variables & Keychain Vault
              </Dialog.Title>
              <EnvCapsule env={env} />
            </div>
            <IconButton onClick={() => set({ varsOpen: false })}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          {/* Scope filter pills */}
          <div className="flex items-center gap-1.5 border-b border-line bg-subtle/50 px-4 py-2">
            {scopes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterScope(s)}
                className={cx(
                  "motion rounded-full px-2.5 py-1 text-[11px] font-medium",
                  filterScope === s
                    ? "bg-surface text-ink shadow-2xs border border-line"
                    : "text-ink2 hover:text-ink",
                )}
              >
                {s === "all" ? `All (${vars.length})` : s}
              </button>
            ))}
          </div>

          {/* Variable list */}
          <div className="scroll max-h-[250px] overflow-y-auto">
            <div className="grid h-[28px] grid-cols-[1.2fr_1.3fr_92px_82px] items-center border-b border-line bg-subtle/40 px-4">
              <span className="eyebrow">Key</span>
              <span className="eyebrow">Value</span>
              <span className="eyebrow">Scope</span>
              <span className="eyebrow">Storage</span>
            </div>
            {filteredVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-7 text-center">
                <div className="mb-2.5 w-[210px] space-y-1.5 rounded-[10px] border border-dashed border-line-strong bg-subtle/50 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-14 rounded-[3px] bg-cobalt-soft" />
                    <span className="h-2.5 flex-1 rounded-[3px] bg-tick-track" />
                    <span className="h-3 w-10 rounded-full bg-violet-soft" />
                  </div>
                  <div className="flex items-center gap-2 opacity-60">
                    <span className="h-2.5 w-16 rounded-[3px] bg-tick-track" />
                    <span className="h-2.5 flex-1 rounded-[3px] bg-tick-track" />
                    <span className="h-3 w-10 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="text-[12px] font-medium text-ink2">No variables in this scope yet</div>
                <div className="mt-0.5 text-[11px] text-ink3">Add a plain variable or keychain secret below.</div>
              </div>
            ) : (
              filteredVars.map((item: VarItem) => (
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
                    "motion grid h-[36px] w-full grid-cols-[1.2fr_1.3fr_92px_82px] items-center border-b border-line/70 px-4 text-left text-[12px] hover:bg-subtle",
                    varFocus === item.key ? "bg-cobalt-soft/60 text-ink" : "text-ink2",
                  )}
                >
                  <span className="truncate pr-2 mono font-medium text-ink">{item.key}</span>
                  <span className="truncate pr-2 mono text-[11.5px]">
                    {item.secret ? (
                      <span className="inline-flex items-center gap-1 text-violet">
                        <Lock className="h-3 w-3" />
                        <span>KEYCHAIN_SECRET</span>
                      </span>
                    ) : (
                      item.value || "—"
                    )}
                  </span>
                  <span className="mono text-[11px] text-ink3">{item.scope}</span>
                  <span>
                    <span
                      className={cx(
                        "rounded-full px-2 py-[1px] text-[10px] font-semibold",
                        item.secret ? "bg-violet-soft text-violet" : "bg-muted text-ink2",
                      )}
                    >
                      {item.secret ? "Keychain" : "Plain"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Add / Edit Form */}
          <form onSubmit={commit} className="space-y-3 border-t border-line bg-subtle/50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="base_url"
                spellCheck={false}
                className="h-[32px] w-[170px] rounded-[8px] border border-line bg-surface px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-cobalt/50"
              />
              <span className="mono text-ink3">=</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={secret ? "Enter secret (stored only in OS keychain)" : "Variable value"}
                type={secret ? "password" : "text"}
                spellCheck={false}
                className="h-[32px] min-w-[180px] flex-1 rounded-[8px] border border-line bg-surface px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-cobalt/50"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="motion inline-flex h-[28px] items-center gap-2 rounded-[8px] border border-line bg-surface px-2.5 text-[12px] font-medium text-ink shadow-2xs hover:border-line-strong hover:bg-subtle"
                  >
                    <span className="text-ink3">Scope:</span>
                    <span className="mono">{scope}</span>
                    <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={6} className="floating-surface floating-pop z-50 min-w-[160px] rounded-[11px] p-1">
                    {["global", ...environments.filter((e) => e !== "global")].map((name) => (
                      <DropdownMenu.Item
                        key={name}
                        onSelect={() => setScope(name)}
                        className={cx(
                          "motion flex cursor-default items-center justify-between rounded-[7px] px-2.5 py-1.5 mono text-[12px] outline-none data-[highlighted]:bg-muted",
                          scope === name ? "font-semibold text-ink" : "text-ink2",
                        )}
                      >
                        <span>{name}</span>
                        {scope === name && <span className="h-1.5 w-1.5 rounded-full bg-cobalt" />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                type="button"
                onClick={() => setSecret((v) => !v)}
                className={cx(
                  "motion inline-flex h-[28px] items-center gap-1.5 rounded-[8px] border px-2.5 text-[12px] font-medium shadow-2xs",
                  secret
                    ? "border-violet/40 bg-violet-soft text-violet"
                    : "border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <SwapText value={secret ? "OS Keychain Secret" : "Plain Text"} options={["OS Keychain Secret", "Plain Text"]} />
              </button>

              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => set({ varsOpen: false })}>
                  Close
                </Button>
                <Button type="submit" size="sm" variant="primary" disabled={!key.trim() || savingVar}>
                  {savingVar && <Spinner className="h-3.5 w-3.5" />}
                  <SwapText value={savingVar ? "Saving…" : "Save Variable"} options={["Save Variable", "Saving…"]} />
                </Button>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-ink3">
              Secret values are stored exclusively in the OS keychain. <span className="mono">envs.yaml</span> commits
              only the key name and <span className="mono">secret: true</span>.
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
