const {
  readDatabase
} = require("./storage");

const {
  getOrderId,
  orderMatchesContact,
  publicOrderBundle,
  refreshTracking,
  cancelOrderAndShipment,
  createReturnRequest
} = require("./automation");

function detectIntent(message) {
  const text = String(message || "").toLowerCase();

  if (/\b(track|where|status|delivery)\b/.test(text)) {
    return "track";
  }

  if (/\b(cancel|stop order)\b/.test(text)) {
    return "cancel";
  }

  if (/\b(refund status|where is my refund)\b/.test(text)) {
    return "refund_status";
  }

  if (/\b(return|replace|replacement|refund)\b/.test(text)) {
    return "return";
  }

  if (/\b(ship|shipping|courier|delivery charge|pincode)\b/.test(text)) {
    return "shipping";
  }

  return "general";
}

function extractOrderId(message) {
  const match = String(message || "")
    .toUpperCase()
    .match(/\b(?:APF|ORD|ORDER|DEMO)[A-Z0-9-]{5,}\b/);

  return match?.[0] || "";
}

function extractContact(message) {
  const text = String(message || "");

  const email = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );

  if (email) {
    return email[0];
  }

  const phone = text
    .replace(/\D/g, "")
    .match(/[6-9][0-9]{9}/);

  return phone?.[0] || "";
}

async function lookupOrder(orderId, contact) {
  const database = await readDatabase();

  const order = database.orders.find(item => {
    return getOrderId(item).toUpperCase() ===
      String(orderId || "").toUpperCase();
  });

  if (!order) {
    return {
      error: "I could not find that order ID."
    };
  }

  if (!orderMatchesContact(order, contact)) {
    return {
      error:
        "The phone number or email does not match that order."
    };
  }

  return publicOrderBundle(database, order);
}

function trackingReply(bundle) {
  const {
    order,
    shipment
  } = bundle;

  const lines = [
    `Order ${getOrderId(order)} is currently "${order.status || "Order placed"}".`
  ];

  if (shipment?.courier) {
    lines.push(`Courier: ${shipment.courier}.`);
  }

  if (shipment?.awb) {
    lines.push(`AWB: ${shipment.awb}.`);
  }

  if (shipment?.estimatedDelivery) {
    lines.push(
      `Estimated delivery: ${shipment.estimatedDelivery}.`
    );
  }

  if (
    Array.isArray(shipment?.trackingEvents) &&
    shipment.trackingEvents.length
  ) {
    const latest = shipment.trackingEvents[0];

    lines.push(
      `Latest update: ${latest.activity || latest.status}.`
    );
  }

  return lines.join(" ");
}

async function callOpenAI(message, context) {
  const apiKey = String(
    process.env.OPENAI_API_KEY || ""
  ).trim();

  if (!apiKey) {
    return "";
  }

  const model = String(
    process.env.OPENAI_MODEL ||
    "gpt-5-mini"
  );

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions:
          "You are ApnaFinds customer support. Be concise, friendly and factual. Never claim that a refund was paid, a courier was booked, an order was cancelled, or a return was approved unless the supplied server context says so. For order actions, tell the customer to provide an order ID and the phone number or email used at checkout. The store serves India. Cash on Delivery refunds require a verified payout method and admin approval.",
        input:
          `Customer message:\n${message}\n\nVerified store context:\n${JSON.stringify(context)}`
      }),
      signal: AbortSignal.timeout(30000)
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message ||
      "OpenAI request failed"
    );
  }

  if (data.output_text) {
    return data.output_text;
  }

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (
        content.type === "output_text" &&
        content.text
      ) {
        return content.text;
      }
    }
  }

  return "";
}

async function handleAssistant(payload) {
  const message = String(
    payload.message || ""
  ).trim();

  const intent =
    payload.action ||
    detectIntent(message);

  const orderId = String(
    payload.orderId ||
    extractOrderId(message)
  ).trim();

  const contact = String(
    payload.contact ||
    extractContact(message)
  ).trim();

  if (
    [
      "track",
      "cancel",
      "return",
      "refund_status"
    ].includes(intent) &&
    (!orderId || !contact)
  ) {
    return {
      ok: true,
      intent,
      needs: [
        !orderId ? "orderId" : null,
        !contact ? "contact" : null
      ].filter(Boolean),
      reply:
        "Please enter your order ID and the phone number or email used during checkout."
    };
  }

  if (intent === "track") {
    let bundle = await lookupOrder(
      orderId,
      contact
    );

    if (bundle.error) {
      return {
        ok: false,
        intent,
        reply: bundle.error
      };
    }

    if (bundle.shipment?.awb) {
      try {
        await refreshTracking(getOrderId(bundle.order));

        bundle = await lookupOrder(
          orderId,
          contact
        );
      } catch {
        // Use the last saved tracking data.
      }
    }

    return {
      ok: true,
      intent,
      reply: trackingReply(bundle),
      data: bundle
    };
  }

  if (intent === "cancel") {
    try {
      const order = await cancelOrderAndShipment(
        orderId,
        contact
      );

      return {
        ok: true,
        intent,
        reply:
          `Order ${getOrderId(order)} has been cancelled. If a refund is required, its payment depends on the original payment method and admin verification.`,
        data: {
          order
        }
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        reply: error.message
      };
    }
  }

  if (intent === "return") {
    try {
      const request = await createReturnRequest(
        orderId,
        contact,
        {
          type:
            payload.type ||
            "Return",
          reason:
            payload.reason ||
            "Customer requested help through the AI assistant",
          details:
            payload.details ||
            message,
          refundMethod:
            payload.refundMethod ||
            "Original payment method",
          items: Array.isArray(payload.items)
            ? payload.items
            : undefined
        }
      );

      return {
        ok: true,
        intent,
        reply:
          `Your ${request.type.toLowerCase()} request ${request.id} was created with status "${request.status}". ${
            request.reverseShipment?.awb
              ? `Reverse pickup AWB: ${request.reverseShipment.awb}.`
              : "The logistics system will attempt to schedule the reverse pickup."
          }`,
        data: {
          request
        }
      };
    } catch (error) {
      return {
        ok: false,
        intent,
        reply: error.message
      };
    }
  }

  if (intent === "refund_status") {
    const bundle = await lookupOrder(
      orderId,
      contact
    );

    if (bundle.error) {
      return {
        ok: false,
        intent,
        reply: bundle.error
      };
    }

    const latest = bundle.returns
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt) -
          new Date(a.updatedAt)
      )[0];

    if (!latest) {
      return {
        ok: true,
        intent,
        reply:
          "There is no refund or return request recorded for this order."
      };
    }

    return {
      ok: true,
      intent,
      reply:
        `Request ${latest.id} is currently "${latest.status}". Refund money is not marked as paid until an administrator changes the request to "Refunded".`,
      data: {
        request: latest
      }
    };
  }

  if (intent === "shipping") {
    return {
      ok: true,
      intent,
      reply:
        "Orders are automatically queued for courier booking after checkout. When live logistics credentials are configured, the server creates the shipment, selects a serviceable courier, assigns an AWB and requests pickup. Delivery availability and charges depend on the destination PIN code, parcel weight, COD eligibility and courier coverage."
    };
  }

  const context = {
    store: "ApnaFinds",
    actions:
      "Track order, eligible cancellation before courier processing, return or replacement after delivery, and refund-status lookup.",
    logistics:
      "Automatic booking is controlled by the server configuration.",
    policies:
      "Cancellation is generally allowed for Order placed, Confirmed and Packed. Returns and replacements require Delivered status. Refund payment requires approval and the appropriate payout or payment-gateway process."
  };

  try {
    const aiReply = await callOpenAI(
      message || "How can you help me?",
      context
    );

    if (aiReply) {
      return {
        ok: true,
        intent: "general",
        source: "openai",
        reply: aiReply
      };
    }
  } catch (error) {
    console.error(
      "OpenAI assistant failed:",
      error.message
    );
  }

  return {
    ok: true,
    intent: "general",
    source: "rules",
    reply:
      "I can help track an order, cancel an eligible order, create a return or replacement request, check refund status, or explain shipping. Choose an option below or include your order ID and phone/email."
  };
}

module.exports = {
  handleAssistant
};
