/*
 * ApnaFinds server-backed administrator authentication.
 * The login credentials are configured in the project .env file.
 */
(() => {
  "use strict";

  const SESSION_KEY = "apnafinds_admin_server_session";
  const ACCOUNT_KEY = "apnafinds_admin_server_account";

  function safeParse(value, fallback = null) {
    try {
      return JSON.parse(value) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function storageForRemember(remember) {
    return remember ? localStorage : sessionStorage;
  }

  function clearOtherStorage(target) {
    const other = target === localStorage ? sessionStorage : localStorage;
    other.removeItem(SESSION_KEY);
    other.removeItem(ACCOUNT_KEY);
  }

  function getStoredSession() {
    for (const storage of [sessionStorage, localStorage]) {
      const session = safeParse(storage.getItem(SESSION_KEY));

      if (session && typeof session === "object") {
        return {
          ...session,
          storage
        };
      }
    }

    return null;
  }

  function getAccount() {
    for (const storage of [sessionStorage, localStorage]) {
      const account = safeParse(storage.getItem(ACCOUNT_KEY));

      if (account && typeof account === "object") {
        return account;
      }
    }

    return null;
  }

  function getSessionToken() {
    const session = getStoredSession();

    if (!session) {
      return "";
    }

    if (
      !session.token ||
      !Number.isFinite(Number(session.expiresAt)) ||
      Date.now() >= Number(session.expiresAt)
    ) {
      clearSession();
      return "";
    }

    return String(session.token);
  }

  function isAuthenticated() {
    return Boolean(getSessionToken() && getAccount());
  }

  function hasAccount() {
    // The account is configured on the Node.js server through .env.
    return true;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  }

  async function request(path, options = {}) {
    if (window.location.protocol === "file:") {
      throw new Error(
        "Start START-APNAFINDS.bat and open the admin page through http://localhost:3000."
      );
    }

    const response = await fetch(path, {
      ...options,
      headers: {
        accept: "application/json",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(data.error || `Server returned ${response.status}`);
    }

    return data;
  }

  async function loginAdmin(email, password, remember = false) {
    try {
      const result = await request("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: String(email || "").trim().toLowerCase(),
          password: String(password || ""),
          remember: Boolean(remember)
        })
      });

      const storage = storageForRemember(remember);
      clearSession();
      clearOtherStorage(storage);

      storage.setItem(
        SESSION_KEY,
        JSON.stringify({
          token: result.token,
          expiresAt: result.expiresAt
        })
      );
      storage.setItem(
        ACCOUNT_KEY,
        JSON.stringify(result.account || {})
      );

      return {
        ok: true,
        account: result.account
      };
    } catch (error) {
      return {
        ok: false,
        message: error.message
      };
    }
  }

  async function createAdminAccount() {
    return {
      ok: false,
      message:
        "The administrator account is configured in the project .env file. Use the email and password from that file."
    };
  }

  async function verifySession() {
    const token = getSessionToken();

    if (!token) {
      return false;
    }

    try {
      const result = await request("/api/admin/auth/me", {
        headers: {
          "x-admin-session": token
        }
      });

      const session = getStoredSession();

      if (session?.storage && result.account) {
        session.storage.setItem(
          ACCOUNT_KEY,
          JSON.stringify(result.account)
        );
      }

      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  function getSafeRedirect(fallback = "admin.html") {
    const params = new URLSearchParams(window.location.search);
    const next = String(params.get("next") || "");

    if (
      next &&
      !next.includes("://") &&
      !next.startsWith("//") &&
      !next.toLowerCase().startsWith("javascript:")
    ) {
      return next;
    }

    return fallback;
  }

  function installProtection() {
    const current = `${location.pathname}${location.search}${location.hash}`;
    const loginPage = location.pathname.endsWith("/admin-login.html") ||
      location.pathname.endsWith("/admin-login");

    if (loginPage || isAuthenticated()) {
      return;
    }

    const next = encodeURIComponent(current.split("/").pop() || "admin.html");
    window.location.replace(`admin-login.html?next=${next}`);
  }

  async function logoutAdmin() {
    const token = getSessionToken();

    if (token && window.location.protocol !== "file:") {
      try {
        await request("/api/admin/auth/logout", {
          method: "POST",
          headers: {
            "x-admin-session": token
          },
          body: "{}"
        });
      } catch {
        // The local session is still cleared even if the server is offline.
      }
    }

    clearSession();
    window.location.replace("admin-login.html");
  }

  window.ApnaFindsAdminAuth = {
    hasAccount,
    createAdminAccount,
    loginAdmin,
    logoutAdmin,
    clearSession,
    getAccount,
    getSessionToken,
    isAuthenticated,
    verifySession,
    getSafeRedirect,
    installProtection
  };
})();
