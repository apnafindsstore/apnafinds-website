(() => {
  "use strict";

  const KEYS = {
    products: "adminProducts",
    cart: "apnafinds_cart",
    cartLegacy: "cart",
    wishlist: "apnafinds_wishlist",
    wishlistLegacy: "wishlist"
  };

  const PRODUCT_PHOTOS = {
    "electric-garlic-chopper": "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1000&h=1000&q=85",
    "portable-blender": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1000&h=1000&q=85",
    "digital-kitchen-scale": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1000&h=1000&q=85",
    "vegetable-cutter": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1000&h=1000&q=85",
    "electric-milk-frother": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1000&h=1000&q=85",
    "self-stirring-mug": "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=1000&h=1000&q=85",
    "oil-spray-bottle": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=1000&h=1000&q=85",
    "silicone-cooking-utensil-set": "https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1000&h=1000&q=85",
    "led-motion-sensor-light": "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?auto=format&fit=crop&w=1000&h=1000&q=85",
    "foldable-storage-box": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&h=1000&q=85",
    "mini-vacuum-cleaner": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1000&h=1000&q=85",
    "electric-lint-remover": "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=1000&h=1000&q=85",
    "shoe-cleaning-brush": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1000&h=1000&q=85",
    "cable-organizer-kit": "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1000&h=1000&q=85",
    "smart-water-bottle": "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1000&h=1000&q=85",
    "portable-humidifier": "https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=1000&h=1000&q=85",
    "pet-hair-remover": "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&h=1000&q=85",
    "pet-grooming-brush": "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&h=1000&q=85",
    "pet-water-bottle": "https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1000&h=1000&q=85",
    "pet-feeding-bowl-set": "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1000&h=1000&q=85",
    "makeup-organizer-box": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1000&h=1000&q=85",
    "facial-cleansing-brush": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1000&h=1000&q=85",
    "neck-massager": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1000&h=1000&q=85",
    "led-makeup-mirror": "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1000&h=1000&q=85",
    "car-phone-holder": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1000&h=1000&q=85",
    "laptop-stand": "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1000&h=1000&q=85",
    "wireless-earbuds": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&h=1000&q=85",
    "mini-sewing-machine": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1000&h=1000&q=85"
};

  const DEFAULT_PRODUCTS = [
    {
      id: "1",
      name: "Electric Garlic Chopper",
      category: "Kitchen",
      price: 499,
      oldPrice: 699,
      rating: 4.7,
      reviews: 238,
      stock: 24,
      badge: "Best Seller",
      description: "A compact rechargeable chopper for garlic, chilli, onion and everyday food preparation.",
      features: ["USB rechargeable", "Stainless-steel blades", "Easy one-touch operation", "Compact and easy to clean"]
    },
    {
      id: "2",
      name: "Portable Blender",
      category: "Kitchen",
      price: 899,
      oldPrice: 1199,
      rating: 4.5,
      reviews: 164,
      stock: 16,
      badge: "Popular",
      description: "Blend shakes, fruit drinks and smoothies wherever you go.",
      features: ["Rechargeable motor", "Portable bottle design", "Food-grade cup", "Simple cleaning"]
    },
    {
      id: "3",
      name: "Digital Kitchen Scale",
      category: "Kitchen",
      price: 599,
      oldPrice: 799,
      rating: 4.6,
      reviews: 122,
      stock: 20,
      description: "Measure ingredients accurately for cooking, baking and portion control.",
      features: ["Clear digital display", "Compact platform", "Tare function", "Multiple weighing units"]
    },
    {
      id: "4",
      name: "Vegetable Cutter",
      category: "Kitchen",
      price: 399,
      oldPrice: 599,
      rating: 4.4,
      reviews: 196,
      stock: 30,
      description: "A practical manual cutter for faster vegetable preparation.",
      features: ["Multiple cutting options", "Easy-grip design", "Compact storage", "Simple to wash"]
    },
    {
      id: "5",
      name: "Electric Milk Frother",
      category: "Kitchen",
      price: 349,
      oldPrice: 499,
      rating: 4.5,
      reviews: 143,
      stock: 22,
      description: "Create creamy foam for coffee, milk, hot chocolate and shakes.",
      features: ["High-speed whisk", "Lightweight body", "One-button use", "Easy cleaning"]
    },
    {
      id: "6",
      name: "Self Stirring Mug",
      category: "Kitchen",
      price: 499,
      oldPrice: 699,
      rating: 4.3,
      reviews: 91,
      stock: 18,
      badge: "New",
      description: "Mix coffee, tea and other beverages with a simple press.",
      features: ["Automatic stirring", "Comfortable handle", "Spill-resistant lid", "Useful for office and home"]
    },
    {
      id: "7",
      name: "Oil Spray Bottle",
      category: "Kitchen",
      price: 299,
      oldPrice: 449,
      rating: 4.6,
      reviews: 208,
      stock: 35,
      description: "Control oil while cooking, grilling, roasting and preparing salads.",
      features: ["Fine mist spray", "Refillable bottle", "Easy-grip top", "Helps control portions"]
    },
    {
      id: "8",
      name: "Silicone Cooking Utensil Set",
      category: "Kitchen",
      price: 699,
      oldPrice: 999,
      rating: 4.5,
      reviews: 117,
      stock: 14,
      description: "A versatile utensil set designed for everyday cooking.",
      features: ["Heat-resistant silicone", "Non-scratch heads", "Comfortable handles", "Multiple utensil types"]
    },
    {
      id: "9",
      name: "LED Motion Sensor Light",
      category: "Home",
      price: 799,
      oldPrice: 1099,
      rating: 4.7,
      reviews: 287,
      stock: 28,
      badge: "Best Seller",
      description: "Automatic lighting for wardrobes, stairs, cupboards and hallways.",
      features: ["Motion detection", "Easy installation", "Low-power LED", "Useful in dark spaces"]
    },
    {
      id: "10",
      name: "Foldable Storage Box",
      category: "Home",
      price: 499,
      oldPrice: 699,
      rating: 4.4,
      reviews: 102,
      stock: 19,
      description: "Organise clothing, toys and household essentials while saving space.",
      features: ["Foldable design", "Strong carry handles", "Useful for wardrobes", "Compact when not used"]
    },
    {
      id: "11",
      name: "Mini Vacuum Cleaner",
      category: "Home",
      price: 699,
      oldPrice: 999,
      rating: 4.5,
      reviews: 177,
      stock: 21,
      description: "Clean desks, keyboards, sofas and small spaces with a compact vacuum.",
      features: ["Portable size", "Useful attachments", "Easy dust collection", "Suitable for small spaces"]
    },
    {
      id: "12",
      name: "Electric Lint Remover",
      category: "Home",
      price: 399,
      oldPrice: 599,
      rating: 4.4,
      reviews: 139,
      stock: 26,
      description: "Refresh sweaters, clothing and fabric by removing lint and fuzz.",
      features: ["Fabric-safe guard", "Compact handle", "Removable lint chamber", "Easy operation"]
    },
    {
      id: "13",
      name: "Shoe Cleaning Brush",
      category: "Home",
      price: 249,
      oldPrice: 349,
      rating: 4.2,
      reviews: 86,
      stock: 32,
      description: "A practical brush for everyday shoe and sole cleaning.",
      features: ["Firm bristles", "Easy grip", "Compact design", "Suitable for routine cleaning"]
    },
    {
      id: "14",
      name: "Cable Organizer Kit",
      category: "Tech",
      price: 299,
      oldPrice: 449,
      rating: 4.5,
      reviews: 154,
      stock: 40,
      description: "Keep charging wires, desk cables and earphone cords organised.",
      features: ["Multiple organisers", "Desk-friendly design", "Reusable", "Reduces cable clutter"]
    },
    {
      id: "15",
      name: "Smart Water Bottle",
      category: "Lifestyle",
      price: 799,
      oldPrice: 1099,
      rating: 4.6,
      reviews: 172,
      stock: 17,
      description: "A stylish bottle with a smart temperature display.",
      features: ["Temperature display", "Insulated body", "Leak-resistant lid", "Useful for daily travel"]
    },
    {
      id: "16",
      name: "Portable Humidifier",
      category: "Home",
      price: 999,
      oldPrice: 1399,
      rating: 4.4,
      reviews: 94,
      stock: 13,
      description: "Add gentle moisture to small rooms, workspaces and bedside areas.",
      features: ["Compact mist outlet", "Quiet use", "Portable body", "USB powered"]
    },
    {
      id: "17",
      name: "Pet Hair Remover",
      category: "Pet Care",
      price: 299,
      oldPrice: 449,
      rating: 4.6,
      reviews: 216,
      stock: 31,
      description: "Remove pet hair from sofas, clothing, bedding and car seats.",
      features: ["Reusable design", "No disposable sheets", "Comfortable handle", "Useful on fabric surfaces"]
    },
    {
      id: "18",
      name: "Pet Grooming Brush",
      category: "Pet Care",
      price: 399,
      oldPrice: 599,
      rating: 4.7,
      reviews: 184,
      stock: 23,
      description: "Gently remove loose fur and support regular pet grooming.",
      features: ["Rounded grooming pins", "Easy-clean button", "Comfortable grip", "Suitable for regular brushing"]
    },
    {
      id: "19",
      name: "Pet Water Bottle",
      category: "Pet Care",
      price: 499,
      oldPrice: 699,
      rating: 4.5,
      reviews: 126,
      stock: 18,
      description: "Carry drinking water for pets during walks and travel.",
      features: ["Integrated drinking tray", "Portable design", "Leak-resistant lock", "Easy one-hand use"]
    },
    {
      id: "20",
      name: "Pet Feeding Bowl Set",
      category: "Pet Care",
      price: 599,
      oldPrice: 799,
      rating: 4.4,
      reviews: 97,
      stock: 15,
      description: "A matching bowl set for food and water.",
      features: ["Two-bowl design", "Stable base", "Easy to clean", "Suitable for daily feeding"]
    },
    {
      id: "21",
      name: "Makeup Organizer Box",
      category: "Beauty",
      price: 699,
      oldPrice: 999,
      rating: 4.6,
      reviews: 163,
      stock: 18,
      description: "Store cosmetics, skincare and small accessories in organised sections.",
      features: ["Multiple compartments", "Easy-access layout", "Suitable for dressing tables", "Easy to wipe clean"]
    },
    {
      id: "22",
      name: "Facial Cleansing Brush",
      category: "Beauty",
      price: 499,
      oldPrice: 699,
      rating: 4.4,
      reviews: 119,
      stock: 20,
      description: "Support a gentle daily cleansing routine with a compact facial brush.",
      features: ["Soft brush surface", "Comfortable grip", "Compact body", "Suitable for routine cleansing"]
    },
    {
      id: "23",
      name: "Neck Massager",
      category: "Lifestyle",
      price: 1199,
      oldPrice: 1699,
      rating: 4.5,
      reviews: 194,
      stock: 12,
      badge: "Trending",
      description: "A wearable massager designed for relaxing use at home or work.",
      features: ["Wearable design", "Multiple massage nodes", "Easy controls", "Useful after long working hours"]
    },
    {
      id: "24",
      name: "LED Makeup Mirror",
      category: "Beauty",
      price: 999,
      oldPrice: 1399,
      rating: 4.7,
      reviews: 202,
      stock: 14,
      description: "A bright tabletop mirror for makeup, grooming and skincare.",
      features: ["LED light ring", "Tabletop stand", "Clear reflection", "Useful for grooming routines"]
    },
    {
      id: "25",
      name: "Car Phone Holder",
      category: "Tech",
      price: 399,
      oldPrice: 599,
      rating: 4.5,
      reviews: 248,
      stock: 29,
      description: "Keep a phone securely positioned for maps and hands-free viewing.",
      features: ["Adjustable grip", "Easy mounting", "Wide phone compatibility", "Useful for navigation"]
    },
    {
      id: "26",
      name: "Laptop Stand",
      category: "Tech",
      price: 899,
      oldPrice: 1199,
      rating: 4.7,
      reviews: 231,
      stock: 17,
      badge: "Popular",
      description: "Raise a laptop for improved desk organisation and viewing comfort.",
      features: ["Adjustable angle", "Ventilated design", "Foldable body", "Stable anti-slip support"]
    },
    {
      id: "27",
      name: "Wireless Earbuds",
      category: "Tech",
      price: 1499,
      oldPrice: 1999,
      rating: 4.4,
      reviews: 312,
      stock: 22,
      description: "Compact wireless earbuds for music, calls and everyday listening.",
      features: ["Charging case", "Touch controls", "Built-in microphone", "Portable design"]
    },
    {
      id: "28",
      name: "Mini Sewing Machine",
      category: "Tech",
      price: 1299,
      oldPrice: 1799,
      rating: 4.3,
      reviews: 108,
      stock: 11,
      description: "A compact machine for basic stitching, small repairs and simple craft projects.",
      features: ["Compact tabletop size", "Basic stitching support", "Simple controls", "Useful for small repairs"]
    }
  ];

  const CATEGORY_ALIASES = {
    "home essentials": "Home",
    home: "Home",
    kitchen: "Kitchen",
    gadgets: "Tech",
    gadget: "Tech",
    technology: "Tech",
    tech: "Tech",
    "pet care": "Pet Care",
    pets: "Pet Care",
    beauty: "Beauty",
    "beauty & personal care": "Beauty",
    lifestyle: "Lifestyle",
    "lifestyle & gadgets": "Lifestyle"
  };

  const state = {
    products: [],
    cart: [],
    wishlist: [],
    filters: {
      query: "",
      category: "All",
      sort: "featured"
    }
  };

  function readJSON(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function slugify(value) {
    return String(value || "apnafinds-product")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeCategory(value) {
    const raw = String(value || "Other").trim();
    return CATEGORY_ALIASES[raw.toLowerCase()] || raw;
  }

  function isBadRemoteImage(value) {
    const raw = String(value || "").trim();
    const url = raw.toLowerCase();

    const supportedLocation =
      /^(https?:\/\/|data:image\/|blob:|\/|\.\/|\.\.\/|images\/)/i.test(raw);

    return (
      !url ||
      !supportedLocation ||
      url.startsWith("file:") ||
      url.endsWith(".svg") ||
      url.includes("/images/products/") ||
      url.includes("placeholder") ||
      url.includes("placehold.co") ||
      url.includes("picsum") ||
      url.includes("loremflickr") ||
      url.includes("source.unsplash")
    );
  }

  function photoFor(name) {
    return PRODUCT_PHOTOS[slugify(name)] || genericImage();
  }

  function localImageFor(name) {
    return photoFor(name);
  }

  function genericImage() {
    return "images/products/product-photo-unavailable.jpg";
  }

  function normalizeProduct(product, index = 0) {
    const name = String(
      product.name ??
      product.title ??
      `ApnaFinds Product ${index + 1}`
    ).trim();

    const category = normalizeCategory(
      product.category ??
      product.productCategory ??
      "Other"
    );

    const id = String(
      product.id ??
      product.productId ??
      product.sku ??
      slugify(name)
    );

    const suppliedImage = String(
      product.image ??
      product.imageUrl ??
      product.thumbnail ??
      ""
    ).trim();

    return {
      id,
      name,
      slug: slugify(name),
      category,
      price: Math.max(0, Number(product.price ?? product.salePrice ?? 0)),
      oldPrice: Math.max(
        0,
        Number(
          product.oldPrice ??
          product.originalPrice ??
          product.mrp ??
          product.price ??
          0
        )
      ),
      rating: Math.min(5, Math.max(0, Number(product.rating ?? 4.5))),
      reviews: Math.max(0, Math.floor(Number(product.reviews ?? 0))),
      stock: Math.max(0, Math.floor(Number(product.stock ?? 20))),
      badge: String(product.badge ?? "").trim(),
      description: String(
        product.description ??
        `${name} selected for practical everyday use.`
      ).trim(),
      features: Array.isArray(product.features) && product.features.length
        ? product.features.map(String).slice(0, 6)
        : [
            "Practical everyday design",
            "Easy to use",
            "Compact and convenient",
            "Selected by ApnaFinds"
          ],
      image: isBadRemoteImage(suppliedImage)
        ? photoFor(name)
        : suppliedImage,
      fallbackImage: genericImage(),
      active: product.active !== false &&
        String(product.status ?? "Active").toLowerCase() !== "inactive"
    };
  }

  function loadProducts() {
    const defaults = DEFAULT_PRODUCTS.map(normalizeProduct);
    const admin = readJSON(KEYS.products, []);

    if (!Array.isArray(admin) || !admin.length) {
      return defaults;
    }

    const merged = new Map();

    defaults.forEach(product => {
      merged.set(product.slug, product);
    });

    admin
      .filter(product => product && typeof product === "object")
      .map(normalizeProduct)
      .forEach(product => {
        const existing = merged.get(product.slug);
        merged.set(product.slug, {
          ...(existing || {}),
          ...product,
          id: product.id || existing?.id || product.slug
        });
      });

    return Array.from(merged.values()).filter(product => product.active);
  }

  function normalizeCartItem(item) {
    const product = getProductById(
      item.id ??
      item.productId ??
      item.slug ??
      item.name
    );

    return {
      id: String(
        item.id ??
        item.productId ??
        product?.id ??
        slugify(item.name)
      ),
      name: String(item.name ?? product?.name ?? "Product"),
      category: String(item.category ?? product?.category ?? "Other"),
      price: Math.max(0, Number(item.price ?? product?.price ?? 0)),
      oldPrice: Math.max(0, Number(item.oldPrice ?? product?.oldPrice ?? 0)),
      image: (() => {
        const savedImage = String(item.image ?? "").trim();
        return isBadRemoteImage(savedImage)
          ? String(product?.image ?? photoFor(item.name) ?? genericImage())
          : savedImage;
      })(),
      quantity: Math.max(1, Math.floor(Number(item.quantity ?? item.quanity ?? item.qty ?? 1)))
    };
  }

  function loadCart() {
    const primary = readJSON(KEYS.cart, []);
    const legacy = readJSON(KEYS.cartLegacy, []);

    const source =
      Array.isArray(primary) && primary.length
        ? primary
        : legacy;

    const normalized = Array.isArray(source)
      ? source.map(normalizeCartItem)
      : [];

    writeJSON(KEYS.cart, normalized);
    writeJSON(KEYS.cartLegacy, normalized);

    return normalized;
  }

  function saveCart() {
    writeJSON(KEYS.cart, state.cart);
    writeJSON(KEYS.cartLegacy, state.cart);
    updateHeaderCounts();
    updateAllQuantityControls();

    window.dispatchEvent(
      new CustomEvent("apnafinds:cart-updated", {
        detail: {
          cart: state.cart,
          quantity: getCartTotalQuantity()
        }
      })
    );
  }

  function loadWishlist() {
    const primary = readJSON(KEYS.wishlist, []);
    const legacy = readJSON(KEYS.wishlistLegacy, []);
    const source = Array.isArray(primary) && primary.length ? primary : legacy;

    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .map(item => {
        const product = getProductById(
          typeof item === "object"
            ? item.id ?? item.name
            : item
        );

        if (product) {
          return snapshotProduct(product);
        }

        return typeof item === "object"
          ? {
              ...item,
              id: String(item.id ?? slugify(item.name)),
              fallbackImage: item.fallbackImage || genericImage()
            }
          : null;
      })
      .filter(Boolean);
  }

  function saveWishlist() {
    writeJSON(KEYS.wishlist, state.wishlist);
    writeJSON(KEYS.wishlistLegacy, state.wishlist);
    updateHeaderCounts();
    updateAllWishlistButtons();
    renderWishlistDrawer();

    window.dispatchEvent(
      new CustomEvent("apnafinds:wishlist-updated", {
        detail: {
          wishlist: state.wishlist,
          count: state.wishlist.length
        }
      })
    );
  }

  function snapshotProduct(product) {
    return {
      id: String(product.id),
      name: product.name,
      category: product.category,
      price: product.price,
      oldPrice: product.oldPrice,
      rating: product.rating,
      reviews: product.reviews,
      stock: product.stock,
      image: product.image,
      fallbackImage: product.fallbackImage || genericImage(),
      addedAt: new Date().toISOString()
    };
  }

  function getProducts() {
    return state.products.slice();
  }

  function getProductById(id) {
    const query = String(id ?? "").trim().toLowerCase();

    if (!query) {
      return null;
    }

    return state.products.find(product => {
      return (
        String(product.id).toLowerCase() === query ||
        product.slug === slugify(query) ||
        product.name.toLowerCase() === query
      );
    }) || null;
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(amount) || 0);
  }

  function calculateDiscount(product) {
    if (!product.oldPrice || product.oldPrice <= product.price) {
      return 0;
    }

    return Math.round(
      ((product.oldPrice - product.price) / product.oldPrice) * 100
    );
  }

  function getCartItemQuantity(productId) {
    const item = state.cart.find(cartItem => {
      return String(cartItem.id) === String(productId);
    });

    return item ? Math.max(0, Number(item.quantity || 0)) : 0;
  }

  function getCartTotalQuantity() {
    return state.cart.reduce((sum, item) => {
      return sum + Math.max(0, Number(item.quantity || 0));
    }, 0);
  }

  function setCartItemQuantity(productId, requestedQuantity, notify = true) {
    const product = getProductById(productId);

    if (!product) {
      showToast("Product not found");
      return false;
    }

    const maximum = Math.max(0, Number(product.stock || 0));
    const quantity = Math.min(
      maximum,
      Math.max(0, Math.floor(Number(requestedQuantity) || 0))
    );

    const index = state.cart.findIndex(item => {
      return String(item.id) === String(product.id);
    });

    const previous = index >= 0
      ? Math.max(0, Number(state.cart[index].quantity || 0))
      : 0;

    if (quantity === 0) {
      if (index >= 0) {
        state.cart.splice(index, 1);
      }
    } else if (index >= 0) {
      state.cart[index] = {
        ...state.cart[index],
        ...snapshotProduct(product),
        quantity
      };
    } else {
      state.cart.push({
        ...snapshotProduct(product),
        quantity
      });
    }

    saveCart();

    if (notify) {
      if (previous === 0 && quantity > 0) {
        showToast(`${product.name} added to cart`);
      } else if (previous > 0 && quantity === 0) {
        showToast(`${product.name} removed from cart`);
      }
    }

    return true;
  }

  function addToCart(productId, quantity = 1) {
    return setCartItemQuantity(
      productId,
      getCartItemQuantity(productId) + Math.max(1, Number(quantity) || 1)
    );
  }

  function incrementCartItem(productId) {
    return setCartItemQuantity(
      productId,
      getCartItemQuantity(productId) + 1
    );
  }

  function decrementCartItem(productId) {
    return setCartItemQuantity(
      productId,
      getCartItemQuantity(productId) - 1
    );
  }

  function isWishlisted(productId) {
    return state.wishlist.some(item => {
      return String(item.id) === String(productId);
    });
  }

  function addToWishlist(productId) {
    const product = getProductById(productId);

    if (!product) {
      showToast("Product not found");
      return false;
    }

    if (!isWishlisted(product.id)) {
      state.wishlist.unshift(snapshotProduct(product));
      saveWishlist();
      showToast(`${product.name} saved to wishlist`);
    }

    return true;
  }

  function removeFromWishlist(productId) {
    const product = state.wishlist.find(item => {
      return String(item.id) === String(productId);
    });

    state.wishlist = state.wishlist.filter(item => {
      return String(item.id) !== String(productId);
    });

    saveWishlist();
    showToast(
      product?.name
        ? `${product.name} removed from wishlist`
        : "Product removed from wishlist"
    );

    if (document.body.dataset.page === "wishlist") {
      renderWishlistPage();
    }

    return true;
  }

  function toggleWishlist(productId) {
    if (isWishlisted(productId)) {
      removeFromWishlist(productId);
      return false;
    }

    addToWishlist(productId);
    return true;
  }

  function updateHeaderCounts() {
    const cartCount = getCartTotalQuantity();
    const wishlistCount = state.wishlist.length;

    document.querySelectorAll("[data-cart-count]").forEach(element => {
      element.textContent = cartCount > 99 ? "99+" : String(cartCount);
    });

    document.querySelectorAll("[data-wishlist-count]").forEach(element => {
      element.textContent = wishlistCount > 99
        ? "99+"
        : String(wishlistCount);
    });
  }

  function updateAllQuantityControls() {
    document.querySelectorAll("[data-quantity-display]").forEach(display => {
      const productId = display.dataset.quantityDisplay;
      const product = getProductById(productId);
      const quantity = getCartItemQuantity(productId);
      const control = display.closest("[data-quantity-stepper]");

      display.textContent = String(quantity);

      if (control) {
        control.classList.toggle("active", quantity > 0);

        const minus = control.querySelector('[data-cart-action="minus"]');
        const plus = control.querySelector('[data-cart-action="plus"]');

        if (minus) {
          minus.disabled = quantity <= 0;
        }

        if (plus) {
          plus.disabled =
            !product ||
            product.stock <= 0 ||
            quantity >= product.stock;
        }
      }

      const label = document.querySelector(
        `[data-quantity-label="${CSS.escape(String(productId))}"]`
      );

      if (label) {
        label.textContent = quantity > 0
          ? `${quantity} in cart`
          : "Add to cart";
        label.classList.toggle("active", quantity > 0);
      }
    });
  }

  function updateAllWishlistButtons() {
    document.querySelectorAll("[data-wishlist-toggle]").forEach(button => {
      const saved = isWishlisted(button.dataset.wishlistToggle);

      button.classList.toggle("saved", saved);
      button.setAttribute(
        "aria-label",
        saved ? "Remove from wishlist" : "Add to wishlist"
      );
      button.title = saved ? "Remove from wishlist" : "Add to wishlist";

      const icon = button.querySelector("i");

      if (icon) {
        icon.className = saved
          ? "fa-solid fa-heart"
          : "fa-regular fa-heart";
      }
    });
  }

  function imageMarkup(product, className = "") {
    return `
      <img
        src="${escapeHTML(product.image)}"
        data-fallback="${escapeHTML(product.fallbackImage || genericImage())}"
        alt="${escapeHTML(product.name)}"
        class="${className}"
        loading="lazy"
        onerror="
          if (this.dataset.fallbackApplied !== 'true') {
            this.dataset.fallbackApplied = 'true';
            this.src = this.dataset.fallback;
          } else {
            this.onerror = null;
          }
        "
      >
    `;
  }

  function quantityMarkup(product, large = false) {
    const quantity = getCartItemQuantity(product.id);

    return `
      <div>
        <div
          class="quantity-label ${quantity > 0 ? "active" : ""}"
          data-quantity-label="${escapeHTML(product.id)}"
        >
          ${quantity > 0 ? `${quantity} in cart` : "Add to cart"}
        </div>

        <div
          class="quantity-stepper ${quantity > 0 ? "active" : ""}"
          data-quantity-stepper
        >
          <button
            type="button"
            data-cart-action="minus"
            data-product-id="${escapeHTML(product.id)}"
            aria-label="Remove one ${escapeHTML(product.name)}"
            ${quantity <= 0 ? "disabled" : ""}
          >
            <i class="fa-solid fa-minus"></i>
          </button>

          <span data-quantity-display="${escapeHTML(product.id)}">
            ${quantity}
          </span>

          <button
            type="button"
            data-cart-action="plus"
            data-product-id="${escapeHTML(product.id)}"
            aria-label="Add one ${escapeHTML(product.name)}"
            ${product.stock <= 0 || quantity >= product.stock ? "disabled" : ""}
          >
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>
      </div>
    `;
  }

  function productCard(product) {
    const discount = calculateDiscount(product);

    return `
      <article class="product-card gold-card">
        <div class="product-media">
          <a href="product.html?id=${encodeURIComponent(product.id)}">
            ${imageMarkup(product)}
          </a>

          ${product.badge ? `
            <span class="product-badge">
              ${escapeHTML(product.badge)}
            </span>
          ` : ""}

          <button
            type="button"
            class="wishlist-toggle"
            data-wishlist-toggle="${escapeHTML(product.id)}"
            aria-label="Add ${escapeHTML(product.name)} to wishlist"
          >
            <i class="${isWishlisted(product.id) ? "fa-solid" : "fa-regular"} fa-heart"></i>
          </button>
        </div>

        <div class="product-content">
          <div class="product-category">
            ${escapeHTML(product.category)}
          </div>

          <a href="product.html?id=${encodeURIComponent(product.id)}">
            <h3 class="product-title">${escapeHTML(product.name)}</h3>
          </a>

          <div class="rating-row">
            <span class="rating-pill">
              <i class="fa-solid fa-star"></i>
              ${product.rating.toFixed(1)}
            </span>
            <span>${product.reviews.toLocaleString("en-IN")} reviews</span>
          </div>

          <div class="price-row">
            <strong class="product-price">${formatMoney(product.price)}</strong>
            ${product.oldPrice > product.price ? `
              <span class="old-price">${formatMoney(product.oldPrice)}</span>
            ` : ""}
            ${discount ? `
              <span class="rating-pill">${discount}% off</span>
            ` : ""}
          </div>

          <div class="product-actions">
            ${quantityMarkup(product)}

            <a
              class="details-button"
              href="product.html?id=${encodeURIComponent(product.id)}"
              aria-label="View ${escapeHTML(product.name)}"
            >
              <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function getFilteredProducts() {
    const query = state.filters.query.trim().toLowerCase();
    const category = normalizeCategory(state.filters.category);

    let products = state.products.filter(product => {
      const text = [
        product.name,
        product.category,
        product.description,
        ...(product.features || [])
      ].join(" ").toLowerCase();

      const queryMatch = !query || text.includes(query);
      const categoryMatch =
        category === "All" ||
        product.category === category;

      return queryMatch && categoryMatch;
    });

    switch (state.filters.sort) {
      case "price-low":
        products.sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        products.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        products.sort((a, b) => b.rating - a.rating);
        break;
      case "name":
        products.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        products.sort((a, b) => {
          const badgeA = a.badge ? 1 : 0;
          const badgeB = b.badge ? 1 : 0;
          return badgeB - badgeA || b.reviews - a.reviews;
        });
    }

    return products;
  }

  function renderCategoryPills() {
    const holder = document.getElementById("categoryPills");

    if (!holder) {
      return;
    }

    const categories = [
      "All",
      ...Array.from(
        new Set(state.products.map(product => product.category))
      ).sort()
    ];

    holder.innerHTML = categories.map(category => `
      <button
        type="button"
        class="category-pill ${
          state.filters.category === category ? "active" : ""
        }"
        data-category="${escapeHTML(category)}"
      >
        ${escapeHTML(category)}
      </button>
    `).join("");
  }

  function renderProductsPage() {
    const grid = document.getElementById("productsGrid");
    const empty = document.getElementById("productsEmpty");
    const count = document.getElementById("productResultCount");
    const title = document.getElementById("productListTitle");

    if (!grid) {
      return;
    }

    const products = getFilteredProducts();

    if (count) {
      count.textContent = `${products.length} ${
        products.length === 1 ? "product" : "products"
      }`;
    }

    if (title) {
      title.textContent =
        state.filters.category === "All"
          ? "All Products"
          : state.filters.category;
    }

    grid.classList.toggle("hidden", products.length === 0);
    empty?.classList.toggle("hidden", products.length !== 0);

    grid.innerHTML = products.map(productCard).join("");
    updateAllQuantityControls();
    updateAllWishlistButtons();
  }

  function renderHomePage() {
    const featuredGrid = document.getElementById("featuredProducts");
    const trendingGrid = document.getElementById("trendingProducts");
    const heroImage = document.getElementById("heroProductImage");
    const heroName = document.getElementById("heroProductName");
    const heroPrice = document.getElementById("heroProductPrice");

    const featured = state.products
      .slice()
      .sort((a, b) => {
        const badgeA = a.badge ? 1 : 0;
        const badgeB = b.badge ? 1 : 0;
        return badgeB - badgeA || b.reviews - a.reviews;
      })
      .slice(0, 8);

    const trending = state.products
      .slice()
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 4);

    if (featuredGrid) {
      featuredGrid.innerHTML = featured.map(productCard).join("");
    }

    if (trendingGrid) {
      trendingGrid.innerHTML = trending.map(productCard).join("");
    }

    const heroProduct = featured[0];

    if (heroProduct && heroImage) {
      heroImage.src = heroProduct.image;
      heroImage.dataset.fallback = heroProduct.fallbackImage;
      heroImage.alt = heroProduct.name;
      heroImage.onerror = function () {
        this.src = this.dataset.fallback;
      };
      heroName.textContent = heroProduct.name;
      heroPrice.textContent = formatMoney(heroProduct.price);
    }

    updateAllQuantityControls();
    updateAllWishlistButtons();
  }

  function renderProductPage() {
    const root = document.getElementById("productDetail");

    if (!root) {
      return;
    }

    const requestedId = new URLSearchParams(location.search).get("id");
    const product =
      getProductById(requestedId) ||
      state.products[0];

    if (!product) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
          <h2>Product unavailable</h2>
          <p>This product could not be found.</p>
          <a class="primary-button" href="products.html">Browse Products</a>
        </div>
      `;
      return;
    }

    document.title = `${product.name} | ApnaFinds`;

    const discount = calculateDiscount(product);

    root.innerHTML = `
      <div class="product-detail-grid">
        <div class="detail-image-card gold-card">
          ${imageMarkup(product)}
        </div>

        <div>
          <div class="breadcrumb">
            <a href="index.html">Home</a>
            <span>/</span>
            <a href="products.html">Products</a>
            <span>/</span>
            <a href="products.html?category=${encodeURIComponent(product.category)}">
              ${escapeHTML(product.category)}
            </a>
          </div>

          <div class="detail-category">${escapeHTML(product.category)}</div>
          <h1 class="detail-title">${escapeHTML(product.name)}</h1>

          <div class="detail-meta">
            <span class="meta-pill star">
              <i class="fa-solid fa-star"></i>
              ${product.rating.toFixed(1)}
            </span>
            <span class="meta-pill">${product.reviews.toLocaleString("en-IN")} reviews</span>
            <span class="meta-pill">
              ${product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
            </span>
          </div>

          <div class="detail-price">
            <strong>${formatMoney(product.price)}</strong>
            ${product.oldPrice > product.price ? `
              <span class="old-price">${formatMoney(product.oldPrice)}</span>
            ` : ""}
            ${discount ? `
              <span class="rating-pill">${discount}% off</span>
            ` : ""}
          </div>

          <p class="detail-description">
            ${escapeHTML(product.description)}
          </p>

          <ul class="feature-list">
            ${product.features.map(feature => `
              <li>
                <span class="feature-check">
                  <i class="fa-solid fa-check"></i>
                </span>
                <span>${escapeHTML(feature)}</span>
              </li>
            `).join("")}
          </ul>

          <div class="purchase-card gold-card">
            <div class="quantity-label ${
              getCartItemQuantity(product.id) > 0 ? "active" : ""
            }" data-quantity-label="${escapeHTML(product.id)}">
              ${
                getCartItemQuantity(product.id) > 0
                  ? `${getCartItemQuantity(product.id)} in cart`
                  : "Add to cart"
              }
            </div>

            <div class="purchase-row">
              ${quantityMarkup(product, true)}

              <button
                type="button"
                class="secondary-button"
                data-wishlist-toggle="${escapeHTML(product.id)}"
              >
                <i class="${
                  isWishlisted(product.id) ? "fa-solid" : "fa-regular"
                } fa-heart"></i>
                <span>${
                  isWishlisted(product.id)
                    ? "Saved to Wishlist"
                    : "Save to Wishlist"
                }</span>
              </button>

              <a class="primary-button" href="cart.html">
                <i class="fa-solid fa-bag-shopping"></i>
                View Cart
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    const related = state.products
      .filter(item => (
        item.category === product.category &&
        item.id !== product.id
      ))
      .slice(0, 4);

    const relatedGrid = document.getElementById("relatedProducts");

    if (relatedGrid) {
      relatedGrid.innerHTML = related.map(productCard).join("");
    }

    updateAllQuantityControls();
    updateAllWishlistButtons();
  }

  function wishlistProductCard(product) {
    const liveProduct = getProductById(product.id) || product;
    return productCard(liveProduct);
  }

  function renderWishlistPage() {
    const grid = document.getElementById("wishlistGrid");
    const empty = document.getElementById("wishlistEmpty");
    const layout = document.getElementById("wishlistLayout");
    const count = document.getElementById("wishlistPageCount");
    const summaryCount = document.getElementById("wishlistSummaryCount");

    if (!grid) {
      return;
    }

    if (count) {
      count.textContent = `${state.wishlist.length} saved ${
        state.wishlist.length === 1 ? "item" : "items"
      }`;
    }

    if (summaryCount) {
      summaryCount.textContent = String(state.wishlist.length);
    }

    const hasItems = state.wishlist.length > 0;

    layout?.classList.toggle("hidden", !hasItems);
    empty?.classList.toggle("hidden", hasItems);

    if (!hasItems) {
      grid.innerHTML = "";
      return;
    }

    grid.innerHTML = state.wishlist
      .map(wishlistProductCard)
      .join("");

    updateAllQuantityControls();
    updateAllWishlistButtons();
  }

  function renderWishlistDrawer() {
    const list = document.getElementById("wishlistDrawerList");
    const empty = document.getElementById("wishlistDrawerEmpty");
    const footer = document.getElementById("wishlistDrawerFooter");
    const count = document.getElementById("wishlistDrawerCount");

    if (!list) {
      return;
    }

    if (count) {
      count.textContent = String(state.wishlist.length);
    }

    const hasItems = state.wishlist.length > 0;

    empty?.classList.toggle("hidden", hasItems);
    footer?.classList.toggle("hidden", !hasItems);
    list.classList.toggle("hidden", !hasItems);

    list.innerHTML = state.wishlist.map(saved => {
      const product = getProductById(saved.id) || saved;

      return `
        <article class="drawer-product">
          ${imageMarkup(product)}
          <div>
            <a href="product.html?id=${encodeURIComponent(product.id)}">
              <h3>${escapeHTML(product.name)}</h3>
            </a>
            <strong>${formatMoney(product.price)}</strong>
            <div class="drawer-product-actions">
              <button
                type="button"
                class="mini-button"
                data-drawer-add="${escapeHTML(product.id)}"
              >
                Add to Cart
              </button>
              <button
                type="button"
                class="mini-button remove"
                data-drawer-remove="${escapeHTML(product.id)}"
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function openWishlistDrawer() {
    renderWishlistDrawer();
    document.getElementById("wishlistDrawer")?.classList.add("open");
    document.getElementById("wishlistDrawerOverlay")?.classList.add("open");
    document.body.classList.add("no-scroll");
  }

  function closeWishlistDrawer() {
    document.getElementById("wishlistDrawer")?.classList.remove("open");
    document.getElementById("wishlistDrawerOverlay")?.classList.remove("open");
    document.body.classList.remove("no-scroll");
  }

  function addAllWishlistToCart() {
    let added = 0;

    state.wishlist.forEach(saved => {
      const product = getProductById(saved.id);

      if (product && product.stock > 0) {
        setCartItemQuantity(
          product.id,
          getCartItemQuantity(product.id) + 1,
          false
        );
        added += 1;
      }
    });

    showToast(
      added > 0
        ? `${added} wishlist products added to cart`
        : "No available products to add"
    );

    return added;
  }

  function showToast(message) {
    let toast = document.getElementById("storeToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "storeToast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 2200);
  }

  function resetFilters() {
    state.filters = {
      query: "",
      category: "All",
      sort: "featured"
    };

    const search = document.getElementById("productSearch");
    const sort = document.getElementById("productSort");

    if (search) {
      search.value = "";
    }

    if (sort) {
      sort.value = "featured";
    }

    renderCategoryPills();
    renderProductsPage();
  }

  function initializePageState() {
    state.products = loadProducts();
    state.cart = loadCart();
    state.wishlist = loadWishlist();

    const params = new URLSearchParams(location.search);
    const query = params.get("q") || "";
    const category = params.get("category") || "All";

    state.filters.query = query;
    state.filters.category =
      category === "All"
        ? "All"
        : normalizeCategory(category);

    const search = document.getElementById("productSearch");

    if (search) {
      search.value = query;
    }
  }

  function bindEvents() {
    document.addEventListener("click", event => {
      const plus = event.target.closest('[data-cart-action="plus"]');

      if (plus) {
        incrementCartItem(plus.dataset.productId);
        return;
      }

      const minus = event.target.closest('[data-cart-action="minus"]');

      if (minus) {
        decrementCartItem(minus.dataset.productId);
        return;
      }

      const wishlistButton = event.target.closest("[data-wishlist-toggle]");

      if (wishlistButton) {
        const saved = toggleWishlist(
          wishlistButton.dataset.wishlistToggle
        );

        const text = wishlistButton.querySelector("span");

        if (text) {
          text.textContent = saved
            ? "Saved to Wishlist"
            : "Save to Wishlist";
        }

        if (document.body.dataset.page === "wishlist") {
          renderWishlistPage();
        }

        return;
      }

      const categoryButton = event.target.closest("[data-category]");

      if (categoryButton) {
        state.filters.category = categoryButton.dataset.category;
        renderCategoryPills();
        renderProductsPage();
        return;
      }

      const drawerOpen = event.target.closest("[data-open-wishlist]");

      if (drawerOpen) {
        openWishlistDrawer();
        return;
      }

      const drawerClose = event.target.closest("[data-close-wishlist]");

      if (drawerClose) {
        closeWishlistDrawer();
        return;
      }

      const drawerAdd = event.target.closest("[data-drawer-add]");

      if (drawerAdd) {
        addToCart(drawerAdd.dataset.drawerAdd);
        return;
      }

      const drawerRemove = event.target.closest("[data-drawer-remove]");

      if (drawerRemove) {
        removeFromWishlist(drawerRemove.dataset.drawerRemove);
        return;
      }

      const addAll = event.target.closest("[data-add-all-wishlist]");

      if (addAll) {
        const added = addAllWishlistToCart();

        if (added && addAll.dataset.goCart === "true") {
          location.href = "cart.html";
        }

        return;
      }

      const clearWishlist = event.target.closest("[data-clear-wishlist]");

      if (clearWishlist) {
        if (confirm("Remove all saved wishlist products?")) {
          state.wishlist = [];
          saveWishlist();
          renderWishlistPage();
        }
      }
    });

    document.getElementById("wishlistDrawerOverlay")
      ?.addEventListener("click", closeWishlistDrawer);

    document.getElementById("productSearch")
      ?.addEventListener("input", event => {
        state.filters.query = event.target.value;
        renderProductsPage();
      });

    document.getElementById("productSort")
      ?.addEventListener("change", event => {
        state.filters.sort = event.target.value;
        renderProductsPage();
      });

    document.getElementById("resetFilters")
      ?.addEventListener("click", resetFilters);

    window.addEventListener("storage", event => {
      if (
        [KEYS.cart, KEYS.cartLegacy].includes(event.key)
      ) {
        state.cart = loadCart();
        updateHeaderCounts();
        updateAllQuantityControls();
      }

      if (
        [KEYS.wishlist, KEYS.wishlistLegacy].includes(event.key)
      ) {
        state.wishlist = loadWishlist();
        updateHeaderCounts();
        updateAllWishlistButtons();
        renderWishlistPage();
        renderWishlistDrawer();
      }

      if (event.key === KEYS.products) {
        state.products = loadProducts();

        if (document.body.dataset.page === "products") {
          renderCategoryPills();
          renderProductsPage();
        }

        if (document.body.dataset.page === "home") {
          renderHomePage();
        }

        if (document.body.dataset.page === "product") {
          renderProductPage();
        }
      }
    });

    window.addEventListener("pageshow", () => {
      state.cart = loadCart();
      state.wishlist = loadWishlist();
      updateHeaderCounts();
      updateAllQuantityControls();
      updateAllWishlistButtons();
    });

    window.addEventListener("apnafinds:cart-updated", () => {
      state.cart = loadCart();
      updateHeaderCounts();
      updateAllQuantityControls();
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeWishlistDrawer();
      }
    });
  }

  function init() {
    initializePageState();
    bindEvents();
    updateHeaderCounts();
    renderWishlistDrawer();

    switch (document.body.dataset.page) {
      case "home":
        renderHomePage();
        break;
      case "products":
        renderCategoryPills();
        renderProductsPage();
        break;
      case "product":
        renderProductPage();
        break;
      case "wishlist":
        renderWishlistPage();
        break;
    }
  }

  window.ApnaFindsStore = {
    KEYS,
    getProducts,
    getProductById,
    getCartItemQuantity,
    getCartTotalQuantity,
    setCartItemQuantity,
    addToCart,
    incrementCartItem,
    decrementCartItem,
    loadWishlist: () => state.wishlist.slice(),
    saveWishlist: items => {
      state.wishlist = Array.isArray(items)
        ? items
        : [];
      saveWishlist();
    },
    isWishlisted,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    addAllWishlistToCart,
    openWishlistDrawer,
    closeWishlistDrawer,
    renderWishlistPage,
    updateHeaderCounts,
    showToast,
    formatMoney,
    productCard,
    genericImage
  };

  window.ApnaFindsProducts = {
    getAllProducts: getProducts,
    getProductById,
    getCart: () => state.cart.slice(),
    getCartQuantity: getCartTotalQuantity,
    getCartItemQuantity,
    setCartItemQuantity,
    addToCart,
    incrementCartItem,
    decrementCartItem,
    updateCartCounter: updateHeaderCounts,
    updateProductQuantityControls: updateAllQuantityControls
  };

  window.ApnaFindsWishlist = {
    loadWishlist: () => state.wishlist.slice(),
    saveWishlist: items => {
      state.wishlist = Array.isArray(items)
        ? items
        : [];
      saveWishlist();
    },
    isWishlisted,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    updateWishlistUI: () => {
      updateHeaderCounts();
      updateAllWishlistButtons();
      renderWishlistDrawer();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
