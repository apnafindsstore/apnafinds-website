const order = {
  id: `APNA-DEMO-${Date.now().toString().slice(-6)}`,
  customerName: "Narender Mangala",
  phone: "9666337370",
  email: "demo@apnafinds.com",
  items: [
    {
      id: "1",
      name: "Electric Garlic Chopper",
      price: 499,
      quantity: 1,
      image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1000&h=1000&q=85"
    }
  ],
  subtotal: 499,
  discount: 0,
  shipping: 0,
  total: 499,
  status: "Order placed",
  paymentMethod: "COD",
  shippingAddress: {
    name: "Narender Mangala",
    phone: "9666337370",
    address: "Kukatpally",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500072"
  }
};

async function main() {
  const response = await fetch("http://localhost:3000/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(order)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server returned ${response.status}`);
  }

  console.log("");
  console.log("Demo order created and automatically sent to logistics.");
  console.log(`Order ID: ${order.id}`);
  console.log(`Phone: ${order.phone}`);
  console.log(`Courier: ${data.shipment?.courier || "Booking in progress"}`);
  console.log(`AWB: ${data.shipment?.awb || "Booking in progress"}`);
  console.log("");
  console.log("Track at: http://localhost:3000/track-order.html");
}

main().catch(error => {
  console.error("");
  console.error("Could not create the demo order:", error.message);
  console.error("Start START-APNAFINDS.bat first and keep it running.");
  process.exitCode = 1;
});
