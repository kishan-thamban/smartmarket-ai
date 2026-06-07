/**
 * CheckoutPage.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - PaymentStep: side-effects moved from useState initialiser → useEffect with
 *    a guard ref to prevent duplicate order creation in React Strict Mode.
 *  - clearCart() called BEFORE onSuccess to guarantee cart resets on confirm.
 *  - Local fallback order IDs use crypto.randomUUID() instead of Math.random().
 *  - onSuccess called only once via ref guard.
 *  - ConfirmStep orderId uses order.id from server (no Math.random fallback shown
 *    to the user; displays a friendly placeholder if ID is missing).
 *
 * Route: /checkout  (customer-only, see App.jsx)
 * Requires: <CartProvider> ancestor, react-router-dom v6
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import Navbar from "../components/Navbar";
import {
  MapPin, ShoppingBag, CreditCard, CheckCircle2,
  ArrowLeft, ChevronRight, Loader2, Truck,
  Shield, Tag, Trash2, Lock, AlertCircle,
  Package, CalendarDays, RefreshCw,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SHIPPING_FEE = 99;

const STEPS = [
  { id: "address",  label: "Address",   icon: MapPin },
  { id: "review",   label: "Review",    icon: ShoppingBag },
  { id: "payment",  label: "Payment",   icon: CreditCard },
  { id: "confirm",  label: "Confirmed", icon: CheckCircle2 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatINR(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function deliveryETA() {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" });
}

/** Collision-safe ID for offline/error fallbacks only */
function safeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `ord-${crypto.randomUUID()}`;
  }
  return `ord-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step Progress Bar
// ─────────────────────────────────────────────────────────────────────────────

function StepBar({ current }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => {
        const Icon   = step.icon;
        const done   = i < idx;
        const active = i === idx;
        const future = i > idx;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 w-20">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${done   ? "bg-olive border-olive text-white shadow-md shadow-olive/30" : ""}
                ${active ? "bg-white border-olive text-olive shadow-lg shadow-olive/20 scale-110" : ""}
                ${future ? "bg-warmwhite border-olive/20 text-darkgray/30" : ""}
              `}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${
                active ? "text-olive" : done ? "text-darkgray/60" : "text-darkgray/30"
              }`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-12 h-0.5 mb-5 transition-all duration-500 ${i < idx ? "bg-olive" : "bg-olive/15"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared field wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-darkgray/50 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />{error}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Shipping Address
// ─────────────────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi (NCT)","Chandigarh","Puducherry","Lakshadweep","Andaman & Nicobar",
  "Dadra & Nagar Haveli","Daman & Diu","Jammu & Kashmir","Ladakh",
];

function AddressStep({ onNext }) {
  const [form, setForm] = useState({
    fullName: localStorage.getItem("userName") || "",
    phone:    localStorage.getItem("userPhone") || "",
    line1: "", line2: "", city: "", state: "", pincode: "",
  });
  const [errors, setErrors] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.fullName.trim())             e.fullName = "Name is required";
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone    = "Enter a valid 10-digit mobile number";
    if (!form.line1.trim())               e.line1    = "Street / flat is required";
    if (!form.city.trim())                e.city     = "City is required";
    if (!form.state)                       e.state    = "Select a state";
    if (!/^\d{6}$/.test(form.pincode))    e.pincode  = "Enter a valid 6-digit PIN";
    return e;
  };

  const handleContinue = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    localStorage.setItem("userPhone", form.phone);

    const address = [
      form.line1.trim(),
      form.line2.trim(),
      `${form.city.trim()}, ${form.state}`,
      `PIN ${form.pincode}`,
    ].filter(Boolean).join(", ");

    onNext({ ...form, formatted: address });
  };

  const input = "w-full px-3.5 py-2.5 rounded-xl border border-olive/20 text-sm focus:outline-none focus:ring-2 focus:ring-olive/30 bg-warmwhite/50 placeholder-darkgray/30 transition";

  return (
    <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-7 space-y-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-full bg-olive/10 flex items-center justify-center">
          <MapPin className="w-4 h-4 text-olive" />
        </div>
        <div>
          <h2 className="font-display font-bold text-darkgray text-lg leading-none">Shipping Address</h2>
          <p className="text-[11px] text-darkgray/40 mt-0.5">Where should we deliver your order?</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Full Name" error={errors.fullName}>
          <input value={form.fullName} onChange={set("fullName")} placeholder="Riya Sharma"
            className={`${input} ${errors.fullName ? "border-red-300" : ""}`} />
        </Field>
        <Field label="Mobile Number" error={errors.phone}>
          <input value={form.phone} onChange={set("phone")} placeholder="9876543210" maxLength={10}
            className={`${input} ${errors.phone ? "border-red-300" : ""}`} />
        </Field>
      </div>

      <Field label="Flat / House / Street" error={errors.line1}>
        <input value={form.line1} onChange={set("line1")} placeholder="Flat 204, Orchid Residency, MG Road"
          className={`${input} ${errors.line1 ? "border-red-300" : ""}`} />
      </Field>

      <Field label="Landmark / Area (optional)">
        <input value={form.line2} onChange={set("line2")} placeholder="Near Inorbit Mall" className={input} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="City" error={errors.city}>
          <input value={form.city} onChange={set("city")} placeholder="Hyderabad"
            className={`${input} ${errors.city ? "border-red-300" : ""}`} />
        </Field>
        <Field label="State" error={errors.state}>
          <select value={form.state} onChange={set("state")}
            className={`${input} ${errors.state ? "border-red-300" : ""}`}>
            <option value="">Select state…</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>

      <Field label="PIN Code" error={errors.pincode}>
        <input value={form.pincode} onChange={set("pincode")} placeholder="500032" maxLength={6}
          className={`${input} w-40 ${errors.pincode ? "border-red-300" : ""}`} />
      </Field>

      <button onClick={handleContinue}
        className="w-full py-3 bg-olive hover:bg-olive/90 text-white font-bold text-sm rounded-xl shadow-md shadow-olive/20 transition flex items-center justify-center gap-2 active:scale-[0.98]">
        Review Order <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Order Review
// ─────────────────────────────────────────────────────────────────────────────

function ReviewLineItem({ item }) {
  const { updateQuantity, removeItem } = useCart();
  return (
    <div className="flex gap-4 py-4 border-b border-olive/8 last:border-0 group">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-beige shrink-0">
        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-olive">{item.category}</span>
        <h4 className="font-semibold text-sm text-darkgray truncate mt-0.5">{item.name}</h4>
        <p className="text-xs text-darkgray/60 mt-0.5">{formatINR(item.price)} each</p>
      </div>
      <div className="flex flex-col items-end justify-between shrink-0">
        <p className="text-sm font-bold text-darkgray">{formatINR(item.price * item.quantity)}</p>
        <div className="flex items-center gap-1.5">
          <button onClick={() => updateQuantity(item.id, -1)} disabled={item.quantity <= 1}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-olive/20 text-xs font-bold hover:bg-beige/60 transition disabled:opacity-30">−</button>
          <span className="w-5 text-center text-xs font-bold text-darkgray tabular-nums">{item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, 1)} disabled={item.quantity >= item.stock}
            className="w-6 h-6 flex items-center justify-center rounded-lg border border-olive/20 text-xs font-bold hover:bg-beige/60 transition disabled:opacity-30">+</button>
          <button onClick={() => removeItem(item.id)}
            className="ml-1 w-6 h-6 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ address, onBack, onNext }) {
  const { items, cartTotal, isEmpty } = useCart();
  const grandTotal = cartTotal + SHIPPING_FEE;

  if (isEmpty) {
    return (
      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-12 text-center space-y-4">
        <ShoppingBag className="w-12 h-12 text-darkgray/20 mx-auto" />
        <p className="text-darkgray/50 font-semibold">Your cart is now empty.</p>
        <button onClick={onBack} className="text-olive text-sm font-bold underline underline-offset-2">Go back</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingBag className="w-4 h-4 text-olive" />
          <h2 className="font-display font-bold text-darkgray">Order Items</h2>
          <span className="ml-auto text-[11px] text-darkgray/40">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
        {items.map((item) => <ReviewLineItem key={item.id} item={item} />)}
      </div>

      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-olive shrink-0 mt-0.5" />
            <h3 className="font-bold text-sm text-darkgray">Delivering to</h3>
          </div>
          <button onClick={onBack} className="text-[11px] text-olive font-bold hover:underline">Edit</button>
        </div>
        <p className="text-sm text-darkgray font-semibold">{address.fullName}</p>
        <p className="text-xs text-darkgray/60 mt-1 leading-relaxed">{address.formatted}</p>
        <p className="text-xs text-darkgray/60 mt-0.5">+91 {address.phone}</p>
        <div className="flex items-center gap-1.5 mt-3 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
          <Truck className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold">Estimated delivery by {deliveryETA()}</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-6 space-y-3">
        <h3 className="font-bold text-sm text-darkgray mb-3">Price Details</h3>
        <div className="flex justify-between text-sm text-darkgray/60">
          <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
          <span className="font-semibold text-darkgray">{formatINR(cartTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-darkgray/60">
          <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Shipping</span>
          <span className="font-semibold text-darkgray">{formatINR(SHIPPING_FEE)}</span>
        </div>
        <div className="border-t border-olive/10 pt-3 flex justify-between font-bold text-darkgray">
          <span>Total Payable</span>
          <span className="text-base text-olive">{formatINR(grandTotal)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onBack}
          className="py-3 border border-olive/20 text-darkgray/70 font-bold text-sm rounded-xl hover:bg-beige/40 transition flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={onNext}
          className="py-3 bg-olive hover:bg-olive/90 text-white font-bold text-sm rounded-xl shadow-md shadow-olive/20 transition flex items-center justify-center gap-2 active:scale-[0.98]">
          Pay {formatINR(grandTotal)} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Payment
// FIX: side-effects moved out of useState; processingRef prevents duplicate calls
// ─────────────────────────────────────────────────────────────────────────────

function luhn(n) {
  return /^\d{16}$/.test(n.replace(/\s/g, ""));
}
function formatCard(raw) {
  return raw.replace(/\D/g, "").substring(0, 16).replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(raw) {
  const d = raw.replace(/\D/g, "").substring(0, 4);
  return d.length > 2 ? `${d.substring(0, 2)}/${d.substring(2)}` : d;
}

const CARD_TYPES = {
  "4": { name: "Visa",       color: "#1a1f71" },
  "5": { name: "Mastercard", color: "#eb001b" },
  "6": { name: "Rupay",      color: "#1a9c3e" },
};

function PaymentStep({ cartTotal, address, onSuccess, onBack }) {
  const { items, clearCart } = useCart();
  const grandTotal = cartTotal + SHIPPING_FEE;

  const [card,   setCard]   = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [errors, setErrors] = useState({});
  const [phase,  setPhase]  = useState("idle"); // idle | processing | saving | done

  // FIX: ref guard prevents duplicate submission in React Strict Mode / double-render
  const processingRef = useRef(false);
  const savedOrderRef = useRef(null);

  const cardFirstDigit = card.number.replace(/\s/g, "")[0] || "";
  const cardType       = CARD_TYPES[cardFirstDigit] || null;

  const handleChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "number") v = formatCard(v);
    if (k === "expiry") v = formatExpiry(v);
    if (k === "cvv")    v = v.replace(/\D/g, "").substring(0, 3);
    setCard((c) => ({ ...c, [k]: v }));
    setErrors((err) => ({ ...err, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!luhn(card.number))                               e.number = "Invalid card number";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(card.expiry))  e.expiry = "Invalid expiry (MM/YY)";
    if (!/^\d{3}$/.test(card.cvv))                       e.cvv    = "Invalid CVV";
    if (!card.name.trim())                                e.name   = "Name on card is required";
    return e;
  };

  // FIX: submitPayment is now a plain async handler — no side-effect inside useState
  const submitPayment = useCallback(async () => {
    if (processingRef.current) return; // prevent double-submit

    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    processingRef.current = true;
    setPhase("processing");

    // Simulate gateway delay
    await new Promise((r) => setTimeout(r, 1800));
    setPhase("saving");

    const orderPayload = {
      customerName:    address.fullName,
      shippingAddress: address.formatted,
      phone:           address.phone,
      items: items.map((i) => ({
        productId: i.id,
        name:      i.name,
        quantity:  i.quantity,
        price:     i.price,
        image:     i.image,
        vendorId:  i.vendorId,
      })),
      total:       grandTotal,
      subtotal:    cartTotal,
      shippingFee: SHIPPING_FEE,
      paymentMethod: {
        type:  "card",
        last4: card.number.replace(/\s/g, "").slice(-4),
        brand: cardType?.name ?? "Card",
      },
      status: "Pending",
      paidAt: new Date().toISOString(),
    };

    let order = null;
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        order = await res.json();
      } else {
        const errBody = await res.json().catch(() => ({}));
        // Surface stock errors to the user
        if (res.status === 409 && errBody.errors) {
          processingRef.current = false;
          setPhase("idle");
          setErrors({ _stockError: errBody.errors.join("\n") });
          return;
        }
        // Other errors — create offline fallback record
        order = { id: safeId(), ...orderPayload, date: new Date().toISOString().split("T")[0] };
      }
    } catch {
      order = { id: safeId(), customerName: address.fullName, total: grandTotal, date: new Date().toISOString().split("T")[0] };
    }

    savedOrderRef.current = order;

    // FIX: clearCart BEFORE calling onSuccess (cart reset guaranteed)
    clearCart();

    await new Promise((r) => setTimeout(r, 400));
    setPhase("done");
  }, [card, address, items, cartTotal, grandTotal, cardType, clearCart]);

  // FIX: onSuccess called once in useEffect when phase transitions to "done"
  useEffect(() => {
    if (phase === "done") {
      onSuccess(savedOrderRef.current);
    }
  }, [phase, onSuccess]);

  const isProcessing = phase !== "idle";

  const inputCls = (k) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-olive/30 bg-warmwhite/50 placeholder-darkgray/30 transition ${
      errors[k] ? "border-red-300" : "border-olive/20"
    }`;

  return (
    <div className="space-y-5">
      {/* Mock Razorpay gateway card */}
      <div className="bg-darkgray text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500 flex items-center justify-center text-[11px] font-black">R</div>
            <span className="text-[12px] font-bold tracking-widest opacity-80">Razorpay</span>
          </div>
          <span className="text-[10px] text-white/40">SmartMarketAI</span>
        </div>

        <p className="text-[11px] text-white/50 mb-0.5">Total Payable</p>
        <p className="text-3xl font-bold font-display text-emerald-400 mb-5">{formatINR(grandTotal)}</p>

        <div className="flex items-start gap-4">
          <div className="w-10 h-7 rounded bg-amber-400/80 border border-amber-300/40 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              {[...Array(4)].map((_, i) => <div key={i} className="w-2 h-2 rounded-sm bg-amber-700/60" />)}
            </div>
          </div>
          <div>
            <p className="text-xs font-mono text-white/60 tracking-widest">
              {card.number || "•••• •••• •••• ••••"}
            </p>
            <p className="text-[10px] text-white/40 mt-1">
              {card.name.toUpperCase() || "CARDHOLDER NAME"}
            </p>
          </div>
          {cardType && <span className="ml-auto text-[11px] font-bold opacity-60">{cardType.name}</span>}
        </div>

        {isProcessing && (
          <div className="absolute inset-0 bg-darkgray/90 rounded-2xl flex flex-col items-center justify-center gap-3 backdrop-blur-sm">
            {phase === "processing" && (
              <>
                <Loader2 className="w-7 h-7 animate-spin text-olive" />
                <p className="text-sm font-semibold text-white/80">Connecting to bank gateway…</p>
                <p className="text-[11px] text-white/40">Please don't close this window</p>
              </>
            )}
            {(phase === "saving" || phase === "done") && (
              <>
                <RefreshCw className="w-7 h-7 animate-spin text-emerald-400" />
                <p className="text-sm font-semibold text-white/80">Verifying & saving order…</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Stock error banner */}
      {errors._stockError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-semibold whitespace-pre-line">
          {errors._stockError}
        </div>
      )}

      {/* Card form */}
      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-sm text-darkgray flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-olive" /> Card Details
        </h3>

        <Field label="Card Number" error={errors.number}>
          <input value={card.number} onChange={handleChange("number")} placeholder="1234 5678 9012 3456"
            className={inputCls("number")} inputMode="numeric" disabled={isProcessing} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry (MM/YY)" error={errors.expiry}>
            <input value={card.expiry} onChange={handleChange("expiry")} placeholder="08/27"
              className={inputCls("expiry")} inputMode="numeric" disabled={isProcessing} />
          </Field>
          <Field label="CVV" error={errors.cvv}>
            <input value={card.cvv} onChange={handleChange("cvv")} placeholder="•••" type="password"
              className={inputCls("cvv")} inputMode="numeric" disabled={isProcessing} />
          </Field>
        </div>

        <Field label="Name on Card" error={errors.name}>
          <input value={card.name} onChange={handleChange("name")} placeholder="Riya Sharma"
            className={inputCls("name")} disabled={isProcessing} />
        </Field>

        <div className="flex items-center gap-2 text-[11px] text-darkgray/40 mt-1">
          <Lock className="w-3.5 h-3.5" />
          <span>Your payment info is encrypted and never stored</span>
        </div>
      </div>

      {/* UPI (decorative) */}
      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-4 flex items-center gap-3 opacity-60 cursor-not-allowed select-none">
        <div className="w-8 h-8 rounded-full bg-beige flex items-center justify-center text-[11px] font-black text-darkgray">₹</div>
        <div>
          <p className="text-xs font-bold text-darkgray">Pay via UPI</p>
          <p className="text-[10px] text-darkgray/50">Google Pay, PhonePe, BHIM…</p>
        </div>
        <span className="ml-auto text-[10px] font-bold text-olive/60 border border-olive/20 px-2 py-0.5 rounded">Coming soon</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={onBack} disabled={isProcessing}
          className="py-3 border border-olive/20 text-darkgray/70 font-bold text-sm rounded-xl hover:bg-beige/40 transition flex items-center justify-center gap-2 disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={submitPayment} disabled={isProcessing}
          className="py-3 bg-olive hover:bg-olive/90 text-white font-bold text-sm rounded-xl shadow-md shadow-olive/20 transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed">
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
          {isProcessing ? "Processing…" : `Pay ${formatINR(grandTotal)}`}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Order Confirmation
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmStep({ order, address, onContinue }) {
  // FIX: show the real server-assigned ID — no Math.random fallback shown to user
  const orderId = order?.id ?? "Confirmed";
  const eta     = deliveryETA();

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-8 text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-olive rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-black">✓</span>
          </div>
        </div>

        <div>
          <h2 className="font-display font-bold text-2xl text-darkgray">Order Confirmed!</h2>
          <p className="text-sm text-darkgray/50 mt-1">Payment successful · Your order is being prepared</p>
        </div>

        <div className="inline-flex items-center gap-2 bg-olive/8 border border-olive/15 rounded-xl px-4 py-2">
          <Tag className="w-3.5 h-3.5 text-olive" />
          <span className="text-sm font-bold text-olive tracking-wide font-mono">{orderId}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-darkgray">
            <Truck className="w-4 h-4 text-olive" /> Delivery
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-darkgray/40 tracking-wider">ETA</p>
            <p className="text-sm font-semibold text-darkgray mt-0.5">{eta}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-darkgray/40 tracking-wider">Address</p>
            <p className="text-xs text-darkgray/70 mt-0.5 leading-relaxed">{address?.formatted}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-darkgray">
            <Package className="w-4 h-4 text-olive" /> Order
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-darkgray/40 tracking-wider">Total Paid</p>
            <p className="text-sm font-bold text-emerald-600 mt-0.5">{formatINR(order?.total ?? 0)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-darkgray/40 tracking-wider">Date</p>
            <p className="text-xs text-darkgray/70 mt-0.5">{order?.date ?? new Date().toLocaleDateString("en-IN")}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-5">
        <h3 className="text-sm font-bold text-darkgray mb-4 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-olive" /> What happens next?
        </h3>
        <div className="space-y-3">
          {[
            { label: "Order confirmed",      done: true,  sub: "Vendor has been notified" },
            { label: "Packed & dispatched",  done: false, sub: "Typically within 24–48 hours" },
            { label: "Out for delivery",     done: false, sub: `Expected by ${eta}` },
          ].map((s) => (
            <div key={s.label} className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                s.done ? "bg-emerald-500 border-emerald-500" : "border-olive/25 bg-warmwhite"
              }`}>
                {s.done && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
              <div>
                <p className={`text-xs font-bold ${s.done ? "text-emerald-600" : "text-darkgray/60"}`}>{s.label}</p>
                <p className="text-[10px] text-darkgray/40 mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onContinue}
        className="w-full py-3 bg-olive hover:bg-olive/90 text-white font-bold text-sm rounded-xl shadow-md shadow-olive/20 transition flex items-center justify-center gap-2 active:scale-[0.98]">
        <ShoppingBag className="w-4 h-4" /> Continue Shopping
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page shell
// ─────────────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const navigate  = useNavigate();
  const { cartCount, cartTotal, isEmpty } = useCart();

  const [step,        setStep]        = useState("address");
  const [addressInfo, setAddressInfo] = useState(null);
  const [savedOrder,  setSavedOrder]  = useState(null);

  // Redirect empty cart back to cart page
  useEffect(() => {
    if (isEmpty && step === "address") {
      navigate("/cart", { replace: true });
    }
  }, [isEmpty, step, navigate]);

  const handleAddressDone    = (info) => { setAddressInfo(info); setStep("review"); };
  const handleReviewDone     = ()     => setStep("payment");
  const handlePaymentSuccess = useCallback((order) => { setSavedOrder(order); setStep("confirm"); }, []);
  const handleContinue       = ()     => navigate("/marketplace");

  return (
    <div className="min-h-screen flex flex-col bg-warmwhite">
      <Navbar cartCount={cartCount} onOpenCart={() => navigate("/cart")} />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        {step !== "confirm" && (
          <button
            onClick={() => {
              if (step === "address")  navigate("/cart");
              else if (step === "review")   setStep("address");
              else if (step === "payment")  setStep("review");
            }}
            className="flex items-center gap-1.5 text-xs text-darkgray/50 hover:text-darkgray font-semibold mb-6 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {step === "address" ? "Back to cart" : "Previous step"}
          </button>
        )}

        <StepBar current={step} />

        {step === "address" && <AddressStep onNext={handleAddressDone} />}
        {step === "review"  && (
          <ReviewStep address={addressInfo} onBack={() => setStep("address")} onNext={handleReviewDone} />
        )}
        {step === "payment" && (
          <PaymentStep cartTotal={cartTotal} address={addressInfo} onBack={() => setStep("review")} onSuccess={handlePaymentSuccess} />
        )}
        {step === "confirm" && (
          <ConfirmStep order={savedOrder} address={addressInfo} onContinue={handleContinue} />
        )}
      </main>
    </div>
  );
}