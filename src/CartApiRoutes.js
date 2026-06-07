/**
 * CART API ROUTES
 * ═══════════════════════════════════════════════════════════════════════════
 * Drop these routes into server.js just before the app.listen() call.
 *
 * Cart is stored per-user in db.json under db.carts:
 *   {
 *     "carts": {
 *       "<userId>": {
 *         "userId": "user-123",
 *         "items": [
 *           {
 *             "id":       "p-001",
 *             "name":    "Product Name",
 *             "price":   499,
 *             "image":   "https://...",
 *             "category":"Electronics",
 *             "stock":   50,
 *             "vendorId":"v-01",
 *             "quantity": 2
 *           }
 *         ],
 *         "updatedAt": "2024-01-15T10:30:00.000Z"
 *       }
 *     }
 *   }
 *
 * Endpoints
 * ─────────
 *  GET    /api/cart              → fetch current user's cart
 *  PUT    /api/cart              → replace entire cart (full sync from client)
 *  POST   /api/cart/items        → add / increment one item
 *  PATCH  /api/cart/items/:id    → set absolute quantity for one item
 *  DELETE /api/cart/items/:id    → remove one item
 *  DELETE /api/cart              → clear entire cart
 */

// ── DB Migration: ensure carts map exists ─────────────────────────────────────

const ensureCarts = (db) => {
  if (!db.carts) db.carts = {};
  return db;
};

const getUserCart = (db, userId) => {
  ensureCarts(db);
  if (!db.carts[userId]) {
    db.carts[userId] = { userId, items: [], updatedAt: new Date().toISOString() };
  }
  return db.carts[userId];
};

// ── GET /api/cart ─────────────────────────────────────────────────────────────
// Returns the authenticated customer's current cart.

app.get("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const db   = readDB();
  const cart = getUserCart(db, req.user.id);
  return res.json(cart);
});

// ── PUT /api/cart ─────────────────────────────────────────────────────────────
// Full cart replace — client sends its complete local cart; server persists it.
// Body: { items: [ { id, name, price, image, category, stock, vendorId, quantity } ] }

app.put("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const { items } = req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ message: "'items' must be an array." });
  }

  // Validate & sanitise each item
  const sanitised = [];
  for (const item of items) {
    if (!item.id || typeof item.quantity !== "number") continue;
    const qty = Math.max(0, Math.floor(item.quantity));
    if (qty === 0) continue; // skip zero-qty items

    sanitised.push({
      id:       String(item.id),
      name:     String(item.name     || ""),
      price:    Number(item.price    || 0),
      image:    String(item.image    || ""),
      category: String(item.category || ""),
      stock:    Number(item.stock    || 0),
      vendorId: String(item.vendorId || ""),
      quantity: qty,
    });
  }

  const db   = readDB();
  const cart = getUserCart(db, req.user.id);
  cart.items     = sanitised;
  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.json(cart);
});

// ── POST /api/cart/items ──────────────────────────────────────────────────────
// Add a product to cart or increment its quantity.
// Body: { id, name, price, image, category, stock, vendorId, quantity? }

app.post("/api/cart/items", verifyToken, requireRole("customer"), (req, res) => {
  const { id, name, price, image, category, stock, vendorId, quantity = 1 } = req.body;

  if (!id) return res.status(400).json({ message: "Product 'id' is required." });

  const qty = Math.max(1, Math.floor(Number(quantity)));

  const db   = readDB();
  const cart = getUserCart(db, req.user.id);

  // Check if product exists in DB (optional — keeps cart consistent)
  const product = db.products.find((p) => p.id === id);
  const stockLimit = product ? product.stock : (stock || Infinity);

  const existing = cart.items.find((i) => i.id === id);
  if (existing) {
    existing.quantity = Math.min(existing.quantity + qty, stockLimit);
  } else {
    cart.items.push({
      id:       String(id),
      name:     String(name     || product?.name     || ""),
      price:    Number(price    || product?.price    || 0),
      image:    String(image    || product?.image    || ""),
      category: String(category || product?.category || ""),
      stock:    Number(stockLimit),
      vendorId: String(vendorId || product?.vendorId || ""),
      quantity: qty,
    });
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.status(201).json(cart);
});

// ── PATCH /api/cart/items/:id ─────────────────────────────────────────────────
// Set absolute quantity for a specific item. qty=0 removes the item.
// Body: { quantity: number }

app.patch("/api/cart/items/:id", verifyToken, requireRole("customer"), (req, res) => {
  const productId = req.params.id;
  const qty       = Math.max(0, Math.floor(Number(req.body.quantity)));

  const db   = readDB();
  const cart = getUserCart(db, req.user.id);

  const idx = cart.items.findIndex((i) => i.id === productId);

  if (idx === -1) {
    return res.status(404).json({ message: "Item not found in cart." });
  }

  if (qty === 0) {
    cart.items.splice(idx, 1);
  } else {
    // Honour stock limit
    const product    = db.products.find((p) => p.id === productId);
    const stockLimit = product ? product.stock : Infinity;
    cart.items[idx].quantity = Math.min(qty, stockLimit);
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.json(cart);
});

// ── DELETE /api/cart/items/:id ────────────────────────────────────────────────
// Remove a single item from cart.

app.delete("/api/cart/items/:id", verifyToken, requireRole("customer"), (req, res) => {
  const productId = req.params.id;

  const db   = readDB();
  const cart = getUserCart(db, req.user.id);

  const before = cart.items.length;
  cart.items   = cart.items.filter((i) => i.id !== productId);

  if (cart.items.length === before) {
    return res.status(404).json({ message: "Item not found in cart." });
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.json(cart);
});

// ── DELETE /api/cart ──────────────────────────────────────────────────────────
// Clear the entire cart.

app.delete("/api/cart", verifyToken, requireRole("customer"), (req, res) => {
  const db   = readDB();
  const cart = getUserCart(db, req.user.id);

  cart.items     = [];
  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  return res.json({ message: "Cart cleared.", cart });
});