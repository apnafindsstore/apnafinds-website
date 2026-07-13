(() => {
  "use strict";

  const TOKEN_KEY = "apnafinds_admin_api_token";
  const THEME_KEY = "apnafinds_admin_theme";

  const elements = {
    tokenInput: document.getElementById("adminApiToken"),
    saveTokenButton: document.getElementById("saveAdminToken"),
    toggleTokenButton: document.getElementById("toggleTokenButton"),
    toggleTokenIcon: document.getElementById("toggleTokenIcon"),

    ordersBody: document.getElementById("ordersBody"),
    returnsBody: document.getElementById("returnsBody"),
    eventsList: document.getElementById("eventsList"),

    providerStatus: document.getElementById("providerStatus"),
    providerBadge: document.getElementById("providerBadge"),
    connectionState: document.getElementById("connectionState"),
    lastUpdated: document.getElementById("lastUpdated"),

    orderSearch: document.getElementById("orderSearch"),
    orderStatusFilter: document.getElementById("orderStatusFilter"),
    returnSearch: document.getElementById("returnSearch"),
    returnStatusFilter: document.getElementById("returnStatusFilter"),

    ordersResultCount: document.getElementById("ordersResultCount"),
    returnsResultCount: document.getElementById("returnsResultCount"),

    importButton: document.getElementById("importBrowserOrders"),
    runButton: document.getElementById("runAutomation"),
    refreshButton: document.getElementById("refreshDashboard"),

    toast: document.getElementById("logisticsToast"),
    toastIcon: document.getElementById("logisticsToastIcon"),
    toastText: document.getElementById("logisticsToastText"),

    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay"),
    openSidebarButton: document.getElementById("openSidebarButton"),
    closeSidebarButton: document.getElementById("closeSidebarButton"),

    darkModeButton: document.getElementById("darkModeButton"),
    darkModeIcon: document.getElementById("darkModeIcon"),
    logoutButton: document.getElementById("logoutAdminButton"),

    adminName: document.getElementById("sidebarAdminName"),
    adminAvatar: document.getElementById("sidebarAdminAvatar")
  };

  let toastTimer = null;
  let currentOrderRows = [];
  let currentReturnRows = [];

  elements.tokenInput.value =
    localStorage.getItem(TOKEN_KEY) || "";

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
      return "—";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsed);
  }

  function showToast(message, tone = "success") {
    const icons = {
      success: "fa-solid fa-circle-check text-green-400",
      error: "fa-solid fa-circle-exclamation text-red-400",
      info: "fa-solid fa-circle-info text-blue-400",
      warning: "fa-solid fa-triangle-exclamation text-amber-400"
    };

    elements.toastText.textContent = message;
    elements.toastIcon.className = icons[tone] || icons.info;
    elements.toast.classList.add("show");

    window.clearTimeout(toastTimer);

    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("show");
    }, 3000);
  }

  function setButtonBusy(button, busy, busyLabel = "Working...") {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `
        <i class="fa-solid fa-spinner loading-spin"></i>
        ${escapeHTML(busyLabel)}
      `;
      return;
    }

    button.disabled = false;

    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function statusClass(status) {
    const value = String(status || "").toLowerCase();

    if (
      value.includes("deliver") ||
      value.includes("complete") ||
      value.includes("approved") ||
      value.includes("refunded") ||
      value.includes("received")
    ) {
      return "status-green";
    }

    if (
      value.includes("transit") ||
      value.includes("ship") ||
      value.includes("book") ||
      value.includes("pickup scheduled")
    ) {
      return "status-blue";
    }

    if (
      value.includes("queue") ||
      value.includes("request") ||
      value.includes("review") ||
      value.includes("pending") ||
      value.includes("processing")
    ) {
      return "status-amber";
    }

    if (
      value.includes("cancel") ||
      value.includes("fail") ||
      value.includes("reject") ||
      value.includes("error")
    ) {
      return "status-red";
    }

    if (value.includes("replace") || value.includes("reverse")) {
      return "status-purple";
    }

    return "status-gray";
  }

  function statusPill(status, fallback = "Unknown") {
    const label = String(status || fallback);

    return `
      <span class="status-pill ${statusClass(label)}">
        ${escapeHTML(label)}
      </span>
    `;
  }

  function normalizeSearch(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function includesFilter(status, filter) {
    if (!filter || filter === "all") {
      return true;
    }

    const value = normalizeSearch(status);

    const groups = {
      queued: ["queue", "pending", "request"],
      booked: ["book", "awb", "ready"],
      pickup: ["pickup", "manifest"],
      transit: ["transit", "out for delivery", "shipped"],
      delivered: ["deliver", "complete"],
      cancel: ["cancel"],
      failed: ["fail", "error", "reject"],
      review: ["review"],
      approved: ["approved"],
      received: ["received"],
      refund: ["refund"],
      replacement: ["replacement"],
      rejected: ["rejected"],
      closed: ["closed"]
    };

    return (groups[filter] || [filter]).some(term => {
      return value.includes(term);
    });
  }

  function adminRequest(path, options = {}) {
    return window.ApnaFindsAPI.adminRequest(path, options);
  }

  function updateAdminIdentity() {
    const account =
      window.ApnaFindsAdminAuth?.getAccount?.() || null;

    const name = String(account?.name || "Administrator").trim();
    const initial = name.charAt(0).toUpperCase() || "A";

    elements.adminName.textContent = name;
    elements.adminAvatar.textContent = initial;
  }

  function openSidebar() {
    elements.sidebar.classList.remove("-translate-x-full");
    elements.sidebarOverlay.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
  }

  function closeSidebar() {
    elements.sidebar.classList.add("-translate-x-full");
    elements.sidebarOverlay.classList.add("hidden");
    document.body.classList.remove("overflow-hidden");
  }

  function applyTheme(theme) {
    const dark = theme === "dark";

    document.documentElement.classList.toggle("dark", dark);
    elements.darkModeIcon.className =
      dark
        ? "fa-solid fa-sun"
        : "fa-solid fa-moon";
  }

  function toggleTheme() {
    const nextTheme =
      document.documentElement.classList.contains("dark")
        ? "light"
        : "dark";

    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  function setConnectionState({
    label,
    tone = "idle",
    detail
  }) {
    const toneClasses = {
      connected: "bg-green-400",
      error: "bg-red-400",
      loading: "bg-amber-400",
      idle: "bg-gray-300"
    };

    elements.connectionState.textContent = label;
    elements.providerBadge.innerHTML = `
      <span class="h-2.5 w-2.5 rounded-full ${toneClasses[tone] || toneClasses.idle}"></span>
      ${escapeHTML(detail || label)}
    `;
  }

  function renderEmptyOrders(message, detail) {
    elements.ordersBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <i class="fa-solid fa-box-open"></i>
            <strong>${escapeHTML(message)}</strong>
            <span>${escapeHTML(detail)}</span>
          </div>
        </td>
      </tr>
    `;

    currentOrderRows = [];
    elements.ordersResultCount.textContent = "0 orders displayed";
  }

  function renderEmptyReturns(message, detail) {
    elements.returnsBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8">
          <div class="empty-state">
            <i class="fa-solid fa-rotate-left"></i>
            <strong>${escapeHTML(message)}</strong>
            <span>${escapeHTML(detail)}</span>
          </div>
        </td>
      </tr>
    `;

    currentReturnRows = [];
    elements.returnsResultCount.textContent = "0 returns displayed";
  }

  async function loadSummary() {
    const data = await adminRequest("/api/admin/summary");

    document.getElementById("statOrders").textContent =
      data.counts?.orders ?? 0;

    document.getElementById("statQueued").textContent =
      data.counts?.queued ?? 0;

    document.getElementById("statShipments").textContent =
      data.counts?.shipments ?? 0;

    document.getElementById("statTransit").textContent =
      data.counts?.inTransit ?? 0;

    document.getElementById("statReturns").textContent =
      data.counts?.returns ?? 0;

    const provider = data.provider || {};
    const providerName = String(provider.provider || "Logistics");
    const mode = String(provider.mode || "unknown").toUpperCase();
    const autoBooking = provider.autoBooking ? "Auto ON" : "Auto OFF";
    const statusText = `${providerName} · ${mode} · ${autoBooking}`;

    elements.providerStatus.textContent = statusText;

    setConnectionState({
      label: "Connected",
      tone: "connected",
      detail: `${providerName} · ${mode}`
    });
  }

  async function loadOrders() {
    const data = await adminRequest("/api/admin/orders");
    const bundles = Array.isArray(data.orders) ? data.orders : [];

    if (!bundles.length) {
      renderEmptyOrders(
        "No server orders yet",
        "Place an order while the Node.js server is running, or use Import Orders."
      );
      return;
    }

    currentOrderRows = bundles.map(bundle => {
      const order = bundle.order || {};
      const shipment = bundle.shipment || {};

      const combinedStatus = [
        order.status,
        order.automationStatus,
        shipment.customerStatus,
        shipment.status
      ].filter(Boolean).join(" ");

      const searchText = [
        order.id,
        order.customerName,
        order.phone,
        order.email,
        shipment.courier,
        shipment.awb,
        combinedStatus
      ].filter(Boolean).join(" ").toLowerCase();

      return {
        combinedStatus,
        searchText,
        html: `
          <tr
            data-order-row
            data-search="${escapeHTML(searchText)}"
            data-status="${escapeHTML(combinedStatus.toLowerCase())}"
          >
            <td>
              <strong>${escapeHTML(order.id || "—")}</strong><br>
              <small>${escapeHTML(formatDate(order.createdAt || order.date))}</small>
            </td>

            <td>
              <strong>${escapeHTML(order.customerName || "Guest customer")}</strong><br>
              <small>${escapeHTML(order.phone || order.email || "No contact")}</small>
            </td>

            <td>
              <strong>${money(order.total || order.orderTotal)}</strong>
            </td>

            <td>
              ${statusPill(order.status, "New")}
            </td>

            <td>
              ${statusPill(order.automationStatus, "Queued")}
              ${
                order.automationError
                  ? `<br><small class="mt-2 inline-block !text-red-500">${escapeHTML(order.automationError)}</small>`
                  : ""
              }
            </td>

            <td>
              <strong>${escapeHTML(shipment.courier || "Not assigned")}</strong><br>
              <small>${escapeHTML(shipment.awb || "No AWB generated")}</small>
            </td>

            <td>
              ${statusPill(
                shipment.customerStatus || shipment.status,
                "Not booked"
              )}
            </td>

            <td>
              <div class="table-actions">
                <button
                  type="button"
                  class="table-action primary"
                  data-book="${escapeHTML(order.id || "")}"
                >
                  <i class="fa-solid fa-truck-fast"></i>
                  Book / Retry
                </button>

                <button
                  type="button"
                  class="table-action secondary"
                  data-track="${escapeHTML(order.id || "")}"
                >
                  <i class="fa-solid fa-location-crosshairs"></i>
                  Track
                </button>

                <button
                  type="button"
                  class="table-action danger"
                  data-cancel="${escapeHTML(order.id || "")}"
                >
                  <i class="fa-solid fa-ban"></i>
                  Cancel
                </button>
              </div>
            </td>
          </tr>
        `
      };
    });

    applyOrderFilters();
  }

  async function loadReturns() {
    const data = await adminRequest("/api/admin/returns");
    const requests = Array.isArray(data.returns) ? data.returns : [];

    if (!requests.length) {
      renderEmptyReturns(
        "No return requests",
        "Customer return, replacement and refund requests will appear here."
      );
      return;
    }

    currentReturnRows = requests.map(request => {
      const status = String(request.status || "Requested");

      const searchText = [
        request.id,
        request.orderId,
        request.customerName,
        request.phone,
        request.email,
        request.type,
        status,
        request.reverseShipment?.awb
      ].filter(Boolean).join(" ").toLowerCase();

      const statuses = [
        "Requested",
        "Under Review",
        "Approved",
        "Pickup Scheduled",
        "Received",
        "Refund Initiated",
        "Refunded",
        "Replacement Shipped",
        "Rejected",
        "Closed"
      ];

      return {
        status,
        searchText,
        html: `
          <tr
            data-return-row
            data-search="${escapeHTML(searchText)}"
            data-status="${escapeHTML(status.toLowerCase())}"
          >
            <td>
              <strong>${escapeHTML(request.id || "—")}</strong>
            </td>

            <td>
              <strong>${escapeHTML(request.orderId || "—")}</strong>
            </td>

            <td>
              <strong>${escapeHTML(request.customerName || "Customer")}</strong><br>
              <small>${escapeHTML(request.phone || request.email || "No contact")}</small>
            </td>

            <td>
              ${statusPill(request.type, "Return")}
            </td>

            <td>
              <strong>${money(request.estimatedValue)}</strong>
            </td>

            <td>
              <select
                class="status-select"
                data-return-status="${escapeHTML(request.id || "")}"
              >
                ${statuses.map(option => `
                  <option
                    value="${escapeHTML(option)}"
                    ${status === option ? "selected" : ""}
                  >
                    ${escapeHTML(option)}
                  </option>
                `).join("")}
              </select>
            </td>

            <td>
              <strong>${escapeHTML(request.reverseShipment?.awb || "Not generated")}</strong>
            </td>

            <td>
              <div class="table-actions">
                <button
                  type="button"
                  class="table-action primary"
                  data-reverse="${escapeHTML(request.id || "")}"
                >
                  <i class="fa-solid fa-truck-arrow-right"></i>
                  Reverse Pickup
                </button>

                <button
                  type="button"
                  class="table-action secondary"
                  data-save-return="${escapeHTML(request.id || "")}"
                >
                  <i class="fa-solid fa-floppy-disk"></i>
                  Save
                </button>
              </div>
            </td>
          </tr>
        `
      };
    });

    applyReturnFilters();
  }

  async function loadEvents() {
    const data = await adminRequest("/api/admin/events");
    const events = Array.isArray(data.events) ? data.events : [];

    if (!events.length) {
      elements.eventsList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-clock-rotate-left"></i>
          <strong>No automation events yet</strong>
          <span>Run automation or perform a shipment action to create events.</span>
        </div>
      `;
      return;
    }

    elements.eventsList.innerHTML = events
      .slice(0, 30)
      .map(event => `
        <article class="event-item">
          <span class="event-icon">
            <i class="fa-solid fa-bolt"></i>
          </span>

          <div>
            <h3>${escapeHTML(event.message || "Automation event")}</h3>
            <p>
              ${escapeHTML(event.type || "event")}
              ·
              ${escapeHTML(formatDate(event.createdAt))}
            </p>
          </div>
        </article>
      `)
      .join("");
  }

  function applyOrderFilters() {
    const query = normalizeSearch(elements.orderSearch.value);
    const filter = elements.orderStatusFilter.value;

    const visible = currentOrderRows.filter(row => {
      return row.searchText.includes(query) &&
        includesFilter(row.combinedStatus, filter);
    });

    if (!currentOrderRows.length) {
      return;
    }

    if (!visible.length) {
      elements.ordersBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            <div class="empty-state">
              <i class="fa-solid fa-magnifying-glass"></i>
              <strong>No matching orders</strong>
              <span>Change the search text or status filter.</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      elements.ordersBody.innerHTML =
        visible.map(row => row.html).join("");
    }

    elements.ordersResultCount.textContent =
      `${visible.length} of ${currentOrderRows.length} orders displayed`;
  }

  function applyReturnFilters() {
    const query = normalizeSearch(elements.returnSearch.value);
    const filter = elements.returnStatusFilter.value;

    const visible = currentReturnRows.filter(row => {
      return row.searchText.includes(query) &&
        includesFilter(row.status, filter);
    });

    if (!currentReturnRows.length) {
      return;
    }

    if (!visible.length) {
      elements.returnsBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="8">
            <div class="empty-state">
              <i class="fa-solid fa-magnifying-glass"></i>
              <strong>No matching return requests</strong>
              <span>Change the search text or status filter.</span>
            </div>
          </td>
        </tr>
      `;
    } else {
      elements.returnsBody.innerHTML =
        visible.map(row => row.html).join("");
    }

    elements.returnsResultCount.textContent =
      `${visible.length} of ${currentReturnRows.length} returns displayed`;
  }

  async function refreshAll(options = {}) {
    const { showSuccess = false } = options;

    const hasSession = Boolean(
      window.ApnaFindsAdminAuth?.getSessionToken?.()
    );

    if (!hasSession && !elements.tokenInput.value.trim()) {
      setConnectionState({
        label: "Waiting",
        tone: "idle",
        detail: "Login required"
      });

      elements.providerStatus.textContent =
        "Administrator login is required";

      showToast(
        "Open admin-login.html and sign in first.",
        "warning"
      );
      return;
    }

    setConnectionState({
      label: "Syncing",
      tone: "loading",
      detail: "Connecting"
    });

    setButtonBusy(elements.refreshButton, true, "Refreshing");

    try {
      await Promise.all([
        loadSummary(),
        loadOrders(),
        loadReturns(),
        loadEvents()
      ]);

      const now = new Date();

      elements.lastUpdated.textContent =
        new Intl.DateTimeFormat("en-IN", {
          hour: "numeric",
          minute: "2-digit"
        }).format(now);

      if (showSuccess) {
        showToast("Logistics dashboard refreshed.");
      }
    } catch (error) {
      setConnectionState({
        label: "Error",
        tone: "error",
        detail: "Connection failed"
      });

      elements.providerStatus.textContent =
        "Unable to load logistics data";

      showToast(error.message, "error");
    } finally {
      setButtonBusy(elements.refreshButton, false);
    }
  }

  elements.saveTokenButton.addEventListener("click", async () => {
    const token = elements.tokenInput.value.trim();

    if (!token) {
      showToast("Enter the admin API token.", "warning");
      elements.tokenInput.focus();
      return;
    }

    localStorage.setItem(TOKEN_KEY, token);

    setButtonBusy(
      elements.saveTokenButton,
      true,
      "Connecting"
    );

    try {
      await refreshAll({
        showSuccess: false
      });

      showToast("Admin API token saved.");
    } finally {
      setButtonBusy(
        elements.saveTokenButton,
        false
      );
    }
  });

  elements.toggleTokenButton.addEventListener("click", () => {
    const show = elements.tokenInput.type === "password";

    elements.tokenInput.type = show
      ? "text"
      : "password";

    elements.toggleTokenIcon.className = show
      ? "fa-regular fa-eye-slash"
      : "fa-regular fa-eye";
  });

  elements.runButton.addEventListener("click", async () => {
    setButtonBusy(
      elements.runButton,
      true,
      "Running"
    );

    try {
      const result = await adminRequest(
        "/api/admin/automation/run",
        {
          method: "POST",
          body: "{}"
        }
      );

      showToast(
        `Automation processed ${result.processed || 0} orders.`
      );

      await refreshAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonBusy(
        elements.runButton,
        false
      );
    }
  });

  elements.importButton.addEventListener("click", async () => {
    let orders = [];

    try {
      const parsed = JSON.parse(
        localStorage.getItem("apnafinds_orders") || "[]"
      );

      orders = Array.isArray(parsed) ? parsed : [];
    } catch {
      orders = [];
    }

    if (!orders.length) {
      showToast(
        "No browser orders were found.",
        "warning"
      );
      return;
    }

    setButtonBusy(
      elements.importButton,
      true,
      "Importing"
    );

    try {
      const result = await adminRequest(
        "/api/admin/import-orders",
        {
          method: "POST",
          body: JSON.stringify({ orders })
        }
      );

      showToast(
        `Imported ${result.imported || 0} orders.`
      );

      await refreshAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonBusy(
        elements.importButton,
        false
      );
    }
  });

  elements.refreshButton.addEventListener("click", () => {
    refreshAll({
      showSuccess: true
    });
  });

  elements.ordersBody.addEventListener("click", async event => {
    const book = event.target.closest("[data-book]");
    const track = event.target.closest("[data-track]");
    const cancel = event.target.closest("[data-cancel]");
    const button = book || track || cancel;

    if (!button) {
      return;
    }

    const orderId =
      book?.dataset.book ||
      track?.dataset.track ||
      cancel?.dataset.cancel;

    if (!orderId) {
      return;
    }

    if (
      cancel &&
      !window.confirm(
        "Cancel this order and its courier shipment?"
      )
    ) {
      return;
    }

    setButtonBusy(
      button,
      true,
      book
        ? "Booking"
        : track
          ? "Tracking"
          : "Cancelling"
    );

    try {
      if (book) {
        await adminRequest(
          `/api/admin/orders/${encodeURIComponent(orderId)}/book-shipment`,
          {
            method: "POST",
            body: "{}"
          }
        );

        showToast(`Shipment booked for ${orderId}.`);
      }

      if (track) {
        await adminRequest(
          `/api/admin/orders/${encodeURIComponent(orderId)}/refresh-tracking`,
          {
            method: "POST",
            body: "{}"
          }
        );

        showToast(`Tracking refreshed for ${orderId}.`);
      }

      if (cancel) {
        await adminRequest(
          `/api/admin/orders/${encodeURIComponent(orderId)}/cancel`,
          {
            method: "POST",
            body: "{}"
          }
        );

        showToast(`Order ${orderId} cancelled.`);
      }

      await refreshAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  elements.returnsBody.addEventListener("click", async event => {
    const reverse = event.target.closest("[data-reverse]");
    const save = event.target.closest("[data-save-return]");
    const button = reverse || save;

    if (!button) {
      return;
    }

    const requestId =
      reverse?.dataset.reverse ||
      save?.dataset.saveReturn;

    if (!requestId) {
      return;
    }

    setButtonBusy(
      button,
      true,
      reverse
        ? "Booking"
        : "Saving"
    );

    try {
      if (reverse) {
        await adminRequest(
          `/api/admin/returns/${encodeURIComponent(requestId)}/reverse-pickup`,
          {
            method: "POST",
            body: "{}"
          }
        );

        showToast(
          `Reverse pickup requested for ${requestId}.`
        );
      }

      if (save) {
        const select = document.querySelector(
          `[data-return-status="${CSS.escape(requestId)}"]`
        );

        if (!select) {
          throw new Error(
            "Return status selector was not found."
          );
        }

        await adminRequest(
          `/api/admin/returns/${encodeURIComponent(requestId)}/status`,
          {
            method: "POST",
            body: JSON.stringify({
              status: select.value
            })
          }
        );

        showToast(
          `Return ${requestId} updated.`
        );
      }

      await refreshAll();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonBusy(button, false);
    }
  });

  elements.orderSearch.addEventListener(
    "input",
    applyOrderFilters
  );

  elements.orderStatusFilter.addEventListener(
    "change",
    applyOrderFilters
  );

  elements.returnSearch.addEventListener(
    "input",
    applyReturnFilters
  );

  elements.returnStatusFilter.addEventListener(
    "change",
    applyReturnFilters
  );

  elements.openSidebarButton.addEventListener(
    "click",
    openSidebar
  );

  elements.closeSidebarButton.addEventListener(
    "click",
    closeSidebar
  );

  elements.sidebarOverlay.addEventListener(
    "click",
    closeSidebar
  );

  elements.darkModeButton.addEventListener(
    "click",
    toggleTheme
  );

  elements.logoutButton.addEventListener("click", () => {
    if (
      window.confirm(
        "Log out of the ApnaFinds admin panel?"
      )
    ) {
      window.ApnaFindsAdminAuth.logoutAdmin();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeSidebar();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      elements.sidebarOverlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
    }
  });

  updateAdminIdentity();

  applyTheme(
    localStorage.getItem(THEME_KEY) ||
    (
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    )
  );

  if (
    window.ApnaFindsAdminAuth?.isAuthenticated?.() ||
    elements.tokenInput.value
  ) {
    refreshAll();
  } else {
    setConnectionState({
      label: "Waiting",
      tone: "idle",
      detail: "Login required"
    });
  }
})();
