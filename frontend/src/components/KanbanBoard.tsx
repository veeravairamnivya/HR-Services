"use client";

import clsx from "clsx";
import { CalendarClock, GripVertical } from "lucide-react";
import { useState } from "react";
import { fmtDateTime, lpa } from "@/lib/format";
import { STAGES } from "@/lib/stages";
import type { Candidate } from "@/lib/types";
import { Avatar } from "./ui";

export function KanbanBoard({ candidates, onMove, onOpen }: {
  candidates: Candidate[];
  onMove: (candidate: Candidate, stage: string) => void;
  onOpen: (id: number) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="scroll-thin flex gap-3 overflow-x-auto p-4">
      {STAGES.map((stage) => {
        const items = candidates.filter((c) => c.stage === stage.key);
        return (
          <div
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage.key);
            }}
            onDragLeave={() => setOver((o) => (o === stage.key ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const c = candidates.find((x) => x.id === dragging);
              if (c && c.stage !== stage.key) onMove(c, stage.key);
            }}
            className={clsx(
              "flex w-64 shrink-0 flex-col rounded-2xl bg-slate-100/80 transition",
              over === stage.key && "bg-navy-100 ring-2 ring-navy-300",
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                <span className={clsx("h-2.5 w-2.5 rounded-full", stage.dot)} />
                {stage.label}
              </span>
              <span className="rounded-full bg-white px-2 text-xs font-bold text-slate-500">{items.length}</span>
            </div>
            <div className="scroll-thin flex max-h-[calc(100vh-380px)] min-h-24 flex-col gap-2 overflow-y-auto px-2 pb-2">
              {items.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragging(c.id)}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => onOpen(c.id)}
                  className={clsx(
                    "cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-navy-300 hover:shadow-md active:cursor-grabbing",
                    dragging === c.id && "opacity-50",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-800">{c.full_name}</div>
                      <div className="truncate text-xs text-slate-500">{c.current_company ?? "—"} · {c.total_experience ?? "—"} yrs</div>
                    </div>
                    {c.recruiter && <Avatar name={c.recruiter.full_name} size="sm" />}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-semibold">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">ECTC {lpa(c.expected_ctc)}</span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">NP {c.notice_period_days ?? "—"}d</span>
                  </div>
                  {c.next_interview?.scheduled_at && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-gold-700">
                      <CalendarClock className="h-3 w-3" /> R{c.next_interview.round_number} · {fmtDateTime(c.next_interview.scheduled_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
