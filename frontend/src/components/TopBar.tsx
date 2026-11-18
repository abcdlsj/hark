import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Window } from "@wailsio/runtime";
import {
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
import { api } from "../lib/bridge";
import { isMac } from "../lib/format";
import { useStore } from "../store";
import { cx, EnvCapsule, IconButton, Kbd, Tip } from "./Primitives";
import { Spinner } from "./VisualStates";

export function TopBar() {
  const {
    workspace,
    root,
    env,
    environments,
    vars,
    platform,
    sidebarOpen,
    agentIds,
    switchingEnv,
    editor,
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
  } = useStore();

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
    return "bg-cobalt";
  };

  return (
    <header
      className={cx(
        "drag-region flex h-[44px] shrink-0 items-center justify-between gap-3 pr-3",
        mac ? "pl-[78px]" : "pl-3",
      )}
    >
      {/* Left: Sidebar toggle, Brand + Workspace Switcher, Quick Actions */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Tip label={sidebarOpen ? "Collapse sidebar (⌘B)" : "Expand sidebar (⌘B)"}>
          <IconButton
            onClick={() => set({ sidebarOpen: !sidebarOpen })}
            className={cx("relative", sidebarOpen ? "text-ink" : "text-ink2 hover:text-ink")}
          >
            <SidebarGlyph open={sidebarOpen} />
            {!sidebarOpen && agentIds.length > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet" />
            )}
          </IconButton>
        </Tip>

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
              className="motion flex h-[30px] min-w-0 max-w-[240px] shrink items-center gap-2 rounded-[9px] border border-transparent px-2 hover:border-line hover:bg-surface"
            >
              <BrandMark />
              <span className="truncate text-[13px] font-semibold tracking-[-0.015em] text-ink">
                {workspace || "workspace"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink3" strokeWidth={2} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="start" sideOffset={6} className="floating-surface floating-pop z-50 w-[330px] rounded-[12px] p-1.5">
              <div className="px-2.5 py-1.5">
                <div className="eyebrow">Active Workspace</div>
                <div className="mt-1 break-all mono text-[11px] leading-relaxed text-ink2">{root || "—"}</div>
              </div>

              <DropdownMenu.Separator className="my-1 h-px bg-line" />

              <DropdownMenu.Item
                onSelect={() => void switchWorkspace()}
                className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium text-ink outline-none data-[highlighted]:bg-muted"
              >
                <FolderOpen className="h-3.5 w-3.5 text-ink2" strokeWidth={1.8} />
                <span>Open workspace folder…</span>
              </DropdownMenu.Item>

              <div className="px-1.5 py-1.5" onKeyDown={(e) => e.stopPropagation()}>
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
                    className="h-[28px] min-w-0 flex-1 rounded-[7px] border border-line bg-subtle px-2 mono text-[11px] text-ink placeholder:text-ink3 focus:border-cobalt/50"
                  />
                  <button
                    type="submit"
                    className="motion h-[28px] rounded-[7px] border border-line bg-surface px-2 text-[11px] font-medium text-ink2 hover:border-line-strong hover:text-ink"
                  >
                    Open
                  </button>
                </form>
              </div>

              {recents.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Label className="eyebrow px-2.5 py-1">Recent</DropdownMenu.Label>
                  {recents.map((path) => (
                    <DropdownMenu.Item
                      key={path}
                      onSelect={() => void switchWorkspace(path)}
                      className="motion cursor-default truncate rounded-[8px] px-2.5 py-1.5 mono text-[11px] text-ink2 outline-none data-[highlighted]:bg-muted data-[highlighted]:text-ink"
                    >
                      {path}
                    </DropdownMenu.Item>
                  ))}
                </>
              )}

              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => void pruneHistory(500)}
                className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[11.5px] text-ink2 outline-none data-[highlighted]:bg-muted data-[highlighted]:text-ink"
              >
                <History className="h-3.5 w-3.5 text-ink3" strokeWidth={1.8} />
                <span>Trim history to 500 runs</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {!sidebarOpen && (
          <Tip label="New request (⌘N)">
            <IconButton onClick={newDraft}>
              <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
            </IconButton>
          </Tip>
        )}

        {editor && (
          <Tip label="Workspace overview">
            <IconButton onClick={closeEditor}>
              <LayoutGrid className="h-[14px] w-[14px]" strokeWidth={1.85} />
            </IconButton>
          </Tip>
        )}
      </div>

      {/* Center: Command Palette Search Pill */}
      <button
        type="button"
        onClick={() => set({ paletteOpen: true })}
        className="motion flex h-[30px] min-w-[120px] max-w-[360px] flex-1 items-center gap-2 rounded-full border border-line bg-surface/90 px-3 text-[12px] text-ink3 shadow-2xs hover:border-line-strong hover:bg-surface hover:text-ink2"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
        <span className="truncate">Search endpoints or commands…</span>
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>

      {/* Right: Environment capsule, Variables vault, Refresh, Theme */}
      <div className="flex shrink-0 items-center gap-1.5">
        <DropdownMenu.Root open={envMenuOpen} onOpenChange={(open) => set({ envMenuOpen: open })}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              title="Switch environment (⌘E)"
              disabled={switchingEnv}
              className="motion inline-flex items-center gap-1 rounded-full hover:brightness-95"
            >
              {switchingEnv ? (
                <span className="inline-flex h-[28px] items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[11px] font-medium text-ink2">
                  <Spinner className="h-3 w-3 text-cobalt" />
                  <span className="mono">{env || "default"}</span>
                </span>
              ) : (
                <EnvCapsule env={env} size="sm" interactive />
              )}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={6} className="floating-surface floating-pop z-50 min-w-[210px] rounded-[12px] p-1.5">
              <DropdownMenu.Label className="eyebrow px-2.5 py-1">Environment</DropdownMenu.Label>
              {environments.length === 0 && (
                <div className="px-2.5 py-1.5 text-[11.5px] text-ink3">Default workspace scope</div>
              )}
              {environments.map((name) => (
                <DropdownMenu.Item
                  key={name}
                  onSelect={() => void switchEnv(name)}
                  className={cx(
                    "motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] outline-none data-[highlighted]:bg-muted",
                    name === env ? "font-semibold text-ink" : "text-ink2",
                  )}
                >
                  <span className={cx("h-2 w-2 rounded-full", envDot(name))} />
                  <span className="mono flex-1">{name}</span>
                  {name === env && <span className="text-[10px] font-semibold uppercase tracking-wider text-cobalt">Active</span>}
                </DropdownMenu.Item>
              ))}
              <DropdownMenu.Separator className="my-1 h-px bg-line" />
              <DropdownMenu.Item
                onSelect={() => openVars()}
                className="motion flex cursor-default items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-[12px] text-ink2 outline-none data-[highlighted]:bg-muted data-[highlighted]:text-ink"
              >
                <KeyRound className="h-3.5 w-3.5 text-ink3" strokeWidth={1.8} />
                <span>Manage variables & keychain…</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <span className="mx-0.5 h-3.5 w-px bg-line" />

        <Tip label="Variables & OS Keychain">
          <button
            type="button"
            onClick={() => openVars()}
            className="motion inline-flex h-[28px] items-center gap-1.5 rounded-[8px] border border-transparent px-2 text-[11.5px] font-medium text-ink2 hover:border-line hover:bg-surface hover:text-ink"
          >
            <KeyRound className="h-[14px] w-[14px]" strokeWidth={1.85} />
            <span className="mono text-[10.5px] text-ink3">{vars.length}</span>
          </button>
        </Tip>

        <Tip label="Reload workspace from disk">
          <IconButton onClick={() => void handleReload()}>
            <RefreshCw className={cx("h-[14px] w-[14px]", reloading && "animate-spin")} strokeWidth={1.85} />
          </IconButton>
        </Tip>

        <Tip label={theme === "dark" ? "Switch to Porcelain Light" : "Switch to Velvet Obsidian Dark"}>
          <IconButton onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-[14.5px] w-[14.5px]" strokeWidth={1.85} />
            ) : (
              <Moon className="h-[14.5px] w-[14.5px]" strokeWidth={1.85} />
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

function SidebarGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {open && (
        <path
          d="M5 3h4v18H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="none"
        />
      )}
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      {open ? <path d="m16 15-3-3 3-3" /> : <path d="m14 9 3 3-3 3" />}
    </svg>
  );
}

function BrandMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0">
      <rect x="2" y="2" width="16" height="16" rx="5" fill="url(#apicGrad)" />
      <path
        d="M6.5 13.5L10 6.2L13.5 13.5M7.8 11.2H12.2"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="apicGrad" x1="2" y1="2" x2="18" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
    </svg>
  );
}
