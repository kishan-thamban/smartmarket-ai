/**
 * src/data/mockData.js
 *
 * Static fallback data used by AdminDashboard and CustomerMarketplace
 * when the backend API is unavailable (network error, dev without server, etc.).
 *
 * Fixes: "Cannot resolve module '../data/mockData'" runtime crash.
 */

// ── Vendors ───────────────────────────────────────────────────────────────────

export const INITIAL_VENDORS = [
  {
    id: "v-01",
    name: "Priya Sharma",
    storeName: "Kirana Plus",
    email: "priya@kiranaplus.com",
    joinedDate: "2024-01-12",
    logo: "KP",
    rating: 4.8,
    status: "Approved",
    revenue: 452000,
    balance: 412000,
    itemsFulfilled: 342,
    returnRate: "1.2%",
  },
  {
    id: "v-02",
    name: "Arjun Mehta",
    storeName: "UrbanCraft Textiles",
    email: "arjun@urbancraft.in",
    joinedDate: "2024-02-18",
    logo: "UC",
    rating: 4.9,
    status: "Approved",
    revenue: 892000,
    balance: 785000,
    itemsFulfilled: 681,
    returnRate: "0.8%",
  },
  {
    id: "v-03",
    name: "Divya Nair",
    storeName: "ThreadHouse Clothing",
    email: "divya@threadhouse.com",
    joinedDate: "2024-03-01",
    logo: "TH",
    rating: 4.7,
    status: "Approved",
    revenue: 298000,
    balance: 242000,
    itemsFulfilled: 219,
    returnRate: "2.1%",
  },
  {
    id: "v-04",
    name: "Rajesh Kumar",
    storeName: "Organic Harvests",
    email: "rajesh@organicharvests.com",
    joinedDate: "2024-05-15",
    logo: "OH",
    rating: 4.5,
    status: "Pending Approval",
    revenue: 0,
    balance: 0,
    itemsFulfilled: 0,
    returnRate: "0%",
  },
  {
    id: "v-05",
    name: "Siddharth Rao",
    storeName: "EcoWear Labs",
    email: "sid@ecowear.com",
    joinedDate: "2024-06-01",
    logo: "EW",
    rating: 0,
    status: "Pending Approval",
    revenue: 0,
    balance: 0,
    itemsFulfilled: 0,
    returnRate: "0%",
  },
];

// ── Products ──────────────────────────────────────────────────────────────────

export const INITIAL_PRODUCTS = [
  {
    id: "p-01",
    name: "Premium Linen Summer Dress",
    category: "Apparel",
    description: "Ethically sourced, 100% pure organic linen summer dress.",
    price: 3499,
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-02",
    stock: 65,
    reorderThreshold: 20,
    salesVelocity: 3.5,
    ratings: 4.8,
    reviews: [
      { id: "r-1", user: "Karan J.", rating: 5, comment: "Absolutely love the fabric!" },
      { id: "r-2", user: "Riya S.", rating: 4, comment: "Fits perfectly. Great for summer." },
    ],
  },
  {
    id: "p-02",
    name: "Handmade Ceramic Serving Bowl",
    category: "Home & Kitchen",
    description: "Stone-fired, double-glazed ceramic bowl crafted by local artisans.",
    price: 1899,
    image:
      "https://images.unsplash.com/photo-1576016770956-debb63d90029?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-02",
    stock: 12,
    reorderThreshold: 15,
    salesVelocity: 1.8,
    ratings: 4.9,
    reviews: [{ id: "r-3", user: "Nisha P.", rating: 5, comment: "A beautiful addition to my dining table." }],
  },
  {
    id: "p-03",
    name: "Cold-Pressed Virgin Coconut Oil",
    category: "Organic Food",
    description: "100% natural, unrefined coconut oil extracted from fresh organic coconuts.",
    price: 499,
    image:
      "https://images.unsplash.com/photo-1622484211148-717df9d14677?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-01",
    stock: 120,
    reorderThreshold: 30,
    salesVelocity: 6.2,
    ratings: 4.7,
    reviews: [
      { id: "r-4", user: "Vikram V.", rating: 5, comment: "Smells so fresh." },
      { id: "r-5", user: "Meera N.", rating: 4, comment: "Excellent oil." },
    ],
  },
  {
    id: "p-04",
    name: "Handwoven Bamboo Fruit Basket",
    category: "Home & Kitchen",
    description: "Meticulously woven from organic bamboo fibers.",
    price: 899,
    image:
      "https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-01",
    stock: 8,
    reorderThreshold: 10,
    salesVelocity: 1.1,
    ratings: 4.6,
    reviews: [{ id: "r-6", user: "Amit S.", rating: 5, comment: "Extremely lightweight and sturdy." }],
  },
  {
    id: "p-05",
    name: "Organic Sage Infused Tea",
    category: "Organic Food",
    description: "Sun-dried sage leaves blended with fine Darjeeling loose-leaf tea.",
    price: 349,
    image:
      "https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-01",
    stock: 240,
    reorderThreshold: 50,
    salesVelocity: 8.5,
    ratings: 4.4,
    reviews: [],
  },
  {
    id: "p-06",
    name: "Minimalist Linen Trousers",
    category: "Apparel",
    description: "Calm beige relaxed fit drawstring linen trousers.",
    price: 2799,
    image:
      "https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=500&auto=format&fit=crop&q=80",
    vendorId: "v-03",
    stock: 35,
    reorderThreshold: 15,
    salesVelocity: 2.1,
    ratings: 4.8,
    reviews: [{ id: "r-7", user: "Samir K.", rating: 5, comment: "Insanely comfortable." }],
  },
];

// ── Platform Stats ────────────────────────────────────────────────────────────

export const PLATFORM_STATS = {
  gmv:            1642000,
  commissionRate: 10,
  totalCommission: 164200,
  activeVendors:  3,
  pendingVendors: 2,
};