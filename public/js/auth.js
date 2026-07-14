/*
 * ApnaFinds customer authentication
 * ----------------------------------
 * Static-browser version using localStorage.
 *
 * Storage keys:
 *   users        = registered customer accounts
 *   currentUser  = signed-in customer
 *
 * Important:
 * This is suitable for local testing only. A real public store must use
 * server-side authentication or a service such as Firebase/Supabase Auth.
 */

(() => {
  "use strict";

  const USERS_KEY = "users";
  const CURRENT_USER_KEY = "currentUser";

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value) ?? fallback;
    } catch (error) {
      return fallback;
    }
  }

  function getUsers() {
    const users = safeParse(localStorage.getItem(USERS_KEY), []);
    return Array.isArray(users) ? users : [];
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getCurrentUser() {
    const user = safeParse(localStorage.getItem(CURRENT_USER_KEY), null);

    return user && typeof user === "object" && !Array.isArray(user)
      ? user
      : null;
  }

  function saveCurrentUser(user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

    window.dispatchEvent(
      new CustomEvent("apnafinds:auth-changed", {
        detail: {
          user
        }
      })
    );
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "").slice(-10);
  }

  function normalizeName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizeEmail(email)
    );
  }

  function isValidIndianPhone(phone) {
    return /^[6-9][0-9]{9}$/.test(
      normalizePhone(phone)
    );
  }

  function validatePassword(password) {
    const value = String(password || "");

    if (value.length < 6) {
      return "Use at least 6 characters.";
    }

    if (!/[A-Za-z]/.test(value)) {
      return "Include at least one letter.";
    }

    if (!/[0-9]/.test(value)) {
      return "Include at least one number.";
    }

    return "";
  }

  function findUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);

    return getUsers().find(user => {
      return normalizeEmail(user.email) === normalizedEmail;
    });
  }

  function createCustomerAccount({
    name,
    email,
    phone,
    password,
    marketingConsent = false
  }) {
    const normalizedName = normalizeName(name);
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (normalizedName.length < 2) {
      return {
        ok: false,
        message: "Enter your full name."
      };
    }

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        message: "Enter a valid email address."
      };
    }

    if (!isValidIndianPhone(normalizedPhone)) {
      return {
        ok: false,
        message: "Enter a valid 10-digit Indian mobile number."
      };
    }

    const passwordError = validatePassword(password);

    if (passwordError) {
      return {
        ok: false,
        message: passwordError
      };
    }

    const users = getUsers();

    const emailExists = users.some(user => {
      return normalizeEmail(user.email) === normalizedEmail;
    });

    if (emailExists) {
      return {
        ok: false,
        message: "An account already exists with this email."
      };
    }

    const phoneExists = users.some(user => {
      return normalizePhone(user.phone ?? user.mobile) === normalizedPhone;
    });

    if (phoneExists) {
      return {
        ok: false,
        message: "An account already exists with this mobile number."
      };
    }

    const now = new Date().toISOString();

    const user = {
      id: `USR${Date.now()}${Math.floor(100 + Math.random() * 900)}`,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,

      /*
       * Plain password is retained only for compatibility with the existing
       * account.html password-change code. Replace this entire localStorage
       * authentication system before publishing the store.
       */
      password: String(password),

      role: "customer",
      status: "Active",
      marketingConsent: Boolean(marketingConsent),
      addresses: [],
      orders: [],
      wishlist: [],
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };

    users.unshift(user);
    saveUsers(users);
    saveCurrentUser(user);

    return {
      ok: true,
      user
    };
  }

  function loginCustomer(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const suppliedPassword = String(password || "");

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        message: "Enter a valid email address."
      };
    }

    if (!suppliedPassword) {
      return {
        ok: false,
        message: "Enter your password."
      };
    }

    const users = getUsers();

    const userIndex = users.findIndex(user => {
      return normalizeEmail(user.email) === normalizedEmail;
    });

    if (userIndex === -1) {
      return {
        ok: false,
        message: "No account was found with this email."
      };
    }

    const user = users[userIndex];

    if (String(user.status || "Active").toLowerCase() === "blocked") {
      return {
        ok: false,
        message: "This account has been blocked. Contact support."
      };
    }

    if (String(user.password || "") !== suppliedPassword) {
      return {
        ok: false,
        message: "The password is incorrect."
      };
    }

    user.lastLoginAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    users[userIndex] = user;
    saveUsers(users);
    saveCurrentUser(user);

    return {
      ok: true,
      user
    };
  }

  function resetCustomerPassword(email, phone, newPassword) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    if (!isValidEmail(normalizedEmail)) {
      return {
        ok: false,
        message: "Enter a valid email address."
      };
    }

    if (!isValidIndianPhone(normalizedPhone)) {
      return {
        ok: false,
        message: "Enter the registered 10-digit mobile number."
      };
    }

    const passwordError = validatePassword(newPassword);

    if (passwordError) {
      return {
        ok: false,
        message: passwordError
      };
    }

    const users = getUsers();

    const userIndex = users.findIndex(user => {
      return (
        normalizeEmail(user.email) === normalizedEmail &&
        normalizePhone(user.phone ?? user.mobile) === normalizedPhone
      );
    });

    if (userIndex === -1) {
      return {
        ok: false,
        message: "The email and mobile number do not match an account."
      };
    }

    users[userIndex].password = String(newPassword);
    users[userIndex].updatedAt = new Date().toISOString();

    saveUsers(users);

    const currentUser = getCurrentUser();

    if (
      currentUser &&
      normalizeEmail(currentUser.email) === normalizedEmail
    ) {
      currentUser.password = String(newPassword);
      currentUser.updatedAt = new Date().toISOString();
      saveCurrentUser(currentUser);
    }

    return {
      ok: true,
      user: users[userIndex]
    };
  }

  function logoutCustomer() {
    localStorage.removeItem(CURRENT_USER_KEY);

    window.dispatchEvent(
      new CustomEvent("apnafinds:auth-changed", {
        detail: {
          user: null
        }
      })
    );
  }

  function getSafeRedirect(defaultPage = "account.html") {
    const params = new URLSearchParams(window.location.search);
    const requested = String(params.get("redirect") || "").trim();

    if (!requested) {
      return defaultPage;
    }

    /*
     * Allow only local project HTML destinations.
     * Blocks external URLs and javascript: destinations.
     */
    if (
      /^[a-zA-Z0-9_-]+\.html(?:\?[a-zA-Z0-9_=&%+.-]*)?$/.test(requested)
    ) {
      return requested;
    }

    return defaultPage;
  }

  function redirectLoggedInCustomer(defaultPage = "account.html") {
    if (getCurrentUser()) {
      window.location.replace(getSafeRedirect(defaultPage));
      return true;
    }

    return false;
  }

  window.ApnaFindsAuth = {
    USERS_KEY,
    CURRENT_USER_KEY,
    getUsers,
    getCurrentUser,
    normalizeEmail,
    normalizePhone,
    isValidEmail,
    isValidIndianPhone,
    validatePassword,
    findUserByEmail,
    createCustomerAccount,
    loginCustomer,
    resetCustomerPassword,
    logoutCustomer,
    getSafeRedirect,
    redirectLoggedInCustomer
  };
})();
