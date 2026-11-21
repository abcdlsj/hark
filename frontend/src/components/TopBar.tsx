import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Window } from "@wailsio/runtime";
import {
  Check,
  ChevronDown,
  FolderOpen,
  History,
  KeyRound,
  LayoutGrid,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
} from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { api } from "../lib/bridge";
import { isMac, workspaceLabel } from "../lib/format";
import { useStore } from "../store";
import { cx, EnvCapsule, IconButton, Kbd, Tip } from "./Primitives";

export function TopBar() {
  const {
    workspace,
    root,
    env,
    environments,
    varsCount,
    platform,
    sidebarOpen,
    switchingEnv,
    hasEditor,
    theme,
    envMenuOpen,
    newDraft,
    switchEnv,
    switchWorkspace,
    reloadWorkspace,
    pruneHistory,
    closeEditor,
    openVars,
    toggleTheme,
    set,
  } = useStore(
    useShallow((s) => ({
      workspace: s.workspace,
      root: s.root,
      env: s.env,
      environments: s.environments,
      varsCount: s.vars.length,
      platform: s.platform,
      sidebarOpen: s.sidebarOpen,
      switchingEnv: s.switchingEnv,
      hasEditor: Boolean(s.editor),
      theme: s.theme,
      envMenuOpen: s.envMenuOpen,
      newDraft: s.newDraft,
      switchEnv: s.switchEnv,
      switchWorkspace: s.switchWorkspace,
      reloadWorkspace: s.reloadWorkspace,
      pruneHistory: s.pruneHistory,
      closeEditor: s.closeEditor,
      openVars: s.openVars,
      toggleTheme: s.toggleTheme,
      set: s.set,
    })),
  );

  const [recents, setRecents] = useState<string[]>([]);
  const [customPath, setCustomPath] = useState("");
  const [reloading, setReloading] = useState(false);

  const mac = isMac(platform);

  const handleReload = async () => {
    setReloading(true);
    await reloadWorkspace();
    window.setTimeout(() => setReloading(false), 320);
  };

  const envDot = (name: string) => {
    if (/prod|production|live/i.test(name)) return "bg-amber";
    if (/stag|stage|dev|test/i.test(name)) return "bg-emerald";
    return "bg-accent";
  };

  return (
    <header
      className={cx(
        "drag-region flex h-[41px] shrink-0 items-center justify-between gap-3 border-b border-line bg-chrome pr-2.5",
        mac ? "pl-[84px]" : "pl-2.5",
      )}
    >
      {/* Left: Brand + Workspace Switcher + Overview/New */}
      <div className="flex min-w-0 items-center gap-1">
        {mac && <span className="mr-1 h-3.5 w-px shrink-0 bg-line" />}
        <DropdownMenu.Root
          onOpenChange={(open) => {
            if (open) {
              setCustomPath("");
              void api.recents().then((list) => setRecents(list ?? []));
            }
          }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              title={root}
              className="motion flex h-[28px] min-w-0 max-w-[230px] shrink items-center gap-2 rounded-md border border-transparent px-1.5 hover:border-line hover:bg-canvas"
            >
              <BrandMark />
              <span className="truncate text-[12.5px] font-semibold tracking-[-0.01em] text-ink">
                {workspaceLabel(workspace)}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-ink3" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className="popover-surface floating-pop z-50 w-[330px] rounded-lg p-1.5">
              <div className="px-2 py-1.5">
                <div className="eyebrow">Active Workspace</div>
                <div className="mt-1 break-all mono text-[11px] leading-relaxed text-ink2">{root || "—"}</div>
              </div>

              <DropdownMenu.Separator className="my-1 h-px bg-line" />

              <DropdownMenu.Item
                onSelect={() => void switchWorkspace()}
                className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-medium text-ink outline-none data-[highlighted]:bg-subtle"
              >
                <FolderOpen className="h-3.5 w-3.5 text-ink2" strokeWidth={1.8} />
                <span>Open workspace folder…</span>
              </DropdownMenu.Item>

              <div className="px-1 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!customPath.trim()) return;
                    void switchWorkspace(customPath.trim());
                  }}
                  className="flex items-center gap-1"
                >
                  <input
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="Switch to path…"
                    spellCheck={false}
                    className="h-[28px] min-w-0 flex-1 rounded-md border border-line bg-subtle px-2 mono text-[11px] text-ink placeholder:text-ink3 focus:border-accent focus:bg-canvas"
                  />
                  <button
                    type="submit"
                    className="motion h-[28px] rounded-md border border-line bg-canvas px-2 text-[11px] font-medium text-ink hover:border-line-strong hover:bg-subtle"
                  >
                    Open
                  </button>
                </form>
              </div>

              {recents.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Label className="eyebrow px-2 py-1">Recent</DropdownMenu.Label>
                  {recents.map((path) => (
                    <DropdownMenu.Item
                      key={path}
                      title={path}
                      onSelect={() => void switchWorkspace(path)}
                      className="motion cursor-default truncate rounded-md px-2 py-1.5 mono text-[11px] text-ink2 outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink"
                    >
                      {path}
                    </DropdownMenu.Item>
                  ))}
                </>
              )}

              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => void pruneHistory(500)}
                className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink"
              >
                <History className="h-3.5 w-3.5 text-ink3" strokeWidth={1.8} />
                <span>Trim history to 500 runs</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {hasEditor && (
          <Tip label="Workspace overview">
            <IconButton onClick={closeEditor}>
              <LayoutGrid className="h-[14px] w-[14px]" strokeWidth={1.85} />
            </IconButton>
          </Tip>
        )}

        {!sidebarOpen && (
          <Tip label="New request (⌘N)">
            <IconButton onClick={newDraft}>
              <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
            </IconButton>
          </Tip>
        )}
      </div>

      {/* Center: Spotlight Search Bar (Hoppscotch-style architectural input trigger) */}
      <button
        type="button"
        onClick={() => set({ paletteOpen: true })}
        className="motion flex h-[28px] min-w-[140px] max-w-[340px] flex-1 items-center gap-2 rounded-md border border-line bg-subtle/80 px-2.5 text-[12px] text-ink3 hover:border-line-strong hover:bg-canvas hover:text-ink2"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.85} />
        <span className="truncate">Search endpoints or commands…</span>
        <span className="ml-auto inline-flex items-center gap-0.5">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      {/* Right: Environment, Variables, Reload, Theme */}
      <div className="flex shrink-0 items-center gap-1">
        <DropdownMenu.Root open={envMenuOpen} onOpenChange={(open) => set({ envMenuOpen: open })}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              title={`Environment: ${env || "default"} (⌘E)`}
              disabled={switchingEnv}
              className="motion inline-flex items-center rounded-md"
            >
              <EnvCapsule env={env} size="sm" interactive busy={switchingEnv} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="popover-surface floating-pop z-50 min-w-[210px] rounded-lg p-1.5">
              <DropdownMenu.Label className="eyebrow px-2 py-1">Environment</DropdownMenu.Label>
              {environments.length === 0 && (
                <div className="px-2 py-1.5 text-[11.5px] text-ink3">Default workspace scope</div>
              )}
              {environments.map((name) => (
                <DropdownMenu.Item
                  key={name}
                  onSelect={() => void switchEnv(name)}
                  className={cx(
                    "motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] outline-none data-[highlighted]:bg-subtle",
                    name === env ? "font-semibold text-ink" : "text-ink2",
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 rounded-full", envDot(name))} />
                  <span className="mono flex-1">{name}</span>
                  {name === env && <Check className="h-3.5 w-3.5 text-accent-text" strokeWidth={2.2} />}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => openVars()}
                className="motion flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-subtle data-[highlighted]:text-ink"
              >
                <KeyRound className="h-3.5 w-3.5 text-ink3" strokeWidth={1.8} />
                <span>Manage variables & keychain…</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <Tip label="Variables & OS Keychain">
          <button
            type="button"
            onClick={() => openVars()}
            className="motion inline-flex h-[28px] items-center gap-1.5 rounded-md border border-transparent px-2 text-[11.5px] font-medium text-ink2 hover:border-line hover:bg-canvas hover:text-ink"
          >
            <KeyRound className="h-[13.5px] w-[13.5px]" strokeWidth={1.85} />
            <span className="mono text-[11px] text-ink3">{varsCount}</span>
          </button>
        </Tip>

        <span className="mx-0.5 h-3.5 w-px bg-line" />

        <Tip label="Reload workspace from disk">
          <IconButton onClick={() => void handleReload()}>
            <RefreshCw className={cx("h-[13.5px] w-[13.5px]", reloading && "animate-spin")} strokeWidth={1.85} />
          </IconButton>
        </Tip>

        <Tip label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
          <IconButton onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-[14px] w-[14px]" strokeWidth={1.85} />
            ) : (
              <Moon className="h-[14px] w-[14px]" strokeWidth={1.85} />
            )}
          </IconButton>
        </Tip>

        {!mac && (
          <div className="ml-1 flex items-center gap-1.5 border-l border-line pl-2">
            <button
              type="button"
              onClick={() => void Window.Minimise()}
              title="Minimise"
              className="motion h-3 w-3 rounded-full bg-amber/80 hover:bg-amber"
            />
            <button
              type="button"
              onClick={() => void Window.ToggleMaximise()}
              title="Maximise"
              className="motion h-3 w-3 rounded-full bg-emerald/80 hover:bg-emerald"
            />
            <button
              type="button"
              onClick={() => void Window.Close()}
              title="Close"
              className="motion h-3 w-3 rounded-full bg-rose/80 hover:bg-rose"
            />
          </div>
        )}
      </div>
    </header>
  );
}

/** Same mark as the app icon: three phi-stepped level bars on the obsidian plate. */
function BrandMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 1024 1024"
      fill="none"
      className="shrink-0 rounded-[5px] ring-1 ring-line-strong"
      aria-hidden="true"
    >
      <rect x="64" y="64" width="896" height="896" rx="220" fill="#141416" />
      <g transform="translate(512 512) rotate(-8)">
        <rect x="-246" y="-198.4" width="128" height="396.8" rx="38.4" fill="#FAF9F6" />
        <rect x="-64" y="-320" width="128" height="640" rx="38.4" fill="#FAF9F6" />
        <rect x="118" y="-249.6" width="128" height="499.2" rx="38.4" fill="#FAF9F6" />
      </g>
    </svg>
  );
}
