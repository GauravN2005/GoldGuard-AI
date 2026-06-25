import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Plus, History, AlertTriangle, Users, Building2, Wallet,
  BarChart3, FileText, Bell, User, Settings as SettingsIcon, ShieldCheck, Wifi, WifiOff,
  ShieldAlert, Briefcase, Coins, Sparkles
} from "lucide-react";
import { useApp } from "@/stores/app-store";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: "Operations",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/inspection/new", label: "New Inspection", icon: Plus },
      { to: "/history", label: "History", icon: History },
      { to: "/escalations", label: "Escalations", icon: AlertTriangle },
      { to: "/investigations", label: "Investigations", icon: ShieldAlert },
    ],
  },
  {
    label: "Management",
    items: [
      { to: "/manager", label: "Manager View", icon: ShieldCheck },
      { to: "/executive-dashboard", label: "Executive View", icon: Briefcase },
      { to: "/branches", label: "Branches", icon: Building2 },
      { to: "/employees", label: "Employees", icon: Users },
      { to: "/portfolio", label: "Portfolio", icon: Wallet },
      { to: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/fraud-intelligence", label: "Fraud Intel", icon: Coins },
      { to: "/reports", label: "Reports", icon: FileText },
      { to: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: User },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = useApp((s) => s.mode);
  const setMode = useApp((s) => s.setMode);
  const pendingSync = useApp((s) => s.pendingSync);
  const unread = useApp((s) => s.notifications.filter((n) => !n.read).length);
  const isSyncing = useApp((s) => s.isSyncing);
  const syncProgress = useApp((s) => s.syncProgress);

  const isActive = (to: string, exact?: boolean) => (exact ? pathname === to : pathname === to || pathname.startsWith(to + "/"));

  return (
    <aside className="hidden lg:flex fixed top-6 left-6 bottom-6 w-64 z-40 glass-strong rounded-[28px] flex-col p-5">
      <Link to="/" className="flex items-center gap-3 px-2 mb-8 mt-1">
        <div className="size-10 rounded-2xl gold-shimmer grid place-items-center text-white shadow-lg shadow-[color:var(--gold)]/30">
          <ShieldCheck className="size-5" strokeWidth={2.4} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight">GoldGuard AI</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-foreground/40">Vault Terminal</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto pr-1 -mr-2 space-y-5">
        {groups.map((g) => (
          <div key={g.label}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/35 px-3 mb-2">{g.label}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = it.icon;
                const active = isActive(it.to, it.exact);
                const badge = it.label === "Notifications" && unread > 0 ? unread : null;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all",
                      active
                        ? "bg-[color:var(--gold)]/12 text-[color:var(--gold)] font-semibold"
                        : "text-foreground/60 hover:bg-white/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={active ? 2.4 : 2} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {badge ? (
                      <span className="text-[10px] font-bold bg-[color:var(--risk)] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 p-3 rounded-2xl bg-[color:var(--gold)]/8 border border-[color:var(--gold)]/20 text-left">
        <button
          onClick={() => !isSyncing && setMode(mode === "online" ? "offline" : "online")}
          disabled={isSyncing}
          className="w-full flex items-center justify-between hover:opacity-85 transition disabled:opacity-50"
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--gold)]">System Status</div>
          {mode === "online" ? <Wifi className="size-3.5 text-[color:var(--success)]" /> : <WifiOff className="size-3.5 text-[color:var(--warning)]" />}
        </button>
        <div className="mt-1 text-xs font-medium flex items-center gap-2">
          <span className={cn("size-2 rounded-full", mode === "online" ? "bg-[color:var(--success)] animate-pulse" : "bg-[color:var(--warning)]")} />
          {mode === "online" ? "Online Mode" : "Offline Mode"}
          {pendingSync > 0 && <span className="ml-auto text-[10px] text-[color:var(--warning)] font-bold">{pendingSync} pending</span>}
        </div>
        {isSyncing && (
          <div className="mt-2.5 space-y-1">
            <div className="flex justify-between text-[9px] font-bold text-[color:var(--gold)] leading-none">
              <span>Syncing queue...</span>
              <span>{syncProgress}%</span>
            </div>
            <div className="h-1 bg-black/5 rounded-full overflow-hidden">
              <div className="h-full bg-[color:var(--gold)] transition-all duration-300" style={{ width: `${syncProgress}%` }} />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// Mobile bottom nav (compact)
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Home", icon: LayoutDashboard, exact: true },
    { to: "/inspection/new", label: "New", icon: Plus },
    { to: "/history", label: "History", icon: History },
    { to: "/analytics", label: "Stats", icon: BarChart3 },
    { to: "/notifications", label: "Alerts", icon: Bell },
  ];
  return (
    <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 glass-strong rounded-2xl p-2 flex justify-between">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
        return (
          <Link key={it.to} to={it.to} className={cn("flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl text-[10px]",
            active ? "text-[color:var(--gold)] bg-[color:var(--gold)]/10 font-semibold" : "text-foreground/60")}
          >
            <Icon className="size-4" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
