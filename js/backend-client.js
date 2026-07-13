(() => {
  "use strict";

  const DEFAULT_TIMEOUT_MS = 15000;

  function ensureServerContext() {
    if (window.location.protocol === "file:") {
      throw new Error(
        "This page must be opened through the ApnaFinds Node.js server. Start START-APNAFINDS.bat and open http://localhost:3000."
      );
    }
  }

  async function request(path, options = {}) {
    ensureServerContext();

    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS
    );

    const headers = {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(path, {
        ...options,
        headers,
        signal: controller.signal
      });

      const text = await response.text();

      let data = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.reply ||
          `Server returned ${response.status}`
        );
      }

      return data;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error(
          "The ApnaFinds server did not respond. Check that START-APNAFINDS.bat is running."
        );
      }

      if (
        error instanceof TypeError ||
        String(error?.message || "").includes("Failed to fetch")
      ) {
        throw new Error(
          "Could not connect to the ApnaFinds server. Start START-APNAFINDS.bat and open http://localhost:3000."
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getAdminToken() {
    return (
      localStorage.getItem("apnafinds_admin_api_token") ||
      ""
    ).trim();
  }

  function getAdminSession() {
    if (window.ApnaFindsAdminAuth?.getSessionToken) {
      return window.ApnaFindsAdminAuth.getSessionToken();
    }

    const keys = [
      [sessionStorage, "apnafinds_admin_server_session"],
      [localStorage, "apnafinds_admin_server_session"]
    ];

    for (const [storage, key] of keys) {
      try {
        const session = JSON.parse(storage.getItem(key) || "null");

        if (
          session?.token &&
          Number(session.expiresAt || 0) > Date.now()
        ) {
          return String(session.token);
        }
      } catch {
        // Continue to the next storage option.
      }
    }

    return "";
  }

  window.ApnaFindsAPI = {
    request,

    health() {
      return request("/api/health");
    },

    createOrder(order) {
      return request("/api/orders", {
        method: "POST",
        body: JSON.stringify(order)
      });
    },

    getOrder(orderId, contact) {
      return request(
        `/api/orders/${encodeURIComponent(orderId)}` +
        `?contact=${encodeURIComponent(contact)}`
      );
    },

    refreshOrderTracking(orderId, contact) {
      return request(
        `/api/orders/${encodeURIComponent(orderId)}/refresh-tracking`,
        {
          method: "POST",
          body: JSON.stringify({ contact })
        }
      );
    },

    cancelOrder(orderId, contact) {
      return request(
        `/api/orders/${encodeURIComponent(orderId)}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ contact })
        }
      );
    },

    createReturn(orderId, payload) {
      return request(
        `/api/orders/${encodeURIComponent(orderId)}/return`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
    },

    serviceability({
      deliveryPostcode,
      weight = 0.5,
      cod = true
    }) {
      const params = new URLSearchParams({
        deliveryPostcode,
        weight: String(weight),
        cod: String(cod)
      });

      return request(
        `/api/logistics/serviceability?${params}`
      );
    },

    assistant(payload) {
      return request(
        "/api/assistant/message",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
    },

    adminRequest(path, options = {}) {
      const session = getAdminSession();
      const token = getAdminToken();

      if (!session && !token) {
        throw new Error(
          "Administrator login is required. Open admin-login.html."
        );
      }

      return request(path, {
        ...options,
        headers: {
          ...(session ? { "x-admin-session": session } : {}),
          ...(!session && token ? { "x-admin-token": token } : {}),
          ...(options.headers || {})
        }
      });
    },

    getAdminToken,
    getAdminSession,
    hasAdminCredentials() {
      return Boolean(getAdminSession() || getAdminToken());
    }
  };
})();
