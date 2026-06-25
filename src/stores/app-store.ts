import { create } from "zustand";
import {
  INSPECTIONS, NOTIFICATIONS, BRANCHES, EMPLOYEES, REPORTS,
  PROFILE_DEFAULT, SETTINGS_DEFAULT,
  type Inspection, type AppNotification, type Branch, type Employee, type Report,
  type LoanDecision, type EscalationStage, type AuditEvent,
} from "@/lib/mock-data";

export interface DraftInspection {
  id: string;
  customerName: string;
  jewelryType: string;
  weight: number;
  step: number;
  savedAt: string;
}

interface AppState {
  inspections: Inspection[];
  notifications: AppNotification[];
  branches: Branch[];
  employees: Employee[];
  reports: Report[];
  profile: typeof PROFILE_DEFAULT;
  settings: typeof SETTINGS_DEFAULT;
  mode: "online" | "offline";
  drafts: DraftInspection[];
  pendingSync: number;

  addInspection: (i: Inspection) => void;
  updateInspection: (id: string, patch: Partial<Inspection>) => void;
  appendAudit: (id: string, evt: AuditEvent) => void;
  decideLoan: (id: string, decision: LoanDecision, ltv?: number) => void;
  advanceEscalation: (id: string, stage: EscalationStage, note?: string) => void;

  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (n: Omit<AppNotification, "id" | "ts" | "read">) => void;

  updateProfile: (p: Partial<typeof PROFILE_DEFAULT>) => void;
  updateSettings: (s: Partial<typeof SETTINGS_DEFAULT>) => void;

  setMode: (m: "online" | "offline") => void;
  saveDraft: (d: DraftInspection) => void;
  removeDraft: (id: string) => void;
  syncDrafts: () => void;
}

export const useApp = create<AppState>((set) => ({
  inspections: INSPECTIONS,
  notifications: NOTIFICATIONS,
  branches: BRANCHES,
  employees: EMPLOYEES,
  reports: REPORTS,
  profile: { ...PROFILE_DEFAULT },
  settings: { ...SETTINGS_DEFAULT },
  mode: "online",
  drafts: [],
  pendingSync: 0,

  addInspection: (i) => set((s) => ({ inspections: [i, ...s.inspections] })),
  updateInspection: (id, patch) =>
    set((s) => ({ inspections: s.inspections.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  appendAudit: (id, evt) =>
    set((s) => ({
      inspections: s.inspections.map((x) =>
        x.id === id ? { ...x, audit: [...x.audit, evt] } : x,
      ),
    })),
  decideLoan: (id, decision, ltv) =>
    set((s) => ({
      inspections: s.inspections.map((x) => {
        if (x.id !== id) return x;
        const newLtv = ltv ?? x.loan.ltv;
        return {
          ...x,
          loan: { ...x.loan, decision, ltv: newLtv, amount: Math.round(x.weight * x.loan.marketRate * (newLtv / 100)) },
          audit: [...x.audit, { ts: new Date().toISOString(), actor: "You", action: `Loan ${decision}`, detail: `LTV ${newLtv}%` }],
        };
      }),
    })),
  advanceEscalation: (id, stage, note) =>
    set((s) => ({
      inspections: s.inspections.map((x) =>
        x.id === id
          ? { ...x, escalationStage: stage, audit: [...x.audit, { ts: new Date().toISOString(), actor: "You", action: `Escalation → ${stage}`, detail: note }] }
          : x,
      ),
    })),

  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  deleteNotification: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: "n" + Math.random().toString(36).slice(2, 8), ts: new Date().toISOString(), read: false },
        ...s.notifications,
      ],
    })),

  updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
  updateSettings: (st) => set((s) => ({ settings: { ...s.settings, ...st } })),

  setMode: (m) => set({ mode: m }),
  saveDraft: (d) =>
    set((s) => {
      const exists = s.drafts.some((x) => x.id === d.id);
      const drafts = exists ? s.drafts.map((x) => (x.id === d.id ? d : x)) : [d, ...s.drafts];
      return { drafts, pendingSync: drafts.length };
    }),
  removeDraft: (id) => set((s) => {
    const drafts = s.drafts.filter((x) => x.id !== id);
    return { drafts, pendingSync: drafts.length };
  }),
  syncDrafts: () => set({ drafts: [], pendingSync: 0 }),
}));
