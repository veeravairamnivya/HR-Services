const TOKEN_KEY = "tb_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable */
  }
}

function errorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { loc?: (string | number)[]; msg?: string };
      const field = first.loc?.filter((p) => p !== "body").join(".");
      return field ? `${field.replace(/_/g, " ")}: ${first.msg}` : (first.msg ?? "Invalid input");
    }
  }
  return status >= 500 ? "Server error. Please try again." : `Request failed (${status})`;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/login")) {
    setToken(null);
    window.dispatchEvent(new Event("tb:unauthorized"));
  }
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, errorMessage(body, res.status));
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await request(path, init);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => json<T>(path),
  post: <T>(path: string, body?: unknown) =>
    json<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) => json<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: (path: string) => json<void>(path, { method: "DELETE" }),
  async download(path: string, fallbackName = "export.xlsx") {
    const res = await request(path);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

export const fetcher = <T>(path: string) => api.get<T>(path);

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
