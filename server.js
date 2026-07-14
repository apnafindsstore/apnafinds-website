require("dotenv").config();

const path = require("path");
const express = require("express");

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

  return "";
}

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
    const validationError =
      validateOrder(request.body);

    if (validationError) {
      return response.status(400).json({
        ok: false,
        error: validationError
      });
    }

    try {
      const bundle =
        await createOrUpdateOrder(
          request.body
        );

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

        const normalized = {
          ...incoming,
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

  app.listen(PORT, () => {
    console.log("");
    console.log(
      `ApnaFinds is running at http://localhost:${PORT}`
    );
    console.log(
      `Admin login: http://localhost:${PORT}/admin-login.html`
    );
    console.log(
      `Admin logistics: http://localhost:${PORT}/admin-logistics.html`
    );
    console.log(
      `Admin management: http://localhost:${PORT}/admin-management.html`
    );
    console.log(
      `Logistics mode: ${logistics.getProviderStatus().mode}`
    );
    console.log("");
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
