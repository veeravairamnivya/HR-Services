"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  IndianRupee,
  KanbanSquare,
  MapPin,
  Pencil,
  Search,
  Sheet,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AddCandidateModal } from "@/components/AddCandidateModal";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { CandidateSheet } from "@/components/CandidateSheet";
import { KanbanBoard } from "@/components/KanbanBoard";
import { PositionFormModal } from "@/components/forms";
import { StageSelect } from "@/components/StageSelect";
import { Avatar, Button, ConfirmButton, LoadingBlock, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, range, titleCase } from "@/lib/format";
import { POSITION_STATUS_STYLE, PRIORITY_STYLE, STAGES, stageMeta } from "@/lib/stages";
import type { Candidate, Position } from "@/lib/types";

function PositionSheetPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isManager } = useAuth();
  const { data: position, mutate: mutatePosition } = useSWR<Position>(`/positions/${id}`);
  const { data: candidates, mutate } = useSWR<Candidate[]>(`/positions/${id}/candidates`);

  const [stageFilter, setStageFilter] = useState<string>("");
  const [q, setQ] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [view, setView] = useState<"sheet" | "board">("sheet");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStage, setBulkStage] = useState("shortlisted");
  const [editOpen, setEditOpen] = useState(false);
  const [showJd, setShowJd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [drawer, setDrawer] = useState<{ id: number; tab: "details" | "interviews" } | null>(() => {
    const c = searchParams.get("candidate");
    return c ? { id: Number(c), tab: "details" } : null;
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!candidates) return [];
    const needle = q.trim().toLowerCase();
    return candidates.filter((c) => {
      if (stageFilter && c.stage !== stageFilter) return false;
      if (mineOnly && c.recruiter_id !== user?.id) return false;
      if (!needle) return true;
      return [c.full_name, c.email, c.phone, c.current_company, c.skills, c.current_location]
        .some((v) => v?.toLowerCase().includes(needle));
    });
  }, [candidates, stageFilter, q, mineOnly, user?.id]);

  if (!position || !candidates) return <LoadingBlock label="Opening candidate sheet…" />;

  const refreshAll = () => {
    mutate();
    mutatePosition();
  };
  const counts = candidates.reduce<Record<string, number>>((acc, c) => ((acc[c.stage] = (acc[c.stage] ?? 0) + 1), acc), {});

  async function moveStage(c: Candidate, stage: string) {
    mutate((list) => list?.map((x) => (x.id === c.id ? { ...x, stage } : x)), { revalidate: false });
    try {
      await api.post(`/candidates/${c.id}/stage`, { stage });
      toast.success(`${c.full_name} → ${stageMeta(stage).label}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
    refreshAll();
  }

  async function applyBulk() {
    try {
      const res = await api.post<{ updated: number; denied: number }>("/candidates/bulk-stage", { candidate_ids: [...selected], stage: bulkStage });
      toast.success(`${res.updated} candidates moved to ${stageMeta(bulkStage).label}${res.denied ? ` · ${res.denied} not permitted` : ""}`);
      setSelected(new Set());
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function importFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const t = toast.loading("Importing candidates…");
    try {
      const res = await api.post<{ created: number; skipped: number; errors: string[] }>(`/positions/${position!.id}/candidates/import`, fd);
      toast.success(`Imported ${res.created} candidates${res.skipped ? `, skipped ${res.skipped}` : ""}`, {
        id: t,
        description: res.errors.slice(0, 4).join("\n") || undefined,
        duration: res.errors.length ? 10000 : 4000,
      });
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filledPct = Math.min(100, (position.joined_count / position.openings) * 100);

  return (
    <div className="space-y-5">
      <Link href="/positions" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-navy-600">
        <ArrowLeft className="h-4 w-4" /> All positions
      </Link>

      {/* Position header */}
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 bg-gradient-to-r from-navy-50 via-white to-gold-50 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link href={`/clients/${position.client_id}`} className="text-xs font-bold uppercase tracking-wide text-navy-600 hover:underline">
              {position.client.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">{position.title}</h1>
              <Pill className={PRIORITY_STYLE[position.priority]}>{titleCase(position.priority)}</Pill>
              <Pill className={POSITION_STATUS_STYLE[position.status]}>{titleCase(position.status)}</Pill>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-sky-500" />{position.location ?? "—"} · {titleCase(position.work_mode)}</span>
              <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 text-amber-500" />{range(position.min_experience, position.max_experience, " yrs")}</span>
              <span className="flex items-center gap-1.5"><IndianRupee className="h-4 w-4 text-emerald-500" />{range(position.min_budget, position.max_budget, " LPA")}</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-gold-600" />{position.days_open} days open</span>
              {position.target_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-rose-500" />Target {fmtDate(position.target_date)}</span>}
              {position.job_code && <span className="font-mono text-xs text-slate-400">{position.job_code}</span>}
            </div>
            {position.skills && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {position.skills.split(",").map((s) => (
                  <span key={s} className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-navy-600 shadow-sm">{s.trim()}</span>
                ))}
              </div>
            )}
            {position.description && (
              <button onClick={() => setShowJd((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-bold text-navy-600">
                Job description <ChevronDown className={clsx("h-3.5 w-3.5 transition", showJd && "rotate-180")} />
              </button>
            )}
            {showJd && <p className="mt-2 max-w-3xl whitespace-pre-line rounded-xl bg-white p-3 text-sm text-slate-600">{position.description}</p>}
          </div>
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            <div className="flex gap-3">
              <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm"><div className="text-xl font-extrabold text-slate-800">{candidates.length}</div><div className="text-[11px] font-semibold uppercase text-slate-500">Candidates</div></div>
              <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm"><div className="text-xl font-extrabold text-navy-600">{position.interview_count}</div><div className="text-[11px] font-semibold uppercase text-slate-500">Interviewed</div></div>
              <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm"><div className="text-xl font-extrabold text-amber-600">{position.offer_count}</div><div className="text-[11px] font-semibold uppercase text-slate-500">Offers</div></div>
              <div className="rounded-2xl bg-white px-4 py-2 text-center shadow-sm"><div className="text-xl font-extrabold text-emerald-600">{position.joined_count}/{position.openings}</div><div className="text-[11px] font-semibold uppercase text-slate-500">Filled</div></div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white lg:w-72">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${filledPct}%` }} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Recruiters</span>
              <div className="flex -space-x-2">{position.recruiters.map((r) => <Avatar key={r.id} name={r.full_name} size="sm" />)}</div>
              {isManager && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>Edit</Button>}
              {user?.role === "admin" && (
                <ConfirmButton size="sm" variant="ghost" icon={Trash2} className="text-rose-600" message="Delete this position and its whole candidate sheet?"
                  onConfirm={async () => { await api.del(`/positions/${position.id}`); toast.success("Position deleted"); router.replace("/positions"); }} />
              )}
            </div>
          </div>
        </div>

        {/* Stage filter chips */}
        <div className="scroll-thin flex gap-2 overflow-x-auto border-t border-slate-100 px-4 py-3">
          <button
            onClick={() => setStageFilter("")}
            className={clsx("whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition", !stageFilter ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
          >
            All · {candidates.length}
          </button>
          {STAGES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStageFilter(stageFilter === s.key ? "" : s.key)}
              className={clsx(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset transition",
                stageFilter === s.key ? "bg-slate-800 text-white ring-slate-800" : s.chip,
                !counts[s.key] && stageFilter !== s.key && "opacity-50",
              )}
            >
              <span className={clsx("h-1.5 w-1.5 rounded-full", s.dot)} /> {s.short} · {counts[s.key] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar + sheet */}
      <div className="card">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 xl:flex-row xl:items-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Candidate tracker
            <span className="text-xs font-medium text-slate-400">click any cell to edit · Enter to save · Tab to move</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input w-56 py-1.5 pl-9" placeholder="Filter this sheet…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <input type="checkbox" className="accent-navy-600" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} /> My candidates
            </label>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button onClick={() => setView("sheet")} className={clsx("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold", view === "sheet" ? "bg-white text-navy-600 shadow-sm" : "text-slate-500")}><Sheet className="h-3.5 w-3.5" /> Sheet</button>
              <button onClick={() => setView("board")} className={clsx("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold", view === "board" ? "bg-white text-navy-600 shadow-sm" : "text-slate-500")}><KanbanSquare className="h-3.5 w-3.5" /> Board</button>
            </div>
            {(position.status === "open" || position.status === "on_hold") && (
              <Button size="sm" icon={UserPlus} onClick={() => setAdding(true)}>Add candidate</Button>
            )}
            <Button size="sm" variant="secondary" icon={Download} onClick={() => api.download(`/positions/${position.id}/candidates/export${stageFilter ? `?stage=${stageFilter}` : ""}`).catch((e) => toast.error(e.message))}>
              Export Excel
            </Button>
            <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileRef.current?.click()}>Import</Button>
            <button className="text-xs font-semibold text-navy-600 hover:underline" onClick={() => api.download(`/positions/${position.id}/candidates/template`).catch((e) => toast.error(e.message))}>
              template
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
            <span className="font-bold text-amber-800">{selected.size} selected</span>
            <span className="text-amber-700">Move to</span>
            <StageSelect value={bulkStage} onChange={setBulkStage} />
            <Button size="sm" onClick={applyBulk}>Apply</Button>
            <button className="text-xs font-semibold text-amber-700 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {view === "sheet" ? (
          <CandidateSheet
            position={position}
            candidates={filtered}
            selected={selected}
            setSelected={setSelected}
            onOpen={(cid, tab = "details") => setDrawer({ id: cid, tab })}
            onRefresh={refreshAll}
            onUpdated={(c) => mutate((list) => list?.map((x) => (x.id === c.id ? c : x)), { revalidate: false })}
            onCreated={(c) => {
              mutate((list) => [...(list ?? []), c], { revalidate: false });
              mutatePosition();
            }}
          />
        ) : (
          <KanbanBoard candidates={filtered} onMove={moveStage} onOpen={(cid) => setDrawer({ id: cid, tab: "details" })} />
        )}
        {filtered.length === 0 && view === "board" && (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><Users className="h-4 w-4" /> No candidates yet — switch to Sheet view to add.</div>
        )}
      </div>

      <CandidateDrawer candidateId={drawer?.id ?? null} initialTab={drawer?.tab} onClose={() => setDrawer(null)} onChanged={refreshAll} />
      <AddCandidateModal open={adding} onClose={() => setAdding(false)} defaultPositionId={position.id} onCreated={refreshAll} />
      <PositionFormModal open={editOpen} onClose={() => setEditOpen(false)} position={position} onSaved={() => mutatePosition()} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <PositionSheetPage />
    </Suspense>
  );
}
