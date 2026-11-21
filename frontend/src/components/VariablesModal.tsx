import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, KeyRound, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import type { VarItem } from "../lib/types";
import { useStore } from "../store";
import { Button, cx, EnvCapsule, IconButton, SwapText } from "./Primitives";
import { Spinner } from "./VisualStates";

export function VariablesModal() {
  const { varsOpen, varFocus, vars, env, environments, savingVar, set, saveVar } = useStore(
    useShallow((s) => ({
      varsOpen: s.varsOpen,
      varFocus: s.varFocus,
      vars: s.vars,
      env: s.env,
      environments: s.environments,
      savingVar: s.savingVar,
      set: s.set,
      saveVar: s.saveVar,
    })),
  );
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
    setValue(found && !found.secret ? found.value : "");
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
        <Dialog.Overlay className="dialog-overlay fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content className="modal-surface dialog-content fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[92vw] max-w-[620px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[10px]">
          {/* Header */}
          <div className="flex h-[46px] items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-4 w-4 text-violet" strokeWidth={1.9} />
              <Dialog.Title className="text-[13.5px] font-semibold tracking-tight text-ink">
                Variables & Keychain Vault
              </Dialog.Title>
              <EnvCapsule env={env} size="xs" />
            </div>
            <IconButton size="xs" onClick={() => set({ varsOpen: false })}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>

          {/* Scope filter tabs */}
          <div className="flex items-center gap-1 border-b border-line bg-chrome px-4 py-1.5">
            {scopes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterScope(s)}
                className={cx(
                  "motion rounded px-2 py-0.5 text-[11.5px]",
                  filterScope === s
                    ? "bg-subtle font-semibold text-ink ring-1 ring-line-strong"
                    : "font-medium text-ink3 hover:bg-subtle/60 hover:text-ink",
                )}
              >
                {s === "all" ? `All (${vars.length})` : s}
              </button>
            ))}
          </div>

          {/* Variable list */}
          <div className="scroll max-h-[250px] overflow-y-auto bg-canvas">
            <div className="grid h-[28px] grid-cols-[1.2fr_1.3fr_92px_84px] items-center border-b border-line bg-subtle/40 px-4">
              <span className="eyebrow">Key</span>
              <span className="eyebrow">Value</span>
              <span className="eyebrow">Scope</span>
              <span className="eyebrow">Storage</span>
            </div>
            {filteredVars.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-7 text-center">
                <Lock className="mb-2 h-4 w-4 text-ink3" strokeWidth={1.8} />
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
                    setValue(item.secret ? "" : item.value);
                    set({ varFocus: item.key });
                  }}
                  className={cx(
                    "motion grid h-[34px] w-full grid-cols-[1.2fr_1.3fr_92px_84px] items-center border-b border-line-subtle px-4 text-left text-[12px] hover:bg-subtle/60",
                    varFocus === item.key ? "bg-accent-soft text-ink" : "text-ink2",
                  )}
                >
                  <span title={item.key} className="truncate pr-2 mono font-medium text-ink">
                    {item.key}
                  </span>
                  <span
                    title={item.secret ? "Stored in OS keychain" : item.value || undefined}
                    className="truncate pr-2 mono text-[11.5px]"
                  >
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
                        "rounded border px-1.5 py-[1px] text-[10px] font-semibold",
                        item.secret
                          ? "border-violet/25 bg-violet-soft text-violet"
                          : "border-line bg-subtle text-ink2",
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
          <form onSubmit={commit} className="space-y-3 border-t border-line bg-chrome p-4">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="base_url"
                spellCheck={false}
                className="h-[32px] w-[170px] rounded-md border border-line-strong bg-canvas px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-accent"
              />
              <span className="mono text-ink3">=</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={secret ? "Enter secret (stored only in OS keychain)" : "Variable value"}
                type={secret ? "password" : "text"}
                spellCheck={false}
                className="h-[32px] min-w-[180px] flex-1 rounded-md border border-line-strong bg-canvas px-2.5 mono text-[12px] text-ink placeholder:text-ink3 focus:border-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="motion inline-flex h-[28px] items-center gap-2 rounded-md border border-line bg-canvas px-2.5 text-[12px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
                  >
                    <span className="text-ink3">Scope:</span>
                    <span className="mono">{scope}</span>
                    <ChevronDown className="h-3 w-3 text-ink3" strokeWidth={2} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="start" sideOffset={6} className="popover-surface floating-pop z-50 min-w-[160px] rounded-lg p-1">
                    {["global", ...environments.filter((e) => e !== "global")].map((name) => (
                      <DropdownMenu.Item
                        key={name}
                        onSelect={() => setScope(name)}
                        className={cx(
                          "motion flex cursor-default items-center justify-between rounded-md px-2 py-1.5 mono text-[12px] outline-none data-[highlighted]:bg-subtle",
                          scope === name ? "font-semibold text-ink" : "text-ink2",
                        )}
                      >
                        <span>{name}</span>
                        {scope === name && <Check className="h-3.5 w-3.5 text-accent-text" strokeWidth={2.2} />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button
                type="button"
                onClick={() => setSecret((v) => !v)}
                className={cx(
                  "motion inline-flex h-[28px] items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium",
                  secret
                    ? "border-violet/40 bg-violet-soft text-violet"
                    : "border-line bg-canvas text-ink2 hover:border-line-strong hover:text-ink",
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
              Secret values are stored exclusively in the OS keychain. <span className="mono text-ink2">envs.yaml</span> commits
              only the key name and <span className="mono text-ink2">secret: true</span>.
            </p>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
