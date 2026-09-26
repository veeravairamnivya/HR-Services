"use client";

import { ChevronLeft, ChevronRight, Download, Search, Users } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { Avatar, Button, EmptyState, LoadingBlock, PageHeader, StageBadge } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { lpa, relativeTime } from "@/lib/format";
import { STAGES } from "@/lib/stages";
import type { CandidateListItem, Client, Page, User } from "@/lib/types";

const PAGE_SIZE = 50;

function CandidatesInner() {
  const params = useSearchParams();
  const { isManager } = useAuth();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [stage, setStage] = useState(params.get("stage") ?? "");
  const [clientId, setClientId] = useState("");
  const [recruiterId, setRecruiterId] = useState("");
  const [mine, setMine] = useState(params.get("mine") === "1");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setStage(params.get("stage") ?? "");
    setMine(params.get("mine") === "1");
    setPage(0);
  }, [params]);

  const { data: clients } = useSWR<Client[]>("/clients");
  const { data: users } = useSWR<User[]>("/users");
  const key = `/candidates${qs({ q, stage, client_id: clientId, recruiter_id: recruiterId, mine, limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`;
  const { data, isLoading, mutate } = useSWR<Page<CandidateListItem>>(key);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Candidates"
        subtitle={data ? `${data.total} candidates across every client and position` : "Search the whole candidate database"}
        actions={
          <Button variant="secondary" icon={Download} onClick={() => api.download(`/reports/export/candidates${qs({ client_id: clientId, stage })}`).catch((e) => toast.error(e.message))}>
            Export
          </Button>
        }
      />
      <div className="card mb-5 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Name, phone, email, company, skill, position…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
        </div>
        <select className="input" value={stage} onChange={(e) => { setStage(e.target.value); setPage(0); }}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input" value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(0); }}>
          <option value="">All clients</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          {isManager ? (
            <select className="input" value={recruiterId} onChange={(e) => { setRecruiterId(e.target.value); setMine(false); setPage(0); }}>
              <option value="">All recruiters</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600">
            <input type="checkbox" className="accent-indigo-600" checked={mine} onChange={(e) => { setMine(e.target.checked); setPage(0); }} /> Mine
          </label>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading && !data ? (
          <LoadingBlock />
        ) : !data?.items.length ? (
          <EmptyState icon={Users} title="No candidates found" text="Try a different search or filter." />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-3 py-3">Position</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Exp</th>
                  <th className="px-3 py-3">ECTC</th>
                  <th className="px-3 py-3">Notice</th>
                  <th className="px-3 py-3">Recruiter</th>
                  <th className="px-3 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer hover:bg-indigo-50/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.full_name} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-800">{c.full_name}</div>
                          <div className="text-xs text-slate-500">{c.current_company ?? "—"}{c.email ? ` · ${c.email}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-700">{c.position.title}</div>
                      <div className="text-xs text-indigo-600">{c.position.client.name}</div>
                    </td>
                    <td className="px-3 py-3"><StageBadge stage={c.stage} /></td>
                    <td className="px-3 py-3 text-slate-600">{c.phone ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{c.total_experience ?? "—"} yrs</td>
                    <td className="px-3 py-3 text-slate-600">{lpa(c.expected_ctc)}</td>
                    <td className="px-3 py-3 text-slate-600">{c.notice_period_days ?? "—"} d</td>
                    <td className="px-3 py-3 text-slate-600">{c.recruiter?.full_name ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{relativeTime(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <span>Page {page + 1} of {pages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button size="sm" variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </div>
      <CandidateDrawer candidateId={openId} onClose={() => setOpenId(null)} onChanged={() => mutate()} />
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CandidatesInner />
    </Suspense>
  );
}
