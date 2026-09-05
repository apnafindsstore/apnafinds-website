(() => {
  "use strict";
  const PRODUCTS_KEY = "adminProducts";
  const REQUIRED = ["name", "price", "category"];

  const readProducts = () => {
    try { return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || "[]"); }
    catch { return []; }
  };
  const saveProducts = products => localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  const slugify = value => String(value || "product").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const normalize = (row, index) => {
    const name = String(row.name || row.product_name || row.title || "").trim();
    return {
      id: String(row.id || row.sku || `IMP-${Date.now()}-${index+1}`),
      sku: String(row.sku || row.id || "").trim(),
      name,
      slug: String(row.slug || slugify(name)),
      price: Number(row.price || row.selling_price || row.sale_price || 0),
      mrp: Number(row.mrp || row.list_price || row.price || 0),
      cost: Number(row.cost || row.supplier_cost || 0),
      shippingCost: Number(row.shippingCost || row.shipping_cost || 0),
      stock: Math.max(0, Number(row.stock || row.quantity || 0)),
      category: String(row.category || "General").trim(),
      supplier: String(row.supplier || row.vendor || "").trim(),
      supplierSku: String(row.supplierSku || row.supplier_sku || "").trim(),
      source: String(row.source || "Imported").trim(),
      image: String(row.image || row.image_url || "").trim(),
      description: String(row.description || "").trim(),
      status: String(row.status || "Active").trim(),
      active: String(row.status || "Active").toLowerCase() !== "inactive",
      marketplace: {
        amazon: String(row.amazon_status || "Not connected"),
        meesho: String(row.meesho_status || "Not connected"),
        flipkart: String(row.flipkart_status || "Not connected")
      }
    };
  };

  function parseCSV(text) {
    const rows = [];
    let row = [], cell = "", quote = false;
    for (let i=0;i<text.length;i++) {
      const c=text[i], n=text[i+1];
      if (c==='"' && quote && n==='"') { cell+='"'; i++; }
      else if (c==='"') quote=!quote;
      else if (c===',' && !quote) { row.push(cell); cell=""; }
      else if ((c==='\n' || c==='\r') && !quote) {
        if (c==='\r' && n==='\n') i++;
        row.push(cell); cell="";
        if (row.some(v=>String(v).trim())) rows.push(row);
        row=[];
      } else cell+=c;
    }
    row.push(cell); if (row.some(v=>String(v).trim())) rows.push(row);
    if (!rows.length) return [];
    const headers=rows.shift().map(h=>String(h).trim().toLowerCase().replace(/\s+/g,"_"));
    return rows.map(cols=>Object.fromEntries(headers.map((h,i)=>[h, cols[i] ?? ""])));
  }

  function toCSV(products) {
    const headers=["id","sku","name","price","mrp","cost","shipping_cost","stock","category","supplier","supplier_sku","source","image_url","description","status"];
    const esc=v=>`"${String(v??"").replace(/"/g,'""')}"`;
    return [headers.join(','), ...products.map(p=>[
      p.id,p.sku,p.name,p.price,p.mrp,p.cost,p.shippingCost,p.stock,p.category,p.supplier,p.supplierSku,p.source,p.image,p.description,p.status
    ].map(esc).join(','))].join('\n');
  }

  const download=(name,type,data)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  const validate = rows => rows.map((r,i)=>({row:i+2, missing:REQUIRED.filter(k=>!String(r[k]??"").trim()), raw:r}));

  window.ApnaFindsCatalog = {
    readProducts, saveProducts, normalize, parseCSV, toCSV, validate,
    exportCSV(){download(`apnafinds-products-${new Date().toISOString().slice(0,10)}.csv`,"text/csv",toCSV(readProducts()));},
    exportJSON(){download(`apnafinds-products-${new Date().toISOString().slice(0,10)}.json`,"application/json",JSON.stringify(readProducts(),null,2));},
    importRows(rows,{replace=false}={}) {
      const normalized=rows.map(normalize).filter(p=>p.name && p.price>=0);
      const existing=replace?[]:readProducts();
      const map=new Map(existing.map(p=>[String(p.sku||p.id||p.slug),p]));
      normalized.forEach(p=>map.set(String(p.sku||p.id||p.slug),{...(map.get(String(p.sku||p.id||p.slug))||{}),...p}));
      const result=[...map.values()]; saveProducts(result); return {imported:normalized.length,total:result.length};
    }
  };
})();
