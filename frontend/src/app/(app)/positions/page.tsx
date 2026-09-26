"use client";

import clsx from "clsx";
import { Briefcase, CalendarDays, LayoutGrid, List, MapPin, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { PositionFormModal } from "@/components/forms";
import { PipelineBar, PositionsTable } from "@/components/PositionsTable";
import { Avatar, Button, EmptyState, LoadingBlock, PageHeader, Pill, Tabs } from "@/components/ui";
import { qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, range, titleCase } from "@/lib/format";
import { POSITION_STATUS_STYLE, PRIORITY_STYLE } from "@/lib/stages";
import type { Client, Position } from "@/lib/types";

type StatusTab = "active" | "open" | "on_hold" | "filled" | "closed" | "";

export default function PositionsPage() {
  const { isManager } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusTab>("active");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("");
  const [mine, setMine] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false);
  const { data: clients } = useSWR<Client[]>("/clients");
  const { data, isLoading, mutate } = useSWR<Position[]>(`/positions${qs({ q, status, client_id: clientId, priority, mine })}`);

  useEffect(() => {
    try {
      const v = localStorage.getItem("tb_positions_view");
      if (v === "table" || v === "cards") setView(v);
    } catch {}
  }, []);
  const changeView = (v: "cards" | "table") => {
    setView(v);
    try { localStorage.setItem("tb_positions_view", v); } catch {}
  };

  return (
    <div>
      <PageHeader
        icon={Briefcase}
        title="Open Positions"
        subtitle="Pick a position to open its candidate tracker sheet."
        actions={isManager && <Button icon={Plus} onClick={() => setOpen(true)}>New position</Button>}
      />
      <div className="mb-5 space-y-3">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { key: "active", label: "Active" },
            { key: "open", label: "Open" },
            { key: "on_hold", label: "On hold" },
            { key: "filled", label: "Filled" },
            { key: "closed", label: "Closed" },
            { key: "", label: "All" },
          ]}
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Title, skill, location, client…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input lg:w-56" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">All clients</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input lg:w-40" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="">Any priority</option>
            <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" className="accent-indigo-600" checked={mine} onChange={(e) => setMine(e.target.checked)} />
            Assigned to me
          </label>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1 lg:ml-auto">
            {([["cards", LayoutGrid], ["table", List]] as const).map(([v, Icon]) => (
              <button key={v} onClick={() => changeView(v)} aria-label={`${v} view`} className={clsx("rounded-lg p-1.5", view === v ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500")}>
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <div className="card"><EmptyState icon={Briefcase} title="No positions match" text="Try changing the filters." /></div>
      ) : view === "table" ? (
        <div className="card overflow-hidden"><PositionsTable positions={data} /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/positions/${p.id}`} className="card group flex flex-col p-5 transition hover:-translate-y-1 hover:shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide text-indigo-600">{p.client.name}</div>
                  <h3 className="mt-0.5 truncate text-lg font-bold text-slate-900 group-hover:text-indigo-700">{p.title}</h3>
                  <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" /> {p.location ?? "—"} · {titleCase(p.work_mode)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill className={PRIORITY_STYLE[p.priority]}>{titleCase(p.priority)}</Pill>
                  {p.status !== "open" && <Pill className={POSITION_STATUS_STYLE[p.status]}>{titleCase(p.status)}</Pill>}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2"><div className="text-slate-500">Experience</div><div className="font-bold text-slate-800">{range(p.min_experience, p.max_experience, " yrs")}</div></div>
                <div className="rounded-xl bg-slate-50 p-2"><div className="text-slate-500">Budget</div><div className="font-bold text-slate-800">{range(p.min_budget, p.max_budget, " L")}</div></div>
                <div className="rounded-xl bg-slate-50 p-2"><div className="text-slate-500">Openings</div><div className="font-bold text-slate-800">{p.joined_count}/{p.openings} filled</div></div>
              </div>
              {p.skills && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {p.skills.split(",").slice(0, 4).map((s) => (
                    <span key={s} className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">{s.trim()}</span>
                  ))}
                </div>
              )}
              <div className="mt-4">
                <PipelineBar counts={p.stage_counts} total={p.candidate_count} />
              </div>
              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.candidate_count}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {p.target_date ? `Due ${fmtDate(p.target_date, { day: "2-digit", month: "short" })}` : `${p.days_open}d open`}</span>
                </div>
                <div className="flex -space-x-2">
                  {p.recruiters.slice(0, 3).map((r) => <Avatar key={r.id} name={r.full_name} size="sm" />)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <PositionFormModal open={open} onClose={() => setOpen(false)} onSaved={() => mutate()} />
    </div>
  );
}
