// Small formatting helpers shared by the inspector and the pulse.

export const methodClass = (method: string): string => {
  switch (method.toUpperCase()) {
    case "GET":
      return "text-get";
    case "POST":
      return "text-post";
    case "PUT":
      return "text-put";
    case "PATCH":
      return "text-patch";
    case "DELETE":
      return "text-del";
    case "HEAD":
    case "OPTIONS":
      return "text-ink2";
    default:
      return "text-ink2";
  }
};

/** The sidebar uses a fixed 36px method column: GET / POST / PUT / DEL. */
export const methodPrefix = (method: string): string => {
  const m = method.toUpperCase();
  if (m === "DELETE") return "DEL";
  return m.padEnd(4, " ");
};

export const statusClass = (status: number): string => {
  if (!status) return "text-ink3";
  if (status < 300) return "text-get";
  if (status < 400) return "text-post";
  return "text-del";
};

export const humanMS = (v: number): string => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)} ms`);

export const humanBytes = (n: number): string => {
  if (n >= 1 << 20) return `${(n / (1 << 20)).toFixed(2)} MB`;
  if (n >= 1 << 10) return `${(n / (1 << 10)).toFixed(2)} KB`;
  return `${n} B`;
};

export const clockTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString([], { hour12: false });
};

/** Pretty-prints JSON, or returns the input untouched when it is not JSON. */
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

/** Splits a multi-line "Key: Value" blob pasted into a KV grid cell. */
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
