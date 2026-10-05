"use client";

import clsx from "clsx";
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  Flame,
  Gift,
  History,
  Target,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { HBarChart, TrendChart } from "@/components/charts";
import { Avatar, Card, CardHeader, EmptyState, LoadingBlock, Pill, Progress, StageBadge, Tabs } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { fmtDateTime, fmtTime, relativeTime, titleCase } from "@/lib/format";
import { PRIORITY_STYLE, STAGES, stageMeta } from "@/lib/stages";
import type { InterviewWithContext, Position } from "@/lib/types";

interface Dashboard {
  scope: "team" | "me";
  today: string;
  kpis: Record<string, number>;
  stage_distribution: { stage: string; label: string; count: number }[];
  funnel: { stage: string; label: string; count: number }[];
  trend: { month: string; added: number; interviews: number; offers: number; joined: number }[];
  leaderboard: { user_id: number; name: string; added: number; shortlisted: number; interviews: number; offers: number; joined: number; score: number }[];
  upcoming_interviews: InterviewWithContext[];
  recent_activity: {
    id: number;
    candidate_id: number;
    candidate_name: string;
    position_id: number;
    position_title: string;
    client_name: string;
    to_stage: string;
    note: string | null;
    by: string | null;
    at: string;
  }[];
  hot_positions: Position[];
  client_distribution: { client: string; positions: number }[];
  my_day: { added_today: number; daily_target: number; checked_in_at: string | null; attendance_status: string };
}

const KPI_STYLES = [
  "from-navy-700 to-navy-900",
  "from-sky-500 to-cyan-400",
  "from-gold-400 to-gold-600",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-red-400",
  "from-lime-500 to-emerald-500",
  "from-navy-500 to-navy-700",
];

// Current-pipeline stages: everything except closed-out candidates (mirrors the backend's active_pipeline KPI).
const ACTIVE_STAGES = STAGES.filter((s) => !["rejected", "dropped", "joined"].includes(s.key)).map((s) => s.key).join(",");

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Kpi({ label, value, sub, icon: Icon, i, href }: { label: string; value: number | string; sub?: string; icon: typeof Users; i: number; href?: string }) {
  const body = (
    <div className="card group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={clsx("absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-10 transition group-hover:opacity-20", KPI_STYLES[i])} />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs font-medium text-slate-500">{sub}</div>}
        </div>
        <span className={clsx("grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md", KPI_STYLES[i])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function DashboardPage() {
  const { user, isManager } = useAuth();
  const [scope, setScope] = useState<"team" | "me">(isManager ? "team" : "me");
  const { data, isLoading } = useSWR<Dashboard>(`/dashboard?scope=${scope}`);

  if (!user) return null;
  const k = data?.kpis;
  // Each card opens exactly the candidates it counts (same date range, scope and stages as the API).
  const mineParam = scope === "me" ? "&mine=1" : "";
  const today = data?.today ?? "";
  const monthStart = today ? `${today.slice(0, 8)}01` : "";
  const links = {
    pipeline: `/candidates?stage=${ACTIVE_STAGES}${mineParam}`,
    addedMonth: `/candidates?added_from=${monthStart}&added_to=${today}${mineParam}`,
    offersMonth: `/candidates?reached=offer_released&reached_from=${monthStart}&reached_to=${today}${mineParam}`,
    joinedMonth: `/candidates?reached=joined&reached_from=${monthStart}&reached_to=${today}${mineParam}`,
  };
  const myDay = data?.my_day;
  const targetPct = myDay ? (myDay.added_today * 100) / Math.max(myDay.daily_target, 1) : 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-6 text-white shadow-glow sm:p-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-navy-500/30 blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-gold-500 via-gold-300 to-gold-500" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-navy-100">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {greeting()}, {user.full_name.split(" ")[0]} 👋
            </h1>
            <p className="mt-1 text-navy-100">
              {k ? (
                <>
                  <b className="text-white">{k.interviews_today}</b> interviews today · <b className="text-white">{k.open_positions}</b> open positions ·{" "}
                  <b className="text-white">{k.total_openings}</b> seats to fill
                </>
              ) : (
                "Loading your day…"
              )}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/candidates?add=1" className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2 text-sm font-bold text-navy-900 shadow hover:bg-gold-300">
                <UserPlus className="h-4 w-4" /> Add candidates
              </Link>
              <Link href="/interviews" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-bold text-white backdrop-blur hover:bg-white/25">
                <CalendarClock className="h-4 w-4" /> Today&apos;s interviews
              </Link>
            </div>
          </div>
          {myDay && (
            <div className="w-full rounded-2xl bg-white/15 p-5 backdrop-blur lg:w-80">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-bold"><Target className="h-4 w-4" /> My target today</span>
                <span className="font-extrabold">{myDay.added_today}/{myDay.daily_target}</span>
              </div>
              <Progress value={targetPct} className="mt-3 bg-white/20" color="from-gold-300 to-gold-500" />
              <div className="mt-3 flex items-center justify-between text-xs text-navy-100">
                <span>Checked in {fmtTime(myDay.checked_in_at)}</span>
                <span className={clsx("rounded-full px-2 py-0.5 font-bold", myDay.attendance_status === "late" ? "bg-amber-300 text-amber-900" : "bg-emerald-300 text-emerald-900")}>
                  {titleCase(myDay.attendance_status)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-slate-800">Overview</h2>
        <Tabs
          value={scope}
          onChange={setScope}
          tabs={[
            { key: "team", label: "Whole team", icon: Users },
            { key: "me", label: "My numbers", icon: UserCheck },
          ]}
        />
      </div>

      {isLoading && !data ? (
        <LoadingBlock />
      ) : data && k ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi i={0} icon={Building2} label="Active clients" value={k.active_clients} sub="Accounts we are hiring for" href="/clients?status=active" />
            <Kpi i={1} icon={Briefcase} label="Open positions" value={k.open_positions} sub={`${k.total_openings} seats to fill`} href="/positions?status=open" />
            <Kpi i={2} icon={Users} label="Active pipeline" value={k.active_pipeline} sub={`${k.total_candidates} candidates in total`} href={links.pipeline} />
            <Kpi i={3} icon={UserPlus} label="Added this month" value={k.added_month} sub={`${k.added_today} added today`} href={links.addedMonth} />
            <Kpi i={4} icon={CalendarClock} label="Interviews today" value={k.interviews_today} sub={`${k.interviews_week} in the next 7 days`} href="/interviews" />
            <Kpi i={5} icon={Gift} label="Offers this month" value={k.offers_month} sub="Offer letters released" href={links.offersMonth} />
            <Kpi i={6} icon={CheckCircle2} label="Joined this month" value={k.joined_month} sub="Successful closures" href={links.joinedMonth} />
            <Kpi i={7} icon={UserCheck} label="Team present" value={`${k.present_today}/${k.team_size}`} sub="Logged in today" href="/attendance" />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader icon={TrendingUp} title="Hiring trend" subtitle="Last 6 months" />
              <div className="p-4">
                <TrendChart
                  data={data.trend}
                  series={[
                    { key: "added", label: "Candidates added" },
                    { key: "interviews", label: "Interviews" },
                    { key: "offers", label: "Offers" },
                    { key: "joined", label: "Joined" },
                  ]}
                />
              </div>
            </Card>
            <Card>
              <CardHeader icon={Target} title="Pipeline funnel" subtitle="Candidates who reached each stage" />
              <div className="px-2 py-4">
                <HBarChart data={data.funnel} labelKey="label" valueKey="count" name="Candidates" height={320} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader icon={Users} title="Where candidates are right now" subtitle="Current stage across active positions — click to open" />
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-7">
              {data.stage_distribution.map((s) => (
                <Link
                  key={s.stage}
                  href={`/candidates?stage=${s.stage}&position_status=active${mineParam}`}
                  className="rounded-2xl border border-slate-100 p-3 transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-md"
                >
                  <div className="text-2xl font-extrabold text-slate-900">{s.count}</div>
                  <div className="mt-1"><StageBadge stage={s.stage} short /></div>
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={CalendarClock}
                title="Upcoming interviews"
                subtitle="Next 7 days"
                action={<Link href="/interviews" className="text-xs font-bold text-navy-600 hover:underline">View all</Link>}
              />
              {data.upcoming_interviews.length === 0 ? (
                <EmptyState icon={CalendarClock} title="No interviews scheduled" text="Schedule rounds from a candidate's profile in the position sheet." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.upcoming_interviews.map((iv) => (
                    <li key={iv.id}>
                      <Link href={`/positions/${iv.position_id}?candidate=${iv.candidate_id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                        <div className="w-16 shrink-0 rounded-xl bg-navy-50 py-1.5 text-center">
                          <div className="text-[10px] font-bold uppercase text-navy-500">
                            {new Date(iv.scheduled_at!).toLocaleDateString("en-IN", { weekday: "short" })}
                          </div>
                          <div className="text-sm font-extrabold text-navy-700">{fmtTime(iv.scheduled_at)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-slate-800">{iv.candidate_name}</div>
                          <div className="truncate text-xs text-slate-500">
                            {iv.round_name ?? `Round ${iv.round_number}`} · {iv.position_title} · {iv.client_name}
                          </div>
                        </div>
                        <Pill className="bg-slate-100 text-slate-600">{titleCase(iv.mode)}</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader icon={History} title="Recent activity" subtitle="Latest pipeline movements" />
              {data.recent_activity.length === 0 ? (
                <EmptyState icon={History} title="No activity yet" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recent_activity.map((a) => (
                    <li key={a.id}>
                      <Link href={`/positions/${a.position_id}?candidate=${a.candidate_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", stageMeta(a.to_stage).dot)} />
                        <div className="min-w-0 flex-1 text-sm">
                          <span className="font-semibold text-slate-800">{a.candidate_name}</span>
                          <span className="text-slate-500"> → </span>
                          <StageBadge stage={a.to_stage} />
                          <div className="truncate text-xs text-slate-500">
                            {a.position_title} · {a.client_name}
                            {a.by ? ` · by ${a.by}` : ""}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-slate-400">{relativeTime(a.at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                icon={Flame}
                title={scope === "me" ? "My priority positions" : "Priority positions"}
                subtitle="Open requirements sorted by urgency"
                action={<Link href="/positions" className="flex items-center gap-1 text-xs font-bold text-navy-600 hover:underline">All positions <ArrowRight className="h-3 w-3" /></Link>}
              />
              {data.hot_positions.length === 0 ? (
                <EmptyState icon={Briefcase} title="No open positions" />
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                  {data.hot_positions.map((p) => (
                    <Link key={p.id} href={`/positions/${p.id}`} className="rounded-2xl border border-slate-100 p-4 transition hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-800">{p.title}</div>
                          <div className="truncate text-xs text-slate-500">{p.client.name} · {p.location ?? "—"}</div>
                        </div>
                        <Pill className={PRIORITY_STYLE[p.priority]}>{titleCase(p.priority)}</Pill>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-xl bg-slate-50 py-1.5"><div className="font-extrabold text-slate-800">{p.candidate_count}</div>Candidates</div>
                        <div className="rounded-xl bg-navy-50 py-1.5"><div className="font-extrabold text-navy-700">{p.interview_count}</div>Interviewed</div>
                        <div className="rounded-xl bg-emerald-50 py-1.5"><div className="font-extrabold text-emerald-700">{p.joined_count}/{p.openings}</div>Filled</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <CardHeader icon={Award} title="Recruiter leaderboard" subtitle="This month" />
              <ul className="divide-y divide-slate-100">
                {data.leaderboard.map((r, i) => (
                  <li key={r.user_id}>
                    <Link href={`/candidates?recruiter_id=${r.user_id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                    <span className={clsx("grid h-7 w-7 place-items-center rounded-full text-xs font-extrabold", i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500")}>
                      {i + 1}
                    </span>
                    <Avatar name={r.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-800">{r.name}</div>
                      <div className="text-xs text-slate-500">
                        {r.added} added · {r.interviews} interviews · {r.offers} offers · {r.joined} joined
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-navy-600">{r.score}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {data.client_distribution.length > 0 && (
            <Card>
              <CardHeader icon={Building2} title="Open positions by client" />
              <div className="p-4">
                <HBarChart data={data.client_distribution} labelKey="client" valueKey="positions" name="Open positions" height={Math.max(160, data.client_distribution.length * 34)} />
              </div>
            </Card>
          )}
        </>
      ) : null}
    </div>
  );
}
