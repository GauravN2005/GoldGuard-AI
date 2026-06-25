import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, KpiTile, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { fraudTrend, monthlyInspections } from "@/lib/mock-data";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, ChevronRight, Activity, AlertTriangle, CheckCircle2, Clock, ShieldCheck, TrendingUp, FileBarChart } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { type DateRange } from "react-day-picker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GoldGuard AI" },
      { name: "description", content: "Operator dashboard for gold loan inspections and fraud monitoring." },
    ],
  }),
  component: Dashboard,
});

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-8">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-black/5 rounded-md shimmer" />
          <div className="h-8 w-60 bg-black/5 rounded-lg shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="h-11 w-28 bg-black/5 rounded-2xl shimmer" />
          <div className="h-11 w-24 bg-black/5 rounded-2xl shimmer" />
        </div>
      </div>

      {/* KPI Tiles Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        {Array.from({ length: 7 }).map((_, idx) => (
          <div key={idx} className="h-24 bg-black/5 rounded-2xl shimmer p-4 space-y-3">
            <div className="h-3 w-16 bg-black/5 rounded-md" />
            <div className="h-6 w-20 bg-black/5 rounded-md" />
            <div className="h-3 w-12 bg-black/5 rounded-md" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="h-[340px] xl:col-span-2 bg-black/5 rounded-3xl shimmer p-6 space-y-4">
          <div className="h-4 w-40 bg-black/5 rounded-md" />
          <div className="h-3 w-60 bg-black/5 rounded-md" />
          <div className="h-48 w-full bg-black/5 rounded-2xl" />
        </div>
        <div className="h-[340px] bg-black/5 rounded-3xl shimmer p-6 space-y-4">
          <div className="h-4 w-36 bg-black/5 rounded-md" />
          <div className="h-3 w-44 bg-black/5 rounded-md" />
          <div className="h-40 w-40 mx-auto rounded-full bg-black/5" />
        </div>
      </div>

      {/* Bottom Grid Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="h-[380px] xl:col-span-2 bg-black/5 rounded-3xl shimmer p-6 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-40 bg-black/5 rounded-md" />
            <div className="h-4 w-16 bg-black/5 rounded-md" />
          </div>
          <div className="space-y-4 mt-6">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex justify-between items-center border-t border-black/5 pt-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-black/5 rounded-md" />
                  <div className="h-3 w-24 bg-black/5 rounded-md" />
                </div>
                <div className="h-4 w-12 bg-black/5 rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-[380px] bg-black/5 rounded-3xl shimmer p-6 space-y-4">
          <div className="h-4 w-36 bg-black/5 rounded-md" />
          <div className="h-3 w-48 bg-black/5 rounded-md" />
          <div className="h-48 w-full bg-black/5 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const inspections = useApp((s) => s.inspections);
  const branches = useApp((s) => s.branches);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<DateRange | undefined>();

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      if (search) {
        const q = search.toLowerCase();
        if (!i.id.toLowerCase().includes(q) && !i.customerName.toLowerCase().includes(q) &&
            !i.jewelryType.toLowerCase().includes(q) && !i.branch.toLowerCase().includes(q)) return false;
      }
      if (range?.from && new Date(i.date) < range.from) return false;
      if (range?.to && new Date(i.date) > range.to) return false;
      return true;
    });
  }, [inspections, search, range]);

  const total = filtered.length;
  const genuine = filtered.filter((i) => i.status === "Genuine").length;
  const suspicious = filtered.filter((i) => i.status === "Suspicious").length;
  const highRisk = filtered.filter((i) => i.status === "High Risk").length;
  const pending = filtered.filter((i) => i.status === "Pending").length;
  const approved = filtered.filter((i) => i.loan.decision === "Approve").length;
  const approvalRate = total ? Math.round((approved / total) * 100) : 0;
  const fraudRate = total ? +((highRisk / total) * 100).toFixed(1) : 0;

  const statusDist = [
    { name: "Genuine", value: genuine, color: "#2E8B57" },
    { name: "Low Risk", value: filtered.filter((i) => i.status === "Low Risk").length, color: "#D4AF37" },
    { name: "Suspicious", value: suspicious, color: "#E67E22" },
    { name: "High Risk", value: highRisk, color: "#C0392B" },
    { name: "Pending", value: pending, color: "#9CA3AF" },
  ];

  const branchPerf = branches.map((b) => ({
    name: b.city,
    inspections: filtered.filter((i) => i.branch === b.name).length,
    fraud: filtered.filter((i) => i.branch === b.name && (i.status === "High Risk" || i.status === "Suspicious")).length,
  }));

  const ft = useMemo(fraudTrend, []);

  const exportReport = () => {
    const rows: (string | number)[][] = [["ID", "Customer", "Type", "Branch", "Status", "Auth %", "Loan ₹"]];
    filtered.slice(0, 200).forEach((i) => rows.push([i.id, i.customerName, i.jewelryType, i.branch, i.status, i.authenticityScore, i.loan.amount]));
    downloadCsv("goldguard-dashboard.csv", rows);
    toast.success("Report exported", { description: `${rows.length - 1} inspections exported as CSV.` });
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <>
      <AppHeader
        title="Vault Overview"
        subtitle={`Monitoring ${branches.length} branches • Live inspection feed`}
        search={search}
        onSearch={setSearch}
        right={
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button className="h-11 px-4 rounded-2xl glass text-sm font-medium flex items-center gap-2 hover:bg-white/90">
                  <Clock className="size-4 text-foreground/50" />
                  {range?.from ? (range.to ? `${format(range.from, "MMM d")} – ${format(range.to, "MMM d")}` : format(range.from, "MMM d")) : "All time"}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="p-0 glass-strong border-0 rounded-2xl">
                <Calendar mode="range" selected={range} onSelect={setRange} className="p-3 pointer-events-auto" />
                <div className="p-2 border-t border-black/5">
                  <button onClick={() => setRange(undefined)} className="text-xs text-foreground/60 px-3 py-1.5 hover:bg-black/5 rounded-lg">Clear</button>
                </div>
              </PopoverContent>
            </Popover>
            <button onClick={exportReport} className="h-11 px-4 rounded-2xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-[color:var(--gold)]/25 hover:brightness-110 transition">
              <Download className="size-4" /> Export
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
        <KpiTile label="Total Inspections" value={total.toLocaleString("en-IN")} delta="+14% MoM" tone="default" icon={<Activity className="size-4" />} />
        <KpiTile label="Genuine Gold" value={genuine.toLocaleString("en-IN")} tone="success" hint={`${total ? Math.round((genuine / total) * 100) : 0}% verified`} icon={<CheckCircle2 className="size-4" />} />
        <KpiTile label="Suspicious" value={suspicious} tone="warning" hint="Awaiting assay" icon={<AlertTriangle className="size-4" />} />
        <KpiTile label="High Risk" value={highRisk} tone="risk" hint="Action required" icon={<ShieldCheck className="size-4" />} />
        <KpiTile label="Pending Reviews" value={pending} tone="default" hint="Manual audit" icon={<Clock className="size-4" />} />
        <KpiTile label="Approval Rate" value={`${approvalRate}%`} tone="gold" hint="Loan approvals" icon={<TrendingUp className="size-4" />} />
        <KpiTile label="Fraud Detection" value={`${fraudRate}%`} tone="risk" hint="Of total" icon={<FileBarChart className="size-4" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <GlassCard className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold">Fraud Trend — Last 30 Days</h3>
              <p className="text-xs text-foreground/50">Daily flagged cases across all branches</p>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={ft}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="date" stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="cases" stroke="#D4AF37" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: "#D4AF37" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Status Distribution</h3>
          <p className="text-xs text-foreground/50 mb-4">Across {total} inspections</p>
          <div className="h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusDist} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {statusDist.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-3">
            {statusDist.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.color }} /> {s.name}</span>
                <span className="font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <GlassCard className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold">Recent Inspections</h3>
              <p className="text-xs text-foreground/50">{filtered.length} matching</p>
            </div>
            <Link to="/history" className="text-xs font-semibold text-[color:var(--gold)] hover:underline flex items-center gap-1">View all <ChevronRight className="size-3" /></Link>
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-foreground/45">
                  <th className="px-2 pb-3 font-semibold">Inspection</th>
                  <th className="px-2 pb-3 font-semibold">Branch</th>
                  <th className="px-2 pb-3 font-semibold">Appraiser</th>
                  <th className="px-2 pb-3 font-semibold">Status</th>
                  <th className="px-2 pb-3 font-semibold text-right">Auth</th>
                  <th className="px-2 pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 6).map((i) => (
                  <tr key={i.id} className="border-t border-black/5 hover:bg-white/40 transition">
                    <td className="px-2 py-3">
                      <div className="font-semibold">{i.customerName}</div>
                      <div className="text-[11px] text-foreground/50">{i.id} • {i.purity} {i.jewelryType}</div>
                    </td>
                    <td className="px-2 py-3 text-xs">{i.branch}</td>
                    <td className="px-2 py-3 text-xs">{i.appraiser}</td>
                    <td className="px-2 py-3"><StatusChip status={i.status} /></td>
                    <td className="px-2 py-3 text-right font-semibold">{i.authenticityScore}%</td>
                    <td className="px-2 py-3 text-right">
                      <Link to="/inspection/$id" params={{ id: i.id }} className="text-xs text-[color:var(--gold)] font-semibold hover:underline">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h3 className="text-lg font-bold mb-1">Branch Performance</h3>
          <p className="text-xs text-foreground/50 mb-4">Inspections vs flagged cases</p>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={branchPerf}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
                <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
                <Bar dataKey="inspections" fill="#D4AF37" radius={[8, 8, 0, 0]} />
                <Bar dataKey="fraud" fill="#C0392B" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold">Monthly Volume</h3>
            <p className="text-xs text-foreground/50">Inspections vs flagged — last 6 months</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={monthlyInspections()}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <YAxis stroke="rgba(0,0,0,0.4)" fontSize={11} />
              <Tooltip contentStyle={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 12 }} />
              <Bar dataKey="total" fill="#F6E7A1" radius={[8, 8, 0, 0]} />
              <Bar dataKey="flagged" fill="#C0392B" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </>
  );
}
