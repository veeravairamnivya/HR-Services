"use client";

import clsx from "clsx";
import { AlertTriangle, CalendarClock, Eye, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, relativeTime } from "@/lib/format";
import { SOURCES, SOURCE_LABEL, stageMeta } from "@/lib/stages";
import type { Candidate, Position } from "@/lib/types";
import { StageSelect } from "./StageSelect";
import { Avatar } from "./ui";

type ColType = "text" | "number" | "email" | "source";

interface Col {
  key: keyof Candidate & string;
  label: string;
  width: number;
  type?: ColType;
  placeholder?: string;
}

const COLS: Col[] = [
  { key: "phone", label: "Phone", width: 130, placeholder: "98xxxxxxxx" },
  { key: "email", label: "Email", width: 210, type: "email", placeholder: "name@mail.com" },
  { key: "current_company", label: "Current Company", width: 160 },
  { key: "current_designation", label: "Designation", width: 150 },
  { key: "total_experience", label: "Exp (yrs)", width: 88, type: "number" },
  { key: "current_ctc", label: "CCTC (L)", width: 88, type: "number" },
  { key: "expected_ctc", label: "ECTC (L)", width: 88, type: "number" },
  { key: "notice_period_days", label: "Notice (d)", width: 92, type: "number" },
  { key: "current_location", label: "Location", width: 130 },
  { key: "source", label: "Source", width: 120, type: "source" },
  { key: "skills", label: "Skills", width: 180 },
  { key: "remarks", label: "Remarks", width: 230 },
];

function display(col: Col, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (col.type === "source") return SOURCE_LABEL[String(value)] ?? String(value);
  return String(value);
}

function toPayload(col: Col, raw: string): string | number | null {
  if (raw.trim() === "") return null;
  if (col.type === "number") {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`${col.label} must be a number`);
    return n;
  }
  return raw.trim();
}

function EditableCell({ col, value, canEdit, onSave }: {
  col: Col;
  value: unknown;
  canEdit: boolean;
  onSave: (value: string | number | null) => Promise<void>;
}) {
  const [editing, setEditingState] = useState(false);
  const editingRef = useRef(false); // guards against Enter + blur committing twice
  const [draft, setDraft] = useState("");
  const original = value === null || value === undefined ? "" : String(value);

  function setEditing(on: boolean) {
    editingRef.current = on;
    setEditingState(on);
  }

  function start() {
    if (!canEdit || editingRef.current) return;
    setDraft(original);
    setEditing(true);
  }

  async function commit(next = draft) {
    if (!editingRef.current) return;
    setEditing(false);
    if (next === original) return;
    try {
      await onSave(toPayload(col, next));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const common = {
    autoFocus: true,
    className: "h-full w-full bg-white px-2 text-[13px] outline-none ring-2 ring-inset ring-navy-400",
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      } else if (e.key === "Escape") setEditing(false);
    },
  };

  return (
    <td className={clsx("sheet-cell p-0", canEdit && "cursor-text hover:bg-navy-50/60")} style={{ minWidth: col.width, maxWidth: col.width }}>
      {editing ? (
        col.type === "source" ? (
          <select {...common} value={draft} onChange={(e) => commit(e.target.value)} onBlur={() => setEditing(false)}>
            <option value="">—</option>
            {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        ) : (
          <input
            {...common}
            type={col.type === "number" ? "number" : "text"}
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commit()}
          />
        )
      ) : (
        <div tabIndex={canEdit ? 0 : -1} onFocus={start} onClick={start} className="flex h-10 items-center truncate px-2 outline-none" title={display(col, value)}>
          {display(col, value) || <span className="text-slate-300">{canEdit ? "—" : ""}</span>}
        </div>
      )}
    </td>
  );
}

const EMPTY_ROW: Record<string, string> = { full_name: "", stage: "sourced" };

function NewRow({ position, onCreated, index }: { position: Position; onCreated: (c: Candidate) => void; index: number }) {
  const [row, setRow] = useState<Record<string, string>>(EMPTY_ROW);
  const [busy, setBusy] = useState(false);
  const [dupe, setDupe] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function checkDuplicate() {
    if (!row.phone && !row.email) return setDupe(null);
    try {
      const matches = await api.get<{ full_name: string; position: { title: string; client: { name: string } } }[]>(
        `/candidates/duplicates?${new URLSearchParams({ ...(row.phone ? { phone: row.phone } : {}), ...(row.email ? { email: row.email } : {}) })}`,
      );
      setDupe(
        matches.length
          ? `Already in the database: ${matches[0]!.full_name} (${matches[0]!.position.title} · ${matches[0]!.position.client.name})${matches.length > 1 ? ` +${matches.length - 1} more` : ""}`
          : null,
      );
    } catch {
      setDupe(null);
    }
  }

  async function save() {
    if (!row.full_name?.trim()) {
      nameRef.current?.focus();
      return toast.error("Enter the candidate name first");
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = { full_name: row.full_name, stage: row.stage };
      for (const col of COLS) if (row[col.key]) body[col.key] = toPayload(col, row[col.key]!);
      const created = await api.post<Candidate>(`/positions/${position.id}/candidates`, body);
      onCreated(created);
      toast.success(`${created.full_name} added`);
      setRow(EMPTY_ROW);
      setDupe(null);
      nameRef.current?.focus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  };
  const inputCls = "h-10 w-full bg-transparent px-2 text-[13px] outline-none placeholder:text-emerald-700/40 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-emerald-400";

  return (
    <>
      {dupe && (
        <tr>
          <td colSpan={COLS.length + 7} className="bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" /> {dupe}
          </td>
        </tr>
      )}
      <tr className="bg-emerald-50/60">
        <td className="sheet-cell sticky left-0 z-10 bg-emerald-50 text-center" style={{ minWidth: 44 }}>
          <Plus className="mx-auto h-4 w-4 text-emerald-600" />
        </td>
        <td className="sheet-cell sticky left-[44px] z-10 bg-emerald-50 p-0 text-center text-xs text-emerald-700" style={{ minWidth: 40 }}>{index}</td>
        <td className="sheet-cell sticky left-[84px] z-10 border-r-2 border-r-slate-200 bg-emerald-50 p-0" style={{ minWidth: 220 }}>
          <input ref={nameRef} className={clsx(inputCls, "font-semibold")} placeholder="+ New candidate name…" value={row.full_name} onChange={(e) => setRow({ ...row, full_name: e.target.value })} onKeyDown={onKeyDown} disabled={busy} />
        </td>
        <td className="sheet-cell px-2" style={{ minWidth: 190 }}>
          <StageSelect value={row.stage!} onChange={(stage) => setRow({ ...row, stage })} />
        </td>
        {COLS.map((col) => (
          <td key={col.key} className="sheet-cell p-0" style={{ minWidth: col.width, maxWidth: col.width }}>
            {col.type === "source" ? (
              <select className={inputCls} value={row[col.key] ?? ""} onChange={(e) => setRow({ ...row, [col.key]: e.target.value })} onKeyDown={onKeyDown}>
                <option value="">Source…</option>
                {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            ) : (
              <input
                className={inputCls}
                type={col.type === "number" ? "number" : "text"}
                step="any"
                placeholder={col.placeholder ?? col.label}
                value={row[col.key] ?? ""}
                onChange={(e) => setRow({ ...row, [col.key]: e.target.value })}
                onBlur={col.key === "phone" || col.key === "email" ? checkDuplicate : undefined}
                onKeyDown={onKeyDown}
              />
            )}
          </td>
        ))}
        <td className="sheet-cell" colSpan={3}>
          <button onClick={save} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
            {busy ? "Saving…" : "Add ↵"}
          </button>
        </td>
      </tr>
    </>
  );
}

export function CandidateSheet({ position, candidates, onUpdated, onCreated, onOpen, onRefresh, selected, setSelected }: {
  position: Position;
  candidates: Candidate[];
  onUpdated: (c: Candidate) => void;
  onCreated: (c: Candidate) => void;
  onOpen: (id: number, tab?: "details" | "interviews") => void;
  onRefresh: () => void;
  selected: Set<number>;
  setSelected: (s: Set<number>) => void;
}) {
  const { user, isManager } = useAuth();
  const assigned = position.recruiters.some((r) => r.id === user?.id);
  const canEditRow = (c: Candidate) => isManager || assigned || c.recruiter_id === user?.id;
  const canAdd = position.status === "open" || position.status === "on_hold";
  const allSelected = candidates.length > 0 && candidates.every((c) => selected.has(c.id));

  async function patch(c: Candidate, body: Record<string, unknown>) {
    const updated = await api.patch<Candidate>(`/candidates/${c.id}`, body);
    onUpdated(updated);
    return updated;
  }

  return (
    <div className="scroll-thin max-h-[calc(100vh-330px)] min-h-[320px] overflow-auto rounded-b-2xl">
      <table className="border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-20">
          <tr className="text-[11px] font-bold uppercase tracking-wide text-white">
            <th className="sticky left-0 z-30 h-10 bg-navy-600 px-3" style={{ minWidth: 44 }}>
              <input
                type="checkbox"
                className="accent-amber-400"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)))}
                aria-label="Select all"
              />
            </th>
            <th className="sticky left-[44px] z-30 bg-navy-600 text-center" style={{ minWidth: 40 }}>#</th>
            <th className="sticky left-[84px] z-30 border-r-2 border-navy-400 bg-navy-600 px-2" style={{ minWidth: 220 }}>Candidate Name</th>
            <th className="bg-navy-800 px-2 text-gold-300" style={{ minWidth: 190 }}>Stage</th>
            {COLS.map((c) => (
              <th key={c.key} className="whitespace-nowrap bg-navy-600 px-2" style={{ minWidth: c.width }}>{c.label}</th>
            ))}
            <th className="bg-navy-800 px-2 text-gold-300" style={{ minWidth: 190 }}>Next Interview</th>
            <th className="bg-navy-600 px-2" style={{ minWidth: 150 }}>Recruiter</th>
            <th className="bg-navy-600 px-2" style={{ minWidth: 110 }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c, i) => {
            const editable = canEditRow(c);
            const rowBg = selected.has(c.id) ? "bg-amber-50" : i % 2 ? "bg-slate-50/60" : "bg-white";
            return (
              <tr key={c.id} className={clsx("group", rowBg)}>
                <td className={clsx("sheet-cell sticky left-0 z-10 text-center", rowBg)}>
                  <input
                    type="checkbox"
                    className="accent-navy-600"
                    checked={selected.has(c.id)}
                    onChange={() => {
                      const next = new Set(selected);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      setSelected(next);
                    }}
                    aria-label={`Select ${c.full_name}`}
                  />
                </td>
                <td className={clsx("sheet-cell sticky left-[44px] z-10 text-center text-xs text-slate-400", rowBg)}>{i + 1}</td>
                <td className={clsx("sheet-cell sticky left-[84px] z-10 border-r-2 border-r-slate-200 p-0", rowBg)} style={{ minWidth: 220 }}>
                  <div className="flex h-10 items-center gap-2 pl-2 pr-1">
                    <span className={clsx("h-2 w-2 shrink-0 rounded-full", stageMeta(c.stage).dot)} />
                    <button onClick={() => onOpen(c.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-slate-800 hover:text-navy-600" title="Open profile">
                      {c.full_name}
                    </button>
                    <button onClick={() => onOpen(c.id)} className="rounded-md p-1 text-slate-400 opacity-0 hover:bg-navy-100 hover:text-navy-600 group-hover:opacity-100" aria-label="Open profile">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {editable && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`Remove ${c.full_name} from this sheet?`)) return;
                          try {
                            await api.del(`/candidates/${c.id}`);
                            toast.success("Removed");
                            onRefresh();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                        className="rounded-md p-1 text-slate-400 opacity-0 hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="sheet-cell px-2">
                  <StageSelect
                    value={c.stage}
                    disabled={!editable}
                    onChange={async (stage) => {
                      try {
                        await patch(c, { stage });
                        toast.success(`${c.full_name} → ${stageMeta(stage).label}`);
                        onRefresh();
                        if (stage === "interview_scheduled") onOpen(c.id, "interviews");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </td>
                {COLS.map((col) => (
                  <EditableCell key={col.key} col={col} value={c[col.key]} canEdit={editable} onSave={async (v) => { await patch(c, { [col.key]: v }); }} />
                ))}
                <td className="sheet-cell">
                  {c.next_interview ? (
                    <button onClick={() => onOpen(c.id, "interviews")} className="flex items-center gap-1.5 rounded-lg bg-gold-50 px-2 py-1 text-xs font-semibold text-gold-800 hover:bg-gold-100">
                      <CalendarClock className="h-3.5 w-3.5" />
                      R{c.next_interview.round_number} · {c.next_interview.scheduled_at ? fmtDateTime(c.next_interview.scheduled_at) : "TBD"}
                    </button>
                  ) : editable ? (
                    <button onClick={() => onOpen(c.id, "interviews")} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-navy-600">
                      + Schedule
                    </button>
                  ) : null}
                </td>
                <td className="sheet-cell">
                  {c.recruiter && (
                    <span className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Avatar name={c.recruiter.full_name} size="sm" /> {c.recruiter.full_name.split(" ")[0]}
                    </span>
                  )}
                </td>
                <td className="sheet-cell text-xs text-slate-400">{relativeTime(c.updated_at)}</td>
              </tr>
            );
          })}
          {canAdd && <NewRow position={position} onCreated={onCreated} index={candidates.length + 1} />}
        </tbody>
      </table>
    </div>
  );
}
