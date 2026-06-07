import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Analytics", href: "#analytics" },
  { label: "Vendors", href: "#vendors" },
  { label: "Pricing", href: "#pricing" },
];

const STATS = [
  { value: "98.4%", label: "Forecast Accuracy" },
  { value: "3.2x", label: "Revenue Growth" },
  { value: "12K+", label: "Active Vendors" },
  { value: "$2.1B", label: "GMV Processed" },
];

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: "LSTM Demand Forecasting",
    desc: "Deep learning models trained on historical sales, seasonal trends, and market signals to predict demand up to 90 days ahead.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.746 3.746 0 01-1.043-3.297A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.297-1.043A3.745 3.745 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.297A3.745 3.745 0 0121 12z" />
      </svg>
    ),
    title: "Smart Inventory Alerts",
    desc: "Automated reorder triggers and low-stock warnings keep shelves optimally stocked without human intervention.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    title: "Vendor Analytics Hub",
    desc: "360° view of vendor performance, fulfillment rates, return metrics, and customer satisfaction scores in one place.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: "Dynamic Pricing Engine",
    desc: "AI-powered pricing recommendations that respond to competitor data, demand elasticity, and inventory levels in real time.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    title: "Revenue Intelligence",
    desc: "Cohort analysis, LTV predictions, and churn signals give vendors a complete financial picture of their business health.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    title: "Multi-Region Support",
    desc: "Localized storefronts, multi-currency checkout, and region-specific tax compliance baked in from day one.",
  },
];

const TESTIMONIALS = [
  {
    quote: "SmartMarket's forecasting cut our overstock by 40% in the first quarter. The LSTM model genuinely surprised us.",
    name: "Priya Sharma",
    role: "Head of Supply Chain, Kirana Plus",
    initials: "PS",
  },
  {
    quote: "The vendor analytics dashboard is the clearest view I've ever had of my business. It changed how we make decisions.",
    name: "Arjun Mehta",
    role: "Founder, UrbanCraft",
    initials: "AM",
  },
  {
    quote: "We scaled from 200 to 2,000 SKUs without hiring additional ops staff. The automation is that good.",
    name: "Divya Nair",
    role: "Operations Director, ThreadHouse",
    initials: "DN",
  },
];

const PRICING = [
  {
    tier: "Starter",
    price: "₹2,499",
    period: "/month",
    desc: "For small vendors getting started with data-driven selling.",
    features: ["Up to 500 SKUs", "Basic demand forecasting", "Order management", "Email support"],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    tier: "Growth",
    price: "₹7,999",
    period: "/month",
    desc: "For scaling businesses that need intelligent insights.",
    features: ["Up to 5,000 SKUs", "LSTM forecasting (90-day)", "Advanced vendor analytics", "Dynamic pricing", "Priority support"],
    cta: "Get Started",
    highlight: true,
  },
  {
    tier: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For large-scale operations with custom requirements.",
    features: ["Unlimited SKUs", "Custom ML models", "Multi-region deployment", "Dedicated success manager", "SLA guarantee"],
    cta: "Contact Sales",
    highlight: false,
  },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen font-sans" style={{ background: "#FAF7F2", color: "#2F2F2F" }}>
      {/* Custom font import */}
      <style>{`
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Playfair Display', serif; }
        .grain { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        .anim-fade-up { animation: fadeUp 0.7s cubic-bezier(.22,.68,0,1.2) both; }
        .anim-fade-up-2 { animation: fadeUp 0.7s 0.15s cubic-bezier(.22,.68,0,1.2) both; }
        .anim-fade-up-3 { animation: fadeUp 0.7s 0.28s cubic-bezier(.22,.68,0,1.2) both; }
        .anim-fade-up-4 { animation: fadeUp 0.7s 0.42s cubic-bezier(.22,.68,0,1.2) both; }
        .feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(107,125,79,0.12); }
        .feature-card { transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .hero-blob { position:absolute; border-radius:50%; filter:blur(80px); opacity:0.18; pointer-events:none; }
      `}</style>

      {/* ── NAVBAR ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(250,247,242,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(107,125,79,0.12)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#6B7D4F" }}>
              <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </span>
            <span className="font-display text-lg font-600 tracking-tight" style={{ color: "#2F2F2F" }}>
              SmartMarket<span style={{ color: "#6B7D4F" }}>AI</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium transition-colors hover:text-olive-600"
                style={{ color: "#5A5A5A" }}
                onMouseEnter={(e) => (e.target.style.color = "#6B7D4F")}
                onMouseLeave={(e) => (e.target.style.color = "#5A5A5A")}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-all"
              style={{ color: "#2F2F2F" }}
              onMouseEnter={(e) => (e.target.style.background = "#F0EBE0")}
              onMouseLeave={(e) => (e.target.style.background = "transparent")}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium px-5 py-2.5 rounded-xl text-white transition-all hover:opacity-90 shadow-md"
              style={{ background: "#6B7D4F" }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="w-5 h-0.5 mb-1.5 transition-all" style={{ background: "#2F2F2F" }} />
            <div className="w-5 h-0.5 mb-1.5 transition-all" style={{ background: "#2F2F2F" }} />
            <div className="w-5 h-0.5 transition-all" style={{ background: "#2F2F2F" }} />
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden px-6 pb-6 pt-2 flex flex-col gap-4" style={{ background: "#FAF7F2", borderBottom: "1px solid #E8E0D0" }}>
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-sm font-medium" style={{ color: "#5A5A5A" }} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: "#E8E0D0" }}>
              <Link to="/login" className="text-sm font-medium py-2.5 text-center rounded-lg" style={{ background: "#F0EBE0", color: "#2F2F2F" }}>
                Sign In
              </Link>
              <Link to="/register" className="text-sm font-medium py-2.5 text-center rounded-xl text-white" style={{ background: "#6B7D4F" }}>
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Background blobs */}
        <div className="hero-blob w-96 h-96 top-20 -right-24" style={{ background: "#87986A" }} />
        <div className="hero-blob w-72 h-72 bottom-32 -left-16" style={{ background: "#6B7D4F" }} />
        <div className="absolute inset-0 grain pointer-events-none" />

        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#6B7D4F 1px, transparent 1px), linear-gradient(90deg, #6B7D4F 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-24 md:py-32 grid lg:grid-cols-2 gap-16 items-center w-full">
          {/* Left */}
          <div>
            <div className="anim-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8" style={{ background: "rgba(107,125,79,0.1)", color: "#6B7D4F", border: "1px solid rgba(107,125,79,0.2)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#6B7D4F" }} />
              Powered by LSTM Neural Networks
            </div>

            <h1 className="font-display anim-fade-up-2 text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6" style={{ color: "#2F2F2F", letterSpacing: "-0.02em" }}>
              Sell Smarter.{" "}
              <span className="relative inline-block">
                <span style={{ color: "#6B7D4F" }}>Forecast</span>
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 6 C50 2, 150 2, 198 6" stroke="#87986A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </svg>
              </span>{" "}
              Perfectly.
            </h1>

            <p className="anim-fade-up-3 text-lg leading-relaxed mb-10 max-w-xl" style={{ color: "#6A6A6A" }}>
              SmartMarket AI combines deep learning demand forecasting with real-time vendor analytics — so you always have the right products, at the right price, at exactly the right time.
            </p>

            <div className="anim-fade-up-4 flex flex-wrap gap-4">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-medium text-sm shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "#6B7D4F" }}
              >
                Start Free Trial
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-medium text-sm transition-all hover:-translate-y-0.5"
                style={{ background: "#F0EBE0", color: "#2F2F2F", border: "1px solid #DDD5C5" }}
              >
                See How It Works
              </a>
            </div>

            {/* Trust badges */}
            <div className="anim-fade-up-4 mt-10 flex items-center gap-6 flex-wrap">
              <span className="text-xs font-medium" style={{ color: "#9A9A9A" }}>Trusted by 12,000+ vendors</span>
              <div className="flex -space-x-2">
                {["#8B9E6E", "#7A8D60", "#6B7D4F", "#5C6E42", "#4E5F36"].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white" style={{ borderColor: "#FAF7F2", background: c }}>
                    {["P","A","D","R","K"][i]}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} viewBox="0 0 16 16" fill="#6B7D4F" className="w-3.5 h-3.5"><path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L4.4 12.5l.7-4L2.2 5.7l4-.6z"/></svg>
                ))}
                <span className="text-xs ml-1 font-medium" style={{ color: "#6A6A6A" }}>4.9/5 rating</span>
              </div>
            </div>
          </div>

          {/* Right — Dashboard Preview Card */}
          <div className="hidden lg:block relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#F5F1E8", border: "1px solid #E0D8C8" }}>
              {/* Card Header */}
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E0D8C8" }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#E8A598" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#E8D498" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#A8C898" }} />
                </div>
                <span className="text-xs font-medium" style={{ color: "#8A8A8A" }}>Forecast Dashboard · Live</span>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#6B7D4F" }} />
              </div>

              {/* Chart area */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-medium mb-0.5" style={{ color: "#8A8A8A" }}>Predicted Revenue</p>
                    <p className="text-2xl font-bold font-display" style={{ color: "#2F2F2F" }}>₹18,42,560</p>
                    <span className="text-xs font-medium" style={{ color: "#6B7D4F" }}>▲ 23.4% vs last month</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium mb-0.5" style={{ color: "#8A8A8A" }}>Model Confidence</p>
                    <p className="text-2xl font-bold font-display" style={{ color: "#2F2F2F" }}>96.2%</p>
                  </div>
                </div>

                {/* Fake chart bars */}
                <div className="flex items-end gap-1.5 h-28 mb-4">
                  {[55, 70, 62, 80, 68, 90, 76, 88, 72, 95, 84, 100].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm transition-all" style={{ height: `${h}%`, background: i === 10 ? "#6B7D4F" : i === 11 ? "rgba(107,125,79,0.4)" : "rgba(107,125,79,0.2)" }} />
                  ))}
                </div>

                <div className="flex gap-3">
                  {["Electronics", "Apparel", "Home & Kitchen"].map((cat, i) => (
                    <div key={i} className="flex-1 rounded-xl p-3" style={{ background: "rgba(107,125,79,0.08)" }}>
                      <p className="text-xs font-medium mb-1" style={{ color: "#8A8A8A" }}>{cat}</p>
                      <p className="text-sm font-bold" style={{ color: "#2F2F2F" }}>{["↑ 31%", "↑ 18%", "↑ 27%"][i]}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alert banner */}
              <div className="mx-5 mb-5 px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: "rgba(107,125,79,0.12)", border: "1px solid rgba(107,125,79,0.2)" }}>
                <svg viewBox="0 0 20 20" fill="#6B7D4F" className="w-4 h-4 shrink-0"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
                <p className="text-xs font-medium" style={{ color: "#4A5F30" }}>LSTM model suggests restocking <strong>SKU-2847</strong> in 4 days</p>
              </div>
            </div>

            {/* Floating badge */}
            <div className="absolute -bottom-4 -left-6 px-4 py-3 rounded-xl shadow-lg" style={{ background: "#2F2F2F" }}>
              <p className="text-xs font-medium text-white opacity-70 mb-0.5">Avg. Forecast Accuracy</p>
              <p className="text-xl font-bold font-display text-white">98.4%</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ background: "#6B7D4F" }} className="py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-4xl font-bold text-white mb-1">{s.value}</p>
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24" style={{ background: "#FAF7F2" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(107,125,79,0.1)", color: "#6B7D4F", border: "1px solid rgba(107,125,79,0.2)" }}>
              Platform Features
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#2F2F2F", letterSpacing: "-0.02em" }}>
              Intelligence built into every layer
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#6A6A6A" }}>
              From AI forecasting to real-time analytics, every feature is designed to give vendors an unfair advantage.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card p-6 rounded-2xl" style={{ background: "#F5F1E8", border: "1px solid #E8E0D0" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "rgba(107,125,79,0.12)", color: "#6B7D4F" }}>
                  {f.icon}
                </div>
                <h3 className="font-display text-lg font-semibold mb-2" style={{ color: "#2F2F2F" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6A6A6A" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="analytics" className="py-24" style={{ background: "#F0EBE0" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(107,125,79,0.1)", color: "#6B7D4F", border: "1px solid rgba(107,125,79,0.2)" }}>
              How It Works
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold" style={{ color: "#2F2F2F", letterSpacing: "-0.02em" }}>
              From data to decisions in minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Connect Your Store", desc: "Sync your product catalog, sales history, and inventory. We support all major platforms — Shopify, WooCommerce, and custom APIs." },
              { step: "02", title: "AI Learns Your Business", desc: "Our LSTM model analyzes your historical data, seasonality patterns, and market signals to build a personalized forecast model." },
              { step: "03", title: "Act on Insights", desc: "Get actionable recommendations: what to reorder, when to discount, which products to push — all inside one clean dashboard." },
            ].map((item) => (
              <div key={item.step} className="relative p-7 rounded-2xl" style={{ background: "#FAF7F2", border: "1px solid #E0D8C8" }}>
                <span className="font-display text-6xl font-bold absolute top-4 right-5 opacity-10" style={{ color: "#6B7D4F" }}>{item.step}</span>
                <span className="font-display text-sm font-bold mb-4 block" style={{ color: "#6B7D4F" }}>{item.step}</span>
                <h3 className="font-display text-xl font-semibold mb-3" style={{ color: "#2F2F2F" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6A6A6A" }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24" style={{ background: "#FAF7F2" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold" style={{ color: "#2F2F2F", letterSpacing: "-0.02em" }}>
              Vendors who trust us
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="p-7 rounded-2xl flex flex-col gap-5" style={{ background: "#F5F1E8", border: "1px solid #E8E0D0" }}>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(i => <svg key={i} viewBox="0 0 16 16" fill="#6B7D4F" className="w-4 h-4"><path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9L4.4 12.5l.7-4L2.2 5.7l4-.6z"/></svg>)}
                </div>
                <p className="text-sm leading-relaxed font-medium" style={{ color: "#2F2F2F" }}>"{t.quote}"</p>
                <div className="flex items-center gap-3 mt-auto">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: "#6B7D4F" }}>{t.initials}</div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#2F2F2F" }}>{t.name}</p>
                    <p className="text-xs" style={{ color: "#8A8A8A" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24" style={{ background: "#F0EBE0" }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(107,125,79,0.1)", color: "#6B7D4F", border: "1px solid rgba(107,125,79,0.2)" }}>
              Pricing
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4" style={{ color: "#2F2F2F", letterSpacing: "-0.02em" }}>
              Simple, transparent pricing
            </h2>
            <p className="text-lg" style={{ color: "#6A6A6A" }}>Start free for 14 days. No credit card required.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map((p) => (
              <div
                key={p.tier}
                className="rounded-2xl p-7"
                style={{
                  background: p.highlight ? "#6B7D4F" : "#FAF7F2",
                  border: p.highlight ? "none" : "1px solid #E0D8C8",
                  boxShadow: p.highlight ? "0 20px 60px rgba(107,125,79,0.35)" : "none",
                  transform: p.highlight ? "scale(1.04)" : "none",
                }}
              >
                {p.highlight && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4" style={{ background: "rgba(255,255,255,0.2)", color: "white" }}>
                    Most Popular
                  </span>
                )}
                <p className="text-sm font-semibold mb-2" style={{ color: p.highlight ? "rgba(255,255,255,0.7)" : "#8A8A8A" }}>{p.tier}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="font-display text-4xl font-bold" style={{ color: p.highlight ? "white" : "#2F2F2F" }}>{p.price}</span>
                  {p.period && <span className="text-sm mb-1.5" style={{ color: p.highlight ? "rgba(255,255,255,0.6)" : "#8A8A8A" }}>{p.period}</span>}
                </div>
                <p className="text-sm mb-6" style={{ color: p.highlight ? "rgba(255,255,255,0.7)" : "#6A6A6A" }}>{p.desc}</p>
                <ul className="space-y-3 mb-7">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: p.highlight ? "rgba(255,255,255,0.85)" : "#4A4A4A" }}>
                      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 shrink-0" stroke={p.highlight ? "rgba(255,255,255,0.8)" : "#6B7D4F"} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/register"
                  className="block w-full py-3 rounded-xl text-center text-sm font-semibold transition-all hover:opacity-90"
                  style={{
                    background: p.highlight ? "white" : "#6B7D4F",
                    color: p.highlight ? "#6B7D4F" : "white",
                  }}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24" style={{ background: "#2F2F2F" }}>
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6" style={{ letterSpacing: "-0.02em" }}>
            Ready to sell with{" "}
            <span style={{ color: "#87986A" }}>intelligence</span>?
          </h2>
          <p className="text-lg mb-10" style={{ color: "rgba(255,255,255,0.55)" }}>
            Join 12,000+ vendors already using SmartMarket AI to forecast demand, optimize inventory, and grow revenue.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white font-semibold text-sm transition-all hover:opacity-90 shadow-xl"
              style={{ background: "#6B7D4F" }}
            >
              Start Free 14-Day Trial
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm transition-all hover:opacity-80"
              style={{ background: "rgba(255,255,255,0.08)", color: "white", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#1E1E1E", borderTop: "1px solid rgba(255,255,255,0.06)" }} className="py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#6B7D4F" }}>
                  <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                </span>
                <span className="font-display text-base font-600 text-white">SmartMarket<span style={{ color: "#87986A" }}>AI</span></span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>Intelligent e-commerce infrastructure powered by deep learning.</p>
            </div>
            {[
              { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { title: "Support", links: ["Documentation", "API Reference", "Status", "Contact"] },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-sm font-semibold text-white mb-4">{col.title}</p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm transition-colors" style={{ color: "rgba(255,255,255,0.4)" }} onMouseEnter={e => e.target.style.color = "rgba(255,255,255,0.75)"} onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.4)"}>
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>© 2025 SmartMarket AI. All rights reserved.</p>
            <div className="flex gap-6">
              {["Privacy", "Terms", "Cookies"].map((l) => (
                <a key={l} href="#" className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {l}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
