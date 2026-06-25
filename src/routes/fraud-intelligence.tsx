import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, KpiTile } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { AlertTriangle, TrendingUp, ShieldAlert, Award } from "lucide-react";

export const Route = createFileRoute("/fraud-intelligence")({
  head: () => ({ meta: [{ title: "Fraud Intelligence — GoldGuard AI" }] }),
  component: FraudIntelligencePage,
});

function FraudIntelligencePage() {
  const inspections = useApp((s) => s.inspections);
  const branches = useApp((s) => s.branches);

  const fraudStats = useMemo(() => {
    const total = inspections.length;
    const flagged = inspections.filter((i) => i.status === "High Risk" || i.status === "Suspicious").length;
    const totalWeight = inspections.filter((i) => i.status === "High Risk" || i.status === "Suspicious").reduce((sum, i) => sum + i.weight, 0);
    return {
      total,
      flagged,
      weight: totalWeight,
      rate: total ? +((flagged / total) * 100).toFixed(1) : 0,
    };
  }, [inspections]);

  // Simulated top fraud patterns
  const topPatterns = [
    { name: "Tungsten Core Sub", count: 14, color: "#C0392B" },
    { name: "Gold-Plated Brass", count: 11, color: "#E67E22" },
    { name: "Acid-Resistant Coating", count: 8, color: "#D4AF37" },
    { name: "Counterfeit Hallmark", count: 6, color: "#9CA3AF" },
    { name: "Solder Joint Dilution", count: 4, color: "#2E8B57" },
  ];

  // Jewelry target counts from flagged cases
  const jewelryTargets = useMemo(() => {
    const map: Record<string, number> = {};
    inspections
      .filter((i) => i.status === "High Risk" || i.status === "Suspicious")
      .forEach((i) => {
        map[i.jewelryType] = (map[i.jewelryType] || 0) + 1;
      });

    const colors = ["#C0392B", "#E67E22", "#D4AF37", "#6B7280", "#2E8B57", "#3B82F6", "#8B5CF6"];
    return Object.entries(map).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length],
    }));
  }, [inspections]);

  // Monthly trend from inspections
  const monthlyData = [
    { month: "Jun", cases: 3 },
    { month: "Jul", cases: 5 },
    { month: "Aug", cases: 7 },
    { month: "Sep", cases: 6 },
    { month: "Oct", cases: 9 },
    { month: "Nov", cases: fraudStats.flagged },
  ];

  const sortedBranches = useMemo(() => {
    return branches.slice().sort((a, b) => b.fraudRate - a.fraudRate);
  }, [branches]);

  return (
    <>
      <AppHeader
        title="Fraud Intelligence Center"
        subtitle="Global threat patterns, gold loan dilution vectors, and risk ranking insights"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiTile label="Total Flagged Cases" value={fraudStats.flagged} delta="+12% MoM" tone="risk" icon={<ShieldAlert className="size-4" />} />
        <KpiTile label="Average Fraud Rate" value={`${fraudStats.rate}%`} hint="Of total inspections" tone="default" icon={<TrendingUp className="size-4" />} />
        <KpiTile label="Flagged Collateral" value={`${fraudStats.weight.toFixed(1)} g`} hint="Intercepted weight" tone="gold" icon={<AlertTriangle className="size-4" />} />
        <KpiTile label="Primary Threat Vector" value="Tungsten Sub" hint="Tungsten-core jewelry" tone="warning" icon={<Award className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Top Fraud Patterns */}
        <GlassCard className="p-6 xl:col-span-2">
          <h3 className="text-lg font-bold mb-1">Top Fraud Patterns</h3>
          <p className="text-xs text-foreground/50 mb-4">Most common methods used in flagged cases</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={topPatterns}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {topPatterns.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Target Jewelry Categories */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Common Jewelry Targets</h3>
          <p className="text-xs text-foreground/50 mb-4">Dilution targets within flagged gold collateral</p>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={jewelryTargets} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {jewelryTargets.map((s, idx) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3 max-h-24 overflow-y-auto pr-1">
            {jewelryTargets.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.color }} /> {s.name}</span>
                <span className="font-semibold">{s.value} cases</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly Fraud Growth */}
        <GlassCard className="p-6 xl:col-span-2">
          <h3 className="text-lg font-bold mb-1">Monthly Fraud Growth</h3>
          <p className="text-xs text-foreground/50 mb-4">6-month rolling chart of intercepted cases</p>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="fraudFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C0392B" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#C0392B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="month" stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="cases" stroke="#C0392B" strokeWidth={2.5} fill="url(#fraudFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* High-Risk Branch Rankings */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-4">High-Risk Branch Rankings</h3>
          <div className="space-y-4">
            {sortedBranches.map((b) => (
              <div key={b.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-[color:var(--risk)] font-bold">{b.fraudRate}% fraud rate</span>
                </div>
                <div className="text-[10px] text-foreground/45 mb-1.5">{b.fraudCases} fraud cases • Risk Index {b.riskScore}</div>
                <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[color:var(--risk)]" style={{ width: `${(b.fraudRate / 6) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
