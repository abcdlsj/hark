// Single boundary between the React workbench and the Go AppService bindings.
import { Events } from "@wailsio/runtime";
import { AppService } from "../../bindings/github.com/abcdlsj/apic/cmd/desktop";
import type { Api, Bootstrap, Log, ParseOut, RunRequest, RunView, SaveOut, VarItem } from "./types";

export const api = {
  bootstrap: () => AppService.Bootstrap() as Promise<Bootstrap>,
  reload: () => AppService.Reload() as Promise<Bootstrap>,
  list: (prefix = "") => AppService.ListAPIs(prefix),
  get: (id: string) => AppService.GetAPI(id) as Promise<Api>,
  save: (doc: Api, autoVar = true) => AppService.SaveAPI(doc as never, autoVar) as Promise<SaveOut>,
  remove: (id: string) => AppService.DeleteAPI(id),
  run: (req: RunRequest) => AppService.Run(req as never) as Promise<RunView>,
  cancel: () => AppService.CancelRun(),
  exportCurl: (doc: Api, resolve: boolean) => AppService.ExportCurlFor(doc as never, resolve),
  parseCurl: (cmd: string) => AppService.ParseCurl(cmd) as Promise<ParseOut>,
  setEnv: (name: string) => AppService.SetEnv(name),
  vars: (env = "") => AppService.Vars(env) as Promise<VarItem[]>,
  setVar: (scope: string, key: string, value: string, secret: boolean) =>
    AppService.SetVar(scope, key, value, secret),
  history: (limit = 40) => AppService.History(limit) as Promise<Log[]>,
  log: (id: number) => AppService.GetLog(id) as Promise<Log>,
  prune: (keep: number) => AppService.PruneHistory(keep),
  guide: () => AppService.Guide(),
  useWorkspace: (path: string) => AppService.UseWorkspace(path) as Promise<Bootstrap>,
  pickWorkspace: () => AppService.PickWorkspace() as Promise<Bootstrap>,
  recents: () => AppService.RecentWorkspaces(),
};

export type EventName =
  | "api:saved"
  | "api:deleted"
  | "run:completed"
  | "env:changed"
  | "workspace:changed";

const subscribed = new Set<string>();

export const onEvent = (name: EventName, cb: (data: Record<string, unknown>) => void): void => {
  if (subscribed.has(name)) return;
  subscribed.add(name);
  Events.On(name, (event: { data: unknown }) => {
    const data = Array.isArray(event.data) ? event.data[0] : event.data;
    cb((data ?? {}) as Record<string, unknown>);
  });
};
