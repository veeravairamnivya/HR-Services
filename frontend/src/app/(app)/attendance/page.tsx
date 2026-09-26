"use client";

import clsx from "clsx";
import { CalendarDays, CheckCircle2, Clock, Download, Timer, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Avatar, Button, Card, CardHeader, EmptyState, LoadingBlock, PageHeader, Pill, Tabs } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtTime, isoDay, titleCase } from "@/lib/format";
import type { Attendance, UserBrief } from "@/lib/types";

interface TeamToday {
  day: string;
  present: number;
  total: number;
  rows: { user: UserBrief; attendance: Attendance | null }[];
}
interface Summary {
  working_days: number;
  summary: { user_id: number; name: string; role: string; present: number; late: number; absent: number; avg_hours: number; total_hours: number }[];
}

function statusPill(status: string) {
  return <Pill className={status === "late" ? "bg-amber-100 text-amber-700" : status === "absent" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}>{titleCase(status)}</Pill>;
}

function MyAttendance() {
  const { data } = useSWR<Attendance[]>("/attendance/me?days=31");
  if (!data) return <LoadingBlock />;
  const late = data.filter((d) => d.status === "late").length;
  const avg = data.length ? data.reduce((s, d) => s + d.hours_worked, 0) / data.length : 0;
  const byDay = new Map(data.map((d) => [d.work_date, d]));
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 34 + i);
    return isoDay(d);
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Days present (31d)", value: data.length, icon: CheckCircle2, cls: "from-emerald-500 to-teal-400" },
          { label: "Late check-ins", value: late, icon: Clock, cls: "from-amber-500 to-orange-400" },
          { label: "Avg hours / day", value: avg.toFixed(1), icon: Timer, cls: "from-indigo-500 to-violet-500" },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className={clsx("flex items-center justify-between rounded-2xl bg-gradient-to-br p-5 text-white shadow-md", cls)}>
            <div><div className="text-3xl font-extrabold">{value}</div><div className="text-xs font-semibold uppercase tracking-wide text-white/85">{label}</div></div>
            <Icon className="h-8 w-8 text-white/70" />
          </div>
        ))}
      </div>
      <Card>
        <CardHeader icon={CalendarDays} title="Last 5 weeks" subtitle="Each square is a day — hover for details" />
        <div className="grid grid-cols-7 gap-2 p-5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="text-center text-[11px] font-bold uppercase text-slate-400">{d}</div>)}
          {Array.from({ length: (new Date(`${days[0]}T00:00:00`).getDay() + 6) % 7 }).map((_, i) => <div key={`pad${i}`} />)}
          {days.map((day) => {
            const rec = byDay.get(day);
            const weekend = new Date(`${day}T00:00:00`).getDay() === 0;
            return (
              <div
                key={day}
                title={rec ? `${fmtDate(day)} · in ${fmtTime(rec.login_at)} · ${rec.hours_worked.toFixed(1)}h` : fmtDate(day)}
                className={clsx(
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold",
                  rec ? (rec.status === "late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700") : weekend ? "bg-slate-50 text-slate-300" : day > isoDay() ? "bg-slate-50 text-slate-300" : "bg-rose-50 text-rose-400",
                )}
              >
                {new Date(`${day}T00:00:00`).getDate()}
                {rec && <span className="text-[10px] font-semibold opacity-80">{fmtTime(rec.login_at)}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-100" /> On time</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-rose-50" /> Absent</span>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader icon={Clock} title="Daily log" />
        {data.length === 0 ? <EmptyState icon={Clock} title="No records yet" /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Date</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">In</th><th className="px-3 py-3">Out</th><th className="px-3 py-3">Hours</th><th className="px-3 py-3">Work summary</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-semibold text-slate-700">{fmtDate(r.work_date, { weekday: "short", day: "2-digit", month: "short" })}</td>
                  <td className="px-3 py-3">{statusPill(r.status)}</td>
                  <td className="px-3 py-3">{fmtTime(r.login_at)}</td>
                  <td className="px-3 py-3">{fmtTime(r.logout_at)}</td>
                  <td className="px-3 py-3">{r.hours_worked.toFixed(1)}</td>
                  <td className="max-w-md truncate px-3 py-3 text-xs text-slate-500">{r.work_summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function TeamAttendance() {
  const [day, setDay] = useState(isoDay());
  const first = new Date();
  const [start, setStart] = useState(isoDay(new Date(first.getFullYear(), first.getMonth(), 1)));
  const [end, setEnd] = useState(isoDay());
  const { data: today } = useSWR<TeamToday>(`/attendance/today${qs({ day })}`);
  const { data: report } = useSWR<Summary>(`/reports/attendance${qs({ start, end })}`);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          icon={UserCheck}
          title="Who's in"
          subtitle={today ? `${today.present} of ${today.total} team members logged in` : undefined}
          action={<input type="date" className="input w-40 py-1.5" value={day} onChange={(e) => setDay(e.target.value)} />}
        />
        {!today ? <LoadingBlock /> : (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {today.rows.map(({ user, attendance }) => (
              <div key={user.id} className={clsx("flex items-center gap-3 rounded-2xl border p-3", attendance ? "border-emerald-100 bg-emerald-50/50" : "border-rose-100 bg-rose-50/50")}>
                <Avatar name={user.full_name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-800">{user.full_name}</div>
                  <div className="text-xs text-slate-500">
                    {attendance ? <>In {fmtTime(attendance.login_at)}{attendance.logout_at ? ` · Out ${fmtTime(attendance.logout_at)}` : " · working"}</> : "Not logged in"}
                  </div>
                </div>
                {attendance ? statusPill(attendance.status) : <UserX className="h-5 w-5 text-rose-400" />}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          icon={CalendarDays}
          title="Attendance summary"
          subtitle={report ? `${report.working_days} working days (Mon–Sat)` : undefined}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" className="input w-40 py-1.5" value={start} onChange={(e) => setStart(e.target.value)} />
              <input type="date" className="input w-40 py-1.5" value={end} onChange={(e) => setEnd(e.target.value)} />
              <Button size="sm" variant="secondary" icon={Download} onClick={() => api.download(`/reports/export/attendance${qs({ start, end })}`).catch((e) => toast.error(e.message))}>Excel</Button>
            </div>
          }
        />
        {!report ? <LoadingBlock /> : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">Name</th><th className="px-3 py-3">Present</th><th className="px-3 py-3">Late</th><th className="px-3 py-3">Absent</th><th className="px-3 py-3">Avg hours</th><th className="px-3 py-3">Total hours</th><th className="px-3 py-3 w-48">Attendance %</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.summary.map((r) => {
                const pct = report.working_days ? Math.round((r.present / report.working_days) * 100) : 0;
                return (
                  <tr key={r.user_id}>
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><Avatar name={r.name} size="sm" /><span className="font-semibold text-slate-800">{r.name}</span><span className="text-xs capitalize text-slate-400">{r.role}</span></div></td>
                    <td className="px-3 py-3 font-bold text-emerald-600">{r.present}</td>
                    <td className="px-3 py-3 text-amber-600">{r.late}</td>
                    <td className="px-3 py-3 text-rose-600">{r.absent}</td>
                    <td className="px-3 py-3">{r.avg_hours}</td>
                    <td className="px-3 py-3">{r.total_hours}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                        <span className="w-10 text-right text-xs font-bold">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState<"me" | "team">(isManager ? "team" : "me");
  return (
    <div>
      <PageHeader icon={CalendarDays} title="Attendance" subtitle="Daily login is captured automatically when you sign in or open the app." />
      {isManager && (
        <div className="mb-5">
          <Tabs value={tab} onChange={setTab} tabs={[{ key: "team", label: "Team" }, { key: "me", label: "My attendance" }]} />
        </div>
      )}
      {tab === "team" && isManager ? <TeamAttendance /> : <MyAttendance />}
    </div>
  );
}
