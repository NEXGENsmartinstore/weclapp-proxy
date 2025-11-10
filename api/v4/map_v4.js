// map_v4.js — Version 4 mit AdvancedMarkerElement, Kategorien, Legende, Deeplinks, Monitor-Badge

let _map;
let _allMarkers = [];
let _categoryMarkers = {};
let _activeCategories = new Set();
let _markersById = {};
let _infoWindow = null;

// ---------- Kategorie Mapping ----------
const SALES_CHANNEL_NAMES = {
  "NET0": "SERVICE-HUB",
  "NET1": "Fallback",
  "NET2": "EMH",
  "NET3": "ESB",
  "NET4": "EHN",
  "NET6": "GDC",
  "NET7": "TGT",
  "NET8": "HGB",
  "NET12": "eCommerce",
  "NET13": "EFS",
  "NET16": "TW.tv",
  "NET19": "HDH"
};

const CATEGORY_COLORS = {
  "NET0": "black",
  "NET1": "gray",
  "NET2": "green",
  "NET3": "blue",
  "NET4": "magenta",
  "NET6": "purple",
  "NET7": "orange",
  "NET8": "brown",
  "NET12": "teal",
  "NET13": "magenta",
  "NET16": "navy",
  "NET19": "darkred",
  "OTHER": "lightgray"
};

// ---------- Init ----------
function initMap() {
  _map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 51.1657, lng: 10.4515 },
    zoom: 6,
    mapId: "my-map-v4" // deine Map-ID
  });

  buildLegend();
  loadOrders();
}
window.initMap = initMap;

// ---------- Orders laden ----------
async function loadOrders() {
  const proxy = (window.WECLAPP_CONFIG?.proxy || '').replace(/\/$/, '');
  if (!proxy) return console.error("Proxy missing in WECLAPP_CONFIG");

  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + 14);
  const past = new Date();
  past.setDate(now.getDate() - 90);

  const msPast = past.getTime();
  const msFuture = future.getTime();

  const url = `${proxy}/salesOrder?plannedDeliveryDate-ge=${msPast}&plannedDeliveryDate-le=${msFuture}&pageSize=200`;

  console.log("[map_v4] Lade Orders von:", url);

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) return console.error("Fehler Orders:", res.status);
  const data = await res.json();
  let orders = data.result || [];

  console.log("[map_v4] Alle Orders:", orders.length);

  // Statusfilter
  orders = orders.filter(o =>
    o.status === 'ORDER_CONFIRMATION_PRINTED' ||
    o.status === 'ORDER_ENTRY_IN_PROGRESS'
  );

  console.log("[map_v4] Gefilterte Orders:", orders.length);

  const uniqueIds = Array.from(new Set(orders.map(o => String(o.customerNumber || '').trim()).filter(Boolean)));
  const addressMap = await fetchAddressesForCustomers(uniqueIds);

  const enriched = orders.map(o => {
    const addr = addressMap[String(o.customerNumber || '').trim()] || null;
    const hasMonitor = checkHasMonitor(o);
    return {
      ...o,
      sheetData: addr,
      hasMonitor
    };
  });

  await renderMarkers(enriched);
  renderTable(enriched);
}

// ---------- Adressen vom Server ----------
async function fetchAddressesForCustomers(customerNumbers) {
  const proxyBase = (window.WECLAPP_CONFIG?.proxy || '').replace(/\/api\/weclapp\/?$/, '');
  const url = `${proxyBase}/api/customers/addresses`;

  if (!customerNumbers || customerNumbers.length === 0) return {};

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ ids: customerNumbers })
  });
  if (!res.ok) return {};
  const data = await res.json();
  return data.addresses || {};
}

// ---------- Monitor-Erkennung ----------
function checkHasMonitor(order) {
  if (!order.orderItems || !Array.isArray(order.orderItems)) return false;
  return order.orderItems.some(it => window.MONITOR_SKUS.includes(it.articleNumber));
}

// ---------- Marker rendern ----------
async function renderMarkers(orders) {
  _allMarkers.forEach(m => m.map = null);
  _allMarkers = [];
  _categoryMarkers = {};
  _markersById = {};

  const bounds = new google.maps.LatLngBounds();

  for (const order of orders) {
    const addr = order.sheetData;
    if (!addr || (!addr.street && !addr.city)) continue;

const rec = {
  id: order.id,
  bezeichnung: order.name || addr.company || order.customerName || '—',
  street: addr.street || '',
  zip: addr.zip || '',
  city: addr.city || '',
  category: order.salesChannel || 'OTHER',
  plannedDelDate: order.plannedDeliveryDate,
  status: order.status,
  monitorStatus: WECLAPP_API.getMonitorStatus(order),
  isBigDeal: WECLAPP_API.isBigDeal(order),
  isService: WECLAPP_API.isServiceOrder(order),
  orderNumber: order.orderNumber || '',
  items: Array.isArray(order.orderItems) ? order.orderItems : []
};


    const loc = await resolveLatLng(addr);
    if (!loc) continue;

    const marker = createStyledMarker(rec, loc);
    if (!marker) continue;

    _allMarkers.push(marker);
    _markersById[String(rec.id)] = marker;

    if (!_categoryMarkers[rec.category]) _categoryMarkers[rec.category] = [];
    _categoryMarkers[rec.category].push(marker);

    bounds.extend(loc);
  }

  if (_allMarkers.length > 0) _map.fitBounds(bounds);
  applyCategoryFilter();
}

// ---------- Styled Marker + Popup ----------
function createStyledMarker(rec, loc) {
  const deliveryDate = new Date(Number(rec.plannedDelDate));
  const now = new Date();

  let baseColor = CATEGORY_COLORS[rec.category] || CATEGORY_COLORS["OTHER"];
  let classes = "pin";
  let label = "";

  // 1. Priorität: alte Aufträge → "!"
  if (deliveryDate.getTime() < now.getTime() - 30*24*60*60*1000) {
    classes += " old";
    label = "!";
  }
  // 2. Serviceauftrag → "S" (nur wenn kein "!")
  else if (rec.isService) {
    label = "S";
  }

  // Marker-Container
  const div = document.createElement("div");
  div.className = classes;
  div.style.background = baseColor;
  div.textContent = label;

  // Markergröße abhängig von Dealsize
  if (rec.isBigDeal) {
    div.style.width = "28px";
    div.style.height = "28px";
    div.style.fontSize = "16px";
  } else {
    div.style.width = "20px";
    div.style.height = "20px";
    div.style.fontSize = "12px";
  }

  // Monitor-Badge
  if (rec.monitorStatus) {
    const badge = document.createElement("div");
    badge.className = "pin-badge";
    badge.textContent = "M";
    if (rec.monitorStatus === "RED") badge.style.background = "red";
    if (rec.monitorStatus === "GREEN") badge.style.background = "green";
    if (rec.monitorStatus === "BLACK") badge.style.background = "black";
    div.appendChild(badge);
  }

  if (!google.maps.marker || !google.maps.marker.AdvancedMarkerElement) {
    console.error("AdvancedMarkerElement nicht verfügbar. Prüfe libraries=marker in der Script-URL!");
    return null;
  }

  const marker = new google.maps.marker.AdvancedMarkerElement({
    map: _map,
    position: loc,
    content: div
  });

  marker._contentDiv = div;
  marker.orderId = String(rec.id);
  marker.category = rec.category;

  // Marker hover highlight
  div.addEventListener("mouseenter", () => highlightMarker(rec.id, true));
  div.addEventListener("mouseleave", () => highlightMarker(rec.id, false));

  marker.addListener("gmp-click", () => {
    const categoryName = SALES_CHANNEL_NAMES[rec.category] || rec.category || "—";
    const deeplink = WECLAPP_API.buildOrderDeeplink(rec.id);

    const itemsHtml = buildItemsListHtml(rec.items);
    const linkLabel = rec.orderNumber ? escapeHtml(rec.orderNumber) : 'weclapp öffnen';
    const html = `
      <div style="font-size:14px;line-height:1.45; background:#fff; color:#000; padding:6px 8px; border-radius:6px;">
        <div style="font-weight:700;margin-bottom:2px;">${escapeHtml(rec.bezeichnung)}</div>
        <div>${escapeHtml(rec.street)}, ${escapeHtml(rec.zip)} ${escapeHtml(rec.city)}</div>
        <div><b>Kategorie:</b> ${escapeHtml(categoryName)}</div>
        <div><b>Status:</b> ${escapeHtml(rec.status)}</div>
        <div><b>Lieferdatum:</b> ${formatDate(rec.plannedDelDate)}</div>
        <div style="margin-top:4px;"><b>Positionen:</b>${itemsHtml}</div>
        <div style="margin-top:4px;"><b>Link:</b> <a href="${deeplink}" target="_blank" rel="noopener">${linkLabel}</a></div>
      </div>
    `;
    if (!_infoWindow) {
      _infoWindow = new google.maps.InfoWindow();
    }
    _infoWindow.close();
    _infoWindow.setContent(html);
    _infoWindow.open({ map: _map, anchor: marker });
  });

  return marker;
}


// ---------- Geocoding ----------
async function resolveLatLng(addr) {
  const address = [addr.street, addr.zip, addr.city].filter(Boolean).join(', ');
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) resolve(results[0].geometry.location);
      else resolve(null);
    });
  });
}

// ---------- Tabelle ----------
function renderTable(orders) {
  const body = document.getElementById('table-body');
  if (!body) return;
  body.innerHTML = '';

  if (!orders || orders.length === 0) {
    body.innerHTML = `<div class="row"><i>Keine Aufträge gefunden</i></div>`;
    return;
  }

  orders.forEach(order => {
    const addr = order.sheetData || {};
    const category = order.salesChannel || 'OTHER';
    const categoryName = SALES_CHANNEL_NAMES[category] || category;

    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.category = category;
    row.dataset.orderId = String(order.id);

    const uiBase = (window.WECLAPP_CONFIG && window.WECLAPP_CONFIG.uiBase)
      ? window.WECLAPP_CONFIG.uiBase
      : 'https://nexgen.weclapp.com';
    const deeplink = `${uiBase.replace(/\/$/, '')}/app/sales-order/${encodeURIComponent(order.id)}`;

    row.innerHTML = `
      <div class="title">${escapeHtml(order.name || addr.company || '—')}
        ${order.monitorStatus ? '<span style="margin-left:6px; font-size:11px; background:${order.monitorStatus.toLowerCase()}; color:#fff; padding:1px 3px; border-radius:3px;">M</span>' : ''}
      </div>
      <div class="addr">${escapeHtml(addr.street || '')}, ${escapeHtml(addr.zip || '')} ${escapeHtml(addr.city || '')}</div>
      <div class="status"><b>Status:</b> ${escapeHtml(order.status || '')}</div>
      <div class="date"><b>Lieferdatum:</b> ${formatDate(order.plannedDeliveryDate)}</div>
      <div class="cat"><b>Kategorie:</b> ${escapeHtml(categoryName)}</div>
      <div class="link"><a href="${deeplink}" target="_blank" rel="noopener">weclapp öffnen</a></div>
    `;

    row.addEventListener("mouseenter", () => highlightMarker(String(order.id), true));
    row.addEventListener("mouseleave", () => highlightMarker(String(order.id), false));

    body.appendChild(row);
  });

  applyCategoryFilter();
}

// ---------- Marker-Hervorheben ----------
function highlightMarker(orderId, on) {
  const m = _markersById[orderId];
  if (!m || !m._contentDiv) return;
  if (on) {
    m._contentDiv.style.transform = 'scale(1.25)';
    m._contentDiv.style.boxShadow = '0 0 10px rgba(0,0,0,0.6)';
    m.zIndex = 9999;
  } else {
    m._contentDiv.style.transform = 'scale(1.0)';
    m._contentDiv.style.boxShadow = '0 0 4px rgba(0,0,0,0.4)';
    m.zIndex = undefined;
  }
}

// ---------- Legende ----------
function buildLegend() {
  const legend = document.getElementById('legend');
  if (!legend) return;
  legend.innerHTML = '';

  Object.entries(SALES_CHANNEL_NAMES).forEach(([code, name]) => {
    const color = CATEGORY_COLORS[code] || CATEGORY_COLORS["OTHER"];
    const wrapper = document.createElement('div');
    wrapper.className = 'legend-item';
    wrapper.innerHTML = `
      <label>
        <input type="checkbox" data-cat="${code}" checked>
        <span class="legend-dot" style="background:${color}"></span>
        ${escapeHtml(name)}
      </label>
    `;
    legend.appendChild(wrapper);
  });

  legend.querySelectorAll("input[type=checkbox]").forEach(cb => {
    _activeCategories.add(cb.dataset.cat);
    cb.addEventListener("change", () => {
      if (cb.checked) _activeCategories.add(cb.dataset.cat);
      else _activeCategories.delete(cb.dataset.cat);
      applyCategoryFilter();
    });
  });
}

// ---------- Filter anwenden ----------
function applyCategoryFilter() {
  _allMarkers.forEach(m => {
    if (_activeCategories.has(m.category)) m.map = _map;
    else m.map = null;
  });

  document.querySelectorAll('#table-body .row').forEach(r => {
    const cat = r.dataset.category;
    r.style.display = _activeCategories.has(cat) ? '' : 'none';
  });
}


document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleBtn");
  const expandBtn = document.getElementById("expandBtn");
  const sidebarTab = document.getElementById("sidebar-tab");

  // Default: collapsed
  sidebar.classList.add("collapsed");

  // Toggle-Button (ein-/ausklappen)
  toggleBtn?.addEventListener("click", () => {
    if (sidebar.classList.contains("collapsed")) {
      sidebar.classList.remove("collapsed");
      sidebar.classList.add("compact");
    } else {
      sidebar.classList.add("collapsed");
      sidebar.classList.remove("compact", "expanded");
    }
  });

  // Expand-Button (25% <-> 60%)
  expandBtn?.addEventListener("click", () => {
    if (sidebar.classList.contains("expanded")) {
      sidebar.classList.remove("expanded");
      sidebar.classList.add("compact");
    } else {
      sidebar.classList.add("expanded");
      sidebar.classList.remove("compact");
    }
  });

  // Tab für collapsed → öffnet Sidebar
  sidebarTab?.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
    sidebar.classList.add("compact");
  });
});



// ---------- Helpers ----------
function buildItemsListHtml(items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return ' <i>Keine Positionen</i>';
  }

  const entries = list.map(item => `<li>${renderOrderItemLine(item)}</li>`).join('');
  return `<ul style="margin:4px 0 0 0; padding-left:18px;">${entries}</ul>`;
}

function renderOrderItemLine(item) {
  if (!item || typeof item !== 'object') return '';
  const parts = [];

  if (item.positionNumber !== undefined && item.positionNumber !== null && item.positionNumber !== '') {
    parts.push(`#${escapeHtml(item.positionNumber)}`);
  }
  if (item.articleNumber) {
    parts.push(escapeHtml(item.articleNumber));
  }
  const nameOrDesc = item.name || item.description;
  if (nameOrDesc) {
    parts.push(escapeHtml(nameOrDesc));
  }

  const quantity = item.quantity ?? item.plannedQuantity ?? item.confirmedQuantity;
  const unit = item.quantityUnitName || item.quantityUnit || item.unitName || '';
  let quantityText = '';
  if (quantity !== undefined && quantity !== null && quantity !== '') {
    const qtyString = escapeHtml(quantity);
    const unitString = unit ? ` ${escapeHtml(unit)}` : '';
    quantityText = ` (${qtyString}${unitString})`;
  }

  const content = parts.length > 0 ? parts.join(' – ') : '—';
  return `${content}${quantityText}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function formatDate(ms) {
  if (!ms) return '';
  const d = new Date(Number(ms));
  return d.toLocaleDateString('de-DE');
}
