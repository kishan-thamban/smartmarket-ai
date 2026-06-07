/**
 * AdminDashboard.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - Authorization: Bearer <token> header added to every API request.
 *  - Uses authFetch utility consistently (auto-attaches token, handles 401).
 *  - Removed dependency on INITIAL_VENDORS/INITIAL_PRODUCTS from mockData for seeding
 *    (mockData is still used as a safe fallback if the API is down).
 */

import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { INITIAL_VENDORS, INITIAL_PRODUCTS, PLATFORM_STATS } from "../data/mockData";
import { authFetch } from "../utils/authFetch";
import {
  Users, TrendingUp, DollarSign, Percent,
  ShieldAlert, ShieldCheck, X,
} from "lucide-react";

export default function AdminDashboard() {
  const [vendors,         setVendors]         = useState([]);
  const [products,        setProducts]        = useState([]);
  const [stats,           setStats]           = useState(PLATFORM_STATS);
  const [commissionInput, setCommissionInput] = useState(PLATFORM_STATS.commissionRate);
  const [alertMessage,    setAlertMessage]    = useState("");
  const [alertType,       setAlertType]       = useState("success"); // "success" | "error"

  const showAlert = (msg, type = "success") => {
    setAlertMessage(msg);
    setAlertType(type);
    setTimeout(() => setAlertMessage(""), 3500);
  };

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const loadAdminData = async () => {
      try {
        // FIX: authFetch automatically attaches Bearer token
        const vendorRes = await authFetch("/api/vendors");
        if (vendorRes.ok) {
          setVendors(await vendorRes.json());
        } else {
          setVendors(INITIAL_VENDORS);
        }
      } catch {
        setVendors(INITIAL_VENDORS);
      }

      try {
        const prodRes = await authFetch("/api/products?limit=50");
        if (prodRes.ok) {
          const data = await prodRes.json();
          setProducts(data.products ?? data);
        } else {
          setProducts(INITIAL_PRODUCTS);
        }
      } catch {
        setProducts(INITIAL_PRODUCTS);
      }

      try {
        const statsRes = await authFetch("/api/admin/stats");
        if (statsRes.ok) {
          const loadedStats = await statsRes.json();
          setStats(loadedStats);
          setCommissionInput(loadedStats.commissionRate);
        } else {
          setStats(PLATFORM_STATS);
        }
      } catch {
        setStats(PLATFORM_STATS);
      }
    };

    loadAdminData();
  }, []);

  // ── Update commission rate ─────────────────────────────────────────────────
  const handleUpdateCommission = async (e) => {
    e.preventDefault();
    const rate = parseFloat(commissionInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showAlert("Commission rate must be between 0 and 100.", "error");
      return;
    }

    try {
      // FIX: authFetch attaches Authorization header
      const response = await authFetch("/api/admin/commission", {
        method: "POST",
        body: JSON.stringify({ rate }),
      });

      if (response.ok) {
        const { stats: updatedStats } = await response.json();
        setStats(updatedStats);
        setCommissionInput(updatedStats.commissionRate);
        showAlert("Global commission parameters updated successfully.");
      } else {
        // Optimistic UI fallback
        setStats((prev) => ({
          ...prev,
          commissionRate:   rate,
          totalCommission:  Math.round(prev.gmv * (rate / 100)),
        }));
        showAlert("Commission updated locally (server sync pending).", "error");
      }
    } catch {
      setStats((prev) => ({
        ...prev,
        commissionRate:  rate,
        totalCommission: Math.round(prev.gmv * (rate / 100)),
      }));
      showAlert("Network error — commission updated locally only.", "error");
    }
  };

  // ── Vendor approval flow ───────────────────────────────────────────────────
  const handleApproveVendor = async (vendorId, status) => {
    // Optimistic update
    setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, status } : v));

    try {
      // FIX: authFetch attaches Authorization header
      const response = await authFetch(`/api/vendors/${vendorId}/approval`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        showAlert(err.message || "Failed to update vendor status.", "error");
        // Revert optimistic update
        setVendors((prev) => prev.map((v) => v.id === vendorId ? { ...v, status: v._prevStatus ?? v.status } : v));
      }
    } catch {
      showAlert("Network error — vendor status update may not have persisted.", "error");
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const activeVendors  = vendors.filter((v) => v.status === "Approved");
  const pendingVendors = vendors.filter((v) => v.status === "Pending Approval");

  return (
    <div className="min-h-screen flex flex-col bg-warmwhite">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-darkgray">Platform Administration</h1>
          <p className="text-xs text-darkgray/65 mt-0.5">
            Global commission overrides, merchant registrations, and system auditing metrics
          </p>
        </div>

        {/* Alert banner */}
        {alertMessage && (
          <div className={`p-4 border text-xs font-semibold rounded-xl flex items-center justify-between ${
            alertType === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}>
            <span>{alertMessage}</span>
            <button onClick={() => setAlertMessage("")} className="ml-4 opacity-60 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Overview cards */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Platform GMV"
            value={`₹${stats.gmv.toLocaleString("en-IN")}`}
            sub="Aggregated product revenue"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <StatCard
            label="Total Commissions"
            value={`₹${stats.totalCommission.toLocaleString("en-IN")}`}
            sub={`Cut collected at ${stats.commissionRate}%`}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <StatCard
            label="Approved Vendors"
            value={activeVendors.length}
            sub="Verified merchants selling"
            icon={<Users className="w-5 h-5" />}
          />
          <StatCard
            label="Pending Applications"
            value={pendingVendors.length}
            sub="Applications awaiting audit"
            icon={<ShieldAlert className="w-5 h-5" />}
            pulse={pendingVendors.length > 0}
            valueColor={pendingVendors.length > 0 ? "text-yellow-600" : "text-darkgray"}
            iconBg={pendingVendors.length > 0 ? "bg-yellow-50 text-yellow-600" : "bg-olive/10 text-olive"}
          />
        </section>

        {/* Commission + Health */}
        <section className="grid lg:grid-cols-3 gap-6">
          {/* Commission form */}
          <div className="bg-white rounded-2xl border border-olive/10 p-6">
            <h3 className="font-display font-semibold text-darkgray text-lg mb-4 flex items-center gap-1.5">
              <Percent className="w-5 h-5 text-olive" />
              Commission Parameters
            </h3>
            <p className="text-xs text-darkgray/65 leading-relaxed mb-6">
              Adjust the global percentage cut deducted from vendor orders. Changes apply to new
              checkouts immediately.
            </p>

            <form onSubmit={handleUpdateCommission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-2">
                  Global Platform Share (%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.5"
                    value={commissionInput}
                    onChange={(e) => setCommissionInput(e.target.value)}
                    className="w-24 px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 text-center font-bold text-darkgray focus:outline-none focus:ring-1 focus:ring-olive"
                  />
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Inventory health */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-olive/10 p-6">
            <h3 className="font-display font-semibold text-darkgray text-lg mb-6">
              Platform Inventory Health Summary
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-beige/35 rounded-xl border border-olive/5">
                <p className="text-xs text-darkgray/55 mb-1">Total Products</p>
                <p className="text-2xl font-bold font-display text-darkgray">{products.length}</p>
              </div>
              <div className="p-4 bg-beige/35 rounded-xl border border-olive/5">
                <p className="text-xs text-darkgray/55 mb-1">Average Rating</p>
                <p className="text-2xl font-bold font-display text-darkgray">
                  {products.length
                    ? (products.reduce((s, p) => s + (p.ratings || 0), 0) / products.length).toFixed(1)
                    : "—"} / 5.0
                </p>
              </div>
              <div className="p-4 bg-beige/35 rounded-xl border border-olive/5">
                <p className="text-xs text-darkgray/55 mb-1">Stockout Risks</p>
                <p className="text-2xl font-bold font-display text-red-500">
                  {products.filter((p) => p.stock <= (p.reorderThreshold ?? 0)).length} items
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Vendor approval panel */}
        <section className="bg-white rounded-2xl border border-olive/10 p-6">
          <h3 className="font-display font-semibold text-darkgray text-lg mb-6">
            Merchant Approval Auditing Panel
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-olive/10 text-darkgray/50 uppercase tracking-widest text-[9px] font-bold">
                  <th className="pb-3">Merchant Name</th>
                  <th className="pb-3">Brand Store</th>
                  <th className="pb-3">Registration Date</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-olive/5">
                {vendors.map((v) => (
                  <tr key={v.id} className="text-darkgray hover:bg-beige/10 transition">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-full bg-olive/10 text-olive flex items-center justify-center font-bold text-sm">
                          {v.logo || v.name[0]}
                        </span>
                        <div>
                          <p className="font-bold">{v.name}</p>
                          <p className="text-[10px] text-darkgray/50 font-medium">{v.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-semibold text-darkgray">{v.storeName}</td>
                    <td className="py-4 font-medium text-darkgray/60">{v.joinedDate}</td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                        v.status === "Approved"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          : v.status === "Rejected"
                          ? "bg-red-50 text-red-500 border border-red-100"
                          : "bg-yellow-50 text-yellow-600 border border-yellow-100 animate-pulse"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {v.status === "Pending Approval" ? (
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleApproveVendor(v.id, "Approved")}
                            className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition"
                            title="Approve Application"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleApproveVendor(v.id, "Rejected")}
                            className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                            title="Reject Application"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-darkgray/40 font-bold uppercase tracking-wider">
                          Audited
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {vendors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-darkgray/40 italic">
                      No vendors found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}

// ── Reusable stat card ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, pulse = false, valueColor = "text-darkgray", iconBg = "bg-olive/10 text-olive" }) {
  return (
    <div className="premium-card p-6 flex items-center justify-between bg-white rounded-2xl border border-olive/10 shadow-sm">
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-darkgray/50 block">{label}</span>
        <p className={`font-display text-2xl font-bold ${valueColor} ${pulse ? "animate-pulse" : ""}`}>{value}</p>
        <span className="text-[9px] font-bold text-olive/80 block">{sub}</span>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}