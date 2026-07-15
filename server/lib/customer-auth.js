
"use strict";

const crypto = require("crypto");

const OTP_TTL_MS = Math.max(
  60_000,
  Number(process.env.OTP_TTL_SECONDS || 300) * 1000
);

const OTP_MAX_ATTEMPTS = Math.max(
  3,
  Number(process.env.OTP_MAX_ATTEMPTS || 5)
);

const OTP_RESEND_SECONDS = Math.max(
  20,
  Number(process.env.OTP_RESEND_SECONDS || 30)
);

const challenges = new Map();
const verificationTokens = new Map();

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function isValidIndianPhone(value) {
  return /^[6-9][0-9]{9}$/.test(normalizePhone(value));
}

function secret() {
  return String(
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "change-this-customer-session-secret"
  );
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payload) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret())
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifySignedPayload(token) {
  try {
    const [encoded, supplied] = String(token || "").split(".");
    if (!encoded || !supplied) return null;

    const expected = crypto
      .createHmac("sha256", secret())
      .update(encoded)
      .digest("base64url");

    if (
      expected.length !== supplied.length ||
      !crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(supplied)
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (Number(payload.exp || 0) <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const value = String(password || "");
  const hash = crypto.scryptSync(value, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto
      .scryptSync(String(password || ""), String(salt || ""), 64)
      .toString("hex");

    return (
      actual.length === String(expectedHash || "").length &&
      crypto.timingSafeEqual(
        Buffer.from(actual),
        Buffer.from(String(expectedHash || ""))
      )
    );
  } catch {
    return false;
  }
}

function maskDestination(channel, destination) {
  if (channel === "phone") {
    const phone = normalizePhone(destination);
    return phone ? `******${phone.slice(-4)}` : "";
  }

  const email = normalizeEmail(destination);
  const [name = "", domain = ""] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
}

function cleanExpired() {
  const now = Date.now();

  for (const [id, challenge] of challenges) {
    if (challenge.expiresAt <= now) challenges.delete(id);
  }

  for (const [token, record] of verificationTokens) {
    if (record.expiresAt <= now) verificationTokens.delete(token);
  }
}

function createOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendEmailOtp({ destination, otp, purpose }) {
  const nodemailer = require("nodemailer");

  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass) {
    throw new Error("Email OTP SMTP settings are not configured");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass }
  });

  await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      `ApnaFinds <${user}>`,
    to: destination,
    subject: `Your ApnaFinds verification code: ${otp}`,
    text:
      `Your ApnaFinds verification code is ${otp}. ` +
      `It expires in ${Math.round(OTP_TTL_MS / 60000)} minutes. ` +
      `Purpose: ${purpose}. Never share this code.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">` +
      `<h2 style="color:#0F5C4A">ApnaFinds verification</h2>` +
      `<p>Your one-time code is:</p>` +
      `<div style="font-size:34px;font-weight:800;letter-spacing:8px;padding:18px;background:#f4f7f6;border-radius:14px;text-align:center">${otp}</div>` +
      `<p>This code expires in ${Math.round(OTP_TTL_MS / 60000)} minutes.</p>` +
      `<p style="color:#666">Never share this code with anyone.</p>` +
      `</div>`
  });
}

async function sendPhoneOtp({ destination, otp, purpose }) {
  const webhook = String(process.env.OTP_SMS_WEBHOOK_URL || "").trim();

  if (!webhook) {
    throw new Error(
      "Phone OTP provider is not configured. Add OTP_SMS_WEBHOOK_URL or use OTP_MODE=demo for testing."
    );
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.OTP_SMS_WEBHOOK_TOKEN
        ? { authorization: `Bearer ${process.env.OTP_SMS_WEBHOOK_TOKEN}` }
        : {})
    },
    body: JSON.stringify({
      phone: `91${normalizePhone(destination)}`,
      otp,
      purpose,
      brand: "ApnaFinds"
    })
  });

  if (!response.ok) {
    throw new Error(`Phone OTP provider returned ${response.status}`);
  }
}

async function deliverOtp({ channel, destination, otp, purpose }) {
  const mode = String(process.env.OTP_MODE || "demo").toLowerCase();

  if (mode === "demo") {
    console.log(
      `[DEMO OTP] ${channel} ${destination} ${purpose}: ${otp}`
    );
    return { mode, delivered: true };
  }

  if (channel === "email") {
    await sendEmailOtp({ destination, otp, purpose });
    return { mode: "smtp", delivered: true };
  }

  await sendPhoneOtp({ destination, otp, purpose });
  return { mode: "sms-webhook", delivered: true };
}

async function createChallenge({
  channel,
  destination,
  purpose = "login",
  ip = ""
}) {
  cleanExpired();

  const normalizedChannel =
    channel === "email" ? "email" : "phone";

  const normalizedDestination =
    normalizedChannel === "email"
      ? normalizeEmail(destination)
      : normalizePhone(destination);

  if (
    normalizedChannel === "email" &&
    !isValidEmail(normalizedDestination)
  ) {
    throw new Error("Enter a valid email address");
  }

  if (
    normalizedChannel === "phone" &&
    !isValidIndianPhone(normalizedDestination)
  ) {
    throw new Error("Enter a valid 10-digit Indian mobile number");
  }

  const existing = Array.from(challenges.values()).find(item => (
    item.channel === normalizedChannel &&
    item.destination === normalizedDestination &&
    item.purpose === purpose &&
    item.expiresAt > Date.now()
  ));

  if (
    existing &&
    Date.now() - existing.sentAt < OTP_RESEND_SECONDS * 1000
  ) {
    const wait = Math.ceil(
      (OTP_RESEND_SECONDS * 1000 - (Date.now() - existing.sentAt)) / 1000
    );

    throw new Error(`Please wait ${wait} seconds before requesting another OTP`);
  }

  const id = crypto.randomUUID();
  const otp = createOtp();
  const otpHash = hashPassword(otp);

  const challenge = {
    id,
    channel: normalizedChannel,
    destination: normalizedDestination,
    purpose: String(purpose || "login"),
    otpSalt: otpHash.salt,
    otpHash: otpHash.hash,
    attempts: 0,
    sentAt: Date.now(),
    expiresAt: Date.now() + OTP_TTL_MS,
    ip
  };

  await deliverOtp({
    channel: normalizedChannel,
    destination: normalizedDestination,
    otp,
    purpose: challenge.purpose
  });

  challenges.set(id, challenge);

  const demoExpose =
    String(process.env.OTP_MODE || "demo").toLowerCase() === "demo" &&
    String(process.env.OTP_DEMO_EXPOSE || "true").toLowerCase() === "true";

  return {
    challengeId: id,
    channel: normalizedChannel,
    maskedDestination: maskDestination(
      normalizedChannel,
      normalizedDestination
    ),
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    resendInSeconds: OTP_RESEND_SECONDS,
    ...(demoExpose ? { demoOtp: otp } : {})
  };
}

function verifyChallenge({ challengeId, otp }) {
  cleanExpired();

  const challenge = challenges.get(String(challengeId || ""));

  if (!challenge) {
    throw new Error("OTP request expired. Request a new OTP.");
  }

  challenge.attempts += 1;

  if (challenge.attempts > OTP_MAX_ATTEMPTS) {
    challenges.delete(challenge.id);
    throw new Error("Too many incorrect attempts. Request a new OTP.");
  }

  if (
    !verifyPassword(
      String(otp || ""),
      challenge.otpSalt,
      challenge.otpHash
    )
  ) {
    throw new Error("Incorrect OTP");
  }

  challenges.delete(challenge.id);

  const verificationToken = crypto.randomUUID();

  verificationTokens.set(verificationToken, {
    channel: challenge.channel,
    destination: challenge.destination,
    purpose: challenge.purpose,
    verifiedAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000
  });

  return {
    verificationToken,
    channel: challenge.channel,
    destination: challenge.destination,
    purpose: challenge.purpose,
    verifiedAt: new Date().toISOString(),
    expiresInSeconds: 900
  };
}

function consumeVerificationToken({
  token,
  channel,
  destination,
  purpose,
  consume = true
}) {
  cleanExpired();

  const record = verificationTokens.get(String(token || ""));
  if (!record) return null;

  const normalizedDestination =
    channel === "email"
      ? normalizeEmail(destination)
      : normalizePhone(destination);

  if (
    record.channel !== channel ||
    record.destination !== normalizedDestination ||
    (purpose && record.purpose !== purpose)
  ) {
    return null;
  }

  if (consume) verificationTokens.delete(String(token));

  return record;
}

function signCustomerSession(customer, remember = true) {
  const duration =
    remember
      ? Number(process.env.CUSTOMER_REMEMBER_DAYS || 30) * 86400000
      : Number(process.env.CUSTOMER_SESSION_HOURS || 12) * 3600000;

  const expiresAt = Date.now() + duration;

  return {
    token: signPayload({
      sub: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      role: "customer",
      exp: expiresAt
    }),
    expiresAt
  };
}

function customerSessionFromRequest(request) {
  const token = String(
    request.get("x-customer-session") ||
    request.body?.customerSession ||
    ""
  ).trim();

  return verifySignedPayload(token);
}

function publicCustomer(customer) {
  if (!customer) return null;

  const {
    passwordHash,
    passwordSalt,
    ...safe
  } = customer;

  return safe;
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeName,
  isValidEmail,
  isValidIndianPhone,
  hashPassword,
  verifyPassword,
  createChallenge,
  verifyChallenge,
  consumeVerificationToken,
  signCustomerSession,
  customerSessionFromRequest,
  publicCustomer
};
