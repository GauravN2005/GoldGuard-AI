import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, KpiTile, RadialGauge, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Coins, Briefcase, Activity, ShieldAlert, Award, FileText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/executive-dashboard")({
  head: () => ({ meta: [{ title: "Executive Command Center — GoldGuard AI" }] }),
  component: ExecutiveDashboard,
});

function fmtINR(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function ExecutiveDashboard() {
  const branches = useApp((s) => s.branches);
  const inspections = useApp((s) => s.inspections);
  const employees = useApp((s) => s.employees);

  // Financial aggregates
  const stats = useMemo(() => {
    const totalValue = branches.reduce((sum, b) => sum + b.goldValueToday, 0);
    const totalKg = branches.reduce((sum, b) => sum + b.goldProcessedKg, 0);
    
    // Sum of approved loan amounts
    const activeLoans = inspections
      .filter((i) => i.loan.decision === "Approve")
      .reduce((sum, i) => sum + i.loan.amount, 0);

    // Sum of rejected / high risk amounts (exposure prevented)
    const fraudExposure = inspections
      .filter((i) => i.status === "High Risk" || i.status === "Suspicious")
      .reduce((sum, i) => sum + i.loan.amount, 0);

    return {
      goldValue: totalValue,
      goldKg: totalKg,
      activeLoans,
      fraudExposure,
    };
  }, [branches, inspections]);

  // Branch Rankings by performance
  const branchRankings = useMemo(() => {
    return branches.slice().sort((a, b) => b.approvalRate - a.approvalRate);
  }, [branches]);

  // Employee rankings by accuracy
  const employeeRankings = useMemo(() => {
    return employees.slice().sort((a, b) => b.accuracy - a.accuracy);
  }, [employees]);

  // Escalation Summary
  const escalations = useMemo(() => {
    return inspections.filter((i) => i.escalationStage).slice(0, 5);
  }, [inspections]);

  // Weekly processed inventory history
  const historyData = [
    { week: "Week 1", value: 32_00_000, loans: 24_00_000 },
    { week: "Week 2", value: 36_00_000, loans: 27_00_000 },
    { week: "Week 3", value: 41_00_000, loans: 31_00_000 },
    { week: "Week 4", value: stats.goldValue, loans: stats.activeLoans },
  ];

  return (
    <>
      <AppHeader
        title="Executive Command Center"
        subtitle="Regional board view • Gold processed inventory, loan exposures, and compliance audit summaries"
      />

      {/* Boardroom High-level KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiTile label="Total Gold Processed" value={`${stats.goldKg.toFixed(1)} kg`} hint="Across live branch networks" tone="gold" icon={<Coins className="size-4" />} />
        <KpiTile label="Portfolio Asset Value" value={fmtINR(stats.goldValue)} hint="Vault asset inventory today" tone="default" icon={<Briefcase className="size-4" />} />
        <KpiTile label="Active Loan Balance" value={fmtINR(stats.activeLoans)} hint="Total approved disbursements" tone="success" icon={<Activity className="size-4" />} />
        <KpiTile label="Prevented Loss Exposure" value={fmtINR(stats.fraudExposure)} hint="High-risk loan denials" tone="risk" icon={<ShieldAlert className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Cumulative Vault Portfolio & Active Loans */}
        <GlassCard className="p-6 xl:col-span-2">
          <h3 className="text-lg font-bold mb-1">Portfolio Accumulation</h3>
          <p className="text-xs text-foreground/55 mb-4">Collateral Gold Value vs Active Loan Balance</p>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={historyData}>
                <defs>
                  <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="loanGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E8B57" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#2E8B57" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="week" stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <Tooltip formatter={(value: number) => fmtINR(value)} contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Legend />
                <Area type="monotone" name="Collateral Gold Value" dataKey="value" stroke="#D4AF37" strokeWidth={2} fill="url(#valueGrad)" />
                <Area type="monotone" name="Active Loan Balance" dataKey="loans" stroke="#2E8B57" strokeWidth={2} fill="url(#loanGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Branch Portfolios & Leaderboard */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-4">Branch Performance rankings</h3>
          <div className="space-y-4">
            {branchRankings.map((b, idx) => (
              <div key={b.id} className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-black/5 font-mono font-bold text-xs grid place-items-center">#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{b.name}</div>
                  <div className="text-[10px] text-foreground/50">Approve rate {b.approvalRate}% • Fraud {b.fraudRate}%</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[color:var(--gold)]">{fmtINR(b.goldValueToday)}</div>
                  <div className="text-[9px] text-foreground/45 uppercase tracking-wider">{b.goldProcessedKg} kg</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Active Escalation Summary */}
        <GlassCard className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold">Escalation Summary</h3>
              <p className="text-xs text-foreground/50">Urgent branch audits awaiting regional manager sign-off</p>
            </div>
            <Link to="/escalations" className="text-xs text-[color:var(--gold)] font-semibold hover:underline flex items-center gap-1">Open Workspace <ChevronRight className="size-3" /></Link>
          </div>
          <div className="space-y-3">
            {escalations.map((e) => (
              <div key={e.id} className="p-3 rounded-2xl bg-white/60 border border-black/5 flex items-center justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <div className="text-sm font-semibold truncate">{e.customerName}</div>
                  <div className="text-[10px] text-foreground/50 mt-0.5">{e.id} • {e.purity} {e.jewelryType} • {e.branch}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] font-bold text-[color:var(--warning)] bg-[color:var(--warning)]/10 px-2 py-0.5 rounded-full">{e.escalationStage}</span>
                  <StatusChip status={e.status} />
                  <Link to="/inspection/$id" params={{ id: e.id }} className="text-xs font-bold text-[color:var(--gold)] hover:underline">Review</Link>
                </div>
              </div>
            ))}
            {escalations.length === 0 && (
              <div className="text-xs text-foreground/40 text-center py-10">No active escalations recorded.</div>
            )}
          </div>
        </GlassCard>

        {/* Employee Leaderboard Rankings */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Top Appraiser Profiles</h3>
            <Link to="/employees" className="text-xs text-[color:var(--gold)] font-semibold hover:underline flex items-center gap-1">View list <ChevronRight className="size-3" /></Link>
          </div>
          <div className="space-y-3">
            {employeeRankings.slice(0, 5).map((emp, idx) => (
              <div key={emp.id} className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-[color:var(--gold)]/10 text-[color:var(--gold)] grid place-items-center font-bold text-xs">{emp.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{emp.name}</div>
                  <div className="text-[10px] text-foreground/50">{emp.designation} • {emp.branch}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[color:var(--success)]">{emp.accuracy}%</div>
                  <div className="text-[10px] text-foreground/45">Accuracy</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
