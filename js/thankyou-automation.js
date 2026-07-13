(() => {
  "use strict";

  const card =
    document.getElementById(
      "logisticsAutomationCard"
    );

  const text =
    document.getElementById(
      "logisticsAutomationText"
    );

  if (!card || !text) {
    return;
  }

  async function loadStatus() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const orderId =
      params.get("order");

    let lastOrder = null;

    try {
      lastOrder = JSON.parse(
        localStorage.getItem(
          "apnafinds_last_order"
        )
      );
    } catch {
      lastOrder = null;
    }

    const contact =
      lastOrder?.phone ||
      lastOrder?.email ||
      lastOrder?.shippingAddress?.phone ||
      "";

    if (
      !orderId ||
      !contact ||
      !window.ApnaFindsAPI
    ) {
      text.textContent =
        "Your order is saved. Start the ApnaFinds Node.js server to enable automatic courier booking and live tracking.";
      return;
    }

    try {
      const result =
        await window.ApnaFindsAPI.getOrder(
          orderId,
          contact
        );

      const shipment =
        result.shipment;

      if (shipment?.awb) {
        text.textContent =
          `Courier automation completed. ${shipment.courier || "Courier"} AWB: ${shipment.awb}. Status: ${shipment.customerStatus || shipment.status}.`;
      } else {
        text.textContent =
          `Order received by the automation server. Courier status: ${result.order.automationStatus || "Queued"}.`;
      }
    } catch (error) {
      text.textContent =
        `The order was saved in this browser. Logistics server message: ${error.message}`;
    }
  }

  if (document.readyState === "complete") {
    window.setTimeout(loadStatus, 0);
  } else {
    window.addEventListener("load", loadStatus, {
      once: true
    });
  }
})();
