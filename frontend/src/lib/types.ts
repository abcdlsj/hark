// Wire types mirroring the Go models bound by Wails. Field names stay
// snake_case so they match the serialized Go structs directly.

export interface KV {
  key: string;
  value: string;
  enabled?: boolean | null;
}

export interface Body {
  type: string;
  content: string;
}

export interface Auth {
  type: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface Meta {
  updated_by?: string;
  updated_at?: string;
}

export interface Api {
  id: string;
  name: string;
  method: string;
  url: string;
  headers?: KV[];
  query?: KV[];
  body: Body;
  auth: Auth;
  meta: Meta;
}

export interface ListItem {
  id: string;
  name: string;
  method: string;
  url: string;
  last_status: number;
  updated_by: string;
  updated_at: string;
}

export interface VarItem {
  key: string;
  value: string;
  scope: string;
  secret: boolean;
}

export interface Timings {
  dns_ms: number;
  tcp_ms: number;
  tls_ms: number;
  ttfb_ms: number;
  download_ms: number;
}

export interface RunView {
  log_id: number;
  api_id: string;
  method: string;
  url: string;
  env: string;
  actor: string;
  status: number;
  status_text: string;
  duration_ms: number;
  size: number;
  timings: Timings;
  request_headers?: Record<string, string[]>;
  response_headers?: Record<string, string[]>;
  body: string;
  truncated: boolean;
  error?: string;
}

export interface Log {
  id: number;
  ts: string;
  actor: string;
  env: string;
  api_id: string;
  method: string;
  url: string;
  status: number;
  duration_ms: number;
  size: number;
  timings: Timings;
  request_headers?: Record<string, string[]>;
  response_headers?: Record<string, string[]>;
  response_preview?: string;
  error?: string;
}

export interface Bootstrap {
  workspace: string;
  root: string;
  env: string;
  environments: string[];
  apis: ListItem[];
  vars: VarItem[];
  history: Log[];
  guide: string;
  platform: string;
}

export interface ParseOut {
  api: Api;
  warnings?: string[];
  replaced?: string[];
  new_token?: string;
}

export interface SaveOut {
  id: string;
  replaced?: string[];
  new_token?: string;
}

export interface RunRequest {
  api: Api;
  env?: string;
  actor?: string;
}

export const emptyApi = (id = ""): Api => ({
  id,
  name: "",
  method: "GET",
  url: "",
  headers: [],
  query: [],
  body: { type: "none", content: "" },
  auth: { type: "none" },
  meta: {},
});

export const isEnabled = (kv: KV): boolean => kv.enabled !== false;
