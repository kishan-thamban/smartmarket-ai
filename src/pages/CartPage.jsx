/**
 * CartPage.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - Removed inline DeliveryForm / PaymentStep / SuccessStep (now in CheckoutPage.jsx).
 *  - "Proceed to Checkout" navigates to /checkout (the dedicated page).
 *  - clearCart() is handled inside CheckoutPage after successful payment — no
 *    duplicate calls from here.
 *  - No step state needed; this page is purely the cart items view.
 */

import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import Navbar from "../components/Navbar";
import {
  ShoppingBag, Trash2, ChevronRight, ArrowLeft,
  RefreshCw,
} from "lucide-react";

// ── Qty stepper button ────────────────────────────────────────────────────────

function QtyButton({ onClick, children, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-olive/20 text-sm font-bold text-darkgray hover:bg-beige/60 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

// ── Cart line item ────────────────────────────────────────────────────────────

function CartLineItem({ item }) {
  const { updateQuantity, removeItem } = useCart();

  return (
    <div className="flex gap-4 p-4 bg-white rounded-2xl border border-olive/10 shadow-sm hover:shadow-md transition group">
      <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-beige">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-widest text-olive block mb-0.5">
          {item.category}
        </span>
        <h3 className="font-display font-semibold text-darkgray text-sm truncate mb-1">{item.name}</h3>
        <p className="text-xs font-bold text-darkgray">₹{item.price.toLocaleString("en-IN")}</p>
      </div>

      <div className="flex flex-col items-end justify-between shrink-0 gap-2">
        <div className="flex items-center gap-2">
          <QtyButton
            onClick={() => updateQuantity(item.id, -1)}
            disabled={item.quantity <= 1}
          >−</QtyButton>
          <span className="w-8 text-center text-sm font-bold text-darkgray tabular-nums">
            {item.quantity}
          </span>
          <QtyButton
            onClick={() => updateQuantity(item.id, 1)}
            disabled={item.quantity >= item.stock}
          >+</QtyButton>
        </div>

        <p className="text-sm font-bold text-darkgray">
          ₹{(item.price * item.quantity).toLocaleString("en-IN")}
        </p>

        <button
          onClick={() => removeItem(item.id)}
          className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 font-semibold transition"
        >
          <Trash2 className="w-3 h-3" />
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Order summary sidebar ─────────────────────────────────────────────────────

function OrderSummary({ cartTotal, onCheckout }) {
  const shipping  = cartTotal > 0 ? 99 : 0;
  const grandTotal = cartTotal + shipping;

  return (
    <div className="bg-white rounded-2xl border border-olive/10 shadow-sm p-6 space-y-4 sticky top-24">
      <h2 className="font-display font-bold text-darkgray text-lg">Order Summary</h2>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-darkgray/70">
          <span>Subtotal</span>
          <span className="font-semibold text-darkgray">₹{cartTotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-darkgray/70">
          <span>Shipping fee</span>
          <span className="font-semibold text-darkgray">{cartTotal > 0 ? "₹99" : "—"}</span>
        </div>
        <div className="border-t border-olive/10 pt-2.5 flex justify-between font-bold text-darkgray">
          <span>Total</span>
          <span className="text-base">₹{grandTotal.toLocaleString("en-IN")}</span>
        </div>
      </div>

      <button
        onClick={onCheckout}
        disabled={cartTotal === 0}
        className="w-full py-3 bg-olive hover:bg-olive-600 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        Proceed to Checkout
        <ChevronRight className="w-4 h-4" />
      </button>

      <p className="text-center text-[10px] text-darkgray/40">Secure checkout · Powered by Razorpay</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cartCount, cartTotal, isEmpty, syncing, clearCart } = useCart();

  return (
    <div className="min-h-screen flex flex-col bg-warmwhite">
      <Navbar cartCount={cartCount} onOpenCart={() => {}} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/marketplace")}
              className="p-2 hover:bg-beige/60 rounded-xl transition text-darkgray/60"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-display font-bold text-2xl text-darkgray flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-olive" />
                Your Cart
              </h1>
              <p className="text-xs text-darkgray/50 mt-0.5">
                {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal.toLocaleString("en-IN")}
                {syncing && (
                  <span className="ml-2 inline-flex items-center gap-1 text-olive">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Saving…
                  </span>
                )}
              </p>
            </div>
          </div>

          {!isEmpty && (
            <button
              onClick={() => { if (window.confirm("Clear your entire cart?")) clearCart(); }}
              className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 font-semibold transition px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear cart
            </button>
          )}
        </div>

        {/* Empty state */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-olive/10">
            <ShoppingBag className="w-14 h-14 text-darkgray/20 mb-5" />
            <h2 className="font-display font-semibold text-xl text-darkgray/50 mb-2">Your cart is empty</h2>
            <p className="text-sm text-darkgray/40 mb-8">Add items from the marketplace to get started.</p>
            <button
              onClick={() => navigate("/marketplace")}
              className="px-6 py-3 bg-olive hover:bg-olive-600 text-white font-bold text-sm rounded-xl shadow transition flex items-center gap-2"
            >
              Browse Marketplace
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Line items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <CartLineItem key={item.id} item={item} />
              ))}
            </div>

            {/* Summary — navigates to /checkout */}
            <div className="lg:col-span-1">
              <OrderSummary
                cartTotal={cartTotal}
                onCheckout={() => navigate("/checkout")}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}