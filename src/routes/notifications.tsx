import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Bell, Check, Trash2, AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — GoldGuard AI" }] }),
  component: Notifications,
});

const TYPES = ["All", "Inspection Completed", "High Risk Alert", "Report Generated", "Review Required"];

function Notifications() {
  const notifications = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markRead);
  const markAllRead = useApp((s) => s.markAllRead);
  const del = useApp((s) => s.deleteNotification);
  const [filter, setFilter] = useState("All");
  const [showRead, setShowRead] = useState(true);

  const filtered = notifications.filter((n) => (filter === "All" || n.type === filter) && (showRead || !n.read));
  const unread = notifications.filter((n) => !n.read).length;

  const icon = (t: string) => {
    if (t === "High Risk Alert") return <AlertTriangle className="size-4" />;
    if (t === "Review Required") return <ShieldCheck className="size-4" />;
    if (t === "Report Generated") return <FileText className="size-4" />;
    return <Bell className="size-4" />;
  };
  const tone = (t: string) => t === "High Risk Alert" ? "var(--risk)" : t === "Review Required" ? "var(--warning)" : t === "Report Generated" ? "var(--gold)" : "var(--success)";

  return (
    <>
      <AppHeader title="Notifications" subtitle={`${unread} unread • ${notifications.length} total`} right={
        <button onClick={markAllRead} className="h-11 px-4 rounded-2xl glass text-sm font-medium hover:bg-white/90 inline-flex items-center gap-2"><Check className="size-4" /> Mark all read</button>
      } />

      <GlassCard className="p-4 mb-6 flex flex-wrap items-center gap-3">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 px-3 rounded-xl glass text-sm font-medium">
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} className="accent-[color:var(--gold)]" />
          Show read
        </label>
      </GlassCard>

      <div className="space-y-2">
        {filtered.map((n) => (
          <GlassCard key={n.id} className={cn("p-4 flex items-start gap-4 transition", !n.read && "border-l-4 border-l-[color:var(--gold)]")}>
            <div className="size-10 rounded-xl grid place-items-center shrink-0" style={{ background: tone(n.type) + "1a", color: tone(n.type) }}>{icon(n.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm">{n.title}</div>
                  <div className="text-xs text-foreground/55 mt-0.5">{n.message}</div>
                </div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-wider shrink-0">{new Date(n.ts).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: tone(n.type) + "1a", color: tone(n.type) }}>{n.type}</span>
                {!n.read && <button onClick={() => markRead(n.id)} className="text-xs text-[color:var(--gold)] font-semibold hover:underline">Mark read</button>}
                <button onClick={() => del(n.id)} className="ml-auto text-xs text-foreground/45 hover:text-[color:var(--risk)] inline-flex items-center gap-1"><Trash2 className="size-3" /> Delete</button>
              </div>
            </div>
          </GlassCard>
        ))}
        {filtered.length === 0 && <GlassCard className="p-10 text-center text-foreground/50 text-sm">No notifications.</GlassCard>}
      </div>
    </>
  );
}
