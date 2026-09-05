(() => {
  "use strict";

  const LINKS = Object.freeze({
    instagram: "https://www.instagram.com/shopapnafinds/",
    facebook: "https://www.facebook.com/share/18oytFrQHZ/"
  });

  function secureExternalLink(link, url, label) {
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", label);
  }

  function updateExistingLinks() {
    document.querySelectorAll('a[href*="instagram.com"]').forEach(link => {
      secureExternalLink(link, LINKS.instagram, "Follow ApnaFinds on Instagram");
    });
    document.querySelectorAll('a[href*="facebook.com"]').forEach(link => {
      secureExternalLink(link, LINKS.facebook, "Follow ApnaFinds on Facebook");
    });
  }

  function createSocialLinks() {
    const wrapper = document.createElement("div");
    wrapper.dataset.apnafindsSocialLinks = "true";
    wrapper.setAttribute("aria-label", "ApnaFinds social media");
    wrapper.style.cssText = "display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px";

    const instagram = document.createElement("a");
    secureExternalLink(instagram, LINKS.instagram, "Follow ApnaFinds on Instagram");
    instagram.innerHTML = '<i class="fa-brands fa-instagram" aria-hidden="true"></i>';

    const facebook = document.createElement("a");
    secureExternalLink(facebook, LINKS.facebook, "Follow ApnaFinds on Facebook");
    facebook.innerHTML = '<i class="fa-brands fa-facebook-f" aria-hidden="true"></i>';

    for (const link of [instagram, facebook]) {
      link.style.cssText = "display:grid;width:42px;height:42px;place-items:center;border:1px solid #e5e7eb;border-radius:999px;background:#fff;color:#0f5c4a;text-decoration:none;font-size:18px;box-shadow:0 6px 18px rgba(0,0,0,.08);transition:transform .2s ease,box-shadow .2s ease";
      link.addEventListener("mouseenter", () => { link.style.transform = "translateY(-2px)"; link.style.boxShadow = "0 10px 24px rgba(0,0,0,.12)"; });
      link.addEventListener("mouseleave", () => { link.style.transform = "none"; link.style.boxShadow = "0 6px 18px rgba(0,0,0,.08)"; });
    }

    wrapper.append(instagram, facebook);
    return wrapper;
  }

  function addSocialLinks() {
    if (document.querySelector("[data-apnafinds-social-links]")) return;
    const footer = document.querySelector("footer");
    if (footer) {
      const target = footer.querySelector(".max-w-7xl, .container") || footer;
      target.appendChild(createSocialLinks());
      return;
    }

    const section = document.createElement("section");
    section.style.cssText = "padding:18px 16px 96px;text-align:center;background:#faf7f2";
    const title = document.createElement("p");
    title.textContent = "Follow ApnaFinds";
    title.style.cssText = "margin:0;font-size:13px;font-weight:800;color:#374151";
    section.append(title, createSocialLinks());
    document.body.appendChild(section);
  }

  function init() {
    updateExistingLinks();
    addSocialLinks();
  }

  window.ApnaFindsSocial = { links: LINKS, refresh: updateExistingLinks };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
