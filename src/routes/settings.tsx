import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — GoldGuard AI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const settings = useApp((s) => s.settings);
  const branches = useApp((s) => s.branches);
  const update = useApp((s) => s.updateSettings);
  const [form, setForm] = useState({ ...settings });

  const save = () => { update(form); toast.success("Settings saved"); };

  return (
    <>
      <AppHeader title="Settings" subtitle="Application preferences and defaults" />

      <div className="space-y-6">
        <Section title="Appearance & Language">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Language" value={form.language} onChange={(v) => setForm((s) => ({ ...s, language: v }))} options={["English", "हिन्दी", "मराठी", "தமிழ்", "ગુજરાતી"]} />
            <Select label="Density" value={form.density} onChange={(v) => setForm((s) => ({ ...s, density: v as never }))} options={["Comfortable", "Compact"]} />
          </div>
        </Section>

        <Section title="Dashboard Preferences">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Default Branch" value={form.defaultBranch} onChange={(v) => setForm((s) => ({ ...s, defaultBranch: v }))} options={branches.map((b) => b.name)} />
          </div>
        </Section>

        <Section title="Report Preferences">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Default Format" value={form.reportFormat} onChange={(v) => setForm((s) => ({ ...s, reportFormat: v as never }))} options={["PDF", "CSV", "XLSX"]} />
          </div>
        </Section>

        <Section title="Notification Channels">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["inApp", "email", "sms"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2 p-3 rounded-xl bg-white/60 border border-black/5 cursor-pointer">
                <input type="checkbox" checked={form.notifChannels[k]} onChange={(e) => setForm((s) => ({ ...s, notifChannels: { ...s.notifChannels, [k]: e.target.checked } }))} className="accent-[color:var(--gold)]" />
                <span className="text-sm capitalize">{k === "inApp" ? "In-app" : k.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </Section>

        <div className="flex justify-end">
          <button onClick={save} className="h-11 px-6 rounded-xl bg-[color:var(--gold)] text-white text-sm font-semibold shadow-lg shadow-[color:var(--gold)]/25">Save Settings</button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="p-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      {children}
    </GlassCard>
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
