const {
  readDatabase,
  mutateDatabase,
  createEvent
} = require("./storage");

const {
  LogisticsAdapter
} = require("./logistics");

const {
  notifyTeam
} = require("./notifier");

const logistics =
  new LogisticsAdapter();

function isAutoBookingEnabled() {
  return String(
    process.env.AUTO_BOOK_SHIPMENTS ||
    "true"
  ).toLowerCase() !== "false";
}

function getOrderId(order) {
  return String(
    order?.id ||
    order?.orderId ||
    ""
  );
}

function normalizeContact(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function orderMatchesContact(
  order,
  contact
) {
  const normalized =
    normalizeContact(contact);

  if (!normalized) {
    return false;
  }

  const phone =
    normalizeContact(
      order.phone ||
      order.shippingAddress?.phone
    );

  const email =
    normalizeContact(order.email);

  return (
    normalized === phone ||
    normalized === email
  );
}

function publicOrderBundle(
  database,
  order
) {
  const orderId = getOrderId(order);

  const shipment =
    database.shipments.find(item => {
      return item.orderId === orderId;
    }) || null;

  const returns =
    database.returns.filter(item => {
      return item.orderId === orderId;
    });

  return {
    order,
    shipment,
    returns,
    provider:
      logistics.getProviderStatus()
  };
}

async function createOrUpdateOrder(
  incomingOrder
) {
  const orderId =
    getOrderId(incomingOrder);

  if (!orderId) {
    throw new Error(
      "Order ID is required"
    );
  }

  const now =
    new Date().toISOString();

  const order =
    await mutateDatabase(database => {
      const index =
        database.orders.findIndex(item => {
          return getOrderId(item) === orderId;
        });

      const normalized = {
        ...incomingOrder,
        id: orderId,
        orderId,
        status:
          incomingOrder.status ||
          "Order placed",
        createdAt:
          incomingOrder.createdAt ||
          incomingOrder.date ||
          now,
        updatedAt: now,
        automationStatus:
          incomingOrder.automationStatus ||
          "Queued",
        automationAttempts:
          Number(
            incomingOrder.automationAttempts ||
            0
          )
      };

      if (index >= 0) {
        database.orders[index] = {
          ...database.orders[index],
          ...normalized
        };
      } else {
        database.orders.unshift(
          normalized
        );
      }

      database.events.unshift(
        createEvent(
          "order.received",
          `Order ${orderId} was received`,
          {
            orderId
          }
        )
      );

      return database.orders.find(item => {
        return getOrderId(item) === orderId;
      });
    });

  if (isAutoBookingEnabled()) {
    try {
      await bookShipmentForOrder(orderId);
    } catch (error) {
      console.error(
        `Automatic shipment failed for ${orderId}:`,
        error.message
      );
    }
  }

  const database =
    await readDatabase();

  const savedOrder =
    database.orders.find(item => {
      return getOrderId(item) === orderId;
    });

  return publicOrderBundle(
    database,
    savedOrder
  );
}

async function bookShipmentForOrder(
  orderId
) {
  const database =
    await readDatabase();

  const order =
    database.orders.find(item => {
      return getOrderId(item) === orderId;
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  const existing =
    database.shipments.find(item => {
      return item.orderId === orderId &&
        ![
          "Cancelled",
          "Failed"
        ].includes(item.status);
    });

  if (existing?.awb) {
    return existing;
  }

  await mutateDatabase(databaseToUpdate => {
    const target =
      databaseToUpdate.orders.find(item => {
        return getOrderId(item) === orderId;
      });

    if (target) {
      target.automationStatus =
        "Booking courier";
      target.automationAttempts =
        Number(
          target.automationAttempts || 0
        ) + 1;
      target.updatedAt =
        new Date().toISOString();
    }
  });

  try {
    const booked =
      await logistics.bookOrder(order);

    const shipment =
      await mutateDatabase(databaseToUpdate => {
        const now =
          new Date().toISOString();

        const record = {
          id:
            `SHP${Date.now()}` +
            Math.floor(
              100 + Math.random() * 900
            ),
          orderId,
          ...booked,
          createdAt: now,
          updatedAt: now,
          demoStageUpdatedAt:
            booked.mode === "demo"
              ? now
              : undefined
        };

        const shipmentIndex =
          databaseToUpdate.shipments.findIndex(
            item =>
              item.orderId === orderId
          );

        if (shipmentIndex >= 0) {
          databaseToUpdate.shipments[
            shipmentIndex
          ] = {
            ...databaseToUpdate.shipments[
              shipmentIndex
            ],
            ...record
          };
        } else {
          databaseToUpdate.shipments.unshift(
            record
          );
        }

        const targetOrder =
          databaseToUpdate.orders.find(item => {
            return getOrderId(item) ===
              orderId;
          });

        if (targetOrder) {
          targetOrder.automationStatus =
            "Courier booked";
          targetOrder.shipmentId =
            record.shipmentId;
          targetOrder.awb = record.awb;
          targetOrder.courier =
            record.courier;
          targetOrder.status =
            record.customerStatus ||
            targetOrder.status ||
            "Confirmed";
          targetOrder.updatedAt = now;
        }

        databaseToUpdate.events.unshift(
          createEvent(
            "shipment.booked",
            `Courier booked for ${orderId}`,
            {
              orderId,
              awb: record.awb,
              courier: record.courier,
              mode: record.mode
            }
          )
        );

        return record;
      });

    await notifyTeam(
      "shipment.booked",
      shipment
    );

    return shipment;
  } catch (error) {
    await mutateDatabase(databaseToUpdate => {
      const target =
        databaseToUpdate.orders.find(item => {
          return getOrderId(item) === orderId;
        });

      if (target) {
        target.automationStatus =
          "Booking failed";
        target.automationError =
          error.message;
        target.updatedAt =
          new Date().toISOString();
      }

      databaseToUpdate.events.unshift(
        createEvent(
          "shipment.failed",
          `Courier booking failed for ${orderId}`,
          {
            orderId,
            error: error.message
          }
        )
      );
    });

    await notifyTeam(
      "shipment.failed",
      {
        orderId,
        error: error.message
      }
    );

    throw error;
  }
}

const DEMO_ORDER_STAGES = [
  {
    status: "Confirmed",
    shipmentStatus: "Pickup Scheduled",
    activity: "Courier pickup has been scheduled"
  },
  {
    status: "Packed",
    shipmentStatus: "Ready for Pickup",
    activity: "The seller packed the order and prepared it for pickup"
  },
  {
    status: "Shipped",
    shipmentStatus: "Picked Up",
    activity: "The courier collected the package"
  },
  {
    status: "In transit",
    shipmentStatus: "In Transit",
    activity: "The package is moving through the courier network"
  },
  {
    status: "Out for delivery",
    shipmentStatus: "Out for Delivery",
    activity: "The package is out for delivery"
  },
  {
    status: "Delivered",
    shipmentStatus: "Delivered",
    activity: "The package was delivered successfully"
  }
];

function demoStageIndex(status) {
  const normalized = String(status || "").trim().toLowerCase();
  const index = DEMO_ORDER_STAGES.findIndex(stage => {
    return stage.status.toLowerCase() === normalized;
  });

  if (index >= 0) {
    return index;
  }

  if (normalized.includes("deliver") && !normalized.includes("out")) return 5;
  if (normalized.includes("out for")) return 4;
  if (normalized.includes("transit")) return 3;
  if (normalized.includes("ship")) return 2;
  if (normalized.includes("pack")) return 1;
  return 0;
}

function demoOrderStageSeconds() {
  return Math.max(
    5,
    Number(process.env.DEMO_ORDER_STAGE_SECONDS || 45)
  );
}

function demoReturnStageSeconds() {
  return Math.max(
    5,
    Number(process.env.DEMO_RETURN_STAGE_SECONDS || 60)
  );
}

async function advanceDemoShipments({
  force = false,
  orderId = ""
} = {}) {
  return mutateDatabase(database => {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const intervalMs = demoOrderStageSeconds() * 1000;
    let advanced = 0;
    const updatedOrderIds = [];

    for (const shipment of database.shipments) {
      if (
        String(shipment.mode || "").toLowerCase() !== "demo" &&
        !String(shipment.awb || "").startsWith("APNA")
      ) {
        continue;
      }

      if (orderId && shipment.orderId !== orderId) {
        continue;
      }

      const order = database.orders.find(item => {
        return getOrderId(item) === shipment.orderId;
      });

      if (!order) {
        continue;
      }

      const currentStatus = String(order.status || shipment.customerStatus || "Confirmed");

      if (/cancel|deliver/.test(currentStatus.toLowerCase()) && !currentStatus.toLowerCase().includes("out")) {
        continue;
      }

      const currentIndex = demoStageIndex(currentStatus);
      const lastUpdate = new Date(
        shipment.demoStageUpdatedAt ||
        shipment.updatedAt ||
        shipment.createdAt ||
        now
      ).getTime();

      const elapsed = Math.max(0, nowMs - (Number.isFinite(lastUpdate) ? lastUpdate : nowMs));
      const steps = force ? 1 : Math.floor(elapsed / intervalMs);

      if (steps < 1 || currentIndex >= DEMO_ORDER_STAGES.length - 1) {
        continue;
      }

      const nextIndex = Math.min(
        DEMO_ORDER_STAGES.length - 1,
        currentIndex + steps
      );
      const next = DEMO_ORDER_STAGES[nextIndex];

      order.status = next.status;
      order.updatedAt = now;
      shipment.customerStatus = next.status;
      shipment.status = next.shipmentStatus;
      shipment.updatedAt = now;
      shipment.demoStageUpdatedAt = now;
      shipment.trackingEvents = [
        {
          status: next.status,
          activity: next.activity,
          location: next.status === "Delivered" ? "Delivery address" : "ApnaFinds Demo Network",
          date: now
        },
        ...(shipment.trackingEvents || [])
      ];

      database.events.unshift(
        createEvent(
          "shipment.demo-progress",
          `Demo shipment ${shipment.orderId} advanced to ${next.status}`,
          {
            orderId: shipment.orderId,
            awb: shipment.awb,
            status: next.status
          }
        )
      );

      advanced += 1;
      updatedOrderIds.push(shipment.orderId);
    }

    return {
      advanced,
      orderIds: updatedOrderIds
    };
  });
}

async function advanceDemoReturns() {
  return mutateDatabase(database => {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const intervalMs = demoReturnStageSeconds() * 1000;
    let advanced = 0;

    for (const request of database.returns) {
      if (
        String(request.reverseShipment?.mode || "").toLowerCase() !== "demo" ||
        ["Refunded", "Replacement Shipped", "Rejected", "Closed"].includes(String(request.status || ""))
      ) {
        continue;
      }

      const lastUpdate = new Date(
        request.demoStageUpdatedAt ||
        request.updatedAt ||
        request.createdAt ||
        now
      ).getTime();
      const elapsed = Math.max(0, nowMs - (Number.isFinite(lastUpdate) ? lastUpdate : nowMs));

      if (elapsed < intervalMs) {
        continue;
      }

      const type = String(request.type || "Return").toLowerCase();
      let nextStatus = "";

      if (["Requested", "Under Review", "Approved", "Pickup Scheduled"].includes(request.status)) {
        nextStatus = "Received";
      } else if (request.status === "Received") {
        nextStatus = type.includes("replace") ? "Replacement Shipped" : "Refund Initiated";
      } else if (request.status === "Refund Initiated") {
        nextStatus = "Refunded";
      }

      if (!nextStatus) {
        continue;
      }

      request.status = nextStatus;
      request.updatedAt = now;
      request.demoStageUpdatedAt = now;
      request.adminNote = request.adminNote || "Updated automatically by demo workflow";

      database.events.unshift(
        createEvent(
          "return.demo-progress",
          `Return ${request.id} advanced to ${nextStatus}`,
          {
            requestId: request.id,
            orderId: request.orderId,
            status: nextStatus
          }
        )
      );

      advanced += 1;
    }

    return { advanced };
  });
}

async function refreshTracking(
  orderId
) {
  const database =
    await readDatabase();

  const shipment =
    database.shipments.find(item => {
      return item.orderId === orderId;
    });

  if (!shipment) {
    throw new Error(
      "Shipment has not been booked"
    );
  }

  if (
    String(shipment.mode || "").toLowerCase() === "demo" ||
    String(shipment.awb || "").startsWith("APNA")
  ) {
    await advanceDemoShipments({
      force: true,
      orderId
    });

    const updatedDatabase = await readDatabase();
    return updatedDatabase.shipments.find(item => item.orderId === orderId);
  }

  const tracking =
    await logistics.track(shipment.awb);

  return mutateDatabase(databaseToUpdate => {
    const shipmentToUpdate =
      databaseToUpdate.shipments.find(item => {
        return item.orderId === orderId;
      });

    const order =
      databaseToUpdate.orders.find(item => {
        return getOrderId(item) === orderId;
      });

    const now =
      new Date().toISOString();

    if (shipmentToUpdate) {
      Object.assign(
        shipmentToUpdate,
        tracking,
        {
          updatedAt: now
        }
      );
    }

    if (order) {
      order.status =
        tracking.customerStatus ||
        order.status;
      order.updatedAt = now;
    }

    databaseToUpdate.events.unshift(
      createEvent(
        "shipment.tracking",
        `Tracking refreshed for ${orderId}`,
        {
          orderId,
          status:
            tracking.customerStatus ||
            tracking.status
        }
      )
    );

    return shipmentToUpdate;
  });
}

async function cancelOrderAndShipment(
  orderId,
  contact,
  {
    admin = false
  } = {}
) {
  const database =
    await readDatabase();

  const order =
    database.orders.find(item => {
      return getOrderId(item) === orderId;
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  if (
    !admin &&
    !orderMatchesContact(order, contact)
  ) {
    throw new Error(
      "Order ID and phone/email do not match"
    );
  }

  const status =
    String(order.status || "")
      .toLowerCase();

  const eligible = [
    "order placed",
    "confirmed",
    "packed"
  ].includes(status);

  if (!eligible) {
    throw new Error(
      "This order can no longer be self-cancelled because courier processing has started"
    );
  }

  const shipment =
    database.shipments.find(item => {
      return item.orderId === orderId;
    });

  if (shipment) {
    await logistics.cancelShipment(
      shipment
    );
  }

  const result =
    await mutateDatabase(databaseToUpdate => {
      const targetOrder =
        databaseToUpdate.orders.find(item => {
          return getOrderId(item) ===
            orderId;
        });

      const targetShipment =
        databaseToUpdate.shipments.find(item => {
          return item.orderId === orderId;
        });

      const now =
        new Date().toISOString();

      if (targetOrder) {
        targetOrder.status = "Cancelled";
        targetOrder.automationStatus =
          "Cancelled";
        targetOrder.cancelledAt = now;
        targetOrder.updatedAt = now;
      }

      if (targetShipment) {
        targetShipment.status =
          "Cancelled";
        targetShipment.customerStatus =
          "Cancelled";
        targetShipment.updatedAt = now;
      }

      databaseToUpdate.events.unshift(
        createEvent(
          "order.cancelled",
          `Order ${orderId} was cancelled`,
          {
            orderId,
            admin
          }
        )
      );

      return targetOrder;
    });

  await notifyTeam(
    "order.cancelled",
    {
      orderId,
      admin
    }
  );

  return result;
}

async function createReturnRequest(
  orderId,
  contact,
  requestData,
  {
    admin = false
  } = {}
) {
  const database =
    await readDatabase();

  const order =
    database.orders.find(item => {
      return getOrderId(item) === orderId;
    });

  if (!order) {
    throw new Error(
      "Order not found"
    );
  }

  if (
    !admin &&
    !orderMatchesContact(order, contact)
  ) {
    throw new Error(
      "Order ID and phone/email do not match"
    );
  }

  const type =
    String(
      requestData.type ||
      "Return"
    );

  if (
    type !== "Cancellation" &&
    !String(order.status || "")
      .toLowerCase()
      .includes("delivered")
  ) {
    throw new Error(
      "Return or replacement can be requested after the order is delivered"
    );
  }

  if (type === "Cancellation") {
    await cancelOrderAndShipment(
      orderId,
      contact,
      {
        admin
      }
    );
  }

  const requestId =
    String(
      requestData.id ||
      `RET${Date.now()}` +
      Math.floor(
        100 + Math.random() * 900
      )
    );

  const request =
    await mutateDatabase(databaseToUpdate => {
      const existing =
        databaseToUpdate.returns.find(item => {
          return item.id === requestId;
        });

      if (existing) {
        return existing;
      }

      const now =
        new Date().toISOString();

      const record = {
        id: requestId,
        orderId,
        customerName:
          order.customerName ||
          order.shippingAddress?.name ||
          "Customer",
        email: order.email || "",
        phone:
          order.phone ||
          order.shippingAddress?.phone ||
          "",
        type,
        reason:
          String(
            requestData.reason ||
            "Customer request"
          ),
        details:
          String(
            requestData.details || ""
          ),
        refundMethod:
          String(
            requestData.refundMethod ||
            "Original payment method"
          ),
        items:
          Array.isArray(requestData.items)
            ? requestData.items
            : order.items || [],
        estimatedValue:
          Number(
            requestData.estimatedValue ||
            order.total ||
            0
          ),
        status:
          type === "Cancellation"
            ? "Approved"
            : "Requested",
        adminNote: "",
        reverseShipment: null,
        createdAt: now,
        updatedAt: now
      };

      databaseToUpdate.returns.unshift(
        record
      );

      databaseToUpdate.events.unshift(
        createEvent(
          "return.requested",
          `${type} request ${requestId} was created`,
          {
            requestId,
            orderId,
            type
          }
        )
      );

      return record;
    });

  if (
    type !== "Cancellation" &&
    String(
      process.env.AUTO_BOOK_SHIPMENTS ||
      "true"
    ).toLowerCase() !== "false"
  ) {
    try {
      await createReversePickup(
        request.id
      );
    } catch (error) {
      console.error(
        `Reverse pickup failed for ${request.id}:`,
        error.message
      );
    }
  }

  await notifyTeam(
    "return.requested",
    request
  );

  const updatedDatabase =
    await readDatabase();

  return updatedDatabase.returns.find(
    item => item.id === request.id
  );
}

async function createReversePickup(
  requestId
) {
  const database =
    await readDatabase();

  const request =
    database.returns.find(item => {
      return item.id === requestId;
    });

  if (!request) {
    throw new Error(
      "Return request not found"
    );
  }

  const order =
    database.orders.find(item => {
      return getOrderId(item) ===
        request.orderId;
    });

  if (!order) {
    throw new Error(
      "Connected order not found"
    );
  }

  if (
    request.reverseShipment?.awb
  ) {
    return request.reverseShipment;
  }

  const reverse =
    await logistics.createReversePickup(
      order,
      request
    );

  const updated =
    await mutateDatabase(databaseToUpdate => {
      const target =
        databaseToUpdate.returns.find(item => {
          return item.id === requestId;
        });

      if (target) {
        target.reverseShipment = {
          ...reverse,
          createdAt:
            new Date().toISOString()
        };
        target.status =
          "Pickup Scheduled";
        target.updatedAt =
          new Date().toISOString();
      }

      databaseToUpdate.events.unshift(
        createEvent(
          "return.pickup",
          `Reverse pickup created for ${requestId}`,
          {
            requestId,
            orderId: request.orderId,
            awb: reverse.awb
          }
        )
      );

      return target;
    });

  await notifyTeam(
    "return.pickup",
    updated
  );

  return updated.reverseShipment;
}

async function processQueuedOrders() {
  if (!isAutoBookingEnabled()) {
    return {
      processed: 0,
      skipped: true
    };
  }

  const database =
    await readDatabase();

  const candidates =
    database.orders.filter(order => {
      const status =
        String(
          order.automationStatus || ""
        ).toLowerCase();

      const attempts =
        Number(
          order.automationAttempts || 0
        );

      return (
        [
          "queued",
          "booking failed"
        ].includes(status) &&
        attempts < 5 &&
        !String(order.status || "")
          .toLowerCase()
          .includes("cancel")
      );
    });

  let processed = 0;

  for (const order of candidates) {
    try {
      await bookShipmentForOrder(
        getOrderId(order)
      );
      processed += 1;
    } catch {
      // Failure is recorded in bookShipmentForOrder.
    }
  }

  return {
    processed,
    candidates: candidates.length
  };
}

module.exports = {
  logistics,
  getOrderId,
  normalizeContact,
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
};
