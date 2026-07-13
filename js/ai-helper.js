(() => {
  "use strict";

  if (
    document.getElementById(
      "apna-ai-launcher"
    )
  ) {
    return;
  }

  const launcher =
    document.createElement("button");

  launcher.id =
    "apna-ai-launcher";
  launcher.type = "button";
  launcher.setAttribute(
    "aria-label",
    "Open ApnaFinds AI helper"
  );
  launcher.innerHTML =
    '<i class="fa-solid fa-headset"></i>';

  const panel =
    document.createElement("section");

  panel.id = "apna-ai-panel";
  panel.setAttribute(
    "aria-label",
    "ApnaFinds AI customer helper"
  );

  panel.innerHTML = `
    <header class="apna-ai-header">
      <div>
        <strong>ApnaFinds Helper</strong>
        <small>Tracking, cancellation, returns and refunds</small>
      </div>

      <button
        type="button"
        class="apna-ai-close"
        aria-label="Close assistant"
      >
        <i class="fa-solid fa-xmark"></i>
      </button>
    </header>

    <div class="apna-ai-messages" id="apnaAiMessages"></div>

    <div class="apna-ai-quick">
      <button type="button" data-ai-action="track">Track Order</button>
      <button type="button" data-ai-action="cancel">Cancel</button>
      <button type="button" data-ai-action="return">Return / Refund</button>
      <button type="button" data-ai-action="refund_status">Refund Status</button>
      <button type="button" data-ai-action="shipping">Shipping Help</button>
    </div>

    <div class="apna-ai-order-form" id="apnaAiOrderForm">
      <input
        id="apnaAiOrderId"
        type="text"
        placeholder="Order ID, e.g. APF260711123456"
      >

      <input
        id="apnaAiContact"
        type="text"
        placeholder="Phone number or checkout email"
      >

      <select id="apnaAiReturnType" class="hidden">
        <option value="Return">Return & Refund</option>
        <option value="Replacement">Replacement</option>
      </select>
    </div>

    <form class="apna-ai-compose" id="apnaAiForm">
      <input
        id="apnaAiInput"
        type="text"
        autocomplete="off"
        placeholder="Ask about your order..."
      >
      <button
        class="apna-ai-send"
        type="submit"
        aria-label="Send message"
      >
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </form>
  `;

  document.body.append(
    launcher,
    panel
  );

  const messages =
    panel.querySelector(
      "#apnaAiMessages"
    );

  const form =
    panel.querySelector(
      "#apnaAiForm"
    );

  const input =
    panel.querySelector(
      "#apnaAiInput"
    );

  const orderForm =
    panel.querySelector(
      "#apnaAiOrderForm"
    );

  const orderIdInput =
    panel.querySelector(
      "#apnaAiOrderId"
    );

  const contactInput =
    panel.querySelector(
      "#apnaAiContact"
    );

  const returnType =
    panel.querySelector(
      "#apnaAiReturnType"
    );

  let selectedAction = "";

  function addMessage(
    text,
    sender = "bot"
  ) {
    const message =
      document.createElement("div");

    message.className =
      `apna-ai-message ${sender}`;

    message.textContent =
      String(text || "");

    messages.appendChild(message);
    messages.scrollTop =
      messages.scrollHeight;
  }

  function openPanel() {
    panel.classList.add("open");
    input.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
  }

  function setAction(action) {
    selectedAction = action;

    if (action === "shipping") {
      orderForm.classList.remove(
        "open"
      );

      send({
        action,
        message:
          "Explain the shipping process"
      });

      return;
    }

    orderForm.classList.add("open");
    returnType.classList.toggle(
      "hidden",
      action !== "return"
    );

    const labels = {
      track:
        "Enter your order ID and phone/email, then press Send.",
      cancel:
        "Enter your order ID and phone/email. Cancellation works only before courier processing goes too far.",
      return:
        "Enter your delivered order ID and phone/email, choose Return or Replacement, then press Send.",
      refund_status:
        "Enter your order ID and phone/email to check the latest refund request status."
    };

    addMessage(
      labels[action] ||
      "Enter the order details."
    );
  }

  async function send(payload) {
    const userText =
      payload.message ||
      selectedAction ||
      "Help";

    addMessage(
      userText,
      "user"
    );

    addMessage(
      "Checking...",
      "bot"
    );

    const loading =
      messages.lastElementChild;

    try {
      if (!window.ApnaFindsAPI) {
        throw new Error(
          "Website automation is not loaded"
        );
      }

      const result =
        await window.ApnaFindsAPI.assistant(
          payload
        );

      loading.remove();

      addMessage(
        result.reply ||
        "Done."
      );
    } catch (error) {
      loading.remove();

      addMessage(
        `${error.message}\n\nStart this website using START-APNAFINDS.bat and open http://localhost:3000. Live Server cannot run the logistics and AI backend.`
      );
    }
  }

  launcher.addEventListener(
    "click",
    () => {
      if (
        panel.classList.contains(
          "open"
        )
      ) {
        closePanel();
      } else {
        openPanel();
      }
    }
  );

  panel.querySelector(
    ".apna-ai-close"
  ).addEventListener(
    "click",
    closePanel
  );

  panel.querySelectorAll(
    "[data-ai-action]"
  ).forEach(button => {
    button.addEventListener(
      "click",
      () => {
        setAction(
          button.dataset.aiAction
        );
      }
    );
  });

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const message =
        input.value.trim();

      const payload = {
        message,
        action:
          selectedAction || undefined,
        orderId:
          orderIdInput.value.trim(),
        contact:
          contactInput.value.trim(),
        type:
          selectedAction === "return"
            ? returnType.value
            : undefined,
        reason:
          selectedAction === "return"
            ? message ||
              "Customer request through AI helper"
            : undefined
      };

      if (
        selectedAction &&
        selectedAction !== "shipping" &&
        (
          !payload.orderId ||
          !payload.contact
        )
      ) {
        addMessage(
          "Please fill in the order ID and phone/email."
        );

        orderForm.classList.add(
          "open"
        );

        return;
      }

      input.value = "";

      send(payload);
    }
  );

  addMessage(
    "Hello! I can track an order, cancel an eligible order, create a return or replacement request, check refund status, or explain shipping."
  );
})();
