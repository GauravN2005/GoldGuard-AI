import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — GoldGuard AI" }] }),
  component: PortfolioView,
});

function fmtINR(n: number) { return "₹ " + n.toLocaleString("en-IN"); }

function PortfolioView() {
  const branches = useApp((s) => s.branches);
  const totalValue = branches.reduce((s, b) => s + b.goldValueToday, 0);
  const totalKg = branches.reduce((s, b) => s + b.goldProcessedKg, 0);
  const avgPurity = "22K";
  const activeLoanValue = Math.round(totalValue * 0.76);

  const trend = Array.from({ length: 30 }, (_, i) => ({ d: i, v: 80 + Math.round(Math.sin(i / 3) * 12 + i * 0.4) }));

  return (
    <>
      <AppHeader title="Gold Portfolio" subtitle="Branch-level inventory and value processed" />

      {/* Hero Wallet card */}
      <GlassCard variant="strong" className="p-8 lg:p-10 mb-6 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 size-80 rounded-full gold-shimmer opacity-25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 size-72 rounded-full bg-[color:var(--gold)]/15 opacity-50 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">Today's Total Gold Value</div>
            <div className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--success)]"><TrendingUp className="size-3.5" /> +6.2% WoW</div>
          </div>
          <div className="text-display text-[64px] lg:text-[112px] leading-none mt-4">{fmtINR(totalValue)}</div>
          <div className="text-sm text-foreground/55 mt-2">Aggregate gold value processed across all branches today</div>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Gold Processed" value={`${totalKg.toFixed(1)} kg`} />
            <Card label="Average Purity" value={avgPurity} />
            <Card label="Active Loans" value={fmtINR(activeLoanValue)} />
            <Card label="Branches Live" value={`${branches.length}`} />
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-1">30-Day Portfolio Value</h3>
          <p className="text-xs text-foreground/50 mb-4">Index (base 100)</p>
          <div className="h-64">
            <ResponsiveContainer><AreaChart data={trend}>
              <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D4AF37" stopOpacity={0.5} /><stop offset="100%" stopColor="#D4AF37" stopOpacity={0} /></linearGradient></defs>
              <Tooltip />
              <Area type="monotone" dataKey="v" stroke="#D4AF37" strokeWidth={2.5} fill="url(#pg)" />
            </AreaChart></ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-4">Branch Breakdown</h3>
          <div className="space-y-3">
            {branches.map((b) => (
              <div key={b.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-foreground/60">{fmtINR(b.goldValueToday)}</span>
                </div>
                <div className="text-[11px] text-foreground/45 mb-1.5">{b.goldProcessedKg} kg • {b.avgPurity} avg</div>
                <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
                  <div className="h-full bg-[color:var(--gold)]" style={{ width: `${(b.goldValueToday / Math.max(...branches.map((x) => x.goldValueToday))) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/60 border border-white/70">
      <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{label}</div>
      <div className="text-display text-2xl mt-1">{value}</div>
    </div>
  );
}
