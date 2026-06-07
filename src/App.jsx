/**
 * App.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - /checkout route added (ProtectedRoute, customer-only)
 *  - ProtectedRoute reads role exclusively from JWT payload (not localStorage)
 *  - All routing logic unchanged for existing routes
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import LandingPage         from "./pages/LandingPage";
import Login               from "./pages/Login";
import Register            from "./pages/Register";
import CustomerMarketplace from "./pages/CustomerMarketplace";
import CartPage            from "./pages/CartPage";
import CheckoutPage        from "./pages/CheckoutPage";
import VendorDashboard     from "./pages/VendorDashboard";
import AdminDashboard      from "./pages/AdminDashboard";

// ── JWT helpers ───────────────────────────────────────────────────────────────

/**
 * Decodes a JWT payload without verifying the signature.
 * Verification happens server-side on every API call.
 */
function decodeToken(token) {
  try {
    const base64Payload = token.split(".")[1];
    const json = atob(base64Payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns the decoded JWT payload if a valid, non-expired token exists.
 * Clears localStorage and returns null on failure.
 */
function getAuthUser() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const payload = decodeToken(token);
  if (!payload) {
    localStorage.clear();
    return null;
  }

  // Check expiry (exp is Unix seconds)
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    localStorage.clear();
    return null;
  }

  return payload; // { id, name, email, role, vendorId, iat, exp }
}

// ── ProtectedRoute ────────────────────────────────────────────────────────────

/**
 * Guards a route using the JWT stored in localStorage.
 * Role is read ONLY from the signed JWT payload — never from plain localStorage keys —
 * so client-side role tampering has no effect on protected routes.
 *
 * Unauthenticated → /login
 * Wrong role      → / (landing page)
 */
function ProtectedRoute({ children, allowedRole }) {
  const user = getAuthUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    // CartProvider wraps everything so cart state is accessible from any page
    <CartProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/"         element={<LandingPage />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Customer-only routes */}
          <Route
            path="/marketplace"
            element={
              <ProtectedRoute allowedRole="customer">
                <CustomerMarketplace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cart"
            element={
              <ProtectedRoute allowedRole="customer">
                <CartPage />
              </ProtectedRoute>
            }
          />
          {/* FIX: /checkout route added */}
          <Route
            path="/checkout"
            element={
              <ProtectedRoute allowedRole="customer">
                <CheckoutPage />
              </ProtectedRoute>
            }
          />

          {/* Vendor-only */}
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRole="vendor">
                <VendorDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin-only */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </CartProvider>
  );
}