"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { forwardRef, useEffect, type ComponentType, type ReactNode } from "react";
import { avatarColor, initials } from "@/lib/format";
import { stageMeta } from "@/lib/stages";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow hover:from-indigo-500 hover:to-violet-500",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: "sm" | "md";
    loading?: boolean;
    icon?: ComponentType<{ className?: string }>;
  }
>(function Button({ variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
});

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action, icon: Icon }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, icon: Icon }: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        {Icon && (
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-glow">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}

export function StageBadge({ stage, short }: { stage: string; short?: boolean }) {
  const meta = stageMeta(stage);
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", meta.chip)}>
      <span className={clsx("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {short ? meta.short : meta.label}
    </span>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      title={name}
      className={clsx(
        "inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white",
        avatarColor(name),
        size === "sm" && "h-6 w-6 text-[10px]",
        size === "md" && "h-8 w-8 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-indigo-500", className)} />;
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 text-indigo-500">
        <Icon className="h-7 w-7" />
      </span>
      <h3 className="font-bold text-slate-800">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, children, className, hint }: {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return <ModalInner {...{ onClose, title, subtitle, footer, wide }}>{children}</ModalInner>;
}

function ModalInner({ onClose, title, subtitle, children, footer, wide }: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={clsx("relative my-8 w-full animate-fade-in rounded-2xl bg-white shadow-2xl", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-6 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, width = "max-w-2xl" }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return <DrawerInner onClose={onClose} width={width}>{children}</DrawerInner>;
}

function DrawerInner({ onClose, children, width }: { onClose: () => void; children: ReactNode; width: string }) {
  useEscape(onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/30 backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={clsx("relative flex h-full w-full animate-slide-in flex-col bg-white shadow-2xl", width)}>{children}</div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { key: T; label: string; icon?: ComponentType<{ className?: string }>; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={clsx(
            "flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition",
            value === key ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {Icon && <Icon className="h-4 w-4" />}
          {label}
          {count !== undefined && (
            <span className={clsx("rounded-full px-1.5 text-[11px]", value === key ? "bg-indigo-100" : "bg-slate-200")}>{count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, message = "Are you sure?", ...props }: React.ComponentProps<typeof Button> & {
  onConfirm: () => void;
  message?: string;
}) {
  return (
    <Button
      {...props}
      onClick={() => {
        if (window.confirm(message)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}

export function Progress({ value, className, color = "from-indigo-500 to-fuchsia-500" }: {
  value: number;
  className?: string;
  color?: string;
}) {
  return (
    <div className={clsx("h-2 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={clsx("h-full rounded-full bg-gradient-to-r transition-all", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
