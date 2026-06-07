/**
 * App.jsx (routing snippet)
 *
 * Add the /checkout route alongside your existing /cart route.
 * Example using react-router-dom v6:
 */

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./context/CartContext";
import CartPage     from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
// ... your other page imports

export default function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          {/* existing routes */}
          <Route path="/cart"     element={<CartPage />} />

          {/* NEW: full checkout flow */}
          <Route path="/checkout" element={<CheckoutPage />} />

          {/* ...other routes */}
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}