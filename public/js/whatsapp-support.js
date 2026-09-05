(() => {
  "use strict";

  const BUSINESS_NUMBER = "919666337370";
  const state = { orderId: "", productName: "" };

  function clean(value, max = 120) {
    return String(value || "").replace(/\s+/g, " ").replace(/[<>]/g, "").trim().slice(0, max);
  }

  function validOrderId(value) {
    const id = clean(value, 50).toUpperCase();
    return /^[A-Z0-9][A-Z0-9-]{3,49}$/.test(id) ? id : "";
  }

  function pageFile() {
    return (location.pathname.split("/").pop() || "index.html").toLowerCase();
  }

  function safeTitle() {
    return clean(document.title.split("|")[0], 80) || "ApnaFinds";
  }

  function renderedProductName() {
    if (state.productName) return state.productName;
    for (const selector of ["[data-product-name]", "#productName", ".product-title", "main h1"]) {
      const node = document.querySelector(selector);
      const value = clean(node?.textContent, 100);
      if (value) return value;
    }
    return "";
  }

  function renderedOrderId() {
    if (state.orderId) return state.orderId;
    const query = new URLSearchParams(location.search);
    const fromUrl = validOrderId(query.get("orderId") || query.get("order"));
    if (fromUrl) return fromUrl;
    for (const selector of ["[data-order-id]", "#orderId", "#orderNumber", ".order-id", ".order-number"]) {
      const node = document.querySelector(selector);
      const own = validOrderId(node?.dataset?.orderId || node?.textContent);
      if (own) return own;
    }
    return "";
  }

  function requestForPage(serviceOverride) {
    const page = pageFile();
    if (serviceOverride) return serviceOverride;
    if (page === "thankyou.html") return "Order assistance";
    if (page === "track-order.html") return "Track order";
    if (page === "invoice.html") return "Invoice";
    if (["return.html", "returns.html", "returns-center.html"].includes(page)) return "Return";
    if (page === "refund.html") return "Refund";
    if (page === "cart.html") return "Cart assistance";
    if (page === "checkout.html") return "Checkout assistance";
    if (page === "account.html") return "Account help";
    if (page === "login.html") return "Sign-in help";
    if (page === "register.html") return "Account registration help";
    if (page === "forgot-password.html") return "Password reset help";
    if (page === "product.html") return "Product help";
    return safeTitle();
  }

  function message(serviceOverride) {
    const request = requestForPage(serviceOverride);
    const orderId = renderedOrderId();
    const productName = renderedProductName();
    if (request === "Product help") {
      return productName
        ? `Hello ApnaFinds Support, I need help with product ${productName}. Request: Product help.`
        : "Hello ApnaFinds Support, I need help with a product. Request: Product help.";
    }
    if (["Order assistance", "Track order", "Invoice", "Return", "Refund", "Cancellation"].includes(request)) {
      return orderId
        ? `Hello ApnaFinds Support, I need help with order ${orderId}. Request: ${request}.`
        : `Hello ApnaFinds Support, I need help with an order. Request: ${request}.`;
    }
    if (request === "Cart assistance") return "Hello ApnaFinds Support, I need help with my cart.";
    if (request === "Checkout assistance") return "Hello ApnaFinds Support, I need help completing my checkout.";
    if (request === "Account help") return "Hello ApnaFinds Support, I need help with my account.";
    if (request === "Sign-in help") return "Hello ApnaFinds Support, I need help signing in.";
    if (request === "Account registration help") return "Hello ApnaFinds Support, I need help creating an account.";
    if (request === "Password reset help") return "Hello ApnaFinds Support, I need help resetting my password.";
    return `Hello ApnaFinds Support, I need help regarding ${request}.`;
  }

  function buildUrl(serviceOverride) {
    return `https://wa.me/${BUSINESS_NUMBER}?text=${encodeURIComponent(message(serviceOverride))}`;
  }

  function updateLink(link) {
    const service = clean(link.dataset.whatsappService, 40);
    link.href = buildUrl(service);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  function refresh() {
    document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"], [data-apnafinds-whatsapp]').forEach(updateLink);
  }

  function addFloatingButton() {
    if (document.querySelector("[data-apnafinds-whatsapp-floating]")) return;
    const link = document.createElement("a");
    link.dataset.apnafindsWhatsapp = "true";
    link.dataset.apnafindsWhatsappFloating = "true";
    link.setAttribute("aria-label", "Chat with ApnaFinds Support on WhatsApp");
    link.innerHTML = '<i class="fa-brands fa-whatsapp" aria-hidden="true"></i><span>Support</span>';
    Object.assign(link.style, {position:"fixed",right:"18px",bottom:"18px",zIndex:"9998",display:"flex",alignItems:"center",gap:"9px",padding:"13px 17px",borderRadius:"999px",background:"#16a34a",color:"#fff",fontWeight:"800",fontSize:"14px",textDecoration:"none",boxShadow:"0 12px 30px rgba(0,0,0,.22)"});
    document.body.appendChild(link);
    updateLink(link);
  }

  function setOrderContext(value) { state.orderId = validOrderId(value); refresh(); }
  function setProductContext(value) { state.productName = clean(value, 100); refresh(); }

  window.ApnaFindsWhatsApp = { buildUrl, message, refresh, setOrderContext, setProductContext, validOrderId };
  function init() { refresh(); addFloatingButton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
