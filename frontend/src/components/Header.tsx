import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Window } from "@wailsio/runtime";
import { useEffect, useState } from "react";
import { api } from "../lib/bridge";
import { isMac } from "../lib/format";
import { useStore } from "../store";
import { cx, Tip } from "./ui";

/** Frameless 38px header: workspace on the left, environment and ⌘K on the right. */
export function Header() {
  const { workspace, root, env, environments, platform, switchEnv, openWorkspace, set, toggleTheme, theme } =
    useStore();
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (isMac(platform)) return;
    document.documentElement.classList.add("non-mac");
  }, [platform]);

  const envTone = (name: string): string => {
    if (/prod|production|live/i.test(name)) return "bg-put";
    if (/stag|stage|dev/i.test(name)) return "bg-var";
    return "bg-ink3";
  };

  return (
    <header className="flex h-[38px] shrink-0 items-center justify-between border-b border-line bg-canvas pl-[76px] pr-3">
      <DropdownMenu.Root
        onOpenChange={(open) => {
          if (open) void api.recents().then((list) => setRecents(list ?? []));
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="motion -ml-1 flex h-6 max-w-[360px] items-center gap-1.5 rounded-[5px] px-1.5 text-[12px] text-ink2 hover:bg-elevated hover:text-ink"
            title={root}
          >
            <span className="truncate">
              <span className="text-ink">apic</span>
              <span className="text-ink3"> / </span>
              {workspace || "workspace"}
            </span>
            <span className="text-[9px] text-ink3">▾</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className="overlay z-50 min-w-[300px] rounded-[8px] p-1">
            <DropdownMenu.Label className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-ink3">
              Workspace
            </DropdownMenu.Label>
            <div className="px-2 pb-1.5 text-[11px] text-ink2 mono break-all">{root}</div>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => void openWorkspace()}
              className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[12px] text-ink outline-none data-[highlighted]:bg-elevated"
            >
              Open another workspace…
            </DropdownMenu.Item>
            {recents.length > 0 && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Label className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-ink3">
                  Recent
                </DropdownMenu.Label>
                {recents.map((path) => (
                  <DropdownMenu.Item
                    key={path}
                    onSelect={() => void openWorkspace(path)}
                    className="motion cursor-default truncate rounded-[4px] px-2 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-ink"
                  >
                    {path}
                  </DropdownMenu.Item>
                ))}
              </>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => void api.prune(500)}
              className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-ink"
            >
              Trim history to 500 runs
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={toggleTheme}
              className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-ink"
            >
              {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div className="flex items-center gap-1.5">
        <DropdownMenu.Root open={useStore((s) => s.envMenu)} onOpenChange={(open) => set({ envMenu: open })}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="motion flex h-6 items-center gap-1.5 rounded-[5px] border border-line px-2 text-[11.5px] text-ink2 hover:border-line-strong hover:text-ink"
              title="Switch environment (⌘E)"
            >
              <span className={cx("h-1.5 w-1.5 rounded-full", envTone(env))} />
              <span className="mono text-[11.5px]">{env || "default"}</span>
              <span className="text-[9px] text-ink3">▾</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="overlay z-50 min-w-[190px] rounded-[8px] p-1">
              <DropdownMenu.Label className="px-2 py-1 text-[10.5px] uppercase tracking-wide text-ink3">
                Environment
              </DropdownMenu.Label>
              {environments.map((name) => (
                <DropdownMenu.Item
                  key={name}
                  onSelect={() => void switchEnv(name)}
                  className={cx(
                    "motion flex cursor-default items-center gap-2 rounded-[4px] px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-elevated",
                    name === env ? "text-ink" : "text-ink2",
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 rounded-full", envTone(name))} />
                  <span className="mono flex-1">{name}</span>
                  {name === env && <span className="text-[10px] text-ink3">current</span>}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => set({ varsOpen: true, varFocus: null })}
                className="motion cursor-default rounded-[4px] px-2 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-elevated data-[highlighted]:text-ink"
              >
                Manage variables…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Tip label="Command palette" side="bottom">
          <button
            type="button"
            onClick={() => set({ palette: true })}
            className="motion flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 text-[11px] text-ink2 hover:border-line-strong hover:text-ink"
          >
            <span className="mono">⌘K</span>
          </button>
        </Tip>

        {!isMac(platform) && (
          <div className="ml-1 flex items-center gap-2 pl-2">
            <button
              type="button"
              className="motion h-3 w-3 rounded-full border border-line-strong text-ink2 hover:bg-elevated"
              title="Minimise"
              onClick={() => void Window.Minimise()}
            />
            <button
              type="button"
              className="motion h-3 w-3 rounded-full border border-line-strong text-ink2 hover:bg-elevated"
              title="Maximise"
              onClick={() => void Window.ToggleMaximise()}
            />
            <button
              type="button"
              className="motion h-3 w-3 rounded-full border border-line-strong text-ink2 hover:bg-elevated"
              title="Close"
              onClick={() => void Window.Close()}
            />
          </div>
        )}
      </div>
    </header>
  );
}
