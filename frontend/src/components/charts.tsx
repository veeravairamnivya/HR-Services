"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Categorical slots in fixed order (validated for adjacent-pair colour-blind separation).
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
// Single hue for magnitude charts.
export const MAGNITUDE = "#6366f1";

const axis = { stroke: "#94a3b8", fontSize: 11, tickLine: false, axisLine: false } as const;

function TooltipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1 font-bold text-slate-800">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-slate-600">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data, series }: { data: Record<string, string | number>[]; series: { key: string; label: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="month" {...axis} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip content={<TooltipBox />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stroke={SERIES[i]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
            type="monotone"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, labelKey, valueKey, name, height = 300, color = MAGNITUDE }: {
  data: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  name: string;
  height?: number;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }} barCategoryGap={4}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey={labelKey} width={120} {...axis} tick={{ fill: "#475569", fontSize: 11 }} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey={valueKey} name={name} fill={color} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", fill: "#475569", fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GroupedBarChart({ data, labelKey, series, height = 300 }: {
  data: Record<string, string | number>[];
  labelKey: string;
  series: { key: string; label: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke="#eef2f7" vertical={false} />
        <XAxis dataKey={labelKey} {...axis} interval={0} tick={{ fill: "#475569", fontSize: 11 }} />
        <YAxis allowDecimals={false} {...axis} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "#f1f5f9" }} />
        <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#475569" }} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
