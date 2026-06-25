import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { LayoutGrid, List, AlertTriangle, Eye, ShieldCheck, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/investigations")({
  head: () => ({ meta: [{ title: "Investigations Workspace — GoldGuard AI" }] }),
  component: InvestigationsPage,
});

type CaseStage = "Open" | "Under Review" | "Escalated" | "Closed";

function fmtINR(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function InvestigationsPage() {
  const inspections = useApp((s) => s.inspections);
  const advance = useApp((s) => s.advanceEscalation);
  const decideLoan = useApp((s) => s.decideLoan);
  
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [stageFilter, setStageFilter] = useState<CaseStage | "All">("All");

  // Categorize cases into stages
  const categorizedCases = useMemo(() => {
    const list = inspections.map((ins) => {
      let stage: CaseStage = "Open";
      
      if (ins.loan.decision === "Approve" || ins.loan.decision === "Reject") {
        stage = "Closed";
      } else if (ins.escalationStage === "Escalated" || ins.escalationStage === "Manager Review") {
        stage = "Escalated";
      } else if (ins.status === "Suspicious" || ins.status === "Pending" || ins.loan.decision === "Hold") {
        stage = "Under Review";
      } else {
        stage = "Open";
      }

      return { ...ins, stage };
    });

    return list;
  }, [inspections]);

  const stages: CaseStage[] = ["Open", "Under Review", "Escalated", "Closed"];

  const filteredCases = useMemo(() => {
    if (stageFilter === "All") return categorizedCases;
    return categorizedCases.filter((c) => c.stage === stageFilter);
  }, [categorizedCases, stageFilter]);

  const handleAdvance = (id: string, stage: CaseStage) => {
    if (stage === "Closed") {
      decideLoan(id, "Approve");
      toast.success("Case marked as Closed (Approved)");
    } else if (stage === "Escalated") {
      advance(id, "Escalated", "Escalated from investigations workspace");
      toast.warning("Case Escalated to Regional Manager");
    } else if (stage === "Under Review") {
      advance(id, "Suspicious", "Moved to Under Review stage");
      toast.info("Case moved to Under Review");
    }
  };

  const getStageIcon = (stage: CaseStage) => {
    if (stage === "Open") return <Clock className="size-4 text-foreground/50" />;
    if (stage === "Under Review") return <AlertTriangle className="size-4 text-[color:var(--warning)]" />;
    if (stage === "Escalated") return <ShieldCheck className="size-4 text-[color:var(--risk)]" />;
    return <Check className="size-4 text-[color:var(--success)]" />;
  };

  return (
    <>
      <AppHeader
        title="Investigation Workspace"
        subtitle="Review, audit, and resolve anomalies or pending cases"
        right={
          <div className="flex gap-1.5 p-1 rounded-2xl glass shrink-0">
            <button
              onClick={() => setView("kanban")}
              className={`p-2 rounded-xl transition ${view === "kanban" ? "bg-[color:var(--gold)] text-white" : "text-foreground/60"}`}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={`p-2 rounded-xl transition ${view === "table" ? "bg-[color:var(--gold)] text-white" : "text-foreground/60"}`}
            >
              <List className="size-4" />
            </button>
          </div>
        }
      />

      {view === "kanban" ? (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 animate-float-in">
          {stages.map((stage) => {
            const items = categorizedCases.filter((c) => c.stage === stage);
            return (
              <GlassCard key={stage} className="p-4 min-h-[500px] flex flex-col bg-white/45">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-2.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    {getStageIcon(stage)} {stage} Cases
                  </h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 py-0.5 rounded-full bg-black/5">
                    {items.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-1 -mr-2">
                  {items.map((i) => (
                    <div key={i.id} className="p-4 rounded-2xl bg-white/80 border border-black/5 shadow-sm hover:shadow-md transition">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono text-foreground/50">{i.id}</span>
                        <StatusChip status={i.status} />
                      </div>
                      <Link
                        to="/inspection/$id"
                        params={{ id: i.id }}
                        className="block font-semibold text-sm hover:text-[color:var(--gold)] truncate"
                      >
                        {i.customerName}
                      </Link>
                      <div className="text-[11px] text-foreground/55 mt-1 truncate">{i.purity} {i.jewelryType} • {i.weight}g</div>
                      
                      <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5">
                        <div className="text-[10px] text-foreground/40">{i.branch}</div>
                        <div className="flex gap-1">
                          {stage === "Open" && (
                            <button
                              onClick={() => handleAdvance(i.id, "Under Review")}
                              className="text-[10px] px-2 py-1 rounded bg-[color:var(--gold)]/10 text-[color:var(--gold)] font-bold"
                            >
                              Review
                            </button>
                          )}
                          {stage === "Under Review" && (
                            <button
                              onClick={() => handleAdvance(i.id, "Escalated")}
                              className="text-[10px] px-2 py-1 rounded bg-[color:var(--risk)]/10 text-[color:var(--risk)] font-bold"
                            >
                              Escalate
                            </button>
                          )}
                          {stage === "Escalated" && (
                            <button
                              onClick={() => handleAdvance(i.id, "Closed")}
                              className="text-[10px] px-2 py-1 rounded bg-[color:var(--success)]/10 text-[color:var(--success)] font-bold"
                            >
                              Resolve
                            </button>
                          )}
                          {stage === "Closed" && (
                            <span className="text-[10px] text-[color:var(--success)] font-bold flex items-center gap-0.5">
                              <Check className="size-3" /> Resolved
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="text-xs text-foreground/40 text-center py-12">No cases in this stage</div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="space-y-4 animate-float-in">
          <GlassCard className="p-4 flex items-center gap-3">
            <span className="text-xs font-semibold">Filter stage</span>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl glass text-xs font-medium"
            >
              <option value="All">All stages</option>
              {stages.map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
          </GlassCard>

          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-black/5 text-foreground/45 text-[10px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Case ID</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Item Description</th>
                    <th className="px-4 py-3 text-left">Branch</th>
                    <th className="px-4 py-3 text-left">Stage</th>
                    <th className="px-4 py-3 text-left">Result Status</th>
                    <th className="px-4 py-3 text-right">LTV & Value</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredCases.map((c) => (
                    <tr key={c.id} className="hover:bg-white/30 transition">
                      <td className="px-4 py-3 font-semibold">{c.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{c.customerName}</div>
                        <div className="text-[10px] text-foreground/50">{c.customerId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{c.purity} {c.jewelryType}</div>
                        <div className="text-[10px] text-foreground/50">{c.weight}g</div>
                      </td>
                      <td className="px-4 py-3 text-foreground/60">{c.branch}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold inline-flex items-center gap-1">
                          {getStageIcon(c.stage)} {c.stage}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusChip status={c.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold">{fmtINR(c.loan.amount)}</div>
                        <div className="text-[10px] text-foreground/50">LTV {c.loan.ltv}%</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to="/inspection/$id"
                          params={{ id: c.id }}
                          className="text-[11px] text-[color:var(--gold)] font-bold hover:underline inline-flex items-center gap-0.5"
                        >
                          <Eye className="size-3" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredCases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-foreground/45">
                        No cases match the selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  );
}
