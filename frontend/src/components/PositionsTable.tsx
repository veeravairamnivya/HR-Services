"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { range, titleCase } from "@/lib/format";
import { POSITION_STATUS_STYLE, PRIORITY_STYLE, STAGES } from "@/lib/stages";
import type { Position } from "@/lib/types";
import { Avatar, Pill } from "./ui";

export function PipelineBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  if (!total) return <div className="h-2 rounded-full bg-slate-100" />;
  return (
    <div className="flex h-2 gap-px overflow-hidden rounded-full bg-slate-100">
      {STAGES.filter((s) => counts[s.key]).map((s) => (
        <div key={s.key} title={`${s.label}: ${counts[s.key]}`} className={s.dot} style={{ width: `${(counts[s.key]! / total) * 100}%` }} />
      ))}
    </div>
  );
}

export function PositionsTable({ positions, hideClient }: { positions: Position[]; hideClient?: boolean }) {
  const router = useRouter();
  return (
    <div className="scroll-thin overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Position</th>
            <th className="px-3 py-3">Experience</th>
            <th className="px-3 py-3">Budget (LPA)</th>
            <th className="px-3 py-3">Filled</th>
            <th className="w-48 px-3 py-3">Pipeline</th>
            <th className="px-3 py-3">Recruiters</th>
            <th className="px-3 py-3">Priority</th>
            <th className="px-3 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {positions.map((p) => (
            <tr key={p.id} onClick={() => router.push(`/positions/${p.id}`)} className="cursor-pointer transition hover:bg-indigo-50/40">
              <td className="px-5 py-3">
                <div className="font-bold text-slate-800">{p.title}</div>
                <div className="text-xs text-slate-500">
                  {!hideClient && <span className="font-semibold text-indigo-600">{p.client.name} · </span>}
                  {p.location ?? "—"} · {titleCase(p.work_mode)}
                  {p.job_code ? ` · ${p.job_code}` : ""}
                </div>
              </td>
              <td className="px-3 py-3 text-slate-600">{range(p.min_experience, p.max_experience, " yrs")}</td>
              <td className="px-3 py-3 text-slate-600">{range(p.min_budget, p.max_budget)}</td>
              <td className="px-3 py-3">
                <span className={clsx("font-bold", p.joined_count >= p.openings ? "text-emerald-600" : "text-slate-800")}>{p.joined_count}</span>
                <span className="text-slate-400"> / {p.openings}</span>
              </td>
              <td className="px-3 py-3">
                <PipelineBar counts={p.stage_counts} total={p.candidate_count} />
                <div className="mt-1 text-xs text-slate-500">
                  {p.candidate_count} candidates · {p.interview_count} interviewed
                </div>
              </td>
              <td className="px-3 py-3">
                <div className="flex -space-x-2">
                  {p.recruiters.slice(0, 4).map((r) => <Avatar key={r.id} name={r.full_name} size="sm" />)}
                  {p.recruiters.length === 0 && <span className="text-xs text-slate-400">Unassigned</span>}
                </div>
              </td>
              <td className="px-3 py-3"><Pill className={PRIORITY_STYLE[p.priority]}>{titleCase(p.priority)}</Pill></td>
              <td className="px-3 py-3">
                <Pill className={POSITION_STATUS_STYLE[p.status]}>{titleCase(p.status)}</Pill>
                <div className="mt-0.5 text-[11px] text-slate-400">{p.days_open}d open</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
