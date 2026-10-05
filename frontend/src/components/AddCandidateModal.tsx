"use client";

import { AlertTriangle, Save, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SOURCES, STAGES } from "@/lib/stages";
import type { Candidate, Position } from "@/lib/types";
import { Button, Field, Modal } from "./ui";

type Form = Record<string, string>;

const EMPTY: Form = { stage: "sourced" };

const NUMBER_FIELDS = [
  "total_experience",
  "relevant_experience",
  "current_ctc",
  "expected_ctc",
  "notice_period_days",
] as const;

const TEXT_FIELDS: { key: string; label: string; placeholder?: string; type?: string }[] = [
  { key: "phone", label: "Phone", placeholder: "98xxxxxxxx" },
  { key: "email", label: "Email", placeholder: "name@mail.com", type: "email" },
  { key: "current_company", label: "Current company" },
  { key: "current_designation", label: "Current designation" },
];

interface Match {
  full_name: string;
  position: { title: string; client: { name: string } };
}

/** Add a candidate to any open position from anywhere in the app. */
export function AddCandidateModal({ open, onClose, onCreated, defaultPositionId }: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Candidate) => void;
  defaultPositionId?: number;
}) {
  const { user } = useAuth();
  const { data: positions } = useSWR<Position[]>(open ? "/positions?status=active" : null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [dupe, setDupe] = useState<string | null>(null);

  // Positions assigned to the current user first, then the rest.
  const sorted = useMemo(() => {
    const mine = (p: Position) => p.recruiters.some((r) => r.id === user?.id);
    return [...(positions ?? [])].sort((a, b) => Number(mine(b)) - Number(mine(a)));
  }, [positions, user?.id]);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY, position_id: defaultPositionId ? String(defaultPositionId) : "" });
      setDupe(null);
    }
  }, [open, defaultPositionId]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function checkDuplicate() {
    if (!form.phone && !form.email) return setDupe(null);
    const params = new URLSearchParams();
    if (form.phone) params.set("phone", form.phone);
    if (form.email) params.set("email", form.email);
    try {
      const matches = await api.get<Match[]>(`/candidates/duplicates?${params}`);
      setDupe(
        matches.length
          ? `Already in the database: ${matches[0]!.full_name} (${matches[0]!.position.title} · ${matches[0]!.position.client.name})${matches.length > 1 ? ` and ${matches.length - 1} more` : ""}`
          : null,
      );
    } catch {
      setDupe(null);
    }
  }

  async function save(addAnother: boolean) {
    if (!form.position_id) return toast.error("Choose the position this candidate is for");
    if (!form.full_name?.trim()) return toast.error("Enter the candidate's name");
    const body: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (key === "position_id" || value === "") continue;
      body[key] = (NUMBER_FIELDS as readonly string[]).includes(key) ? Number(value) : value;
    }
    setBusy(true);
    try {
      const created = await api.post<Candidate>(`/positions/${form.position_id}/candidates`, body);
      toast.success(`${created.full_name} added`);
      onCreated(created);
      if (addAnother) {
        setForm({ ...EMPTY, position_id: form.position_id, stage: form.stage ?? "sourced" });
        setDupe(null);
      } else {
        onClose();
      }
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
      title="Add candidate"
      subtitle="Fill in what you have — only the position and name are required."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" icon={UserPlus} loading={busy} onClick={() => save(true)}>Save & add another</Button>
          <Button icon={Save} loading={busy} onClick={() => save(false)}>Save candidate</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Position *" className="sm:col-span-2">
          <select className="input" value={form.position_id ?? ""} onChange={set("position_id")} aria-label="Position">
            <option value="">{positions ? "Select the opening…" : "Loading positions…"}</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.client.name}
                {p.recruiters.some((r) => r.id === user?.id) ? " (assigned to me)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Full name *">
          <input className="input" autoFocus value={form.full_name ?? ""} onChange={set("full_name")} aria-label="Full name" />
        </Field>
        <Field label="Stage">
          <select className="input" value={form.stage ?? "sourced"} onChange={set("stage")}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        {TEXT_FIELDS.map(({ key, label, placeholder, type }) => (
          <Field key={key} label={label}>
            <input
              className="input"
              type={type ?? "text"}
              placeholder={placeholder}
              value={form[key] ?? ""}
              onChange={set(key)}
              onBlur={key === "phone" || key === "email" ? checkDuplicate : undefined}
              aria-label={label}
            />
          </Field>
        ))}
        {dupe && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {dupe}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total exp (yrs)"><input className="input" type="number" step="0.1" min={0} value={form.total_experience ?? ""} onChange={set("total_experience")} /></Field>
          <Field label="Relevant exp (yrs)"><input className="input" type="number" step="0.1" min={0} value={form.relevant_experience ?? ""} onChange={set("relevant_experience")} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Current CTC (L)"><input className="input" type="number" step="0.1" min={0} value={form.current_ctc ?? ""} onChange={set("current_ctc")} /></Field>
          <Field label="Expected CTC (L)"><input className="input" type="number" step="0.1" min={0} value={form.expected_ctc ?? ""} onChange={set("expected_ctc")} /></Field>
          <Field label="Notice (days)"><input className="input" type="number" min={0} value={form.notice_period_days ?? ""} onChange={set("notice_period_days")} /></Field>
        </div>
        <Field label="Current location"><input className="input" value={form.current_location ?? ""} onChange={set("current_location")} /></Field>
        <Field label="Preferred location"><input className="input" value={form.preferred_location ?? ""} onChange={set("preferred_location")} /></Field>
        <Field label="Source">
          <select className="input" value={form.source ?? ""} onChange={set("source")}>
            <option value="">—</option>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Resume link"><input className="input" placeholder="https://drive.google.com/…" value={form.resume_url ?? ""} onChange={set("resume_url")} /></Field>
        <Field label="Skills" className="sm:col-span-2"><input className="input" placeholder="Java, Spring Boot, SQL" value={form.skills ?? ""} onChange={set("skills")} /></Field>
        <Field label="Remarks" className="sm:col-span-2"><textarea className="input min-h-20" value={form.remarks ?? ""} onChange={set("remarks")} /></Field>
      </div>
    </Modal>
  );
}
