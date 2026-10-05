"use client";

import clsx from "clsx";
import {
  Briefcase,
  CalendarPlus,
  Clock,
  ExternalLink,
  FileText,
  History,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Trash2,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime, fromLocalInput, lpa, relativeTime, titleCase, toLocalInput } from "@/lib/format";
import { RESULT_STYLE, SOURCES, stageMeta } from "@/lib/stages";
import type { CandidateDetail, Interview, Position, User } from "@/lib/types";
import { StageSelect } from "./StageSelect";
import { Avatar, Button, ConfirmButton, Drawer, EmptyState, Field, LoadingBlock, StageBadge, Tabs } from "./ui";

type Tab = "details" | "interviews" | "timeline";

const DETAIL_FIELDS: { key: keyof CandidateDetail; label: string; type?: "number" | "email" | "url" | "date" | "textarea" | "source"; span?: 2 }[] = [
  { key: "full_name", label: "Full name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", type: "email" },
  { key: "current_company", label: "Current company" },
  { key: "current_designation", label: "Current designation" },
  { key: "total_experience", label: "Total exp (yrs)", type: "number" },
  { key: "relevant_experience", label: "Relevant exp (yrs)", type: "number" },
  { key: "current_ctc", label: "Current CTC (LPA)", type: "number" },
  { key: "expected_ctc", label: "Expected CTC (LPA)", type: "number" },
  { key: "offered_ctc", label: "Offered CTC (LPA)", type: "number" },
  { key: "notice_period_days", label: "Notice period (days)", type: "number" },
  { key: "current_location", label: "Current location" },
  { key: "preferred_location", label: "Preferred location" },
  { key: "source", label: "Source", type: "source" },
  { key: "joining_date", label: "Joining date", type: "date" },
  { key: "resume_url", label: "Resume link", type: "url" },
  { key: "skills", label: "Skills", span: 2 },
  { key: "remarks", label: "Remarks", type: "textarea", span: 2 },
];

function DetailsForm({ candidate, onSaved, canEdit }: { candidate: CandidateDetail; onSaved: () => void; canEdit: boolean }) {
  const { isManager } = useAuth();
  const { data: users } = useSWR<User[]>(isManager ? "/users" : null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const f: Record<string, string> = {};
    for (const { key } of DETAIL_FIELDS) f[key] = candidate[key] == null ? "" : String(candidate[key]);
    f.recruiter_id = candidate.recruiter_id ? String(candidate.recruiter_id) : "";
    setForm(f);
  }, [candidate]);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {};
      for (const { key, type } of DETAIL_FIELDS) body[key] = type === "number" ? (form[key] === "" ? null : Number(form[key])) : form[key];
      if (isManager && form.recruiter_id) body.recruiter_id = Number(form.recruiter_id);
      await api.patch(`/candidates/${candidate.id}`, body);
      toast.success("Candidate saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {DETAIL_FIELDS.map(({ key, label, type, span }) => (
          <Field key={key} label={label} className={span === 2 ? "sm:col-span-2" : undefined}>
            {type === "textarea" ? (
              <textarea className="input min-h-20" disabled={!canEdit} value={form[key] ?? ""} onChange={set(key)} />
            ) : type === "source" ? (
              <select className="input" disabled={!canEdit} value={form[key] ?? ""} onChange={set(key)}>
                <option value="">—</option>
                {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            ) : (
              <input
                className="input"
                disabled={!canEdit}
                type={type === "number" ? "number" : type === "date" ? "date" : type === "email" ? "email" : "text"}
                step={type === "number" ? "any" : undefined}
                value={form[key] ?? ""}
                onChange={set(key)}
              />
            )}
          </Field>
        ))}
        {isManager && (
          <Field label="Recruiter (owner)">
            <select className="input" value={form.recruiter_id ?? ""} onChange={set("recruiter_id")}>
              {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </Field>
        )}
      </div>
      {canEdit && (
        <div className="flex justify-end">
          <Button icon={Save} loading={busy} onClick={save}>Save details</Button>
        </div>
      )}
    </div>
  );
}

function InterviewCard({ interview, onChanged, canEdit }: { interview: Interview; onChanged: () => void; canEdit: boolean }) {
  const [feedback, setFeedback] = useState(interview.feedback ?? "");
  const [when, setWhen] = useState(toLocalInput(interview.scheduled_at));
  useEffect(() => {
    setFeedback(interview.feedback ?? "");
    setWhen(toLocalInput(interview.scheduled_at));
  }, [interview]);

  async function patch(body: Partial<Interview>, message: string) {
    try {
      await api.patch(`/interviews/${interview.id}`, body);
      toast.success(message);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-navy-900 text-sm font-extrabold text-gold-400">
            R{interview.round_number}
          </span>
          <div>
            <div className="font-bold text-slate-800">{interview.round_name ?? `Round ${interview.round_number}`}</div>
            <div className="text-xs text-slate-500">
              {fmtDateTime(interview.scheduled_at)} · {titleCase(interview.mode)}
              {interview.interviewer ? ` · ${interview.interviewer}` : ""}
            </div>
          </div>
        </div>
        <select
          disabled={!canEdit}
          value={interview.result}
          onChange={(e) => patch({ result: e.target.value as Interview["result"] }, "Result recorded — pipeline updated")}
          className={clsx("rounded-full border-0 px-3 py-1 text-xs font-bold", RESULT_STYLE[interview.result])}
        >
          {["pending", "selected", "rejected", "on_hold", "no_show"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
        </select>
      </div>
      {interview.meeting_link && (
        <a href={interview.meeting_link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:underline">
          <Video className="h-3.5 w-3.5" /> Join meeting
        </a>
      )}
      {canEdit && (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          <textarea className="input min-h-16 text-xs" placeholder="Interview feedback…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          <div className="flex flex-col gap-2">
            <input type="datetime-local" className="input text-xs" value={when} onChange={(e) => setWhen(e.target.value)} />
            <Button size="sm" variant="secondary" onClick={() => patch({ feedback, scheduled_at: fromLocalInput(when) }, "Interview updated")}>Save</Button>
          </div>
        </div>
      )}
      {!canEdit && interview.feedback && <p className="mt-2 text-sm text-slate-600">{interview.feedback}</p>}
      {canEdit && (
        <div className="mt-2 text-right">
          <ConfirmButton size="sm" variant="ghost" className="text-rose-600" message="Delete this interview round?" onConfirm={async () => { await api.del(`/interviews/${interview.id}`); onChanged(); }}>
            Delete round
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

function ScheduleForm({ candidate, onDone }: { candidate: CandidateDetail; onDone: () => void }) {
  const nextRound = Math.max(0, ...candidate.interviews.map((i) => i.round_number)) + 1;
  const defaultNames: Record<number, string> = { 1: "Technical Round 1", 2: "Technical Round 2", 3: "Managerial Round" };
  const [form, setForm] = useState({ round_name: defaultNames[nextRound] ?? `Round ${nextRound}`, when: "", mode: "video", interviewer: "", meeting_link: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm((f) => ({ ...f, round_name: defaultNames[nextRound] ?? `Round ${nextRound}` }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextRound]);

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/candidates/${candidate.id}/interviews`, {
        round_number: nextRound,
        round_name: form.round_name,
        scheduled_at: fromLocalInput(form.when),
        mode: form.mode,
        interviewer: form.interviewer,
        meeting_link: form.meeting_link,
      });
      toast.success(`Round ${nextRound} scheduled`);
      setForm((f) => ({ ...f, when: "", interviewer: "", meeting_link: "" }));
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/40 p-4">
      <div className="mb-3 flex items-center gap-2 font-bold text-navy-700"><CalendarPlus className="h-4 w-4" /> Schedule round {nextRound}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Round name"><input className="input" value={form.round_name} onChange={set("round_name")} /></Field>
        <Field label="Date & time"><input className="input" type="datetime-local" value={form.when} onChange={set("when")} /></Field>
        <Field label="Mode">
          <select className="input" value={form.mode} onChange={set("mode")}>
            <option value="video">Video call</option><option value="phone">Phone</option><option value="in_person">In person</option>
          </select>
        </Field>
        <Field label="Interviewer"><input className="input" value={form.interviewer} onChange={set("interviewer")} /></Field>
        <Field label="Meeting link" className="sm:col-span-2"><input className="input" placeholder="https://meet…" value={form.meeting_link} onChange={set("meeting_link")} /></Field>
      </div>
      <div className="mt-3 flex justify-end">
        <Button icon={CalendarPlus} loading={busy} onClick={submit}>Schedule interview</Button>
      </div>
    </div>
  );
}

export function CandidateDrawer({ candidateId, initialTab = "details", onClose, onChanged }: {
  candidateId: number | null;
  initialTab?: Tab;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, isManager } = useAuth();
  const [tab, setTab] = useState<Tab>(initialTab);
  const { data: c, mutate } = useSWR<CandidateDetail>(candidateId ? `/candidates/${candidateId}` : null);

  useEffect(() => setTab(initialTab), [candidateId, initialTab]);

  const refresh = () => {
    mutate();
    onChanged();
  };
  const { data: position } = useSWR<Position>(c ? `/positions/${c.position_id}` : null);
  // Mirrors the backend rule: managers, the owning recruiter, or recruiters assigned to the position.
  const canEdit = Boolean(
    c && user && (isManager || c.recruiter_id === user.id || position?.recruiters.some((r) => r.id === user.id)),
  );

  return (
    <Drawer open={candidateId !== null} onClose={onClose}>
      {!c ? (
        <LoadingBlock />
      ) : (
        <>
          <div className={clsx("relative bg-gradient-to-r px-6 pb-5 pt-6 text-white", "from-navy-900 via-navy-800 to-navy-700")}>
            <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/80 hover:bg-white/15" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-4">
              <Avatar name={c.full_name} size="lg" />
              <div className="min-w-0">
                <h2 className="truncate text-xl font-extrabold">{c.full_name}</h2>
                <p className="truncate text-sm text-navy-100">
                  {[c.current_designation, c.current_company].filter(Boolean).join(" at ") || "—"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1"><Briefcase className="h-3.5 w-3.5" /> {c.position.title} · {c.position.client.name}</span>
              {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 hover:bg-white/25"><Phone className="h-3.5 w-3.5" /> {c.phone}</a>}
              {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 hover:bg-white/25"><Mail className="h-3.5 w-3.5" /> {c.email}</a>}
              {c.resume_url && <a href={c.resume_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 hover:bg-white/25"><FileText className="h-3.5 w-3.5" /> Resume <ExternalLink className="h-3 w-3" /></a>}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white/95 p-3 text-slate-700">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Stage</span>
              <StageSelect
                value={c.stage}
                disabled={!canEdit}
                onChange={async (stage) => {
                  try {
                    await api.post(`/candidates/${c.id}/stage`, { stage });
                    toast.success(`Moved to ${stageMeta(stage).label}`);
                    refresh();
                    if (stage === "interview_scheduled") setTab("interviews");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
              <span className="text-xs text-slate-500">since {relativeTime(c.stage_updated_at)}</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-slate-500"><UserRound className="h-3.5 w-3.5" /> {c.recruiter?.full_name ?? "—"}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 border-b border-slate-100 px-6 py-3 text-center text-xs">
            <div><div className="font-extrabold text-slate-800">{c.total_experience ?? "—"} yrs</div><div className="text-slate-500">Experience</div></div>
            <div><div className="font-extrabold text-slate-800">{lpa(c.current_ctc)}</div><div className="text-slate-500">Current CTC</div></div>
            <div><div className="font-extrabold text-slate-800">{lpa(c.expected_ctc)}</div><div className="text-slate-500">Expected</div></div>
            <div><div className="font-extrabold text-slate-800">{c.notice_period_days ?? "—"} d</div><div className="text-slate-500">Notice</div></div>
          </div>
          <div className="px-6 pt-4">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "details", label: "Details", icon: UserRound },
                { key: "interviews", label: "Interviews", icon: CalendarPlus, count: c.interviews.length },
                { key: "timeline", label: "Timeline", icon: History, count: c.history.length },
              ]}
            />
          </div>
          <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">
            {tab === "details" && <DetailsForm candidate={c} onSaved={refresh} canEdit={canEdit} />}
            {tab === "interviews" && (
              <div className="space-y-4">
                {canEdit && <ScheduleForm candidate={c} onDone={refresh} />}
                {c.interviews.length === 0 ? (
                  <EmptyState icon={Clock} title="No interview rounds yet" text="Scheduling a round moves the candidate to Interview Scheduled. Marking it Selected moves them to Round N Selected automatically." />
                ) : (
                  [...c.interviews].reverse().map((iv) => <InterviewCard key={iv.id} interview={iv} onChanged={refresh} canEdit={canEdit} />)
                )}
              </div>
            )}
            {tab === "timeline" && (
              <ol className="relative ml-3 border-l-2 border-slate-100">
                {c.history.map((h) => (
                  <li key={h.id} className="mb-5 ml-5">
                    <span className={clsx("absolute -left-[9px] mt-1 h-4 w-4 rounded-full ring-4 ring-white", stageMeta(h.to_stage).dot)} />
                    <div className="flex flex-wrap items-center gap-2">
                      <StageBadge stage={h.to_stage} />
                      <span className="text-xs text-slate-400">{fmtDateTime(h.changed_at)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {h.from_stage ? <>from {stageMeta(h.from_stage).label}</> : "Added to pipeline"}
                      {h.changed_by ? ` · by ${h.changed_by.full_name}` : ""}
                    </div>
                    {h.note && <div className="mt-1 flex items-start gap-1 text-sm text-slate-600"><MessageSquare className="mt-0.5 h-3.5 w-3.5 text-slate-400" />{h.note}</div>}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
            <span>Added {fmtDate(c.created_at)} · Source: {c.source ? titleCase(c.source) : "—"}</span>
            {canEdit && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                icon={Trash2}
                className="text-rose-600 hover:bg-rose-50"
                message={`Remove ${c.full_name} from this position?`}
                onConfirm={async () => {
                  await api.del(`/candidates/${c.id}`);
                  toast.success("Candidate removed");
                  onClose();
                  onChanged();
                }}
              >
                Remove
              </ConfirmButton>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}
