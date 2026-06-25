import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fraudTrend, monthlyInspections, approvalTrend } from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — GoldGuard AI" }] }),
  component: Analytics,
});

function Analytics() {
  const branches = useApp((s) => s.branches);
  const inspections = useApp((s) => s.inspections);
  const [branchFilter, setBranchFilter] = useState("All");

  const list = useMemo(() => branchFilter === "All" ? inspections : inspections.filter((i) => i.branch === branchFilter), [inspections, branchFilter]);

  const riskDist = [
    { name: "Genuine", value: list.filter((i) => i.status === "Genuine").length, color: "#2E8B57" },
    { name: "Low Risk", value: list.filter((i) => i.status === "Low Risk").length, color: "#D4AF37" },
    { name: "Suspicious", value: list.filter((i) => i.status === "Suspicious").length, color: "#E67E22" },
    { name: "High Risk", value: list.filter((i) => i.status === "High Risk").length, color: "#C0392B" },
  ];
  const types = ["Necklace", "Bangle", "Ring", "Chain", "Earring", "Coin", "Pendant"];
  const jewelryCat = types.map((t) => ({ name: t, count: list.filter((i) => i.jewelryType === t).length }));
  const branchPerf = branches.map((b) => ({ name: b.city, fraudRate: b.fraudRate, approval: b.approvalRate }));

  return (
    <>
      <AppHeader title="Analytics Center" subtitle="Fraud trends, distributions, and branch insights" right={
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-11 px-4 rounded-2xl glass text-sm font-medium">
          <option value="All">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
      } />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Fraud Trend</h3>
          <p className="text-xs text-foreground/50 mb-4">Cases flagged per day — last 30 days</p>
          <div className="h-64">
            <ResponsiveContainer><LineChart data={fraudTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" stroke="rgba(0,0,0,0.4)" fontSize={10} interval={3} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Line type="monotone" dataKey="cases" stroke="#C0392B" strokeWidth={2.5} dot={false} />
            </LineChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Risk Distribution</h3>
          <p className="text-xs text-foreground/50 mb-4">Across {list.length} inspections</p>
          <div className="h-64">
            <ResponsiveContainer><PieChart>
              <Pie data={riskDist} dataKey="value" innerRadius={55} outerRadius={95} paddingAngle={3}>
                {riskDist.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip />
            </PieChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Jewelry Categories</h3>
          <p className="text-xs text-foreground/50 mb-4">Inspection volume by type</p>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={jewelryCat}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={10} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Bar dataKey="count" fill="#D4AF37" radius={[8, 8, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Monthly Inspections</h3>
          <p className="text-xs text-foreground/50 mb-4">6-month rolling</p>
          <div className="h-64">
            <ResponsiveContainer><AreaChart data={monthlyInspections()}>
              <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} /><stop offset="100%" stopColor="#D4AF37" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Area type="monotone" dataKey="total" stroke="#D4AF37" strokeWidth={2.5} fill="url(#g1)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Branch Performance</h3>
          <p className="text-xs text-foreground/50 mb-4">Fraud rate vs approval rate</p>
          <div className="h-64">
            <ResponsiveContainer><BarChart data={branchPerf}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Bar dataKey="approval" fill="#2E8B57" radius={[8, 8, 0, 0]} />
              <Bar dataKey="fraudRate" fill="#C0392B" radius={[8, 8, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Approval Trends</h3>
          <p className="text-xs text-foreground/50 mb-4">Weekly approvals vs rejections</p>
          <div className="h-64">
            <ResponsiveContainer><LineChart data={approvalTrend()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="date" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Line type="monotone" dataKey="approved" stroke="#2E8B57" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="rejected" stroke="#C0392B" strokeWidth={2.5} dot={false} />
            </LineChart></ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <FraudHeatMap />
    </>
  );
}

function FraudHeatMap() {
  const branches = useApp((s) => s.branches);
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...branches.map((b) => b.fraudRate));

  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-bold mb-1">Fraud Heat Map</h3>
      <p className="text-xs text-foreground/50 mb-6">Geographic distribution of flagged cases across active branches</p>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-center">
        <div className="relative bg-gradient-to-br from-[color:var(--gold)]/5 to-white/40 rounded-2xl border border-black/5 aspect-[5/4] overflow-hidden">
          <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
            {/* Stylized india outline */}
            <path d="M50 8 C58 10 64 14 68 22 L74 32 C78 40 80 48 76 56 L72 64 C68 72 64 78 56 82 L50 88 L44 82 C40 78 36 70 32 62 L28 52 C26 42 28 32 34 24 L40 16 C44 10 48 8 50 8 Z"
              fill="rgba(212,175,55,0.08)" stroke="rgba(212,175,55,0.35)" strokeWidth="0.4" />
            {branches.map((b) => {
              const intensity = b.fraudRate / max;
              const radius = 2 + intensity * 4;
              const isHover = hover === b.id;
              return (
                <g key={b.id} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                  <circle cx={b.mapX} cy={b.mapY} r={radius + 4} fill="#C0392B" opacity={intensity * 0.2} />
                  <circle cx={b.mapX} cy={b.mapY} r={radius} fill="#C0392B" opacity={0.85}>
                    <animate attributeName="r" values={`${radius};${radius + 1.5};${radius}`} dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={b.mapX} y={b.mapY - radius - 1.5} fontSize="2.2" textAnchor="middle" fill="#1a1a1a" fontWeight={isHover ? 700 : 500}>{b.city}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-3">Hotspots</div>
          {branches.slice().sort((a, b) => b.fraudRate - a.fraudRate).map((b) => (
            <div key={b.id} onMouseEnter={() => setHover(b.id)} onMouseLeave={() => setHover(null)}
              className={"p-3 rounded-xl border transition " + (hover === b.id ? "border-[color:var(--risk)]/40 bg-[color:var(--risk)]/5" : "border-black/5 bg-white/50")}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">{b.city}</div>
                  <div className="text-[10px] text-foreground/50">{b.fraudCases} cases this period</div>
                </div>
                <div className="text-display text-xl text-[color:var(--risk)]">{b.fraudRate}<span className="text-xs">%</span></div>
              </div>
              <div className="h-1.5 bg-black/5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-[color:var(--risk)] rounded-full" style={{ width: `${(b.fraudRate / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
