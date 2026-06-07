/**
 * Navbar.jsx — SmartMarketAI
 *
 * Fixes applied:
 *  - Removed role-switcher that set localStorage directly, bypassing JWT auth.
 *    Roles are now read exclusively from the decoded JWT payload.
 *  - userName/userRole are derived from the JWT token, not raw localStorage keys.
 *  - Cart icon links to /cart page instead of calling onOpenCart (which may be undefined
 *    on non-marketplace pages). onOpenCart prop retained for backward compat.
 */

import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogOut, ShoppingCart, Layers } from "lucide-react";

/** Decode JWT payload without verifying signature (verification is server-side). */
function getAuthPayload() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function Navbar({ cartCount = 0, onOpenCart }) {
  const navigate  = useNavigate();
  const location  = useLocation();

  // FIX: derive identity from JWT — never from plain localStorage role keys
  const payload  = getAuthPayload();
  const userRole = payload?.role  ?? "customer";
  const userName = payload?.name  ?? localStorage.getItem("userName") ?? "Guest";

  const handleLogout = () => {
    localStorage.clear();
    navigate("/");
  };

  const roleLabel =
    userRole === "admin"  ? "Platform Admin" :
    userRole === "vendor" ? "Merchant Account" :
    "Customer";

  // Show cart icon on marketplace and cart pages for customers
  const showCart =
    userRole === "customer" &&
    (location.pathname.includes("/marketplace") || location.pathname.includes("/cart") || location.pathname.includes("/checkout"));

  const handleCartClick = () => {
    if (onOpenCart && location.pathname.includes("/marketplace")) {
      onOpenCart();
    } else {
      navigate("/cart");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-warmwhite border-b border-olive/10 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-olive text-white">
              <Layers className="w-4 h-4" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-darkgray">
              SmartMarket<span className="text-olive">AI</span>
            </span>
          </Link>

          {/* Dashboard navigation links — role-appropriate, no bypass switcher */}
          <nav className="hidden lg:flex items-center gap-1">
            {userRole === "customer" && (
              <Link
                to="/marketplace"
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  location.pathname === "/marketplace"
                    ? "bg-olive text-white shadow-sm"
                    : "text-darkgray/60 hover:text-darkgray hover:bg-beige/40"
                }`}
              >
                Marketplace
              </Link>
            )}
            {userRole === "vendor" && (
              <Link
                to="/vendor"
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  location.pathname === "/vendor"
                    ? "bg-olive text-white shadow-sm"
                    : "text-darkgray/60 hover:text-darkgray hover:bg-beige/40"
                }`}
              >
                Merchant Portal
              </Link>
            )}
            {userRole === "admin" && (
              <Link
                to="/admin"
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  location.pathname === "/admin"
                    ? "bg-olive text-white shadow-sm"
                    : "text-darkgray/60 hover:text-darkgray hover:bg-beige/40"
                }`}
              >
                Admin Panel
              </Link>
            )}
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4">

          {/* Customer cart icon */}
          {showCart && (
            <button
              onClick={handleCartClick}
              className="relative p-2 text-darkgray/70 hover:text-olive hover:bg-beige/40 rounded-xl transition"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-olive text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>
          )}

          {/* User info + logout */}
          <div className="flex items-center gap-3 pl-3 border-l border-olive/12">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-darkgray leading-none mb-0.5">{userName}</p>
              <span className="text-[9px] font-bold uppercase tracking-widest text-olive/80">
                {roleLabel}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-red-600/80 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </header>
  );
}