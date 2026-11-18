import { create } from "zustand";
import { api, onEvent } from "./lib/bridge";
import { emptyApi } from "./lib/types";
import type { Api, Bootstrap, Log, ListItem, RunView, VarItem } from "./lib/types";

export type Tab = "params" | "headers" | "body" | "auth";
export type ResponseView = "pretty" | "raw" | "headers";
export type Toast = { id: number; text: string; action?: { label: string; run: () => void } };

interface State {
  booted: boolean;
  error: string | null;
  platform: string;
  workspace: string;
  root: string;
  env: string;
  environments: string[];
  vars: VarItem[];
  apis: ListItem[];
  history: Log[];

  editor: Api | null;
  dirty: boolean;
  selectedId: string | null;

  run: RunView | null;
  running: boolean;

  snapshot: Log | null;
  agentIds: string[];

  palette: boolean;
  envMenu: boolean;
  varsOpen: boolean;
  varFocus: string | null;
  sidebar: boolean;
  layout: "split" | "stack";
  theme: "dark" | "light";
  tab: Tab;
  responseView: ResponseView;
  toast: Toast | null;

  boot: () => Promise<void>;
  apply: (b: Bootstrap) => void;
  select: (id: string) => Promise<void>;
  newDraft: () => void;
  patch: (fn: (api: Api) => Api) => void;
  save: (autoVar?: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  send: () => Promise<void>;
  cancel: () => Promise<void>;
  switchEnv: (name: string) => Promise<void>;
  refreshVars: () => Promise<void>;
  openVars: (key?: string) => void;
  setVar: (scope: string, key: string, value: string, secret: boolean) => Promise<void>;
  openSnapshot: (id: number) => Promise<void>;
  closeSnapshot: () => void;
  applySnapshot: () => void;
  markSeen: (id: string) => void;
  set: (patch: Partial<State>) => void;
  notify: (text: string, action?: Toast["action"]) => void;
  dismissToast: () => void;
  copyCurl: (resolve: boolean) => Promise<void>;
  pasteCurl: (raw: string) => Promise<void>;
  openWorkspace: (path?: string) => Promise<void>;
  toggleTheme: () => void;
}

const stored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`apic:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const persist = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(`apic:${key}`, JSON.stringify(value));
  } catch {
    /* storage may be unavailable; state stays in memory */
  }
};

let toastSeq = 1;

export const useStore = create<State>((set, get) => ({
  booted: false,
  error: null,
  platform: "darwin",
  workspace: "",
  root: "",
  env: "",
  environments: [],
  vars: [],
  apis: [],
  history: [],

  editor: null,
  dirty: false,
  selectedId: null,

  run: null,
  running: false,

  snapshot: null,
  agentIds: [],

  palette: false,
  envMenu: false,
  varsOpen: false,
  varFocus: null,
  sidebar: stored("sidebar", true),
  layout: stored<"split" | "stack">("layout", "split"),
  theme: stored<"dark" | "light">("theme", "dark"),
  tab: "params",
  responseView: "pretty",
  toast: null,

  boot: async () => {
    try {
      const b = await api.bootstrap();
      get().apply(b);
      set({ booted: true });
      // Agent activity arrives as events; the tree and pulse stay live.
      onEvent("api:saved", (data) => {
        const actor = String(data.actor ?? "");
        const changed = data.api as Api | undefined;
        void api.list().then((apis) => {
          const unseen = new Set(get().agentIds);
          if (actor === "agent" && changed?.id && changed.id !== get().selectedId) {
            unseen.add(changed.id);
          }
          set({ apis, agentIds: [...unseen] });
        });
      });
      onEvent("api:deleted", () => {
        void api.list().then((apis) => set({ apis }));
      });
      onEvent("run:completed", () => {
        void api.history(40).then((history) => set({ history }));
        void api.list().then((apis) => set({ apis }));
      });
      onEvent("env:changed", () => {
        void get().refreshVars();
      });
      onEvent("workspace:changed", () => {
        void api.reload().then((next) => get().apply(next));
      });
    } catch (err) {
      set({ error: String(err), booted: true });
    }
  },

  apply: (b) => {
    const current = get();
    const editorStillSaved = b.apis.some((a) => a.id === current.selectedId);
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
      editor: editorStillSaved || !current.editor ? current.editor : null,
      selectedId: editorStillSaved ? current.selectedId : null,
      dirty: editorStillSaved ? current.dirty : false,
    });
  },

  select: async (id) => {
    if (id === get().selectedId) {
      get().markSeen(id);
      return;
    }
    try {
      const doc = await api.get(id);
      set({ editor: doc, selectedId: id, dirty: false, run: null, snapshot: null, tab: "params" });
      get().markSeen(id);
    } catch (err) {
      get().notify(String(err));
    }
  },

  newDraft: () => {
    set({ editor: emptyApi(""), selectedId: null, dirty: true, run: null, snapshot: null, tab: "params" });
  },

  patch: (fn) => {
    const editor = get().editor;
    if (!editor) return;
    set({ editor: fn(editor), dirty: true });
  },

  save: async (autoVar = true) => {
    const editor = get().editor;
    if (!editor) return;
    const id = editor.id.trim();
    if (!id) {
      get().notify("Give the API an id first, for example orders/refund");
      return;
    }
    try {
      const out = await api.save({ ...editor, id }, autoVar);
      set({ dirty: false, selectedId: out.id });
      const [doc, apis] = await Promise.all([api.get(out.id), api.list()]);
      set({ editor: doc, apis });
      get().markSeen(out.id);
      if (out.new_token) {
        get().notify("Plaintext token found", {
          label: "Store in keychain as api_key",
          run: () => {
            void get()
              .setVar("global", "api_key", out.new_token!, true)
              .then(() => get().notify("Secret stored in the OS keychain"));
          },
        });
      } else if (out.replaced?.length) {
        get().notify(`Saved · auto-var ${out.replaced.map((k) => `{{${k}}}`).join(", ")}`);
      }
    } catch (err) {
      get().notify(String(err));
    }
  },

  remove: async (id) => {
    try {
      await api.remove(id);
      const apis = await api.list();
      const isCurrent = get().selectedId === id;
      set({ apis, editor: isCurrent ? null : get().editor, selectedId: isCurrent ? null : get().selectedId });
    } catch (err) {
      get().notify(String(err));
    }
  },

  send: async () => {
    const editor = get().editor;
    if (!editor || get().running) return;
    set({ running: true, snapshot: null });
    try {
      const view = await api.run({ api: editor, env: get().env, actor: "human" });
      set({ run: view, running: false, responseView: "pretty" });
      const [history, apis] = await Promise.all([api.history(40), api.list()]);
      set({ history, apis });
    } catch (err) {
      const text = String(err);
      set({ running: false });
      if (!text.toLowerCase().includes("cancel")) get().notify(text);
    }
  },

  cancel: async () => {
    await api.cancel();
    set({ running: false });
  },

  switchEnv: async (name) => {
    try {
      await api.setEnv(name);
      const [b, vars] = await Promise.all([api.reload(), api.vars("")]);
      set({ env: b.env, environments: b.environments ?? [], vars });
    } catch (err) {
      get().notify(String(err));
    }
  },

  refreshVars: async () => {
    try {
      const [b, vars] = await Promise.all([api.reload(), api.vars("")]);
      set({ env: b.env, environments: b.environments ?? [], vars, apis: b.apis ?? [] });
    } catch (err) {
      get().notify(String(err));
    }
  },

  openVars: (key) => set({ varsOpen: true, varFocus: key ?? null }),

  setVar: async (scope, key, value, secret) => {
    try {
      await api.setVar(scope, key, value, secret);
      const vars = await api.vars("");
      set({ vars });
      get().notify(`Set ${key}`);
    } catch (err) {
      get().notify(String(err));
    }
  },

  openSnapshot: async (id) => {
    try {
      const log = await api.log(id);
      set({ snapshot: log, run: null });
    } catch (err) {
      get().notify(String(err));
    }
  },

  closeSnapshot: () => set({ snapshot: null }),

  applySnapshot: () => {
    const log = get().snapshot;
    const editor = get().editor;
    if (!log || !editor) return;
    // Only the parameter shape is copied; the URL is what the agent actually
    // hit, so the current definition keeps its placeholders.
    set({
      editor: { ...editor, url: log.url, method: log.method },
      dirty: true,
      snapshot: null,
    });
  },

  markSeen: (id) => set({ agentIds: get().agentIds.filter((x) => x !== id) }),

  set: (patchState) => set(patchState),

  notify: (text, action) => set({ toast: { id: toastSeq++, text, action } }),

  dismissToast: () => set({ toast: null }),

  copyCurl: async (resolve) => {
    const editor = get().editor;
    if (!editor) return;
    try {
      const curl = await api.exportCurl(editor, resolve);
      await navigator.clipboard.writeText(curl);
      get().notify(resolve ? "Copied cURL with real values" : "Copied cURL");
    } catch (err) {
      get().notify(String(err));
    }
  },

  pasteCurl: async (raw) => {
    try {
      const parsed = await api.parseCurl(raw);
      const current = get().editor;
      const doc: Api = {
        ...parsed.api,
        id: current?.id ?? "",
        name: current?.name ?? parsed.api.name,
        meta: current?.meta ?? {},
      };
      set({ editor: doc, dirty: true, snapshot: null, tab: "body" });
      if (parsed.new_token) {
        get().notify("Parsed cURL · plaintext token detected", {
          label: "Store in keychain as api_key",
          run: () => {
            void get()
              .setVar("global", "api_key", parsed.new_token!, true)
              .then(() => get().notify("Secret stored in the OS keychain"));
          },
        });
      } else {
        get().notify("Parsed cURL");
      }
    } catch (err) {
      get().notify(String(err));
    }
  },

  openWorkspace: async (path) => {
    try {
      const b = path ? await api.useWorkspace(path) : await api.pickWorkspace();
      if (!b?.root) return;
      set({ editor: null, selectedId: null, dirty: false, run: null, snapshot: null });
      get().apply(b);
    } catch (err) {
      get().notify(String(err));
    }
  },

  toggleTheme: () => {
    const theme = get().theme === "dark" ? "light" : "dark";
    persist("theme", theme);
    set({ theme });
  },
}));

// Persist the quiet preferences so the next launch feels the same.
useStore.subscribe((state, prev) => {
  if (state.sidebar !== prev.sidebar) persist("sidebar", state.sidebar);
  if (state.layout !== prev.layout) persist("layout", state.layout);
});
