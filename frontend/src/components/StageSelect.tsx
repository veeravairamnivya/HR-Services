"use client";

import clsx from "clsx";
import { STAGES, stageMeta } from "@/lib/stages";

export function StageSelect({ value, onChange, className, disabled }: {
  value: string;
  onChange: (stage: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const meta = stageMeta(value);
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        "cursor-pointer appearance-none rounded-full border-0 py-1 pl-3 pr-7 text-xs font-bold ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-navy-400 disabled:cursor-not-allowed",
        "bg-[length:14px] bg-[right_8px_center] bg-no-repeat",
        meta.chip,
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",
      }}
    >
      <optgroup label="Pipeline">
        {STAGES.filter((s) => !s.exit).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </optgroup>
      <optgroup label="Closed / paused">
        {STAGES.filter((s) => s.exit).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </optgroup>
    </select>
  );
}
