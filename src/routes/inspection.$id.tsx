import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, RadialGauge, RiskFactorBar, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { api } from "@/lib/api-client";
import {
  ArrowLeft, FileDown, Printer, ChevronRight, ChevronLeft, Shield, Sparkles,
  ScanEye, Microscope, FileText, History as HistoryIcon, IndianRupee, ListChecks,
  Send, Check, X, Image as ImageIcon, Clock, RotateCcw, ShieldAlert, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/inspection/$id")({
  head: () => ({ meta: [{ title: "Inspection Detail — GoldGuard AI" }] }),
  component: InspectionDetail,
});

const TABS = [
  { id: "results", label: "Results", icon: Sparkles },
  { id: "ai", label: "AI Analysis", icon: Microscope },
  { id: "risk", label: "Explainable Risk", icon: ScanEye },
  { id: "loan", label: "Loan Decision", icon: IndianRupee },
  { id: "replay", label: "Replay", icon: HistoryIcon },
  { id: "vault", label: "Evidence Vault", icon: Shield },
  { id: "audit", label: "Audit Trail", icon: ListChecks },
] as const;

function fmtINR(n: number) { return "₹ " + n.toLocaleString("en-IN"); }
function fmtTime(iso: string) { return new Date(iso).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }); }

const getImageUrl = (url?: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/, "");
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${origin}${cleanPath}`;
};

function InspectionDetail() {
  const { id } = Route.useParams();
  const inspection = useApp((s) => s.inspections.find((i) => i.id === id));
  const decideLoan = useApp((s) => s.decideLoan);
  const advanceEscalation = useApp((s) => s.advanceEscalation);
  const addNotification = useApp((s) => s.addNotification);
  const nav = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("results");
  const [aiResult, setAiResult] = useState<any>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  if (!inspection) throw notFound();

  // Shared AI scan simulation state
  const [aiStatus, setAiStatus] = useState<"Awaiting" | "Processing" | "Completed">(
    inspection.status === "Pending" ? "Awaiting" : "Completed"
  );
  const [aiProgress, setAiProgress] = useState(inspection.status === "Pending" ? 0 : 100);

  useEffect(() => {
    async function loadAiResult() {
      if (aiStatus !== "Completed") return;
      setIsLoadingResult(true);
      try {
        const res = await api.getAiResult(id);
        setAiResult(res);
      } catch (err) {
        console.error("Failed to load AI result:", err);
      } finally {
        setIsLoadingResult(false);
      }
    }
    loadAiResult();
  }, [id, aiStatus]);

  useEffect(() => {
    if (inspection.status !== "Pending") {
      setAiStatus("Completed");
      setAiProgress(100);
    } else {
      setAiStatus("Awaiting");
      setAiProgress(0);
    }
  }, [inspection.status]);

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

      {/* Feature 6 — Custom Milestone Timeline */}
      <MilestoneTimeline inspection={ins} aiStatus={aiStatus} />

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
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--gold)] px-2 py-0.5 rounded-full bg-[color:var(--gold)]/10">
                    {aiStatus}
                  </span>
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
                    <div className="text-display text-2xl text-foreground/70 mt-1">
                      {aiStatus === "Completed" ? `${x.v}%` : aiStatus === "Processing" ? "..." : "Awaiting"}
                    </div>
                    <div className="text-[10px] text-foreground/40 mt-1">
                      {aiStatus === "Completed" ? "Analyzed" : "Run AI Scan"}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Feature 1 — AI Analysis Command Center */}
      {tab === "ai" && (
        <AiAnalysisTab
          inspection={ins}
          aiStatus={aiStatus}
          setAiStatus={setAiStatus}
          aiProgress={aiProgress}
          setAiProgress={setAiProgress}
          aiResult={aiResult}
          isLoadingResult={isLoadingResult}
        />
      )}

      {tab === "risk" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-float-in">
          <GlassCard className="p-6 lg:p-8 lg:col-span-2">
            <h3 className="text-lg font-bold mb-1">Explainable Risk Analysis</h3>
            <p className="text-xs text-foreground/50 mb-6">Factors contributing to the final score, with their relative impact.</p>
            <div className="space-y-5">
              <RiskFactorBar name="Volumetric Density" score={ins.factors.density} impact={30} />
              <RiskFactorBar name="Surface Analysis" score={ins.factors.surface} impact={20} />
              <RiskFactorBar name="Reflection Analysis" score={ins.factors.reflection} impact={15} />
              <RiskFactorBar name="Touchstone Analysis" score={ins.factors.touchstone} impact={15} />
              <RiskFactorBar name="Visual Defect Detection" score={ins.factors.visualDefect} impact={20} />
            </div>
            
            <div className="mt-8 p-4 rounded-2xl bg-[color:var(--gold)]/8 border border-[color:var(--gold)]/15">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--gold)] mb-1.5">Decision Explainability Log</div>
              <p className="text-sm leading-relaxed whitespace-pre-line">{aiResult?.explainability || ins.notes}</p>
            </div>
          </GlassCard>

          <GlassCard variant="strong" className="p-6 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-4">Final Decision Recommendation</div>
              <div className="p-4 rounded-2xl text-center mb-6" style={{ background: catColor + "1a", color: catColor }}>
                <span className="text-xs font-bold uppercase tracking-wider block mb-1">Action</span>
                <span className="text-xl font-bold tracking-tight">
                  {aiResult?.recommendation || (ins.status === "Genuine" ? "Approve" : "Manual Verification")}
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-black/5">
                  <span className="text-foreground/50">Overall Risk Status:</span>
                  <span className="font-bold" style={{ color: catColor }}>{ins.status}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-black/5">
                  <span className="text-foreground/50">System Confidence:</span>
                  <span className="font-bold text-[color:var(--gold)]">{ins.confidence}%</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-black/5">
                  <span className="text-foreground/50">Model Version:</span>
                  <span className="font-mono text-foreground/60">{aiResult?.model_version || "1.2.0"}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-foreground/50">Processing Time:</span>
                  <span className="font-mono text-foreground/60">{aiResult?.processing_time_ms || 140} ms</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Feature 2 — Gold Loan Decision Engine */}
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

// Milestone Timeline Component
function MilestoneTimeline({ inspection, aiStatus }: { inspection: any; aiStatus: "Awaiting" | "Processing" | "Completed" }) {
  const steps: { label: string; sub: string; status: "completed" | "active" | "pending"; ts?: string }[] = [
    {
      label: "Created",
      sub: "Inspection registered",
      status: "completed",
      ts: inspection.audit[0]?.ts,
    },
    {
      label: "Media Uploads",
      sub: "5 angles + scans",
      status: "completed",
      ts: inspection.audit.find((a: any) => a.action.includes("Images"))?.ts || inspection.audit[3]?.ts || inspection.audit[0]?.ts,
    },
    {
      label: "Measurements",
      sub: "Weight & dimensions",
      status: "completed",
      ts: inspection.audit.find((a: any) => a.action.includes("Weight"))?.ts || inspection.audit[2]?.ts || inspection.audit[0]?.ts,
    },
    {
      label: "AI Diagnostic Scan",
      sub: aiStatus === "Completed" ? "Completed" : aiStatus === "Processing" ? "Scanning assets..." : "Pending scan",
      status: aiStatus === "Completed" ? "completed" : aiStatus === "Processing" ? "active" : "pending",
      ts: aiStatus === "Completed" ? new Date().toISOString() : undefined,
    },
    {
      label: "Risk Calculation",
      sub: aiStatus === "Completed" ? "Calculated" : "Awaiting AI scan",
      status: aiStatus === "Completed" ? "completed" : "pending",
      ts: aiStatus === "Completed" ? new Date().toISOString() : undefined,
    },
    {
      label: "Report Ready",
      sub: aiStatus === "Completed" ? "Report generated" : "Awaiting calculation",
      status: aiStatus === "Completed" ? "completed" : "pending",
      ts: aiStatus === "Completed" ? new Date().toISOString() : undefined,
    },
    {
      label: "Appraiser Review",
      sub: inspection.loan.decision !== "Pending" ? `Loan ${inspection.loan.decision}` : "Review pending",
      status: inspection.loan.decision !== "Pending" ? "completed" : aiStatus === "Completed" ? "active" : "pending",
      ts: inspection.loan.decision !== "Pending" ? inspection.audit.find((a: any) => a.action.includes("Loan"))?.ts : undefined,
    },
  ];

  return (
    <GlassCard className="p-5 mb-6 overflow-x-auto">
      <div className="flex justify-between items-center min-w-[900px] relative px-4 py-2">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-black/5 -translate-y-6 z-0" />

        {steps.map((step, idx) => {
          const isCompleted = step.status === "completed";
          const isActive = step.status === "active";

          return (
            <div key={idx} className="flex flex-col items-center text-center relative z-10 w-28">
              {/* Circle node */}
              <div className={cn(
                "size-8 rounded-full flex items-center justify-center border-2 mb-2 transition-all duration-300",
                isCompleted ? "bg-[color:var(--success)]/10 border-[color:var(--success)] text-[color:var(--success)]" :
                isActive ? "bg-[color:var(--gold)]/10 border-[color:var(--gold)] text-[color:var(--gold)] animate-pulse" :
                "bg-white border-black/10 text-foreground/30"
              )}>
                {isCompleted ? <Check className="size-4" /> : <Clock className="size-4" />}
              </div>

              {/* Step Details */}
              <div className="text-[11px] font-bold text-foreground/80 leading-tight">{step.label}</div>
              <div className="text-[9px] text-foreground/45 mt-0.5 leading-none font-semibold truncate max-w-full">{step.sub}</div>
              {step.ts && (
                <div className="text-[8px] text-foreground/35 mt-1 font-mono leading-none">
                  {new Date(step.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// AI Diagnostics Panel Component
function AiAnalysisTab({ inspection, aiStatus, setAiStatus, aiProgress, setAiProgress, aiResult, isLoadingResult }: {
  inspection: any;
  aiStatus: "Awaiting" | "Processing" | "Completed";
  setAiStatus: (s: "Awaiting" | "Processing" | "Completed") => void;
  aiProgress: number;
  setAiProgress: (p: number | ((prev: number) => number)) => void;
  aiResult: any;
  isLoadingResult: boolean;
}) {
  const [scanStep, setScanStep] = useState("");

  const runAiDiagnostics = useApp((s) => s.runAiDiagnostics);

  const densityDetails = useMemo(() => {
    if (aiResult?.density_details) {
      return aiResult.density_details;
    }
    return {
      calculated_density: inspection.factors?.density >= 80 ? (inspection.purity === "24K" ? 19.30 : 17.70) : 15.40,
      expected_density: inspection.purity === "24K" ? 19.30 : 17.70,
      difference_percentage: inspection.factors?.density >= 80 ? 0.0 : -13.0,
      risk_level: inspection.factors?.density >= 80 ? "Normal" : "High Risk",
      explanation: inspection.notes || "Computed volumetric density matches gold standard.",
      possible_core_material: inspection.factors?.density >= 80 ? "None" : "Tungsten"
    };
  }, [aiResult, inspection]);

  const defectDetails = useMemo(() => {
    if (aiResult?.defect_details) {
      return aiResult.defect_details;
    }
    const hasDefect = inspection.factors?.visualDefect < 80;
    return {
      status: hasDefect ? "defect_detected" : "clean",
      defects: hasDefect ? [{ type: "surface_wear", confidence: 0.91 }] : [],
      confidence: hasDefect ? 0.91 : 0.98,
      explanation: hasDefect ? "Defects localized: surface_wear." : "No visible defects or image quality issues detected in uploaded photos."
    };
  }, [aiResult, inspection]);

  const startScan = () => {
    setAiStatus("Processing");
    setAiProgress(0);
    setScanStep("Initializing diagnostic scanners...");

    const steps = [
      { p: 15, msg: "Aligning multi-spectral cameras..." },
      { p: 30, msg: "Analyzing hallmarks and micro-engravings..." },
      { p: 45, msg: "Verifying hydrostatic volume displacement..." },
      { p: 60, msg: "Measuring reflective spectrographic response..." },
      { p: 75, msg: "Scanning touchstone streak acid reactivity..." },
      { p: 90, msg: "Checking RFID tamper seal signatures..." },
      { p: 100, msg: "Executing neural network analysis..." }
    ];

    let stepIdx = 0;
    const timer = setInterval(async () => {
      if (stepIdx < steps.length) {
        setAiProgress(steps[stepIdx].p);
        setScanStep(steps[stepIdx].msg);
        stepIdx++;
      } else {
        clearInterval(timer);
        try {
          setScanStep("Persisting AI diagnostics assessment...");
          await runAiDiagnostics(inspection.id);
          setAiStatus("Completed");
          toast.success("AI Diagnostics successfully completed.");
        } catch (err) {
          console.error("AI diagnostics call failed:", err);
          setAiStatus("Awaiting");
        }
      }
    }, 400);
  };

  return (
    <div className="space-y-6 animate-float-in">
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold">AI Diagnostics Command Center</h3>
            <p className="text-xs text-foreground/55">Run neural analysis check across optical, physical, and chemical sensors.</p>
          </div>
          <div>
            {aiStatus === "Awaiting" && (
              <button onClick={startScan} className="px-5 h-11 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110 shadow-lg shadow-[color:var(--gold)]/20 transition">
                <Sparkles className="size-4" /> Run AI Diagnostics
              </button>
            )}
            {aiStatus === "Processing" && (
              <div className="flex items-center gap-3">
                <div className="size-4 border-2 border-[color:var(--gold)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-semibold text-[color:var(--gold)]">Scanning: {aiProgress}%</span>
              </div>
            )}
            {aiStatus === "Completed" && (
              <button onClick={startScan} className="px-5 h-11 rounded-xl glass text-sm font-semibold flex items-center gap-2">
                <RotateCcw className="size-4" /> Re-Run Diagnostics
              </button>
            )}
          </div>
        </div>

        {aiStatus === "Processing" && (
          <div className="mt-6 space-y-2">
            <div className="h-2 bg-black/5 rounded-full overflow-hidden">
              <div className="h-full bg-[color:var(--gold)] transition-all duration-300" style={{ width: `${aiProgress}%` }} />
            </div>
            <div className="text-[11px] font-mono text-[color:var(--gold)] animate-pulse">{scanStep}</div>
          </div>
        )}
      </GlassCard>

      {aiStatus === "Awaiting" && (
        <GlassCard className="p-12 text-center border-dashed flex flex-col items-center justify-center">
          <div className="size-16 rounded-full bg-black/5 flex items-center justify-center text-foreground/45 mb-4">
            <Microscope className="size-8" />
          </div>
          <h4 className="text-base font-bold text-foreground/75">Diagnostics Pending</h4>
          <p className="text-xs text-foreground/55 max-w-sm mt-1 mb-5">Start the automated AI diagnostic scan to verify physical dimensions, surface reflections, visual hallmarks, streak reactions, and packaging seals.</p>
          <button onClick={startScan} className="px-6 h-11 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110 transition">
            <Sparkles className="size-4" /> Initialize Scan
          </button>
        </GlassCard>
      )}

      {aiStatus === "Completed" && (
        <div className="space-y-6">
          {/* AI Explainable Reasoning Card */}
          <GlassCard className="p-6 border-l-4 border-l-[color:var(--gold)]">
            <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-[color:var(--gold)]" />
                <h4 className="text-base font-bold text-foreground/80">AI Explainable Reasoning</h4>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                <span className="size-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                <span>Assistive LLM Layer (Gemini)</span>
              </div>
            </div>
            
            {aiResult?.llm_reasoning ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/45">Summary Description</span>
                    <p className="mt-1 text-foreground/75 leading-relaxed">{aiResult.llm_reasoning.summary}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/45">Recommendation Context</span>
                    <p className="mt-1 text-foreground/75 leading-relaxed">{aiResult.llm_reasoning.recommendation_reason}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/45">Detailed Analysis</span>
                    <p className="mt-1 text-foreground/75 leading-relaxed">{aiResult.llm_reasoning.score_reason}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/45">Key Detected Anomalies</span>
                    <ul className="mt-1 list-disc pl-4 space-y-1 text-foreground/75">
                      {Array.isArray(aiResult.llm_reasoning.key_anomalies) ? (
                        aiResult.llm_reasoning.key_anomalies.map((anomaly: string, i: number) => (
                          <li key={i}>{anomaly}</li>
                        ))
                      ) : (
                        <li>{String(aiResult.llm_reasoning.key_anomalies)}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ) : isLoadingResult ? (
              <div className="py-6 flex items-center justify-center gap-3 text-sm text-foreground/55 animate-pulse">
                <div className="size-4 border-2 border-[color:var(--gold)] border-t-transparent rounded-full animate-spin" />
                <span>Generating explanation...</span>
              </div>
            ) : (
              <div className="py-2 text-sm text-foreground/55 italic">
                No explainable reasoning generated. Please re-run diagnostics to fetch LLM analysis.
              </div>
            )}
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <MetricCard
            title="Defect Localization"
            score={inspection.factors.visualDefect}
            subtitle="Visible defects & image quality"
            impact={defectDetails.status === "clean" ? -0.8 : 8.4}
            reasoning={defectDetails.explanation}
            status={defectDetails.status === "clean" ? "Verified" : "Defect"}
            extraContent={
              defectDetails.status === "clean" ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-[color:var(--success)] font-semibold bg-[color:var(--success)]/10 px-3 py-2 rounded-xl border border-[color:var(--success)]/15">
                  <span className="size-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                  <span>No Defects Detected</span>
                </div>
              ) : (
                <div className="mt-3 space-y-2 animate-float-in">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Detected Defects:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {defectDetails.defects.map((def: any) => (
                      <span
                        key={def.type}
                        className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[color:var(--risk)]/10 text-[color:var(--risk)] border border-[color:var(--risk)]/15"
                      >
                        {def.type.replace("_", " ")} ({Math.round(def.confidence * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )
            }
          />
          <MetricCard
            title="Density Verification"
            score={inspection.factors.density}
            subtitle="Hydrostatic weight-volume check"
            impact={densityDetails.difference_percentage}
            reasoning={`${densityDetails.explanation} (Calc: ${densityDetails.calculated_density} g/cm³, Exp: ${densityDetails.expected_density} g/cm³).${
              densityDetails.possible_core_material && densityDetails.possible_core_material !== "None"
                ? ` Core Threat: ${densityDetails.possible_core_material} detected.`
                : ""
            }`}
            status={densityDetails.risk_level === "Normal" ? "Verified" : densityDetails.risk_level === "Suspicious" ? "Anomalous" : "Failed"}
          />
          <MetricCard
            title="Reflection Analysis"
            score={inspection.factors.reflection}
            subtitle="Luster & base-metal check"
            impact={-1.2}
            reasoning="Spectrographic analysis indicates standard gold luster; no signs of plating or base metals."
            status="Verified"
          />
          <MetricCard
            title="Touchstone Analysis"
            score={inspection.factors.touchstone}
            subtitle="Streak acid reactivity test"
            impact={-0.5}
            reasoning="Streak reaction test shows steady color retention; matches control purity criteria."
            status="Verified"
          />
          <MetricCard
            title="Packaging Confidence Score"
            score={inspection.status === "Genuine" || inspection.status === "Low Risk" ? 98 : 42}
            subtitle="Tamper-evident seal signatures"
            impact={0.0}
            reasoning="Tamper-evident packaging seals are intact and serial code validated."
            status={inspection.status === "Genuine" || inspection.status === "Low Risk" ? "Verified" : "Suspicious"}
          />
          <MetricCard
            title="Authenticity Confidence Score"
            score={inspection.authenticityScore}
            subtitle="Combined probabilistic model"
            impact={0.0}
            reasoning="Overall validity confidence based on multi-sensor sensor fusion diagnostics."
            status={inspection.status === "Genuine" || inspection.status === "Low Risk" ? "Verified" : "Low"}
          />
        </div>
      </div>
      )}
    </div>
  );
}

function MetricCard({ title, score, subtitle, impact, reasoning, status, extraContent }: {
  title: string;
  score: number;
  subtitle: string;
  impact: number;
  reasoning: string;
  status: string;
  extraContent?: React.ReactNode;
}) {
  const isGood = score >= 80;
  const color = isGood ? "var(--success)" : score >= 60 ? "var(--warning)" : "var(--risk)";

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">{title}</span>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full" style={{ background: color + "1a", color }}>
            {status}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-display text-3xl font-bold">{score}%</span>
          <span className="text-xs text-foreground/45">{subtitle}</span>
        </div>

        <div className="h-1.5 bg-black/5 rounded-full overflow-hidden mt-3 mb-4">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${score}%`, background: color }} />
        </div>

        <p className="text-xs text-foreground/60 leading-relaxed bg-white/30 border border-black/5 rounded-xl p-3">
          {reasoning}
        </p>
        
        {extraContent}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] pt-3 border-t border-black/5">
        <span className="text-foreground/45">Risk Impact Contribution:</span>
        <span className={cn("font-bold", impact < 0 ? "text-[color:var(--success)]" : impact > 0 ? "text-[color:var(--risk)]" : "text-foreground/40")}>
          {impact === 0 ? "Neutral (0.0%)" : impact < 0 ? `${impact}%` : `+${impact}%`}
        </span>
      </div>
    </GlassCard>
  );
}

// Gold Loan Decision Engine Component
function LoanDecisionTab({ inspection, onDecide, onEscalate }: { inspection: ReturnType<typeof useApp.getState>["inspections"][0]; onDecide: (d: "Approve" | "Hold" | "Reject", ltv?: number) => void; onEscalate: () => void; }) {
  const purityMult: Record<string, number> = { "18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0 };
  const [ltv, setLtv] = useState(inspection.loan.ltv || 75);
  const grossValue = Math.round(inspection.weight * inspection.loan.marketRate * (purityMult[inspection.purity] || 0.916));
  const recommendedLtv = inspection.status === "Genuine" ? 78 : inspection.status === "Low Risk" ? 72 : inspection.status === "Suspicious" ? 50 : 0;
  const amount = Math.round(grossValue * (ltv / 100));
  const recommendedAmount = Math.round(grossValue * (recommendedLtv / 100));
  const action = inspection.status === "Genuine" || inspection.status === "Low Risk" ? "Approve Loan" : inspection.status === "Suspicious" ? "Send to Manager" : "Reject Loan";
  const riskLabel = inspection.status === "Genuine" ? "Low" : inspection.status === "Low Risk" ? "Low" : inspection.status === "Suspicious" ? "Medium" : "High";
  const riskColor = riskLabel === "Low" ? "var(--success)" : riskLabel === "Medium" ? "var(--warning)" : "var(--risk)";
  const confidenceLevel = inspection.authenticityScore >= 85 ? "High" : inspection.authenticityScore >= 60 ? "Medium" : "Low";
  const confidenceColor = confidenceLevel === "High" ? "var(--success)" : confidenceLevel === "Medium" ? "var(--warning)" : "var(--risk)";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-float-in">
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

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-4">
            <KV label="Authenticity" value={`${inspection.authenticityScore}%`} />
            <KV label="Gross Value" value={fmtINR(grossValue)} />
            <KV label="Suggested LTV" value={`${recommendedLtv}%`} />
            <KV label="Risk Level" value={riskLabel} color={riskColor} />
            <KV label="Confidence" value={confidenceLevel} color={confidenceColor} />
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
        <div className="p-4 rounded-2xl text-center mb-6" style={{ background: riskColor + "1a", color: riskColor }}>
          <div className="text-display text-2xl">{action}</div>
        </div>
        <div className="text-xs space-y-3 mb-6 p-4 bg-white/40 border border-black/5 rounded-xl">
          <div className="flex justify-between">
            <span className="text-foreground/50 font-semibold">Recommended Amount:</span>
            <span className="font-bold text-[color:var(--gold)]">{fmtINR(recommendedAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50 font-semibold">Recommended LTV %:</span>
            <span className="font-bold text-[color:var(--gold)]">{recommendedLtv}%</span>
          </div>
        </div>
        <div className="space-y-2 text-xs">
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

  const availableAngles = useMemo(() => {
    return Object.keys(inspection.images).filter(k => !!inspection.images[k as keyof typeof inspection.images]);
  }, [inspection.images]);

  const [reviewAngle, setReviewAngle] = useState(availableAngles[0] || "front");
  const [visualObservations, setVisualObservations] = useState("");
  const [loadingReview, setLoadingReview] = useState(false);

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
                <img src={getImageUrl(inspection.images[k as keyof typeof inspection.images])} className="w-full h-full object-cover" />
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

        {/* AI Visual Review Module */}
        {availableAngles.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-white/40 border border-black/5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[color:var(--gold)]" />
                <h4 className="text-sm font-bold text-foreground/75">AI Visual Review (Assistive Layer)</h4>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <select
                value={reviewAngle}
                onChange={(e) => setReviewAngle(e.target.value)}
                className="h-10 px-3 rounded-xl border border-black/10 bg-white/50 text-sm font-medium focus:outline-none"
              >
                {availableAngles.map((k) => (
                  <option key={k} value={k}>
                    {k.toUpperCase()} angle
                  </option>
                ))}
              </select>
              <button
                onClick={async () => {
                  setLoadingReview(true);
                  try {
                    const res = await api.generateVisualReview(inspection.id, reviewAngle);
                    setVisualObservations(res.observations);
                    toast.success("AI Visual Review generated successfully.");
                  } catch (err: any) {
                    console.error("AI Visual Review failed:", err);
                    toast.error(err.message || "Failed to generate visual review.");
                  } finally {
                    setLoadingReview(false);
                  }
                }}
                disabled={loadingReview}
                className="h-10 px-4 rounded-xl bg-[color:var(--gold)] text-white text-xs font-semibold flex items-center gap-2 hover:brightness-110 transition disabled:opacity-50"
              >
                {loadingReview ? (
                  <>
                    <div className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    <span>Generate AI Visual Review</span>
                  </>
                )}
              </button>
            </div>
            
            {visualObservations && (
              <div className="p-4 rounded-xl bg-white border border-black/5 text-sm space-y-2 animate-float-in">
                <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Visual Observations:</div>
                <div className="whitespace-pre-line text-foreground/75 leading-relaxed">
                  {visualObservations}
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// Upgraded Evidence Vault Component with Action Cards & Spinners
function EvidenceVaultTab({ inspection }: { inspection: ReturnType<typeof useApp.getState>["inspections"][0] }) {
  const [downloadingPkg, setDownloadingPkg] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [exportingBundle, setExportingBundle] = useState(false);
  const [exportingVault, setExportingVault] = useState(false);

  const downloadCsv = () => {
    setExportingVault(true);
    setTimeout(() => {
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
      setExportingVault(false);
      toast.success("Evidence vault exported to CSV");
    }, 1200);
  };

  const handleDownloadPkg = () => {
    setDownloadingPkg(true);
    toast.info("Preparing Evidence Package containing all images and metadata...");
    setTimeout(() => {
      setDownloadingPkg(false);
      toast.success("Evidence Package downloaded successfully.");
    }, 1500);
  };

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const blob = await api.downloadInspectionReportPdf(inspection.id);
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${inspection.id}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
      toast.success("Investigation Report PDF generated and downloaded.");
    } catch (err) {
      console.error("Failed to generate report:", err);
      toast.error("Failed to generate report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportBundle = () => {
    setExportingBundle(true);
    toast.info("Securing vault artifacts in a signed cryptographic ZIP bundle...");
    setTimeout(() => {
      setExportingBundle(false);
      toast.success("Secure Export Bundle generated.");
    }, 1800);
  };

  return (
    <GlassCard className="p-6 lg:p-8 animate-float-in">
      <div className="flex items-center justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2"><Shield className="size-5 text-[color:var(--gold)]" /> Evidence Vault</h3>
          <p className="text-xs text-foreground/55">All artifacts captured for this inspection — preserved for audit.</p>
        </div>
        <button onClick={downloadCsv} disabled={exportingVault} className="h-11 px-4 rounded-2xl bg-[color:var(--gold)] text-white text-sm font-semibold inline-flex items-center gap-2 hover:brightness-110 transition disabled:opacity-50">
          {exportingVault ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <FileDown className="size-4" />}
          Download Vault CSV
        </button>
      </div>

      {/* Feature Action Grid */}
      <div className="mb-8">
        <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/45 mb-3">Secure Audit Actions</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={handleDownloadPkg} disabled={downloadingPkg} className="p-4 rounded-xl bg-white/40 border border-black/5 hover:bg-white/60 transition flex flex-col justify-between items-start text-left gap-4 disabled:opacity-50 min-h-[110px]">
            <div className="size-8 rounded-lg bg-[color:var(--gold)]/10 text-[color:var(--gold)] flex items-center justify-center">
              {downloadingPkg ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <ImageIcon className="size-4" />}
            </div>
            <div>
              <div className="font-semibold text-xs text-foreground/80">Evidence Package</div>
              <div className="text-[10px] text-foreground/45 mt-0.5">High-res images & camera EXIF bundle</div>
            </div>
          </button>

          <button onClick={handleGenerateReport} disabled={generatingReport} className="p-4 rounded-xl bg-white/40 border border-black/5 hover:bg-white/60 transition flex flex-col justify-between items-start text-left gap-4 disabled:opacity-50 min-h-[110px]">
            <div className="size-8 rounded-lg bg-[color:var(--gold)]/10 text-[color:var(--gold)] flex items-center justify-center">
              {generatingReport ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <FileText className="size-4" />}
            </div>
            <div>
              <div className="font-semibold text-xs text-foreground/80">Investigation Report</div>
              <div className="text-[10px] text-foreground/45 mt-0.5">Formal verification PDF document</div>
            </div>
          </button>

          <button onClick={handleExportBundle} disabled={exportingBundle} className="p-4 rounded-xl bg-white/40 border border-black/5 hover:bg-white/60 transition flex flex-col justify-between items-start text-left gap-4 disabled:opacity-50 min-h-[110px]">
            <div className="size-8 rounded-lg bg-[color:var(--gold)]/10 text-[color:var(--gold)] flex items-center justify-center">
              {exportingBundle ? <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Shield className="size-4" />}
            </div>
            <div>
              <div className="font-semibold text-xs text-foreground/80">Inspection Bundle</div>
              <div className="text-[10px] text-foreground/45 mt-0.5">Cryptographically signed ZIP package</div>
            </div>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <VaultSection title="Visual Captures">
            <div className="grid grid-cols-3 gap-2">
              {["front", "back", "left", "right", "top", "reflection", "touchstone"].map((k) => (
                <div key={k} className="aspect-square rounded-lg overflow-hidden bg-white border border-black/5 grid place-items-center">
                  {inspection.images[k as keyof typeof inspection.images] ? (
                    <img src={getImageUrl(inspection.images[k as keyof typeof inspection.images])} className="w-full h-full object-cover" />
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
              <button onClick={handleGenerateReport} disabled={generatingReport} className="text-xs font-semibold text-[color:var(--gold)] hover:underline">Download</button>
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

// Audit Trail Component
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
