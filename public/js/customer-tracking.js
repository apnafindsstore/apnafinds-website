(() => {
  "use strict";

  const ORDER_KEYS = [
    "apnafinds_orders",
    "orders",
    "orderHistory"
  ];

  const STAGES = [
    {
      key: "order placed",
      label: "Order placed",
      description: "We received your order."
    },
    {
      key: "confirmed",
      label: "Confirmed",
      description: "Your order was confirmed."
    },
    {
      key: "packed",
      label: "Packed",
      description: "Your items are being prepared."
    },
    {
      key: "shipped",
      label: "Shipped",
      description: "The courier has your package."
    },
    {
      key: "in transit",
      label: "In transit",
      description: "Your package is moving through the courier network."
    },
    {
      key: "out for delivery",
      label: "Out for delivery",
      description: "The courier is delivering your package today."
    },
    {
      key: "delivered",
      label: "Delivered",
      description: "Your package was delivered."
    }
  ];

  const elements = {
    form: document.getElementById("trackForm"),
    orderId: document.getElementById("orderIdInput"),
    contact: document.getElementById("contactInput"),
    trackButton: document.getElementById("trackButton"),
    refreshButton: document.getElementById("refreshTrackingButton"),
    cancelButton: document.getElementById("cancelOrderButton"),
    returnLink: document.getElementById("returnOrderLink"),
    result: document.getElementById("orderResult"),
    notFound: document.getElementById("notFoundResult"),
    message: document.getElementById("messageBox"),
    warning: document.getElementById("fileWarning"),
    serverStatus: document.getElementById("serverStatus"),
    serverDot: document.getElementById("serverDot"),
    timeline: document.getElementById("timeline"),
    toast: document.getElementById("toast"),
    menuButton: document.getElementById("menuButton"),
    mobileMenu: document.getElementById("mobileMenu")
  };

  let activeBundle = null;
  let toastTimer = null;

  function safeArray(key) {
    try {
      const parsed = JSON.parse(
        localStorage.getItem(key) || "[]"
      );

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function allLocalOrders() {
    const map = new Map();

    for (const key of ORDER_KEYS) {
      for (const order of safeArray(key)) {
        const id = getOrderId(order);

        if (id) {
          map.set(id.toUpperCase(), order);
        }
      }
    }

    return Array.from(map.values());
  }

  function getOrderId(order) {
    return String(
      order?.id ||
      order?.orderId ||
      order?.number ||
      ""
    ).trim();
  }

  function normalizeContact(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function matchesContact(order, contact) {
    const expected = normalizeContact(contact);

    const values = [
      order.phone,
      order.mobile,
      order.email,
      order.customerEmail,
      order.shippingAddress?.phone,
      order.customer?.phone,
      order.customer?.email
    ].map(normalizeContact).filter(Boolean);

    return values.includes(expected);
  }

  function localOrder(orderId, contact) {
    const id = String(orderId || "").trim().toUpperCase();

    return allLocalOrders().find(order => {
      return getOrderId(order).toUpperCase() === id &&
        matchesContact(order, contact);
    }) || null;
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }

  function setBusy(button, busy, label = "Working…") {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.classList.add("loading");
      button.innerHTML = `<i class="fa-solid fa-spinner"></i>${escapeHTML(label)}`;
    } else {
      button.disabled = false;
      button.classList.remove("loading");

      if (button.dataset.original) {
        button.innerHTML = button.dataset.original;
        delete button.dataset.original;
      }
    }
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => elements.toast.classList.remove("show"),
      2600
    );
  }

  function showMessage(message, type = "error") {
    elements.message.className = `message-box ${type}`;
    elements.message.textContent = message;
  }

  function clearMessage() {
    elements.message.className = "message-box hidden";
    elements.message.textContent = "";
  }

  function setServer(status, text) {
    elements.serverDot.className = `server-dot ${status}`;
    elements.serverStatus.textContent = text;
  }

  async function checkServer() {
    if (window.location.protocol === "file:") {
      elements.warning.classList.remove("hidden");
      setServer("offline", "Open through localhost:3000");
      return false;
    }

    try {
      const result = await window.ApnaFindsAPI.health();
      const mode = String(
        result.provider?.mode ||
        "demo"
      ).toUpperCase();

      setServer(
        "online",
        `Online · ${mode} logistics`
      );

      return true;
    } catch {
      setServer("offline", "Server is not running");
      return false;
    }
  }

  function getStatus(order, shipment) {
    return String(
      shipment?.customerStatus ||
      shipment?.status ||
      order?.status ||
      "Order placed"
    );
  }

  function statusStageIndex(status) {
    const value = String(status || "").toLowerCase();

    if (value.includes("cancel")) {
      return -1;
    }

    if (value.includes("deliver") && !value.includes("out")) {
      return 6;
    }

    if (value.includes("out for delivery")) {
      return 5;
    }

    if (value.includes("transit")) {
      return 4;
    }

    if (value.includes("ship") || value.includes("pickup")) {
      return 3;
    }

    if (value.includes("pack")) {
      return 2;
    }

    if (value.includes("confirm") || value.includes("book")) {
      return 1;
    }

    return 0;
  }

  function trackingEventFor(stage, events) {
    const keys = [
      stage.key,
      stage.label.toLowerCase()
    ];

    return events.find(event => {
      const value = String(
        event.status ||
        event.activity ||
        ""
      ).toLowerCase();

      return keys.some(key => value.includes(key));
    });
  }

  function renderTimeline(status, shipment) {
    const currentIndex = statusStageIndex(status);
    const events = Array.isArray(shipment?.trackingEvents)
      ? shipment.trackingEvents
      : [];

    if (currentIndex < 0) {
      elements.timeline.innerHTML = `
        <div class="timeline-item current">
          <span class="timeline-marker">
            <i class="fa-solid fa-ban"></i>
          </span>
          <div class="timeline-copy">
            <h3>Order cancelled</h3>
            <p>This order is no longer being processed.</p>
          </div>
        </div>
      `;
      return;
    }

    elements.timeline.innerHTML = STAGES.map((stage, index) => {
      const done = index <= currentIndex;
      const current = index === currentIndex;
      const event = trackingEventFor(stage, events);

      return `
        <div class="timeline-item ${done ? "done" : ""} ${current ? "current" : ""}">
          <span class="timeline-marker">
            <i class="fa-solid ${done ? "fa-check" : "fa-circle"}"></i>
          </span>
          <div class="timeline-copy">
            <h3>${escapeHTML(stage.label)}</h3>
            <p>${escapeHTML(event?.activity || stage.description)}</p>
            ${
              event?.date
                ? `<time>${escapeHTML(formatDate(event.date))}</time>`
                : ""
            }
          </div>
        </div>
      `;
    }).join("");
  }

  function normalizeItems(order) {
    const items = Array.isArray(order.items)
      ? order.items
      : Array.isArray(order.cart)
        ? order.cart
        : [];

    return items.map(item => ({
      name: String(
        item.name ||
        item.title ||
        "Product"
      ),
      quantity: Math.max(
        1,
        Number(item.quantity || item.qty || 1)
      ),
      price: Number(
        item.price ||
        item.salePrice ||
        0
      ),
      image: String(
        item.image ||
        item.imageUrl ||
        "images/products/apnafinds-product.svg"
      )
    }));
  }

  function getTotals(order, items) {
    const subtotal =
      Number(order.subtotal) ||
      items.reduce(
        (sum, item) =>
          sum + item.price * item.quantity,
        0
      );

    const discount = Math.max(
      0,
      Number(order.discount || 0)
    );

    const shipping = Math.max(
      0,
      Number(order.shipping || order.shippingFee || 0)
    );

    const total =
      Number(order.total || order.orderTotal) ||
      Math.max(0, subtotal - discount + shipping);

    return {
      subtotal,
      discount,
      shipping,
      total
    };
  }

  function renderBundle(bundle) {
    const order = bundle.order || bundle;
    const shipment = bundle.shipment || order.shipment || null;
    const id = getOrderId(order);
    const status = getStatus(order, shipment);
    const items = normalizeItems(order);
    const totals = getTotals(order, items);
    const contact = String(
      order.phone ||
      order.email ||
      order.shippingAddress?.phone ||
      elements.contact.value
    );
    const address = order.shippingAddress || {};

    activeBundle = {
      order,
      shipment,
      returns: bundle.returns || []
    };

    elements.result.classList.remove("hidden");
    elements.notFound.classList.add("hidden");
    clearMessage();

    document.getElementById("resultStatus").textContent = status;
    document.getElementById("resultStatusBadge").textContent = status;
    document.getElementById("resultOrderId").textContent = id || "—";
    document.getElementById("resultCourier").textContent =
      shipment?.courier || order.courier || "Not assigned";
    document.getElementById("resultAwb").textContent =
      shipment?.awb || order.awb || "Not generated";
    document.getElementById("resultEta").textContent =
      shipment?.estimatedDelivery ||
      order.estimatedDelivery ||
      "Will be updated";

    document.getElementById("resultCustomer").textContent =
      order.customerName ||
      order.name ||
      address.name ||
      "Customer";

    document.getElementById("resultContact").textContent =
      [
        order.phone || address.phone || "",
        order.email || ""
      ].filter(Boolean).join("\n") || "—";

    document.getElementById("resultAddress").textContent =
      [
        address.address || address.line1 || order.address || "",
        address.landmark || "",
        [address.city || order.city, address.state || order.state]
          .filter(Boolean)
          .join(", "),
        address.pincode || order.pincode || ""
      ].filter(Boolean).join("\n") || "Address unavailable";

    document.getElementById("resultPayment").textContent =
      [
        order.paymentMethod || order.payment || "COD",
        order.paymentStatus
          ? `(${order.paymentStatus})`
          : ""
      ].filter(Boolean).join(" ");

    document.getElementById("resultItems").innerHTML =
      items.length
        ? items.map(item => `
          <article class="order-item">
            <img
              src="${escapeHTML(item.image)}"
              alt="${escapeHTML(item.name)}"
              onerror="this.src='images/products/apnafinds-product.svg'"
            >
            <div>
              <strong>${escapeHTML(item.name)}</strong>
              <small>Quantity: ${item.quantity}</small>
            </div>
            <span class="price">${money(item.price * item.quantity)}</span>
          </article>
        `).join("")
        : `<p class="message-box info">Item information is unavailable.</p>`;

    document.getElementById("resultItemCount").textContent =
      `${items.reduce((sum, item) => sum + item.quantity, 0)} items`;

    document.getElementById("resultSubtotal").textContent =
      money(totals.subtotal);
    document.getElementById("resultDiscount").textContent =
      `-${money(totals.discount)}`;
    document.getElementById("discountRow").classList.toggle(
      "hidden",
      totals.discount <= 0
    );
    document.getElementById("resultShipping").textContent =
      totals.shipping > 0
        ? money(totals.shipping)
        : "FREE";
    document.getElementById("resultTotal").textContent =
      money(totals.total);

    document.getElementById("invoiceLink").href =
      `invoice.html?order=${encodeURIComponent(id)}`;

    const returnUrl =
      `returns-center.html?order=${encodeURIComponent(id)}` +
      `&contact=${encodeURIComponent(contact)}`;

    elements.returnLink.href = returnUrl;

    const normalized = status.toLowerCase();
    const cancellable = [
      "order placed",
      "confirmed",
      "packed"
    ].includes(normalized);

    const returnable = normalized.includes("delivered");

    elements.cancelButton.classList.toggle(
      "hidden",
      !cancellable
    );

    elements.returnLink.classList.toggle(
      "hidden",
      !returnable
    );

    const supportText = encodeURIComponent(
      `Hello ApnaFinds, I need help with order ${id}.`
    );

    document.getElementById("whatsappLink").href =
      `https://wa.me/919666337370?text=${supportText}`;

    renderTimeline(status, shipment);

    window.scrollTo({
      top: elements.result.offsetTop - 90,
      behavior: "smooth"
    });
  }

  function saveLocalBundle(bundle) {
    const order = {
      ...bundle.order,
      shipment: bundle.shipment
    };
    const id = getOrderId(order);

    if (!id) {
      return;
    }

    const orders = safeArray("apnafinds_orders");
    const index = orders.findIndex(item => {
      return getOrderId(item).toUpperCase() === id.toUpperCase();
    });

    if (index >= 0) {
      orders[index] = {
        ...orders[index],
        ...order
      };
    } else {
      orders.unshift(order);
    }

    localStorage.setItem(
      "apnafinds_orders",
      JSON.stringify(orders)
    );
  }

  async function requestBundle(refresh = false) {
    const orderId = elements.orderId.value.trim();
    const contact = elements.contact.value.trim();

    if (!orderId || !contact) {
      throw new Error(
        "Enter the order ID and registered phone number or email."
      );
    }

    try {
      const bundle = refresh
        ? await window.ApnaFindsAPI.refreshOrderTracking(
            orderId,
            contact
          )
        : await window.ApnaFindsAPI.getOrder(
            orderId,
            contact
          );

      saveLocalBundle(bundle);
      return bundle;
    } catch (error) {
      const local = localOrder(orderId, contact);

      if (local) {
        showMessage(
          "The server could not be reached, so this is the latest order information saved in this browser.",
          "info"
        );

        return {
          order: local,
          shipment: local.shipment || null,
          returns: local.returns || []
        };
      }

      throw error;
    }
  }

  async function track(refresh = false) {
    setBusy(
      refresh ? elements.refreshButton : elements.trackButton,
      true,
      refresh ? "Refreshing…" : "Tracking…"
    );

    elements.notFound.classList.add("hidden");
    clearMessage();

    try {
      const bundle = await requestBundle(refresh);
      renderBundle(bundle);

      if (refresh) {
        showToast("Tracking refreshed.");
      }
    } catch (error) {
      elements.result.classList.add("hidden");
      elements.notFound.classList.remove("hidden");
      showMessage(error.message, "error");
    } finally {
      setBusy(
        refresh ? elements.refreshButton : elements.trackButton,
        false
      );
    }
  }

  async function cancelOrder() {
    if (!activeBundle?.order) {
      return;
    }

    const id = getOrderId(activeBundle.order);
    const contact = elements.contact.value.trim();

    if (!window.confirm(
      `Cancel order ${id}? This cannot be undone.`
    )) {
      return;
    }

    setBusy(elements.cancelButton, true, "Cancelling…");

    try {
      await window.ApnaFindsAPI.cancelOrder(id, contact);
      showToast("Order cancelled.");
      await track(false);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy(elements.cancelButton, false);
    }
  }


  async function pollActiveOrder() {
    if (
      !activeBundle?.order ||
      document.hidden ||
      window.location.protocol === "file:"
    ) {
      return;
    }

    const orderId = getOrderId(activeBundle.order);
    const contact = elements.contact.value.trim();

    if (!orderId || !contact) {
      return;
    }

    try {
      const previousStatus = getStatus(
        activeBundle.order,
        activeBundle.shipment
      );

      const bundle = await window.ApnaFindsAPI.getOrder(
        orderId,
        contact
      );

      const nextStatus = getStatus(
        bundle.order,
        bundle.shipment
      );

      saveLocalBundle(bundle);
      renderBundle(bundle);

      if (nextStatus !== previousStatus) {
        showToast(`Order updated: ${nextStatus}`);
      }
    } catch {
      // Keep the last successfully displayed tracking information.
    }
  }

  elements.form.addEventListener("submit", event => {
    event.preventDefault();
    track(false);
  });

  elements.refreshButton.addEventListener(
    "click",
    () => track(true)
  );

  elements.cancelButton.addEventListener(
    "click",
    cancelOrder
  );

  elements.menuButton.addEventListener("click", () => {
    elements.mobileMenu.classList.toggle("open");
  });

  const params = new URLSearchParams(
    window.location.search
  );

  const requestedOrder = params.get("order");
  const requestedContact = params.get("contact");

  if (requestedOrder) {
    elements.orderId.value = requestedOrder;
  }

  if (requestedContact) {
    elements.contact.value = requestedContact;
  }

  document.getElementById("currentYear").textContent =
    new Date().getFullYear();

  checkServer().then(() => {
    if (
      elements.orderId.value &&
      elements.contact.value
    ) {
      track(false);
    }
  });

  window.setInterval(
    pollActiveOrder,
    20000
  );
})();
