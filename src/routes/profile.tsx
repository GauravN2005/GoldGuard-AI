import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — GoldGuard AI" }] }),
  component: ProfileView,
});

function ProfileView() {
  const profile = useApp((s) => s.profile);
  const update = useApp((s) => s.updateProfile);
  const branches = useApp((s) => s.branches);
  const drafts = useApp((s) => s.drafts);
  const mode = useApp((s) => s.mode);
  
  const isSyncing = useApp((s) => s.isSyncing);
  const syncProgress = useApp((s) => s.syncProgress);
  const lastSyncedAt = useApp((s) => s.lastSyncedAt);
  const triggerSync = useApp((s) => s.triggerSync);

  const [form, setForm] = useState({ ...profile });

  const save = () => { update(form); toast.success("Profile updated"); };
  const upload = (f: File) => { const r = new FileReader(); r.onload = () => setForm((s) => ({ ...s, avatar: String(r.result) })); r.readAsDataURL(f); };

  return (
    <>
      <AppHeader title="Profile" subtitle="Manage your appraiser identity and preferences" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-8 text-center">
          <label className="relative inline-block cursor-pointer group">
            <div className="size-32 rounded-3xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center text-display text-5xl overflow-hidden mx-auto border-4 border-white shadow-xl">
              {form.avatar ? <img src={form.avatar} className="w-full h-full object-cover" /> : profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div className="absolute bottom-0 right-0 size-9 rounded-full bg-[color:var(--gold)] text-white grid place-items-center shadow-lg group-hover:scale-110 transition"><Upload className="size-4" /></div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          <h3 className="text-xl font-bold mt-4">{form.name}</h3>
          <p className="text-sm text-foreground/55">{form.designation}</p>
          <div className="mt-4 inline-flex px-3 py-1 rounded-full bg-[color:var(--gold)]/10 text-[color:var(--gold)] text-xs font-bold">{form.branch}</div>
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="text-lg font-bold mb-4">Account Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} />
            <Field label="Designation" value={form.designation} onChange={(v) => setForm((s) => ({ ...s, designation: v }))} />
            <Select label="Branch" value={form.branch} onChange={(v) => setForm((s) => ({ ...s, branch: v }))} options={branches.map((b) => b.name)} />
            <Field label="Email" value={form.email} onChange={(v) => setForm((s) => ({ ...s, email: v }))} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
          </div>

          <h3 className="text-lg font-bold mt-8 mb-4">Notification Preferences</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["email", "inApp", "sms", "highRiskOnly"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 p-3 rounded-xl bg-white/60 border border-black/5 cursor-pointer">
                <input type="checkbox" checked={form.notifPrefs[k]} onChange={(e) => setForm((s) => ({ ...s, notifPrefs: { ...s.notifPrefs, [k]: e.target.checked } }))} className="accent-[color:var(--gold)]" />
                <span className="text-sm capitalize">{k === "highRiskOnly" ? "High risk only" : k === "inApp" ? "In-app" : k}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end mt-6">
            <button onClick={save} className="h-11 px-6 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold shadow-lg shadow-[color:var(--gold)]/25">Save Changes</button>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6 mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-black/5 pb-4">
          <div>
            <h3 className="text-lg font-bold">Offline Sync Control Panel</h3>
            <p className="text-xs text-foreground/55">
              {drafts.length} draft{drafts.length === 1 ? "" : "s"} queued • Cache status: {mode === "offline" ? "Offline Cache" : "Online Connected"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastSyncedAt && (
              <span className="text-[10px] text-foreground/45 font-semibold">
                Last Synced: {new Date(lastSyncedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "short" })}
              </span>
            )}
            {drafts.length > 0 && (
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="h-11 px-5 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110 transition disabled:opacity-50 shadow-md shadow-[color:var(--gold)]/10"
              >
                {isSyncing ? (
                  <>
                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Syncing...
                  </>
                ) : (
                  "Sync Queue Now"
                )}
              </button>
            )}
          </div>
        </div>

        {isSyncing && (
          <div className="mb-6 p-4 rounded-xl bg-[color:var(--gold)]/5 border border-[color:var(--gold)]/15 space-y-3">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-[color:var(--gold)] font-bold">Synchronizing Offline Queue...</span>
              <span className="text-foreground">{syncProgress}%</span>
            </div>
            <div className="h-2 bg-black/5 rounded-full overflow-hidden">
              <div className="h-full bg-[color:var(--gold)] transition-all duration-300" style={{ width: `${syncProgress}%` }} />
            </div>
          </div>
        )}

        {drafts.length === 0 ? (
          <div className="text-sm text-foreground/50 text-center py-6">
            No offline drafts found. New inspections created while in Offline Mode will accumulate here.
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/60 border border-black/5 hover:bg-white/80 transition">
                <div className="text-xs text-foreground/55 font-mono bg-black/5 px-2 py-1 rounded-md">{d.id}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold">{d.customerName} — {d.jewelryType}</div>
                  <div className="text-[11px] text-foreground/55">Step {d.step + 1} • Saved {new Date(d.savedAt).toLocaleString("en-IN")} • {d.weight}g</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55 mb-2">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-white border border-black/8 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30" />
    </div>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-foreground/55 mb-2">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full h-11 px-4 rounded-xl bg-white border border-black/8 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
