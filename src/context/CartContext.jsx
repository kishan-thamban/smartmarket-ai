/**
 * CartContext.jsx — SmartMarketAI
 *
 * Global cart state with:
 *  - localStorage persistence (key: "cart_items")
 *  - Server-side sync via PUT /api/cart  (authenticated customers only)
 *  - Add / remove / update-quantity / clear helpers
 *  - Optimistic UI: local state updates instantly; server sync debounced 800 ms
 *
 * Fixes applied:
 *  - clearCart() posts an immediate PUT /api/cart with an empty array
 *    (instead of relying on the 800 ms debounce) so the server cart is
 *    cleared synchronously before the checkout success screen renders.
 *  - isLoggedInCustomer() decodes the JWT for role/expiry — never reads
 *    the plain "userRole" localStorage key (prevents role spoofing).
 *  - syncToServer error handling refined: non-401 network errors are
 *    silently ignored (cart still works offline); 401 triggers logout.
 */

import {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from "react";

const CartContext = createContext(null);

const STORAGE_KEY = "cart_items";

// ── helpers ───────────────────────────────────────────────────────────────────

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* quota exceeded – silent */ }
}

function getAuthHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Read role from JWT payload — never from plain "userRole" localStorage key */
function isLoggedInCustomer() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return false;
    const base64  = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    return (
      payload.role === "customer" &&
      (!payload.exp || Date.now() / 1000 < payload.exp)
    );
  } catch {
    return false;
  }
}

const BASE_HEADERS = { "Content-Type": "application/json" };

// ── Provider ──────────────────────────────────────────────────────────────────

export function CartProvider({ children }) {
  const [items,      setItems]      = useState(loadFromStorage);
  const [syncing,    setSyncing]    = useState(false);
  const [serverCart, setServerCart] = useState(null); // null = not yet fetched
  const syncTimeout                 = useRef(null);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  // ── Server fetch on mount (merge server cart with local) ──────────────────
  useEffect(() => {
    if (!isLoggedInCustomer()) return;

    const fetchServerCart = async () => {
      try {
        const res = await fetch("/api/cart", {
          headers: { ...BASE_HEADERS, ...getAuthHeader() },
        });
        if (!res.ok) return;
        const data = await res.json();
        setServerCart(data.items ?? []);

        // Merge: local wins for quantity; server adds items missing locally
        setItems((prev) => {
          const merged = [...prev];
          (data.items ?? []).forEach((serverItem) => {
            if (!merged.find((i) => i.id === serverItem.id)) {
              merged.push(serverItem);
            }
          });
          return merged;
        });
      } catch {
        // Offline or server down — local cart keeps working
      }
    };

    fetchServerCart();
  }, []);

  // ── Debounced server sync (fires 800 ms after last cart change) ───────────
  const syncToServer = useCallback((nextItems) => {
    if (!isLoggedInCustomer()) return;

    clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(async () => {
      setSyncing(true);
      try {
        const res = await fetch("/api/cart", {
          method:  "PUT",
          headers: { ...BASE_HEADERS, ...getAuthHeader() },
          body:    JSON.stringify({ items: nextItems }),
        });
        if (res.status === 401) {
          localStorage.clear();
          window.location.href = "/login";
        }
      } catch { /* network error – ignore; cart is still persisted locally */ }
      finally  { setSyncing(false); }
    }, 800);
  }, []);

  // ── Mutators ──────────────────────────────────────────────────────────────

  const addItem = useCallback((product, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      const next = existing
        ? prev.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + qty } : i
          )
        : [
            ...prev,
            {
              id:       product.id,
              name:     product.name,
              price:    product.price,
              image:    product.image,
              category: product.category,
              stock:    product.stock,
              vendorId: product.vendorId,
              quantity: qty,
            },
          ];
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  const removeItem = useCallback((productId) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== productId);
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  /** setQuantity — sets absolute quantity. Removes item if qty ≤ 0. */
  const setQuantity = useCallback((productId, qty) => {
    setItems((prev) => {
      const next =
        qty <= 0
          ? prev.filter((i) => i.id !== productId)
          : prev.map((i) =>
              i.id === productId ? { ...i, quantity: qty } : i
            );
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  /** updateQuantity — adjusts quantity by delta (+/− integer). Removes if result ≤ 0. */
  const updateQuantity = useCallback((productId, delta) => {
    setItems((prev) => {
      const next = prev
        .map((i) =>
          i.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0);
      syncToServer(next);
      return next;
    });
  }, [syncToServer]);

  /**
   * clearCart — resets local state immediately AND pushes an empty cart to the
   * server right away (no debounce) so the server is cleared before the
   * checkout confirmation screen renders.
   *
   * FIX: was previously debounced at 800 ms, which meant the server cart
   * could still contain items if the user navigated away quickly.
   */
  const clearCart = useCallback(async () => {
    clearTimeout(syncTimeout.current); // cancel any pending debounced sync
    setItems([]);
    saveToStorage([]);

    if (!isLoggedInCustomer()) return;

    setSyncing(true);
    try {
      await fetch("/api/cart", {
        method:  "PUT",
        headers: { ...BASE_HEADERS, ...getAuthHeader() },
        body:    JSON.stringify({ items: [] }),
      });
    } catch { /* ignore network errors on clear */ }
    finally  { setSyncing(false); }
  }, []);

  // ── Derived values ────────────────────────────────────────────────────────

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const isEmpty   = items.length === 0;

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        cartTotal,
        isEmpty,
        syncing,
        serverCart,
        addItem,
        removeItem,
        setQuantity,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}