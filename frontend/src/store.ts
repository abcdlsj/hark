import { create } from "zustand";
import { api, onEvent } from "./lib/bridge";
import { emptyApi } from "./lib/types";
import type { Api, Bootstrap, ListItem, Log, RunView, VarItem } from "./lib/types";

export type SidebarTab = "endpoints" | "activity";
export type ComposerTab = "params" | "headers" | "body" | "auth";
export type InspectorTab = "pretty" | "raw" | "headers" | "timing";
export type ToastTone = "neutral" | "success" | "warn" | "error";

export interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  action?: { label: string; run: () => void };
}

const stored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`apic.v2:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const persist = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(`apic.v2:${key}`, JSON.stringify(value));
  } catch {
    /* storage may be unavailable in restricted webviews */
  }
};

interface State {
  booted: boolean;
  bootError: string | null;
  platform: string;
  workspace: string;
  root: string;
  env: string;
  environments: string[];
  vars: VarItem[];
  apis: ListItem[];
  history: Log[];
  lastSyncedAt: number;

  editor: Api | null;
  selectedId: string | null;
  dirty: boolean;
  savePopoverOpen: boolean;

  run: RunView | null;
  running: boolean;
  runStartedAt: number | null;
  saving: boolean;
  savingVar: boolean;
  importingCurl: boolean;
  switchingEnv: boolean;
  loadingApiId: string | null;
  loadingSnapshotId: number | null;
  snapshot: Log | null;
  agentIds: string[];

  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  sidebarQuery: string;
  layout: "split" | "stack";
  splitRatio: number;
  theme: "light" | "dark";
  composerTab: ComposerTab;
  inspectorTab: InspectorTab;

  paletteOpen: boolean;
  envMenuOpen: boolean;
  varsOpen: boolean;
  varFocus: string | null;
  curlModalOpen: boolean;
  toast: ToastItem | null;

  boot: () => Promise<void>;
  reloadWorkspace: () => Promise<void>;
  applyBootstrap: (b: Bootstrap) => void;
  selectApi: (id: string) => Promise<void>;
  closeEditor: () => void;
  newDraft: () => void;
  duplicateApi: (id: string) => Promise<void>;
  patchEditor: (fn: (doc: Api) => Api) => void;
  saveEditor: (overrideId?: string, overrideName?: string) => Promise<boolean>;
  deleteApi: (id: string) => Promise<void>;
  sendRequest: () => Promise<void>;
  cancelRequest: () => Promise<void>;
  switchEnv: (name: string) => Promise<void>;
  refreshVars: () => Promise<void>;
  openVars: (focusKey?: string) => void;
  saveVar: (scope: string, key: string, value: string, secret: boolean) => Promise<void>;
  openSnapshot: (logId: number) => Promise<void>;
  closeSnapshot: () => void;
  applySnapshotToEditor: () => void;
  markSeen: (id: string) => void;
  copyCurl: (resolve: boolean, id?: string) => Promise<void>;
  importCurl: (raw: string) => Promise<boolean>;
  switchWorkspace: (path?: string) => Promise<void>;
  pruneHistory: (keep?: number) => Promise<void>;
  copyGuide: () => Promise<void>;
  toggleTheme: () => void;
  set: (patch: Partial<State>) => void;
  notify: (text: string, tone?: ToastTone, action?: ToastItem["action"]) => void;
  dismissToast: () => void;
}

let toastSeq = 1;

export const useStore = create<State>((set, get) => ({
  booted: false,
  bootError: null,
  platform: "darwin",
  workspace: "",
  root: "",
  env: "",
  environments: [],
  vars: [],
  apis: [],
  history: [],
  lastSyncedAt: Date.now(),

  editor: null,
  selectedId: null,
  dirty: false,
  savePopoverOpen: false,

  run: null,
  running: false,
  runStartedAt: null,
  saving: false,
  savingVar: false,
  importingCurl: false,
  switchingEnv: false,
  loadingApiId: null,
  loadingSnapshotId: null,
  snapshot: null,
  agentIds: [],

  sidebarOpen: stored("sidebar", true),
  sidebarTab: "endpoints",
  sidebarQuery: "",
  layout: stored<"split" | "stack">("layout", "split"),
  splitRatio: stored<number>("split", 0.5),
  theme: stored<"light" | "dark">("theme", "light"),
  composerTab: "params",
  inspectorTab: "pretty",

  paletteOpen: false,
  envMenuOpen: false,
  varsOpen: false,
  varFocus: null,
  curlModalOpen: false,
  toast: null,

  boot: async () => {
    try {
      const b = await api.bootstrap();
      get().applyBootstrap(b);
      set({ booted: true, bootError: null, lastSyncedAt: Date.now() });

      onEvent("api:saved", (data) => {
        const actor = String(data.actor ?? "");
        const changed = data.api as Api | undefined;
        void api.list().then((apis) => {
          const unseen = new Set(get().agentIds);
          if (actor === "agent" && changed?.id && changed.id !== get().selectedId) {
            unseen.add(changed.id);
          }
          set({ apis, agentIds: [...unseen], lastSyncedAt: Date.now() });
        });
      });

      onEvent("api:deleted", () => {
        void api.list().then((apis) => set({ apis, lastSyncedAt: Date.now() }));
      });

      onEvent("run:completed", () => {
        void Promise.all([api.history(40), api.list()]).then(([history, apis]) => {
          set({ history, apis, lastSyncedAt: Date.now() });
        });
      });

      onEvent("env:changed", () => {
        void get().refreshVars();
      });

      onEvent("workspace:changed", () => {
        void get().reloadWorkspace();
      });
    } catch (err) {
      set({ bootError: String(err), booted: true });
    }
  },

  reloadWorkspace: async () => {
    try {
      const b = await api.reload();
      get().applyBootstrap(b);
      set({ bootError: null, lastSyncedAt: Date.now() });
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  applyBootstrap: (b) => {
    const current = get();
    const stillExists = (b.apis ?? []).some((a) => a.id === current.selectedId);
    set({
      platform: b.platform || current.platform,
      workspace: b.workspace,
      root: b.root,
      env: b.env,
      environments: b.environments ?? [],
      vars: b.vars ?? [],
      apis: b.apis ?? [],
      history: b.history ?? [],
      agentIds: current.agentIds.filter((id) => (b.apis ?? []).some((a) => a.id === id)),
      editor: stillExists || !current.editor ? current.editor : null,
      selectedId: stillExists ? current.selectedId : null,
      dirty: stillExists ? current.dirty : false,
      lastSyncedAt: Date.now(),
    });
  },

  selectApi: async (id) => {
    if (id === get().selectedId && get().editor) {
      get().markSeen(id);
      return;
    }
    set({ loadingApiId: id });
    try {
      const doc = await api.get(id);
      set({
        editor: doc,
        selectedId: id,
        dirty: false,
        savePopoverOpen: false,
        run: null,
        snapshot: null,
        loadingApiId: null,
        composerTab: (doc.query?.length ?? 0) > 0 ? "params" : doc.body?.type && doc.body.type !== "none" ? "body" : "params",
      });
      get().markSeen(id);
    } catch (err) {
      set({ loadingApiId: null });
      get().notify(String(err), "error");
    }
  },

  closeEditor: () => {
    set({
      editor: null,
      selectedId: null,
      dirty: false,
      savePopoverOpen: false,
      run: null,
      snapshot: null,
    });
  },

  newDraft: () => {
    set({
      editor: emptyApi(""),
      selectedId: null,
      dirty: true,
      savePopoverOpen: false,
      run: null,
      snapshot: null,
      composerTab: "params",
    });
  },

  duplicateApi: async (id) => {
    try {
      const doc = await api.get(id);
      set({
        editor: {
          ...doc,
          id: `${doc.id}-copy`,
          name: doc.name ? `${doc.name} (Copy)` : `${doc.id} (Copy)`,
          meta: {},
        },
        selectedId: null,
        dirty: true,
        savePopoverOpen: true,
        run: null,
        snapshot: null,
      });
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  patchEditor: (fn) => {
    const current = get().editor;
    if (!current) return;
    set({ editor: fn(current), dirty: true });
  },

  saveEditor: async (overrideId, overrideName) => {
    const current = get().editor;
    if (!current || get().saving) return false;

    const id = (overrideId ?? current.id).trim();
    const name = overrideName !== undefined ? overrideName : current.name;

    if (!id) {
      set({ savePopoverOpen: true });
      return false;
    }

    set({ saving: true });
    try {
      const toSave: Api = { ...current, id, name: name.trim() || id };
      const out = await api.save(toSave, true);
      const [doc, apis, vars] = await Promise.all([api.get(out.id), api.list(), api.vars("")]);
      set({
        editor: doc,
        selectedId: out.id,
        dirty: false,
        saving: false,
        savePopoverOpen: false,
        apis,
        vars,
        lastSyncedAt: Date.now(),
      });
      get().markSeen(out.id);

      if (out.new_token) {
        get().notify("Plaintext bearer token detected", "warn", {
          label: "Store in keychain",
          run: () => {
            void get()
              .saveVar("global", "api_key", out.new_token!, true)
              .then(() => get().notify("Secret saved in OS keychain", "success"));
          },
        });
      } else if (out.replaced?.length) {
        get().notify(`Saved ${out.id} · parameterized ${out.replaced.map((k) => `{{${k}}}`).join(", ")}`, "success");
      } else {
        get().notify(`Saved ${out.id}`, "success");
      }
      return true;
    } catch (err) {
      set({ saving: false });
      get().notify(String(err), "error");
      return false;
    }
  },

  deleteApi: async (id) => {
    try {
      await api.remove(id);
      const apis = await api.list();
      const isCurrent = get().selectedId === id;
      set({
        apis,
        editor: isCurrent ? null : get().editor,
        selectedId: isCurrent ? null : get().selectedId,
        dirty: isCurrent ? false : get().dirty,
        lastSyncedAt: Date.now(),
      });
      get().notify(`Deleted ${id}`, "neutral");
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  sendRequest: async () => {
    const editor = get().editor;
    if (!editor || get().running) return;
    set({ running: true, runStartedAt: Date.now(), snapshot: null });
    try {
      const view = await api.run({ api: editor, env: get().env, actor: "human" });
      set({
        run: view,
        running: false,
        runStartedAt: null,
        inspectorTab: "pretty",
        lastSyncedAt: Date.now(),
      });
      const [history, apis] = await Promise.all([api.history(40), api.list()]);
      set({ history, apis, lastSyncedAt: Date.now() });
    } catch (err) {
      const text = String(err);
      set({ running: false, runStartedAt: null });
      if (!text.toLowerCase().includes("cancel")) {
        get().notify(text, "error");
      }
    }
  },

  cancelRequest: async () => {
    await api.cancel();
    set({ running: false, runStartedAt: null });
  },

  switchEnv: async (name) => {
    set({ switchingEnv: true });
    try {
      await api.setEnv(name);
      const [b, vars] = await Promise.all([api.reload(), api.vars("")]);
      set({
        env: b.env,
        environments: b.environments ?? [],
        vars,
        switchingEnv: false,
        lastSyncedAt: Date.now(),
      });
      get().notify(`Switched environment to ${b.env || name}`, "neutral");
    } catch (err) {
      set({ switchingEnv: false });
      get().notify(String(err), "error");
    }
  },

  refreshVars: async () => {
    try {
      const [b, vars] = await Promise.all([api.reload(), api.vars("")]);
      set({
        env: b.env,
        environments: b.environments ?? [],
        vars,
        apis: b.apis ?? [],
        lastSyncedAt: Date.now(),
      });
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  openVars: (focusKey) => set({ varsOpen: true, varFocus: focusKey ?? null }),

  saveVar: async (scope, key, value, secret) => {
    set({ savingVar: true });
    try {
      await api.setVar(scope, key, value, secret);
      const vars = await api.vars("");
      set({ vars, savingVar: false, lastSyncedAt: Date.now() });
      get().notify(`Saved variable ${key}`, "success");
    } catch (err) {
      set({ savingVar: false });
      get().notify(String(err), "error");
    }
  },

  openSnapshot: async (logId) => {
    set({ loadingSnapshotId: logId });
    try {
      const log = await api.log(logId);
      const currentEditor = get().editor;
      if (!currentEditor) {
        const isSaved = log.api_id && log.api_id !== "_adhoc" && get().apis.some((a) => a.id === log.api_id);
        if (isSaved) {
          const doc = await api.get(log.api_id);
          set({
            editor: doc,
            selectedId: log.api_id,
            dirty: false,
            snapshot: log,
            run: null,
            loadingSnapshotId: null,
          });
          get().markSeen(log.api_id);
          return;
        }
        const draft = emptyApi("");
        draft.method = log.method || "GET";
        draft.url = log.url || "";
        draft.name = log.api_id === "_adhoc" ? "Adhoc Request" : log.api_id;
        set({
          editor: draft,
          selectedId: null,
          dirty: false,
          snapshot: log,
          run: null,
          loadingSnapshotId: null,
        });
        return;
      }
      set({ snapshot: log, run: null, loadingSnapshotId: null });
    } catch (err) {
      set({ loadingSnapshotId: null });
      get().notify(String(err), "error");
    }
  },

  closeSnapshot: () => set({ snapshot: null }),

  applySnapshotToEditor: () => {
    const log = get().snapshot;
    const editor = get().editor;
    if (!log || !editor) return;
    set({
      editor: { ...editor, method: log.method || editor.method, url: log.url || editor.url },
      dirty: true,
      snapshot: null,
    });
    get().notify("Applied snapshot method & URL to editor", "success");
  },

  markSeen: (id) => {
    const current = get().agentIds;
    if (!current.includes(id)) return;
    set({ agentIds: current.filter((x) => x !== id) });
  },

  copyCurl: async (resolve, id) => {
    try {
      const target = id ? await api.get(id) : get().editor;
      if (!target) return;
      const curl = await api.exportCurl(target, resolve);
      await navigator.clipboard.writeText(curl);
      get().notify(resolve ? "Copied cURL with resolved values" : "Copied cURL", "success");
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  importCurl: async (raw) => {
    set({ importingCurl: true });
    try {
      const parsed = await api.parseCurl(raw);
      const current = get().editor;
      const doc: Api = {
        ...parsed.api,
        id: current?.id ?? "",
        name: current?.name || parsed.api.name || "",
        meta: current?.meta ?? {},
      };
      set({
        editor: doc,
        dirty: true,
        snapshot: null,
        importingCurl: false,
        composerTab: doc.body?.type && doc.body.type !== "none" ? "body" : "params",
      });
      if (parsed.new_token) {
        get().notify("Imported cURL · plaintext token detected", "warn", {
          label: "Store in keychain",
          run: () => {
            void get()
              .saveVar("global", "api_key", parsed.new_token!, true)
              .then(() => get().notify("Secret stored in OS keychain", "success"));
          },
        });
      } else {
        get().notify("Imported cURL command", "success");
      }
      return true;
    } catch (err) {
      set({ importingCurl: false });
      get().notify(String(err), "error");
      return false;
    }
  },

  switchWorkspace: async (path) => {
    try {
      const b = path ? await api.useWorkspace(path) : await api.pickWorkspace();
      if (!b?.root) return;
      set({ editor: null, selectedId: null, dirty: false, run: null, snapshot: null, savePopoverOpen: false });
      get().applyBootstrap(b);
      get().notify(`Opened workspace ${b.workspace}`, "success");
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  pruneHistory: async (keep = 500) => {
    try {
      await api.prune(keep);
      const history = await api.history(40);
      set({ history, lastSyncedAt: Date.now() });
      get().notify(`Trimmed history to latest ${keep} runs`, "neutral");
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  copyGuide: async () => {
    try {
      const text = await api.guide();
      await navigator.clipboard.writeText(text);
      get().notify("Copied agent CLI guide", "success");
    } catch (err) {
      get().notify(String(err), "error");
    }
  },

  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    persist("theme", theme);
    set({ theme });
  },

  set: (patch) => set(patch),

  notify: (text, tone = "neutral", action) => set({ toast: { id: toastSeq++, text, tone, action } }),

  dismissToast: () => set({ toast: null }),
}));

useStore.subscribe((state, prev) => {
  if (state.sidebarOpen !== prev.sidebarOpen) persist("sidebar", state.sidebarOpen);
  if (state.layout !== prev.layout) persist("layout", state.layout);
  if (state.splitRatio !== prev.splitRatio) persist("split", state.splitRatio);
});
