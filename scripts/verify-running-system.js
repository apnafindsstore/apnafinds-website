const BASE_URL = process.env.APNAFINDS_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@apnafinds.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ApnaFinds@123";

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
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
    throw new Error(`${path}: ${data.error || response.status}`);
  }

  return data;
}

async function main() {
  console.log("Checking ApnaFinds server...");
  const health = await request("/api/health");
  console.log(`Server OK · logistics ${String(health.provider?.mode || "unknown").toUpperCase()}`);

  const login = await request("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      remember: false
    })
  });
  const session = login.token;
  console.log("Admin login OK");

  const suffix = Date.now().toString().slice(-6);
  const orderId = `APNA-VERIFY-${suffix}`;
  const phone = "9888888888";

  const created = await request("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      id: orderId,
      customerName: "ApnaFinds Verification",
      phone,
      email: "verify@apnafinds.local",
      items: [
        {
          name: "Verification Product",
          price: 499,
          quantity: 1
        }
      ],
      subtotal: 499,
      shipping: 0,
      total: 499,
      status: "Order placed",
      paymentMethod: "COD",
      shippingAddress: {
        name: "ApnaFinds Verification",
        phone,
        address: "Verification Address",
        city: "Hyderabad",
        state: "Telangana",
        pincode: "500072"
      }
    })
  });

  if (!created.shipment?.awb) {
    throw new Error("Automatic courier booking did not create an AWB");
  }
  console.log(`Automatic shipment OK · AWB ${created.shipment.awb}`);

  await request(`/api/orders/${encodeURIComponent(orderId)}?contact=${encodeURIComponent(phone)}`);
  console.log("Customer tracking lookup OK");

  await request(`/api/orders/${encodeURIComponent(orderId)}/refresh-tracking`, {
    method: "POST",
    body: JSON.stringify({ contact: phone })
  });
  console.log("Tracking refresh OK");

  const management = await request("/api/admin/management", {
    headers: {
      "x-admin-session": session
    }
  });

  if (!management.orders.some(bundle => bundle.order?.id === orderId)) {
    throw new Error("The verification order was not visible in Admin Management");
  }
  console.log("Admin Management connection OK");

  console.log("");
  console.log("ALL APNAFINDS AUTOMATIC PROCESS CHECKS PASSED");
  console.log(`Verification order: ${orderId}`);
  console.log(`Tracking phone: ${phone}`);
}

main().catch(error => {
  console.error("");
  console.error("VERIFICATION FAILED");
  console.error(error.message);
  console.error("Start START-APNAFINDS.bat first and check the .env credentials.");
  process.exitCode = 1;
});
