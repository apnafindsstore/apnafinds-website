require("dotenv").config();

const path = require("path");
const express = require("express");
const {
  sendEmail,
  verifyMailConnection
} = require("./server/mailer");
const {
  ensureDatabase,
  readDatabase,
  mutateDatabase,
  createEvent
} = require("./server/lib/storage");

const {
  logistics,
  getOrderId,
  orderMatchesContact,
  publicOrderBundle,
  createOrUpdateOrder,
  bookShipmentForOrder,
  refreshTracking,
  cancelOrderAndShipment,
  createReturnRequest,
  createReversePickup,
  processQueuedOrders,
  advanceDemoShipments,
  advanceDemoReturns
} = require("./server/lib/automation");

const {
  handleAssistant
} = require("./server/lib/assistant");

const {
  configuredAccount,
  credentialsConfigured,
  authenticateCredentials,
  signSession,
  verifySession,
  sessionFromRequest
} = require("./server/lib/admin-auth");


const {
  normalizeEmail: normalizeCustomerEmail,
  normalizePhone: normalizeCustomerPhone,
  normalizeName: normalizeCustomerName,
  isValidEmail: isValidCustomerEmail,
  isValidIndianPhone,
  hashPassword,
  verifyPassword,
  createChallenge,
  verifyChallenge,
  consumeVerificationToken,
  signCustomerSession,
  customerSessionFromRequest,
  publicCustomer
} = require("./server/lib/customer-auth");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");

app.use((request, response, next) => {
  response.setHeader(
    "x-content-type-options",
    "nosniff"
  );

  response.setHeader(
    "referrer-policy",
    "strict-origin-when-cross-origin"
  );

  response.setHeader(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
});

app.use(
  express.json({
    limit: "2mb"
  })
);

function requireAdmin(
  request,
  response,
  next
) {
  const expected = String(
    process.env.ADMIN_API_TOKEN || ""
  ).trim();

  const supplied = String(
    request.get("x-admin-token") ||
    request.query.adminToken ||
    ""
  ).trim();

  if (
    expected &&
    supplied &&
    supplied === expected
  ) {
    request.admin = {
      id: "ADMIN-API-TOKEN",
      name: "API Administrator",
      role: "admin",
      authType: "api-token"
    };

    return next();
  }

  const sessionToken =
    sessionFromRequest(request);
  const session =
    verifySession(sessionToken);

  if (session) {
    request.admin = {
      id: session.sub,
      name: session.name,
      email: session.email,
      role: session.role,
      authType: "session"
    };

    return next();
  }

  if (!expected && !credentialsConfigured()) {
    return response.status(503).json({
      ok: false,
      error:
        "Admin authentication is not configured in .env"
    });
  }

  return response.status(401).json({
    ok: false,
    error:
      "Administrator login is required"
  });
}

function normalizeAdminContact(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function stableCustomerId(key) {
  const input = String(key || "customer");
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `CUS${(hash >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

function buildAdminCustomers(database) {
  const map = new Map();

  const addCustomer = (customer = {}, order = null) => {
    const email = normalizeAdminContact(
      customer.email ||
      order?.email
    );

    const phone = normalizeAdminContact(
      customer.phone ||
      customer.mobile ||
      order?.phone ||
      order?.shippingAddress?.phone
    );

    const name = String(
      customer.name ||
      customer.fullName ||
      order?.customerName ||
      order?.shippingAddress?.name ||
      "Customer"
    ).trim();

    const identity =
      email ||
      phone ||
      normalizeAdminContact(name);

    if (!identity) {
      return;
    }

    const key = identity;
    const current = map.get(key) || {
      id:
        String(customer.id || "").trim() ||
        stableCustomerId(key),
      name,
      email,
      phone,
      status:
        String(customer.status || "Active"),
      ordersCount: 0,
      totalSpent: 0,
      lastOrderAt: "",
      createdAt:
        customer.createdAt ||
        order?.createdAt ||
        order?.date ||
        new Date().toISOString(),
      updatedAt:
        customer.updatedAt ||
        order?.updatedAt ||
        new Date().toISOString()
    };

    current.name = name || current.name;
    current.email = email || current.email;
    current.phone = phone || current.phone;
    current.status =
      String(customer.status || current.status || "Active");

    if (order) {
      current.ordersCount += 1;
      current.totalSpent += Number(
        order.total ||
        order.orderTotal ||
        0
      );

      const orderDate =
        order.updatedAt ||
        order.createdAt ||
        order.date ||
        "";

      if (
        orderDate &&
        (!current.lastOrderAt ||
          new Date(orderDate) > new Date(current.lastOrderAt))
      ) {
        current.lastOrderAt = orderDate;
      }
    }

    map.set(key, current);
  };

  for (const customer of database.customers || []) {
    addCustomer(customer);
  }

  for (const order of database.orders || []) {
    addCustomer({}, order);
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(b.lastOrderAt || b.updatedAt || 0) -
      new Date(a.lastOrderAt || a.updatedAt || 0);
  });
}


function boolFromValue(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase()
  );
}

function boundedCodAdvance(value) {
  const minimum = Math.max(
    10,
    Number(process.env.COD_ADVANCE_MIN || 10)
  );

  const maximum = Math.min(
    49,
    Math.max(
      minimum,
      Number(process.env.COD_ADVANCE_MAX || 49)
    )
  );

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return Math.min(
      maximum,
      Math.max(
        minimum,
        Number(process.env.COD_ADVANCE_AMOUNT || 49)
      )
    );
  }

  return Math.min(
    maximum,
    Math.max(minimum, Math.round(amount))
  );
}

function sellerSettings(database) {
  const saved =
    database?.settings?.seller &&
    typeof database.settings.seller === "object"
      ? database.settings.seller
      : {};

  return {
    sellerName:
      String(
        saved.sellerName ||
        process.env.SELLER_NAME ||
        "ApnaFinds Seller"
      ).trim(),
    storeName:
      String(
        saved.storeName ||
        process.env.SELLER_STORE_NAME ||
        "ApnaFinds"
      ).trim(),
    supportEmail:
      String(
        saved.supportEmail ||
        process.env.SELLER_SUPPORT_EMAIL ||
        "support@apnafinds.com"
      ).trim(),
    supportPhone:
      String(
        saved.supportPhone ||
        process.env.SELLER_SUPPORT_PHONE ||
        "9666337370"
      ).trim(),
    upiId:
      String(
        saved.upiId ||
        process.env.SELLER_UPI_ID ||
        ""
      ).trim(),
    codAdvanceEnabled:
      saved.codAdvanceEnabled === undefined
        ? boolFromValue(
            process.env.COD_ADVANCE_ENABLED,
            true
          )
        : Boolean(saved.codAdvanceEnabled),
    codAdvanceAmount:
      boundedCodAdvance(
        saved.codAdvanceAmount ??
        process.env.COD_ADVANCE_AMOUNT
      ),
    codAdvanceMode:
      ["demo", "manual", "live"].includes(
        String(
          saved.codAdvanceMode ||
          process.env.COD_ADVANCE_MODE ||
          "demo"
        ).toLowerCase()
      )
        ? String(
            saved.codAdvanceMode ||
            process.env.COD_ADVANCE_MODE ||
            "demo"
          ).toLowerCase()
        : "demo"
  };
}

function paymentRecordForOrder(database, order) {
  const orderId = getOrderId(order);

  const stored =
    (database.payments || []).find(item => {
      return String(item.orderId || "") === orderId;
    }) || {};

  const advanceAmount = Number(
    order.advanceAmount ??
    stored.amount ??
    0
  );

  const total = Number(
    order.total ||
    order.orderTotal ||
    0
  );

  const advanceStatus = String(
    order.advancePaymentStatus ||
    stored.status ||
    (
      advanceAmount > 0
        ? "Pending"
        : "Not required"
    )
  );

  const amountPaid =
    ["paid", "verified", "approved"].some(value =>
      advanceStatus.toLowerCase().includes(value)
    )
      ? advanceAmount
      : Number(order.amountPaid || 0);

  return {
    id:
      stored.id ||
      `PAY-${orderId}`,
    orderId,
    customerName:
      order.customerName ||
      stored.customerName ||
      "Customer",
    phone:
      order.phone ||
      stored.phone ||
      order.shippingAddress?.phone ||
      "",
    email:
      order.email ||
      stored.email ||
      "",
    paymentMethod:
      order.paymentMethod ||
      stored.paymentMethod ||
      "COD",
    amount:
      advanceAmount,
    amountPaid,
    status: advanceStatus,
    transactionId:
      order.advanceTransactionId ||
      stored.transactionId ||
      "",
    balanceDue:
      Math.max(
        0,
        Number(
          order.balanceDue ??
          stored.balanceDue ??
          total - amountPaid
        )
      ),
    total,
    mode:
      stored.mode ||
      order.advancePaymentMode ||
      "",
    adminNote:
      stored.adminNote ||
      "",
    createdAt:
      stored.createdAt ||
      order.createdAt ||
      order.date ||
      "",
    updatedAt:
      stored.updatedAt ||
      order.updatedAt ||
      order.createdAt ||
      ""
  };
}

function validateOrder(order) {
  if (
    !order ||
    typeof order !== "object"
  ) {
    return "Order data is required";
  }

  if (!getOrderId(order)) {
    return "Order ID is required";
  }

  if (
    !String(order.customerName || "").trim()
  ) {
    return "Customer name is required";
  }

  if (
    !String(order.phone || "").trim() &&
    !String(order.email || "").trim()
  ) {
    return "Customer phone or email is required";
  }

  if (
    !Array.isArray(order.items) ||
    !order.items.length
  ) {
    return "At least one order item is required";
  }

  if (
    !String(
      order.shippingAddress?.pincode ||
      ""
    ).match(/^[0-9]{6}$/)
  ) {
    return "A valid delivery PIN code is required";
  }

  if (
    order.advancePaymentRequired &&
    (
      Number(order.advanceAmount || 0) < 10 ||
      Number(order.advanceAmount || 0) > 49
    )
  ) {
    return "COD advance payment must be between ₹10 and ₹49";
  }

  if (
    order.advancePaymentRequired &&
    !["paid", "verified", "approved"].some(value =>
      String(
        order.advancePaymentStatus ||
        ""
      ).toLowerCase().includes(value)
    )
  ) {
    return "COD advance payment must be completed before placing the order";
  }

  return "";
}


function findCustomer(database, identifier) {
  const email = normalizeCustomerEmail(identifier);
  const phone = normalizeCustomerPhone(identifier);

  return database.customers.find(customer => (
    (email && normalizeCustomerEmail(customer.email) === email) ||
    (phone && normalizeCustomerPhone(customer.phone) === phone)
  ));
}

function upsertCustomerRecord(database, incoming) {
  const email = normalizeCustomerEmail(incoming.email);
  const phone = normalizeCustomerPhone(incoming.phone);

  const index = database.customers.findIndex(customer => (
    (email && normalizeCustomerEmail(customer.email) === email) ||
    (phone && normalizeCustomerPhone(customer.phone) === phone) ||
    (incoming.id && customer.id === incoming.id)
  ));

  const now = new Date().toISOString();

  const existing = index >= 0
    ? database.customers[index]
    : {};

  const record = {
    ...existing,
    ...incoming,
    id:
      incoming.id ||
      existing.id ||
      stableCustomerId(email || phone || incoming.name),
    name:
      normalizeCustomerName(incoming.name) ||
      existing.name ||
      "Customer",
    email: email || existing.email || "",
    phone: phone || existing.phone || "",
    accountType:
      incoming.accountType ||
      existing.accountType ||
      "registered",
    status:
      incoming.status ||
      existing.status ||
      "Active",
    phoneVerified:
      incoming.phoneVerified ??
      existing.phoneVerified ??
      false,
    emailVerified:
      incoming.emailVerified ??
      existing.emailVerified ??
      false,
    marketingConsent: {
      whatsapp:
        incoming.marketingConsent?.whatsapp ??
        existing.marketingConsent?.whatsapp ??
        false,
      email:
        incoming.marketingConsent?.email ??
        existing.marketingConsent?.email ??
        false
    },
    addresses:
      Array.isArray(incoming.addresses)
        ? incoming.addresses
        : Array.isArray(existing.addresses)
          ? existing.addresses
          : [],
    createdAt:
      existing.createdAt ||
      incoming.createdAt ||
      now,
    updatedAt: now
  };

  if (index >= 0) {
    database.customers[index] = record;
  } else {
    database.customers.unshift(record);
  }

  return record;
}

app.post("/api/auth/otp/send", async (request, response) => {
  try {
    const result = await createChallenge({
      channel: request.body?.channel,
      destination: request.body?.destination,
      purpose: request.body?.purpose || "login",
      ip: request.ip
    });

    response.json({
      ok: true,
      ...result
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/auth/otp/verify", (request, response) => {
  try {
    const result = verifyChallenge({
      challengeId: request.body?.challengeId,
      otp: request.body?.otp
    });

    response.json({
      ok: true,
      ...result
    });
  } catch (error) {
    response.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/auth/register", async (request, response) => {
  const name = normalizeCustomerName(request.body?.name);
  const email = normalizeCustomerEmail(request.body?.email);
  const phone = String(request.body?.phone || "").trim()
    ? normalizeCustomerPhone(request.body?.phone)
    : "";
  const password = String(request.body?.password || "");

  if (name.length < 2) {
    return response.status(400).json({ ok: false, error: "Enter your full name" });
  }

  if (!isValidCustomerEmail(email)) {
    return response.status(400).json({ ok: false, error: "Enter a valid email address" });
  }

  if (phone && !isValidIndianPhone(phone)) {
    return response.status(400).json({ ok: false, error: "Enter a valid Indian mobile number" });
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return response.status(400).json({
      ok: false,
      error: "Password must contain at least 8 characters, one letter and one number"
    });
  }

  const emailVerified = consumeVerificationToken({
    token: request.body?.emailVerificationToken,
    channel: "email",
    destination: email,
    purpose: "register-email"
  });

  if (!emailVerified) {
    return response.status(400).json({
      ok: false,
      error: "Verify your email address first"
    });
  }

  const created = await mutateDatabase(database => {
    if (findCustomer(database, email) || (phone && findCustomer(database, phone))) {
      return null;
    }

    const passwordRecord = hashPassword(password);

    return upsertCustomerRecord(database, {
      id: stableCustomerId(email || phone),
      name,
      email,
      phone: phone || null,
      passwordHash: passwordRecord.hash,
      passwordSalt: passwordRecord.salt,
      accountType: "registered",
      phoneVerified: false,
      emailVerified: true,
      marketingConsent: {
        whatsapp: Boolean(request.body?.marketingConsent?.whatsapp),
        email: Boolean(request.body?.marketingConsent?.email)
      },
      lastLoginAt: new Date().toISOString()
    });
  });

  if (!created) {
    return response.status(409).json({
      ok: false,
      error: "An account already exists with this email or mobile number"
    });
  }

  response.status(201).json({
    ok: true,
    customer: publicCustomer(created),
    session: signCustomerSession(created, true)
  });
});

app.post("/api/auth/login", async (request, response) => {
  const identifier = String(request.body?.identifier || "");
  const password = String(request.body?.password || "");

  const result = await mutateDatabase(database => {
    const customer = findCustomer(database, identifier);

    if (
      !customer ||
      !customer.passwordHash ||
      !verifyPassword(password, customer.passwordSalt, customer.passwordHash)
    ) {
      return null;
    }

    if (String(customer.status || "Active").toLowerCase() === "blocked") {
      return { blocked: true };
    }

    customer.lastLoginAt = new Date().toISOString();
    customer.updatedAt = new Date().toISOString();

    return customer;
  });

  if (!result) {
    return response.status(401).json({
      ok: false,
      error: "Incorrect email/mobile or password"
    });
  }

  if (result.blocked) {
    return response.status(403).json({
      ok: false,
      error: "This account is blocked. Contact ApnaFinds support."
    });
  }

  response.json({
    ok: true,
    customer: publicCustomer(result),
    session: signCustomerSession(result, Boolean(request.body?.remember))
  });
});

app.post("/api/auth/login/otp", async (request, response) => {
  const channel = request.body?.channel === "email" ? "email" : "phone";
  const destination =
    channel === "email"
      ? normalizeCustomerEmail(request.body?.destination)
      : normalizeCustomerPhone(request.body?.destination);

  const verified = consumeVerificationToken({
    token: request.body?.verificationToken,
    channel,
    destination,
    purpose: "login"
  });

  if (!verified) {
    return response.status(400).json({
      ok: false,
      error: "OTP verification is missing or expired"
    });
  }

  const customer = await mutateDatabase(database => {
    const record = findCustomer(database, destination);

    if (!record) return null;

    record.lastLoginAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    return record;
  });

  if (!customer) {
    return response.status(404).json({
      ok: false,
      error: "No registered account was found"
    });
  }

  response.json({
    ok: true,
    customer: publicCustomer(customer),
    session: signCustomerSession(customer, true)
  });
});

app.get("/api/auth/me", async (request, response) => {
  const session = customerSessionFromRequest(request);

  if (!session) {
    return response.status(401).json({
      ok: false,
      error: "Customer login is required"
    });
  }

  const database = await readDatabase();
  const customer = database.customers.find(item => item.id === session.sub);

  if (!customer) {
    return response.status(404).json({
      ok: false,
      error: "Customer account not found"
    });
  }

  response.json({
    ok: true,
    customer: publicCustomer(customer)
  });
});

app.post("/api/auth/logout", (request, response) => {
  response.json({
    ok: true,
    message: "Customer session removed from this browser"
  });
});


app.post(
  "/api/admin/auth/login",
  (request, response) => {
    const result = authenticateCredentials(
      request.body?.email,
      request.body?.password
    );

    if (!result.ok) {
      return response.status(401).json({
        ok: false,
        error: result.error
      });
    }

    const session = signSession(
      result.account,
      Boolean(request.body?.remember)
    );

    response.json({
      ok: true,
      ...session
    });
  }
);

app.get(
  "/api/admin/auth/me",
  requireAdmin,
  (request, response) => {
    const configured = configuredAccount();

    response.json({
      ok: true,
      account: {
        id: request.admin?.id || configured.id,
        name: request.admin?.name || configured.name,
        email: request.admin?.email || configured.email,
        role: "admin"
      },
      authType: request.admin?.authType || "unknown"
    });
  }
);

app.post(
  "/api/admin/auth/logout",
  requireAdmin,
  (request, response) => {
    response.json({
      ok: true,
      message: "Admin session closed in this browser"
    });
  }
);

app.get(
  "/api/health",
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      service: "ApnaFinds",
      time:
        new Date().toISOString(),
      provider:
        logistics.getProviderStatus(),
      counts: {
        orders:
          database.orders.length,
        shipments:
          database.shipments.length,
        returns:
          database.returns.length,
        customers:
          buildAdminCustomers(database).length
      }
    });
  }
);

app.post(
  "/api/orders",
  async (request, response) => {
    const session = customerSessionFromRequest(request);
    const phone = normalizeCustomerPhone(request.body?.phone);

    let verifiedCustomer = null;

    if (session) {
      const database = await readDatabase();
      verifiedCustomer = database.customers.find(item => item.id === session.sub);

      if (!verifiedCustomer) {
        return response.status(403).json({
          ok: false,
          error: "Your session is invalid"
        });
      }
    }

    const validationError =
      validateOrder(request.body);

    if (validationError) {
      return response.status(400).json({
        ok: false,
        error: validationError
      });
    }

    try {
      const orderPayload = {
        ...request.body,
        customerId: verifiedCustomer?.id || "",
        customerType: verifiedCustomer ? "registered" : "guest",
        phoneVerified: false
      };

      const bundle =
        await createOrUpdateOrder(
          orderPayload
        );

      await mutateDatabase(database => {
        const customer = upsertCustomerRecord(database, {
          id: verifiedCustomer?.id,
          name: orderPayload.customerName,
          email: orderPayload.email,
          phone: orderPayload.phone,
          accountType: verifiedCustomer ? "registered" : "guest",
          phoneVerified: false,
          emailVerified: Boolean(verifiedCustomer?.emailVerified),
          marketingConsent: orderPayload.marketingConsent || {
            whatsapp: false,
            email: false
          },
          addresses: [orderPayload.shippingAddress]
        });

        customer.lastOrderAt = orderPayload.createdAt || new Date().toISOString();
        customer.updatedAt = new Date().toISOString();
      });

      response.status(201).json({
        ok: true,
        ...bundle
      });
    } catch (error) {
      console.error(
        "Order creation failed:",
        error
      );

      response.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.get(
  "/api/orders/:orderId",
  async (request, response) => {
    const database =
      await readDatabase();

    const orderId =
      String(request.params.orderId);

    const order =
      database.orders.find(item => {
        return getOrderId(item)
          .toUpperCase() ===
          orderId.toUpperCase();
      });

    if (!order) {
      return response.status(404).json({
        ok: false,
        error: "Order not found"
      });
    }

    if (
      !orderMatchesContact(
        order,
        request.query.contact
      )
    ) {
      return response.status(403).json({
        ok: false,
        error:
          "Order ID and phone/email do not match"
      });
    }

    response.json({
      ok: true,
      ...publicOrderBundle(
        database,
        order
      )
    });
  }
);


app.post(
  "/api/orders/:orderId/refresh-tracking",
  async (request, response) => {
    try {
      const database =
        await readDatabase();

      const requestedId =
        String(request.params.orderId);

      const order =
        database.orders.find(item => {
          return getOrderId(item)
            .toUpperCase() ===
            requestedId.toUpperCase();
        });

      if (!order) {
        return response.status(404).json({
          ok: false,
          error: "Order not found"
        });
      }

      if (
        !orderMatchesContact(
          order,
          request.body.contact
        )
      ) {
        return response.status(403).json({
          ok: false,
          error:
            "Order ID and phone/email do not match"
        });
      }

      const actualOrderId =
        getOrderId(order);

      const shipment =
        database.shipments.find(item => {
          return item.orderId === actualOrderId;
        });

      if (shipment?.awb) {
        try {
          await refreshTracking(actualOrderId);
        } catch (error) {
          console.warn(
            `Customer tracking refresh failed for ${actualOrderId}:`,
            error.message
          );
        }
      }

      const updatedDatabase =
        await readDatabase();

      const updatedOrder =
        updatedDatabase.orders.find(item => {
          return getOrderId(item) === actualOrderId;
        });

      response.json({
        ok: true,
        ...publicOrderBundle(
          updatedDatabase,
          updatedOrder
        )
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/orders/:orderId/cancel",
  async (request, response) => {
    try {
      const order =
        await cancelOrderAndShipment(
          String(
            request.params.orderId
          ),
          request.body.contact
        );

      response.json({
        ok: true,
        order
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/orders/:orderId/return",
  async (request, response) => {
    try {
      const result =
        await createReturnRequest(
          String(
            request.params.orderId
          ),
          request.body.contact,
          request.body
        );

      response.status(201).json({
        ok: true,
        request: result
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.get(
  "/api/logistics/serviceability",
  async (request, response) => {
    try {
      const deliveryPostcode =
        String(
          request.query.deliveryPostcode ||
          ""
        );

      if (
        !/^[0-9]{6}$/.test(
          deliveryPostcode
        )
      ) {
        return response.status(400).json({
          ok: false,
          error:
            "Enter a valid 6-digit delivery PIN code"
        });
      }

      const result =
        await logistics.serviceability({
          deliveryPostcode,
          weight:
            Number(
              request.query.weight ||
              0.5
            ),
          cod:
            String(
              request.query.cod ||
              "true"
            ).toLowerCase() !== "false"
        });

      response.json({
        ok: true,
        ...result
      });
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/assistant/message",
  async (request, response) => {
    try {
      const result =
        await handleAssistant(
          request.body || {}
        );

      response.status(
        result.ok === false
          ? 400
          : 200
      ).json(result);
    } catch (error) {
      console.error(
        "Assistant request failed:",
        error
      );

      response.status(500).json({
        ok: false,
        reply:
          "The support assistant could not complete that request.",
        error: error.message
      });
    }
  }
);

// Admin APIs
app.get(
  "/api/admin/automation/status",
  requireAdmin,
  async (request, response) => {
    const database = await readDatabase();
    const provider = logistics.getProviderStatus();

    response.json({
      ok: true,
      provider,
      worker: {
        enabled:
          String(process.env.AUTO_BOOK_SHIPMENTS || "true").toLowerCase() !== "false",
        intervalSeconds: Math.max(
          10,
          Number(process.env.AUTOMATION_INTERVAL_SECONDS || 20)
        ),
        demoOrderStageSeconds: Math.max(
          5,
          Number(process.env.DEMO_ORDER_STAGE_SECONDS || 45)
        ),
        demoReturnStageSeconds: Math.max(
          5,
          Number(process.env.DEMO_RETURN_STAGE_SECONDS || 60)
        )
      },
      queuedOrders: database.orders.filter(order =>
        ["queued", "booking failed"].includes(
          String(order.automationStatus || "").toLowerCase()
        )
      ).length,
      demoShipments: database.shipments.filter(shipment =>
        String(shipment.mode || "").toLowerCase() === "demo"
      ).length,
      time: new Date().toISOString()
    });
  }
);

app.get(
  "/api/admin/summary",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      provider:
        logistics.getProviderStatus(),
      counts: {
        orders:
          database.orders.length,
        queued:
          database.orders.filter(order =>
            [
              "queued",
              "booking failed"
            ].includes(
              String(
                order.automationStatus ||
                ""
              ).toLowerCase()
            )
          ).length,
        shipments:
          database.shipments.length,
        inTransit:
          database.shipments.filter(
            shipment =>
              ![
                "Delivered",
                "Cancelled"
              ].includes(
                shipment.customerStatus
              )
          ).length,
        returns:
          database.returns.length,
        customers:
          buildAdminCustomers(database).length,
        reversePickups:
          database.returns.filter(
            item =>
              item.reverseShipment
          ).length
      }
    });
  }
);

app.get(
  "/api/admin/orders",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      orders:
        database.orders.map(order =>
          publicOrderBundle(
            database,
            order
          )
        )
    });
  }
);

app.get(
  "/api/admin/returns",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      returns:
        database.returns
    });
  }
);

app.get(
  "/api/admin/events",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      events:
        database.events.slice(0, 200)
    });
  }
);


app.get(
  "/api/admin/customers",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      customers:
        buildAdminCustomers(database)
    });
  }
);

app.get(
  "/api/admin/management",
  requireAdmin,
  async (request, response) => {
    const database =
      await readDatabase();

    response.json({
      ok: true,
      provider:
        logistics.getProviderStatus(),
      orders:
        database.orders.map(order =>
          publicOrderBundle(
            database,
            order
          )
        ),
      customers:
        buildAdminCustomers(database),
      returns:
        database.returns,
      payments:
        database.orders.map(order =>
          paymentRecordForOrder(
            database,
            order
          )
        ),
      seller:
        sellerSettings(database),
      events:
        database.events.slice(0, 100),
      counts: {
        orders:
          database.orders.length,
        shipments:
          database.shipments.length,
        customers:
          buildAdminCustomers(database).length,
        returns:
          database.returns.length,
        revenue:
          database.orders.reduce(
            (sum, order) =>
              sum +
              Number(
                order.total ||
                order.orderTotal ||
                0
              ),
            0
          ),
        advanceCollected:
          database.orders.reduce(
            (sum, order) =>
              sum +
              Number(
                paymentRecordForOrder(
                  database,
                  order
                ).amountPaid || 0
              ),
            0
          ),
        codBalanceDue:
          database.orders.reduce(
            (sum, order) =>
              sum +
              Number(
                paymentRecordForOrder(
                  database,
                  order
                ).balanceDue || 0
              ),
            0
          )
      }
    });
  }
);

app.post(
  "/api/admin/import-customers",
  requireAdmin,
  async (request, response) => {
    const customers =
      Array.isArray(request.body.customers)
        ? request.body.customers
        : [];

    let imported = 0;

    await mutateDatabase(database => {
      for (const incoming of customers) {
        if (
          !incoming ||
          typeof incoming !== "object"
        ) {
          continue;
        }

        const email =
          normalizeAdminContact(
            incoming.email
          );

        const phone =
          normalizeAdminContact(
            incoming.phone ||
            incoming.mobile
          );

        const name =
          String(
            incoming.name ||
            incoming.fullName ||
            ""
          ).trim();

        const key =
          email ||
          phone ||
          normalizeAdminContact(name);

        if (!key) {
          continue;
        }

        const id =
          String(incoming.id || "").trim() ||
          stableCustomerId(key);

        const index =
          database.customers.findIndex(item => {
            return (
              item.id === id ||
              (
                email &&
                normalizeAdminContact(item.email) === email
              ) ||
              (
                phone &&
                normalizeAdminContact(
                  item.phone ||
                  item.mobile
                ) === phone
              )
            );
          });

        const now =
          new Date().toISOString();

        const {
          password,
          passwordHash,
          confirmPassword,
          ...safeIncoming
        } = incoming;

        const normalized = {
          ...safeIncoming,
          id,
          name:
            name ||
            incoming.username ||
            "Customer",
          email,
          phone,
          status:
            String(
              incoming.status ||
              "Active"
            ),
          createdAt:
            incoming.createdAt ||
            now,
          updatedAt: now
        };

        if (index >= 0) {
          database.customers[index] = {
            ...database.customers[index],
            ...normalized
          };
        } else {
          database.customers.unshift(
            normalized
          );
        }

        imported += 1;
      }

      database.events.unshift(
        createEvent(
          "customers.imported",
          `${imported} customers were imported`,
          {
            imported
          }
        )
      );
    });

    response.json({
      ok: true,
      imported
    });
  }
);

app.post(
  "/api/admin/customers/:customerId/status",
  requireAdmin,
  async (request, response) => {
    const allowed = [
      "Active",
      "Blocked"
    ];

    const status =
      String(
        request.body.status || ""
      );

    if (!allowed.includes(status)) {
      return response.status(400).json({
        ok: false,
        error:
          "Customer status must be Active or Blocked"
      });
    }

    const updated =
      await mutateDatabase(database => {
        const customers =
          buildAdminCustomers(database);

        const source =
          customers.find(item => {
            return item.id ===
              String(
                request.params.customerId
              );
          });

        if (!source) {
          return null;
        }

        const index =
          database.customers.findIndex(item => {
            return item.id === source.id;
          });

        const record = {
          ...source,
          status,
          updatedAt:
            new Date().toISOString()
        };

        if (index >= 0) {
          database.customers[index] = {
            ...database.customers[index],
            ...record
          };
        } else {
          database.customers.unshift(
            record
          );
        }

        database.events.unshift(
          createEvent(
            "customer.status",
            `Customer ${source.id} updated to ${status}`,
            {
              customerId: source.id,
              status
            }
          )
        );

        return record;
      });

    if (!updated) {
      return response.status(404).json({
        ok: false,
        error: "Customer not found"
      });
    }

    response.json({
      ok: true,
      customer: updated
    });
  }
);

app.post(
  "/api/admin/orders/:orderId/status",
  requireAdmin,
  async (request, response) => {
    const allowed = [
      "Order placed",
      "Confirmed",
      "Packed",
      "Shipped",
      "In transit",
      "Out for delivery",
      "Delivered",
      "Cancelled"
    ];

    const status =
      String(
        request.body.status || ""
      );

    if (!allowed.includes(status)) {
      return response.status(400).json({
        ok: false,
        error: "Invalid order status"
      });
    }

    const updated =
      await mutateDatabase(database => {
        const requestedId =
          String(
            request.params.orderId
          );

        const order =
          database.orders.find(item => {
            return getOrderId(item)
              .toUpperCase() ===
              requestedId.toUpperCase();
          });

        if (!order) {
          return null;
        }

        const actualOrderId =
          getOrderId(order);

        order.status = status;
        order.adminNote =
          String(
            request.body.adminNote ||
            order.adminNote ||
            ""
          );
        order.updatedAt =
          new Date().toISOString();

        const shipment =
          database.shipments.find(item => {
            return item.orderId === actualOrderId;
          });

        if (shipment) {
          shipment.customerStatus = status;
          shipment.status = status;
          shipment.updatedAt =
            new Date().toISOString();

          shipment.trackingEvents = [
            {
              status,
              activity:
                request.body.activity ||
                `Order status updated to ${status}`,
              location:
                request.body.location ||
                "",
              date:
                new Date().toISOString()
            },
            ...(shipment.trackingEvents || [])
          ];
        }

        database.events.unshift(
          createEvent(
            "order.status",
            `Order ${actualOrderId} updated to ${status}`,
            {
              orderId: actualOrderId,
              status
            }
          )
        );

        return order;
      });

    if (!updated) {
      return response.status(404).json({
        ok: false,
        error: "Order not found"
      });
    }

    response.json({
      ok: true,
      order: updated
    });
  }
);

app.post(
  "/api/admin/import-orders",
  requireAdmin,
  async (request, response) => {
    const orders =
      Array.isArray(request.body.orders)
        ? request.body.orders
        : [];

    let imported = 0;
    const failures = [];

    for (const order of orders) {
      try {
        const validationError =
          validateOrder(order);

        if (validationError) {
          failures.push({
            id: getOrderId(order),
            error: validationError
          });
          continue;
        }

        await createOrUpdateOrder(order);
        imported += 1;
      } catch (error) {
        failures.push({
          id: getOrderId(order),
          error: error.message
        });
      }
    }

    response.json({
      ok: true,
      imported,
      failures
    });
  }
);

app.post(
  "/api/admin/automation/run",
  requireAdmin,
  async (request, response) => {
    try {
      const result =
        await processQueuedOrders();

      response.json({
        ok: true,
        ...result
      });
    } catch (error) {
      response.status(500).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/orders/:orderId/book-shipment",
  requireAdmin,
  async (request, response) => {
    try {
      const shipment =
        await bookShipmentForOrder(
          String(
            request.params.orderId
          )
        );

      response.json({
        ok: true,
        shipment
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/orders/:orderId/refresh-tracking",
  requireAdmin,
  async (request, response) => {
    try {
      const shipment =
        await refreshTracking(
          String(
            request.params.orderId
          )
        );

      response.json({
        ok: true,
        shipment
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/orders/:orderId/cancel",
  requireAdmin,
  async (request, response) => {
    try {
      const order =
        await cancelOrderAndShipment(
          String(
            request.params.orderId
          ),
          "",
          {
            admin: true
          }
        );

      response.json({
        ok: true,
        order
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/returns/:requestId/reverse-pickup",
  requireAdmin,
  async (request, response) => {
    try {
      const reverseShipment =
        await createReversePickup(
          String(
            request.params.requestId
          )
        );

      response.json({
        ok: true,
        reverseShipment
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: error.message
      });
    }
  }
);

app.post(
  "/api/admin/returns/:requestId/status",
  requireAdmin,
  async (request, response) => {
    const allowed = [
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

    const status =
      String(
        request.body.status || ""
      );

    if (!allowed.includes(status)) {
      return response.status(400).json({
        ok: false,
        error: "Invalid return status"
      });
    }

    const updated =
      await mutateDatabase(database => {
        const target =
          database.returns.find(item => {
            return item.id ===
              String(
                request.params.requestId
              );
          });

        if (!target) {
          return null;
        }

        target.status = status;
        target.adminNote =
          String(
            request.body.adminNote ||
            target.adminNote ||
            ""
          );
        target.updatedAt =
          new Date().toISOString();

        if (
          ["Refund Initiated", "Refunded"].includes(status)
        ) {
          const connectedOrder =
            database.orders.find(order => {
              return getOrderId(order) === target.orderId;
            });

          if (connectedOrder) {
            connectedOrder.refundStatus = status;
            connectedOrder.refundAmount =
              Number(target.estimatedValue || 0);
            connectedOrder.refundRequestId =
              target.id;
            connectedOrder.updatedAt =
              target.updatedAt;

            if (
              status === "Refunded" &&
              target.type === "Cancellation"
            ) {
              connectedOrder.paymentStatus =
                "COD advance refunded";
            }
          }

          const payment =
            database.payments?.find(item => {
              return item.orderId === target.orderId;
            });

          if (
            payment &&
            status === "Refunded" &&
            target.type === "Cancellation"
          ) {
            payment.status = "Refunded";
            payment.adminNote =
              "COD advance refund marked complete by the administrator";
            payment.updatedAt =
              target.updatedAt;
          }
        }

        database.events.unshift(
          createEvent(
            "return.status",
            `Return ${target.id} updated to ${status}`,
            {
              requestId: target.id,
              status
            }
          )
        );

        return target;
      });

    if (!updated) {
      return response.status(404).json({
        ok: false,
        error:
          "Return request not found"
      });
    }

    response.json({
      ok: true,
      request: updated
    });
  }
);

app.post(
  "/api/logistics/webhook/shiprocket",
  async (request, response) => {
    const expected =
      String(
        process.env.LOGISTICS_WEBHOOK_SECRET ||
        ""
      );

    const supplied =
      String(
        request.get(
          "x-apnafinds-webhook-secret"
        ) ||
        request.query.secret ||
        ""
      );

    if (
      expected &&
      supplied !== expected
    ) {
      return response.status(401).json({
        ok: false,
        error: "Invalid webhook secret"
      });
    }

    const payload = request.body || {};

    const awb = String(
      payload.awb ||
      payload.awb_code ||
      payload.awb_number ||
      ""
    );

    const status = String(
      payload.current_status ||
      payload.status ||
      payload.shipment_status ||
      ""
    );

    const updated =
      await mutateDatabase(database => {
        const shipment =
          database.shipments.find(item => {
            return (
              item.awb === awb ||
              item.shipmentId ===
                String(
                  payload.shipment_id ||
                  ""
                )
            );
          });

        if (!shipment) {
          return null;
        }

        shipment.status =
          status || shipment.status;
        shipment.customerStatus =
          logistics.toCustomerStatus(
            status
          );
        shipment.updatedAt =
          new Date().toISOString();
        shipment.trackingEvents = [
          {
            status:
              status || "Update",
            activity:
              payload.activity ||
              payload.message ||
              status ||
              "Courier status updated",
            location:
              payload.location || "",
            date:
              payload.timestamp ||
              payload.updated_at ||
              new Date().toISOString()
          },
          ...(shipment.trackingEvents || [])
        ];

        const order =
          database.orders.find(item => {
            return getOrderId(item) ===
              shipment.orderId;
          });

        if (order) {
          order.status =
            shipment.customerStatus;
          order.updatedAt =
            new Date().toISOString();
        }

        database.events.unshift(
          createEvent(
            "shipment.webhook",
            `Courier webhook updated ${shipment.orderId}`,
            {
              orderId:
                shipment.orderId,
              awb,
              status
            }
          )
        );

        return shipment;
      });

    response.json({
      ok: true,
      matched: Boolean(updated)
    });
  }
);


app.get(
  "/api/store/payment-settings",
  async (request, response) => {
    const database = await readDatabase();
    const settings = sellerSettings(database);

    response.json({
      ok: true,
      storeName: settings.storeName,
      sellerName: settings.sellerName,
      supportEmail: settings.supportEmail,
      supportPhone: settings.supportPhone,
      upiId: settings.upiId,
      codAdvanceEnabled: settings.codAdvanceEnabled,
      codAdvanceAmount: settings.codAdvanceAmount,
      codAdvanceMode: settings.codAdvanceMode,
      minimum: 10,
      maximum: 49
    });
  }
);

app.post(
  "/api/payments/cod-advance/demo",
  async (request, response) => {
    const database = await readDatabase();
    const settings = sellerSettings(database);

    if (!settings.codAdvanceEnabled) {
      return response.status(400).json({
        ok: false,
        error: "COD advance payment is not enabled"
      });
    }

    if (settings.codAdvanceMode !== "demo") {
      return response.status(400).json({
        ok: false,
        error:
          "Automatic demo payment is disabled. Connect a real payment gateway or use manual verification."
      });
    }

    const orderId = String(
      request.body?.orderId || ""
    ).trim();

    if (!orderId) {
      return response.status(400).json({
        ok: false,
        error: "Order ID is required"
      });
    }

    const requestedAmount = Number(
      request.body?.amount
    );

    if (
      requestedAmount !==
      settings.codAdvanceAmount
    ) {
      return response.status(400).json({
        ok: false,
        error:
          `The required COD advance is ₹${settings.codAdvanceAmount}`
      });
    }

    const now = new Date().toISOString();
    const transactionId =
      `DEMO-UPI-${Date.now()}` +
      Math.floor(100 + Math.random() * 900);

    const payment =
      await mutateDatabase(databaseToUpdate => {
        const record = {
          id:
            `PAY${Date.now()}` +
            Math.floor(100 + Math.random() * 900),
          orderId,
          customerName:
            String(
              request.body?.customerName ||
              "Customer"
            ).trim(),
          phone:
            String(
              request.body?.phone || ""
            ).trim(),
          email:
            String(
              request.body?.email || ""
            ).trim().toLowerCase(),
          paymentMethod:
            "COD Advance",
          amount:
            settings.codAdvanceAmount,
          amountPaid:
            settings.codAdvanceAmount,
          status: "Paid",
          transactionId,
          mode: "demo",
          total:
            Number(request.body?.total || 0),
          balanceDue:
            Math.max(
              0,
              Number(request.body?.total || 0) -
              settings.codAdvanceAmount
            ),
          createdAt: now,
          updatedAt: now
        };

        const index =
          databaseToUpdate.payments.findIndex(item => {
            return item.orderId === orderId;
          });

        if (index >= 0) {
          databaseToUpdate.payments[index] = {
            ...databaseToUpdate.payments[index],
            ...record
          };
        } else {
          databaseToUpdate.payments.unshift(record);
        }

        databaseToUpdate.events.unshift(
          createEvent(
            "payment.cod_advance_paid",
            `COD advance payment received for ${orderId}`,
            {
              orderId,
              amount: settings.codAdvanceAmount,
              transactionId,
              mode: "demo"
            }
          )
        );

        return record;
      });

    response.status(201).json({
      ok: true,
      payment
    });
  }
);

app.get(
  "/api/admin/seller-settings",
  requireAdmin,
  async (request, response) => {
    const database = await readDatabase();

    response.json({
      ok: true,
      seller: sellerSettings(database),
      account: {
        name:
          request.admin?.name ||
          configuredAccount().name,
        email:
          request.admin?.email ||
          configuredAccount().email,
        role: "Administrator"
      },
      security: {
        passwordsVisible: false,
        message:
          "Customer passwords must never be visible to sellers or administrators."
      }
    });
  }
);

app.post(
  "/api/admin/seller-settings",
  requireAdmin,
  async (request, response) => {
    const incoming = request.body || {};

    const codAdvanceAmount =
      boundedCodAdvance(
        incoming.codAdvanceAmount
      );

    const codAdvanceMode =
      ["demo", "manual", "live"].includes(
        String(
          incoming.codAdvanceMode || ""
        ).toLowerCase()
      )
        ? String(
            incoming.codAdvanceMode
          ).toLowerCase()
        : "demo";

    const saved =
      await mutateDatabase(database => {
        database.settings =
          database.settings || {};

        database.settings.seller = {
          sellerName:
            String(
              incoming.sellerName ||
              "ApnaFinds Seller"
            ).trim(),
          storeName:
            String(
              incoming.storeName ||
              "ApnaFinds"
            ).trim(),
          supportEmail:
            String(
              incoming.supportEmail ||
              ""
            ).trim(),
          supportPhone:
            String(
              incoming.supportPhone ||
              ""
            ).trim(),
          upiId:
            String(
              incoming.upiId ||
              ""
            ).trim(),
          codAdvanceEnabled:
            Boolean(
              incoming.codAdvanceEnabled
            ),
          codAdvanceAmount,
          codAdvanceMode,
          updatedAt:
            new Date().toISOString()
        };

        database.events.unshift(
          createEvent(
            "seller.settings_updated",
            "Seller account and COD payment settings were updated",
            {
              codAdvanceAmount,
              codAdvanceMode
            }
          )
        );

        return database.settings.seller;
      });

    response.json({
      ok: true,
      seller: saved
    });
  }
);

app.get(
  "/api/admin/payments",
  requireAdmin,
  async (request, response) => {
    const database = await readDatabase();

    const payments =
      database.orders.map(order =>
        paymentRecordForOrder(
          database,
          order
        )
      );

    response.json({
      ok: true,
      payments,
      counts: {
        records: payments.length,
        advanceCollected:
          payments.reduce(
            (sum, payment) =>
              sum + Number(payment.amountPaid || 0),
            0
          ),
        pending:
          payments.filter(payment =>
            String(payment.status)
              .toLowerCase()
              .includes("pending")
          ).length,
        codBalanceDue:
          payments.reduce(
            (sum, payment) =>
              sum + Number(payment.balanceDue || 0),
            0
          )
      }
    });
  }
);

app.post(
  "/api/admin/payments/:orderId/status",
  requireAdmin,
  async (request, response) => {
    const orderId =
      String(request.params.orderId || "").trim();

    const allowed = [
      "Pending",
      "Paid",
      "Verified",
      "Rejected",
      "Refunded"
    ];

    const status =
      String(request.body?.status || "").trim();

    if (!allowed.includes(status)) {
      return response.status(400).json({
        ok: false,
        error: "Invalid payment status"
      });
    }

    const updated =
      await mutateDatabase(database => {
        const order =
          database.orders.find(item => {
            return getOrderId(item) === orderId;
          });

        if (!order) {
          return null;
        }

        const settings = sellerSettings(database);
        const amount =
          Number(
            order.advanceAmount ||
            settings.codAdvanceAmount ||
            0
          );

        order.advancePaymentStatus = status;
        order.paymentStatus =
          ["Paid", "Verified"].includes(status)
            ? `Advance ${status.toLowerCase()}; COD balance pending`
            : `Advance ${status.toLowerCase()}`;
        order.amountPaid =
          ["Paid", "Verified"].includes(status)
            ? amount
            : 0;
        order.balanceDue =
          Math.max(
            0,
            Number(
              order.total ||
              order.orderTotal ||
              0
            ) -
            order.amountPaid
          );
        order.automationStatus =
          ["Paid", "Verified"].includes(status)
            ? "Queued"
            : "Waiting for COD advance";
        order.updatedAt =
          new Date().toISOString();

        const paymentIndex =
          database.payments.findIndex(item => {
            return item.orderId === orderId;
          });

        const payment = {
          id:
            paymentIndex >= 0
              ? database.payments[paymentIndex].id
              : `PAY${Date.now()}`,
          orderId,
          customerName:
            order.customerName ||
            "Customer",
          phone:
            order.phone ||
            order.shippingAddress?.phone ||
            "",
          email:
            order.email ||
            "",
          paymentMethod:
            "COD Advance",
          amount,
          amountPaid:
            order.amountPaid,
          status,
          transactionId:
            String(
              request.body?.transactionId ||
              order.advanceTransactionId ||
              ""
            ).trim(),
          adminNote:
            String(
              request.body?.adminNote ||
              ""
            ).trim(),
          total:
            Number(
              order.total ||
              order.orderTotal ||
              0
            ),
          balanceDue:
            order.balanceDue,
          mode:
            order.advancePaymentMode ||
            sellerSettings(database).codAdvanceMode,
          createdAt:
            paymentIndex >= 0
              ? database.payments[paymentIndex].createdAt
              : new Date().toISOString(),
          updatedAt:
            new Date().toISOString()
        };

        if (paymentIndex >= 0) {
          database.payments[paymentIndex] = payment;
        } else {
          database.payments.unshift(payment);
        }

        database.events.unshift(
          createEvent(
            "payment.status_updated",
            `Payment for ${orderId} updated to ${status}`,
            {
              orderId,
              status,
              amount
            }
          )
        );

        return {
          order,
          payment
        };
      });

    if (!updated) {
      return response.status(404).json({
        ok: false,
        error: "Order not found"
      });
    }

    if (
      ["Paid", "Verified"].includes(status) &&
      String(
        process.env.AUTO_BOOK_SHIPMENTS ||
        "true"
      ).toLowerCase() !== "false"
    ) {
      try {
        await bookShipmentForOrder(orderId);
      } catch (error) {
        console.error(
          `Shipment booking after payment verification failed for ${orderId}:`,
          error.message
        );
      }
    }

    response.json({
      ok: true,
      ...updated
    });
  }
);

app.get(
  "/api/admin/customer-details",
  requireAdmin,
  async (request, response) => {
    const database = await readDatabase();
    const customers = buildAdminCustomers(database);

    response.json({
      ok: true,
      customers:
        customers.map(customer => {
          const orders =
            database.orders.filter(order => {
              const email =
                normalizeAdminContact(order.email);
              const phone =
                normalizeAdminContact(
                  order.phone ||
                  order.shippingAddress?.phone
                );

              return (
                (
                  customer.email &&
                  email ===
                    normalizeAdminContact(customer.email)
                ) ||
                (
                  customer.phone &&
                  phone ===
                    normalizeAdminContact(customer.phone)
                )
              );
            });

          const payments =
            orders.map(order =>
              paymentRecordForOrder(
                database,
                order
              )
            );

          return {
            ...customer,
            passwordVisible: false,
            orders:
              orders.map(order => ({
                id: getOrderId(order),
                status: order.status,
                total:
                  Number(
                    order.total ||
                    order.orderTotal ||
                    0
                  ),
                payment:
                  paymentRecordForOrder(
                    database,
                    order
                  ),
                createdAt:
                  order.createdAt ||
                  order.date
              })),
            advancePaid:
              payments.reduce(
                (sum, payment) =>
                  sum +
                  Number(payment.amountPaid || 0),
                0
              ),
            codBalanceDue:
              payments.reduce(
                (sum, payment) =>
                  sum +
                  Number(payment.balanceDue || 0),
                0
              )
          };
        })
    });
  }
);


app.use(
  express.static(
    PUBLIC_DIR,
    {
      extensions: ["html"],
      dotfiles: "ignore"
    }
  )
);

app.use((request, response) => {
  response.status(404).sendFile(
    path.join(
      PUBLIC_DIR,
      "404.html"
    )
  );
});

async function start() {
  await ensureDatabase();

  try {
    await verifyMailConnection();
  } catch (error) {
    console.error(
      "Zoho SMTP connection failed:",
      error.message
    );
  }

  app.listen(PORT, () => {
    console.log("");
    console.log(`ApnaFinds is running at http://localhost:${PORT}`);
    console.log(`Admin login: http://localhost:${PORT}/admin-login.html`);
    console.log(`Admin logistics: http://localhost:${PORT}/admin-logistics.html`);
    console.log(`Admin management: http://localhost:${PORT}/admin-management.html`);
    console.log(`Logistics mode: ${logistics.getProviderStatus().mode}`);
    console.log("");
  });

  const automationIntervalSeconds = Math.max(
    10,
    Number(process.env.AUTOMATION_INTERVAL_SECONDS || 20)
  );

  const runAutomaticProcess = async () => {
    try {
      const booking = await processQueuedOrders();
      const demoTracking = await advanceDemoShipments();
      const demoReturns = await advanceDemoReturns();

      if (
        booking.processed ||
        demoTracking.advanced ||
        demoReturns.advanced
      ) {
        console.log(
          `[automation] booked=${booking.processed || 0}, tracking=${demoTracking.advanced || 0}, returns=${demoReturns.advanced || 0}`
        );
      }
    } catch (error) {
      console.error(
        "Background automation failed:",
        error.message
      );
    }
  };

  setTimeout(runAutomaticProcess, 1200).unref();

  setInterval(
    runAutomaticProcess,
    automationIntervalSeconds * 1000
  ).unref();
}

start().catch(error => {
  console.error("Server failed to start:", error);
  process.exitCode = 1;
});
  const automationIntervalSeconds =
    Math.max(
      10,
      Number(
        process.env.AUTOMATION_INTERVAL_SECONDS ||
        20
      )
    );

  const runAutomaticProcess = async () => {
    try {
      const booking = await processQueuedOrders();
      const demoTracking = await advanceDemoShipments();
      const demoReturns = await advanceDemoReturns();

      if (
        booking.processed ||
        demoTracking.advanced ||
        demoReturns.advanced
      ) {
        console.log(
          `[automation] booked=${booking.processed || 0}, ` +
          `tracking=${demoTracking.advanced || 0}, ` +
          `returns=${demoReturns.advanced || 0}`
        );
      }
    } catch (error) {
      console.error(
        "Background automation failed:",
        error.message
      );
    }
  };

  setTimeout(runAutomaticProcess, 1200).unref();

  setInterval(
    runAutomaticProcess,
    automationIntervalSeconds * 1000
  ).unref();
}

start().catch(error => {
  console.error(
    "Server failed to start:",
    error
  );

  process.exitCode = 1;
});
