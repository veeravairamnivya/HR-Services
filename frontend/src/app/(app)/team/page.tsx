"use client";

import clsx from "clsx";
import { Pencil, Plus, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Avatar, Button, EmptyState, Field, LoadingBlock, Modal, PageHeader, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, relativeTime, titleCase } from "@/lib/format";
import type { User } from "@/lib/types";

const ROLE_STYLE: Record<string, string> = {
  admin: "bg-rose-100 text-rose-700",
  manager: "bg-gold-100 text-gold-800",
  recruiter: "bg-sky-100 text-sky-700",
};

function UserModal({ open, onClose, user, onSaved }: { open: boolean; onClose: () => void; user: User | null; onSaved: () => void }) {
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open)
      setForm({
        full_name: user?.full_name ?? "",
        email: user?.email ?? "",
        password: "",
        role: user?.role ?? "recruiter",
        phone: user?.phone ?? "",
        designation: user?.designation ?? "",
        daily_target: String(user?.daily_target ?? 5),
        is_active: user?.is_active ?? true,
      });
  }, [open, user]);

  async function save() {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { ...form, daily_target: Number(form.daily_target) || 0 };
      if (user && !form.password) delete body.password;
      if (user) await api.patch(`/users/${user.id}`, body);
      else await api.post("/users", body);
      toast.success(user ? "Team member updated" : "Team member added — share their login details");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const bind = (key: string) => ({ value: String(form[key] ?? ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [key]: e.target.value })) });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.full_name}` : "Add team member"}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{user ? "Save" : "Create account"}</Button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" className="sm:col-span-2"><input className="input" {...bind("full_name")} /></Field>
        <Field label="Email (login)"><input className="input" type="email" {...bind("email")} /></Field>
        <Field label={user ? "New password" : "Password"} hint={user ? "Leave blank to keep current" : "Min 6 characters"}><input className="input" type="password" {...bind("password")} /></Field>
        <Field label="Role">
          <select className="input" {...bind("role")}>
            <option value="recruiter">Recruiter</option><option value="manager">Manager</option><option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Daily target" hint="Candidates to add per day"><input className="input" type="number" min={0} {...bind("daily_target")} /></Field>
        <Field label="Designation"><input className="input" {...bind("designation")} /></Field>
        <Field label="Phone"><input className="input" {...bind("phone")} /></Field>
        {user && (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 sm:col-span-2">
            <input type="checkbox" className="accent-navy-600" checked={Boolean(form.is_active)} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active (can log in)
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function TeamPage() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === "admin";
  const { data, mutate } = useSWR<User[]>("/users?include_inactive=true");
  const [editing, setEditing] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        icon={UserCog}
        title="Team"
        subtitle="Recruiters, managers and their daily targets."
        actions={isAdmin && <Button icon={Plus} onClick={() => { setEditing(null); setOpen(true); }}>Add member</Button>}
      />
      {!data ? <LoadingBlock /> : data.length === 0 ? <EmptyState icon={UserCog} title="No team members" /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((u) => (
            <div key={u.id} className={clsx("card p-5", !u.is_active && "opacity-60")}>
              <div className="flex items-start gap-4">
                <Avatar name={u.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-slate-900">{u.full_name}</h3>
                    {u.role === "admin" && <ShieldCheck className="h-4 w-4 text-rose-500" />}
                  </div>
                  <p className="truncate text-sm text-slate-500">{u.designation ?? titleCase(u.role)}</p>
                  <p className="truncate text-xs text-slate-400">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                </div>
                {isAdmin && (
                  <button onClick={() => { setEditing(u); setOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-navy-600" aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Pill className={ROLE_STYLE[u.role]}>{titleCase(u.role)}</Pill>
                {!u.is_active && <Pill className="bg-slate-200 text-slate-600">Inactive</Pill>}
                <Pill className="bg-amber-50 text-amber-700">Target {u.daily_target}/day</Pill>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Joined {fmtDate(u.created_at)} · Last login {u.last_login_at ? relativeTime(u.last_login_at) : "never"}
              </div>
            </div>
          ))}
        </div>
      )}
      <UserModal open={open} onClose={() => setOpen(false)} user={editing} onSaved={() => mutate()} />
    </div>
  );
}
