import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, KpiTile, RadialGauge, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Users, ChevronRight, Activity } from "lucide-react";

export const Route = createFileRoute("/manager")({
  head: () => ({ meta: [{ title: "Manager Dashboard — GoldGuard AI" }, { name: "description", content: "Branch manager command view." }] }),
  component: ManagerView,
});

function ManagerView() {
  const branches = useApp((s) => s.branches);
  const inspections = useApp((s) => s.inspections);
  const employees = useApp((s) => s.employees);
  const [branchId, setBranchId] = useState(branches[0].id);
  const branch = branches.find((b) => b.id === branchId)!;

  const branchIns = useMemo(() => inspections.filter((i) => i.branch === branch.name), [inspections, branch]);
  const todayCount = branch.inspectionsToday;
  const pending = branchIns.filter((i) => i.status === "Pending").length;
  const fraud = branchIns.filter((i) => i.status === "High Risk").length;
  const empPerf = employees.filter((e) => e.branch === branch.name);
  const empIndex = empPerf.length ? Math.round(empPerf.reduce((s, e) => s + e.accuracy, 0) / empPerf.length) : 0;

  const hourly = Array.from({ length: 12 }, (_, i) => ({ h: `${9 + i}h`, v: 2 + Math.floor(((Math.sin(i) + 1) * 3 + (i % 3))) }));
  const escalations = branchIns.filter((i) => i.escalationStage).slice(0, 5);

  return (
    <>
      <AppHeader
        title="Manager Command"
        subtitle="Branch-level oversight, employee performance, and escalations"
        right={
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
            className="h-11 px-4 rounded-2xl glass text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30"
          >
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Hero risk score */}
        <GlassCard variant="strong" className="p-8 lg:col-span-1 flex flex-col items-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground/45 mb-6">Branch Risk Score</p>
          <RadialGauge
            value={branch.riskScore}
            size={200}
            thickness={14}
            color={branch.riskScore > 50 ? "var(--risk)" : branch.riskScore > 35 ? "var(--warning)" : "var(--success)"}
            label="Risk Index"
          />
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color:var(--gold)]/10 text-[color:var(--gold)] text-xs font-bold">
            <Activity className="size-3.5" /> {branch.name}
          </div>
          <p className="mt-4 text-sm text-foreground/60 max-w-xs">
            {branch.riskScore > 50 ? "Elevated risk: cluster of suspicious cases detected this week." :
             branch.riskScore > 35 ? "Normal operating risk with isolated flags." :
             "Healthy risk posture across all jewelry categories."}
          </p>
        </GlassCard>

        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <KpiTile label="Today's Inspections" value={todayCount} delta="+8 vs yesterday" tone="default" icon={<Activity className="size-4" />} />
          <KpiTile label="Pending Reviews" value={pending} tone="warning" hint="Awaiting your sign-off" />
          <KpiTile label="Fraud Cases" value={fraud} tone="risk" hint="High risk this period" icon={<AlertTriangle className="size-4" />} />
          <KpiTile label="Employee Performance" value={`${empIndex}%`} tone="gold" hint="Avg accuracy" icon={<Users className="size-4" />} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Hourly */}
        <GlassCard className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold">Inspection Velocity</h3>
            <span className="text-xs font-semibold text-[color:var(--success)] flex items-center gap-1"><TrendingUp className="size-3.5" /> +18%</span>
          </div>
          <p className="text-xs text-foreground/50 mb-4">Hourly volume — today</p>
          <div className="h-40">
            <ResponsiveContainer>
              <AreaChart data={hourly}>
                <defs>
                  <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="v" stroke="#D4AF37" strokeWidth={2.5} fill="url(#goldFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Top appraisers */}
        <GlassCard className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Top Appraisers</h3>
            <Link to="/employees" className="text-xs text-[color:var(--gold)] font-semibold hover:underline flex items-center gap-1">All <ChevronRight className="size-3" /></Link>
          </div>
          <div className="space-y-3">
            {empPerf.slice(0, 5).map((e, idx) => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center text-xs font-bold">{e.initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.name}</div>
                  <div className="text-[11px] text-foreground/50">{e.inspections} insp • {e.flagged} flagged</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-[color:var(--gold)]">{e.accuracy}%</div>
                  <div className="text-[10px] text-foreground/40">#{idx + 1}</div>
                </div>
              </div>
            ))}
            {!empPerf.length && <div className="text-xs text-foreground/50">No appraisers at this branch.</div>}
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">Active Escalations</h3>
            <p className="text-xs text-foreground/50">Cases awaiting manager decision</p>
          </div>
          <Link to="/escalations" className="text-xs text-[color:var(--gold)] font-semibold hover:underline flex items-center gap-1">Open Kanban <ChevronRight className="size-3" /></Link>
        </div>
        {escalations.length === 0 ? <div className="text-xs text-foreground/50">No active escalations.</div> : (
          <div className="space-y-2">
            {escalations.map((i) => (
              <Link key={i.id} to="/inspection/$id" params={{ id: i.id }} className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/60 transition border border-transparent hover:border-black/5">
                <div className="size-10 rounded-xl bg-[color:var(--risk)]/10 text-[color:var(--risk)] grid place-items-center"><AlertTriangle className="size-4" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{i.customerName} — {i.purity} {i.jewelryType}</div>
                  <div className="text-[11px] text-foreground/50">{i.id} • Auth {i.authenticityScore}% • Risk {i.riskScore}</div>
                </div>
                <div className="text-xs font-semibold text-[color:var(--warning)]">{i.escalationStage}</div>
                <StatusChip status={i.status} />
                <ChevronRight className="size-4 text-foreground/40" />
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </>
  );
}
