"use client";

import clsx from "clsx";
import { ArrowLeft, Briefcase, Building2, Download, Globe, Mail, MapPin, Pencil, Percent, Phone, Plus, Trash2, UserRound, Wallet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { ClientFormModal, PositionFormModal } from "@/components/forms";
import { PositionsTable } from "@/components/PositionsTable";
import { Button, Card, CardHeader, ConfirmButton, EmptyState, LoadingBlock, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { avatarColor, fmtDate, initials, titleCase } from "@/lib/format";
import { CLIENT_STATUS_STYLE } from "@/lib/stages";
import type { Client, Position } from "@/lib/types";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isManager, user } = useAuth();
  const { data: client, mutate } = useSWR<Client>(`/clients/${id}`);
  const { data: positions, mutate: mutatePositions } = useSWR<Position[]>(`/positions?client_id=${id}`);
  const [edit, setEdit] = useState(false);
  const [newPos, setNewPos] = useState(false);

  if (!client) return <LoadingBlock />;

  const info = [
    { icon: UserRound, label: "Contact", value: client.contact_person },
    { icon: Mail, label: "Email", value: client.contact_email },
    { icon: Phone, label: "Phone", value: client.contact_phone },
    { icon: MapPin, label: "Location", value: client.location },
    { icon: Globe, label: "Website", value: client.website },
    { icon: Percent, label: "Fee", value: client.fee_percentage != null ? `${client.fee_percentage}% of CTC` : null },
    { icon: Wallet, label: "Payment terms", value: client.payment_terms_days != null ? `${client.payment_terms_days} days` : null },
  ];

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-indigo-600">
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>
      <div className="card overflow-hidden">
        <div className={clsx("h-24 bg-gradient-to-r", avatarColor(client.name))} />
        <div className="-mt-10 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <span className={clsx("grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br text-2xl font-extrabold text-white shadow-xl ring-4 ring-white", avatarColor(client.name))}>
              {initials(client.name)}
            </span>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900">{client.name}</h1>
                <Pill className={CLIENT_STATUS_STYLE[client.status]}>{titleCase(client.status)}</Pill>
              </div>
              <p className="text-sm text-slate-500">{client.industry ?? "—"} · Client since {fmtDate(client.created_at, { month: "short", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Download} onClick={() => api.download(`/reports/export/candidates?client_id=${client.id}`).catch((e) => toast.error(e.message))}>
              Export candidates
            </Button>
            {isManager && <Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Edit</Button>}
            {isManager && <Button icon={Plus} onClick={() => setNewPos(true)}>New position</Button>}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader icon={Building2} title="Client details" />
          <dl className="divide-y divide-slate-100">
            {info.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Icon className="h-4 w-4 text-slate-400" />
                <dt className="w-28 text-slate-500">{label}</dt>
                <dd className="min-w-0 flex-1 truncate font-medium text-slate-800">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {client.notes && <div className="m-5 mt-0 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{client.notes}</div>}
          {user?.role === "admin" && (
            <div className="border-t border-slate-100 p-4">
              <ConfirmButton
                variant="ghost"
                size="sm"
                icon={Trash2}
                className="text-rose-600 hover:bg-rose-50"
                message={`Delete ${client.name} and ALL its positions and candidates? This cannot be undone.`}
                onConfirm={async () => {
                  await api.del(`/clients/${client.id}`);
                  toast.success("Client deleted");
                  router.replace("/clients");
                }}
              >
                Delete client
              </ConfirmButton>
            </div>
          )}
        </Card>
        <div className="space-y-6 xl:col-span-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Active roles", value: client.open_positions, cls: "from-amber-500 to-orange-400" },
              { label: "Seats open", value: client.total_openings, cls: "from-sky-500 to-cyan-400" },
              { label: "Offers made", value: client.offers, cls: "from-fuchsia-500 to-pink-500" },
              { label: "Joined", value: client.joined, cls: "from-emerald-500 to-teal-400" },
            ].map((s) => (
              <div key={s.label} className={clsx("rounded-2xl bg-gradient-to-br p-4 text-white shadow-md", s.cls)}>
                <div className="text-3xl font-extrabold">{s.value}</div>
                <div className="text-xs font-semibold uppercase tracking-wide text-white/85">{s.label}</div>
              </div>
            ))}
          </div>
          <Card>
            <CardHeader icon={Briefcase} title="Positions" subtitle="Click a position to open its candidate sheet" />
            {!positions ? <LoadingBlock /> : positions.length === 0 ? (
              <EmptyState icon={Briefcase} title="No positions yet" action={isManager && <Button icon={Plus} onClick={() => setNewPos(true)}>New position</Button>} />
            ) : (
              <PositionsTable positions={positions} hideClient />
            )}
          </Card>
        </div>
      </div>

      <ClientFormModal open={edit} onClose={() => setEdit(false)} client={client} onSaved={() => mutate()} />
      <PositionFormModal open={newPos} onClose={() => setNewPos(false)} defaultClientId={client.id} onSaved={() => { mutatePositions(); mutate(); }} />
    </div>
  );
}
