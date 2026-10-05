"use client";

import clsx from "clsx";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Clock,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Search,
  UserCog,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtTime, titleCase } from "@/lib/format";
import type { Attendance } from "@/lib/types";
import { Avatar, Button, Field, Modal } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/positions", label: "Open Positions", icon: Briefcase },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/interviews", label: "Interviews", icon: CalendarClock },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/attendance", label: "Attendance", icon: CalendarDays },
  { href: "/team", label: "Team", icon: UserCog, managerOnly: true },
];

export function BrandMark({ className }: { className?: string }) {
  // Gold mark on a transparent background (public/abrah-mark.png).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/abrah-mark.png" alt="ABRAH" className={className} />;
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { isManager } = useAuth();
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy-900 text-slate-200 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" onClick={onClose}>
            <BrandMark className="h-11 w-11 object-contain" />
            <div>
              <div className="text-lg font-extrabold leading-tight tracking-[0.2em] text-white">ABRAH</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-400">Recruitment Services</div>
            </div>
          </Link>
          <button className="rounded-lg p-1 text-slate-300 hover:bg-white/10 lg:hidden" onClick={onClose} aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 pb-2 pt-5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Menu</div>
        <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3">
          {NAV.filter((n) => !n.managerOnly || isManager).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={clsx(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  active ? "bg-white/10 text-gold-400" : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {active && <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />}
                <Icon className={clsx("h-[18px] w-[18px]", active ? "text-gold-400" : "text-slate-400")} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-white/5 p-4 text-xs text-slate-300 ring-1 ring-white/10">
          <div className="mb-1 font-bold text-gold-400">Quick tip</div>
          Press <kbd className="rounded bg-white/15 px-1 text-white">Enter</kbd> in the last sheet row to add the next candidate instantly.
        </div>
      </aside>
    </>
  );
}

function AttendanceWidget() {
  const { attendance, setAttendance } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  if (!attendance) return null;
  const checkedOut = Boolean(attendance.logout_at);

  async function checkOut() {
    setBusy(true);
    try {
      const a = await api.post<Attendance>("/attendance/check-out", { work_summary: summary });
      setAttendance(a);
      setOpen(false);
      toast.success(`Checked out · ${a.hours_worked.toFixed(1)} hrs today. Great work!`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    try {
      setAttendance(await api.post<Attendance>("/attendance/check-in"));
      toast.success("Welcome back — you're checked in again.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white py-1 pl-3 pr-1 shadow-sm md:flex">
        <span className={clsx("h-2 w-2 rounded-full", checkedOut ? "bg-slate-400" : "animate-pulse bg-emerald-500")} />
        <div className="text-xs leading-tight">
          <div className="font-semibold text-slate-700">
            {checkedOut ? `Checked out ${fmtTime(attendance.logout_at)}` : `In since ${fmtTime(attendance.login_at)}`}
          </div>
          <div className={attendance.status === "late" ? "text-amber-600" : "text-emerald-600"}>{titleCase(attendance.status)}</div>
        </div>
        {checkedOut ? (
          <Button size="sm" variant="success" icon={LogIn} onClick={checkIn}>
            Check in
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon={Clock} onClick={() => { setSummary(attendance.work_summary ?? ""); setOpen(true); }}>
            Check out
          </Button>
        )}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="End of day check-out"
        subtitle="Share a quick summary of today's work for your manager."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={checkOut} icon={LogOut}>Check out</Button>
          </>
        }
      >
        <Field label="Today's work summary">
          <textarea
            className="input min-h-28"
            placeholder="e.g. Sourced 15 profiles for Python Developer, scheduled 3 interviews, followed up on 2 offers."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Field>
      </Modal>
    </>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.post("/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password updated");
      onClose();
      setCurrent("");
      setNext("");
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
      title="Change password"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save} disabled={!current || next.length < 6}>Update</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Current password"><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
        <Field label="New password" hint="At least 6 characters"><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-2xl py-1 pl-1 pr-2 hover:bg-slate-100">
        <Avatar name={user.full_name} />
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-sm font-bold text-slate-800">{user.full_name}</div>
          <div className="text-[11px] font-medium capitalize text-slate-500">{user.designation ?? user.role}</div>
        </div>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-56 animate-fade-in rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
          <div className="px-3 py-2 text-xs text-slate-500">
            Signed in as <div className="truncate font-semibold text-slate-700">{user.email}</div>
          </div>
          <button onClick={() => { setOpen(false); setPwOpen(true); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <KeyRound className="h-4 w-4" /> Change password
          </button>
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <form
            className="relative max-w-md flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/candidates?q=${encodeURIComponent(search)}`);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input rounded-2xl bg-slate-50 pl-9"
              placeholder="Search candidates by name, phone, email, skill…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <AttendanceWidget />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
