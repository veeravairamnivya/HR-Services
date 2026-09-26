"use client";

import clsx from "clsx";
import { Briefcase, Building2, Globe, Mail, MapPin, Phone, Plus, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { ClientFormModal } from "@/components/forms";
import { Button, EmptyState, LoadingBlock, PageHeader, Pill, Tabs } from "@/components/ui";
import { qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { avatarColor, initials, titleCase } from "@/lib/format";
import { CLIENT_STATUS_STYLE } from "@/lib/stages";
import type { Client } from "@/lib/types";

export default function ClientsPage() {
  const { isManager } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "active" | "prospect" | "inactive">("");
  const [open, setOpen] = useState(false);
  const { data, isLoading, mutate } = useSWR<Client[]>(`/clients${qs({ q, status })}`);

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Clients"
        subtitle="Companies you recruit for, with live pipeline numbers."
        actions={isManager && <Button icon={Plus} onClick={() => setOpen(true)}>Add client</Button>}
      />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { key: "", label: "All" },
            { key: "active", label: "Active" },
            { key: "prospect", label: "Prospect" },
            { key: "inactive", label: "Inactive" },
          ]}
        />
      </div>

      {isLoading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <div className="card">
          <EmptyState icon={Building2} title="No clients found" text="Add your first client to start tracking their openings." action={isManager && <Button icon={Plus} onClick={() => setOpen(true)}>Add client</Button>} />
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="card group overflow-hidden transition hover:-translate-y-1 hover:shadow-xl">
              <div className={clsx("h-2 bg-gradient-to-r", avatarColor(c.name))} />
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <span className={clsx("grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-lg font-extrabold text-white shadow-md", avatarColor(c.name))}>
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-lg font-bold text-slate-900 group-hover:text-indigo-700">{c.name}</h3>
                      <Pill className={CLIENT_STATUS_STYLE[c.status]}>{titleCase(c.status)}</Pill>
                    </div>
                    <p className="text-sm text-slate-500">{c.industry ?? "—"}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                  {c.contact_person && <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-slate-400" />{c.contact_person}</div>}
                  {c.location && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" />{c.location}</div>}
                  {c.contact_email && <div className="flex items-center gap-2 truncate"><Mail className="h-4 w-4 text-slate-400" />{c.contact_email}</div>}
                  {c.contact_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" />{c.contact_phone}</div>}
                  {c.website && <div className="flex items-center gap-2 truncate"><Globe className="h-4 w-4 text-slate-400" />{c.website.replace(/^https?:\/\//, "")}</div>}
                </div>
                <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                  {[
                    { label: "Open roles", value: c.open_positions, cls: "bg-amber-50 text-amber-700" },
                    { label: "Seats", value: c.total_openings, cls: "bg-sky-50 text-sky-700" },
                    { label: "Candidates", value: c.total_candidates, cls: "bg-violet-50 text-violet-700" },
                    { label: "Joined", value: c.joined, cls: "bg-emerald-50 text-emerald-700" },
                  ].map((s) => (
                    <div key={s.label} className={clsx("rounded-xl py-2", s.cls)}>
                      <div className="text-lg font-extrabold">{s.value}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-indigo-600">
                  <Briefcase className="h-3.5 w-3.5" /> {c.total_positions} positions in total
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <ClientFormModal open={open} onClose={() => setOpen(false)} onSaved={() => mutate()} />
    </div>
  );
}
