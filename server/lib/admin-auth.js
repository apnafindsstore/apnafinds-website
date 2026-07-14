const crypto = require("crypto");

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function decodeBase64url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padding = normalized.length % 4
    ? "=".repeat(4 - (normalized.length % 4))
    : "";

  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function sessionSecret() {
  return String(
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_API_TOKEN ||
    "apnafinds-local-session-secret"
  );
}

function configuredAccount() {
  return {
    id: "ADMIN-PRIMARY",
    name: String(process.env.ADMIN_NAME || "ApnaFinds Administrator"),
    email: String(process.env.ADMIN_EMAIL || "admin@apnafinds.local")
      .trim()
      .toLowerCase(),
    role: "admin"
  };
}

function credentialsConfigured() {
  return Boolean(
    String(process.env.ADMIN_EMAIL || "").trim() &&
    String(process.env.ADMIN_PASSWORD || "").trim()
  );
}

function authenticateCredentials(email, password) {
  if (!credentialsConfigured()) {
    return {
      ok: false,
      error: "ADMIN_EMAIL and ADMIN_PASSWORD are not configured in .env"
    };
  }

  const account = configuredAccount();
  const expectedPassword = String(process.env.ADMIN_PASSWORD || "");
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (
    !safeEqual(normalizedEmail, account.email) ||
    !safeEqual(String(password || ""), expectedPassword)
  ) {
    return {
      ok: false,
      error: "Invalid administrator email or password"
    };
  }

  return {
    ok: true,
    account
  };
}

function signSession(account, remember = false) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const ttlSeconds = remember
    ? Math.max(1, Number(process.env.ADMIN_REMEMBER_DAYS || 30)) * 86400
    : Math.max(1, Number(process.env.ADMIN_SESSION_HOURS || 8)) * 3600;

  const payload = {
    sub: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
    nonce: crypto.randomBytes(12).toString("hex")
  };

  const headerPart = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadPart = base64url(JSON.stringify(payload));
  const unsigned = `${headerPart}.${payloadPart}`;
  const signature = crypto
    .createHmac("sha256", sessionSecret())
    .update(unsigned)
    .digest("base64url");

  return {
    token: `${unsigned}.${signature}`,
    expiresAt: payload.exp * 1000,
    account: {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role
    }
  };
}

function verifySession(token) {
  try {
    const parts = String(token || "").split(".");

    if (parts.length !== 3) {
      return null;
    }

    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = crypto
      .createHmac("sha256", sessionSecret())
      .update(unsigned)
      .digest("base64url");

    if (!safeEqual(parts[2], expected)) {
      return null;
    }

    const payload = JSON.parse(decodeBase64url(parts[1]));
    const now = Math.floor(Date.now() / 1000);

    if (
      payload.role !== "admin" ||
      !Number.isFinite(Number(payload.exp)) ||
      now >= Number(payload.exp)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sessionFromRequest(request) {
  const direct = String(request.get("x-admin-session") || "").trim();

  if (direct) {
    return direct;
  }

  const authorization = String(request.get("authorization") || "");
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : "";
}

module.exports = {
  configuredAccount,
  credentialsConfigured,
  authenticateCredentials,
  signSession,
  verifySession,
  sessionFromRequest
};
