import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { GlassCard, StatusChip } from "@/components/glass";
import { useApp } from "@/stores/app-store";
import { Search, ChevronRight, User, Phone, IndianRupee, Shield, ArrowUpDown, History } from "lucide-react";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [{ title: "Customer Portfolio — GoldGuard AI" }] }),
  component: CustomersPage,
});

function fmtINR(n: number) {
  return "₹ " + n.toLocaleString("en-IN");
}

function CustomersPage() {
  const inspections = useApp((s) => s.inspections);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Group inspections by customer to build the customer profiles dynamically
  const customers = useMemo(() => {
    const map: Record<string, {
      id: string;
      name: string;
      contact: string;
      inspectionsCount: number;
      activeLoansCount: number;
      totalLoanValue: number;
      totalGoldWeight: number;
      highestRisk: string;
      inspectionsList: typeof inspections;
    }> = {};

    inspections.forEach((ins) => {
      if (!map[ins.customerId]) {
        map[ins.customerId] = {
          id: ins.customerId,
          name: ins.customerName,
          contact: ins.contact,
          inspectionsCount: 0,
          activeLoansCount: 0,
          totalLoanValue: 0,
          totalGoldWeight: 0,
          highestRisk: "Genuine",
          inspectionsList: [],
        };
      }

      const c = map[ins.customerId];
      c.inspectionsCount += 1;
      c.inspectionsList.push(ins);
      c.totalGoldWeight += ins.weight;

      if (ins.loan.decision === "Approve") {
        c.activeLoansCount += 1;
        c.totalLoanValue += ins.loan.amount;
      }

      // Check worst risk category
      const riskRanking: Record<string, number> = { "Genuine": 0, "Low Risk": 1, "Pending": 2, "Suspicious": 3, "High Risk": 4 };
      if (riskRanking[ins.status] > riskRanking[c.highestRisk]) {
        c.highestRisk = ins.status;
      }
    });

    return Object.values(map);
  }, [inspections]);

  // Filter list
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q) || c.contact.includes(q);
    });
  }, [customers, search]);

  const selectedCustomer = useMemo(() => {
    if (!selectedId) return null;
    return customers.find((c) => c.id === selectedId) || null;
  }, [customers, selectedId]);

  // Set initial selected customer if not set
  useMemo(() => {
    if (!selectedId && filteredCustomers.length > 0) {
      setSelectedId(filteredCustomers[0].id);
    }
  }, [filteredCustomers, selectedId]);

  const customerGoldAssets = useMemo(() => {
    if (!selectedCustomer) return [];
    const map: Record<string, { type: string; count: number; weight: number }> = {};
    selectedCustomer.inspectionsList.forEach((ins) => {
      if (!map[ins.jewelryType]) {
        map[ins.jewelryType] = { type: ins.jewelryType, count: 0, weight: 0 };
      }
      map[ins.jewelryType].count += 1;
      map[ins.jewelryType].weight += ins.weight;
    });
    return Object.values(map);
  }, [selectedCustomer]);

  return (
    <>
      <AppHeader
        title="Customer Portfolio"
        subtitle={`${customers.length} registered borrowers under active monitoring`}
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search customer ID, name, or phone..."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-1 space-y-4">
          <GlassCard className="overflow-hidden">
            <div className="p-4 border-b border-black/5 bg-black/5 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-foreground/45">
              <span>Customer Name</span>
              <span>Total Active Loans</span>
            </div>
            <div className="divide-y divide-black/5 max-h-[600px] overflow-y-auto">
              {filteredCustomers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full p-4 flex items-center justify-between hover:bg-white/40 text-left transition ${
                    selectedId === c.id ? "bg-[color:var(--gold)]/10 text-[color:var(--gold)]" : ""
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      {c.name}
                      {c.highestRisk === "High Risk" && (
                        <span className="size-2 rounded-full bg-[color:var(--risk)]" />
                      )}
                    </div>
                    <div className="text-[10px] text-foreground/50 mt-0.5">{c.id} • {c.inspectionsCount} inspections</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{fmtINR(c.totalLoanValue)}</div>
                    <div className="text-[10px] text-foreground/50">{c.activeLoansCount} active loans</div>
                  </div>
                </button>
              ))}
              {filteredCustomers.length === 0 && (
                <div className="p-8 text-center text-foreground/50 text-sm">
                  No customers found matching "{search}"
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Customer Details Sheet */}
        <div className="lg:col-span-2 space-y-6">
          {selectedCustomer ? (
            <div className="space-y-6 animate-float-in">
              {/* Header profile info */}
              <GlassCard variant="strong" className="p-6 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 size-48 rounded-full gold-shimmer opacity-10 blur-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="size-16 rounded-2xl bg-[color:var(--gold)]/15 text-[color:var(--gold)] grid place-items-center font-bold text-xl">
                      <User className="size-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        {selectedCustomer.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-foreground/55 mt-1">
                        <span>ID: {selectedCustomer.id}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Phone className="size-3" /> {selectedCustomer.contact}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/45">Risk Assessment</div>
                    <StatusChip status={selectedCustomer.highestRisk} />
                  </div>
                </div>
              </GlassCard>

              {/* Financial & Gold Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <GlassCard className="p-4 bg-white/50 border border-white/60">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">Active Loan Balance</p>
                  <p className="text-display text-2xl mt-2 text-[color:var(--gold)] font-bold">{fmtINR(selectedCustomer.totalLoanValue)}</p>
                  <p className="text-[10px] text-foreground/45 mt-1">{selectedCustomer.activeLoansCount} Approved Loans</p>
                </GlassCard>
                <GlassCard className="p-4 bg-white/50 border border-white/60">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">Gold Collateral Weight</p>
                  <p className="text-display text-2xl mt-2 font-bold">{selectedCustomer.totalGoldWeight.toFixed(2)} g</p>
                  <p className="text-[10px] text-foreground/45 mt-1">Across all inspections</p>
                </GlassCard>
                <GlassCard className="p-4 bg-white/50 border border-white/60">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/45">Total Inspections</p>
                  <p className="text-display text-2xl mt-2 font-bold">{selectedCustomer.inspectionsCount}</p>
                  <p className="text-[10px] text-foreground/45 mt-1">Inspections history log</p>
                </GlassCard>
              </div>

              {/* Collateral Breakdown */}
              <GlassCard className="p-6">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <Shield className="size-4 text-[color:var(--gold)]" /> Collateral Inventory
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {customerGoldAssets.map((asset) => (
                    <div key={asset.type} className="p-3.5 rounded-2xl bg-white/60 border border-black/5 text-center">
                      <div className="text-xs font-bold text-foreground/70">{asset.type}</div>
                      <div className="text-lg font-bold text-[color:var(--gold)] mt-1.5">{asset.count} units</div>
                      <div className="text-[10px] text-foreground/50 mt-0.5">{asset.weight.toFixed(1)}g total</div>
                    </div>
                  ))}
                  {customerGoldAssets.length === 0 && (
                    <div className="col-span-full py-4 text-center text-xs text-foreground/40">No assets listed.</div>
                  )}
                </div>
              </GlassCard>

              {/* Previous Inspections & Loan History */}
              <GlassCard className="p-6">
                <h3 className="text-base font-bold mb-4 flex items-center gap-2">
                  <History className="size-4 text-[color:var(--gold)]" /> Inspections & Loan Decisions
                </h3>
                <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wider text-foreground/45 border-b border-black/5 pb-2">
                        <th className="pb-2">Inspection ID</th>
                        <th className="pb-2">Details</th>
                        <th className="pb-2">Branch</th>
                        <th className="pb-2">Appraisal Result</th>
                        <th className="pb-2 text-right">LTV %</th>
                        <th className="pb-2 text-right">Loan Value</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {selectedCustomer.inspectionsList.map((ins) => (
                        <tr key={ins.id} className="hover:bg-white/30 transition">
                          <td className="py-3 font-semibold">{ins.id}</td>
                          <td className="py-3">
                            <div>{ins.purity} {ins.jewelryType}</div>
                            <div className="text-[10px] text-foreground/50">{ins.weight}g</div>
                          </td>
                          <td className="py-3 text-foreground/60">{ins.branch}</td>
                          <td className="py-3"><StatusChip status={ins.status} /></td>
                          <td className="py-3 text-right font-semibold">{ins.loan.ltv}%</td>
                          <td className="py-3 text-right font-bold">{fmtINR(ins.loan.amount)}</td>
                          <td className="py-3 text-right">
                            <Link to="/inspection/$id" params={{ id: ins.id }} className="text-[11px] text-[color:var(--gold)] font-bold hover:underline">Inspect</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="p-16 text-center text-foreground/55">
              Select a customer from the sidebar to inspect their loan history.
            </GlassCard>
          )}
        </div>
      </div>
    </>
  );
}
