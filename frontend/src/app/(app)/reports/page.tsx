"use client";

import clsx from "clsx";
import { ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarCheck, Download, Grid3x3, Minus, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { GroupedBarChart } from "@/components/charts";
import { Avatar, Button, Card, CardHeader, EmptyState, LoadingBlock, PageHeader, Pill, Progress, Tabs } from "@/components/ui";
import { api, qs } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtTime, isoDay, titleCase } from "@/lib/format";
import { CLIENT_STATUS_STYLE, POSITION_STATUS_STYLE, STAGES } from "@/lib/stages";

type Tab = "recruiters" | "clients" | "positions" | "daily";

interface RecruiterRow {
  user_id: number; name: string; days_present: number; added: number; target: number; target_pct: number; screening: number;
  shortlisted: number; interviews: number; round1: number; round2: number; round3: number; hr_discussion: number;
  offers: number; joined: number; rejected: number; shortlist_ratio: number; score: number;
}
interface ClientRow {
  client_id: number; name: string; status: string; positions: number; active_positions: number; open_openings: number;
  added: number; shortlisted: number; interviews: number; offers: number; joined: number; total_joined: number;
}
interface PositionRow extends Record<string, string | number> {
  position_id: number; client: string; title: string; status: string; priority: string; openings: number; total: number; recruiters: string;
}
interface DailyRow {
  user_id: number; name: string; role: string; status: string; login_at: string | null; logout_at: string | null; hours: number;
  work_summary: string | null; added: number; target: number; stage_updates: number; shortlisted: number; interviews: number; offers: number; joined: number;
}

function presetRange(key: string): [string, string] {
  const now = new Date();
  const today = isoDay(now);
  if (key === "today") return [today, today];
  if (key === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); return [isoDay(d), today]; }
  if (key === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return [isoDay(first), isoDay(last)];
  }
  if (key === "quarter") { const d = new Date(now); d.setDate(d.getDate() - 89); return [isoDay(d), today]; }
  return [isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), today];
}

function Trend({ label, current, previous }: { label: string; current: number; previous: number }) {
  const diff = current - previous;
  const pct = previous ? Math.round((diff / previous) * 100) : current ? 100 : 0;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <div className="card p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-end justify-between">
        <span className="text-2xl font-extrabold text-slate-900">{current}</span>
        <span className={clsx("flex items-center text-xs font-bold", diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-slate-400")}>
          <Icon className="h-4 w-4" /> {pct > 0 ? "+" : ""}{pct}%
        </span>
      </div>
      <div className="text-[11px] text-slate-400">vs {previous} in the previous 7 days</div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={clsx("whitespace-nowrap px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500", className)}>{children}</th>;
}

export default function ReportsPage() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState<Tab>("recruiters");
  const [preset, setPreset] = useState("month");
  const [[start, end], setRange] = useState<[string, string]>(presetRange("month"));
  const [day, setDay] = useState(isoDay());
  const [posStatus, setPosStatus] = useState("active");

  const { data: weekly } = useSWR<Record<string, { current: number; previous: number }>>("/reports/weekly-summary");
  const { data: recruiters } = useSWR<{ rows: RecruiterRow[] }>(tab === "recruiters" ? `/reports/recruiters${qs({ start, end })}` : null);
  const { data: clients } = useSWR<{ rows: ClientRow[] }>(tab === "clients" ? `/reports/clients${qs({ start, end })}` : null);
  const { data: positions } = useSWR<{ rows: PositionRow[] }>(tab === "positions" ? `/reports/positions${qs({ status: posStatus })}` : null);
  const { data: daily } = useSWR<{ rows: DailyRow[] }>(tab === "daily" && isManager ? `/reports/daily${qs({ day })}` : null);

  function exportCurrent() {
    const path =
      tab === "positions" ? `/reports/export/positions${qs({ status: posStatus })}` :
      tab === "daily" ? `/reports/export/daily${qs({ day })}` :
      `/reports/export/${tab}${qs({ start, end })}`;
    api.download(path).catch((e) => toast.error(e.message));
  }

  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: "recruiters", label: "Recruiter performance", icon: UserRound },
    { key: "clients", label: "Client summary", icon: Building2 },
    { key: "positions", label: "Position pipeline", icon: Grid3x3 },
    ...(isManager ? [{ key: "daily" as Tab, label: "Daily team report", icon: CalendarCheck }] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader icon={BarChart3} title="Reports" subtitle="Productivity, pipeline and closures — export any view to Excel." actions={<Button icon={Download} onClick={exportCurrent}>Export to Excel</Button>} />

      {weekly && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Trend label="Added (7d)" {...weekly.added!} />
          <Trend label="Shortlisted (7d)" {...weekly.shortlisted!} />
          <Trend label="Interviews (7d)" {...weekly.interviews!} />
          <Trend label="Offers (7d)" {...weekly.offers!} />
          <Trend label="Joined (7d)" {...weekly.joined!} />
        </div>
      )}

      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
        <Tabs value={tab} onChange={setTab} tabs={tabs} />
        {(tab === "recruiters" || tab === "clients") && (
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-40" value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value !== "custom") setRange(presetRange(e.target.value)); }}>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="month">This month</option>
              <option value="last_month">Last month</option>
              <option value="quarter">Last 90 days</option>
              <option value="custom">Custom</option>
            </select>
            <input type="date" className="input w-40" value={start} onChange={(e) => { setPreset("custom"); setRange([e.target.value, end]); }} />
            <span className="text-slate-400">→</span>
            <input type="date" className="input w-40" value={end} onChange={(e) => { setPreset("custom"); setRange([start, e.target.value]); }} />
          </div>
        )}
        {tab === "positions" && (
          <select className="input w-48" value={posStatus} onChange={(e) => setPosStatus(e.target.value)}>
            <option value="active">Active (open + on hold)</option><option value="open">Open</option><option value="filled">Filled</option><option value="closed">Closed</option><option value="">All</option>
          </select>
        )}
        {tab === "daily" && <input type="date" className="input w-44" value={day} onChange={(e) => setDay(e.target.value)} />}
      </div>

      {tab === "recruiters" && (!recruiters ? <LoadingBlock /> : (
        <>
          <Card>
            <CardHeader icon={BarChart3} title="Recruiter output" subtitle="Credited to the candidate's owning recruiter" />
            <div className="p-4">
              <GroupedBarChart
                data={recruiters.rows.map((r) => ({ ...r, name: r.name.split(" ")[0]! }))}
                labelKey="name"
                series={[{ key: "added", label: "Added" }, { key: "shortlisted", label: "Shortlisted" }, { key: "interviews", label: "Interviews" }, { key: "offers", label: "Offers" }]}
              />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                  <Th className="pl-5">Recruiter</Th><Th>Days in</Th><Th>Added / target</Th><Th>Screened</Th><Th>Shortlisted</Th><Th>Interviews</Th>
                  <Th>R1</Th><Th>R2</Th><Th>R3</Th><Th>HR</Th><Th>Offers</Th><Th>Joined</Th><Th>Rejected</Th><Th>Shortlisted / added</Th><Th>Score</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recruiters.rows.map((r) => (
                    <tr key={r.user_id} className="hover:bg-slate-50">
                      <td className="px-5 py-3"><div className="flex items-center gap-2"><Avatar name={r.name} size="sm" /><span className="font-semibold text-slate-800">{r.name}</span></div></td>
                      <td className="px-3 py-3">{r.days_present}</td>
                      <td className="px-3 py-3">
                        <div className="text-xs font-semibold">{r.added} / {r.target}</div>
                        <Progress value={r.target_pct} className="mt-1 w-24" color={r.target_pct >= 100 ? "from-emerald-400 to-teal-500" : r.target_pct >= 60 ? "from-amber-400 to-orange-400" : "from-rose-400 to-pink-500"} />
                      </td>
                      <td className="px-3 py-3">{r.screening}</td><td className="px-3 py-3">{r.shortlisted}</td><td className="px-3 py-3">{r.interviews}</td>
                      <td className="px-3 py-3">{r.round1}</td><td className="px-3 py-3">{r.round2}</td><td className="px-3 py-3">{r.round3}</td><td className="px-3 py-3">{r.hr_discussion}</td>
                      <td className="px-3 py-3 font-bold text-amber-600">{r.offers}</td><td className="px-3 py-3 font-bold text-emerald-600">{r.joined}</td>
                      <td className="px-3 py-3 text-rose-600">{r.rejected}</td><td className="px-3 py-3">{r.shortlist_ratio}%</td>
                      <td className="px-3 py-3"><span className="rounded-lg bg-navy-50 px-2 py-0.5 font-extrabold text-navy-700">{r.score}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-slate-100 px-5 py-2 text-[11px] text-slate-400">Score = added + 2×shortlisted + 3×interviews + 8×offers + 15×joined. Target = daily target × days present.</p>
          </Card>
        </>
      ))}

      {tab === "clients" && (!clients ? <LoadingBlock /> : (
        <>
          <Card>
            <CardHeader icon={Building2} title="Client pipeline activity" subtitle="Within the selected dates" />
            <div className="p-4">
              <GroupedBarChart
                data={clients.rows.map((c) => ({ ...c, name: c.name.split(" ")[0]! }))}
                labelKey="name"
                series={[{ key: "added", label: "Added" }, { key: "interviews", label: "Interviews" }, { key: "offers", label: "Offers" }, { key: "joined", label: "Joined" }]}
              />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                  <Th className="pl-5">Client</Th><Th>Status</Th><Th>Active roles</Th><Th>Open seats</Th><Th>Added</Th><Th>Shortlisted</Th><Th>Interviews</Th><Th>Offers</Th><Th>Joined</Th><Th>Joined (all time)</Th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.rows.map((c) => (
                    <tr key={c.client_id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-semibold text-slate-800">{c.name}</td>
                      <td className="px-3 py-3"><Pill className={CLIENT_STATUS_STYLE[c.status]}>{titleCase(c.status)}</Pill></td>
                      <td className="px-3 py-3">{c.active_positions}</td><td className="px-3 py-3">{c.open_openings}</td><td className="px-3 py-3">{c.added}</td>
                      <td className="px-3 py-3">{c.shortlisted}</td><td className="px-3 py-3">{c.interviews}</td>
                      <td className="px-3 py-3 font-bold text-amber-600">{c.offers}</td><td className="px-3 py-3 font-bold text-emerald-600">{c.joined}</td><td className="px-3 py-3">{c.total_joined}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ))}

      {tab === "positions" && (!positions ? <LoadingBlock /> : positions.rows.length === 0 ? <Card><EmptyState icon={Grid3x3} title="No positions" /></Card> : (
        <Card className="overflow-hidden">
          <CardHeader icon={Grid3x3} title="Stage matrix" subtitle="Current number of candidates in each stage, per position (darker = more)" />
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                <Th className="sticky left-0 bg-slate-50 pl-5">Position</Th><Th>Status</Th><Th>Seats</Th><Th>Total</Th>
                {STAGES.map((s) => <Th key={s.key} className="text-center">{s.short}</Th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {positions.rows.map((p) => {
                  const max = Math.max(1, ...STAGES.map((s) => Number(p[s.key] ?? 0)));
                  return (
                    <tr key={p.position_id}>
                      <td className="sticky left-0 bg-white px-5 py-2.5">
                        <a href={`/positions/${p.position_id}`} className="font-semibold text-slate-800 hover:text-navy-600">{p.title}</a>
                        <div className="text-[11px] text-navy-600">{p.client}</div>
                      </td>
                      <td className="px-3 py-2.5"><Pill className={POSITION_STATUS_STYLE[p.status]}>{titleCase(p.status)}</Pill></td>
                      <td className="px-3 py-2.5 font-semibold">{p.openings}</td>
                      <td className="px-3 py-2.5 font-extrabold">{p.total}</td>
                      {STAGES.map((s) => {
                        const v = Number(p[s.key] ?? 0);
                        return (
                          <td key={s.key} className="px-1 py-1.5 text-center">
                            <span
                              className={clsx("inline-block w-9 rounded-md py-1 font-bold", v ? "" : "text-slate-300")}
                              style={v ? { background: `rgba(99,102,241,${0.12 + (v / max) * 0.6})`, color: v / max > 0.55 ? "#fff" : "#3730a3" } : undefined}
                            >
                              {v || "·"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {tab === "daily" && isManager && (!daily ? <LoadingBlock /> : (
        <Card className="overflow-hidden">
          <CardHeader icon={CalendarCheck} title="Daily team report" subtitle={new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} />
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70"><tr>
                <Th className="pl-5">Team member</Th><Th>Attendance</Th><Th>Login</Th><Th>Logout</Th><Th>Hours</Th><Th>Added / target</Th><Th>Stage updates</Th><Th>Shortlisted</Th><Th>Interviews</Th><Th>Offers</Th><Th>Work summary</Th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {daily.rows.map((r) => (
                  <tr key={r.user_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><Avatar name={r.name} size="sm" /><div><div className="font-semibold text-slate-800">{r.name}</div><div className="text-[11px] capitalize text-slate-400">{r.role}</div></div></div></td>
                    <td className="px-3 py-3"><Pill className={r.status === "absent" ? "bg-rose-100 text-rose-700" : r.status === "late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>{titleCase(r.status)}</Pill></td>
                    <td className="px-3 py-3">{fmtTime(r.login_at)}</td><td className="px-3 py-3">{fmtTime(r.logout_at)}</td><td className="px-3 py-3">{r.hours ? r.hours.toFixed(1) : "—"}</td>
                    <td className="px-3 py-3"><span className={clsx("font-bold", r.added >= r.target ? "text-emerald-600" : "text-slate-700")}>{r.added}</span> / {r.target}</td>
                    <td className="px-3 py-3">{r.stage_updates}</td><td className="px-3 py-3">{r.shortlisted}</td><td className="px-3 py-3">{r.interviews}</td><td className="px-3 py-3">{r.offers}</td>
                    <td className="max-w-xs truncate px-3 py-3 text-xs text-slate-500" title={r.work_summary ?? ""}>{r.work_summary ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
