// Shared formatting, telemetry unit splitting, and semantic badge helpers.

export interface SplitMetric {
  num: string;
  unit: string;
}

export const splitDuration = (ms: number): SplitMetric => {
  if (!Number.isFinite(ms) || ms < 0) return { num: "0", unit: "ms" };
  if (ms >= 1000) return { num: (ms / 1000).toFixed(2), unit: "s" };
  if (ms >= 100) return { num: String(Math.round(ms)), unit: "ms" };
  return { num: ms.toFixed(ms < 10 && ms > 0 ? 1 : 0), unit: "ms" };
};

export const splitBytes = (bytes: number): SplitMetric => {
  if (!Number.isFinite(bytes) || bytes < 0) return { num: "0", unit: "B" };
  if (bytes >= 1 << 20) return { num: (bytes / (1 << 20)).toFixed(2), unit: "MB" };
  if (bytes >= 1 << 10) return { num: (bytes / (1 << 10)).toFixed(2), unit: "KB" };
  return { num: String(Math.round(bytes)), unit: "B" };
};

export const humanMS = (ms: number): string => {
  const { num, unit } = splitDuration(ms);
  return `${num} ${unit}`;
};

export const humanBytes = (bytes: number): string => {
  const { num, unit } = splitBytes(bytes);
  return `${num} ${unit}`;
};

/** Directory name of the built-in workspace (~/.hark). */
const DEFAULT_WORKSPACE_DIR = ".hark";

/** The home workspace has no name of its own: it reads as "inbox". */
export const isDefaultWorkspace = (name: string): boolean =>
  name === "" || name === DEFAULT_WORKSPACE_DIR;

export const workspaceLabel = (name: string): string => (isDefaultWorkspace(name) ? "inbox" : name);

export const clockTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString([], { hour12: false });
};

export const relativeTime = (isoOrEpoch: string | number, now = Date.now()): string => {
  const ts = typeof isoOrEpoch === "number" ? isoOrEpoch : Date.parse(isoOrEpoch);
  if (!Number.isFinite(ts)) return "just now";
  const sec = Math.max(0, Math.floor((now - ts) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

/** Pretty-prints JSON when valid, otherwise returns the original text untouched. */
export const prettyBody = (body: string): { text: string; json: boolean } => {
  const trimmed = body.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return { text: body, json: false };
  try {
    return { text: JSON.stringify(JSON.parse(trimmed), null, 2), json: true };
  } catch {
    return { text: body, json: false };
  }
};

export const contentType = (headers?: Record<string, string[]>): string => {
  if (!headers) return "";
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "content-type") return v?.[0] ?? "";
  }
  return "";
};

/** Splits a pasted multi-line "Key: Value" block into KV rows. */
export const splitHeaderBlob = (raw: string): { key: string; value: string }[] | null => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return null;
  const rows: { key: string; value: string }[] = [];
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i <= 0) return null;
    rows.push({ key: line.slice(0, i).trim(), value: line.slice(i + 1).trim() });
  }
  return rows;
};

export const shortURL = (url: string): string => {
  const stripped = url.replace(/^\{\{[^}]+\}\}/, "").replace(/^https?:\/\/[^/]+/, "");
  return stripped || url;
};

export const isMac = (platform: string): boolean => platform === "darwin";

/** Derives a valid module/action API ID from a URL & HTTP method for unsaved drafts. */
export const suggestApiId = (url: string, method = "GET"): string => {
  let clean = url.trim();
  if (!clean) return `requests/${method.toLowerCase()}`;

  // Strip leading {{var}} host placeholder or scheme+host
  clean = clean.replace(/^\{\{[^}]+\}\}/, "");
  clean = clean.replace(/^https?:\/\/[^/?#]+/i, "");
  clean = clean.split(/[?#]/)[0] ?? "";
  clean = clean.replace(/^\/+(v\d+\/|api\/)+/i, "/");

  const rawSegments = clean
    .split("/")
    .map((s) =>
      s
        .replace(/\{\{\s*([^}]+?)\s*\}\}/g, "$1")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase(),
    )
    .filter((s) => s !== "" && s !== "." && s !== "..");

  if (rawSegments.length === 0) {
    return `requests/${method.toLowerCase()}`;
  }
  if (rawSegments.length === 1) {
    return `${rawSegments[0]}/${method.toLowerCase()}`;
  }
  return rawSegments.slice(-2).join("/");
};

export interface MethodStyle {
  label: string;
  short: string;
  textClass: string;
  pillClass: string;
}

export const methodMeta = (method: string): MethodStyle => {
  const m = (method || "GET").toUpperCase();
  switch (m) {
    case "GET":
      return { label: "GET", short: "GET", textClass: "text-emerald", pillClass: "bg-emerald-soft text-emerald" };
    case "POST":
      return { label: "POST", short: "POST", textClass: "text-cobalt", pillClass: "bg-cobalt-soft text-cobalt" };
    case "PUT":
      return { label: "PUT", short: "PUT", textClass: "text-amber", pillClass: "bg-amber-soft text-amber" };
    case "PATCH":
      return { label: "PATCH", short: "PAT", textClass: "text-violet", pillClass: "bg-violet-soft text-violet" };
    case "DELETE":
      return { label: "DELETE", short: "DEL", textClass: "text-rose", pillClass: "bg-rose-soft text-rose" };
    case "OPTIONS":
      return { label: "OPTIONS", short: "OPT", textClass: "text-ink2", pillClass: "bg-muted text-ink2" };
    case "HEAD":
      return { label: "HEAD", short: "HEAD", textClass: "text-ink2", pillClass: "bg-muted text-ink2" };
    default:
      return { label: m, short: m.slice(0, 4), textClass: "text-ink2", pillClass: "bg-muted text-ink2" };
  }
};

export interface StatusStyle {
  textClass: string;
  pillClass: string;
  dotClass: string;
}

export const statusMeta = (status: number): StatusStyle => {
  if (!status) {
    return { textClass: "text-ink3", pillClass: "bg-muted text-ink3", dotClass: "bg-ink3" };
  }
  if (status < 300) {
    return { textClass: "text-emerald", pillClass: "bg-emerald-soft text-emerald", dotClass: "bg-emerald" };
  }
  if (status < 400) {
    return { textClass: "text-amber", pillClass: "bg-amber-soft text-amber", dotClass: "bg-amber" };
  }
  return { textClass: "text-rose", pillClass: "bg-rose-soft text-rose", dotClass: "bg-rose" };
};
