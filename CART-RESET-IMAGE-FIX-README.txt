APNAFINDS V8 — CART RESET AND IMAGE FIX
=========================================

- Product image console error fixed.
- Cart quantities stay the same during shopping, cart, checkout and COD advance.
- Cart resets to - 0 + only after the server confirms the completed order.
- Both cart storage keys are cleared.
- If order completion fails, the cart is kept for retry.
- Exact index.html remains unchanged.

Changed files:
public/js/products.js
public/cart.html
public/checkout.html
