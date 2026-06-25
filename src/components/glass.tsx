import { cn } from "@/lib/utils";
import { type ReactNode, type HTMLAttributes } from "react";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong" | "subtle";
  children?: ReactNode;
}

export function GlassCard({ className, variant = "default", children, ...rest }: GlassCardProps) {
  const v = variant === "strong" ? "glass-strong" : variant === "subtle" ? "glass-subtle" : "glass";
  return (
    <div className={cn(v, "rounded-[24px]", className)} {...rest}>
      {children}
    </div>
  );
}

interface RadialGaugeProps {
  value: number;        // 0..100
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

export function RadialGauge({ value, size = 180, thickness = 12, color = "var(--gold)", trackColor = "rgba(0,0,0,0.06)", label, sublabel }: RadialGaugeProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={thickness} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display text-[44px] leading-none">{value}</span>
        {label && <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/45 mt-1">{label}</span>}
        {sublabel && <span className="text-[10px] text-foreground/50 mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}

interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: string;
  tone?: "default" | "success" | "warning" | "risk" | "gold";
  hint?: string;
  icon?: ReactNode;
}

export function KpiTile({ label, value, delta, tone = "default", hint, icon }: KpiTileProps) {
  const toneClass =
    tone === "success" ? "text-[color:var(--success)]" :
    tone === "warning" ? "text-[color:var(--warning)]" :
    tone === "risk" ? "text-[color:var(--risk)]" :
    tone === "gold" ? "text-[color:var(--gold)]" : "text-foreground";
  const borderTone =
    tone === "risk" ? "border-l-[color:var(--risk)]" :
    tone === "warning" ? "border-l-[color:var(--warning)]" :
    tone === "success" ? "border-l-[color:var(--success)]" :
    tone === "gold" ? "border-l-[color:var(--gold)]" : "";

  return (
    <GlassCard className={cn("p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg", tone !== "default" && "border-l-4", borderTone)}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/45">{label}</p>
        {icon && <div className="text-foreground/30">{icon}</div>}
      </div>
      <p className={cn("text-display text-[34px] leading-none mt-2", toneClass)}>{value}</p>
      {delta && <p className={cn("text-[11px] font-semibold mt-3", toneClass)}>{delta}</p>}
      {hint && <p className="text-[11px] text-foreground/45 mt-1.5">{hint}</p>}
    </GlassCard>
  );
}

export function RiskFactorBar({ name, score, impact }: { name: string; score: number; impact: number }) {
  const color = score >= 85 ? "var(--gold)" : score >= 65 ? "var(--warning)" : "var(--risk)";
  return (
    <div>
      <div className="flex justify-between items-end text-sm mb-1.5">
        <span className="font-medium">{name}</span>
        <span className="text-foreground/50 text-xs">
          Score <span className="font-semibold text-foreground">{score}</span>
          <span className="mx-2 text-foreground/30">•</span>
          Impact <span className="font-semibold text-foreground">{impact}%</span>
        </span>
      </div>
      <div className="h-2 bg-black/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const cls = s.includes("high") ? "bg-[color:var(--risk)]/10 text-[color:var(--risk)]"
    : s.includes("susp") ? "bg-[color:var(--warning)]/10 text-[color:var(--warning)]"
    : s.includes("pend") ? "bg-foreground/5 text-foreground/60"
    : s.includes("low") ? "bg-[color:var(--gold)]/10 text-[color:var(--gold)]"
    : "bg-[color:var(--success)]/10 text-[color:var(--success)]";
  return <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", cls)}>{status}</span>;
}
