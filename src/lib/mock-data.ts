// Deterministic mock data for GoldGuard AI

export type RiskCategory = "Genuine" | "Low Risk" | "Suspicious" | "High Risk" | "Pending";
export type JewelryType = "Necklace" | "Bangle" | "Ring" | "Chain" | "Earring" | "Coin" | "Pendant";
export type Purity = "18K" | "20K" | "22K" | "24K";
export type LoanDecision = "Approve" | "Hold" | "Reject" | "Pending";
export type EscalationStage = "Suspicious" | "Escalated" | "Manager Review" | "Final Decision";

export interface AuditEvent {
  ts: string;       // ISO
  actor: string;
  action: string;
  detail?: string;
}

export interface Inspection {
  id: string;
  customerId: string;
  customerName: string;
  contact: string;
  jewelryType: JewelryType;
  purity: Purity;
  description: string;
  weight: number;       // grams
  length: number;       // mm
  width: number;        // mm
  thickness: number;    // mm
  branch: string;
  appraiser: string;
  date: string;         // ISO
  status: RiskCategory;
  authenticityScore: number; // 0-100
  riskScore: number;         // 0-100
  confidence: number;        // 0-100
  qualityScore: number;
  lighting: number;
  focus: number;
  angleCoverage: number;
  factors: {
    density: number;
    surface: number;
    reflection: number;
    touchstone: number;
    visualDefect: number;
  };
  images: {
    front?: string; back?: string; left?: string; right?: string; top?: string;
    reflection?: string; touchstone?: string;
  };
  notes: string;
  loan: {
    decision: LoanDecision;
    ltv: number;          // %
    amount: number;       // INR
    marketRate: number;   // INR/g
  };
  audit: AuditEvent[];
  escalationStage?: EscalationStage;
}

export interface Branch {
  id: string;
  name: string;
  city: string;
  inspectionsToday: number;
  pendingReviews: number;
  fraudCases: number;
  approvalRate: number;
  fraudRate: number;
  riskScore: number;     // 0-100, higher = riskier
  goldValueToday: number;  // INR
  goldProcessedKg: number;
  avgPurity: string;
  // Approximate position on stylized india svg (0-100)
  mapX: number;
  mapY: number;
}

export interface Employee {
  id: string;
  name: string;
  branch: string;
  designation: string;
  inspections: number;
  flagged: number;
  accuracy: number;     // %
  trend: number[];      // 7-day
  initials: string;
}

export interface AppNotification {
  id: string;
  type: "Inspection Completed" | "High Risk Alert" | "Report Generated" | "Review Required";
  title: string;
  message: string;
  ts: string;
  read: boolean;
}

export interface Report {
  id: string;
  title: string;
  type: "Daily" | "Weekly" | "Monthly" | "Branch" | "Fraud" | "Executive";
  date: string;
  branch: string;
  size: string;
  description: string;
}

// --- Deterministic PRNG ---
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const BRANCHES: Branch[] = [
  { id: "br-nashik", name: "Nashik Central", city: "Nashik", inspectionsToday: 18, pendingReviews: 4, fraudCases: 2, approvalRate: 94, fraudRate: 3.1, riskScore: 38, goldValueToday: 7_82_000, goldProcessedKg: 1.2, avgPurity: "22K", mapX: 36, mapY: 49 },
  { id: "br-pune",   name: "Pune South",     city: "Pune",   inspectionsToday: 24, pendingReviews: 6, fraudCases: 4, approvalRate: 91, fraudRate: 4.4, riskScore: 52, goldValueToday: 12_40_000, goldProcessedKg: 1.9, avgPurity: "22K", mapX: 38, mapY: 56 },
  { id: "br-mumbai", name: "Mumbai Fort",    city: "Mumbai", inspectionsToday: 31, pendingReviews: 8, fraudCases: 3, approvalRate: 96, fraudRate: 2.6, riskScore: 29, goldValueToday: 18_60_000, goldProcessedKg: 2.8, avgPurity: "22K", mapX: 32, mapY: 53 },
  { id: "br-aurangabad", name: "Aurangabad", city: "Aurangabad", inspectionsToday: 14, pendingReviews: 3, fraudCases: 1, approvalRate: 92, fraudRate: 2.9, riskScore: 34, goldValueToday: 5_20_000, goldProcessedKg: 0.8, avgPurity: "20K", mapX: 41, mapY: 50 },
];

export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Rajesh Patil",    branch: "Nashik Central", designation: "Senior Appraiser", inspections: 56, flagged: 2, accuracy: 97.4, trend: [6, 8, 7, 9, 10, 8, 8], initials: "RP" },
  { id: "e2", name: "Priya Sharma",    branch: "Mumbai Fort",    designation: "Lead Appraiser",   inspections: 44, flagged: 1, accuracy: 98.1, trend: [4, 6, 7, 8, 6, 7, 6], initials: "PS" },
  { id: "e3", name: "Amit Deshmukh",   branch: "Pune South",     designation: "Appraiser",        inspections: 41, flagged: 3, accuracy: 94.2, trend: [5, 6, 5, 6, 7, 6, 6], initials: "AD" },
  { id: "e4", name: "Sneha Joshi",     branch: "Mumbai Fort",    designation: "Appraiser",        inspections: 38, flagged: 0, accuracy: 99.0, trend: [5, 5, 6, 7, 5, 5, 5], initials: "SJ" },
  { id: "e5", name: "Vikram Singh",    branch: "Pune South",     designation: "Senior Appraiser", inspections: 35, flagged: 2, accuracy: 95.8, trend: [4, 5, 5, 6, 5, 5, 5], initials: "VS" },
  { id: "e6", name: "Kavita Rao",      branch: "Aurangabad",     designation: "Appraiser",        inspections: 28, flagged: 1, accuracy: 96.4, trend: [3, 4, 4, 5, 4, 4, 4], initials: "KR" },
  { id: "e7", name: "Manoj Kulkarni",  branch: "Nashik Central", designation: "Appraiser",        inspections: 26, flagged: 1, accuracy: 96.0, trend: [3, 4, 3, 5, 4, 4, 3], initials: "MK" },
  { id: "e8", name: "Anita Iyer",      branch: "Aurangabad",     designation: "Lead Appraiser",   inspections: 22, flagged: 0, accuracy: 98.6, trend: [3, 3, 4, 4, 3, 3, 2], initials: "AI" },
];

const FIRST_NAMES = ["Rohit", "Anjali", "Suresh", "Meera", "Karan", "Pooja", "Ajay", "Neha", "Sanjay", "Divya", "Mahesh", "Sunita", "Vivek", "Rekha", "Aniket", "Trupti"];
const LAST_NAMES = ["Sharma", "Patel", "Joshi", "Mehta", "Kulkarni", "Rao", "Iyer", "Bhosale", "Pawar", "Singh", "Verma", "Kapoor"];
const TYPES: JewelryType[] = ["Necklace", "Bangle", "Ring", "Chain", "Earring", "Coin", "Pendant"];
const PURITIES: Purity[] = ["18K", "20K", "22K", "24K"];
const STATUSES: RiskCategory[] = ["Genuine", "Low Risk", "Suspicious", "High Risk", "Pending"];

function makeAudit(id: string, dateISO: string, branch: string, appraiser: string): AuditEvent[] {
  const t = new Date(dateISO).getTime();
  const at = (m: number) => new Date(t + m * 60_000).toISOString();
  return [
    { ts: at(0),  actor: appraiser, action: "Inspection Created", detail: `ID ${id} • ${branch}` },
    { ts: at(2),  actor: appraiser, action: "Customer Verified" },
    { ts: at(4),  actor: appraiser, action: "Weight Entered" },
    { ts: at(6),  actor: appraiser, action: "Images Uploaded", detail: "5 angles + reflection + touchstone" },
    { ts: at(8),  actor: "System",  action: "Quality Score Computed" },
    { ts: at(9),  actor: "System",  action: "Risk Analysis Completed" },
    { ts: at(10), actor: "System",  action: "Report Generated" },
  ];
}

function pick<T>(arr: T[], r: number): T {
  return arr[Math.floor(r * arr.length)];
}

function generateInspections(): Inspection[] {
  const out: Inspection[] = [];
  const now = Date.now();
  for (let i = 0; i < 80; i++) {
    const seed = hashStr("ins" + i);
    const r = mulberry32(seed);
    const rand = () => r();
    const branch = pick(BRANCHES, rand());
    const emp = EMPLOYEES.filter(e => e.branch === branch.name)[Math.floor(rand() * Math.max(1, EMPLOYEES.filter(e => e.branch === branch.name).length))] || EMPLOYEES[0];
    const status = pick(STATUSES, Math.pow(rand(), 1.8)); // skew toward Genuine
    const purity = pick(PURITIES, rand());
    const type = pick(TYPES, rand());
    const fn = pick(FIRST_NAMES, rand());
    const ln = pick(LAST_NAMES, rand());
    const weight = +(5 + rand() * 75).toFixed(2);
    const daysAgo = Math.floor(rand() * 90);
    const date = new Date(now - daysAgo * 86400000 - Math.floor(rand() * 86400000)).toISOString();
    const id = `INS-${(10000 + i).toString()}`;
    const isBad = status === "High Risk" || status === "Suspicious";
    const auth = isBad ? 30 + Math.floor(rand() * 40) : 85 + Math.floor(rand() * 15);
    const risk = isBad ? 60 + Math.floor(rand() * 35) : Math.floor(rand() * 25);
    const conf = 80 + Math.floor(rand() * 19);
    const purityMult: Record<Purity, number> = { "18K": 0.75, "20K": 0.83, "22K": 0.916, "24K": 1.0 };
    const marketRate = 7200; // INR/g for 24K
    const grossValue = Math.round(weight * marketRate * purityMult[purity]);
    const ltv = isBad ? 0 : 70 + Math.floor(rand() * 15);
    const loanAmount = Math.round(grossValue * (ltv / 100));
    const decision: LoanDecision = isBad ? (status === "High Risk" ? "Reject" : "Hold") : (rand() > 0.3 ? "Approve" : "Pending");

    out.push({
      id,
      customerId: `CUS-${(20000 + i).toString()}`,
      customerName: `${fn} ${ln}`,
      contact: `+91 9${Math.floor(100000000 + rand() * 899999999)}`,
      jewelryType: type,
      purity,
      description: `${purity} ${type.toLowerCase()} — ${["traditional", "antique", "modern", "handcrafted", "filigree"][Math.floor(rand() * 5)]} design`,
      weight,
      length: +(20 + rand() * 80).toFixed(1),
      width: +(5 + rand() * 30).toFixed(1),
      thickness: +(1 + rand() * 6).toFixed(2),
      branch: branch.name,
      appraiser: emp.name,
      date,
      status,
      authenticityScore: auth,
      riskScore: risk,
      confidence: conf,
      qualityScore: 70 + Math.floor(rand() * 28),
      lighting: 75 + Math.floor(rand() * 24),
      focus: 80 + Math.floor(rand() * 19),
      angleCoverage: status === "Pending" ? 60 : 90 + Math.floor(rand() * 10),
      factors: {
        density: isBad ? 30 + Math.floor(rand() * 40) : 88 + Math.floor(rand() * 11),
        surface: isBad ? 35 + Math.floor(rand() * 40) : 86 + Math.floor(rand() * 13),
        reflection: isBad ? 30 + Math.floor(rand() * 40) : 90 + Math.floor(rand() * 9),
        touchstone: isBad ? 40 + Math.floor(rand() * 40) : 92 + Math.floor(rand() * 7),
        visualDefect: isBad ? 25 + Math.floor(rand() * 40) : 90 + Math.floor(rand() * 9),
      },
      images: {},
      notes: isBad
        ? "Anomalies detected in surface reflectance and touchstone streak; recommend secondary assay."
        : "All visual and touchstone markers align with declared purity. No defects.",
      loan: {
        decision,
        ltv,
        amount: loanAmount,
        marketRate,
      },
      audit: makeAudit(id, date, branch.name, emp.name),
      escalationStage: status === "High Risk" ? "Manager Review" : status === "Suspicious" ? "Escalated" : undefined,
    });
  }
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export const INSPECTIONS: Inspection[] = generateInspections();

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n1", type: "High Risk Alert", title: "High risk case detected", message: "INS-10042 flagged at Pune South — surface anomaly score 73%", ts: new Date(Date.now() - 8 * 60000).toISOString(), read: false },
  { id: "n2", type: "Inspection Completed", title: "Inspection completed", message: "INS-10039 by Priya Sharma — Genuine, 98% confidence", ts: new Date(Date.now() - 22 * 60000).toISOString(), read: false },
  { id: "n3", type: "Review Required", title: "Manager review pending", message: "INS-10036 awaiting your decision (Mumbai Fort)", ts: new Date(Date.now() - 55 * 60000).toISOString(), read: false },
  { id: "n4", type: "Report Generated", title: "Monthly Executive Report ready", message: "November 2025 fraud summary available for download", ts: new Date(Date.now() - 3 * 3600000).toISOString(), read: true },
  { id: "n5", type: "High Risk Alert", title: "Cluster of suspicious cases", message: "3 suspicious cases in Pune South in last 24h", ts: new Date(Date.now() - 5 * 3600000).toISOString(), read: true },
  { id: "n6", type: "Inspection Completed", title: "Inspection completed", message: "INS-10031 — Low Risk, approved with 75% LTV", ts: new Date(Date.now() - 7 * 3600000).toISOString(), read: true },
  { id: "n7", type: "Review Required", title: "Touchstone discrepancy", message: "INS-10028 — touchstone streak inconsistent with stated purity", ts: new Date(Date.now() - 11 * 3600000).toISOString(), read: true },
  { id: "n8", type: "Report Generated", title: "Branch report ready", message: "Nashik Central weekly summary generated", ts: new Date(Date.now() - 26 * 3600000).toISOString(), read: true },
  { id: "n9", type: "Inspection Completed", title: "Inspection completed", message: "INS-10024 — Genuine 24K coin, 99% confidence", ts: new Date(Date.now() - 30 * 3600000).toISOString(), read: true },
  { id: "n10", type: "High Risk Alert", title: "Repeat customer flagged", message: "Customer CUS-20019 has 2 prior High Risk inspections", ts: new Date(Date.now() - 50 * 3600000).toISOString(), read: true },
  { id: "n11", type: "Report Generated", title: "Fraud trend report", message: "Q4 fraud trend analysis is now available", ts: new Date(Date.now() - 72 * 3600000).toISOString(), read: true },
  { id: "n12", type: "Review Required", title: "Pending appraisals", message: "8 inspections awaiting review at Mumbai Fort", ts: new Date(Date.now() - 96 * 3600000).toISOString(), read: true },
];

export const REPORTS: Report[] = [
  { id: "r1", title: "Monthly Fraud Summary — November 2025", type: "Executive", date: "2025-11-30", branch: "All Branches", size: "2.4 MB", description: "Board-ready executive summary covering fraud rate, hotspots, branch ranking, top patterns." },
  { id: "r2", title: "Daily Inspection Log — Today",         type: "Daily",     date: new Date().toISOString().slice(0, 10), branch: "All Branches", size: "412 KB", description: "All inspections completed today across branches." },
  { id: "r3", title: "Pune South — Weekly Performance",      type: "Weekly",    date: "2025-11-24", branch: "Pune South", size: "780 KB", description: "Inspection volume, approval rate, and flagged cases for the week." },
  { id: "r4", title: "Mumbai Fort — Branch Snapshot",        type: "Branch",    date: "2025-11-28", branch: "Mumbai Fort", size: "1.1 MB", description: "Branch-level metrics, top appraisers, and risk distribution." },
  { id: "r5", title: "Fraud Pattern Analysis — Q4",          type: "Fraud",     date: "2025-11-20", branch: "All Branches", size: "1.8 MB", description: "Recurring fraud patterns and modus operandi observed in Q4." },
  { id: "r6", title: "Nashik Central — Weekly Performance",  type: "Weekly",    date: "2025-11-24", branch: "Nashik Central", size: "640 KB", description: "Weekly KPIs and trend analysis for Nashik Central." },
  { id: "r7", title: "Aurangabad — Branch Snapshot",         type: "Branch",    date: "2025-11-28", branch: "Aurangabad", size: "520 KB", description: "Snapshot of Aurangabad branch operations and risk profile." },
  { id: "r8", title: "High Risk Cases — Detailed",           type: "Fraud",     date: "2025-11-15", branch: "All Branches", size: "920 KB", description: "Deep dive into all high risk cases with evidence summary." },
];

// Time-series for charts
export function fraudTrend(): { date: string; cases: number }[] {
  const out = [];
  const now = Date.now();
  for (let i = 29; i >= 0; i--) {
    const r = mulberry32(hashStr("ft" + i))();
    out.push({
      date: new Date(now - i * 86400000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      cases: 2 + Math.floor(r * 8),
    });
  }
  return out;
}

export function monthlyInspections(): { month: string; total: number; flagged: number }[] {
  const months = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
  return months.map((m, i) => {
    const r = mulberry32(hashStr("mi" + i))();
    const total = 1800 + Math.floor(r * 800);
    return { month: m, total, flagged: Math.floor(total * (0.025 + r * 0.02)) };
  });
}

export function approvalTrend(): { date: string; approved: number; rejected: number }[] {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const r = mulberry32(hashStr("at" + i))();
    out.push({
      date: `W${12 - i}`,
      approved: 80 + Math.floor(r * 18),
      rejected: 2 + Math.floor(r * 6),
    });
  }
  return out;
}

export const PROFILE_DEFAULT = {
  name: "Anand Verma",
  designation: "Senior Appraiser",
  branch: "Mumbai Fort",
  email: "anand.verma@goldguard.in",
  phone: "+91 98202 14567",
  avatar: "",
  notifPrefs: { email: true, inApp: true, sms: false, highRiskOnly: false },
};

export const SETTINGS_DEFAULT = {
  language: "English",
  density: "Comfortable" as "Comfortable" | "Compact",
  defaultBranch: "Mumbai Fort",
  reportFormat: "PDF" as "PDF" | "CSV" | "XLSX",
  notifChannels: { inApp: true, email: true, sms: false },
};
