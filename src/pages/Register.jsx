import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState("vendor");
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation
    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all required fields.");
      return;
    }
    if (role === "vendor" && !storeName) {
      setError("Store / brand name is required for vendor registration.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, storeName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Registration failed. Please try again.");
        return;
      }

      // Store token + profile, then redirect
      persistAuth(data.token, data.user);

      if (role === "vendor") {
        navigate("/vendor");
      } else {
        navigate("/marketplace");
      }
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
            Get started
          </h2>
          <p className="mt-2 text-sm text-darkgray/60">
            Create an account to begin selling or buying with intelligence
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
          {/* Role toggle */}
          <div
            className="flex bg-beige/40 rounded-xl p-1 mb-6 border"
            style={{ borderColor: "rgba(107,125,79,0.1)" }}
          >
            <button
              type="button"
              onClick={() => {
                setRole("vendor");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                role === "vendor"
                  ? "bg-olive text-white shadow-sm"
                  : "text-darkgray/60 hover:text-darkgray"
              }`}
            >
              Merchant / Vendor
            </button>
            <button
              type="button"
              onClick={() => {
                setRole("customer");
                setError("");
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                role === "customer"
                  ? "bg-olive text-white shadow-sm"
                  : "text-darkgray/60 hover:text-darkgray"
              }`}
            >
              Customer
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="p-3 rounded-xl text-xs font-semibold text-red-600 bg-red-50 border border-red-200">
                {error}
              </div>
            )}

            {/* Full name */}
            <div>
              <label
                htmlFor="reg-name"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="First Last"
                autoComplete="name"
              />
            </div>

            {/* Store name — vendor only */}
            {role === "vendor" && (
              <div>
                <label
                  htmlFor="store-name"
                  className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-1.5"
                >
                  Store / Brand Name
                </label>
                <input
                  id="store-name"
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => {
                    setStoreName(e.target.value);
                    setError("");
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                  style={{ borderColor: "rgba(107,125,79,0.2)" }}
                  placeholder="e.g. Organic Harvests"
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="merchant@example.com"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="reg-pass"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-1.5"
              >
                Password{" "}
                <span className="normal-case font-normal text-darkgray/40">(min. 6 chars)</span>
              </label>
              <input
                id="reg-pass"
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label
                htmlFor="reg-confirm-pass"
                className="block text-xs font-bold uppercase tracking-wider text-darkgray/70 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="reg-confirm-pass"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError("");
                }}
                className="w-full px-4 py-2.5 rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-olive transition text-sm text-darkgray"
                style={{ borderColor: "rgba(107,125,79,0.2)" }}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {/* Vendor pending notice */}
            {role === "vendor" && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-[11px] text-darkgray/70"
                style={{ background: "rgba(107,125,79,0.06)", border: "1px solid rgba(107,125,79,0.12)" }}
              >
                <svg
                  className="w-3.5 h-3.5 mt-0.5 shrink-0 text-olive"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  Your vendor account will be in <strong>Pending Approval</strong> status until an
                  admin reviews and approves your application.
                </span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "#6B7D4F" }}
              >
                {loading
                  ? "Creating account…"
                  : role === "vendor"
                  ? "Register & Onboard"
                  : "Create Account"}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-darkgray/60">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-olive hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}