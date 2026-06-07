/**
 * server.js — SmartMarketAI Backend
 *
 * Fixes applied:
 *  - dotenv loaded at the very top; JWT_SECRET required from env
 *  - CORS restricted to FRONTEND_ORIGIN env var (dev-friendly fallback)
 *  - crypto.randomUUID() replaces Math.random() order IDs
 *  - PUT /api/products/:id  — vendor ownership check added
 *  - DELETE /api/products/:id — implemented with ownership check
 *  - POST /api/orders       — stock validation before write
 *  - GET /api/forecast/:id  — returns { chartData, totalPredictedDemand, metrics }
 *                             (no custom properties on array)
 *  - buildForecastData      — returns plain { chartData[], totalPredictedDemand, metrics }
 *  - Admin routes           — all behind verifyToken + requireRole("admin")
 */

import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { execFile } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DB_FILE    = path.join(__dirname, "db.json");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── JWT Secret — must come from .env in production ──────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Add it to your .env file and restart.");
  process.exit(1);
}
const JWT_EXPIRES_IN = "7d";

// ── CORS — restricted to frontend origin ─────────────────────────────────────
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin / Postman (no origin) in development, and the configured frontend
      if (!origin || origin === FRONTEND_ORIGIN) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(morgan("dev"));

// ── DB HELPERS ───────────────────────────────────────────────────────────────

const readDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      users: [], vendors: [], products: [], orders: [], carts: {}, salesHistory: [],
      stats: { gmv: 0, commissionRate: 10, totalCommission: 0, activeVendors: 0, pendingVendors: 0 },
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  const raw  = fs.readFileSync(DB_FILE);
  const data = JSON.parse(raw);
  if (!data.users)        data.users        = [];
  if (!data.salesHistory) data.salesHistory = [];
  if (!data.carts)        data.carts        = {};
  if (!data.stats)        data.stats        = { gmv: 0, commissionRate: 10, totalCommission: 0, activeVendors: 0, pendingVendors: 0 };
  return data;
};

const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// ── SALES HISTORY HELPER ─────────────────────────────────────────────────────

const recordSalesHistory = (db, order) => {
  const today = order.date || new Date().toISOString().split("T")[0];

  order.items.forEach((item) => {
    const product    = db.products.find((p) => p.id === item.productId);
    const vendorId   = product ? product.vendorId : (item.vendorId ?? order.vendorId);
    const lineRevenue = item.price * item.quantity;

    const existing = db.salesHistory.find(
      (s) => s.productId === item.productId && s.date === today
    );
    if (existing) {
      existing.quantity += item.quantity;
      existing.revenue  += lineRevenue;
    } else {
      db.salesHistory.push({
        id:        `sh-${Date.now()}-${randomUUID().slice(0, 8)}`,
        productId: item.productId,
        vendorId,
        date:      today,
        quantity:  item.quantity,
        revenue:   lineRevenue,
      });
    }
  });
};

// ── JS FORECAST ENGINE (fallback when Python unavailable) ────────────────────
// Returns a plain object — no custom properties attached to arrays.

const buildForecastData = (salesHistory, productId) => {
  const records = salesHistory
    .filter((s) => s.productId === productId)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const byDate = {};
  records.forEach((r) => {
    byDate[r.date] = (byDate[r.date] || 0) + r.quantity;
  });

  const dates = Object.keys(byDate).sort();
  if (dates.length === 0) {
    return { chartData: [], totalPredictedDemand: 0, metrics: { rmse: null, mape: null } };
  }

  // Build a contiguous daily series
  const startDate = new Date(dates[0]);
  const endDate   = new Date(dates[dates.length - 1]);
  const allDates  = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    allDates.push(d.toISOString().split("T")[0]);
  }

  const avgQty = Object.values(byDate).reduce((s, v) => s + v, 0) / Object.values(byDate).length;

  const historical = allDates.map((date) => ({
    date:       date.slice(5), // MM-DD
    sales:      byDate[date] !== undefined ? byDate[date] : Math.round(avgQty * 0.8),
    isForecast: false,
  }));

  const trimmedHistory = historical.slice(-60);

  // Exponential smoothing
  const alpha = 0.3;
  let smoothed = trimmedHistory[0].sales;
  trimmedHistory.forEach((p) => {
    smoothed = alpha * p.sales + (1 - alpha) * smoothed;
  });

  // Derive std-dev from last 14 days for confidence bands
  const recent = trimmedHistory.slice(-14).map((p) => p.sales);
  const mean   = recent.reduce((s, v) => s + v, 0) / recent.length;
  const stdDev = Math.sqrt(
    recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / recent.length
  ) || 1;

  // RMSE on historical (in-sample residuals from smoothed level)
  let runSmoothed = trimmedHistory[0].sales;
  let ssResiduals = 0;
  let mapeSum     = 0;
  let mapeCount   = 0;
  trimmedHistory.forEach((p) => {
    const pred = runSmoothed;
    const err  = p.sales - pred;
    ssResiduals += err * err;
    if (p.sales > 0) { mapeSum += Math.abs(err / p.sales); mapeCount++; }
    runSmoothed = alpha * p.sales + (1 - alpha) * runSmoothed;
  });
  const rmse = parseFloat(Math.sqrt(ssResiduals / trimmedHistory.length).toFixed(2));
  const mape = mapeCount > 0 ? parseFloat((mapeSum / mapeCount * 100).toFixed(2)) : null;

  const lastDate     = new Date(allDates[allDates.length - 1]);
  const forecastPts  = [];
  let level          = smoothed;

  for (let i = 1; i <= 30; i++) {
    const forecastDate = new Date(lastDate);
    forecastDate.setDate(lastDate.getDate() + i);
    const dateLabel = forecastDate.toISOString().split("T")[0].slice(5);

    const noise = (Math.random() - 0.48) * stdDev * 0.4;
    level = Math.max(0, alpha * (level + noise) + (1 - alpha) * level);
    const sales = Math.max(0, Math.round(level));
    const band  = Math.round(stdDev * (1 + i * 0.03));

    forecastPts.push({
      date:            dateLabel,
      sales,
      isForecast:      true,
      predictedDemand: sales,
      upperConfidence: sales + band,
      lowerConfidence: Math.max(0, sales - band),
    });
  }

  const totalPredictedDemand = forecastPts.reduce((s, p) => s + p.sales, 0);
  const chartData            = [...trimmedHistory, ...forecastPts];

  return { chartData, totalPredictedDemand, metrics: { rmse, mape } };
};

// ── SEED ADMIN ───────────────────────────────────────────────────────────────

const seedAdminUser = async () => {
  const db         = readDB();
  const adminExists = db.users.find((u) => u.role === "admin");
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("admin123", 12);
    db.users.push({
      id:           `user-${randomUUID()}`,
      name:         "System Administrator",
      email:        "admin@smartmarket.ai",
      passwordHash: hashedPassword,
      role:         "admin",
      vendorId:     null,
      createdAt:    new Date().toISOString(),
    });
    writeDB(db);
    console.log("✅ Admin seeded — admin@smartmarket.ai / admin123");
  }
};

readDB();
seedAdminUser();

// ── JWT MIDDLEWARE ────────────────────────────────────────────────────────────

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided. Authorization denied." });
  }
  const token = authHeader.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token is invalid or expired." });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Not authenticated." });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: `Access denied. Required: ${roles.join(", ")}` });
  next();
};

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password, role, storeName } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ message: "name, email, password, and role are required." });
  if (!["customer", "vendor"].includes(role))
    return res.status(400).json({ message: "role must be 'customer' or 'vendor'." });
  if (role === "vendor" && !storeName)
    return res.status(400).json({ message: "storeName is required for vendor registration." });
  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters." });

  const db = readDB();
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ message: "An account with this email already exists." });

  const passwordHash = await bcrypt.hash(password, 12);
  let vendorId       = null;

  if (role === "vendor") {
    const logo      = storeName.split(" ").map((w) => w[0]).join("").toUpperCase().substring(0, 2);
    const newVendor = {
      id: `v-${randomUUID().slice(0, 8)}`,
      name, storeName, email,
      joinedDate: new Date().toISOString().split("T")[0],
      logo, rating: 0.0, status: "Pending Approval",
      revenue: 0, balance: 0, itemsFulfilled: 0, returnRate: "0%",
    };
    db.vendors.push(newVendor);
    db.stats.pendingVendors = (db.stats.pendingVendors || 0) + 1;
    vendorId = newVendor.id;
  }

  const newUser = {
    id: `user-${randomUUID()}`,
    name, email: email.toLowerCase(), passwordHash, role, vendorId,
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, vendorId },
    JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
  );
  const { passwordHash: _pw, ...userProfile } = newUser;
  return res.status(201).json({ message: "Registration successful.", token, user: userProfile });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "email and password are required." });

  const db   = readDB();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ message: "Invalid email or password." });

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) return res.status(401).json({ message: "Invalid email or password." });

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role, vendorId: user.vendorId },
    JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
  );
  const { passwordHash: _pw, ...userProfile } = user;
  return res.json({ message: "Login successful.", token, user: userProfile });
});

app.get("/api/auth/me", verifyToken, (req, res) => {
  const db   = readDB();
  const user = db.users.find((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: "User not found." });
  const { passwordHash: _pw, ...userProfile } = user;
  return res.json(userProfile);
});

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

app.get("/api/products", (req, res) => {
  const db = readDB();
  const { vendorId, search, category, minPrice, maxPrice, sortBy = "newest", page = "1", limit = "12" } = req.query;

  let products = [...db.products];

  if (vendorId)                    products = products.filter((p) => p.vendorId === vendorId);
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    products = products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }
  if (category && category !== "All")
    products = products.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  if (minPrice !== undefined && minPrice !== "") {
    const min = parseFloat(minPrice);
    if (!isNaN(min)) products = products.filter((p) => p.price >= min);
  }
  if (maxPrice !== undefined && maxPrice !== "") {
    const max = parseFloat(maxPrice);
    if (!isNaN(max)) products = products.filter((p) => p.price <= max);
  }

  switch (sortBy) {
    case "price_asc":  products.sort((a, b) => a.price - b.price); break;
    case "price_desc": products.sort((a, b) => b.price - a.price); break;
    case "rating":     products.sort((a, b) => (b.ratings || 0) - (a.ratings || 0)); break;
    case "name":       products.sort((a, b) => a.name.localeCompare(b.name)); break;
    case "stock":      products.sort((a, b) => (b.stock || 0) - (a.stock || 0)); break;
    default:           products.sort((a, b) => (b.id > a.id ? 1 : -1)); break;
  }

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
  const total    = products.length;
  const totalPages = Math.ceil(total / limitNum);
  const startIdx   = (pageNum - 1) * limitNum;
  const paginatedProducts = products.slice(startIdx, startIdx + limitNum);

  const allProducts = vendorId ? db.products.filter((p) => p.vendorId === vendorId) : db.products;
  const categories  = ["All", ...new Set(allProducts.map((p) => p.category).filter(Boolean))];
  const prices      = allProducts.map((p) => p.price);
  const priceRange  = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };

  return res.json({
    products: paginatedProducts,
    pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNext: pageNum < totalPages, hasPrev: pageNum > 1 },
    meta: { categories, priceRange },
  });
});

app.get("/api/products/meta", (req, res) => {
  const db     = readDB();
  const { vendorId } = req.query;
  const source = vendorId ? db.products.filter((p) => p.vendorId === vendorId) : db.products;
  const categories = ["All", ...new Set(source.map((p) => p.category).filter(Boolean))];
  const prices = source.map((p) => p.price);
  const priceRange = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
  return res.json({ categories, priceRange });
});

app.post("/api/products", verifyToken, requireRole("vendor", "admin"), (req, res) => {
  const db         = readDB();
  const newProduct = {
    id: `p-${randomUUID().slice(0, 8)}`,
    ...req.body,
    // Enforce vendorId from token for vendors (admin can supply their own)
    vendorId: req.user.role === "vendor" ? req.user.vendorId : (req.body.vendorId || req.user.vendorId),
    reviews:  [],
    ratings:  5.0,
    salesVelocity: parseFloat((Math.random() * 3 + 1).toFixed(1)),
  };
  db.products.push(newProduct);
  writeDB(db);
  res.status(201).json(newProduct);
});

// FIX: vendor ownership check — vendors can only update their own products
app.put("/api/products/:id", verifyToken, requireRole("vendor", "admin"), (req, res) => {
  const db  = readDB();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Product not found." });

  if (req.user.role === "vendor" && db.products[idx].vendorId !== req.user.vendorId) {
    return res.status(403).json({ message: "You can only modify your own products." });
  }

  // Prevent vendorId from being overwritten via body
  const { vendorId: _vid, id: _id, ...safeUpdate } = req.body;
  db.products[idx] = { ...db.products[idx], ...safeUpdate };
  writeDB(db);
  res.json(db.products[idx]);
});

// FIX: DELETE /api/products/:id — new endpoint with ownership check
app.delete("/api/products/:id", verifyToken, requireRole("vendor", "admin"), (req, res) => {
  const db  = readDB();
  const idx = db.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Product not found." });

  if (req.user.role === "vendor" && db.products[idx].vendorId !== req.user.vendorId) {
    return res.status(403).json({ message: "You can only delete your own products." });
  }

  const [deleted] = db.products.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Product deleted successfully.", product: deleted });
});

// ── ORDERS ────────────────────────────────────────────────────────────────────

app.get("/api/orders", verifyToken, (req, res) => {
  const db = readDB();
  const { vendorId } = req.query;
  if (vendorId) return res.json(db.orders.filter((o) => o.vendorId === vendorId));
  if (req.user.role === "customer") return res.json(db.orders.filter((o) => o.userId === req.user.id));
  res.json(db.orders);
});

// FIX: stock validation before writing order
app.post("/api/orders", verifyToken, requireRole("customer"), (req, res) => {
  const db = readDB();
  const { customerName, shippingAddress, phone, items, total, subtotal, shippingFee, paymentMethod, vendorId, status, paidAt } = req.body;

  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ message: "'items' must be a non-empty array." });
  if (typeof total !== "number" || total <= 0)
    return res.status(400).json({ message: "'total' must be a positive number." });

  // ── Stock validation ──────────────────────────────────────────────────────
  const stockErrors = [];
  for (const item of items) {
    const productId = item.productId ?? item.id;
    const product   = db.products.find((p) => p.id === productId);
    if (!product) {
      stockErrors.push(`Product "${item.name ?? productId}" no longer exists.`);
      continue;
    }
    if (product.stock < item.quantity) {
      stockErrors.push(
        `"${product.name}" only has ${product.stock} unit${product.stock !== 1 ? "s" : ""} in stock (you requested ${item.quantity}).`
      );
    }
  }
  if (stockErrors.length > 0) {
    return res.status(409).json({ message: "Some items are out of stock.", errors: stockErrors });
  }

  // Derive vendorId from first item if not supplied
  const resolvedVendorId = vendorId ?? (() => {
    const firstItem = items[0];
    if (firstItem.vendorId) return firstItem.vendorId;
    const prod = db.products.find((p) => p.id === (firstItem.productId ?? firstItem.id));
    return prod?.vendorId ?? null;
  })();

  const newOrder = {
    id:              `ord-${randomUUID()}`,
    status:          status ?? "Pending",
    date:            new Date().toISOString().split("T")[0],
    paidAt:          paidAt ?? new Date().toISOString(),
    userId:          req.user.id,
    customerName:    customerName ?? req.user.name,
    phone:           phone ?? null,
    shippingAddress: shippingAddress ?? null,
    vendorId:        resolvedVendorId,
    items: items.map((i) => ({
      productId: i.productId ?? i.id,
      name:      i.name,
      quantity:  i.quantity,
      price:     i.price,
      image:     i.image ?? null,
      vendorId:  i.vendorId ?? null,
    })),
    subtotal:    subtotal ?? total,
    shippingFee: shippingFee ?? 0,
    total,
    paymentMethod: paymentMethod ?? null,
  };

  db.orders.push(newOrder);

  // Decrement stock (already validated above)
  newOrder.items.forEach((item) => {
    const prod = db.products.find((p) => p.id === item.productId);
    if (prod) prod.stock = Math.max(0, prod.stock - item.quantity);
  });

  // Update platform GMV & commission
  db.stats.gmv += total;
  const commissionAmt = Math.round(total * (db.stats.commissionRate / 100));
  db.stats.totalCommission += commissionAmt;

  // Update vendor revenue & balance
  const vendorTotals = {};
  newOrder.items.forEach((item) => {
    const vid = item.vendorId ?? resolvedVendorId;
    if (!vid) return;
    vendorTotals[vid] = vendorTotals[vid] ?? { revenue: 0, qty: 0 };
    vendorTotals[vid].revenue += item.price * item.quantity;
    vendorTotals[vid].qty    += item.quantity;
  });
  Object.entries(vendorTotals).forEach(([vid, data]) => {
    const vendor = db.vendors.find((v) => v.id === vid);
    if (!vendor) return;
    const commission     = Math.round(data.revenue * (db.stats.commissionRate / 100));
    vendor.revenue       += data.revenue;
    vendor.balance       += data.revenue - commission;
    vendor.itemsFulfilled += data.qty;
  });

  recordSalesHistory(db, newOrder);
  writeDB(db);
  res.status(201).json(newOrder);
});

app.put("/api/orders/:id", verifyToken, requireRole("vendor", "admin"), (req, res) => {
  const db  = readDB();
  const idx = db.orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "Order not found." });
  db.orders[idx] = { ...db.orders[idx], ...req.body };
  writeDB(db);
  res.json(db.orders[idx]);
});

// ── SALES HISTORY ─────────────────────────────────────────────────────────────

app.get("/api/sales-history", verifyToken, (req, res) => {
  const db = readDB();
  const { productId, vendorId } = req.query;
  let records = db.salesHistory;
  if (productId) records = records.filter((s) => s.productId === productId);
  if (vendorId)  records = records.filter((s) => s.vendorId  === vendorId);
  records = records.sort((a, b) => new Date(a.date) - new Date(b.date));
  res.json(records);
});

// FIX: Forecast serialization — return plain object, no custom array props
app.get("/api/sales-history/forecast", verifyToken, (req, res) => {
  const { productId } = req.query;
  if (!productId)
    return res.status(400).json({ message: "productId query param is required." });

  const db      = readDB();
  const result  = buildForecastData(db.salesHistory, productId);
  res.json(result);
});

// FIX: /api/forecast/:productId — properly serialized response
app.get("/api/forecast/:productId", verifyToken, (req, res) => {
  const { productId } = req.params;
  const pythonBin     = process.env.PYTHON_BIN || "python3";
  const scriptPath    = path.join(__dirname, "forecast.py");

  const jsFallback = () => {
    const db     = readDB();
    const result = buildForecastData(db.salesHistory, productId);
    return res.json({ productId, ...result, source: "js-fallback" });
  };

  if (!fs.existsSync(scriptPath)) return jsFallback();

  execFile(
    pythonBin,
    [scriptPath, productId, DB_FILE],
    { timeout: 30_000, maxBuffer: 1024 * 1024 },
    (err, stdout, stderr) => {
      if (err) {
        console.warn("[forecast] Python error, using JS fallback:", stderr || err.message);
        return jsFallback();
      }
      try {
        const payload = JSON.parse(stdout);
        if (payload.error === "insufficient_data") {
          return res.status(422).json({ message: "Not enough sales history to generate a forecast.", productId });
        }
        // Ensure chartData is always a plain array (Python script already returns it correctly)
        return res.json({ productId, ...payload, source: "sklearn-linear-regression" });
      } catch (parseErr) {
        console.error("[forecast] Failed to parse Python output:", parseErr.message);
        return jsFallback();
      }
    }
  );
});

app.get("/api/inventory-recommendation/:productId", verifyToken, (req, res) => {
  const { productId } = req.params;
  const db            = readDB();

  const product = db.products.find((p) => p.id === productId);
  if (!product) return res.status(404).json({ message: "Product not found." });

  const currentStock   = product.stock ?? 0;
  const { chartData, totalPredictedDemand, metrics } = buildForecastData(db.salesHistory, productId);
  const recommendedReorder = Math.max(0, totalPredictedDemand - currentStock);

  let status = "adequate";
  if (recommendedReorder > 0) {
    status = recommendedReorder > currentStock ? "critical" : "low";
  }

  return res.json({
    productId,
    productName:          product.name,
    currentStock,
    totalPredictedDemand,
    recommendedReorder,
    status,
    metrics,
    forecastSource: "js-exponential-smoothing",
  });
});

app.get("/api/inventory-recommendation", verifyToken, (req, res) => {
  const { vendorId } = req.query;
  if (!vendorId) return res.status(400).json({ message: "vendorId query param is required." });

  const db             = readDB();
  const vendorProducts = db.products.filter((p) => p.vendorId === vendorId);

  const recommendations = vendorProducts.map((product) => {
    const currentStock   = product.stock ?? 0;
    const { totalPredictedDemand, metrics } = buildForecastData(db.salesHistory, product.id);
    const recommendedReorder = Math.max(0, totalPredictedDemand - currentStock);
    let status = "adequate";
    if (recommendedReorder > 0) {
      status = recommendedReorder > currentStock ? "critical" : "low";
    }
    return { productId: product.id, productName: product.name, currentStock, totalPredictedDemand, recommendedReorder, status, metrics, forecastSource: "js-exponential-smoothing" };
  });

  recommendations.sort((a, b) => b.recommendedReorder - a.recommendedReorder);
  return res.json(recommendations);
});

app.get("/api/sales-history/summary", verifyToken, (req, res) => {
  const { vendorId } = req.query;
  if (!vendorId) return res.status(400).json({ message: "vendorId query param is required." });

  const db            = readDB();
  const vendorRecords = db.salesHistory.filter((s) => s.vendorId === vendorId);

  const grouped = {};
  vendorRecords.forEach((r) => {
    if (!grouped[r.productId]) grouped[r.productId] = { totalQuantity: 0, totalRevenue: 0, dates: [] };
    grouped[r.productId].totalQuantity += r.quantity;
    grouped[r.productId].totalRevenue  += r.revenue;
    grouped[r.productId].dates.push(r.date);
  });

  const summary = Object.entries(grouped).map(([productId, data]) => {
    const sortedDates = data.dates.sort();
    const firstDate   = new Date(sortedDates[0]);
    const lastDate    = new Date(sortedDates[sortedDates.length - 1]);
    const daySpan     = Math.max(1, Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1);
    return {
      productId,
      totalQuantity:  data.totalQuantity,
      totalRevenue:   data.totalRevenue,
      firstSaleDate:  sortedDates[0],
      lastSaleDate:   sortedDates[sortedDates.length - 1],
      avgDailySales:  parseFloat((data.totalQuantity / daySpan).toFixed(2)),
    };
  });

  res.json(summary);
});

// ── VENDORS ───────────────────────────────────────────────────────────────────

// FIX: /api/vendors now requires admin JWT
app.get("/api/vendors", verifyToken, requireRole("admin"), (req, res) => {
  const db = readDB();
  res.json(db.vendors);
});

// Legacy vendor registration (kept for backward compat — prefer /api/auth/register)
app.post("/api/vendors/register", async (req, res) => {
  const { name, storeName, email, password } = req.body;
  const db = readDB();
  if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ message: "Account already exists." });

  const passwordHash = await bcrypt.hash(password || "password123", 12);
  const logo         = storeName.split(" ").map((w) => w[0]).join("").toUpperCase().substring(0, 2);
  const newVendor    = {
    id: `v-${randomUUID().slice(0, 8)}`, name, storeName, email,
    joinedDate: new Date().toISOString().split("T")[0],
    logo, rating: 0.0, status: "Pending Approval",
    revenue: 0, balance: 0, itemsFulfilled: 0, returnRate: "0%",
  };
  db.vendors.push(newVendor);
  db.stats.pendingVendors = (db.stats.pendingVendors || 0) + 1;

  const newUser = {
    id: `user-${randomUUID()}`, name, email: email.toLowerCase(),
    passwordHash, role: "vendor", vendorId: newVendor.id,
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: "vendor", vendorId: newVendor.id },
    JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }
  );
  return res.status(201).json({ message: "Vendor registered successfully", vendorId: newVendor.id, token });
});

// FIX: vendor approval route requires admin JWT (already was, but now explicit)
app.post("/api/vendors/:id/approval", verifyToken, requireRole("admin"), (req, res) => {
  const db     = readDB();
  const vendor = db.vendors.find((v) => v.id === req.params.id);
  if (!vendor) return res.status(404).json({ message: "Vendor not found." });

  const oldStatus = vendor.status;
  vendor.status   = req.body.status;

  if (oldStatus === "Pending Approval") {
    db.stats.pendingVendors = Math.max(0, (db.stats.pendingVendors || 0) - 1);
    if (req.body.status === "Approved") db.stats.activeVendors = (db.stats.activeVendors || 0) + 1;
  } else if (oldStatus === "Approved" && req.body.status === "Rejected") {
    db.stats.activeVendors = Math.max(0, (db.stats.activeVendors || 0) - 1);
  }

  writeDB(db);
  res.json({ message: `Vendor status set to ${req.body.status}`, vendor });
});

// ── ADMIN STATS ───────────────────────────────────────────────────────────────

// FIX: Both admin routes properly require JWT + admin role
app.get("/api/admin/stats", verifyToken, requireRole("admin"), (req, res) => {
  res.json(readDB().stats);
});

app.post("/api/admin/commission", verifyToken, requireRole("admin"), (req, res) => {
  const db = readDB();
  const rate = parseFloat(req.body.rate);
  if (isNaN(rate) || rate < 0 || rate > 100)
    return res.status(400).json({ message: "rate must be a number between 0 and 100." });
  db.stats.commissionRate   = rate;
  db.stats.totalCommission  = Math.round(db.stats.gmv * (rate / 100));
  writeDB(db);
  res.json({ message: "Commission rate updated", stats: db.stats });
});

// ── CART ──────────────────────────────────────────────────────────────────────

const ensureCarts = (db) => { if (!db.carts) db.carts = {}; return db; };
const getUserCart = (db, userId) => {
  ensureCarts(db);
  if (!db.carts[userId]) db.carts[userId] = { userId, items: [], updatedAt: new Date().toISOString() };
  return db.carts[userId];
};

app.get("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const db   = readDB();
  const cart = getUserCart(db, req.user.id);
  return res.json(cart);
});

app.put("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) return res.status(400).json({ message: "'items' must be an array." });

  const sanitised = [];
  for (const item of items) {
    if (!item.id || typeof item.quantity !== "number") continue;
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty === 0) continue;
    sanitised.push({
      id: String(item.id), name: String(item.name || ""), price: Number(item.price || 0),
      image: String(item.image || ""), category: String(item.category || ""),
      stock: Number(item.stock || 0), vendorId: String(item.vendorId || ""), quantity: qty,
    });
  }

  const db   = readDB();
  const cart = getUserCart(db, req.user.id);
  cart.items     = sanitised;
  cart.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json(cart);
});

app.post("/api/cart/items", verifyToken, requireRole("customer"), (req, res) => {
  const { id, name, price, image, category, stock, vendorId, quantity = 1 } = req.body;
  if (!id) return res.status(400).json({ message: "Product 'id' is required." });

  const qty     = Math.max(1, Math.floor(Number(quantity)));
  const db      = readDB();
  const cart    = getUserCart(db, req.user.id);
  const product = db.products.find((p) => p.id === id);
  const stockLimit = product ? product.stock : (Number(stock) || Infinity);

  const existing = cart.items.find((i) => i.id === id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, stockLimit);
  } else {
    cart.items.push({
      id: String(id), name: String(name || product?.name || ""),
      price: Number(price || product?.price || 0), image: String(image || product?.image || ""),
      category: String(category || product?.category || ""), stock: Number(stockLimit),
      vendorId: String(vendorId || product?.vendorId || ""), quantity: qty,
    });
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.status(201).json(cart);
});

app.patch("/api/cart/items/:id", verifyToken, requireRole("customer"), (req, res) => {
  const productId = req.params.id;
  const qty       = Math.max(0, Math.floor(Number(req.body.quantity)));
  const db        = readDB();
  const cart      = getUserCart(db, req.user.id);
  const idx       = cart.items.findIndex((i) => i.id === productId);
  if (idx === -1) return res.status(404).json({ message: "Item not found in cart." });

  if (qty === 0) {
    cart.items.splice(idx, 1);
  } else {
    const product    = db.products.find((p) => p.id === productId);
    const stockLimit = product ? product.stock : Infinity;
    cart.items[idx].quantity = Math.min(qty, stockLimit);
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json(cart);
});

app.delete("/api/cart/items/:id", verifyToken, requireRole("customer"), (req, res) => {
  const productId = req.params.id;
  const db        = readDB();
  const cart      = getUserCart(db, req.user.id);
  const before    = cart.items.length;
  cart.items      = cart.items.filter((i) => i.id !== productId);
  if (cart.items.length === before) return res.status(404).json({ message: "Item not found in cart." });
  cart.updatedAt  = new Date().toISOString();
  writeDB(db);
  return res.json(cart);
});

app.delete("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const db   = readDB();
  const cart = getUserCart(db, req.user.id);
  cart.items     = [];
  cart.updatedAt = new Date().toISOString();
  writeDB(db);
  return res.json({ message: "Cart cleared.", cart });
});

// ── START ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`✅ SmartMarketAI server running at http://localhost:${PORT}`);
  console.log(`   CORS origin: ${FRONTEND_ORIGIN}`);
});