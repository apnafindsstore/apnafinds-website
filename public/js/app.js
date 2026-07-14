(() => {
  "use strict";


  function readCurrentUser() {
    try {
      const value = JSON.parse(localStorage.getItem("currentUser") || "null");
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  function escapeText(value) {
    const node = document.createElement("span");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }

  function updateCustomerNavigation() {
    const user = readCurrentUser();
    const name = String(
      user?.name ?? user?.fullName ?? user?.firstName ?? ""
    ).trim();
    const firstName = name.split(/\s+/)[0] || "Account";

    document.querySelectorAll(
      ".desktop-nav a[href='account.html'], #mobileMenu a[href='account.html']"
    ).forEach(link => {
      if (user) {
        link.href = "account.html";
        link.innerHTML = `<i class="fa-solid fa-circle-user"></i> ${escapeText(firstName)}`;
      } else {
        link.href = "login.html";
        link.innerHTML = `<i class="fa-regular fa-user"></i> Login`;
      }
    });
  }

  function closeMobileMenu() {
    document.getElementById("mobileMenu")
      ?.classList.remove("open");

    const icon = document.querySelector(
      "#mobileMenuButton i"
    );

    if (icon) {
      icon.className = "fa-solid fa-bars";
    }
  }

  document.addEventListener("click", event => {
    const menuButton = event.target.closest("#mobileMenuButton");

    if (menuButton) {
      const menu = document.getElementById("mobileMenu");
      const icon = menuButton.querySelector("i");
      const open = menu?.classList.toggle("open");

      if (icon) {
        icon.className = open
          ? "fa-solid fa-xmark"
          : "fa-solid fa-bars";
      }

      return;
    }

    if (
      event.target.closest("#mobileMenu a") ||
      event.target.closest("#mobileMenu button")
    ) {
      closeMobileMenu();
    }
  });

  updateCustomerNavigation();

  window.addEventListener("pageshow", updateCustomerNavigation);
  window.addEventListener("storage", event => {
    if (event.key === "currentUser") updateCustomerNavigation();
  });

  document.querySelectorAll("[data-current-year]")
    .forEach(element => {
      element.textContent = String(
        new Date().getFullYear()
      );
    });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
})();
