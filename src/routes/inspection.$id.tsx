import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, RadialGauge, RiskFactorBar, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { ArrowLeft, FileDown, Printer, ChevronRight, ChevronLeft, Shield, Sparkles, ScanEye, Microscope, FileText, History as HistoryIcon, IndianRupee, ListChecks, Send, Check, X, Image as ImageIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/inspection/$id")({
  head: () => ({ meta: [{ title: "Inspection Detail — GoldGuard AI" }] }),
  component: InspectionDetail,
});

const TABS = [
  { id: "results", label: "Results", icon: Sparkles },
  { id: "risk", label: "Explainable Risk", icon: ScanEye },
  { id: "loan", label: "Loan Decision", icon: IndianRupee },
  { id: "replay", label: "Replay", icon: HistoryIcon },
  { id: "vault", label: "Evidence Vault", icon: Shield },
  { id: "audit", label: "Audit Trail", icon: ListChecks },
] as const;

function fmtINR(n: number) { return "₹ " + n.toLocaleString("en-IN"); }
function fmtTime(iso: string) { return new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }); }

function InspectionDetail() {
  const { id } = Route.useParams();
  const inspection = useApp((s) => s.inspections.find((i) => i.id === id));
  const decideLoan = useApp((s) => s.decideLoan);
  const advanceEscalation = useApp((s) => s.advanceEscalation);
  const addNotification = useApp((s) => s.addNotification);
  const nav = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("results");

  if (!inspection) throw notFound();

  const ins = inspection;
  const cat = ins.status;
  const catColor = cat === "Genuine" ? "var(--success)" : cat === "Low Risk" ? "var(--gold)" : cat === "Suspicious" ? "var(--warning)" : cat === "High Risk" ? "var(--risk)" : "#9ca3af";

  return (
    <>
      <AppHeader
        title={`${ins.customerName}`}
        subtitle={`${ins.id} • ${ins.purity} ${ins.jewelryType} • ${ins.weight}g • ${ins.branch}`}
        right={
          <>
            <Link to="/history" className="h-11 px-4 rounded-2xl glass text-sm font-medium hover:bg-white/90 inline-flex items-center gap-2"><ArrowLeft className="size-4" /> History</Link>
            <button onClick={() => { window.print(); }} className="h-11 px-4 rounded-2xl glass text-sm font-medium hover:bg-white/90 inline-flex items-center gap-2"><Printer className="size-4" /> Print</button>
          </>
        }
      />

      <GlassCard className="p-2 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-4 py-2.5 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2",
                tab === t.id ? "bg-[color:var(--gold)] text-white shadow shadow-[color:var(--gold)]/25" : "text-foreground/60 hover:bg-white/60"
              )}>
                <Icon className="size-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {tab === "results" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-float-in">
          <GlassCard variant="strong" className="p-8 flex flex-col items-center text-center xl:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/45 mb-6">Authenticity Score</p>
            <RadialGauge value={ins.authenticityScore} size={220} thickness={14} color={catColor} label="Confidence" sublabel={`${ins.confidence}% confident`} />
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: catColor + "1a", color: catColor }}>
              <Shield className="size-3.5" /> {ins.status}
            </div>
            <p className="mt-3 text-xs text-foreground/55 max-w-xs">
              {ins.status === "Genuine" ? "All markers align with the declared purity. Safe to process." :
               ins.status === "High Risk" ? "Multiple anomalies — recommend rejection or manual assay." :
               ins.status === "Suspicious" ? "Inconsistencies detected — escalate for manager review." :
               "Within acceptable risk tolerance — verify before approval."}
            </p>
          </GlassCard>

          <div className="xl:col-span-2 space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <ScoreCard label="Risk Score" value={ins.riskScore} tone="risk" />
              <ScoreCard label="Quality Score" value={ins.qualityScore} tone="gold" />
              <ScoreCard label="Confidence" value={ins.confidence} tone="success" />
            </div>

            <GlassCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold">Approval Readiness</h3>
                  <p className="text-xs text-foreground/50">Composite score across all checks</p>
                </div>
                <StatusChip status={ins.loan.decision === "Approve" ? "Approved" : ins.loan.decision === "Reject" ? "Rejected" : ins.loan.decision === "Hold" ? "On Hold" : "Pending"} />
              </div>
              <div className="h-3 bg-black/5 rounded-full overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${ins.authenticityScore}%`, background: catColor }} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-xs">
                <Stat label="Purity" value={ins.purity} />
                <Stat label="Weight" value={`${ins.weight} g`} />
                <Stat label="Market Rate" value={`₹${ins.loan.marketRate}/g`} />
                <Stat label="Branch" value={ins.branch} />
              </div>
            </GlassCard>

            {/* AI Readiness Layer */}
            <GlassCard variant="subtle" className="p-6 border-dashed">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Microscope className="size-4 text-foreground/40" />
                  <h3 className="text-sm font-bold text-foreground/70">AI Analysis Engine</h3>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 px-2 py-0.5 rounded-full bg-foreground/5">Awaiting Backend</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { l: "Computer Vision", v: ins.factors.visualDefect },
                  { l: "Reflection Analysis", v: ins.factors.reflection },
                  { l: "Density Analysis", v: ins.factors.density },
                ].map((x) => (
                  <div key={x.l} className="p-3 rounded-xl bg-white/40 border border-black/5">
                    <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">{x.l}</div>
                    <div className="text-display text-2xl text-foreground/70 mt-1">{x.v}<span className="text-xs text-foreground/40">%</span></div>
                    <div className="text-[10px] text-foreground/40 mt-1">Coming from Backend</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {tab === "risk" && (
        <GlassCard className="p-6 lg:p-8 animate-float-in">
          <h3 className="text-lg font-bold mb-1">Explainable Risk Analysis</h3>
          <p className="text-xs text-foreground/50 mb-6">Factors contributing to the final score, with their relative impact.</p>
          <div className="space-y-5">
            <RiskFactorBar name="Density Verification" score={ins.factors.density} impact={28} />
            <RiskFactorBar name="Surface Analysis" score={ins.factors.surface} impact={22} />
            <RiskFactorBar name="Reflection Analysis" score={ins.factors.reflection} impact={18} />
            <RiskFactorBar name="Touchstone Analysis" score={ins.factors.touchstone} impact={20} />
            <RiskFactorBar name="Visual Defect Detection" score={ins.factors.visualDefect} impact={12} />
          </div>
          <div className="mt-8 p-4 rounded-2xl bg-[color:var(--gold)]/8 border border-[color:var(--gold)]/15">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold)] mb-1">System Reasoning</div>
            <p className="text-sm">{ins.notes}</p>
          </div>
        </GlassCard>
      )}

      {tab === "loan" && (
        <LoanDecisionTab inspection={ins} onDecide={(d, ltv) => {
          decideLoan(ins.id, d, ltv);
          if (d === "Approve") {
            addNotification({ type: "Inspection Completed", title: "Loan approved", message: `${ins.id} approved at ${ltv ?? ins.loan.ltv}% LTV` });
            toast.success("Loan approved");
          } else if (d === "Reject") {
            toast.error("Loan rejected");
          } else {
            toast.info("Loan put on hold");
          }
        }} onEscalate={() => {
          advanceEscalation(ins.id, "Escalated", "Sent to manager from loan decision center");
          addNotification({ type: "Review Required", title: "Escalation created", message: `${ins.id} escalated for manager review` });
          toast.warning("Escalated to manager");
          nav({ to: "/escalations" });
        }} />
      )}

      {tab === "replay" && <ReplayTab inspection={ins} />}

      {tab === "vault" && <EvidenceVaultTab inspection={ins} />}

      {tab === "audit" && <AuditTrailTab events={ins.audit} />}
    </>
  );
}

function ScoreCard({ label, value, tone }: { label: string; value: number; tone: "risk" | "gold" | "success" }) {
  const color = tone === "risk" ? "var(--risk)" : tone === "gold" ? "var(--gold)" : "var(--success)";
  return (
    <GlassCard className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">{label}</p>
      <p className="text-display text-[36px] mt-2" style={{ color }}>{value}</p>
      <div className="h-1.5 bg-black/5 rounded-full overflow-hidden mt-3">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </GlassCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-white/40 border border-black/5">
      <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">{label}</div>
      <div className="text-sm font-bold mt-1">{value}</div>
    </div>
  );
}

function LoanDecisionTab({ inspection, onDecide, onEscalate }: { inspection: ReturnType<typeof useApp.getState>["inspections"][0]; onDecide: (d: "Approve" | "Hold" | "Reject", ltv?: number) => void; onEscalate: () => void; }) {
  const purityMult: Record<string, number> = { "18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0 };
  const [ltv, setLtv] = useState(inspection.loan.ltv || 75);
  const grossValue = Math.round(inspection.weight * inspection.loan.marketRate * (purityMult[inspection.purity] || 0.916));
  const recommendedLtv = inspection.status === "Genuine" ? 78 : inspection.status === "Low Risk" ? 72 : inspection.status === "Suspicious" ? 50 : 0;
  const amount = Math.round(grossValue * (ltv / 100));
  const action = inspection.status === "Genuine" || inspection.status === "Low Risk" ? "Approve Loan" : inspection.status === "Suspicious" ? "Send to Manager" : "Reject Loan";
  const riskLabel = inspection.status === "Genuine" ? "Low" : inspection.status === "Low Risk" ? "Low" : inspection.status === "Suspicious" ? "Medium" : "High";
  const riskColor = riskLabel === "Low" ? "var(--success)" : riskLabel === "Medium" ? "var(--warning)" : "var(--risk)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-float-in">
      {/* Hero Wallet card */}
      <GlassCard variant="strong" className="p-8 lg:col-span-2 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 size-72 rounded-full gold-shimmer opacity-15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">Loan Recommendation</div>
            <div className="text-[10px] uppercase tracking-wider text-foreground/45">{inspection.id}</div>
          </div>
          <div className="flex items-baseline gap-4 mt-6">
            <div className="text-display text-[72px] lg:text-[96px] leading-none">{fmtINR(amount)}</div>
          </div>
          <div className="text-sm text-foreground/55 mt-2">Suggested loan amount at <span className="font-bold text-foreground">{ltv}% LTV</span></div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KV label="Authenticity" value={`${inspection.authenticityScore}%`} />
            <KV label="Gross Value" value={fmtINR(grossValue)} />
            <KV label="Recommended LTV" value={`${recommendedLtv}%`} />
            <KV label="Risk Level" value={riskLabel} color={riskColor} />
          </div>

          <div className="mt-8">
            <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-foreground/55 mb-2">
              <span>Loan-to-Value</span><span className="text-foreground">{ltv}%</span>
            </div>
            <input type="range" min={0} max={85} value={ltv} onChange={(e) => setLtv(+e.target.value)} className="w-full accent-[color:var(--gold)]" />
            <div className="flex justify-between text-[10px] text-foreground/40 mt-1"><span>0%</span><span>Max 85%</span></div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => onDecide("Approve", ltv)} className="px-5 h-11 rounded-xl bg-[color:var(--success)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110"><Check className="size-4" /> Approve Loan</button>
            <button onClick={onEscalate} className="px-5 h-11 rounded-xl bg-[color:var(--warning)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110"><Send className="size-4" /> Send to Manager</button>
            <button onClick={() => onDecide("Hold")} className="px-5 h-11 rounded-xl glass text-sm font-semibold">Hold</button>
            <button onClick={() => onDecide("Reject")} className="px-5 h-11 rounded-xl bg-[color:var(--risk)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110"><X className="size-4" /> Reject</button>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <h3 className="text-sm font-bold mb-1">Recommended Action</h3>
        <p className="text-xs text-foreground/50 mb-4">Based on authenticity & risk signals</p>
        <div className="p-4 rounded-2xl text-center" style={{ background: riskColor + "1a", color: riskColor }}>
          <div className="text-display text-2xl">{action}</div>
        </div>
        <div className="mt-5 space-y-2 text-xs">
          <Line a="Customer" b={inspection.customerName} />
          <Line a="Item" b={`${inspection.purity} ${inspection.jewelryType}`} />
          <Line a="Weight" b={`${inspection.weight} g`} />
          <Line a="Market 24K" b={`₹${inspection.loan.marketRate}/g`} />
          <Line a="Decision" b={inspection.loan.decision} />
        </div>
      </GlassCard>
    </div>
  );
}

function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold">{label}</div>
      <div className="text-lg font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
function Line({ a, b }: { a: string; b: string }) {
  return <div className="flex justify-between border-b border-black/5 py-1.5"><span className="text-foreground/50">{a}</span><span className="font-semibold">{b}</span></div>;
}

function ReplayTab({ inspection }: { inspection: ReturnType<typeof useApp.getState>["inspections"][0] }) {
  const events = inspection.audit;
  const [i, setI] = useState(events.length - 1);
  const e = events[i];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 animate-float-in">
      <GlassCard className="p-5">
        <h3 className="text-sm font-bold mb-4">Inspection Timeline</h3>
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
          {events.map((ev, idx) => (
            <button key={idx} onClick={() => setI(idx)} className={cn("w-full text-left p-3 rounded-xl border transition", i === idx ? "bg-[color:var(--gold)]/10 border-[color:var(--gold)]/30" : "border-transparent hover:bg-white/60")}>
              <div className="flex items-center gap-2 text-[10px] text-foreground/50"><Clock className="size-3" /> {fmtTime(ev.ts)}</div>
              <div className="text-sm font-semibold mt-0.5">{ev.action}</div>
              {ev.detail && <div className="text-[11px] text-foreground/50">{ev.detail}</div>}
            </button>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--gold)]">Step {i + 1} of {events.length}</div>
            <h3 className="text-2xl font-bold mt-1">{e.action}</h3>
            <p className="text-xs text-foreground/55">{fmtTime(e.ts)} • {e.actor}</p>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setI(Math.max(0, i - 1))} className="size-9 rounded-xl glass grid place-items-center"><ChevronLeft className="size-4" /></button>
            <button onClick={() => setI(Math.min(events.length - 1, i + 1))} className="size-9 rounded-xl glass grid place-items-center"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["front", "back", "left", "right", "top", "reflection"].map((k) => (
            <div key={k} className="aspect-square rounded-xl bg-white border border-black/5 grid place-items-center overflow-hidden">
              {inspection.images[k as keyof typeof inspection.images] ? (
                <img src={inspection.images[k as keyof typeof inspection.images]} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <ImageIcon className="size-5 mx-auto text-foreground/25" />
                  <div className="text-[10px] uppercase text-foreground/40 font-semibold mt-1">{k}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-xs">
          <Stat label="Weight" value={`${inspection.weight} g`} />
          <Stat label="Dimensions" value={`${inspection.length}×${inspection.width}×${inspection.thickness}mm`} />
          <Stat label="Purity" value={inspection.purity} />
          <Stat label="Status" value={inspection.status} />
        </div>
        <div className="mt-5 p-4 rounded-xl bg-white/40 border border-black/5">
          <div className="text-[10px] uppercase tracking-wider text-foreground/45 font-semibold mb-1">Notes</div>
          <div className="text-sm">{inspection.notes}</div>
        </div>
      </GlassCard>
    </div>
  );
}

function EvidenceVaultTab({ inspection }: { inspection: ReturnType<typeof useApp.getState>["inspections"][0] }) {
  const download = () => {
    const rows: (string | number)[][] = [
      ["GoldGuard AI — Evidence Vault"],
      ["Inspection ID", inspection.id],
      ["Customer", `${inspection.customerName} (${inspection.customerId})`],
      ["Contact", inspection.contact],
      ["Item", `${inspection.purity} ${inspection.jewelryType}`],
      ["Weight (g)", inspection.weight],
      ["Dimensions (mm)", `${inspection.length}x${inspection.width}x${inspection.thickness}`],
      ["Branch", inspection.branch],
      ["Appraiser", inspection.appraiser],
      ["Date", inspection.date],
      ["Status", inspection.status],
      ["Authenticity", inspection.authenticityScore],
      ["Risk", inspection.riskScore],
      ["Loan Decision", inspection.loan.decision],
      ["Loan Amount", inspection.loan.amount],
      [],
      ["Audit Trail"],
      ["Time", "Actor", "Action", "Detail"],
      ...inspection.audit.map((a) => [a.ts, a.actor, a.action, a.detail || ""]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${inspection.id}-vault.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Evidence vault exported");
  };
  return (
    <GlassCard className="p-6 lg:p-8 animate-float-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="size-5 text-[color:var(--gold)]" /> Evidence Vault</h3>
          <p className="text-xs text-foreground/55">All artifacts captured for this inspection — preserved for audit.</p>
        </div>
        <button onClick={download} className="h-11 px-4 rounded-2xl bg-[color:var(--gold)] text-white text-sm font-semibold inline-flex items-center gap-2"><FileDown className="size-4" /> Download Vault</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <VaultSection title="Visual Captures">
            <div className="grid grid-cols-3 gap-2">
              {["front", "back", "left", "right", "top", "reflection", "touchstone"].map((k) => (
                <div key={k} className="aspect-square rounded-lg overflow-hidden bg-white border border-black/5 grid place-items-center">
                  {inspection.images[k as keyof typeof inspection.images] ? (
                    <img src={inspection.images[k as keyof typeof inspection.images]} className="w-full h-full object-cover" />
                  ) : <div className="text-[9px] uppercase font-semibold text-foreground/35">{k}</div>}
                </div>
              ))}
            </div>
          </VaultSection>
          <VaultSection title="Measurements">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Weight" value={`${inspection.weight} g`} />
              <Stat label="Length" value={`${inspection.length} mm`} />
              <Stat label="Width" value={`${inspection.width} mm`} />
              <Stat label="Thickness" value={`${inspection.thickness} mm`} />
            </div>
          </VaultSection>
          <VaultSection title="Notes">
            <div className="text-sm p-3 rounded-xl bg-white/50 border border-black/5">{inspection.notes}</div>
          </VaultSection>
        </div>

        <div>
          <VaultSection title="Generated Report">
            <div className="p-4 rounded-xl bg-white/50 border border-black/5 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center"><FileText className="size-5" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{inspection.id}-report.pdf</div>
                <div className="text-[11px] text-foreground/50">Generated {fmtTime(inspection.date)} • 480 KB</div>
              </div>
              <button onClick={download} className="text-xs font-semibold text-[color:var(--gold)] hover:underline">Download</button>
            </div>
          </VaultSection>
          <VaultSection title="Decision History">
            <div className="space-y-2">
              {inspection.audit.slice(-5).reverse().map((e, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className="size-2 rounded-full bg-[color:var(--gold)]" />
                  <span className="font-semibold w-24 shrink-0 text-foreground/55">{fmtTime(e.ts).split(",")[0]}</span>
                  <span className="font-semibold">{e.action}</span>
                  {e.detail && <span className="text-foreground/50 truncate">— {e.detail}</span>}
                </div>
              ))}
            </div>
          </VaultSection>
          <VaultSection title="Customer Record">
            <div className="text-xs space-y-1.5">
              <Line a="ID" b={inspection.customerId} />
              <Line a="Name" b={inspection.customerName} />
              <Line a="Contact" b={inspection.contact} />
            </div>
          </VaultSection>
        </div>
      </div>
    </GlassCard>
  );
}

function VaultSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-2">{title}</div>
      {children}
    </div>
  );
}

function AuditTrailTab({ events }: { events: { ts: string; actor: string; action: string; detail?: string }[] }) {
  const [filter, setFilter] = useState("");
  const filtered = events.filter((e) => !filter || e.actor === filter);
  const actors = Array.from(new Set(events.map((e) => e.actor)));
  return (
    <GlassCard className="p-6 lg:p-8 animate-float-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><ListChecks className="size-5 text-[color:var(--gold)]" /> Audit Trail</h3>
          <p className="text-xs text-foreground/55">Every action on this inspection, in chronological order.</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-xl glass text-sm font-medium">
          <option value="">All actors</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="relative pl-6">
        <div className="absolute top-2 bottom-2 left-2 w-px bg-[color:var(--gold)]/30" />
        {filtered.map((e, i) => (
          <div key={i} className="relative pb-5">
            <div className="absolute -left-[18px] top-1.5 size-3 rounded-full bg-[color:var(--gold)] ring-4 ring-[color:var(--gold)]/15" />
            <div className="flex items-center gap-3 text-[11px] text-foreground/50 mb-1">
              <Clock className="size-3" />
              <span className="font-mono">{fmtTime(e.ts)}</span>
              <span>•</span>
              <span className="font-semibold text-foreground/70">{e.actor}</span>
            </div>
            <div className="text-sm font-semibold">{e.action}</div>
            {e.detail && <div className="text-xs text-foreground/55 mt-0.5">{e.detail}</div>}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
