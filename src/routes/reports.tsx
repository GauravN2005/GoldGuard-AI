import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Printer, Eye, Crown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — GoldGuard AI" }] }),
  component: ReportsPage,
});

const TYPES = ["All", "Daily", "Weekly", "Monthly", "Branch", "Fraud", "Executive"];

function ReportsPage() {
  const reports = useApp((s) => s.reports);
  const inspections = useApp((s) => s.inspections);
  const branches = useApp((s) => s.branches);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [preview, setPreview] = useState<string | null>(null);
  const [exec, setExec] = useState(false);

  const filtered = useMemo(() => reports.filter((r) =>
    (type === "All" || r.type === type) &&
    (!search || r.title.toLowerCase().includes(search.toLowerCase()) || r.branch.toLowerCase().includes(search.toLowerCase()))
  ), [reports, search, type]);

  const cur = reports.find((r) => r.id === preview);

  const download = (name: string) => {
    const blob = new Blob([`GoldGuard AI Report\n\n${name}\nGenerated ${new Date().toISOString()}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name + ".txt"; a.click(); URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const total = inspections.length;
  const flagged = inspections.filter((i) => i.status === "High Risk").length;
  const fraudRate = +((flagged / total) * 100).toFixed(1);
  const branchRanking = branches.slice().sort((a, b) => b.approvalRate - a.approvalRate);

  return (
    <>
      <AppHeader title="Reports Center" subtitle={`${filtered.length} reports`} search={search} onSearch={setSearch} right={
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-11 px-4 rounded-2xl glass text-sm font-medium">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      } />

      {/* Featured executive report */}
      <GlassCard variant="strong" className="p-6 mb-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-10 size-72 gold-shimmer opacity-15 rounded-full blur-3xl" />
        <div className="relative flex flex-col md:flex-row md:items-center gap-4">
          <div className="size-14 rounded-2xl gold-shimmer text-white grid place-items-center"><Crown className="size-6" /></div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">Executive Summary</div>
            <h3 className="text-2xl font-bold mt-1">Monthly Fraud Summary — November 2025</h3>
            <p className="text-sm text-foreground/55">Board-ready overview with branch ranking, top patterns, and risk posture.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setExec(true)} className="h-11 px-5 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-[color:var(--gold)]/25"><Eye className="size-4" /> Open</button>
            <button onClick={() => download("monthly-fraud-summary-nov-2025")} className="h-11 px-5 rounded-xl glass text-sm font-semibold flex items-center gap-2"><Download className="size-4" /> Download</button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((r) => (
          <GlassCard key={r.id} className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="size-10 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center"><FileText className="size-5" /></div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{r.type}</span>
                <h3 className="font-bold text-sm mt-0.5 line-clamp-2">{r.title}</h3>
              </div>
            </div>
            <p className="text-xs text-foreground/55 mb-3 line-clamp-2">{r.description}</p>
            <div className="flex items-center justify-between text-[11px] text-foreground/50 mb-4">
              <span>{r.branch}</span><span>{r.size}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview(r.id)} className="flex-1 h-9 rounded-lg bg-black/5 text-xs font-semibold hover:bg-black/10 flex items-center justify-center gap-1"><Eye className="size-3.5" /> Preview</button>
              <button onClick={() => download(r.title)} className="flex-1 h-9 rounded-lg bg-[color:var(--gold)] text-white text-xs font-semibold flex items-center justify-center gap-1"><Download className="size-3.5" /> Download</button>
            </div>
          </GlassCard>
        ))}
      </div>

      <Dialog open={!!cur} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl glass-strong border-0">
          <DialogHeader><DialogTitle>{cur?.title}</DialogTitle></DialogHeader>
          {cur && (
            <div className="space-y-4">
              <div className="text-xs text-foreground/55">{cur.type} • {cur.branch} • {cur.date} • {cur.size}</div>
              <p className="text-sm">{cur.description}</p>
              <div className="p-4 rounded-xl bg-white/60 border border-black/5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-foreground/55">Total Inspections</span><span className="font-bold">{total.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between"><span className="text-foreground/55">High Risk Cases</span><span className="font-bold text-[color:var(--risk)]">{flagged}</span></div>
                <div className="flex justify-between"><span className="text-foreground/55">Fraud Rate</span><span className="font-bold">{fraudRate}%</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => download(cur.title)} className="flex-1 h-10 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center justify-center gap-1"><Download className="size-4" /> Download</button>
                <button onClick={() => window.print()} className="flex-1 h-10 rounded-xl glass text-sm font-semibold flex items-center justify-center gap-1"><Printer className="size-4" /> Print</button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Executive Report full view */}
      <Dialog open={exec} onOpenChange={setExec}>
        <DialogContent className="max-w-4xl glass-strong border-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-2xl font-bold">Monthly Fraud Summary — November 2025</DialogTitle></DialogHeader>
          <div className="space-y-6 print-page">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Total Inspections" value={total.toLocaleString("en-IN")} />
              <Stat label="Fraud Rate" value={`${fraudRate}%`} />
              <Stat label="High Risk Cases" value={flagged} />
              <Stat label="Branches" value={branches.length} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-3">Branch Ranking</div>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-foreground/45"><th className="py-2">Branch</th><th className="text-right">Approval %</th><th className="text-right">Fraud %</th><th className="text-right">Risk Score</th></tr></thead>
                <tbody>{branchRanking.map((b, i) => (
                  <tr key={b.id} className="border-t border-black/5">
                    <td className="py-2">{i + 1}. {b.name}</td>
                    <td className="text-right font-semibold text-[color:var(--success)]">{b.approvalRate}%</td>
                    <td className="text-right font-semibold text-[color:var(--risk)]">{b.fraudRate}%</td>
                    <td className="text-right font-semibold">{b.riskScore}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-3">Top Fraud Patterns</div>
              <ul className="text-sm space-y-2">
                <li className="p-3 rounded-lg bg-white/60 border border-black/5">• Gold-plated tungsten substitution detected in 4 cases (Pune South cluster).</li>
                <li className="p-3 rounded-lg bg-white/60 border border-black/5">• Surface-coated brass jewelry attempting 22K declaration (3 cases).</li>
                <li className="p-3 rounded-lg bg-white/60 border border-black/5">• Repeat customer with prior flags — 2 attempts at Pune South.</li>
              </ul>
            </div>
            <div className="border-t border-black/10 pt-4 flex items-center justify-between text-xs">
              <div>
                <div className="text-foreground/55">Prepared for: Board of Directors</div>
                <div className="font-semibold mt-1">Anand Verma, Compliance Lead</div>
              </div>
              <button onClick={() => window.print()} className="h-10 px-4 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold inline-flex items-center gap-2 no-print"><Printer className="size-4" /> Print Report</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-xl bg-white/60 border border-white/70">
      <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">{label}</div>
      <div className="text-display text-2xl mt-1">{value}</div>
    </div>
  );
}
