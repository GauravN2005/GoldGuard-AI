import { Bell, Search, Wifi, WifiOff } from "lucide-react";
import { useApp } from "@/stores/app-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  right?: React.ReactNode;
}

export function AppHeader({ title, subtitle, search, onSearch, searchPlaceholder = "Search inspections, customers, IDs…", right }: Props) {
  const mode = useApp((s) => s.mode);
  const notifications = useApp((s) => s.notifications);
  const profile = useApp((s) => s.profile);
  const markRead = useApp((s) => s.markRead);
  const unread = notifications.filter((n) => !n.read).length;
  const [internal, setInternal] = useState("");
  const v = search ?? internal;
  const set = onSearch ?? setInternal;

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-1.5">
          <span className={cn("inline-flex size-1.5 rounded-full", mode === "online" ? "bg-[color:var(--success)]" : "bg-[color:var(--warning)]")} />
          {mode === "online" ? <><Wifi className="size-3" /> Live</> : <><WifiOff className="size-3" /> Offline</>}
          <span className="text-foreground/30">/</span>
          <span>{profile.branch}</span>
        </div>
        <h1 className="text-3xl lg:text-[34px] font-bold tracking-tight text-balance">{title}</h1>
        {subtitle && <p className="text-foreground/50 mt-1 text-sm">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {onSearch !== undefined || search !== undefined ? (
          <div className="relative flex-1 lg:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-foreground/40" />
            <input
              value={v}
              onChange={(e) => set(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full lg:w-80 h-11 glass rounded-2xl pl-11 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--gold)]/30"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-black/10 bg-black/5 text-[9px] font-mono text-foreground/45 font-bold">
              Ctrl+K
            </div>
          </div>
        ) : null}

        {right}

        <Popover>
          <PopoverTrigger asChild>
            <button className="relative size-11 rounded-2xl glass grid place-items-center hover:bg-white/90 transition-colors">
              <Bell className="size-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 size-5 bg-[color:var(--risk)] text-white text-[10px] font-bold rounded-full grid place-items-center">
                  {unread}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 glass-strong rounded-2xl border-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
              <div className="font-semibold text-sm">Notifications</div>
              <Link to="/notifications" className="text-xs text-[color:var(--gold)] font-semibold hover:underline">View all</Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 5).map((n) => (
                <button
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn("w-full text-left px-4 py-3 border-b border-black/5 hover:bg-white/60 transition-colors block", !n.read && "bg-[color:var(--gold)]/5")}
                >
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-1.5 size-1.5 rounded-full shrink-0",
                      n.type === "High Risk Alert" ? "bg-[color:var(--risk)]" :
                      n.type === "Review Required" ? "bg-[color:var(--warning)]" :
                      n.type === "Report Generated" ? "bg-[color:var(--gold)]" : "bg-[color:var(--success)]"
                    )} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{n.title}</div>
                      <div className="text-[11px] text-foreground/55 line-clamp-2">{n.message}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Link to="/profile" className="size-11 rounded-2xl bg-[color:var(--gold)]/12 border border-[color:var(--gold)]/25 grid place-items-center font-bold text-[color:var(--gold)] text-sm hover:scale-105 transition-transform">
          {profile.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </Link>
      </div>
    </header>
  );
}
