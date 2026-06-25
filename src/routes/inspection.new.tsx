import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Check, ChevronLeft, ChevronRight, Upload, X, Camera, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inspection/new")({
  head: () => ({ meta: [{ title: "New Inspection — GoldGuard AI" }] }),
  component: NewInspection,
});

const STEPS = [
  "Customer", "Jewelry", "Weight", "Multi-Angle", "Reflection", "Touchstone", "Notes", "Review",
];

interface FormState {
  customerId: string; customerName: string; contact: string;
  jewelryType: string; purity: string; description: string;
  weight: string; length: string; width: string; thickness: string;
  images: Record<string, string | undefined>;
  notes: string;
}

function ImageTile({ label, value, onChange }: { label: string; value?: string; onChange: (v?: string) => void }) {
  return (
    <div className="relative aspect-square rounded-2xl overflow-hidden border border-black/8 bg-white">
      {value ? (
        <>
          <img src={value} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[color:var(--success)]/90 text-white flex items-center gap-1"><Check className="size-3" /> Uploaded</div>
          <div className="absolute top-2 right-2 flex gap-1">
            <label className="size-7 rounded-full bg-white/95 grid place-items-center cursor-pointer hover:scale-110 transition">
              <Upload className="size-3.5" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader(); r.onload = () => onChange(String(r.result)); r.readAsDataURL(f);
              }} />
            </label>
            <button onClick={() => onChange(undefined)} className="size-7 rounded-full bg-[color:var(--risk)] text-white grid place-items-center hover:scale-110 transition"><X className="size-3.5" /></button>
          </div>
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white">{label}</div>
        </>
      ) : (
        <label className="absolute inset-0 grid place-items-center cursor-pointer hover:bg-[color:var(--gold)]/5 transition">
          <div className="text-center">
            <Camera className="size-6 mx-auto text-foreground/30 mb-1" />
            <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground/55">{label}</div>
            <div className="text-[10px] text-foreground/40 mt-0.5">Tap to capture</div>
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const r = new FileReader(); r.onload = () => onChange(String(r.result)); r.readAsDataURL(f);
          }} />
        </label>
      )}
    </div>
  );
}

function QualityScorePanel({ form }: { form: FormState }) {
  const filled = ["front", "back", "left", "right", "top"].filter((k) => form.images[k]).length;
  const angleCov = Math.round((filled / 5) * 100);
  const reflection = form.images.reflection ? 95 : 0;
  const touchstone = form.images.touchstone ? 92 : 0;
  const lighting = filled > 0 ? 75 + filled * 3 : 0;
  const focus = filled > 0 ? 80 + filled * 2 : 0;
  const overall = Math.round((angleCov + reflection + touchstone + lighting + focus) / 5);
  const missing: string[] = [];
  ["front", "back", "left", "right", "top"].forEach((k) => { if (!form.images[k]) missing.push(k); });
  if (!form.images.reflection) missing.push("reflection");
  if (!form.images.touchstone) missing.push("touchstone");
  if (!form.weight) missing.push("weight");

  return (
    <GlassCard variant="strong" className="p-5 sticky top-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-[color:var(--gold)]" />
        <h3 className="text-sm font-bold">Inspection Quality Score</h3>
      </div>
      <div className="text-display text-[44px] text-[color:var(--gold)] leading-none">{overall}<span className="text-base text-foreground/40">/100</span></div>
      <div className="mt-4 space-y-2.5">
        {[
          { l: "Image Quality", v: Math.round((lighting + focus) / 2) },
          { l: "Lighting", v: lighting },
          { l: "Focus", v: focus },
          { l: "Angle Coverage", v: angleCov },
        ].map((r) => (
          <div key={r.l}>
            <div className="flex justify-between text-[11px] mb-1"><span className="text-foreground/55">{r.l}</span><span className="font-semibold">{r.v}%</span></div>
            <div className="h-1.5 bg-black/5 rounded-full overflow-hidden"><div className="h-full bg-[color:var(--gold)] rounded-full transition-all" style={{ width: `${r.v}%` }} /></div>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-[color:var(--warning)]/8 border border-[color:var(--warning)]/15">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--warning)] mb-1">Missing</div>
          <div className="text-[11px] text-foreground/70 capitalize">{missing.join(" • ")}</div>
        </div>
      )}
    </GlassCard>
  );
}

function NewInspection() {
  const nav = useNavigate();
  const addInspection = useApp((s) => s.addInspection);
  const addNotification = useApp((s) => s.addNotification);
  const profile = useApp((s) => s.profile);
  const saveDraft = useApp((s) => s.saveDraft);
  const mode = useApp((s) => s.mode);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({
    customerId: "", customerName: "", contact: "",
    jewelryType: "Necklace", purity: "22K", description: "",
    weight: "", length: "", width: "", thickness: "",
    images: {}, notes: "",
  });

  const setF = (k: keyof FormState, v: unknown) => setForm((s) => ({ ...s, [k]: v }));
  const setImage = (k: string, v?: string) => setForm((s) => ({ ...s, images: { ...s.images, [k]: v } }));

  const canNext = useMemo(() => {
    if (step === 0) return form.customerName && form.customerId && form.contact;
    if (step === 1) return form.jewelryType && form.purity;
    if (step === 2) return form.weight && +form.weight > 0;
    return true;
  }, [step, form]);

  const submit = () => {
    const id = `INS-${Math.floor(20000 + Math.random() * 9999)}`;
    const now = new Date().toISOString();
    const weight = +form.weight || 10;
    const purityMult: Record<string, number> = { "18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0 };
    const marketRate = 7200;
    const grossValue = Math.round(weight * marketRate * (purityMult[form.purity] || 0.916));
    const ltv = 75;
    addInspection({
      id, customerId: form.customerId, customerName: form.customerName, contact: form.contact,
      jewelryType: form.jewelryType as never, purity: form.purity as never, description: form.description || `${form.purity} ${form.jewelryType}`,
      weight, length: +form.length || 0, width: +form.width || 0, thickness: +form.thickness || 0,
      branch: profile.branch, appraiser: profile.name, date: now,
      status: "Genuine", authenticityScore: 96, riskScore: 8, confidence: 97,
      qualityScore: 92, lighting: 94, focus: 95, angleCoverage: 100,
      factors: { density: 96, surface: 94, reflection: 95, touchstone: 97, visualDefect: 93 },
      images: form.images, notes: form.notes,
      loan: { decision: "Pending", ltv, amount: Math.round(grossValue * (ltv / 100)), marketRate },
      audit: [
        { ts: now, actor: profile.name, action: "Inspection Created", detail: `${profile.branch}` },
        { ts: new Date(Date.now() + 60000).toISOString(), actor: profile.name, action: "Customer Verified" },
        { ts: new Date(Date.now() + 120000).toISOString(), actor: profile.name, action: "Weight Entered", detail: `${weight}g` },
        { ts: new Date(Date.now() + 180000).toISOString(), actor: profile.name, action: "Images Uploaded", detail: `${Object.values(form.images).filter(Boolean).length} captures` },
        { ts: new Date(Date.now() + 240000).toISOString(), actor: "System", action: "Quality Score Computed" },
        { ts: new Date(Date.now() + 300000).toISOString(), actor: "System", action: "Risk Analysis Completed" },
        { ts: new Date(Date.now() + 360000).toISOString(), actor: "System", action: "Report Generated" },
      ],
    });
    addNotification({ type: "Inspection Completed", title: "Inspection completed", message: `${id} — ${form.customerName} — Genuine, 97% confidence` });
    toast.success("Inspection submitted", { description: `${id} added to vault.` });
    nav({ to: "/inspection/$id", params: { id } });
  };

  const saveAsDraft = () => {
    const id = "DR-" + Math.floor(Math.random() * 9999);
    saveDraft({ id, customerName: form.customerName || "Untitled", jewelryType: form.jewelryType, weight: +form.weight || 0, step, savedAt: new Date().toISOString() });
    toast.info("Saved as draft", { description: mode === "offline" ? "Will sync when back online." : "You can resume from Drafts." });
  };

  return (
    <>
      <AppHeader title="New Inspection" subtitle="Guided 8-step appraisal workflow" right={
        <button onClick={saveAsDraft} className="h-11 px-4 rounded-2xl glass text-sm font-medium hover:bg-white/90">Save Draft</button>
      } />

      {/* Stepper */}
      <GlassCard className="p-5 mb-6 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button onClick={() => i <= step && setStep(i)} className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                i === step ? "bg-[color:var(--gold)] text-white shadow-lg shadow-[color:var(--gold)]/25" :
                i < step ? "bg-[color:var(--success)]/10 text-[color:var(--success)]" :
                "bg-black/5 text-foreground/45"
              )}>
                <span className={cn("size-5 rounded-full grid place-items-center text-[10px]", i === step ? "bg-white/25" : i < step ? "bg-[color:var(--success)]/20" : "bg-foreground/10")}>
                  {i < step ? <Check className="size-3" /> : i + 1}
                </span>
                {s}
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="size-3 text-foreground/30" />}
            </div>
          ))}
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <GlassCard className="p-6 lg:p-8">
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)] mb-1">Step {step + 1} of {STEPS.length}</div>
            <h2 className="text-2xl font-bold">{STEPS[step]}</h2>
          </div>

          {step === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Customer ID" value={form.customerId} onChange={(v) => setF("customerId", v)} placeholder="CUS-20451" />
              <Field label="Customer Name" value={form.customerName} onChange={(v) => setF("customerName", v)} placeholder="e.g. Rohit Sharma" />
              <Field label="Contact Number" value={form.contact} onChange={(v) => setF("contact", v)} placeholder="+91 98xxxxxxxx" />
              <Field label="Branch (auto)" value={profile.branch} onChange={() => {}} disabled />
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Jewelry Type" value={form.jewelryType} onChange={(v) => setF("jewelryType", v)} options={["Necklace", "Bangle", "Ring", "Chain", "Earring", "Coin", "Pendant"]} />
              <Select label="Purity" value={form.purity} onChange={(v) => setF("purity", v)} options={["18K", "20K", "22K", "24K"]} />
              <div className="md:col-span-2">
                <Field label="Description" value={form.description} onChange={(v) => setF("description", v)} placeholder="Traditional temple design with floral motif…" />
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Weight (g)" type="number" value={form.weight} onChange={(v) => setF("weight", v)} placeholder="42.5" />
              <Field label="Length (mm)" type="number" value={form.length} onChange={(v) => setF("length", v)} placeholder="60" />
              <Field label="Width (mm)" type="number" value={form.width} onChange={(v) => setF("width", v)} placeholder="12" />
              <Field label="Thickness (mm)" type="number" value={form.thickness} onChange={(v) => setF("thickness", v)} placeholder="3" />
            </div>
          )}
          {step === 3 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {["front", "back", "left", "right", "top"].map((k) => (
                <ImageTile key={k} label={k} value={form.images[k]} onChange={(v) => setImage(k, v)} />
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="max-w-md">
              <p className="text-sm text-foreground/60 mb-4">Capture the jewelry under angled light to record its reflection pattern. This contributes to surface authenticity scoring.</p>
              <ImageTile label="reflection" value={form.images.reflection} onChange={(v) => setImage("reflection", v)} />
            </div>
          )}
          {step === 5 && (
            <div className="max-w-md">
              <p className="text-sm text-foreground/60 mb-4">Capture the touchstone streak after rubbing the jewelry on the assay stone. Streak colour validates purity claim.</p>
              <ImageTile label="touchstone" value={form.images.touchstone} onChange={(v) => setImage("touchstone", v)} />
            </div>
          )}
          {step === 6 && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55 mb-2">Inspection Notes</label>
              <textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} rows={6}
                placeholder="Observed hallmark stamp, no visible defects, magnet test negative…"
                className="w-full p-4 rounded-xl bg-white border border-black/8 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30"
              />
            </div>
          )}
          {step === 7 && (
            <div className="space-y-4">
              <ReviewRow label="Customer" value={`${form.customerName} (${form.customerId})`} />
              <ReviewRow label="Contact" value={form.contact} />
              <ReviewRow label="Jewelry" value={`${form.purity} ${form.jewelryType} • ${form.description || "—"}`} />
              <ReviewRow label="Dimensions" value={`${form.weight}g • ${form.length}×${form.width}×${form.thickness}mm`} />
              <ReviewRow label="Images" value={`${Object.values(form.images).filter(Boolean).length} captured`} />
              <ReviewRow label="Notes" value={form.notes || "—"} />
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-black/5">
            <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-foreground/60 hover:bg-black/5 disabled:opacity-40 flex items-center gap-1">
              <ChevronLeft className="size-4" /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => canNext && setStep((s) => s + 1)} disabled={!canNext}
                className="px-6 py-2.5 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold shadow-lg shadow-[color:var(--gold)]/25 disabled:opacity-40 hover:brightness-110 flex items-center gap-1">
                Continue <ChevronRight className="size-4" />
              </button>
            ) : (
              <button onClick={submit} className="px-6 py-2.5 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold shadow-lg shadow-[color:var(--gold)]/25 hover:brightness-110">
                Submit Inspection
              </button>
            )}
          </div>
        </GlassCard>

        <QualityScorePanel form={form} />
      </div>
    </>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55 mb-2">{label}</label>
      <input type={type} value={value} disabled={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-4 rounded-xl bg-white border border-black/8 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30 disabled:opacity-60" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55 mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 px-4 rounded-xl bg-white border border-black/8 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-black/5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/45">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}
