import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DB_FILE    = path.join(__dirname, "..", "db.json");

export const readDB = () => {
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

export const writeDB = (data) => {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Helper for sales history since it modifies both history and items
export const recordSalesHistory = (db, order) => {
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
