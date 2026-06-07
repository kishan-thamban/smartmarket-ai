import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Persist auth data returned from the server
  const persistAuth = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("userRole", user.role);
    localStorage.setItem("userName", user.name);
    if (user.vendorId) {
      localStorage.setItem("vendorId", user.vendorId);
    }
  };

  // Redirect based on role
  const redirectByRole = (role) => {
    if (role === "admin") navigate("/admin");
    else if (role === "vendor") navigate("/vendor");
    else navigate("/marketplace");
  };

  // ── Primary login via /api/auth/login ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Login failed. Please check your credentials.");
        return;
      }

      persistAuth(data.token, data.user);
      redirectByRole(data.user.role);
    } catch (err) {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Demo quick-login: logs in with preset seed accounts ──
  // These accounts are automatically seeded in the backend on first boot.
  // Credentials: admin@smartmarket.ai / admin123
  // Demo vendor & customer accounts must be registered via /register first,
  // OR you can use the inline seed helpers below for a one-click demo experience.
  const handleDemoLogin = async (demoEmail, demoPassword) => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: demoEmail, password: demoPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        // If demo account doesn't exist yet, surface a helpful message
        setError(
          data.message === "Invalid email or password."
            ? `Demo account not found. Register "${demoEmail}" via the Register page first, then return here.`
            : data.message
        );
        return;
      }

      persistAuth(data.token, data.user);
      redirectByRole(data.user.role);
    } catch (err) {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative flex items-center justify-center py-12 px-6 lg:px-8"
      style={{ background: "#FAF7F2" }}
    >
      <div className="absolute inset-0 grain opacity-40 pointer-events-none" />

      {/* Background blobs */}
      <div
        className="absolute w-80 h-80 rounded-full filter blur-[70px] opacity-10 top-10 right-10"
        style={{ background: "#6B7D4F" }}
      />
      <div
        className="absolute w-80 h-80 rounded-full filter blur-[70px] opacity-10 bottom-10 left-10"
        style={{ background: "#87986A" }}
      />

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Brand */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6 group">
            <span
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: "#6B7D4F" }}
            >
              <svg viewBox="0 0 20 20" fill="white" className="w-5 h-5">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </span>
            <span
              className="font-display text-2xl font-bold tracking-tight"
              style={{ color: "#2F2F2F" }}
            >
              SmartMarket<span style={{ color: "#6B7D4F" }}>AI</span>
            </span>
          </Link>
          <h2 className="font-display text-3xl font-bold tracking-tight text-darkgray">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-darkgray/60">
            Sign in to access your dashboard or storefront
          </p>
        </div>

        {/* Card */}
        <div
          className="p-8 rounded-2xl border bg-warmwhite/60 backdrop-blur-md"
          style={{
            borderColor: "rgba(107,125,79,0.15)",
            boxShadow: "0 10px 35px -5px rgba(107,125,79,0.06)",
          }}
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl text-xs font-semibold text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-3 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded text-olive focus:ring-olive border-gray-300"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-xs font-medium text-darkgray/70"
                >
                  Remember me
                </label>
              </div>
              <a href="#" className="text-xs font-bold text-olive hover:underline">
                Forgot password?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: "#6B7D4F" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {/* Demo quick-login */}
          <div className="mt-8 pt-6 border-t" style={{ borderColor: "rgba(107,125,79,0.12)" }}>
            <span className="block text-[10px] font-bold uppercase tracking-widest text-center text-darkgray/40 mb-1">
              Demo accounts
            </span>
            <p className="text-[10px] text-center text-darkgray/30 mb-4">
              Admin is auto-seeded. Vendor / Customer must be registered first.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin("customer@demo.com", "demo1234")}
                className="py-2.5 px-2 text-[11px] font-bold rounded-lg border text-darkgray hover:bg-beige/30 transition disabled:opacity-50"
                style={{ borderColor: "rgba(107,125,79,0.18)" }}
              >
                Customer
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin("vendor@demo.com", "demo1234")}
                className="py-2.5 px-2 text-[11px] font-bold rounded-lg border text-darkgray hover:bg-beige/30 transition disabled:opacity-50"
                style={{ borderColor: "rgba(107,125,79,0.18)" }}
              >
                Vendor
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin("admin@smartmarket.ai", "admin123")}
                className="py-2.5 px-2 text-[11px] font-bold rounded-lg border text-darkgray hover:bg-beige/30 transition disabled:opacity-50"
                style={{ borderColor: "rgba(107,125,79,0.18)" }}
              >
                Admin
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-darkgray/60">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="font-bold text-olive hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}