(() => {
  "use strict";

  const SESSION_KEY = "apnafinds_saved_wishlist_popup_seen";

  function closePopup() {
    document.getElementById("savedWishlistPopup")
      ?.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  function openPopup() {
    const popup = document.getElementById("savedWishlistPopup");
    const list = document.getElementById("savedWishlistPopupList");
    const count = document.getElementById("savedWishlistPopupCount");
    const store = window.ApnaFindsStore;

    if (!popup || !list || !store) {
      return;
    }

    const items = store.loadWishlist();

    if (!items.length) {
      return;
    }

    count.textContent = String(items.length);

    list.innerHTML = items.slice(0, 3).map(item => {
      const product =
        store.getProductById(item.id) ||
        item;

      return `
        <article class="popup-product">
          <img
            src="${product.image || store.genericImage()}"
            data-fallback="${product.fallbackImage || store.genericImage()}"
            alt="${product.name || "Saved product"}"
            onerror="this.src=this.dataset.fallback"
          >

          <div>
            <h3>${product.name || "Saved product"}</h3>
            <strong>${store.formatMoney(product.price)}</strong>
          </div>

          <button
            type="button"
            class="icon-button"
            data-popup-add="${product.id}"
            aria-label="Add ${product.name || "product"} to cart"
          >
            <i class="fa-solid fa-bag-shopping"></i>
          </button>
        </article>
      `;
    }).join("");

    popup.classList.add("open");
    document.body.classList.add("no-scroll");
  }

  function maybeShowPopup() {
    const allowedPages = ["home", "products", "product"];

    if (!allowedPages.includes(document.body.dataset.page)) {
      return;
    }

    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      return;
    }

    const items = window.ApnaFindsStore?.loadWishlist() || [];

    if (!items.length) {
      return;
    }

    sessionStorage.setItem(SESSION_KEY, "true");

    window.setTimeout(openPopup, 800);
  }

  document.addEventListener("click", event => {
    if (
      event.target.id === "savedWishlistPopup" ||
      event.target.closest("[data-close-saved-popup]")
    ) {
      closePopup();
      return;
    }

    const addButton = event.target.closest("[data-popup-add]");

    if (addButton) {
      const success = window.ApnaFindsStore?.addToCart(
        addButton.dataset.popupAdd
      );

      if (success) {
        addButton.innerHTML =
          '<i class="fa-solid fa-check"></i>';
        addButton.disabled = true;
      }

      return;
    }

    if (event.target.closest("[data-popup-open-wishlist]")) {
      closePopup();

      if (document.body.dataset.page === "products") {
        window.ApnaFindsStore?.openWishlistDrawer();
      } else {
        location.href = "wishlist.html";
      }
    }
  });

  window.addEventListener("pageshow", maybeShowPopup);

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      maybeShowPopup,
      { once: true }
    );
  } else {
    maybeShowPopup();
  }
})();
