import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
import { INITIAL_PRODUCTS } from "../data/mockData";
import {
  Search, ShoppingBag, X, Star, CreditCard, ChevronRight, Check,
  SlidersHorizontal, ArrowUpDown, ChevronLeft, ChevronDown, ShoppingCart,
} from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest First" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc",label: "Price: High → Low" },
  { value: "rating",    label: "Highest Rated" },
  { value: "name",      label: "Name A–Z" },
  { value: "stock",     label: "Most in Stock" },
];

const PAGE_LIMIT = 6;

// Debounce hook – delays a value update by `delay` ms
function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function CustomerMarketplace() {
  const navigate = useNavigate();

  // ── Cart from context ──
  const { items: cart, cartCount, cartTotal, addItem, updateQuantity, removeItem } = useCart();

  // ── Product / filter state ──
  const [products, setProducts]             = useState([]);
  const [pagination, setPagination]         = useState({ page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false });
  const [meta, setMeta]                     = useState({ categories: ["All"], priceRange: { min: 0, max: 10000 } });
  const [loading, setLoading]               = useState(true);

  // Filter controls (live – some are debounced before hitting the API)
  const [searchInput, setSearchInput]       = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [priceMin, setPriceMin]             = useState("");
  const [priceMax, setPriceMax]             = useState("");
  const [sortBy, setSortBy]                 = useState("newest");
  const [currentPage, setCurrentPage]       = useState(1);
  const [showFilters, setShowFilters]       = useState(false);
  const [sortOpen, setSortOpen]             = useState(false);

  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedMin    = useDebounce(priceMin, 500);
  const debouncedMax    = useDebounce(priceMax, 500);

  // ── Product detail / cart drawer ──
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isCartOpen, setIsCartOpen]           = useState(false);
  const [checkoutStep, setCheckoutStep]       = useState("idle");
  const [shippingAddress, setShippingAddress] = useState("");
  const [customerName, setCustomerName]       = useState("");
  const [paymentStatus, setPaymentStatus]     = useState("idle");

  // Toast notification for "Added to cart"
  const [toast, setToast]                     = useState(null);
  const toastTimer                            = useRef(null);

  const sortRef = useRef(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setSortOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch product meta (categories + price range) once ──
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch("/api/products/meta");
        if (res.ok) {
          const data = await res.json();
          setMeta(data);
          setPriceMin("");
          setPriceMax("");
        }
      } catch {
        const cats = ["All", ...new Set(INITIAL_PRODUCTS.map((p) => p.category))];
        const prices = INITIAL_PRODUCTS.map((p) => p.price);
        setMeta({ categories: cats, priceRange: { min: Math.min(...prices), max: Math.max(...prices) } });
      }
    };
    fetchMeta();

    const savedName = localStorage.getItem("userName");
    if (savedName) setCustomerName(savedName);
  }, []);

  // ── Fetch products whenever any filter / sort / page changes ──
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (selectedCategory !== "All")  params.set("category", selectedCategory);
      if (debouncedMin !== "")         params.set("minPrice", debouncedMin);
      if (debouncedMax !== "")         params.set("maxPrice", debouncedMax);
      params.set("sortBy", sortBy);
      params.set("page",   currentPage);
      params.set("limit",  PAGE_LIMIT);

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
        setPagination(data.pagination);
        if (data.meta) setMeta(data.meta);
      } else {
        applyClientFilter();
      }
    } catch {
      applyClientFilter();
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedCategory, debouncedMin, debouncedMax, sortBy, currentPage]);

  // Client-side fallback
  const applyClientFilter = () => {
    let result = [...INITIAL_PRODUCTS];
    const q = debouncedSearch.trim().toLowerCase();
    if (q) result = result.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.category || "").toLowerCase().includes(q)
    );
    if (selectedCategory !== "All") result = result.filter((p) => p.category === selectedCategory);
    if (debouncedMin !== "") result = result.filter((p) => p.price >= parseFloat(debouncedMin));
    if (debouncedMax !== "") result = result.filter((p) => p.price <= parseFloat(debouncedMax));

    switch (sortBy) {
      case "price_asc":  result.sort((a, b) => a.price - b.price); break;
      case "price_desc": result.sort((a, b) => b.price - a.price); break;
      case "rating":     result.sort((a, b) => (b.ratings||0) - (a.ratings||0)); break;
      case "name":       result.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "stock":      result.sort((a, b) => (b.stock||0) - (a.stock||0)); break;
      default: break;
    }

    const total = result.length;
    const totalPages = Math.ceil(total / PAGE_LIMIT);
    const start = (currentPage - 1) * PAGE_LIMIT;
    setProducts(result.slice(start, start + PAGE_LIMIT));
    setPagination({ page: currentPage, limit: PAGE_LIMIT, total, totalPages, hasNext: currentPage < totalPages, hasPrev: currentPage > 1 });
  };

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Reset page to 1 when any filter changes
  const resetPage = () => setCurrentPage(1);
  useEffect(() => { resetPage(); }, [debouncedSearch, selectedCategory, debouncedMin, debouncedMax, sortBy]);

  // ── Active filter count badge ──
  const activeFilterCount = [
    selectedCategory !== "All",
    debouncedMin !== "",
    debouncedMax !== "",
  ].filter(Boolean).length;

  // ── Cart handlers (delegated to context) ──
  const showToast = (name) => {
    clearTimeout(toastTimer.current);
    setToast(name);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const handleAddToCart = (product) => {
    addItem(product);
    showToast(product.name);
  };

  const handleUpdateCartQty = (productId, delta) => updateQuantity(productId, delta);
  const handleRemoveFromCart = (productId)       => removeItem(productId);

  // ── Razorpay mock ──
  const triggerRazorpayCheckout = () => {
    if (!shippingAddress.trim() || !customerName.trim()) {
      alert("Please enter a name and delivery address.");
      return;
    }
    setCheckoutStep("payment");
    setPaymentStatus("processing");

    setTimeout(async () => {
      setPaymentStatus("success");

      const orderPayload = {
        customerName,
        shippingAddress,
        items: cart.map((item) => ({
          productId: item.id,
          name:      item.name,
          quantity:  item.quantity,
          price:     item.price,
        })),
        total:    cartTotal,
        vendorId: cart[0]?.vendorId || "v-01",
      };

      try {
        const token = localStorage.getItem("token");
        await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(orderPayload),
        });
      } catch (err) {
        console.warn("Failed to post order to backend:", err);
      }

      setTimeout(() => {
        setCheckoutStep("success");
        // Cart is cleared by CartPage / CartContext after order success
      }, 1000);
    }, 2500);
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label || "Sort";

  return (
    <div className="min-h-screen flex flex-col bg-warmwhite">
      <Navbar cartCount={cartCount} onOpenCart={() => setIsCartOpen(true)} />

      {/* ── Add-to-cart toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] bg-darkgray text-white text-xs font-semibold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-none animate-fade-in-up">
          <Check className="w-4 h-4 text-emerald-400" />
          <span className="truncate max-w-[200px]">{toast}</span>
          <span className="text-white/50">added to cart</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-10">

        {/* ── Banner ── */}
        <section className="mb-10 bg-beige rounded-2xl p-8 relative overflow-hidden border border-olive/10">
          <div className="absolute inset-0 grain opacity-20 pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-widest text-olive mb-2 block">Curated Smart Marketplace</span>
            <h1 className="font-display text-4xl font-bold text-darkgray mb-3">Conscious goods, optimized supply</h1>
            <p className="text-sm text-darkgray/70 leading-relaxed">
              Experience the future of multi-vendor shopping. Every product is cataloged, monitored by deep-learning models, and restocked dynamically by real-time intelligence.
            </p>
          </div>
        </section>

        {/* ── Toolbar: Search + Filter toggle + Sort ── */}
        <div className="flex flex-col gap-3 mb-5">

          {/* Row 1: Search + Sort + Filter toggle */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-darkgray/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products, categories..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-olive/15 bg-white text-xs text-darkgray focus:outline-none focus:ring-2 focus:ring-olive/40 transition"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-darkgray/40 hover:text-darkgray"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div className="relative shrink-0" ref={sortRef}>
              <button
                onClick={() => setSortOpen((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-olive/15 bg-white text-xs font-semibold text-darkgray hover:bg-beige/30 transition whitespace-nowrap"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-olive" />
                {sortLabel}
                <ChevronDown className={`w-3.5 h-3.5 text-darkgray/40 transition-transform ${sortOpen ? "rotate-180" : ""}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-olive/10 shadow-lg z-30 overflow-hidden">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition hover:bg-beige/40 flex items-center justify-between ${sortBy === opt.value ? "text-olive font-bold bg-beige/20" : "text-darkgray"}`}
                    >
                      {opt.label}
                      {sortBy === opt.value && <Check className="w-3.5 h-3.5 text-olive" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition shrink-0 ${showFilters || activeFilterCount > 0 ? "bg-olive text-white border-olive shadow-sm" : "bg-white border-olive/15 text-darkgray hover:bg-beige/30"}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/25 text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Row 2: Expanded filter panel */}
          {showFilters && (
            <div className="bg-white border border-olive/10 rounded-2xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-end shadow-sm">

              {/* Category pills */}
              <div className="flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-darkgray/50 mb-2.5">Category</p>
                <div className="flex flex-wrap gap-2">
                  {meta.categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold border transition ${
                        selectedCategory === cat
                          ? "bg-olive border-olive text-white shadow-sm"
                          : "bg-white border-olive/15 text-darkgray hover:bg-beige/40"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div className="shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-darkgray/50 mb-2.5">Price Range (₹)</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Min ${meta.priceRange.min}`}
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="w-28 px-3 py-2 rounded-lg border border-olive/15 text-xs text-darkgray bg-warmwhite focus:outline-none focus:ring-1 focus:ring-olive/40"
                  />
                  <span className="text-darkgray/30 text-xs font-semibold">–</span>
                  <input
                    type="number"
                    min="0"
                    placeholder={`Max ${meta.priceRange.max}`}
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    className="w-28 px-3 py-2 rounded-lg border border-olive/15 text-xs text-darkgray bg-warmwhite focus:outline-none focus:ring-1 focus:ring-olive/40"
                  />
                </div>
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedCategory("All");
                    setPriceMin("");
                    setPriceMax("");
                  }}
                  className="shrink-0 px-4 py-2 rounded-lg border border-red-200 text-red-500 text-xs font-semibold hover:bg-red-50 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}

          {/* Result count + active tag summary */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-darkgray/50">
              {loading ? "Loading…" : `${pagination.total} product${pagination.total !== 1 ? "s" : ""} found`}
            </p>
            <div className="flex gap-1.5 flex-wrap justify-end">
              {selectedCategory !== "All" && (
                <span className="px-2.5 py-1 bg-olive/10 text-olive text-[10px] font-bold rounded-lg border border-olive/15 flex items-center gap-1">
                  {selectedCategory}
                  <button onClick={() => setSelectedCategory("All")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {(debouncedMin || debouncedMax) && (
                <span className="px-2.5 py-1 bg-olive/10 text-olive text-[10px] font-bold rounded-lg border border-olive/15 flex items-center gap-1">
                  ₹{debouncedMin || "0"} – ₹{debouncedMax || "∞"}
                  <button onClick={() => { setPriceMin(""); setPriceMax(""); }}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Product Grid ── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: PAGE_LIMIT }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-olive/10 overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-beige/60" />
                <div className="p-5 space-y-3">
                  <div className="h-3 bg-beige/80 rounded w-1/3" />
                  <div className="h-4 bg-beige/80 rounded w-3/4" />
                  <div className="h-3 bg-beige/60 rounded w-full" />
                  <div className="h-3 bg-beige/60 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="w-full text-center py-24 bg-white rounded-2xl border border-olive/10">
            <Search className="w-10 h-10 text-darkgray/20 mx-auto mb-4" />
            <p className="text-sm font-semibold text-darkgray/50 mb-2">No products found</p>
            <p className="text-xs text-darkgray/35">Try adjusting your search or filter parameters.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => {
              const inCart   = cart.find((i) => i.id === p.id);
              const inCartQty = inCart?.quantity || 0;

              return (
                <div
                  key={p.id}
                  className="group bg-white rounded-2xl border border-olive/10 overflow-hidden shadow-sm hover:shadow-md transition duration-200 cursor-pointer"
                  onClick={() => setSelectedProduct(p)}
                >
                  <div className="aspect-[4/3] bg-beige relative overflow-hidden">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    {p.stock <= p.reorderThreshold && (
                      <span className="absolute top-3 right-3 px-2 py-1 bg-[#E8A598]/90 backdrop-blur-sm text-white font-bold text-[9px] uppercase tracking-wider rounded-lg">
                        Low Stock
                      </span>
                    )}
                    {inCartQty > 0 && (
                      <span className="absolute top-3 left-3 px-2 py-1 bg-olive/90 backdrop-blur-sm text-white font-bold text-[9px] rounded-lg flex items-center gap-1">
                        <ShoppingCart className="w-2.5 h-2.5" />
                        {inCartQty} in cart
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-[9px] font-bold text-olive uppercase tracking-widest block mb-0.5">{p.category}</span>
                        <h3 className="font-display font-semibold text-darkgray text-base line-clamp-1 group-hover:text-olive transition">{p.name}</h3>
                      </div>
                      <span className="text-sm font-bold text-darkgray">₹{p.price.toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-xs text-darkgray/60 line-clamp-2 mb-4 leading-relaxed">{p.description}</p>

                    <div className="flex justify-between items-center pt-2 border-t border-olive/5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-olive stroke-olive" />
                        <span className="text-xs font-bold text-darkgray">{p.ratings}</span>
                        <span className="text-[10px] text-darkgray/40">({p.reviews?.length || 0})</span>
                      </div>

                      {/* Inline stepper if already in cart; otherwise "Add to Cart" */}
                      {inCartQty > 0 ? (
                        <div className="flex items-center border border-olive/20 rounded-lg overflow-hidden bg-white">
                          <button
                            onClick={() => handleUpdateCartQty(p.id, -1)}
                            className="px-2 py-1.5 text-xs hover:bg-beige font-bold text-darkgray"
                          >−</button>
                          <span className="px-2.5 text-xs font-bold text-darkgray">{inCartQty}</span>
                          <button
                            onClick={() => handleUpdateCartQty(p.id, 1)}
                            disabled={inCartQty >= p.stock}
                            className="px-2 py-1.5 text-xs hover:bg-beige font-bold text-darkgray disabled:opacity-40"
                          >+</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(p)}
                          disabled={p.stock <= 0}
                          className="px-3.5 py-2 rounded-lg bg-olive hover:bg-olive-600 text-white font-bold text-xs shadow-sm disabled:bg-darkgray/20 transition"
                        >
                          {p.stock <= 0 ? "Out of Stock" : "Add to Cart"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-olive/15 text-xs font-semibold text-darkgray hover:bg-beige/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            {Array.from({ length: pagination.totalPages }).map((_, i) => {
              const page = i + 1;
              const isActive = page === pagination.page;
              const nearCurrent = Math.abs(page - pagination.page) <= 1;
              if (!isActive && !nearCurrent && page !== 1 && page !== pagination.totalPages) {
                if (page === 2 || page === pagination.totalPages - 1) {
                  return <span key={page} className="text-darkgray/30 text-xs px-1">…</span>;
                }
                return null;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl border text-xs font-bold transition ${
                    isActive
                      ? "bg-olive border-olive text-white shadow-sm"
                      : "bg-white border-olive/15 text-darkgray hover:bg-beige/40"
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={!pagination.hasNext}
              className="flex items-center gap-1 px-3.5 py-2 rounded-xl border border-olive/15 text-xs font-semibold text-darkgray hover:bg-beige/40 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {!loading && pagination.total > 0 && (
          <p className="text-center text-[11px] text-darkgray/40 mt-3">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total products
          </p>
        )}

      </main>

      {/* ── PRODUCT DETAIL MODAL ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-darkgray/40 backdrop-blur-sm p-4 anim-fade-in">
          <div className="bg-white max-w-2xl w-full rounded-2xl overflow-hidden shadow-xl border border-olive/10 relative flex flex-col md:flex-row max-h-[90vh]">
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-10 p-1.5 bg-white/80 backdrop-blur-sm text-darkgray/70 hover:text-darkgray rounded-full shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="md:w-1/2 aspect-video md:aspect-auto bg-beige">
              <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
            </div>
            <div className="md:w-1/2 p-6 overflow-y-auto flex flex-col">
              <span className="text-[10px] font-bold text-olive uppercase tracking-widest mb-1">{selectedProduct.category}</span>
              <h2 className="font-display font-bold text-darkgray text-xl mb-2">{selectedProduct.name}</h2>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg font-bold text-darkgray">₹{selectedProduct.price.toLocaleString("en-IN")}</span>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-beige border border-olive/15 text-olive font-medium">
                  In stock: {selectedProduct.stock} units
                </span>
              </div>
              <p className="text-xs text-darkgray/70 leading-relaxed mb-6">{selectedProduct.description}</p>

              <div className="mb-6 pt-4 border-t border-olive/5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-darkgray/80 mb-3">Customer Reviews</h4>
                {selectedProduct.reviews?.length === 0 ? (
                  <p className="text-[11px] text-darkgray/40 italic">No reviews yet for this product.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedProduct.reviews?.map((r) => (
                      <div key={r.id} className="text-xs bg-beige/20 p-2.5 rounded-xl border border-olive/5">
                        <div className="flex justify-between mb-1">
                          <span className="font-bold text-darkgray">{r.user}</span>
                          <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-2.5 h-2.5 ${i < r.rating ? "fill-olive stroke-olive" : "stroke-darkgray/20 fill-none"}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-darkgray/70 text-[11px] leading-relaxed">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => { handleAddToCart(selectedProduct); setSelectedProduct(null); }}
                disabled={selectedProduct.stock <= 0}
                className="w-full mt-auto py-3 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow transition disabled:bg-darkgray/20"
              >
                {selectedProduct.stock <= 0 ? "Out of Stock" : `Add to Cart — ₹${selectedProduct.price.toLocaleString("en-IN")}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHOPPING CART DRAWER ── */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-darkgray/40 backdrop-blur-xs anim-fade-in">
          <div className="absolute inset-0" onClick={() => setIsCartOpen(false)} />

          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-olive/10">
            <div className="p-6 border-b border-olive/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-olive" />
                <h2 className="font-display text-lg font-bold text-darkgray">Your Cart</h2>
                {cartCount > 0 && (
                  <span className="px-2 py-0.5 bg-olive text-white text-[10px] font-bold rounded-full">
                    {cartCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* View full cart page link */}
                {cart.length > 0 && checkoutStep === "idle" && (
                  <button
                    onClick={() => { setIsCartOpen(false); navigate("/cart"); }}
                    className="text-xs text-olive font-semibold hover:underline"
                  >
                    View Cart Page
                  </button>
                )}
                <button onClick={() => { setIsCartOpen(false); setCheckoutStep("idle"); }} className="p-1.5 hover:bg-beige/40 rounded-full transition">
                  <X className="w-4 h-4 text-darkgray/60" />
                </button>
              </div>
            </div>

            {checkoutStep === "idle" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ShoppingBag className="w-10 h-10 text-darkgray/25 mb-4" />
                    <p className="text-sm font-semibold text-darkgray/55">Your cart is empty</p>
                    <p className="text-xs text-darkgray/40 mt-1">Add items from the marketplace to check out.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex gap-4 p-3 bg-beige/25 rounded-xl border border-olive/5">
                      <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover bg-beige" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-darkgray truncate">{item.name}</h4>
                        <p className="text-xs text-darkgray/50 mb-2">₹{item.price.toLocaleString("en-IN")}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center border border-olive/15 rounded-lg overflow-hidden bg-white">
                            <button onClick={() => handleUpdateCartQty(item.id, -1)} className="px-2 py-1 text-xs hover:bg-beige">-</button>
                            <span className="px-2.5 text-xs font-bold text-darkgray">{item.quantity}</span>
                            <button onClick={() => handleUpdateCartQty(item.id, 1)} className="px-2 py-1 text-xs hover:bg-beige">+</button>
                          </div>
                          <button onClick={() => handleRemoveFromCart(item.id)} className="text-xs text-red-500 font-medium hover:underline">
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {checkoutStep === "details" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <h3 className="font-display font-bold text-darkgray text-lg mb-2">Delivery Details</h3>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-2">Recipient Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-olive/20 text-xs focus:outline-none focus:ring-1 focus:ring-olive bg-warmwhite/40"
                    placeholder="Enter name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-darkgray/60 mb-2">Shipping Address</label>
                  <textarea
                    required
                    rows={4}
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-olive/20 text-xs focus:outline-none focus:ring-1 focus:ring-olive bg-warmwhite/40 resize-none"
                    placeholder="Provide full shipping address details..."
                  />
                </div>
              </div>
            )}

            {checkoutStep === "payment" && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                {paymentStatus === "processing" ? (
                  <div className="space-y-6">
                    <div className="bg-darkgray text-white p-6 rounded-2xl max-w-xs mx-auto shadow-xl border border-white/10 relative">
                      <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">R</span>
                          <span className="text-[11px] font-bold tracking-wider">Razorpay Checkout</span>
                        </div>
                        <span className="text-[10px] text-white/50">SmartMarketAI</span>
                      </div>
                      <div className="space-y-3 mb-6">
                        <p className="text-[11px] text-white/60">Amount Payable</p>
                        <p className="text-2xl font-bold font-display text-emerald-400">₹{(cartTotal + 99).toLocaleString("en-IN")}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl text-left border border-white/5 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-white/60 shrink-0" />
                        <div className="leading-tight">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-white/50">Processing Card</p>
                          <p className="text-[10px] font-medium text-white/80">•••• •••• •••• 5849</p>
                        </div>
                      </div>
                      <div className="mt-6 flex items-center justify-center gap-2 text-xs font-semibold text-white/80">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Connecting to bank gateway...
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                      <Check className="w-6 h-6" />
                    </div>
                    <h4 className="font-display font-semibold text-lg text-darkgray">Payment Successful</h4>
                    <p className="text-xs text-darkgray/55">Updating your supply chain records...</p>
                  </div>
                )}
              </div>
            )}

            {checkoutStep === "success" && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-olive/12 flex items-center justify-center mx-auto text-olive mb-4">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h3 className="font-display font-bold text-xl text-darkgray">Order Confirmed!</h3>
                <p className="text-xs text-darkgray/60 mt-2 max-w-xs mx-auto leading-relaxed">
                  Your purchase was logged on the blockchain ledger. Product demand has been indexed for the next vendor restock cycle.
                </p>
                <button
                  onClick={() => { setIsCartOpen(false); setCheckoutStep("idle"); }}
                  className="mt-8 px-6 py-2.5 rounded-xl bg-olive text-white font-bold text-xs shadow hover:bg-olive-600 transition"
                >
                  Continue Shopping
                </button>
              </div>
            )}

            {cart.length > 0 && checkoutStep !== "payment" && checkoutStep !== "success" && (
              <div className="p-6 bg-beige/30 border-t border-olive/10 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-darkgray/65">
                    <span>Subtotal</span>
                    <span className="font-semibold text-darkgray">₹{cartTotal.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-xs text-darkgray/65">
                    <span>Shipping fee</span>
                    <span className="font-semibold text-darkgray">₹99</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-darkgray pt-2 border-t border-olive/5">
                    <span>Total</span>
                    <span>₹{(cartTotal + 99).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {checkoutStep === "idle" && (
                  <button
                    onClick={() => setCheckoutStep("details")}
                    className="w-full py-3 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    Proceed to Checkout
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

                {checkoutStep === "details" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCheckoutStep("idle")}
                      className="flex-1 py-3 border border-olive/20 text-darkgray hover:bg-beige/40 font-bold text-xs rounded-xl transition"
                    >
                      Back to Cart
                    </button>
                    <button
                      onClick={triggerRazorpayCheckout}
                      className="flex-1 py-3 bg-olive hover:bg-olive-600 text-white font-bold text-xs rounded-xl shadow-md transition"
                    >
                      Pay via Razorpay
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}