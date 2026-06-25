import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, RadialGauge } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

export const Route = createFileRoute("/branches")({
  head: () => ({ meta: [{ title: "Branches — GoldGuard AI" }] }),
  component: Branches,
});

function Branches() {
  const branches = useApp((s) => s.branches);
  const [selected, setSelected] = useState<string[]>(branches.map((b) => b.id));

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const data = useMemo(() => branches.filter((b) => selected.includes(b.id)).map((b) => ({
    name: b.city, fraud: b.fraudRate, approval: b.approvalRate, risk: b.riskScore, today: b.inspectionsToday,
  })), [branches, selected]);

  return (
    <>
      <AppHeader title="Multi-Branch Monitoring" subtitle={`${branches.length} branches under live supervision`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {branches.map((b) => (
          <GlassCard key={b.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{b.city}</div>
                <h3 className="text-lg font-bold mt-0.5">{b.name}</h3>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} className="accent-[color:var(--gold)]" /> Compare
              </label>
            </div>
            <div className="flex items-center justify-center my-3">
              <RadialGauge value={b.riskScore} size={120} thickness={10} color={b.riskScore > 50 ? "var(--risk)" : b.riskScore > 35 ? "var(--warning)" : "var(--success)"} label="Risk" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Item label="Today" value={b.inspectionsToday} />
              <Item label="Pending" value={b.pendingReviews} />
              <Item label="Fraud" value={`${b.fraudRate}%`} tone="risk" />
              <Item label="Approval" value={`${b.approvalRate}%`} tone="success" />
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="p-6">
        <h3 className="text-lg font-bold mb-1">Branch Comparison</h3>
        <p className="text-xs text-foreground/50 mb-4">Comparing {data.length} selected branches</p>
        <div className="h-72">
          <ResponsiveContainer><BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={11} />
            <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
            <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
            <Legend />
            <Bar dataKey="today" name="Today's Inspections" fill="#D4AF37" radius={[8, 8, 0, 0]} />
            <Bar dataKey="approval" name="Approval %" fill="#2E8B57" radius={[8, 8, 0, 0]} />
            <Bar dataKey="fraud" name="Fraud %" fill="#C0392B" radius={[8, 8, 0, 0]} />
          </BarChart></ResponsiveContainer>
        </div>
      </GlassCard>
    </>
  );
}

function Item({ label, value, tone }: { label: string; value: string | number; tone?: "risk" | "success" }) {
  const cls = tone === "risk" ? "text-[color:var(--risk)]" : tone === "success" ? "text-[color:var(--success)]" : "text-foreground";
  return (
    <div className="p-2.5 rounded-lg bg-white/50">
      <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">{label}</div>
      <div className={"text-sm font-bold mt-0.5 " + cls}>{value}</div>
    </div>
  );
}
