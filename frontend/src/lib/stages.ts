// Mirrors backend/app/pipeline.py. Class names are written out in full so Tailwind can detect them.

export interface StageMeta {
  key: string;
  label: string;
  short: string;
  rank: number;
  exit?: boolean;
  chip: string; // badge colors
  dot: string; // solid color
  hex: string; // chart color
}

export const STAGES: StageMeta[] = [
  { key: "sourced", label: "Sourced", short: "Sourced", rank: 1, chip: "bg-slate-100 text-slate-700 ring-slate-200", dot: "bg-slate-400", hex: "#94a3b8" },
  { key: "screening", label: "Screening", short: "Screening", rank: 2, chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", hex: "#0ea5e9" },
  { key: "shortlisted", label: "Shortlisted", short: "Shortlisted", rank: 3, chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500", hex: "#3b82f6" },
  { key: "interview_scheduled", label: "Interview Scheduled", short: "Interview", rank: 4, chip: "bg-navy-50 text-navy-700 ring-navy-200", dot: "bg-navy-500", hex: "#456694" },
  { key: "round1_selected", label: "Round 1 Selected", short: "R1 ✓", rank: 5, chip: "bg-violet-50 text-violet-700 ring-violet-200", dot: "bg-violet-500", hex: "#8b5cf6" },
  { key: "round2_selected", label: "Round 2 Selected", short: "R2 ✓", rank: 6, chip: "bg-purple-50 text-purple-700 ring-purple-200", dot: "bg-purple-500", hex: "#a855f7" },
  { key: "round3_selected", label: "Round 3 Selected", short: "R3 ✓", rank: 7, chip: "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200", dot: "bg-fuchsia-500", hex: "#d946ef" },
  { key: "hr_discussion", label: "HR Discussion", short: "HR Round", rank: 8, chip: "bg-pink-50 text-pink-700 ring-pink-200", dot: "bg-pink-500", hex: "#ec4899" },
  { key: "offer_released", label: "Offer Released", short: "Offered", rank: 9, chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", hex: "#f59e0b" },
  { key: "offer_accepted", label: "Offer Accepted", short: "Accepted", rank: 10, chip: "bg-lime-50 text-lime-700 ring-lime-200", dot: "bg-lime-500", hex: "#84cc16" },
  { key: "joined", label: "Joined", short: "Joined", rank: 11, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", hex: "#10b981" },
  { key: "on_hold", label: "On Hold", short: "On Hold", rank: 0, exit: true, chip: "bg-yellow-50 text-yellow-700 ring-yellow-200", dot: "bg-yellow-400", hex: "#facc15" },
  { key: "rejected", label: "Rejected", short: "Rejected", rank: 0, exit: true, chip: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500", hex: "#ef4444" },
  { key: "dropped", label: "Dropped / Backed Out", short: "Dropped", rank: 0, exit: true, chip: "bg-stone-100 text-stone-600 ring-stone-200", dot: "bg-stone-400", hex: "#a8a29e" },
];

export const STAGE_MAP: Record<string, StageMeta> = Object.fromEntries(STAGES.map((s) => [s.key, s]));

export function stageMeta(key: string): StageMeta {
  return STAGE_MAP[key] ?? STAGES[0];
}

export const SOURCES = [
  { key: "naukri", label: "Naukri" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "indeed", label: "Indeed" },
  { key: "referral", label: "Referral" },
  { key: "internal_db", label: "Internal DB" },
  { key: "job_portal", label: "Other Job Portal" },
  { key: "walk_in", label: "Walk-in" },
  { key: "other", label: "Other" },
];

export const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map((s) => [s.key, s.label]));

export const PRIORITY_STYLE: Record<string, string> = {
  critical: "bg-rose-500 text-white",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-sky-100 text-sky-700",
  low: "bg-slate-100 text-slate-600",
};

export const POSITION_STATUS_STYLE: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  closed: "bg-slate-200 text-slate-600",
  filled: "bg-navy-100 text-navy-700",
};

export const CLIENT_STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  prospect: "bg-sky-100 text-sky-700",
  inactive: "bg-slate-200 text-slate-600",
};

export const RESULT_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  selected: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  on_hold: "bg-amber-100 text-amber-700",
  no_show: "bg-stone-200 text-stone-600",
};
