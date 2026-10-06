"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { Client, Position, User } from "@/lib/types";
import { Avatar, Button, Field, Modal } from "./ui";

type FormState = Record<string, string | number | boolean | number[] | null | undefined>;

function useForm<T extends FormState>(initial: T, open: boolean) {
  const [form, setForm] = useState<T>(initial);
  useEffect(() => {
    if (open) setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const bind = (key: keyof T) => ({
    value: (form[key] ?? "") as string | number,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  return { form, setForm, bind };
}

function numOrNull(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------- client
export function ClientFormModal({ open, onClose, client, onSaved }: {
  open: boolean;
  onClose: () => void;
  client?: Client | null;
  onSaved: (c: Client) => void;
}) {
  const initial = {
    name: client?.name ?? "",
    industry: client?.industry ?? "",
    contact_person: client?.contact_person ?? "",
    contact_email: client?.contact_email ?? "",
    contact_phone: client?.contact_phone ?? "",
    location: client?.location ?? "",
    website: client?.website ?? "",
    status: client?.status ?? "active",
    fee_percentage: client?.fee_percentage ?? "",
    payment_terms_days: client?.payment_terms_days ?? "",
    notes: client?.notes ?? "",
  };
  const { form, bind } = useForm(initial, open);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const body = {
        ...form,
        fee_percentage: numOrNull(form.fee_percentage),
        payment_terms_days: numOrNull(form.payment_terms_days),
      };
      const saved = client ? await api.patch<Client>(`/clients/${client.id}`, body) : await api.post<Client>("/clients", body);
      toast.success(client ? "Client updated" : "Client added");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={client ? "Edit client" : "Add a new client"}
      subtitle="Company details and the point of contact for requirements."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save} disabled={!String(form.name).trim()}>{client ? "Save changes" : "Add client"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name *" className="sm:col-span-2"><input className="input" autoFocus {...bind("name")} /></Field>
        <Field label="Industry"><input className="input" placeholder="IT Services" {...bind("industry")} /></Field>
        <Field label="Location"><input className="input" placeholder="Bengaluru" {...bind("location")} /></Field>
        <Field label="Contact person"><input className="input" {...bind("contact_person")} /></Field>
        <Field label="Contact phone"><input className="input" {...bind("contact_phone")} /></Field>
        <Field label="Contact email"><input className="input" type="email" {...bind("contact_email")} /></Field>
        <Field label="Website"><input className="input" placeholder="https://" {...bind("website")} /></Field>
        <Field label="Status">
          <select className="input" {...bind("status")}>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Fee %"><input className="input" type="number" step="0.01" {...bind("fee_percentage")} /></Field>
          <Field label="Payment (days)"><input className="input" type="number" {...bind("payment_terms_days")} /></Field>
        </div>
        <Field label="Notes" className="sm:col-span-2"><textarea className="input min-h-20" {...bind("notes")} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- position
export function PositionFormModal({ open, onClose, position, defaultClientId, onSaved }: {
  open: boolean;
  onClose: () => void;
  position?: Position | null;
  defaultClientId?: number;
  onSaved: (p: Position) => void;
}) {
  const { data: clients, mutate: mutateClients } = useSWR<Client[]>(open ? "/clients" : null);
  const { data: users } = useSWR<User[]>(open ? "/users" : null);
  const [newClient, setNewClient] = useState(false);
  const initial = {
    client_id: position?.client_id ?? defaultClientId ?? "",
    title: position?.title ?? "",
    job_code: position?.job_code ?? "",
    department: position?.department ?? "",
    location: position?.location ?? "",
    work_mode: position?.work_mode ?? "onsite",
    employment_type: position?.employment_type ?? "full_time",
    min_experience: position?.min_experience ?? "",
    max_experience: position?.max_experience ?? "",
    min_budget: position?.min_budget ?? "",
    max_budget: position?.max_budget ?? "",
    openings: position?.openings ?? 1,
    skills: position?.skills ?? "",
    description: position?.description ?? "",
    priority: position?.priority ?? "medium",
    status: position?.status ?? "open",
    target_date: position?.target_date ?? "",
    recruiter_ids: position?.recruiters.map((r) => r.id) ?? [],
  };
  const { form, setForm, bind } = useForm(initial, open);
  const [busy, setBusy] = useState(false);
  const selected = form.recruiter_ids as number[];

  async function save() {
    setBusy(true);
    try {
      const body = {
        ...form,
        client_id: Number(form.client_id),
        openings: Number(form.openings) || 1,
        min_experience: numOrNull(form.min_experience),
        max_experience: numOrNull(form.max_experience),
        min_budget: numOrNull(form.min_budget),
        max_budget: numOrNull(form.max_budget),
      };
      const saved = position
        ? await api.patch<Position>(`/positions/${position.id}`, body)
        : await api.post<Position>("/positions", body);
      toast.success(position ? "Position updated" : "Position created — recruiters can start adding candidates");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={position ? "Edit position" : "New opening"}
      subtitle="Requirement details shared by the client."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save} disabled={!form.client_id || !String(form.title).trim()}>
            {position ? "Save changes" : "Create position"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-6">
        <Field label="Client *" className="sm:col-span-3">
          <select className="input" {...bind("client_id")}>
            <option value="">Select client…</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" onClick={() => setNewClient(true)} className="mt-1 text-xs font-semibold text-navy-600 hover:underline">
            {clients && clients.length === 0 ? "No clients yet — add one" : "+ New client"}
          </button>
        </Field>
        <Field label="Job title *" className="sm:col-span-3"><input className="input" placeholder="Senior Java Developer" {...bind("title")} /></Field>
        <Field label="Job code" className="sm:col-span-2"><input className="input" placeholder="Optional" {...bind("job_code")} /></Field>
        <Field label="Department" className="sm:col-span-2"><input className="input" {...bind("department")} /></Field>
        <Field label="Location" className="sm:col-span-2"><input className="input" {...bind("location")} /></Field>
        <Field label="Work mode" className="sm:col-span-2">
          <select className="input" {...bind("work_mode")}>
            <option value="onsite">On-site</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
          </select>
        </Field>
        <Field label="Employment" className="sm:col-span-2">
          <select className="input" {...bind("employment_type")}>
            <option value="full_time">Full time</option><option value="contract">Contract</option>
            <option value="contract_to_hire">Contract to hire</option><option value="internship">Internship</option>
          </select>
        </Field>
        <Field label="No. of openings" className="sm:col-span-2"><input className="input" type="number" min={1} {...bind("openings")} /></Field>
        <Field label="Experience (yrs)" className="sm:col-span-3">
          <div className="flex items-center gap-2">
            <input className="input" type="number" step="0.5" placeholder="Min" {...bind("min_experience")} />
            <span className="text-slate-400">to</span>
            <input className="input" type="number" step="0.5" placeholder="Max" {...bind("max_experience")} />
          </div>
        </Field>
        <Field label="Budget (LPA)" className="sm:col-span-3">
          <div className="flex items-center gap-2">
            <input className="input" type="number" step="0.1" placeholder="Min" {...bind("min_budget")} />
            <span className="text-slate-400">to</span>
            <input className="input" type="number" step="0.1" placeholder="Max" {...bind("max_budget")} />
          </div>
        </Field>
        <Field label="Priority" className="sm:col-span-2">
          <select className="input" {...bind("priority")}>
            <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
        <Field label="Status" className="sm:col-span-2">
          <select className="input" {...bind("status")}>
            <option value="open">Open</option><option value="on_hold">On hold</option><option value="filled">Filled</option><option value="closed">Closed</option>
          </select>
        </Field>
        <Field label="Target date" className="sm:col-span-2"><input className="input" type="date" {...bind("target_date")} /></Field>
        <Field label="Key skills" className="sm:col-span-6"><input className="input" placeholder="Java, Spring Boot, Microservices" {...bind("skills")} /></Field>
        <Field label="Job description" className="sm:col-span-6"><textarea className="input min-h-24" {...bind("description")} /></Field>
        <div className="sm:col-span-6">
          <span className="label">Assign recruiters</span>
          <div className="flex flex-wrap gap-2">
            {users?.filter((u) => u.is_active).map((u) => {
              const on = selected.includes(u.id);
              return (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => setForm((f) => ({ ...f, recruiter_ids: on ? selected.filter((x) => x !== u.id) : [...selected, u.id] }))}
                  className={clsx(
                    "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition",
                    on ? "border-navy-300 bg-navy-50 text-navy-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  <Avatar name={u.full_name} size="sm" />
                  {u.full_name}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
    <ClientFormModal
      open={newClient}
      onClose={() => setNewClient(false)}
      onSaved={(c) => {
        mutateClients();
        setForm((f) => ({ ...f, client_id: c.id }));
      }}
    />
    </>
  );
}
