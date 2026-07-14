(() => {
  "use strict";

  const TOKEN_KEY = "apnafinds_admin_api_token";
  const ORDER_STATUSES = [
    "Order placed","Confirmed","Packed","Shipped","In transit",
    "Out for delivery","Delivered","Cancelled"
  ];
  const RETURN_STATUSES = [
    "Requested","Under Review","Approved","Pickup Scheduled","Received",
    "Refund Initiated","Refunded","Replacement Shipped","Rejected","Closed"
  ];

  const el = {
    token: document.getElementById("adminTokenInput"),
    connect: document.getElementById("connectButton"),
    toggleToken: document.getElementById("toggleTokenButton"),
    dot: document.getElementById("connectionDot"),
    label: document.getElementById("connectionLabel"),
    text: document.getElementById("connectionText"),
    refresh: document.getElementById("refreshButton"),
    export: document.getElementById("exportButton"),
    importOrders: document.getElementById("importOrdersButton"),
    importCustomers: document.getElementById("importCustomersButton"),
    ordersBody: document.getElementById("ordersBody"),
    customersBody: document.getElementById("customersBody"),
    returnsBody: document.getElementById("returnsBody"),
    activityList: document.getElementById("activityList"),
    orderSearch: document.getElementById("orderSearch"),
    orderFilter: document.getElementById("orderStatusFilter"),
    customerSearch: document.getElementById("customerSearch"),
    customerFilter: document.getElementById("customerStatusFilter"),
    returnSearch: document.getElementById("returnSearch"),
    returnFilter: document.getElementById("returnStatusFilter"),
    ordersCount: document.getElementById("ordersCount"),
    customersCount: document.getElementById("customersCount"),
    returnsCount: document.getElementById("returnsCount"),
    orderModal: document.getElementById("orderModal"),
    returnModal: document.getElementById("returnModal"),
    toast: document.getElementById("toast"),
    sidebar: document.getElementById("sidebar"),
    sidebarOverlay: document.getElementById("sidebarOverlay")
  };

  let data = {
    orders: [],
    customers: [],
    returns: [],
    events: [],
    counts: {}
  };
  let activeTab = "orders";
  let toastTimer = null;

  el.token.value = localStorage.getItem(TOKEN_KEY) || "";

  function esc(value) {
    const div = document.createElement("div");
    div.textContent = String(value ?? "");
    return div.innerHTML;
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency", currency: "INR", maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function date(value) {
    if (!value) return "—";
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? String(value) :
      new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  }

  function pill(status) {
    const value = String(status || "Unknown");
    const lower = value.toLowerCase();
    let tone = "gray";
    if (/deliver|approved|refund|active|received|complete/.test(lower)) tone = "green";
    else if (/ship|transit|pickup|book|out for delivery/.test(lower)) tone = "blue";
    else if (/request|pending|review|placed|confirm|pack/.test(lower)) tone = "amber";
    else if (/cancel|reject|blocked|fail/.test(lower)) tone = "red";
    else if (/replace|reverse/.test(lower)) tone = "purple";
    return `<span class="pill ${tone}">${esc(value)}</span>`;
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2800);
  }

  function busy(button, state, label = "Working") {
    if (!button) return;
    if (state) {
      button.dataset.original = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<i class="fa-solid fa-spinner loading-spin"></i> ${esc(label)}`;
    } else {
      button.disabled = false;
      if (button.dataset.original) {
        button.innerHTML = button.dataset.original;
        delete button.dataset.original;
      }
    }
  }

  function setConnection(mode, label, text) {
    el.dot.className = `status-dot ${mode}`;
    el.label.textContent = label;
    el.text.textContent = text;
  }

  function readArray(key) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function browserOrders() {
    const map = new Map();
    for (const key of ["apnafinds_orders","orders","orderHistory"]) {
      for (const order of readArray(key)) {
        const id = String(order.id || order.orderId || order.number || "").trim();
        if (id) map.set(id.toUpperCase(), order);
      }
    }
    return [...map.values()];
  }

  function normalizedServerOrder(order) {
    const address = order.shippingAddress || {};
    const id = String(order.id || order.orderId || order.number || "").trim();
    const phone = String(order.phone || order.mobile || address.phone || "");
    const email = String(order.email || order.customerEmail || "");
    const items = Array.isArray(order.items) ? order.items : Array.isArray(order.cart) ? order.cart : [];

    return {
      ...order,
      id,
      orderId: id,
      customerName: order.customerName || order.name || address.name || "Customer",
      phone,
      email,
      items,
      shippingAddress: {
        ...address,
        name: address.name || order.customerName || order.name || "Customer",
        phone,
        address: address.address || address.line1 || order.address || "",
        city: address.city || order.city || "",
        state: address.state || order.state || "",
        pincode: String(address.pincode || order.pincode || "")
      }
    };
  }

  function browserCustomers() {
    const result = [];
    const keys = ["apnafinds_users","users","registeredUsers"];
    for (const key of keys) result.push(...readArray(key));

    try {
      const current = JSON.parse(localStorage.getItem("currentUser") || "null");
      if (current && typeof current === "object") result.push(current);
    } catch {}

    const map = new Map();
    for (const user of result) {
      const email = String(user.email || "").trim().toLowerCase();
      const phone = String(user.phone || user.mobile || "").replace(/\s+/g,"");
      const name = String(user.name || user.fullName || "").trim();
      const key = email || phone || name.toLowerCase();
      if (key) map.set(key, { ...user, name: name || user.username || "Customer", email, phone, status: user.status || "Active" });
    }
    return [...map.values()];
  }

  async function loadManagement(showSuccess = false) {
    if (!el.token.value.trim()) {
      setConnection("", "Waiting for token", "Not connected");
      return;
    }

    localStorage.setItem(TOKEN_KEY, el.token.value.trim());
    setConnection("loading", "Connecting", "Loading management data");
    busy(el.refresh, true, "Refreshing");

    try {
      data = await ApnaFindsAPI.adminRequest("/api/admin/management");
      data.orders = Array.isArray(data.orders) ? data.orders : [];
      data.customers = Array.isArray(data.customers) ? data.customers : [];
      data.returns = Array.isArray(data.returns) ? data.returns : [];
      data.events = Array.isArray(data.events) ? data.events : [];
      data.counts = data.counts || {};

      document.getElementById("statOrders").textContent = data.counts.orders ?? data.orders.length;
      document.getElementById("statCustomers").textContent = data.counts.customers ?? data.customers.length;
      document.getElementById("statReturns").textContent = data.counts.returns ?? data.returns.length;
      document.getElementById("statShipments").textContent = data.counts.shipments ?? 0;
      document.getElementById("statRevenue").textContent = money(data.counts.revenue);

      setConnection(
        "online",
        "Connected",
        `${data.provider?.provider || "Logistics"} · ${String(data.provider?.mode || "demo").toUpperCase()}`
      );

      renderAll();
      if (showSuccess) showToast("Admin management refreshed.");
    } catch (error) {
      setConnection("error", "Connection failed", error.message);
      showToast(error.message);
    } finally {
      busy(el.refresh, false);
    }
  }

  function orderSearchText(bundle) {
    const order = bundle.order || {};
    const shipment = bundle.shipment || {};
    return [
      order.id, order.orderId, order.customerName, order.phone, order.email,
      order.status, shipment.courier, shipment.awb
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function renderOrders() {
    const query = el.orderSearch.value.trim().toLowerCase();
    const filter = el.orderFilter.value;
    const visible = data.orders.filter(bundle => {
      const order = bundle.order || {};
      const status = String(order.status || "").toLowerCase();
      return orderSearchText(bundle).includes(query) && (filter === "all" || status.includes(filter));
    });

    if (!visible.length) {
      el.ordersBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-box-open"></i><strong>No matching orders</strong><span>Import browser orders or change the filters.</span></div></td></tr>`;
    } else {
      el.ordersBody.innerHTML = visible.map(bundle => {
        const order = bundle.order || {};
        const shipment = bundle.shipment || {};
        const id = String(order.id || order.orderId || "");
        const items = Array.isArray(order.items) ? order.items : [];
        const quantity = items.reduce((sum,item)=>sum+Math.max(1,Number(item.quantity||item.qty||1)),0);
        const contact = order.phone || order.email || order.shippingAddress?.phone || "";

        return `<tr>
          <td><strong>${esc(id)}</strong><small>${esc(date(order.createdAt || order.date))}</small></td>
          <td><strong>${esc(order.customerName || "Customer")}</strong><small>${esc(contact || "No contact")}</small></td>
          <td><strong>${quantity} item${quantity===1?"":"s"}</strong><small>${esc(items.slice(0,2).map(item=>item.name||item.title).filter(Boolean).join(", ") || "Item details unavailable")}</small></td>
          <td><strong>${money(order.total || order.orderTotal)}</strong></td>
          <td>${pill(order.status || "Order placed")}</td>
          <td><strong>${esc(shipment.courier || order.courier || "Not assigned")}</strong><small>${esc(shipment.awb || order.awb || "No AWB")}</small></td>
          <td><strong>${esc(date(order.updatedAt || order.createdAt))}</strong></td>
          <td><div class="row-actions">
            <button class="small-btn primary" data-edit-order="${esc(id)}"><i class="fa-solid fa-pen"></i> Update</button>
            <a class="small-btn blue" href="track-order.html?order=${encodeURIComponent(id)}&contact=${encodeURIComponent(contact)}"><i class="fa-solid fa-location-dot"></i> Track</a>
            <a class="small-btn secondary" href="invoice.html?order=${encodeURIComponent(id)}"><i class="fa-solid fa-file-invoice"></i> Invoice</a>
          </div></td>
        </tr>`;
      }).join("");
    }

    el.ordersCount.textContent = `${visible.length} of ${data.orders.length} orders displayed`;
  }

  function renderCustomers() {
    const query = el.customerSearch.value.trim().toLowerCase();
    const filter = el.customerFilter.value;
    const visible = data.customers.filter(customer => {
      const search = [customer.id,customer.name,customer.email,customer.phone].filter(Boolean).join(" ").toLowerCase();
      const status = String(customer.status || "Active").toLowerCase();
      return search.includes(query) && (filter === "all" || status === filter);
    });

    if (!visible.length) {
      el.customersBody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="fa-solid fa-users"></i><strong>No matching customers</strong><span>Import browser accounts or wait for server orders.</span></div></td></tr>`;
    } else {
      el.customersBody.innerHTML = visible.map(customer => `
        <tr>
          <td><strong>${esc(customer.name || "Customer")}</strong><small>${esc(customer.id || "")}</small></td>
          <td><strong>${esc(customer.email || "No email")}</strong><small>${esc(customer.phone || "No phone")}</small></td>
          <td><strong>${Number(customer.ordersCount || 0)}</strong></td>
          <td><strong>${money(customer.totalSpent)}</strong></td>
          <td><strong>${esc(date(customer.lastOrderAt))}</strong></td>
          <td>${pill(customer.status || "Active")}</td>
          <td><div class="row-actions">
            <button class="small-btn ${String(customer.status).toLowerCase()==="blocked"?"secondary":"danger"}" data-customer-status="${esc(customer.id)}" data-next-status="${String(customer.status).toLowerCase()==="blocked"?"Active":"Blocked"}">
              <i class="fa-solid ${String(customer.status).toLowerCase()==="blocked"?"fa-user-check":"fa-user-slash"}"></i>
              ${String(customer.status).toLowerCase()==="blocked"?"Activate":"Block"}
            </button>
          </div></td>
        </tr>`).join("");
    }

    el.customersCount.textContent = `${visible.length} of ${data.customers.length} customers displayed`;
  }

  function returnFilterMatch(status, filter) {
    const value = String(status || "").toLowerCase();
    if (filter === "all") return true;
    if (filter === "requested") return value.includes("request");
    if (filter === "review") return value.includes("review");
    if (filter === "approved") return value.includes("approved");
    if (filter === "pickup") return value.includes("pickup");
    if (filter === "received") return value.includes("received");
    if (filter === "refund") return value.includes("refund");
    if (filter === "replacement") return value.includes("replacement");
    if (filter === "rejected") return value.includes("reject");
    if (filter === "closed") return value.includes("closed");
    return true;
  }

  function renderReturns() {
    const query = el.returnSearch.value.trim().toLowerCase();
    const filter = el.returnFilter.value;
    const visible = data.returns.filter(request => {
      const search = [request.id,request.orderId,request.customerName,request.phone,request.email,request.type,request.reason,request.status].filter(Boolean).join(" ").toLowerCase();
      return search.includes(query) && returnFilterMatch(request.status, filter);
    });

    if (!visible.length) {
      el.returnsBody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><i class="fa-solid fa-rotate-left"></i><strong>No matching requests</strong><span>Return, replacement and refund requests will appear here.</span></div></td></tr>`;
    } else {
      el.returnsBody.innerHTML = visible.map(request => `
        <tr>
          <td><strong>${esc(request.id || "—")}</strong><small>${esc(date(request.createdAt))}</small></td>
          <td><strong>${esc(request.orderId || "—")}</strong></td>
          <td><strong>${esc(request.customerName || "Customer")}</strong><small>${esc(request.phone || request.email || "No contact")}</small></td>
          <td><strong>${esc(request.type || "Return")}</strong><small>${esc(request.reason || "Customer request")}</small></td>
          <td><strong>${money(request.estimatedValue)}</strong></td>
          <td>${pill(request.status || "Requested")}</td>
          <td><strong>${esc(request.reverseShipment?.awb || "Not generated")}</strong></td>
          <td><div class="row-actions">
            <button class="small-btn primary" data-edit-return="${esc(request.id)}"><i class="fa-solid fa-pen"></i> Update</button>
            <button class="small-btn secondary" data-reverse-pickup="${esc(request.id)}"><i class="fa-solid fa-truck-arrow-right"></i> Reverse Pickup</button>
          </div></td>
        </tr>`).join("");
    }

    el.returnsCount.textContent = `${visible.length} of ${data.returns.length} requests displayed`;
  }

  function renderActivity() {
    if (!data.events.length) {
      el.activityList.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i><strong>No server activity</strong><span>Management and logistics actions will appear here.</span></div>`;
      return;
    }

    el.activityList.innerHTML = data.events.slice(0,50).map(event => `
      <article class="activity-item"><span class="activity-icon"><i class="fa-solid fa-bolt"></i></span><div><h4>${esc(event.message || "Activity")}</h4><p>${esc(event.type || "event")} · ${esc(date(event.createdAt))}</p></div></article>
    `).join("");
  }

  function renderAll() {
    renderOrders();
    renderCustomers();
    renderReturns();
    renderActivity();
  }

  function setTab(tab) {
    activeTab = ["orders","customers","returns","activity"].includes(tab) ? tab : "orders";
    document.querySelectorAll("[data-tab]").forEach(button => button.classList.toggle("active", button.dataset.tab === activeTab));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    document.getElementById(`${activeTab}Panel`).classList.add("active");
    history.replaceState(null,"",`#${activeTab}`);
  }

  function fillSelect(select, values, selected) {
    select.innerHTML = values.map(value => `<option value="${esc(value)}" ${value===selected?"selected":""}>${esc(value)}</option>`).join("");
  }

  function openOrderModal(orderId) {
    const bundle = data.orders.find(item => String(item.order?.id || item.order?.orderId) === orderId);
    if (!bundle) return;
    const order = bundle.order || {};
    document.getElementById("modalOrderId").value = orderId;
    fillSelect(document.getElementById("modalOrderStatus"), ORDER_STATUSES, order.status || "Order placed");
    document.getElementById("modalOrderLocation").value = "";
    document.getElementById("modalOrderNote").value = order.adminNote || "";
    el.orderModal.classList.add("open");
  }

  function closeOrderModal() { el.orderModal.classList.remove("open"); }
  function openReturnModal(requestId) {
    const request = data.returns.find(item => item.id === requestId);
    if (!request) return;
    document.getElementById("modalReturnId").value = requestId;
    fillSelect(document.getElementById("modalReturnStatus"), RETURN_STATUSES, request.status || "Requested");
    document.getElementById("modalReturnNote").value = request.adminNote || "";
    el.returnModal.classList.add("open");
  }
  function closeReturnModal() { el.returnModal.classList.remove("open"); }

  async function importOrders() {
    const orders = browserOrders().map(normalizedServerOrder).filter(order =>
      order.id && order.customerName && (order.phone || order.email) &&
      Array.isArray(order.items) && order.items.length &&
      /^[0-9]{6}$/.test(String(order.shippingAddress?.pincode || ""))
    );
    if (!orders.length) { showToast("No valid browser orders found."); return; }
    busy(el.importOrders,true,"Importing");
    try {
      const result = await ApnaFindsAPI.adminRequest("/api/admin/import-orders",{method:"POST",body:JSON.stringify({orders})});
      showToast(`Imported ${result.imported || 0} orders.`);
      await loadManagement();
    } catch(error) { showToast(error.message); }
    finally { busy(el.importOrders,false); }
  }

  async function importCustomers() {
    const customers = browserCustomers();
    if (!customers.length) { showToast("No browser customer accounts found."); return; }
    busy(el.importCustomers,true,"Importing");
    try {
      const result = await ApnaFindsAPI.adminRequest("/api/admin/import-customers",{method:"POST",body:JSON.stringify({customers})});
      showToast(`Imported ${result.imported || 0} customers.`);
      await loadManagement();
    } catch(error) { showToast(error.message); }
    finally { busy(el.importCustomers,false); }
  }

  function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g,'""')}"`;
  }

  function downloadCSV(filename, rows) {
    const blob = new Blob([rows.map(row=>row.map(csvCell).join(",")).join("\n")],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrent() {
    if (activeTab === "orders") {
      downloadCSV("apnafinds-orders.csv", [["Order ID","Customer","Phone","Email","Total","Status","Courier","AWB"], ...data.orders.map(bundle=>{
        const o=bundle.order||{},s=bundle.shipment||{};
        return [o.id||o.orderId,o.customerName,o.phone,o.email,o.total||o.orderTotal,o.status,s.courier,s.awb];
      })]);
    } else if (activeTab === "customers") {
      downloadCSV("apnafinds-customers.csv", [["Customer ID","Name","Email","Phone","Orders","Total Spent","Status"], ...data.customers.map(c=>[c.id,c.name,c.email,c.phone,c.ordersCount,c.totalSpent,c.status])]);
    } else if (activeTab === "returns") {
      downloadCSV("apnafinds-returns.csv", [["Request ID","Order ID","Customer","Type","Reason","Value","Status","Reverse AWB"], ...data.returns.map(r=>[r.id,r.orderId,r.customerName,r.type,r.reason,r.estimatedValue,r.status,r.reverseShipment?.awb])]);
    } else {
      downloadCSV("apnafinds-activity.csv", [["Event","Message","Date"], ...data.events.map(e=>[e.type,e.message,e.createdAt])]);
    }
    showToast("CSV export downloaded.");
  }

  el.connect.addEventListener("click",()=>{ const token=el.token.value.trim(); if(!token){showToast("Enter the Admin API Token.");return;} localStorage.setItem(TOKEN_KEY,token); loadManagement(true); });
  el.toggleToken.addEventListener("click",()=>{ const show=el.token.type==="password";el.token.type=show?"text":"password";el.toggleToken.innerHTML=`<i class="fa-regular ${show?"fa-eye-slash":"fa-eye"}"></i>`; });
  el.refresh.addEventListener("click",()=>loadManagement(true));
  el.export.addEventListener("click",exportCurrent);
  el.importOrders.addEventListener("click",importOrders);
  el.importCustomers.addEventListener("click",importCustomers);

  document.querySelectorAll("[data-tab]").forEach(button=>button.addEventListener("click",()=>setTab(button.dataset.tab)));
  el.orderSearch.addEventListener("input",renderOrders); el.orderFilter.addEventListener("change",renderOrders);
  el.customerSearch.addEventListener("input",renderCustomers); el.customerFilter.addEventListener("change",renderCustomers);
  el.returnSearch.addEventListener("input",renderReturns); el.returnFilter.addEventListener("change",renderReturns);

  el.ordersBody.addEventListener("click",event=>{ const button=event.target.closest("[data-edit-order]"); if(button) openOrderModal(button.dataset.editOrder); });
  el.customersBody.addEventListener("click",async event=>{
    const button=event.target.closest("[data-customer-status]"); if(!button)return;
    busy(button,true,"Saving");
    try{
      await ApnaFindsAPI.adminRequest(`/api/admin/customers/${encodeURIComponent(button.dataset.customerStatus)}/status`,{method:"POST",body:JSON.stringify({status:button.dataset.nextStatus})});
      showToast(`Customer updated to ${button.dataset.nextStatus}.`); await loadManagement();
    }catch(error){showToast(error.message)}finally{busy(button,false)}
  });
  el.returnsBody.addEventListener("click",async event=>{
    const edit=event.target.closest("[data-edit-return]"); if(edit){openReturnModal(edit.dataset.editReturn);return;}
    const reverse=event.target.closest("[data-reverse-pickup]"); if(!reverse)return;
    busy(reverse,true,"Booking");
    try{
      await ApnaFindsAPI.adminRequest(`/api/admin/returns/${encodeURIComponent(reverse.dataset.reversePickup)}/reverse-pickup`,{method:"POST",body:"{}"});
      showToast("Reverse pickup created."); await loadManagement();
    }catch(error){showToast(error.message)}finally{busy(reverse,false)}
  });

  document.getElementById("orderUpdateForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=document.getElementById("saveOrderUpdate");
    const id=document.getElementById("modalOrderId").value;
    busy(button,true,"Saving");
    try{
      await ApnaFindsAPI.adminRequest(`/api/admin/orders/${encodeURIComponent(id)}/status`,{
        method:"POST",
        body:JSON.stringify({
          status:document.getElementById("modalOrderStatus").value,
          location:document.getElementById("modalOrderLocation").value.trim(),
          adminNote:document.getElementById("modalOrderNote").value.trim(),
          activity:document.getElementById("modalOrderNote").value.trim() || undefined
        })
      });
      closeOrderModal(); showToast(`Order ${id} updated.`); await loadManagement();
    }catch(error){showToast(error.message)}finally{busy(button,false)}
  });

  document.getElementById("returnUpdateForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=document.getElementById("saveReturnUpdate");
    const id=document.getElementById("modalReturnId").value;
    busy(button,true,"Saving");
    try{
      await ApnaFindsAPI.adminRequest(`/api/admin/returns/${encodeURIComponent(id)}/status`,{
        method:"POST",
        body:JSON.stringify({status:document.getElementById("modalReturnStatus").value,adminNote:document.getElementById("modalReturnNote").value.trim()})
      });
      closeReturnModal(); showToast(`Return ${id} updated.`); await loadManagement();
    }catch(error){showToast(error.message)}finally{busy(button,false)}
  });

  document.getElementById("closeOrderModal").addEventListener("click",closeOrderModal);
  document.getElementById("cancelOrderModal").addEventListener("click",closeOrderModal);
  document.getElementById("closeReturnModal").addEventListener("click",closeReturnModal);
  document.getElementById("cancelReturnModal").addEventListener("click",closeReturnModal);
  el.orderModal.addEventListener("click",event=>{if(event.target===el.orderModal)closeOrderModal()});
  el.returnModal.addEventListener("click",event=>{if(event.target===el.returnModal)closeReturnModal()});

  document.getElementById("openSidebar").addEventListener("click",()=>{el.sidebar.classList.add("open");el.sidebarOverlay.classList.add("open")});
  document.getElementById("closeSidebar").addEventListener("click",()=>{el.sidebar.classList.remove("open");el.sidebarOverlay.classList.remove("open")});
  el.sidebarOverlay.addEventListener("click",()=>{el.sidebar.classList.remove("open");el.sidebarOverlay.classList.remove("open")});

  setTab(location.hash.replace("#","") || "orders");
  if (el.token.value) loadManagement();
})();
