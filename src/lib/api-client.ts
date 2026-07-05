// GoldGuard AI Portal — API Client
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// Guard: sessionStorage only exists in browser, not in SSR/Node.js
const isBrowser = typeof window !== "undefined" && typeof sessionStorage !== "undefined";

const getToken = (): string | null => {
  if (!isBrowser) return null;
  return sessionStorage.getItem("gg_token");
};

const setToken = (token: string): void => {
  if (!isBrowser) return;
  sessionStorage.setItem("gg_token", token);
};

const removeToken = (): void => {
  if (!isBrowser) return;
  sessionStorage.removeItem("gg_token");
};

export function mapInspectionKeys(i: any): any {
  if (!i) return i;
  return {
    ...i,
    customerId: i.customerId ?? i.customer_id,
    customerName: i.customerName ?? i.customer_name,
    jewelryType: i.jewelryType ?? i.jewelry_type,
    authenticityScore: i.authenticityScore ?? i.authenticity_score,
    riskScore: i.riskScore ?? i.risk_score,
    qualityScore: i.qualityScore ?? i.quality_score,
    angleCoverage: i.angleCoverage ?? i.angle_coverage,
    escalationStage: i.escalationStage ?? i.escalation_stage,
    escalationId: i.escalationId ?? i.escalation_id,
  };
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<boolean> {
    try {
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("Login API error:", e);
      return false;
    }
  }

  // ── Inspections ──────────────────────────────────────────────────────────
  async getInspections(skip = 0, limit = 100, status?: string, type?: string, search?: string) {
    const params = new URLSearchParams();
    params.append("skip", String(skip));
    params.append("limit", String(limit));
    if (status && status !== "All") params.append("status", status);
    if (type && type !== "All") params.append("jewelry_type", type);
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/inspections?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load inspections");
    const data = await res.json();
    const mappedData = Array.isArray(data) ? data.map(mapInspectionKeys) : [];
    const totalCount = parseInt(res.headers.get("X-Total-Count") || String(mappedData.length));
    return { data: mappedData, totalCount };
  }

  async createInspection(payload: any) {
    const res = await fetch(`${API_BASE_URL}/inspections`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create inspection");
    const item = await res.json();
    return mapInspectionKeys(item);
  }

  async getInspection(id: string) {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load inspection");
    const item = await res.json();
    return mapInspectionKeys(item);
  }

  async updateInspection(id: string, payload: any) {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update inspection");
    const item = await res.json();
    return mapInspectionKeys(item);
  }

  async submitInspection(id: string) {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}/submit`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to submit inspection");
    const item = await res.json();
    return mapInspectionKeys(item);
  }

  async uploadInspectionImage(id: string, angle: string, file: Blob) {
    const formData = new FormData();
    formData.append("file", file, `${angle}.jpg`);
    const headers: HeadersInit = {};
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE_URL}/inspections/${id}/images?angle=${angle}`, {
      method: "POST",
      headers: headers,
      body: formData,
    });
    if (!res.ok) throw new Error("Failed to upload image");
    return res.json();
  }

  async getInspectionReport(id: string) {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}/report`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load inspection report");
    return res.json();
  }

  async downloadInspectionReportPdf(id: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}/report/pdf`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to download PDF report: HTTP ${res.status}`);
    return res.blob();
  }

  // ── Branches ─────────────────────────────────────────────────────────────
  async getBranches() {
    const res = await fetch(`${API_BASE_URL}/branches`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load branches");
    return res.json();
  }

  async createBranch(payload: any) {
    const res = await fetch(`${API_BASE_URL}/branches`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create branch");
    return res.json();
  }

  async updateBranch(id: string, payload: any) {
    const res = await fetch(`${API_BASE_URL}/branches/${id}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update branch");
    return res.json();
  }

  async deleteBranch(id: string) {
    const res = await fetch(`${API_BASE_URL}/branches/${id}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete branch");
    return res.json();
  }

  // ── Employees ────────────────────────────────────────────────────────────
  async getEmployees() {
    const res = await fetch(`${API_BASE_URL}/employees`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load employees");
    return res.json();
  }

  async createEmployee(payload: any) {
    const res = await fetch(`${API_BASE_URL}/employees`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create employee");
    return res.json();
  }

  async updateEmployee(id: string, payload: any) {
    const res = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update employee");
    return res.json();
  }

  async deleteEmployee(id: string) {
    const res = await fetch(`${API_BASE_URL}/employees/${id}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete employee");
    return res.json();
  }

  async getLeaderboard() {
    const res = await fetch(`${API_BASE_URL}/employees/leaderboard`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load leaderboard");
    return res.json();
  }

  // ── Escalations ──────────────────────────────────────────────────────────
  async getEscalations() {
    const res = await fetch(`${API_BASE_URL}/escalations`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load escalations");
    return res.json();
  }

  async createEscalation(payload: { inspection_id: string; reason?: string }) {
    const res = await fetch(`${API_BASE_URL}/escalations`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create escalation");
    return res.json();
  }

  async approveEscalation(id: string) {
    const res = await fetch(`${API_BASE_URL}/escalations/${id}/approve`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to approve escalation");
    return res.json();
  }

  async rejectEscalation(id: string) {
    const res = await fetch(`${API_BASE_URL}/escalations/${id}/reject`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to reject escalation");
    return res.json();
  }

  async closeEscalation(id: string) {
    const res = await fetch(`${API_BASE_URL}/escalations/${id}/close`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to close escalation");
    return res.json();
  }

  async updateEscalationStage(id: string, stage: string, reason?: string) {
    const res = await fetch(`${API_BASE_URL}/escalations/${id}/stage`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify({ stage, reason }),
    });
    if (!res.ok) throw new Error("Failed to update escalation stage");
    return res.json();
  }

  // ── Notifications ────────────────────────────────────────────────────────
  async getNotifications() {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load notifications");
    return res.json();
  }

  async markNotificationRead(id: string) {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to mark notification read");
    return res.json();
  }

  async markAllNotificationsRead() {
    const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to mark all notifications read");
    return res.json();
  }

  async deleteNotification(id: string) {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete notification");
    return res.json();
  }

  // ── Reports ──────────────────────────────────────────────────────────────
  async getReports() {
    const res = await fetch(`${API_BASE_URL}/reports`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load reports");
    return res.json();
  }

  async generateReport(payload: {
    title?: string;
    type: string;
    branch_id?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/reports/generate`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to generate report");
    return res.json();
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  async getAnalytics(branchId?: string, fromDate?: string, toDate?: string, search?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append("branch_id", branchId);
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);
    if (search) params.append("search", search);
    const res = await fetch(`${API_BASE_URL}/analytics/dashboard?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load analytics");
    return res.json();
  }

  async getManagerAnalytics(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append("branch_id", branchId);
    const res = await fetch(`${API_BASE_URL}/analytics/manager?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load manager analytics");
    return res.json();
  }

  // ── Customers ────────────────────────────────────────────────────────────
  async getCustomers(skip = 0, limit = 100, search?: string) {
    const params = new URLSearchParams();
    params.append("skip", String(skip));
    params.append("limit", String(limit));
    if (search) params.append("search", search);

    const res = await fetch(`${API_BASE_URL}/customers?${params.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load customers");
    const data = await res.json();
    const totalCount = parseInt(res.headers.get("X-Total-Count") || String(data.length));
    return { data, totalCount };
  }

  async getCustomer(id: string) {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load customer");
    return res.json();
  }

  async createCustomer(payload: any) {
    const res = await fetch(`${API_BASE_URL}/customers`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create customer");
    return res.json();
  }

  async updateCustomer(id: string, payload: any) {
    const res = await fetch(`${API_BASE_URL}/customers/${id}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update customer");
    return res.json();
  }

  async getFraudTrends() {
    const res = await fetch(`${API_BASE_URL}/analytics/fraud-trends`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load fraud trends");
    return res.json();
  }

  async downloadReport(id: string): Promise<Blob> {
    const res = await fetch(`${API_BASE_URL}/reports/${id}/download`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to download report");
    return res.blob();
  }

  // ── Profile ──────────────────────────────────────────────────────────────
  async getMyProfile() {
    const res = await fetch(`${API_BASE_URL}/profile/me`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load profile");
    return res.json();
  }

  async updateMyProfile(payload: {
    full_name?: string;
    email?: string;
    designation?: string;
    phone?: string;
    address?: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/profile/me`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update profile");
    return res.json();
  }

  async changePassword(payload: {
    current_password: string;
    new_password: string;
  }) {
    const res = await fetch(`${API_BASE_URL}/profile/me/change-password`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to change password");
    return res.json();
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  async getSettings() {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load settings");
    return res.json();
  }

  async updateSettings(payload: any) {
    const res = await fetch(`${API_BASE_URL}/settings`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update settings");
    return res.json();
  }

  // ── Portfolio & Audit Logs ────────────────────────────────────────────────
  async getPortfolio() {
    const res = await fetch(`${API_BASE_URL}/portfolio/portfolio`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load portfolio");
    return res.json();
  }

  async getAuditLogs(limit = 100) {
    const res = await fetch(
      `${API_BASE_URL}/portfolio/audit-logs?limit=${limit}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) throw new Error("Failed to load audit logs");
    return res.json();
  }

  // ── AI Analysis ──────────────────────────────────────────────────────────
  async analyzeInspection(id: string) {
    const res = await fetch(`${API_BASE_URL}/ai/analyze/${id}`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to run AI analysis");
    return res.json();
  }

  async getAiResult(id: string) {
    const res = await fetch(`${API_BASE_URL}/ai/result/${id}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load AI prediction result");
    return res.json();
  }

  async generateVisualReview(id: string, angle: string) {
    const res = await fetch(`${API_BASE_URL}/inspections/${id}/visual-review`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ angle }),
    });
    if (!res.ok) throw new Error("Failed to generate AI visual review");
    return res.json();
  }

  async chatWithAssistant(message: string) {
    const res = await fetch(`${API_BASE_URL}/ai/chat`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error("Failed to communicate with AI assistant");
    return res.json();
  }

  async getAiStatus() {
    const res = await fetch(`${API_BASE_URL}/ai/status`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to retrieve AI service status");
    return res.json();
  }

  // ── Sync ─────────────────────────────────────────────────────────────────
  async syncDrafts(drafts: any[]) {
    const res = await fetch(`${API_BASE_URL}/sync/drafts`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({ drafts }),
    });
    if (!res.ok) throw new Error("Failed to sync drafts");
    return res.json();
  }

  async register(payload: any): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Registration failed. Please try again.");
        return false;
      }
      if (payload?.role === "Bank Administrator") {
        toast.success("Bank initialized! Your Admin account is pending approval from the Super Admin.");
      } else {
        toast.success("Registration submitted! Your account is pending approval from the appropriate authority.");
      }
      return true;
    } catch (e) {
      console.warn("Register API error:", e);
      toast.error("Network error during registration.");
      return false;
    }
  }

  async getBanks(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/banks`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.warn("getBanks error:", e);
      return [];
    }
  }

  async getPendingUsers() {
    const res = await fetch(`${API_BASE_URL}/users/pending`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load pending user registrations");
    return res.json();
  }

  async approveUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/approve`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to approve user registration");
    return res.json();
  }

  async rejectUser(userId: string) {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/reject`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to reject user registration");
    return res.json();
  }

  // Super Admin Platform Controls
  async getSuperAdminStats() {
    const res = await fetch(`${API_BASE_URL}/superadmin/stats`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load platform stats");
    return res.json();
  }

  async getSuperAdminBanks() {
    const res = await fetch(`${API_BASE_URL}/superadmin/banks`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load organizations");
    return res.json();
  }

  async approveBank(orgId: string) {
    const res = await fetch(`${API_BASE_URL}/superadmin/banks/${orgId}/approve`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to approve bank onboarding");
    return res.json();
  }

  async rejectBank(orgId: string) {
    const res = await fetch(`${API_BASE_URL}/superadmin/banks/${orgId}/reject`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to reject bank onboarding");
    return res.json();
  }

  async suspendBank(orgId: string) {
    const res = await fetch(`${API_BASE_URL}/superadmin/banks/${orgId}/suspend`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to suspend organization");
    return res.json();
  }

  async activateBank(orgId: string) {
    const res = await fetch(`${API_BASE_URL}/superadmin/banks/${orgId}/activate`, {
      method: "POST",
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to activate organization");
    return res.json();
  }

  async getSuperAdminUsers() {
    const res = await fetch(`${API_BASE_URL}/superadmin/users`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load platform users");
    return res.json();
  }

  async getSuperAdminAuditLogs() {
    const res = await fetch(`${API_BASE_URL}/superadmin/audit-logs`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load platform audit logs");
    return res.json();
  }

  async getSuperAdminHealth() {
    const res = await fetch(`${API_BASE_URL}/superadmin/health`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to load platform health status");
    return res.json();
  }
}

export const api = new ApiClient();


