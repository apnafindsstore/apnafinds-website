
(() => {
  "use strict";

  const SESSION_KEY = "apnafinds_customer_session";
  const CUSTOMER_KEY = "currentUser";

  function saveSession(session, customer) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        token: session.token,
        expiresAt: session.expiresAt
      })
    );

    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify(customer)
    );

    window.dispatchEvent(
      new CustomEvent("apnafinds:auth-changed", {
        detail: { customer }
      })
    );
  }

  function getSession() {
    try {
      const session = JSON.parse(
        localStorage.getItem(SESSION_KEY) || "null"
      );

      if (
        session?.token &&
        Number(session.expiresAt || 0) > Date.now()
      ) {
        return session;
      }
    } catch {
      // Ignore invalid browser data.
    }

    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  function getCustomer() {
    try {
      return JSON.parse(
        localStorage.getItem(CUSTOMER_KEY) || "null"
      );
    } catch {
      return null;
    }
  }

  async function request(path, options = {}) {
    const session = getSession();

    const response = await fetch(path, {
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(session?.token
          ? { "x-customer-session": session.token }
          : {}),
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    return data;
  }

  async function logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      // Browser logout must still succeed.
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CUSTOMER_KEY);

    window.dispatchEvent(
      new CustomEvent("apnafinds:auth-changed", {
        detail: { customer: null }
      })
    );
  }

  window.ApnaFindsCustomerAuth = {
    SESSION_KEY,
    CUSTOMER_KEY,
    request,
    saveSession,
    getSession,
    getCustomer,
    isLoggedIn() {
      return Boolean(getSession());
    },
    async refresh() {
      if (!getSession()) return null;

      try {
        const result = await request("/api/auth/me");
        localStorage.setItem(
          CUSTOMER_KEY,
          JSON.stringify(result.customer)
        );
        return result.customer;
      } catch {
        await logout();
        return null;
      }
    },
    logout
  };
})();
