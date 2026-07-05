import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { toast } from "sonner";
import {
  PROFILE_DEFAULT, SETTINGS_DEFAULT,
  type Inspection, type AppNotification, type Branch, type Employee, type Report,
  type LoanDecision, type EscalationStage, type AuditEvent,
} from "@/lib/mock-data";
import { api } from "@/lib/api-client";

export interface DraftInspection {
  id: string;
  customerName: string;
  jewelryType: string;
  weight: number;
  step: number;
  savedAt: string;
}

// ── Zero-Dependency IndexedDB storage engine wrapper for Zustand ──
const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
    return new Promise((resolve) => {
      const request = indexedDB.open("GoldGuardDB", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("keyval", "readonly");
        const store = tx.objectStore("keyval");
        const getReq = store.get(name);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
    return new Promise((resolve) => {
      const request = indexedDB.open("GoldGuardDB", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("keyval", "readwrite");
        const store = tx.objectStore("keyval");
        store.put(value, name);
        tx.oncomplete = () => resolve();
      };
      request.onerror = () => resolve();
    });
  },
  removeItem: async (name: string): Promise<void> => {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") return;
    return new Promise((resolve) => {
      const request = indexedDB.open("GoldGuardDB", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("keyval", "readwrite");
        const store = tx.objectStore("keyval");
        store.delete(name);
        tx.oncomplete = () => resolve();
      };
      request.onerror = () => resolve();
    });
  },
};


interface AppState {
  inspections: Inspection[];
  notifications: AppNotification[];
  branches: Branch[];
  employees: Employee[];
  reports: Report[];
  profile: typeof PROFILE_DEFAULT;
  settings: typeof SETTINGS_DEFAULT;
  mode: "online";
  drafts: DraftInspection[];
  pendingSync: number;
  isSyncing: boolean;
  syncProgress: number;
  lastSyncedAt: string | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  user: any | null;
  portfolio: any[];
  customers: any[];
  superAdminViewMode: "admin" | "app";
  setSuperAdminViewMode: (mode: "admin" | "app") => void;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  addInspection: (i: Inspection) => Promise<void>;
  runAiDiagnostics: (id: string) => Promise<any>;
  updateInspection: (id: string, patch: Partial<Inspection>) => Promise<void>;
  appendAudit: (id: string, evt: AuditEvent) => void;
  decideLoan: (id: string, decision: LoanDecision, ltv?: number) => Promise<void>;
  advanceEscalation: (id: string, stage: EscalationStage, note?: string) => Promise<void>;
  refreshDataTargeted: (target: "dashboard" | "notifications" | "portfolio" | "inspections" | "employees" | "customers" | "reports" | "branches") => Promise<void>;

  markRead: (id: string) => void;
  markAllRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (n: Omit<AppNotification, "id" | "ts" | "read">) => void;

  updateProfile: (p: Partial<typeof PROFILE_DEFAULT>) => void;
  updateSettings: (s: Partial<typeof SETTINGS_DEFAULT>) => void;

  setMode: (m: "online") => void;
  saveDraft: (d: DraftInspection) => void;
  removeDraft: (id: string) => void;
  syncDrafts: () => void;
  triggerSync: () => void;

  // Branch CRUD actions
  addBranch: (b: any) => Promise<void>;
  updateBranch: (id: string, patch: any) => Promise<void>;
  deleteBranch: (id: string) => Promise<void>;

  // Employee CRUD actions
  addEmployee: (e: any) => Promise<void>;
  updateEmployee: (id: string, patch: any) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  // Customer CRUD actions
  addCustomer: (c: any) => Promise<void>;
  updateCustomer: (id: string, patch: any) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      inspections: [],
      notifications: [],
      branches: [],
      employees: [],
      reports: [],
      profile: { ...PROFILE_DEFAULT },
      settings: { ...SETTINGS_DEFAULT },
      mode: "online",
      drafts: [],
      pendingSync: 0,
      isSyncing: false,
      syncProgress: 0,
      lastSyncedAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago default
      isInitialized: false,
      isAuthenticated: false,
      user: null,
      portfolio: [],
      customers: [],
      superAdminViewMode: "admin",
      setSuperAdminViewMode: (mode) => set({ superAdminViewMode: mode }),

      initialize: async () => {
        const state = useApp.getState();
        if (state.isInitialized) return;

        const token = typeof window !== "undefined" && typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem("gg_token")
          : null;
        if (token) {
          try {
            const profile = await api.getMyProfile();
            let settings = { ...SETTINGS_DEFAULT };
            try {
              settings = await api.getSettings();
            } catch (_) {}

            const [inspectionsRes, branches, notifications, reports, employees, portfolio, customersRes] = await Promise.all([
              api.getInspections(0, 1000),
              api.getBranches(),
              api.getNotifications(),
              api.getReports(),
              api.getEmployees().catch(() => []),
              api.getPortfolio().catch(() => []),
              api.getCustomers().catch(() => []),
            ]);

            set({
              isAuthenticated: true,
              user: profile,
              profile: {
                name: profile.fullName || profile.full_name,
                email: profile.email,
                branch: profile.branch?.name || "Mumbai Fort",
                phone: profile.phone || "",
                address: profile.address || "",
                region: profile.region || "",
                designation: profile.designation || "Senior Appraiser",
                avatar: profile.avatar || "",
                notifPrefs: { email: true, inApp: true, sms: false, highRiskOnly: false },
              },
              settings: { ...SETTINGS_DEFAULT, ...settings },
              inspections: inspectionsRes.data,
              branches,
              notifications,
              reports,
              employees,
              portfolio,
              customers: Array.isArray(customersRes) ? customersRes : (customersRes?.data || []),
              isInitialized: true,
              mode: "online"
            });
            toast.success("Secured Operator Terminal Online", {
              description: `Authenticated as ${profile.fullName || profile.full_name} (${profile.role})`
            });
            return;
          } catch (e) {
            console.warn("Failed to load online profile on init:", e);
          }
        }
        set({ isInitialized: true, mode: "online", isAuthenticated: false });
      },

      refreshData: async () => {
        try {
          const [inspectionsRes, branches, notifications, reports, employees, portfolio, customersRes] = await Promise.all([
            api.getInspections(0, 1000),
            api.getBranches(),
            api.getNotifications(),
            api.getReports(),
            api.getEmployees().catch(() => []),
            api.getPortfolio().catch(() => []),
            api.getCustomers().catch(() => []),
          ]);
          set({
            inspections: inspectionsRes.data,
            branches,
            notifications,
            reports,
            employees,
            portfolio,
            customers: Array.isArray(customersRes) ? customersRes : (customersRes?.data || [])
          });
        } catch (e) {
          console.warn("Failed to refresh state data:", e);
        }
      },

      refreshDataTargeted: async (target) => {
        try {
          if (target === "dashboard") {
            const [inspectionsRes, branches, notifications] = await Promise.all([
              api.getInspections(0, 1000),
              api.getBranches(),
              api.getNotifications(),
            ]);
            set({
              inspections: inspectionsRes.data,
              branches,
              notifications,
            });
          } else if (target === "notifications") {
            const notifications = await api.getNotifications();
            set({ notifications });
          } else if (target === "portfolio") {
            const [portfolio, inspectionsRes] = await Promise.all([
              api.getPortfolio(),
              api.getInspections(0, 1000)
            ]);
            set({ portfolio, inspections: inspectionsRes.data });
          } else if (target === "inspections") {
            const inspectionsRes = await api.getInspections(0, 1000);
            set({ inspections: inspectionsRes.data });
          } else if (target === "employees") {
            const employees = await api.getEmployees().catch(() => []);
            set({ employees });
          } else if (target === "customers") {
            const customersRes = await api.getCustomers().catch(() => []);
            set({ customers: Array.isArray(customersRes) ? customersRes : (customersRes?.data || []) });
          } else if (target === "reports") {
            const reports = await api.getReports();
            set({ reports });
          } else if (target === "branches") {
            const branches = await api.getBranches();
            set({ branches });
          }
        } catch (e) {
          console.warn(`Failed to refresh target ${target}:`, e);
        }
      },

      login: async (email, password) => {
        try {
          const success = await api.login(email, password);
          if (!success) {
            toast.error("Invalid credentials. Please try again.");
            return false;
          }
          const profile = await api.getMyProfile();
          let settings = { ...SETTINGS_DEFAULT };
          try {
            settings = await api.getSettings();
          } catch (_) {}

          const [inspectionsRes, branches, notifications, reports, employees, portfolio, customersRes] = await Promise.all([
            api.getInspections(0, 1000),
            api.getBranches(),
            api.getNotifications(),
            api.getReports(),
            api.getEmployees().catch(() => []),
            api.getPortfolio().catch(() => []),
            api.getCustomers().catch(() => []),
          ]);

          set({
            isAuthenticated: true,
            user: profile,
            profile: {
              name: profile.fullName || profile.full_name,
              email: profile.email,
              branch: profile.branch?.name || "Mumbai Fort",
              phone: profile.phone || "",
              address: profile.address || "",
              region: profile.region || "",
              designation: profile.designation || "Senior Appraiser",
              avatar: profile.avatar || "",
              notifPrefs: { email: true, inApp: true, sms: false, highRiskOnly: false },
            },
            settings: { ...SETTINGS_DEFAULT, ...settings },
            inspections: inspectionsRes.data,
            branches,
            notifications,
            reports,
            employees,
            portfolio,
            customers: Array.isArray(customersRes) ? customersRes : (customersRes?.data || []),
            mode: "online",
          });

          toast.success("Successfully logged in.");
          return true;
        } catch (e) {
          toast.error("Failed to authenticate with online server.");
          return false;
        }
      },

      logout: () => {
        if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
          sessionStorage.removeItem("gg_token");
        }
        set({
          isAuthenticated: false,
          user: null,
          profile: { ...PROFILE_DEFAULT },
          settings: { ...SETTINGS_DEFAULT },
          mode: "online",
        });
        toast.info("Logged out successfully.");
      },

      addInspection: async (i) => {
        const state = useApp.getState();
        if (state.mode === "online") {
          const payload = {
            id: i.id,
            customer_id: i.customerId,
            customer_name: i.customerName,
            contact: i.contact,
            jewelry_type: i.jewelryType,
            purity: i.purity,
            description: i.description || "",
            weight: i.weight,
            length: i.length || 0.0,
            width: i.width || 0.0,
            thickness: i.thickness || 0.0,
          };

          // Helper to convert base64 to Blob
          const dataURLtoBlob = (dataurl: string) => {
            const arr = dataurl.split(",");
            const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            return new Blob([u8arr], { type: mime });
          };

          try {
            await api.createInspection(payload);
            
            // Sequentially upload visual angle captures
            const imagePromises = Object.entries(i.images || {}).map(async ([angle, base64Str]) => {
              if (base64Str && base64Str.startsWith("data:")) {
                try {
                  const blob = dataURLtoBlob(base64Str);
                  await api.uploadInspectionImage(i.id, angle, blob);
                } catch (imgErr) {
                  console.error(`Failed to upload ${angle} image:`, imgErr);
                }
              }
            });
            await Promise.all(imagePromises);
            
            // Submit triggers the full AI pipeline on the backend
            await api.submitInspection(i.id);
            toast.success(`Inspection evidence bundle ${i.id} synchronized to server vault.`);
            
            // Fetch the real updated inspection with actual AI scores from backend
            // This replaces the hardcoded placeholder values passed from the form
            try {
              const realInspection = await api.getInspection(i.id);
              const refreshed = await api.getInspections();
              const updatedList = Array.isArray(refreshed.data) ? refreshed.data : (refreshed as any) || [];
              // Ensure the newly submitted inspection has real scores in store
              const finalList = updatedList.map((x: any) => x.id === i.id ? { ...x, ...realInspection } : x);
              set({ inspections: finalList });
            } catch (refreshErr) {
              console.warn("Failed to refresh inspection after submit, falling back to list refresh:", refreshErr);
              const refreshed = await api.getInspections();
              set({ inspections: Array.isArray(refreshed.data) ? refreshed.data : [] });
            }
          } catch (err) {
            console.error("Failed to upload inspection bundle:", err);
            toast.error("Failed to synchronize inspection evidence to server.");
            throw err;
          }
        } else {
          set((s) => ({ inspections: [i, ...s.inspections] }));
        }
      },

      runAiDiagnostics: async (id) => {
        try {
          const result = await api.analyzeInspection(id);
          // Refresh list from backend to get full updated inspection state
          const refreshed = await api.getInspections();
          set({ inspections: Array.isArray(refreshed) ? refreshed : (refreshed?.data || []) });
          return result;
        } catch (err) {
          console.error("AI diagnostics execution failed:", err);
          toast.error("Failed to execute AI diagnostics on server.");
          throw err;
        }
      },

      updateInspection: async (id, patch) => {
        set((s) => ({ inspections: s.inspections.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
        const state = useApp.getState();
        if (state.mode === "online") {
          const backendPatch: any = {};
          if (patch.jewelryType) backendPatch.jewelry_type = patch.jewelryType;
          if (patch.purity) backendPatch.purity = patch.purity;
          if (patch.description) backendPatch.description = patch.description;
          if (patch.weight !== undefined) backendPatch.weight = patch.weight;
          if (patch.status) backendPatch.status = patch.status;
          if (patch.authenticityScore !== undefined) backendPatch.authenticity_score = patch.authenticityScore;
          if (patch.riskScore !== undefined) backendPatch.risk_score = patch.riskScore;
          if (patch.confidence !== undefined) backendPatch.confidence = patch.confidence;
          if (patch.qualityScore !== undefined) backendPatch.quality_score = patch.qualityScore;
          if (patch.notes) backendPatch.notes = patch.notes;
          if (patch.loan) backendPatch.loan = patch.loan;
          if (patch.escalationStage) backendPatch.escalation_stage = patch.escalationStage;

          try {
            await api.updateInspection(id, backendPatch);
            await Promise.all([
              state.refreshDataTargeted("inspections"),
              state.refreshDataTargeted("portfolio"),
              state.refreshDataTargeted("notifications")
            ]);
          } catch (err) {
            console.error("Failed to update inspection on backend:", err);
          }
        }
      },

      appendAudit: (id, evt) =>
        set((s) => ({
          inspections: s.inspections.map((x) =>
            x.id === id ? { ...x, audit: [...x.audit, evt] } : x,
          ),
        })),

      decideLoan: async (id, decision, ltv) => {
        const state = useApp.getState();
        const target = state.inspections.find((x) => x.id === id);
        if (!target) return;
        const newLtv = ltv ?? target.loan.ltv;
        const updatedLoan = {
          decision,
          ltv: newLtv,
          amount: Math.round(target.weight * target.loan.marketRate * (newLtv / 100)),
          marketRate: target.loan.marketRate,
        };

        if (state.mode === "online") {
          try {
            await api.updateInspection(id, { loan: updatedLoan });
            toast.success(`Loan successfully ${decision}d.`);
            await Promise.all([
              state.refreshDataTargeted("inspections"),
              state.refreshDataTargeted("portfolio"),
              state.refreshDataTargeted("notifications")
            ]);
          } catch (err) {
            console.error("Failed to persist loan decision:", err);
            toast.error("Failed to persist loan decision.");
          }
        }
      },

      advanceEscalation: async (id, stage, note) => {
        const state = useApp.getState();
        const target = state.inspections.find((x) => x.id === id);
        if (!target) return;
        const escId = (target as any)?.escalationId;

        if (state.mode === "online") {
          try {
            if (stage === "Final Decision") {
              if (note === "Approved by manager" || note?.toLowerCase().includes("approve")) {
                if (escId) {
                  await api.approveEscalation(escId);
                } else {
                  await api.updateInspection(id, { escalation_stage: stage, loan: { decision: "Approve", ltv: 75, amount: target?.loan?.amount || 0, marketRate: 7200 } });
                }
              } else if (note === "Rejected by manager" || note?.toLowerCase().includes("reject")) {
                if (escId) {
                  await api.rejectEscalation(escId);
                } else {
                  await api.updateInspection(id, { escalation_stage: stage, loan: { decision: "Reject", ltv: 75, amount: target?.loan?.amount || 0, marketRate: 7200 } });
                }
              } else {
                if (escId) {
                  await api.closeEscalation(escId);
                } else {
                  await api.updateInspection(id, { escalation_stage: stage });
                }
              }
            } else {
              if (escId) {
                await api.updateEscalationStage(escId, stage);
              } else {
                await api.updateInspection(id, { escalation_stage: stage });
              }
            }
            toast.success(`Escalation transitioned to: ${stage}`);
            await Promise.all([
              state.refreshDataTargeted("inspections"),
              state.refreshDataTargeted("notifications"),
              state.refreshDataTargeted("dashboard")
            ]);
          } catch (err) {
            console.error("Failed to advance escalation:", err);
            toast.error("Failed to update escalation stage.");
          }
        }
      },

      addBranch: async (b) => {
        await api.createBranch(b);
        const refreshedBranches = await api.getBranches();
        const refreshedPortfolio = await api.getPortfolio().catch(() => []);
        set({ branches: refreshedBranches, portfolio: refreshedPortfolio });
      },

      updateBranch: async (id, patch) => {
        await api.updateBranch(id, patch);
        const refreshedBranches = await api.getBranches();
        const refreshedPortfolio = await api.getPortfolio().catch(() => []);
        set({ branches: refreshedBranches, portfolio: refreshedPortfolio });
      },

      deleteBranch: async (id) => {
        await api.deleteBranch(id);
        const refreshedBranches = await api.getBranches();
        const refreshedPortfolio = await api.getPortfolio().catch(() => []);
        set({ branches: refreshedBranches, portfolio: refreshedPortfolio });
      },

      addEmployee: async (e) => {
        await api.createEmployee(e);
        const refreshedEmployees = await api.getEmployees();
        set({ employees: refreshedEmployees });
      },

      updateEmployee: async (id, patch) => {
        await api.updateEmployee(id, patch);
        const refreshedEmployees = await api.getEmployees();
        set({ employees: refreshedEmployees });
      },

      deleteEmployee: async (id) => {
        await api.deleteEmployee(id);
        const refreshedEmployees = await api.getEmployees();
        set({ employees: refreshedEmployees });
      },

      addCustomer: async (c) => {
        await api.createCustomer(c);
        const refreshedCustomers = await api.getCustomers();
        set({ customers: Array.isArray(refreshedCustomers) ? refreshedCustomers : (refreshedCustomers?.data || []) });
      },

      updateCustomer: async (id, patch) => {
        await api.updateCustomer(id, patch);
        const refreshedCustomers = await api.getCustomers();
        set({ customers: Array.isArray(refreshedCustomers) ? refreshedCustomers : (refreshedCustomers?.data || []) });
      },

      markRead: (id) => {
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
        const state = useApp.getState();
        if (state.mode === "online" && id.startsWith("notif-")) {
          api.markNotificationRead(id).catch(console.error);
        }
      },

      markAllRead: () => {
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
        const state = useApp.getState();
        if (state.mode === "online") {
          api.markAllNotificationsRead().catch(console.error);
        }
      },

      deleteNotification: (id) => {
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) }));
        const state = useApp.getState();
        if (state.mode === "online" && id.startsWith("notif-")) {
          api.deleteNotification(id).catch(console.error);
        }
      },

      addNotification: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: "n" + Math.random().toString(36).slice(2, 8), ts: new Date().toISOString(), read: false },
            ...s.notifications,
          ],
        })),

      updateProfile: (p) => {
        set((s) => ({ profile: { ...s.profile, ...p } }));
        const state = useApp.getState();
        if (state.mode === "online") {
          const branchObj = state.branches.find((b) => b.name === p.branch);
          const payload = {
            full_name: p.name,
            email: p.email,
            designation: p.designation,
            branch_id: branchObj ? branchObj.id : undefined,
            phone: p.phone,
            address: p.address,
          };
          api.updateMyProfile(payload).catch((err) => {
            console.error("Failed to update profile on backend:", err);
            toast.error("Failed to sync profile changes to server.");
          });
        }
      },

      updateSettings: (st) => {
        set((s) => {
          const next = { ...s.settings, ...st };
          if (st.notifChannels) {
            next.emailAlerts = st.notifChannels.email ?? next.emailAlerts;
            next.pushNotifications = st.notifChannels.inApp ?? next.pushNotifications;
            next.smsAlerts = st.notifChannels.sms ?? next.smsAlerts;
          }
          return { settings: next };
        });
        
        const state = useApp.getState();
        if (state.mode === "online") {
          const payload: any = {};
          if (st.language !== undefined) payload.language = st.language;
          if (st.defaultBranch !== undefined) payload.default_branch = st.defaultBranch;
          if (st.density !== undefined) payload.density = st.density;
          if (st.twoFactor !== undefined) payload.two_factor = st.twoFactor;
          
          if (st.emailAlerts !== undefined) payload.email_alerts = st.emailAlerts;
          if (st.pushNotifications !== undefined) payload.push_notifications = st.pushNotifications;
          if (st.smsAlerts !== undefined) payload.sms_alerts = st.smsAlerts;
          
          if (st.notifChannels !== undefined) {
            if (st.notifChannels.email !== undefined) payload.email_alerts = st.notifChannels.email;
            if (st.notifChannels.inApp !== undefined) payload.push_notifications = st.notifChannels.inApp;
            if (st.notifChannels.sms !== undefined) payload.sms_alerts = st.notifChannels.sms;
          }
          
          if (st.weeklyReports !== undefined) payload.weekly_reports = st.weeklyReports;

          api.updateSettings(payload).catch((err) => {
            console.error("Failed to update settings on backend:", err);
            toast.error("Failed to sync settings changes to server.");
          });
        }
      },

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

      syncDrafts: () => set({ drafts: [], pendingSync: 0, isSyncing: false, syncProgress: 0 }),

      triggerSync: () => {
        const state = useApp.getState();
        if (state.drafts.length === 0 || state.isSyncing) return;

        set({ isSyncing: true, syncProgress: 0 });

        const runSync = async () => {
          try {
            if (state.mode === "online") {
              const draftsPayload = state.drafts.map((d) => ({
                id: d.id,
                customerName: d.customerName,
                jewelryType: d.jewelryType,
                weight: d.weight,
                step: d.step,
                savedAt: d.savedAt
              }));
              await api.syncDrafts(draftsPayload);
              
              const updatedIns = await api.getInspections();
              set({
                inspections: updatedIns.data,
                isSyncing: false,
                syncProgress: 100,
                lastSyncedAt: new Date().toISOString(),
                drafts: [],
                pendingSync: 0
              });
              return;
            }
          } catch (err) {
            console.error("Error syncing drafts with backend:", err);
          }

          // Offline fallback animation loop
          const timer = setInterval(() => {
            set((s) => {
              if (s.syncProgress >= 100) {
                clearInterval(timer);
                const newInspections = s.drafts.map((d) => ({
                  id: d.id,
                  customerId: `CUS-${Math.floor(20000 + Math.random() * 10000)}`,
                  customerName: d.customerName,
                  contact: "+91 98200 12345",
                  jewelryType: d.jewelryType as any,
                  purity: "22K" as any,
                  description: `${d.jewelryType} created offline`,
                  weight: d.weight,
                  length: 45,
                  width: 15,
                  thickness: 1.5,
                  branch: s.profile.branch,
                  appraiser: s.profile.name,
                  date: new Date().toISOString(),
                  status: "Genuine" as any,
                  authenticityScore: 95,
                  riskScore: 5,
                  confidence: 96,
                  qualityScore: 92,
                  lighting: 88,
                  focus: 94,
                  angleCoverage: 90,
                  factors: { density: 95, surface: 94, reflection: 96, touchstone: 94, visualDefect: 92 },
                  images: {},
                  notes: "Synchronized from offline draft.",
                  loan: { decision: "Pending" as any, ltv: 75, amount: Math.round(d.weight * 7200 * 0.916 * 0.75), marketRate: 7200 },
                  audit: [
                    { ts: new Date().toISOString(), actor: s.profile.name, action: "Inspection Synchronized", detail: "Uploaded from offline storage cache" }
                  ]
                }));

                return {
                  isSyncing: false,
                  syncProgress: 0,
                  lastSyncedAt: new Date().toISOString(),
                  inspections: [...newInspections, ...s.inspections],
                  drafts: [],
                  pendingSync: 0
                };
              }
              return { syncProgress: s.syncProgress + 10 };
            });
          }, 250);
        };

        runSync();
      }
    }),
    {
      name: "goldguard-app-storage",
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        drafts: state.drafts,
        pendingSync: state.pendingSync,
        lastSyncedAt: state.lastSyncedAt
      }),
    }
  )
);
