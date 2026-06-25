import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowUpDown, X } from "lucide-react";

export const Route = createFileRoute("/employees")({
  head: () => ({ meta: [{ title: "Employees — GoldGuard AI" }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const employees = useApp((s) => s.employees);
  const inspections = useApp((s) => s.inspections);
  const branches = useApp((s) => s.branches);
  const [branchFilter, setBranchFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"inspections" | "accuracy" | "flagged">("inspections");
  const [selected, setSelected] = useState<string | null>(null);

  const list = useMemo(() => {
    let r = employees.slice();
    if (branchFilter !== "All") r = r.filter((e) => e.branch === branchFilter);
    r.sort((a, b) => (b as any)[sortBy] - (a as any)[sortBy]);
    return r;
  }, [employees, branchFilter, sortBy]);

  const sel = employees.find((e) => e.id === selected);
  const selIns = sel ? inspections.filter((i) => i.appraiser === sel.name) : [];

  return (
    <>
      <AppHeader title="Employee Productivity" subtitle="Appraiser performance, accuracy, and trends" right={
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-11 px-4 rounded-2xl glass text-sm font-medium">
          <option value="All">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
        </select>
      } />

      <GlassCard className="overflow-hidden mb-6">
        <div className="p-5 flex items-center gap-3 border-b border-black/5">
          <div className="text-sm font-semibold">Sort by</div>
          {(["inspections", "accuracy", "flagged"] as const).map((k) => (
            <button key={k} onClick={() => setSortBy(k)} className={"text-xs px-3 py-1.5 rounded-lg font-semibold capitalize " + (sortBy === k ? "bg-[color:var(--gold)] text-white" : "bg-black/5 text-foreground/60")}>
              <ArrowUpDown className="size-3 inline mr-1" />{k}
            </button>
          ))}
        </div>
        <div className="divide-y divide-black/5">
          {list.map((e, i) => (
            <button key={e.id} onClick={() => setSelected(e.id)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-white/40 text-left transition">
              <div className="size-7 text-[10px] font-bold rounded-lg bg-foreground/5 grid place-items-center text-foreground/45">#{i + 1}</div>
              <div className="size-11 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center font-bold">{e.initials}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{e.name}</div>
                <div className="text-[11px] text-foreground/55">{e.designation} • {e.branch}</div>
              </div>
              <div className="hidden md:block w-24 h-10">
                <ResponsiveContainer><LineChart data={e.trend.map((v, i) => ({ i, v }))}>
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke="#D4AF37" strokeWidth={2} dot={false} />
                </LineChart></ResponsiveContainer>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">{e.inspections}</div>
                <div className="text-[10px] text-foreground/50 uppercase tracking-wider">Insp</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[color:var(--risk)]">{e.flagged}</div>
                <div className="text-[10px] text-foreground/50 uppercase tracking-wider">Flagged</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-[color:var(--gold)]">{e.accuracy}%</div>
                <div className="text-[10px] text-foreground/50 uppercase tracking-wider">Accuracy</div>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>

      {sel && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <GlassCard variant="strong" className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="size-14 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center font-bold text-lg">{sel.initials}</div>
                  <div>
                    <h3 className="text-2xl font-bold">{sel.name}</h3>
                    <p className="text-sm text-foreground/55">{sel.designation} • {sel.branch}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="size-9 rounded-xl glass grid place-items-center"><X className="size-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-4 rounded-xl bg-white/50"><div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">Inspections</div><div className="text-display text-2xl">{sel.inspections}</div></div>
                <div className="p-4 rounded-xl bg-white/50"><div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">Accuracy</div><div className="text-display text-2xl text-[color:var(--gold)]">{sel.accuracy}%</div></div>
                <div className="p-4 rounded-xl bg-white/50"><div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">Flagged</div><div className="text-display text-2xl text-[color:var(--risk)]">{sel.flagged}</div></div>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-foreground/45 font-bold mb-2">Recent Inspections</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {selIns.slice(0, 6).map((i) => (
                  <div key={i.id} className="flex items-center justify-between text-xs py-2 border-b border-black/5">
                    <span>{i.id} — {i.customerName}</span>
                    <span className="text-foreground/55">{i.purity} {i.jewelryType}</span>
                  </div>
                ))}
                {selIns.length === 0 && <div className="text-xs text-foreground/50">No inspections recorded.</div>}
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </>
  );
}
