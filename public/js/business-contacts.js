(() => {
  "use strict";
  const contacts = Object.freeze({
    support: "support@apnafinds.com",
    orders: "orders@apnafinds.com",
    hello: "hello@apnafinds.com",
    returns: "returns@apnafinds.com",
    business: "business@apnafinds.com",
    noreply: "noreply@apnafinds.com"
  });

  function emailFor(purpose) {
    return contacts[String(purpose || "support").toLowerCase()] || contacts.support;
  }

  function mailto(purpose, subject = "", body = "") {
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);
    const query = params.toString();
    return `mailto:${emailFor(purpose)}${query ? `?${query}` : ""}`;
  }

  function applyContactLinks(scope = document) {
    scope.querySelectorAll("[data-apna-email]").forEach(node => {
      const purpose = node.dataset.apnaEmail || "support";
      const address = emailFor(purpose);
      if (node.tagName === "A") node.href = mailto(purpose, node.dataset.emailSubject || "");
      if (!node.dataset.preserveText) node.textContent = address;
    });
  }

  window.ApnaFindsBusinessContacts = Object.freeze({ contacts, emailFor, mailto, applyContactLinks });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => applyContactLinks());
  } else {
    applyContactLinks();
  }
})();
