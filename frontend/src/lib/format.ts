export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

const AVATAR_COLORS = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-pink-500 to-rose-400",
  "from-fuchsia-500 to-purple-500",
];

export function avatarColor(seed: string | number): string {
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

export function fmtDate(value: string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value: string): string {
  const secs = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const abs = Math.abs(secs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(secs / 86400), "day");
  if (abs < 2629800) return rtf.format(Math.round(secs / 604800), "week");
  if (abs < 31557600) return rtf.format(Math.round(secs / 2629800), "month");
  return rtf.format(Math.round(secs / 31557600), "year");
}

export function lpa(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })} L`;
}

export function range(lo: number | null, hi: number | null, suffix = ""): string {
  if (lo == null && hi == null) return "—";
  if (lo != null && hi != null) return `${lo}–${hi}${suffix}`;
  return `${lo ?? hi}${suffix}${lo != null ? "+" : ""}`;
}

/** yyyy-mm-dd for the user's local calendar day. */
export function isoDay(d = new Date()): string {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Value for <input type="datetime-local"> from an ISO string. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}
