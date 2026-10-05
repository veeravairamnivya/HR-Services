"use client";

import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Users, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { AddCandidateModal } from "@/components/AddCandidateModal";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { Avatar, Button, EmptyState, LoadingBlock, PageHeader, StageBadge } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, lpa, relativeTime } from "@/lib/format";
import { STAGES, stageMeta } from "@/lib/stages";
import type { CandidateListItem, Client, Page, User } from "@/lib/types";

const PAGE_SIZE = 50;

// Filters live in the URL so dashboard cards and shared links open exactly the same list.
const FILTER_KEYS = [
  "q",
  "stage",
  "client_id",
  "recruiter_id",
  "mine",
  "position_status",
  "added_from",
  "added_to",
  "reached",
  "reached_from",
  "reached_to",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const ACTIVE_STAGES = STAGES.filter((s) => !["rejected", "dropped", "joined"].includes(s.key)).map((s) => s.key).join(",");

function shortDate(d: string) {
  return fmtDate(d, { day: "2-digit", month: "short" });
}

function CandidatesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { isManager } = useAuth();

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) ?? ""])) as Record<FilterKey, string>;
  const [q, setQ] = useState(filters.q);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(params.get("add") === "1");

  const paramString = params.toString();
  useEffect(() => {
    setQ(new URLSearchParams(paramString).get("q") ?? "");
    setPage(0);
  }, [paramString]);

  function update(changes: Partial<Record<FilterKey | "add", string | null>>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  // Debounce typing into the search box before it lands in the URL.
  useEffect(() => {
    if (q === filters.q) return;
    const t = setTimeout(() => update({ q }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data: clients } = useSWR<Client[]>("/clients");
  const { data: users } = useSWR<User[]>("/users");
  const key = `/candidates${qs({ ...filters, mine: filters.mine === "1", limit: PAGE_SIZE, offset: page * PAGE_SIZE })}`;
  const { data, isLoading, mutate } = useSWR<Page<CandidateListItem>>(key);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const stageIsCustom = filters.stage.includes(",") && filters.stage !== ACTIVE_STAGES;
  const recruiterName = users?.find((u) => String(u.id) === filters.recruiter_id)?.full_name;

  // Chips describe filters that have no dropdown of their own (they usually come from the dashboard).
  const chips: { label: string; clear: Partial<Record<FilterKey, null>> }[] = [];
  if (filters.position_status === "active") chips.push({ label: "Active positions only", clear: { position_status: null } });
  if (filters.added_from || filters.added_to)
    chips.push({
      label: `Added ${filters.added_from ? shortDate(filters.added_from) : "…"} – ${filters.added_to ? shortDate(filters.added_to) : "today"}`,
      clear: { added_from: null, added_to: null },
    });
  if (filters.reached)
    chips.push({
      label: `Moved to ${filters.reached.split(",").map((k) => stageMeta(k).label).join(" / ")}${filters.reached_from ? ` · ${shortDate(filters.reached_from)} – ${filters.reached_to ? shortDate(filters.reached_to) : "today"}` : ""}`,
      clear: { reached: null, reached_from: null, reached_to: null },
    });
  if (filters.recruiter_id && !isManager)
    chips.push({ label: `Recruiter: ${recruiterName ?? filters.recruiter_id}`, clear: { recruiter_id: null } });
  if (stageIsCustom)
    chips.push({ label: `Stages: ${filters.stage.split(",").map((k) => stageMeta(k).short).join(", ")}`, clear: { stage: null } });
  const anyFilter = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Candidates"
        subtitle={data ? `${data.total} candidate${data.total === 1 ? "" : "s"}${anyFilter ? " match these filters" : " across every client and position"}` : "Search the whole candidate database"}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => api.download(`/reports/export/candidates${qs({ client_id: filters.client_id, stage: filters.stage })}`).catch((e) => toast.error(e.message))}>
              Export
            </Button>
            <Button icon={Plus} onClick={() => setAdding(true)}>Add candidate</Button>
          </>
        }
      />
      <div className="card mb-3 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="relative xl:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Name, phone, email, company, skill, position…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input" value={filters.stage} onChange={(e) => update({ stage: e.target.value })} aria-label="Stage">
          <option value="">All stages</option>
          <option value={ACTIVE_STAGES}>Active pipeline (not closed)</option>
          {stageIsCustom && <option value={filters.stage}>Selected stages</option>}
          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select className="input" value={filters.client_id} onChange={(e) => update({ client_id: e.target.value })} aria-label="Client">
          <option value="">All clients</option>
          {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          {isManager ? (
            <select className="input" value={filters.recruiter_id} onChange={(e) => update({ recruiter_id: e.target.value, mine: null })} aria-label="Recruiter">
              <option value="">All recruiters</option>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600">
            <input type="checkbox" className="accent-navy-700" checked={filters.mine === "1"} onChange={(e) => update({ mine: e.target.checked ? "1" : null, recruiter_id: null })} /> Mine
          </label>
        </div>
      </div>

      {(chips.length > 0 || anyFilter) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={() => update(c.clear)}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-800 ring-1 ring-gold-200 hover:bg-gold-100"
            >
              {c.label} <X className="h-3.5 w-3.5" />
            </button>
          ))}
          {anyFilter && (
            <button onClick={() => router.replace(pathname, { scroll: false })} className="text-xs font-semibold text-navy-600 hover:underline">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading && !data ? (
          <LoadingBlock />
        ) : !data?.items.length ? (
          <EmptyState
            icon={Users}
            title="No candidates found"
            text={anyFilter ? "Try a different search or filter." : "Add your first candidate to get started."}
            action={<Button icon={Plus} onClick={() => setAdding(true)}>Add candidate</Button>}
          />
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">Candidate</th>
                  <th className="px-3 py-3">Position</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Exp</th>
                  <th className="px-3 py-3">ECTC</th>
                  <th className="px-3 py-3">Notice</th>
                  <th className="px-3 py-3">Recruiter</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="sticky right-0 bg-slate-50 px-4 py-3 text-right shadow-[-8px_0_8px_-8px_rgba(15,23,42,.15)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((c) => (
                  <tr key={c.id} onClick={() => setOpenId(c.id)} className="group cursor-pointer whitespace-nowrap hover:bg-navy-50/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.full_name} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800">{c.full_name}</div>
                          <div className="max-w-[260px] truncate text-xs text-slate-500">
                            {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="max-w-[220px] truncate font-medium text-slate-700" title={c.position.title}>{c.position.title}</div>
                      <div className="max-w-[220px] truncate text-xs text-navy-600">{c.position.client.name}</div>
                    </td>
                    <td className="px-3 py-3"><StageBadge stage={c.stage} /></td>
                    <td className="px-3 py-3 text-slate-600">{c.total_experience != null ? `${c.total_experience} yrs` : "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{lpa(c.expected_ctc)}</td>
                    <td className="px-3 py-3 text-slate-600">{c.notice_period_days != null ? `${c.notice_period_days} d` : "—"}</td>
                    <td className="px-3 py-3 text-slate-600">{c.recruiter?.full_name ?? "—"}</td>
                    <td className="px-3 py-3 text-xs text-slate-400">{relativeTime(c.updated_at)}</td>
                    <td className="sticky right-0 bg-white px-4 py-3 text-right shadow-[-8px_0_8px_-8px_rgba(15,23,42,.15)] group-hover:bg-navy-50">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(c.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 hover:border-gold-300 hover:bg-gold-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> View / Edit
                      </button>
                    </td>
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
      <AddCandidateModal
        open={adding}
        onClose={() => {
          setAdding(false);
          if (params.get("add")) update({ add: null });
        }}
        onCreated={() => mutate()}
      />
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
