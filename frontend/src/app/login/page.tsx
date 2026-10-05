"use client";

import { ArrowRight, BarChart3, Briefcase, CalendarCheck, Lock, Mail, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  { icon: Briefcase, title: "Client openings", text: "Every requirement in one place with priority and owners." },
  { icon: Users, title: "Candidate sheets", text: "Spreadsheet-style trackers per position, built for speed." },
  { icon: CalendarCheck, title: "Interview rounds", text: "Round 1, 2, 3 → HR → Offer, automatically tracked." },
  { icon: BarChart3, title: "Live reports", text: "Recruiter productivity, client pipeline and attendance." },
];

const DEMO = [
  { label: "Admin", email: "admin@talentbridge.com", password: "Admin@123" },
  { label: "Manager", email: "manager@talentbridge.com", password: "Recruit@123" },
  { label: "Recruiter", email: "priya@talentbridge.com", password: "Recruit@123" },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back! Your attendance for today is marked.");
      router.replace("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-navy-600/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-navy-500/30 blur-3xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/abrah-logo.png" alt="ABRAH" className="relative w-44" />
        <div className="relative">
          <h1 className="text-4xl font-extrabold leading-tight">
            Recruit faster.
            <br />
            <span className="bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-transparent">Close more positions.</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            The daily workspace for the ABRAH recruitment team — from sourcing to offer letters.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur">
                <Icon className="mb-2 h-5 w-5 text-gold-400" />
                <div className="font-bold">{title}</div>
                <div className="text-sm text-slate-300">{text}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-slate-400">© {new Date().getFullYear()} ABRAH Recruitment Services</p>
      </div>

      <div className="flex items-center justify-center bg-gradient-to-b from-white to-gold-50/60 p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 rounded-2xl bg-navy-900 p-4 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/abrah-mark.png" alt="" className="h-10 w-10" />
            <div>
              <div className="text-lg font-extrabold tracking-[0.2em] text-white">ABRAH</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-400">Recruitment Services</div>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Sign in 👋</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your first sign-in each day marks your attendance automatically.
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input py-2.5 pl-9"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="input py-2.5 pl-9"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" loading={busy} className="w-full py-3">
              Sign in & mark attendance <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 rounded-2xl border border-dashed border-navy-200 bg-white/70 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-navy-500">Demo accounts</p>
            <div className="flex flex-wrap gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                  }}
                  className="rounded-xl bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-100"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
