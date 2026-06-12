import { readDB, writeDB, recordSalesHistory } from "./json-adapter.js";

/**
 * DB Abstraction Layer
 * Makes it easier to swap out db.json for MongoDB Atlas in the future.
 */

const collectionMethods = (collectionName) => ({
  find: (queryFn) => {
    const db = readDB();
    if (!queryFn) return db[collectionName] || [];
    return (db[collectionName] || []).filter(queryFn);
  },
  findOne: (queryFn) => {
    const db = readDB();
    return (db[collectionName] || []).find(queryFn);
  },
  findById: (id) => {
    const db = readDB();
    return (db[collectionName] || []).find((item) => item.id === id);
  },
  findIndex: (queryFn) => {
    const db = readDB();
    return (db[collectionName] || []).findIndex(queryFn);
  },
  create: (item) => {
    const db = readDB();
    if (!db[collectionName]) db[collectionName] = [];
    db[collectionName].push(item);
    writeDB(db);
    return item;
  },
  update: (id, updates) => {
    const db = readDB();
    const idx = (db[collectionName] || []).findIndex((item) => item.id === id);
    if (idx === -1) return null;
    db[collectionName][idx] = { ...db[collectionName][idx], ...updates };
    writeDB(db);
    return db[collectionName][idx];
  },
  delete: (id) => {
    const db = readDB();
    const idx = (db[collectionName] || []).findIndex((item) => item.id === id);
    if (idx === -1) return null;
    const [deleted] = db[collectionName].splice(idx, 1);
    writeDB(db);
    return deleted;
  }
});

export const db = {
  users: collectionMethods("users"),
  vendors: collectionMethods("vendors"),
  products: collectionMethods("products"),
  orders: collectionMethods("orders"),
  salesHistory: collectionMethods("salesHistory"),

  carts: {
    get: (userId) => {
      const dbInstance = readDB();
      if (!dbInstance.carts) dbInstance.carts = {};
      if (!dbInstance.carts[userId]) {
        dbInstance.carts[userId] = { userId, items: [], updatedAt: new Date().toISOString() };
        writeDB(dbInstance);
      }
      return dbInstance.carts[userId];
    },
    set: (userId, cartData) => {
      const dbInstance = readDB();
      if (!dbInstance.carts) dbInstance.carts = {};
      dbInstance.carts[userId] = cartData;
      writeDB(dbInstance);
      return cartData;
    },
    clear: (userId) => {
      const dbInstance = readDB();
      if (!dbInstance.carts) dbInstance.carts = {};
      const cart = { userId, items: [], updatedAt: new Date().toISOString() };
      dbInstance.carts[userId] = cart;
      writeDB(dbInstance);
      return cart;
    }
  },

  stats: {
    get: () => {
      const dbInstance = readDB();
      return dbInstance.stats || { gmv: 0, commissionRate: 10, totalCommission: 0, activeVendors: 0, pendingVendors: 0 };
    },
    update: (updates) => {
      const dbInstance = readDB();
      if (!dbInstance.stats) dbInstance.stats = { gmv: 0, commissionRate: 10, totalCommission: 0, activeVendors: 0, pendingVendors: 0 };
      dbInstance.stats = { ...dbInstance.stats, ...updates };
      writeDB(dbInstance);
      return dbInstance.stats;
    }
  },

  raw: {
    read: readDB,
    write: writeDB,
    recordSalesHistory: (order) => {
      const dbInstance = readDB();
      recordSalesHistory(dbInstance, order);
      writeDB(dbInstance);
    }
  }
};
