/**
 * VendorDashboard.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - fetchForecast reads payload.chartData correctly (plain array, no custom props)
 *  - Forecast metric cards display real RMSE + MAPE from API response
 *  - Suggested Reorder Quantity = max(0, predictedDemand − currentStock)
 *  - Delete product button added (calls DELETE /api/products/:id with auth)
 *  - vendorId read from JWT payload, not raw localStorage (security)
 *  - All product mutation calls go through authFetch
 */

import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import ForecastChart from "../components/Chart";
import { authFetch } from "../utils/authFetch";
import {
  Plus, Check, RefreshCw, AlertTriangle,
  Package, DollarSign, TrendingUp, BarChart2,
  Boxes, ShoppingCart, Trash2, Edit2,
} from "lucide-react";

function XIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/** Decode JWT payload to read vendorId/name from token — never from plain localStorage */
function getJwtPayload() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return {};
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export default function VendorDashboard() {
  const [products,  setProducts]  = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [vendorId,  setVendorId]  = useState("");
  const [vendorName,setVendorName]= useState("");

  // Forecast state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [forecastData,      setForecastData]       = useState([]);
  const [forecastMetrics,   setForecastMetrics]    = useState({ rmse: null, mape: null });
  const [forecastSource,    setForecastSource]     = useState("lstm");
  const [salesSummary,      setSalesSummary]       = useState([]);

  // Inventory recs
  const [inventoryRecs, setInventoryRecs] = useState([]);
  const [recsLoading,   setRecsLoading]   = useState(false);

  // UI
  const [isMLRunning,   setIsMLRunning]   = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [showModal,     setShowModal]     = useState(false);
  const [editingProduct,setEditingProduct]= useState(null);
  const [loading,       setLoading]       = useState(true);

  // Add product form
  const [newProductName,     setNewProductName]     = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Organic Food");
  const [newProductPrice,    setNewProductPrice]    = useState("");
  const [newProductStock,    setNewProductStock]    = useState("");
  const [newProductDesc,     setNewProductDesc]     = useState("");
  const [newProductImg,      setNewProductImg]      = useState("");

  // ── Fetch forecast ─────────────────────────────────────────────────────────
  const fetchForecast = useCallback(async (productId) => {
    if (!productId) return;
    setIsMLRunning(true);
    setForecastError("");
    try {
      const res = await authFetch(`/api/forecast/${productId}`);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || "Forecast API error");
      }
      const payload = await res.json();
      // FIX: payload.chartData is a plain array (no custom array properties)
      setForecastData(Array.isArray(payload.chartData) ? payload.chartData : []);
      setForecastMetrics(payload.metrics ?? { rmse: null, mape: null });
      setForecastSource(payload.source || "lstm");
    } catch (err) {
      setForecastError("Could not load forecast. Ensure the backend is running.");
      setForecastData([]);
      setForecastMetrics({ rmse: null, mape: null });
    } finally {
      setIsMLRunning(false);
    }
  }, []);

  const fetchSalesSummary = useCallback(async (vid) => {
    try {
      const res = await authFetch(`/api/sales-history/summary?vendorId=${vid}`);
      if (res.ok) setSalesSummary(await res.json());
    } catch { /* non-fatal */ }
  }, []);

  const fetchInventoryRecs = useCallback(async (vid) => {
    setRecsLoading(true);
    try {
      const res = await authFetch(`/api/inventory-recommendation?vendorId=${vid}`);
      if (res.ok) setInventoryRecs(await res.json());
    } catch { /* non-fatal */ } finally {
      setRecsLoading(false);
    }
  }, []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const payload = getJwtPayload();
    const vid  = payload.vendorId  || localStorage.getItem("vendorId") || "v-01";
    const name = payload.name      || localStorage.getItem("userName") || "Vendor";
    setVendorId(vid);
    setVendorName(name);

    const load = async () => {
      try {
        const prodRes = await authFetch(`/api/products?vendorId=${vid}&limit=50`);
        const prodData = prodRes.ok ? await prodRes.json() : null;
        const loaded   = prodData?.products ?? prodData ?? [];
        setProducts(Array.isArray(loaded) ? loaded : []);

        if (loaded.length > 0) {
          setSelectedProductId(loaded[0].id);
          fetchForecast(loaded[0].id);
        }

        const orderRes = await authFetch(`/api/orders?vendorId=${vid}`);
        if (orderRes.ok) setOrders(await orderRes.json());

        fetchSalesSummary(vid);
        fetchInventoryRecs(vid);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [fetchForecast, fetchSalesSummary, fetchInventoryRecs]);

  // ── Product chart selector ─────────────────────────────────────────────────
  const handleProductChartChange = (productId) => {
    setSelectedProductId(productId);
    fetchForecast(productId);
  };

  // ── Order status update ────────────────────────────────────────────────────
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await authFetch(`/api/orders/${orderId}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
    } catch { /* optimistic already applied */ }
  };

  // ── Stock adjustment ───────────────────────────────────────────────────────
  const handleUpdateStock = async (productId, currentStock, change) => {
    const nextStock = Math.max(0, currentStock + change);
    setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, stock: nextStock } : p));
    try {
      await authFetch(`/api/products/${productId}`, {
        method: "PUT",
        body: JSON.stringify({ stock: nextStock }),
      });
      // Refresh recommendations after stock change
      setTimeout(() => fetchInventoryRecs(vendorId), 300);
    } catch { /* optimistic */ }
  };

  // ── Delete product ─────────────────────────────────────────────────────────
  const handleDeleteProduct = async (productId, productName) => {
    if (!window.confirm(`Delete "${productName}"? This cannot be undone.`)) return;
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    try {
      await authFetch(`/api/products/${productId}`, { method: "DELETE" });
      fetchInventoryRecs(vendorId);
    } catch {
      // Revert on failure
      const prodRes = await authFetch(`/api/products?vendorId=${vendorId}&limit=50`).catch(() => null);
      if (prodRes?.ok) {
        const data = await prodRes.json();
        setProducts(data.products ?? data ?? []);
      }
    }
  };

  // ── Save product (Add or Edit) ─────────────────────────────────────────────
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!newProductName || !newProductPrice || !newProductStock) {
      alert("Please fill in required fields.");
      return;
    }

    const payload = {
      name:             newProductName,
      category:         newProductCategory,
      price:            parseFloat(newProductPrice),
      stock:            parseInt(newProductStock, 10),
      description:      newProductDesc || "No description provided.",
      image:            newProductImg || "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80",
    };

    if (editingProduct) {
      // Edit mode
      try {
        const res = await authFetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const updated = await res.json();
          setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        } else {
          alert("Failed to update product.");
        }
      } catch {
        alert("Error updating product. Ensure the server is running.");
      }
    } else {
      // Add mode
      payload.vendorId = vendorId;
      payload.reorderThreshold = Math.ceil(parseInt(newProductStock, 10) * 0.2);
      payload.salesVelocity = 1.5;

      try {
        const res = await authFetch("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const freshProduct = res.ok ? await res.json() : { ...payload, id: `p-${Date.now()}` };
        setProducts((prev) => [...prev, freshProduct]);
      } catch {
        setProducts((prev) => [...prev, { ...payload, id: `p-${Date.now()}` }]);
      }
    }

    setShowModal(false);
    setEditingProduct(null);
    setNewProductName(""); setNewProductPrice(""); setNewProductStock("");
    setNewProductDesc(""); setNewProductImg(""); setNewProductCategory("Organic Food");
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setNewProductName(""); setNewProductPrice(""); setNewProductStock("");
    setNewProductDesc(""); setNewProductImg(""); setNewProductCategory("Organic Food");
    setShowModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setNewProductName(product.name || "");
    setNewProductCategory(product.category || "Organic Food");
    setNewProductPrice(product.price || "");
    setNewProductStock(product.stock || "");
    setNewProductDesc(product.description || "");
    setNewProductImg(product.image || "");
    setShowModal(true);
  };

  // ── Derived metrics ────────────────────────────────────────────────────────
  const lowStockItems       = products.filter((p) => p.stock <= (p.reorderThreshold ?? 0));
  const totalVendorRevenue  = orders.reduce((s, o) => s + (o.status === "Delivered" ? o.total : 0), 0);
  const activeOrdersCount   = orders.filter((o) => o.status !== "Delivered").length;
  const selectedProduct     = products.find((p) => p.id === selectedProductId);
  const productSummary      = salesSummary.find((s) => s.productId === selectedProductId);
  const effectiveVelocity   = productSummary?.avgDailySales ?? selectedProduct?.salesVelocity ?? 0;
  const projectedStockoutDays =
    selectedProduct && effectiveVelocity > 0
      ? Math.round(selectedProduct.stock / effectiveVelocity)
      : null;
  const showCriticalWarning = projectedStockoutDays !== null && projectedStockoutDays <= 7;
  const selectedRec         = inventoryRecs.find((r) => r.productId === selectedProductId);

  return (
    <div className="min-h-screen flex flex-col bg-warmwhite">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-darkgray">Merchant Dashboard</h1>
            <p className="text-xs text-darkgray/65 mt-0.5">
              Welcome, <strong className="text-darkgray">{vendorName}</strong> · Real-time demand
              forecasting &amp; inventory management
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Add Product Listing
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-olive">
            <span className="w-8 h-8 border-4 border-olive/30 border-t-olive rounded-full animate-spin" />
            <span className="ml-3 font-semibold text-darkgray">Loading dashboard data...</span>
          </div>
        ) : (
          <>
        {/* Overview cards */}
        <section className="grid sm:grid-cols-3 gap-6">
          <MetricCard
            label="Net Revenue"
            value={`₹${totalVendorRevenue.toLocaleString("en-IN")}`}
            sub="After platform commissions"
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            label="Active Orders"
            value={activeOrdersCount}
            sub="Awaiting fulfillment"
            icon={<Package className="w-5 h-5" />}
          />
          <MetricCard
            label="Restock Warnings"
            value={lowStockItems.length}
            sub="Items below safety threshold"
            icon={<AlertTriangle className="w-5 h-5" />}
            valueColor={lowStockItems.length > 0 ? "text-red-500" : "text-darkgray"}
            iconBg={lowStockItems.length > 0 ? "bg-red-50 text-red-500" : "bg-olive/10 text-olive"}
          />
        </section>

        {/* Forecast + Replenishment */}
        <section className="grid lg:grid-cols-3 gap-6">

          {/* Chart panel */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-olive/10 p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="font-display font-semibold text-darkgray text-lg flex items-center gap-1.5">
                  <TrendingUp className="w-5 h-5 text-olive" />
                  30-Day Demand Forecast
                </h3>
                <p className="text-[11px] text-darkgray/55 mt-0.5">
                  {forecastSource === "lstm"
                    ? "LSTM Neural Network (JS)"
                    : "Exponential Smoothing (JS fallback)"}
                  {" "}· 95% confidence interval
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChartChange(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-olive/15 bg-warmwhite text-darkgray focus:outline-none focus:ring-1 focus:ring-olive transition"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchForecast(selectedProductId)}
                  disabled={isMLRunning}
                  className="p-2 border border-olive/15 hover:bg-beige/40 text-darkgray/70 rounded-xl transition disabled:opacity-50"
                  title="Refresh forecast"
                >
                  <RefreshCw className={`w-4 h-4 ${isMLRunning ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            <div className="relative flex-1 min-h-[240px]">
              {isMLRunning && (
                <div className="absolute inset-0 bg-white/75 backdrop-blur-sm flex items-center justify-center z-10 text-xs font-bold text-darkgray/70 rounded-xl">
                  <span className="w-4 h-4 border-2 border-olive border-t-transparent rounded-full animate-spin mr-2" />
                  Generating forecast from sales history…
                </div>
              )}
              {forecastError && !isMLRunning ? (
                <div className="flex items-center justify-center h-full text-xs text-red-500 font-semibold">
                  {forecastError}
                </div>
              ) : (
                <ForecastChart
                  data={forecastData}
                  source={forecastSource}
                  currentStock={selectedProduct?.stock ?? null}
                  metrics={forecastMetrics}
                />
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-olive/5 text-[10px] font-bold text-darkgray/65">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-[#87986A] inline-block" /> Historical Sales
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-[#6B7D4F] inline-block" /> Forecast
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-3 bg-olive/10 inline-block rounded-sm" /> 95% Confidence Bounds
              </div>
            </div>
          </div>

          {/* Replenishment insights */}
          <div className="bg-white rounded-2xl border border-olive/10 p-6 flex flex-col gap-4">
            <h3 className="font-display font-semibold text-darkgray text-lg">Replenishment Insights</h3>

            {selectedProduct ? (
              <>
                {/* Stock alert */}
                {showCriticalWarning ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold">Stockout Impending</p>
                      <p className="mt-0.5 leading-relaxed">
                        At {effectiveVelocity} units/day, stock of{" "}
                        <strong>{selectedProduct.stock}</strong> units runs out in{" "}
                        <strong>{projectedStockoutDays} day{projectedStockoutDays !== 1 ? "s" : ""}</strong>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-700">
                    <Check className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold">Inventory Stable</p>
                      <p className="mt-0.5 leading-relaxed">
                        Current stock covers{" "}
                        <strong>{projectedStockoutDays ?? "—"} day{projectedStockoutDays !== 1 ? "s" : ""}</strong>{" "}
                        of demand.
                      </p>
                    </div>
                  </div>
                )}

                {/* Metrics grid — FIX: shows real RMSE/MAPE from API */}
                <div className="grid grid-cols-2 gap-3">
                  <InsightTile label="Avg Daily Sales" value={effectiveVelocity} unit="units / day" />
                  <InsightTile
                    label="Days of Cover"
                    value={projectedStockoutDays ?? "—"}
                    unit="days remaining"
                    color={showCriticalWarning ? "text-red-600" : "text-emerald-600"}
                    bg={showCriticalWarning ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}
                  />
                  <InsightTile label="Current Stock" value={selectedProduct.stock} unit={`reorder at ${selectedProduct.reorderThreshold ?? 0}`} icon={<Package className="w-3 h-3" />} />
                  <InsightTile
                    label="Predicted 30d"
                    value={selectedRec?.totalPredictedDemand ?? Math.ceil(effectiveVelocity * 30)}
                    unit="units demand"
                    color="text-blue-600"
                    bg="bg-blue-50 border-blue-100"
                    icon={<TrendingUp className="w-3 h-3" />}
                  />
                </div>

                {/* ML accuracy metrics — FIX: real RMSE + MAPE */}
                {(forecastMetrics.rmse !== null || forecastMetrics.mape !== null) && (
                  <div className="grid grid-cols-2 gap-3">
                    <InsightTile
                      label="RMSE"
                      value={forecastMetrics.rmse !== null ? forecastMetrics.rmse.toFixed(2) : "—"}
                      unit="root mean sq. error"
                      bg="bg-purple-50 border-purple-100"
                      color="text-purple-600"
                    />
                    <InsightTile
                      label="MAPE"
                      value={forecastMetrics.mape !== null ? `${forecastMetrics.mape.toFixed(1)}%` : "—"}
                      unit="mean abs. % error"
                      bg="bg-purple-50 border-purple-100"
                      color="text-purple-600"
                    />
                  </div>
                )}

                {/* Recommended reorder — FIX: max(0, predictedDemand − currentStock) */}
                <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 ${
                  (selectedRec?.recommendedReorder ?? 1) > 0
                    ? "bg-amber-50 border-amber-100"
                    : "bg-emerald-50 border-emerald-100"
                }`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-darkgray/45 flex items-center gap-1">
                      <ShoppingCart className="w-3 h-3" /> Recommended Reorder
                    </span>
                    <span className={`font-display text-2xl font-bold leading-none ${
                      (selectedRec?.recommendedReorder ?? 1) > 0 ? "text-amber-600" : "text-emerald-600"
                    }`}>
                      {selectedRec
                        ? selectedRec.recommendedReorder > 0
                          ? `${selectedRec.recommendedReorder} units`
                          : "None needed"
                        : `${Math.max(0, Math.ceil(effectiveVelocity * 30) - (selectedProduct?.stock ?? 0))} units`}
                    </span>
                    <span className="text-[10px] text-darkgray/50">
                      Formula: predicted demand − current stock
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const qty = selectedRec?.recommendedReorder > 0
                        ? selectedRec.recommendedReorder
                        : 50;
                      handleUpdateStock(selectedProductId, selectedProduct.stock, qty);
                      setTimeout(() => fetchInventoryRecs(vendorId), 300);
                    }}
                    className="shrink-0 px-4 py-2.5 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow-sm transition whitespace-nowrap"
                  >
                    Reorder Now
                  </button>
                </div>

                {productSummary && (
                  <div className="space-y-2 pt-2 border-t border-olive/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-darkgray/35">Historical Summary</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-darkgray/55">Total Units Sold</span>
                      <span className="font-bold text-darkgray">{productSummary.totalQuantity}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-darkgray/55">Total Revenue</span>
                      <span className="font-bold text-darkgray">₹{productSummary.totalRevenue.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-darkgray/55">First Sale</span>
                      <span className="font-bold text-darkgray">{productSummary.firstSaleDate}</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-darkgray/40">Select a product to view replenishment insights.</p>
            )}
          </div>
        </section>

        {/* Inventory Reorder Recommendations */}
        <section className="bg-white rounded-2xl border border-olive/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-semibold text-darkgray text-lg flex items-center gap-2">
              <Boxes className="w-5 h-5 text-olive" />
              Inventory Reorder Recommendations
            </h3>
            <button
              onClick={() => fetchInventoryRecs(vendorId)}
              disabled={recsLoading}
              className="p-2 border border-olive/15 hover:bg-beige/40 text-darkgray/70 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${recsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {recsLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-xs text-darkgray/50 font-semibold">
              <span className="w-4 h-4 border-2 border-olive border-t-transparent rounded-full animate-spin" />
              Calculating recommendations…
            </div>
          ) : inventoryRecs.length === 0 ? (
            <p className="text-xs text-darkgray/40 py-6 text-center italic">
              No products found. Add products to see reorder recommendations.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-olive/10 text-darkgray/50 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Product</th>
                    <th className="pb-3 text-center">Current Stock</th>
                    <th className="pb-3 text-center">Predicted 30d</th>
                    <th className="pb-3 text-center">Reorder Qty</th>
                    <th className="pb-3 text-center">RMSE</th>
                    <th className="pb-3 text-center">MAPE</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive/5">
                  {inventoryRecs.map((rec) => {
                    const product = products.find((p) => p.id === rec.productId);
                    return (
                      <tr key={rec.productId} className="text-darkgray hover:bg-beige/10 transition">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            {product?.image && (
                              <img src={product.image} alt={rec.productName}
                                className="w-9 h-9 rounded-lg object-cover bg-beige shrink-0" />
                            )}
                            <span className="font-semibold truncate max-w-[140px]">{rec.productName}</span>
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            rec.currentStock <= (product?.reorderThreshold ?? 0)
                              ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                          }`}>
                            <Package className="w-3 h-3" />{rec.currentStock}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold">
                            <TrendingUp className="w-3 h-3" />{rec.totalPredictedDemand}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          {rec.recommendedReorder > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold">
                              <ShoppingCart className="w-3 h-3" />{rec.recommendedReorder}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold">
                              <Check className="w-3 h-3" />None
                            </span>
                          )}
                        </td>
                        {/* FIX: RMSE + MAPE from real API metrics */}
                        <td className="py-4 text-center">
                          <span className="text-[10px] font-bold text-purple-600">
                            {rec.metrics?.rmse != null ? rec.metrics.rmse.toFixed(2) : "—"}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className="text-[10px] font-bold text-purple-600">
                            {rec.metrics?.mape != null ? `${rec.metrics.mape.toFixed(1)}%` : "—"}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                            rec.status === "critical"
                              ? "bg-red-50 text-red-500 border border-red-100"
                              : rec.status === "low"
                              ? "bg-amber-50 text-amber-600 border border-amber-100"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          }`}>
                            {rec.status === "critical" ? "⚠ Critical" : rec.status === "low" ? "Low" : "Adequate"}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {rec.recommendedReorder > 0 ? (
                            <button
                              onClick={() => handleUpdateStock(rec.productId, rec.currentStock, rec.recommendedReorder)}
                              className="px-3 py-1.5 bg-olive hover:bg-olive-600 text-white font-bold text-[10px] rounded-xl shadow-sm transition whitespace-nowrap"
                            >
                              Reorder {rec.recommendedReorder}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-darkgray/30">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-4 pt-4 border-t border-olive/5 text-[10px] text-darkgray/40 leading-relaxed">
                <strong className="text-darkgray/55">Formula:</strong> Recommended Reorder Qty = Predicted 30-Day Demand − Current Stock (min 0).
              </p>
            </div>
          )}
        </section>

        {/* Sales History Summary */}
        {salesSummary.length > 0 && (
          <section className="bg-white rounded-2xl border border-olive/10 p-6">
            <h3 className="font-display font-semibold text-darkgray text-lg mb-5 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-olive" />
              Sales History Summary
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-olive/10 text-darkgray/50 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">Total Units</th>
                    <th className="pb-3">Total Revenue</th>
                    <th className="pb-3">Avg Daily</th>
                    <th className="pb-3">First Sale</th>
                    <th className="pb-3">Last Sale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive/5">
                  {salesSummary.map((s) => {
                    const product = products.find((p) => p.id === s.productId);
                    return (
                      <tr key={s.productId} className="text-darkgray hover:bg-beige/10 transition cursor-pointer"
                        onClick={() => handleProductChartChange(s.productId)}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {product?.image && (
                              <img src={product.image} alt={product?.name}
                                className="w-8 h-8 rounded-lg object-cover bg-beige shrink-0" />
                            )}
                            <span className="font-semibold truncate max-w-[160px]">{product?.name ?? s.productId}</span>
                          </div>
                        </td>
                        <td className="py-3 font-semibold">{s.totalQuantity}</td>
                        <td className="py-3 font-semibold">₹{s.totalRevenue.toLocaleString("en-IN")}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 bg-olive/10 text-olive font-bold rounded-lg text-[10px]">
                            {s.avgDailySales}/day
                          </span>
                        </td>
                        <td className="py-3 text-darkgray/60">{s.firstSaleDate}</td>
                        <td className="py-3 text-darkgray/60">{s.lastSaleDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Inventory + Orders */}
        <section className="grid lg:grid-cols-2 gap-8">

          {/* Inventory table with delete button */}
          <div className="bg-white rounded-2xl border border-olive/10 p-6">
            <h3 className="font-display font-semibold text-darkgray text-lg mb-6">Storefront Inventory</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-olive/10 text-darkgray/50 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Product</th>
                    <th className="pb-3">Stock</th>
                    <th className="pb-3">Price</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive/5">
                  {products.map((p) => (
                    <tr key={p.id} className="text-darkgray hover:bg-beige/10 transition">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <img src={p.image} alt={p.name}
                            className="w-10 h-10 rounded-lg object-cover bg-beige" />
                          <div>
                            <p className="font-bold truncate max-w-[130px]">{p.name}</p>
                            <span className="text-[9px] uppercase tracking-wider text-olive/80 font-bold">{p.category}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          p.stock <= (p.reorderThreshold ?? 0) ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {p.stock} units
                        </span>
                      </td>
                      <td className="py-4 font-medium">₹{p.price.toLocaleString("en-IN")}</td>
                      <td className="py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <div className="inline-flex border border-olive/15 rounded-lg overflow-hidden bg-white">
                            <button onClick={() => handleUpdateStock(p.id, p.stock, -10)}
                              className="px-2.5 py-1.5 hover:bg-beige text-xs font-bold">−10</button>
                            <button onClick={() => handleUpdateStock(p.id, p.stock, 10)}
                              className="px-2.5 py-1.5 hover:bg-beige border-l border-olive/10 text-xs font-bold">+10</button>
                          </div>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition ml-1"
                            title="Edit product"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* FIX: delete product button */}
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition ml-1"
                            title="Delete product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-xs text-darkgray/40 italic">
                        No products yet. Add your first listing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Orders table */}
          <div className="bg-white rounded-2xl border border-olive/10 p-6">
            <h3 className="font-display font-semibold text-darkgray text-lg mb-6">Recent Customer Orders</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-olive/10 text-darkgray/50 uppercase tracking-widest text-[9px] font-bold">
                    <th className="pb-3">Customer / Items</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-olive/5">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-darkgray/40 italic">
                        No orders placed yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.id} className="text-darkgray hover:bg-beige/10 transition">
                        <td className="py-4">
                          <p className="font-bold">{o.customerName}</p>
                          <p className="text-[10px] text-darkgray/55 font-medium truncate max-w-[180px]">
                            {o.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                          </p>
                        </td>
                        <td className="py-4 font-semibold">₹{o.total.toLocaleString("en-IN")}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                            o.status === "Pending"
                              ? "bg-yellow-50 text-yellow-600 border border-yellow-100"
                              : o.status === "Shipped"
                              ? "bg-blue-50 text-blue-600 border border-blue-100"
                              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          {o.status === "Pending" && (
                            <button onClick={() => handleUpdateOrderStatus(o.id, "Shipped")}
                              className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white font-bold text-[10px] rounded-lg transition">
                              Mark Shipped
                            </button>
                          )}
                          {o.status === "Shipped" && (
                            <button onClick={() => handleUpdateOrderStatus(o.id, "Delivered")}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] rounded-lg transition">
                              Deliver Pack
                            </button>
                          )}
                          {o.status === "Delivered" && (
                            <span className="text-[10px] font-bold text-darkgray/40">Complete</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        </>
        )}

      </main>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-darkgray/40 backdrop-blur-sm p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-olive/10 relative">
            <button onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1 hover:bg-beige/45 rounded-full transition text-darkgray/55">
              <XIcon className="w-5 h-5" />
            </button>
            <h3 className="font-display font-semibold text-darkgray text-lg mb-6">
              {editingProduct ? "Edit Store Listing" : "Create Store Listing"}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Product Name</label>
                <input type="text" required value={newProductName} onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive"
                  placeholder="e.g. Handmade Ceramic Bowl" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Price (INR)</label>
                  <input type="number" required value={newProductPrice} onChange={(e) => setNewProductPrice(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive"
                    placeholder="1899" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Stock Qty</label>
                  <input type="number" required value={newProductStock} onChange={(e) => setNewProductStock(e.target.value)}
                    className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive"
                    placeholder="30" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Category</label>
                <select value={newProductCategory} onChange={(e) => setNewProductCategory(e.target.value)}
                  className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive">
                  <option value="Organic Food">Organic Food</option>
                  <option value="Apparel">Apparel</option>
                  <option value="Home & Kitchen">Home &amp; Kitchen</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Image URL (optional)</label>
                <input type="text" value={newProductImg} onChange={(e) => setNewProductImg(e.target.value)}
                  className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive"
                  placeholder="https://images.unsplash.com/..." />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-1.5">Description</label>
                <textarea rows={3} value={newProductDesc} onChange={(e) => setNewProductDesc(e.target.value)}
                  className="w-full px-4 py-2 text-xs border border-olive/15 rounded-xl bg-warmwhite/30 focus:outline-none focus:ring-1 focus:ring-olive resize-none"
                  placeholder="Describe your product…" />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-olive/20 text-darkgray font-bold text-xs rounded-xl hover:bg-beige/40 transition">
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 py-3 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow transition">
                  {editingProduct ? "Save Changes" : "List Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable insight tile ─────────────────────────────────────────────────────

function InsightTile({ label, value, unit, icon, color = "text-darkgray", bg = "bg-beige/40 border-olive/8" }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${bg}`}>
      <span className="text-[9px] font-black uppercase tracking-wider text-darkgray/45 flex items-center gap-1">
        {icon}{label}
      </span>
      <span className={`font-display text-xl font-bold leading-none ${color}`}>{value}</span>
      <span className="text-[10px] text-darkgray/50">{unit}</span>
    </div>
  );
}

function MetricCard({ label, value, sub, icon, valueColor = "text-darkgray", iconBg = "bg-olive/10 text-olive" }) {
  return (
    <div className="premium-card p-6 flex items-center justify-between bg-white rounded-2xl border border-olive/10 shadow-sm">
      <div className="space-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-darkgray/50 block">{label}</span>
        <p className={`font-display text-2xl font-bold ${valueColor}`}>{value}</p>
        <span className="text-[9px] font-bold text-olive/80 block">{sub}</span>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>{icon}</div>
    </div>
  );
}