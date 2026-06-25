import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { ArrowUpDown, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — GoldGuard AI" }] }),
  component: HistoryPage,
});

const STATUSES = ["All", "Genuine", "Low Risk", "Suspicious", "High Risk", "Pending"];
const TYPES = ["All", "Necklace", "Bangle", "Ring", "Chain", "Earring", "Coin", "Pendant"];
const PAGE_SIZE = 10;

function HistoryPage() {
  const inspections = useApp((s) => s.inspections);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [type, setType] = useState("All");
  const [sortBy, setSortBy] = useState<"date" | "score" | "weight">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let r = inspections.slice();
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((i) => i.id.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q) || i.branch.toLowerCase().includes(q));
    }
    if (status !== "All") r = r.filter((i) => i.status === status);
    if (type !== "All") r = r.filter((i) => i.jewelryType === type);
    r.sort((a, b) => {
      const av = sortBy === "date" ? +new Date(a.date) : sortBy === "score" ? a.authenticityScore : a.weight;
      const bv = sortBy === "date" ? +new Date(b.date) : sortBy === "score" ? b.authenticityScore : b.weight;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return r;
  }, [inspections, search, status, type, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const cur = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (k: typeof sortBy) => {
    if (sortBy === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir("desc"); }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [["ID", "Date", "Customer", "Type", "Purity", "Weight", "Branch", "Status", "Auth%", "Loan"]];
    filtered.forEach((i) => rows.push([i.id, format(new Date(i.date), "yyyy-MM-dd"), i.customerName, i.jewelryType, i.purity, i.weight, i.branch, i.status, i.authenticityScore, i.loan.amount]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "inspection-history.csv"; a.click(); URL.revokeObjectURL(url);
    toast.success("History exported", { description: `${filtered.length} rows` });
  };

  return (
    <>
      <AppHeader title="Inspection History" subtitle={`${filtered.length} of ${inspections.length} inspections`} search={search} onSearch={(v) => { setSearch(v); setPage(0); }} right={
        <button onClick={exportCsv} className="h-11 px-4 rounded-2xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-[color:var(--gold)]/25"><Download className="size-4" /> Export CSV</button>
      } />

      <GlassCard className="p-5 mb-6">
        <div className="flex flex-wrap gap-3">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="h-10 px-3 rounded-xl glass text-sm font-medium">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(0); }} className="h-10 px-3 rounded-xl glass text-sm font-medium">
            {TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => { setStatus("All"); setType("All"); setSearch(""); setPage(0); }} className="h-10 px-3 rounded-xl text-sm text-foreground/60 hover:bg-black/5">Clear filters</button>
        </div>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-black/5">
              <tr>
                <Th>Inspection</Th>
                <Th sortable onClick={() => toggleSort("date")} active={sortBy === "date"} dir={sortDir}>Date</Th>
                <Th>Branch</Th>
                <Th>Type</Th>
                <Th sortable onClick={() => toggleSort("weight")} active={sortBy === "weight"} dir={sortDir} className="text-right">Weight</Th>
                <Th>Status</Th>
                <Th sortable onClick={() => toggleSort("score")} active={sortBy === "score"} dir={sortDir} className="text-right">Auth%</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {cur.map((i) => (
                <tr key={i.id} className="border-t border-black/5 hover:bg-white/40">
                  <td className="px-4 py-3"><div className="font-semibold">{i.customerName}</div><div className="text-[11px] text-foreground/50">{i.id}</div></td>
                  <td className="px-4 py-3 text-xs">{format(new Date(i.date), "dd MMM yyyy")}</td>
                  <td className="px-4 py-3 text-xs">{i.branch}</td>
                  <td className="px-4 py-3 text-xs">{i.purity} {i.jewelryType}</td>
                  <td className="px-4 py-3 text-right text-xs font-semibold">{i.weight}g</td>
                  <td className="px-4 py-3"><StatusChip status={i.status} /></td>
                  <td className="px-4 py-3 text-right font-bold">{i.authenticityScore}%</td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/inspection/$id" params={{ id: i.id }} className="text-xs text-[color:var(--gold)] font-semibold hover:underline">View</Link>
                  </td>
                </tr>
              ))}
              {cur.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-foreground/50 text-sm">No inspections match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="p-4 flex items-center justify-between border-t border-black/5 text-xs text-foreground/60">
          <div>Page {page + 1} of {pageCount}</div>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="size-9 rounded-xl glass grid place-items-center disabled:opacity-40"><ChevronLeft className="size-4" /></button>
            <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)} className="size-9 rounded-xl glass grid place-items-center disabled:opacity-40"><ChevronRight className="size-4" /></button>
          </div>
        </div>
      </GlassCard>
    </>
  );
}

function Th({ children, sortable, onClick, active, dir, className = "" }: { children?: React.ReactNode; sortable?: boolean; onClick?: () => void; active?: boolean; dir?: "asc" | "desc"; className?: string }) {
  return (
    <th className={"px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-foreground/45 text-left " + className}>
      {sortable ? (
        <button onClick={onClick} className={"inline-flex items-center gap-1 " + (active ? "text-[color:var(--gold)]" : "")}>
          {children} <ArrowUpDown className="size-3" />
          {active && <span className="text-[8px]">{dir === "asc" ? "↑" : "↓"}</span>}
        </button>
      ) : children}
    </th>
  );
}
