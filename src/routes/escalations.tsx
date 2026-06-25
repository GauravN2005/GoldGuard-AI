import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { GlassCard, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { type EscalationStage } from "@/lib/mock-data";

export const Route = createFileRoute("/escalations")({
  head: () => ({ meta: [{ title: "Escalations — GoldGuard AI" }] }),
  component: Escalations,
});

const STAGES: EscalationStage[] = ["Suspicious", "Escalated", "Manager Review", "Final Decision"];

function Escalations() {
  const inspections = useApp((s) => s.inspections);
  const advance = useApp((s) => s.advanceEscalation);
  const addNotif = useApp((s) => s.addNotification);

  const cases = inspections.filter((i) => i.escalationStage);

  const next = (stage: EscalationStage): EscalationStage | null => {
    const i = STAGES.indexOf(stage);
    return i < STAGES.length - 1 ? STAGES[i + 1] : null;
  };

  return (
    <>
      <AppHeader title="Case Escalations" subtitle={`${cases.length} cases moving through the fraud-handling pipeline`} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map((stage) => {
          const items = cases.filter((c) => c.escalationStage === stage);
          return (
            <GlassCard key={stage} className="p-4 min-h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold">{stage}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45 px-2 py-0.5 rounded-full bg-foreground/5">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((i) => (
                  <div key={i.id} className="p-3 rounded-xl bg-white/70 border border-black/5">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="size-3.5 text-[color:var(--warning)]" />
                      <StatusChip status={i.status} />
                    </div>
                    <Link to="/inspection/$id" params={{ id: i.id }} className="block text-sm font-semibold hover:text-[color:var(--gold)]">{i.customerName}</Link>
                    <div className="text-[11px] text-foreground/55">{i.id} • {i.purity} {i.jewelryType}</div>
                    <div className="text-[11px] text-foreground/55">Auth {i.authenticityScore}% • Risk {i.riskScore}</div>
                    <div className="flex gap-1 mt-3">
                      {next(stage) && (
                        <button onClick={() => {
                          advance(i.id, next(stage)!);
                          addNotif({ type: "Review Required", title: `Case advanced to ${next(stage)}`, message: `${i.id} — ${i.customerName}` });
                          toast.success(`Moved to ${next(stage)}`);
                        }} className="text-[11px] px-2.5 py-1 rounded-lg bg-[color:var(--gold)]/10 text-[color:var(--gold)] font-semibold inline-flex items-center gap-1">
                          {next(stage)} <ChevronRight className="size-3" />
                        </button>
                      )}
                      {stage === "Manager Review" && (
                        <>
                          <button onClick={() => { advance(i.id, "Final Decision", "Approved by manager"); toast.success("Approved"); }} className="text-[11px] px-2.5 py-1 rounded-lg bg-[color:var(--success)]/15 text-[color:var(--success)] font-semibold">Approve</button>
                          <button onClick={() => { advance(i.id, "Final Decision", "Rejected by manager"); toast.error("Rejected"); }} className="text-[11px] px-2.5 py-1 rounded-lg bg-[color:var(--risk)]/15 text-[color:var(--risk)] font-semibold">Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="text-[11px] text-foreground/40 text-center py-8">No cases here</div>}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </>
  );
}
