"use client";

import clsx from "clsx";
import { CalendarClock, ChevronLeft, ChevronRight, Phone, Video, Users } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { Button, EmptyState, LoadingBlock, PageHeader, Pill, StageBadge, Tabs } from "@/components/ui";
import { qs } from "@/lib/api";
import { fmtTime, isoDay, titleCase } from "@/lib/format";
import { RESULT_STYLE } from "@/lib/stages";
import type { InterviewWithContext } from "@/lib/types";

const MODE_ICON = { video: Video, phone: Phone, in_person: Users } as const;

function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

export default function InterviewsPage() {
  const [start, setStart] = useState(isoDay());
  const [mine, setMine] = useState<"all" | "mine">("all");
  const [result, setResult] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const end = addDays(start, 6);
  const { data, isLoading, mutate } = useSWR<InterviewWithContext[]>(`/interviews${qs({ start, end, mine: mine === "mine", result })}`);

  const days = useMemo(() => {
    const groups: Record<string, InterviewWithContext[]> = {};
    for (let i = 0; i < 7; i++) groups[addDays(start, i)] = [];
    for (const iv of data ?? []) {
      const key = isoDay(new Date(iv.scheduled_at!));
      (groups[key] ??= []).push(iv);
    }
    return Object.entries(groups);
  }, [data, start]);

  const today = isoDay();

  return (
    <div>
      <PageHeader
        icon={CalendarClock}
        title="Interviews"
        subtitle="Weekly interview calendar across all positions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setStart(addDays(start, -7))}>Prev</Button>
            <Button variant="secondary" size="sm" onClick={() => setStart(isoDay())}>Today</Button>
            <Button variant="secondary" size="sm" onClick={() => setStart(addDays(start, 7))}>Next <ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={mine} onChange={setMine} tabs={[{ key: "all", label: "Everyone" }, { key: "mine", label: "My candidates" }]} />
        <select className="input w-44" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="">Any result</option>
          {["pending", "selected", "rejected", "on_hold", "no_show"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </select>
        <span className="text-sm font-semibold text-slate-500">
          {new Date(`${start}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(`${end}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {data ? ` · ${data.length} interviews` : ""}
        </span>
      </div>

      {isLoading && !data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          {days.map(([day, items]) => (
            <div key={day} className={clsx("card flex flex-col overflow-hidden", day === today && "ring-2 ring-gold-400")}>
              <div className={clsx("px-4 py-3", day === today ? "bg-navy-900 text-white" : "bg-slate-50")}>
                <div className={clsx("text-xs font-bold uppercase", day === today ? "text-gold-300" : "text-slate-500")}>
                  {new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" })}
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-extrabold">{new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="text-xs font-bold">{items.length}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {items.length === 0 && <div className="py-6 text-center text-xs text-slate-400">No interviews</div>}
                {items.map((iv) => {
                  const Icon = MODE_ICON[iv.mode] ?? Video;
                  return (
                    <button key={iv.id} onClick={() => setOpenId(iv.candidate_id)} className="rounded-xl border border-slate-100 bg-white p-3 text-left transition hover:border-navy-200 hover:shadow-md">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-navy-700">{fmtTime(iv.scheduled_at)}</span>
                        <Icon className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="mt-1 truncate text-sm font-bold text-slate-800">{iv.candidate_name}</div>
                      <div className="truncate text-xs text-slate-500">{iv.position_title}</div>
                      <div className="truncate text-xs font-semibold text-navy-600">{iv.client_name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Pill className="bg-navy-50 text-navy-700">R{iv.round_number}</Pill>
                        <Pill className={RESULT_STYLE[iv.result]}>{titleCase(iv.result)}</Pill>
                      </div>
                      <div className="mt-1.5"><StageBadge stage={iv.candidate_stage} short /></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {data && data.length === 0 && !isLoading && (
        <div className="card mt-4"><EmptyState icon={CalendarClock} title="A quiet week" text="Interviews appear here once scheduled from a candidate's profile." /></div>
      )}
      <CandidateDrawer candidateId={openId} initialTab="interviews" onClose={() => setOpenId(null)} onChanged={() => mutate()} />
    </div>
  );
}
