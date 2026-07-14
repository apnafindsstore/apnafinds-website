const SHIPROCKET_BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

function formatOrderDate(value) {
  const date = new Date(value || Date.now());
  const pad = number => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes())
  ].join("");
}

function extractFirst(object, paths) {
  for (const path of paths) {
    let value = object;

    for (const key of path) {
      value = value?.[key];
    }

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return null;
}

class LogisticsAdapter {
  constructor() {
    this.mode =
      String(process.env.LOGISTICS_MODE || "demo").toLowerCase() === "live"
        ? "live"
        : "demo";

    this.token = "";
    this.tokenExpiresAt = 0;
  }

  isLiveConfigured() {
    return Boolean(
      process.env.SHIPROCKET_EMAIL &&
      process.env.SHIPROCKET_PASSWORD &&
      process.env.SHIPROCKET_PICKUP_LOCATION &&
      process.env.SHIPROCKET_PICKUP_POSTCODE
    );
  }

  getProviderStatus() {
    return {
      provider: "Shiprocket",
      mode: this.mode,
      liveConfigured: this.isLiveConfigured(),
      autoBooking:
        String(process.env.AUTO_BOOK_SHIPMENTS || "true").toLowerCase() !== "false"
    };
  }

  async request(
    path,
    {
      method = "GET",
      query,
      body,
      authenticated = true
    } = {}
  ) {
    const url = new URL(`${SHIPROCKET_BASE_URL}${path}`);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (
          value !== undefined &&
          value !== null &&
          value !== ""
        ) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const headers = {
      accept: "application/json"
    };

    if (body !== undefined) {
      headers["content-type"] = "application/json";
    }

    if (authenticated) {
      headers.authorization = `Bearer ${await this.authenticate()}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    const text = await response.text();

    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        raw: text
      };
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
        data.error ||
        `Shiprocket API returned ${response.status}`
      );
    }

    return data;
  }

  async authenticate() {
    if (
      this.token &&
      Date.now() < this.tokenExpiresAt
    ) {
      return this.token;
    }

    if (!this.isLiveConfigured()) {
      throw new Error(
        "Shiprocket live credentials or pickup details are incomplete"
      );
    }

    const data = await this.request("/auth/login", {
      method: "POST",
      authenticated: false,
      body: {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
      }
    });

    if (!data.token) {
      throw new Error(
        "Shiprocket authentication did not return a token"
      );
    }

    this.token = data.token;
    this.tokenExpiresAt =
      Date.now() +
      8 * 24 * 60 * 60 * 1000;

    return this.token;
  }

  buildOrderPayload(order) {
    const address = order.shippingAddress || {};
    const items = Array.isArray(order.items) ? order.items : [];

    return {
      order_id: String(order.id || order.orderId),
      order_date: formatOrderDate(order.createdAt || order.date),
      pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION,
      channel_id: "",
      comment: String(order.notes || ""),
      billing_customer_name: String(
        order.customerName ||
        address.name ||
        "Customer"
      ),
      billing_last_name: "",
      billing_address: String(
        address.address ||
        address.line ||
        ""
      ),
      billing_address_2: String(address.landmark || ""),
      billing_city: String(address.city || ""),
      billing_pincode: String(address.pincode || ""),
      billing_state: String(address.state || ""),
      billing_country: "India",
      billing_email: String(order.email || ""),
      billing_phone: String(
        order.phone ||
        address.phone ||
        ""
      ),
      shipping_is_billing: true,
      order_items: items.map((item, index) => ({
        name: String(item.name || `Product ${index + 1}`),
        sku: String(item.sku || item.id || `APF-${index + 1}`),
        units: Math.max(
          1,
          Number(item.quantity || item.qty || 1)
        ),
        selling_price: Math.max(
          0,
          Number(item.price || 0)
        ),
        discount: 0,
        tax: 0,
        hsn: String(item.hsn || "")
      })),
      payment_method:
        String(order.paymentMethod || "COD").toUpperCase() === "COD"
          ? "COD"
          : "Prepaid",
      shipping_charges: Math.max(
        0,
        Number(order.shipping || 0)
      ),
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: Math.max(
        0,
        Number(order.discount || 0)
      ),
      sub_total: Math.max(
        0,
        Number(
          order.total ||
          order.orderTotal ||
          order.subtotal ||
          0
        )
      ),
      length: envNumber("DEFAULT_PACKAGE_LENGTH_CM", 20),
      breadth: envNumber("DEFAULT_PACKAGE_BREADTH_CM", 15),
      height: envNumber("DEFAULT_PACKAGE_HEIGHT_CM", 10),
      weight: envNumber("DEFAULT_PACKAGE_WEIGHT_KG", 0.5)
    };
  }

  async serviceability({
    deliveryPostcode,
    weight,
    cod
  }) {
    if (
      this.mode === "demo" ||
      !this.isLiveConfigured()
    ) {
      return {
        mode: "demo",
        available: true,
        couriers: [
          {
            courier_company_id: 101,
            courier_name: "ApnaFinds Express",
            freight_charge: 49,
            estimated_delivery_days: 3,
            is_recommended: true
          },
          {
            courier_company_id: 102,
            courier_name: "ApnaFinds Economy",
            freight_charge: 39,
            estimated_delivery_days: 5,
            is_recommended: false
          }
        ]
      };
    }

    const data = await this.request(
      "/courier/serviceability/",
      {
        query: {
          pickup_postcode: process.env.SHIPROCKET_PICKUP_POSTCODE,
          delivery_postcode: deliveryPostcode,
          weight:
            Number(weight) ||
            envNumber("DEFAULT_PACKAGE_WEIGHT_KG", 0.5),
          cod: cod ? 1 : 0
        }
      }
    );

    const couriers =
      data.data?.available_courier_companies ||
      [];

    return {
      mode: "live",
      available: couriers.length > 0,
      couriers
    };
  }

  chooseCourier(couriers) {
    const configured = Number(process.env.SHIPROCKET_COURIER_ID);

    if (
      Number.isFinite(configured) &&
      configured > 0
    ) {
      return {
        courier_company_id: configured,
        courier_name: "Configured courier"
      };
    }

    const list = Array.isArray(couriers)
      ? couriers.slice()
      : [];

    list.sort((a, b) => {
      const recommendedA = Number(
        a.is_recommended ??
        a.is_recommendation ??
        0
      );

      const recommendedB = Number(
        b.is_recommended ??
        b.is_recommendation ??
        0
      );

      if (recommendedA !== recommendedB) {
        return recommendedB - recommendedA;
      }

      return (
        Number(a.freight_charge || Infinity) -
        Number(b.freight_charge || Infinity)
      );
    });

    return list[0] || null;
  }

  async bookOrder(order) {
    if (
      this.mode === "demo" ||
      !this.isLiveConfigured()
    ) {
      const suffix = String(order.id || Date.now())
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-10)
        .toUpperCase();

      return {
        provider: "Shiprocket",
        mode: "demo",
        providerOrderId: `DEMO-ORD-${suffix}`,
        shipmentId: `DEMO-SHP-${suffix}`,
        awb: `APNA${suffix}`,
        courier: "ApnaFinds Demo Express",
        courierId: 101,
        status: "Pickup Scheduled",
        customerStatus: "Confirmed",
        pickupStatus: "Scheduled",
        estimatedDelivery: new Date(
          Date.now() +
          4 * 24 * 60 * 60 * 1000
        ).toISOString(),
        trackingEvents: [
          {
            status: "Order received",
            activity:
              "Order automatically sent to the demo logistics system",
            date: new Date().toISOString()
          },
          {
            status: "Pickup scheduled",
            activity:
              "Pickup is scheduled from the configured seller location",
            date: new Date().toISOString()
          }
        ],
        raw: {
          demo: true
        }
      };
    }

    const payload = this.buildOrderPayload(order);

    const created = await this.request(
      "/orders/create/adhoc",
      {
        method: "POST",
        body: payload
      }
    );

    const providerOrderId = extractFirst(created, [
      ["order_id"],
      ["data", "order_id"]
    ]);

    const shipmentId = extractFirst(created, [
      ["shipment_id"],
      ["data", "shipment_id"]
    ]);

    if (!shipmentId) {
      throw new Error(
        "Shiprocket order creation did not return a shipment ID"
      );
    }

    const serviceability = await this.serviceability({
      deliveryPostcode: payload.billing_pincode,
      weight: payload.weight,
      cod: payload.payment_method === "COD"
    });

    const courier = this.chooseCourier(
      serviceability.couriers
    );

    if (!courier) {
      throw new Error(
        "No serviceable courier was found for the delivery PIN code"
      );
    }

    const assigned = await this.request(
      "/courier/assign/awb",
      {
        method: "POST",
        body: {
          shipment_id: Number(shipmentId),
          courier_id: Number(
            courier.courier_company_id ||
            courier.courier_id
          )
        }
      }
    );

    const awb = extractFirst(assigned, [
      ["awb_code"],
      ["response", "data", "awb_code"],
      ["data", "awb_code"],
      ["response", "awb_code"]
    ]);

    await this.request(
      "/courier/generate/pickup",
      {
        method: "POST",
        body: {
          shipment_id: [
            Number(shipmentId)
          ]
        }
      }
    );

    return {
      provider: "Shiprocket",
      mode: "live",
      providerOrderId: String(providerOrderId || ""),
      shipmentId: String(shipmentId),
      awb: String(awb || ""),
      courier: String(
        courier.courier_name ||
        courier.name ||
        "Courier"
      ),
      courierId: Number(
        courier.courier_company_id ||
        courier.courier_id ||
        0
      ),
      status: "Pickup Scheduled",
      customerStatus: "Confirmed",
      pickupStatus: "Scheduled",
      estimatedDelivery:
        courier.etd ||
        courier.estimated_delivery_days ||
        null,
      trackingEvents: [
        {
          status: "Order received",
          activity: "Order created in Shiprocket",
          date: new Date().toISOString()
        },
        {
          status: "Pickup scheduled",
          activity:
            "AWB assigned and courier pickup requested",
          date: new Date().toISOString()
        }
      ],
      raw: {
        created,
        assigned,
        courier
      }
    };
  }

  async track(awb) {
    if (!awb) {
      throw new Error("AWB is unavailable");
    }

    if (
      this.mode === "demo" ||
      String(awb).startsWith("APNA")
    ) {
      return {
        provider: "Shiprocket",
        mode: "demo",
        awb,
        status: "Pickup Scheduled",
        customerStatus: "Confirmed",
        courier: "ApnaFinds Demo Express",
        trackingEvents: [
          {
            status: "Pickup scheduled",
            activity:
              "Demo courier pickup is scheduled",
            date: new Date().toISOString()
          }
        ],
        raw: {
          demo: true
        }
      };
    }

    const data = await this.request(
      `/courier/track/awb/${encodeURIComponent(awb)}`
    );

    const trackingData =
      data.tracking_data ||
      data.data ||
      data;

    const activities =
      trackingData.shipment_track_activities ||
      trackingData.activities ||
      [];

    const track = Array.isArray(
      trackingData.shipment_track
    )
      ? trackingData.shipment_track[0]
      : trackingData.shipment_track || {};

    const status =
      trackingData.track_status ||
      track.current_status ||
      track.status ||
      "Shipped";

    return {
      provider: "Shiprocket",
      mode: "live",
      awb,
      status: String(status),
      customerStatus: this.toCustomerStatus(status),
      courier:
        track.courier_name ||
        track.courier ||
        "",
      estimatedDelivery:
        track.edd ||
        track.delivered_date ||
        null,
      trackingEvents: Array.isArray(activities)
        ? activities.map(activity => ({
            status:
              activity["sr-status-label"] ||
              activity.status ||
              activity.activity ||
              "Update",
            activity:
              activity.activity ||
              activity.status ||
              "",
            location: activity.location || "",
            date:
              activity.date ||
              activity.created_at ||
              ""
          }))
        : [],
      raw: data
    };
  }

  toCustomerStatus(status) {
    const value = String(status || "").toLowerCase();

    if (
      value.includes("deliver") &&
      !value.includes("out")
    ) {
      return "Delivered";
    }

    if (value.includes("out for")) {
      return "Out for delivery";
    }

    if (
      value.includes("transit") ||
      value.includes("shipped") ||
      value.includes("picked")
    ) {
      return "Shipped";
    }

    if (
      value.includes("cancel") ||
      value.includes("rto")
    ) {
      return value.includes("cancel")
        ? "Cancelled"
        : "Return to origin";
    }

    if (
      value.includes("pickup") ||
      value.includes("awb")
    ) {
      return "Confirmed";
    }

    return "Order placed";
  }

  async cancelShipment(shipment) {
    if (!shipment) {
      return {
        cancelled: true,
        mode: this.mode,
        note: "No courier shipment existed"
      };
    }

    if (
      this.mode === "demo" ||
      shipment.mode === "demo"
    ) {
      return {
        cancelled: true,
        mode: "demo",
        raw: {
          demo: true
        }
      };
    }

    const orderId = Number(
      shipment.providerOrderId
    );

    if (!Number.isFinite(orderId)) {
      throw new Error(
        "Shiprocket provider order ID is unavailable"
      );
    }

    const data = await this.request(
      "/orders/cancel",
      {
        method: "POST",
        body: {
          ids: [orderId]
        }
      }
    );

    return {
      cancelled: true,
      mode: "live",
      raw: data
    };
  }

  async createReversePickup(order, returnRequest) {
    if (
      this.mode === "demo" ||
      !this.isLiveConfigured()
    ) {
      const suffix = String(returnRequest.id)
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-10)
        .toUpperCase();

      return {
        provider: "Shiprocket",
        mode: "demo",
        reverseOrderId: `DEMO-RET-${suffix}`,
        shipmentId: `DEMO-RSHP-${suffix}`,
        awb: `RET${suffix}`,
        status: "Pickup Scheduled",
        trackingEvents: [
          {
            status: "Reverse pickup scheduled",
            activity:
              "The demo courier will collect the returned item",
            date: new Date().toISOString()
          }
        ],
        raw: {
          demo: true
        }
      };
    }

    const address = order.shippingAddress || {};
    const items = Array.isArray(returnRequest.items)
      ? returnRequest.items
      : [];

    const payload = {
      order_id: String(returnRequest.id),
      order_date: formatOrderDate(returnRequest.createdAt),
      channel_id: "",
      pickup_customer_name: String(
        order.customerName ||
        address.name ||
        "Customer"
      ),
      pickup_last_name: "",
      pickup_address: String(
        address.address ||
        address.line ||
        ""
      ),
      pickup_address_2: String(address.landmark || ""),
      pickup_city: String(address.city || ""),
      pickup_state: String(address.state || ""),
      pickup_country: "India",
      pickup_pincode: String(address.pincode || ""),
      pickup_email: String(order.email || ""),
      pickup_phone: String(
        order.phone ||
        address.phone ||
        ""
      ),
      shipping_customer_name: "ApnaFinds Returns",
      shipping_last_name: "",
      shipping_address: String(
        process.env.SHIPROCKET_RETURN_ADDRESS ||
        "Configured seller return address"
      ),
      shipping_city: String(
        process.env.SHIPROCKET_RETURN_CITY ||
        "Hyderabad"
      ),
      shipping_state: String(
        process.env.SHIPROCKET_RETURN_STATE ||
        "Telangana"
      ),
      shipping_country: "India",
      shipping_pincode: String(
        process.env.SHIPROCKET_PICKUP_POSTCODE
      ),
      shipping_email: String(
        process.env.SHIPROCKET_EMAIL
      ),
      shipping_phone: String(
        process.env.SHIPROCKET_RETURN_PHONE ||
        order.phone ||
        ""
      ),
      order_items: items.map((item, index) => ({
        name: String(
          item.name ||
          `Returned Product ${index + 1}`
        ),
        sku: String(
          item.id ||
          `RET-${index + 1}`
        ),
        units: Math.max(
          1,
          Number(item.quantity || 1)
        ),
        selling_price: Math.max(
          0,
          Number(item.price || 0)
        ),
        discount: 0,
        tax: 0,
        hsn: String(item.hsn || "")
      })),
      payment_method: "Prepaid",
      total_discount: 0,
      sub_total: Math.max(
        0,
        Number(returnRequest.estimatedValue || 0)
      ),
      length: envNumber("DEFAULT_PACKAGE_LENGTH_CM", 20),
      breadth: envNumber("DEFAULT_PACKAGE_BREADTH_CM", 15),
      height: envNumber("DEFAULT_PACKAGE_HEIGHT_CM", 10),
      weight: envNumber("DEFAULT_PACKAGE_WEIGHT_KG", 0.5)
    };

    const data = await this.request(
      "/orders/create/return",
      {
        method: "POST",
        body: payload
      }
    );

    return {
      provider: "Shiprocket",
      mode: "live",
      reverseOrderId: String(
        data.order_id ||
        data.data?.order_id ||
        ""
      ),
      shipmentId: String(
        data.shipment_id ||
        data.data?.shipment_id ||
        ""
      ),
      awb: String(
        data.awb_code ||
        data.data?.awb_code ||
        ""
      ),
      status: "Reverse Requested",
      trackingEvents: [
        {
          status: "Reverse shipment requested",
          activity:
            "Return request was sent to Shiprocket",
          date: new Date().toISOString()
        }
      ],
      raw: data
    };
  }
}

module.exports = {
  LogisticsAdapter
};
