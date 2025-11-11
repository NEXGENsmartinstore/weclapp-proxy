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

const POPUP_STYLE_STRING = /* css */ `
  .weclapp-popup {
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.45;
    color: #0e1324;
    max-width: min(92vw, 960px);
  }
  .weclapp-popup__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }
  .weclapp-popup__header-title {
    font-weight: 700;
    font-size: 16px;
    color: #101631;
  }
  .weclapp-popup__address {
    color: #3b4256;
  }
  .weclapp-popup__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: #505870;
  }
  .weclapp-popup__meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .weclapp-popup__grid {
    display: flex;
    gap: 16px;
    align-items: stretch;
    justify-content: space-between;
    position: relative;
    flex-wrap: wrap;
  }
  .weclapp-popup__column {
    flex: 1 1 0;
    min-width: 220px;
    background: rgba(14, 19, 36, 0.04);
    border-radius: 10px;
    padding: 12px 16px 14px;
    position: relative;
    box-shadow: inset 0 0 0 1px rgba(14, 19, 36, 0.05);
    backdrop-filter: blur(2px);
  }
  .weclapp-popup__column--center {
    flex: 1.35 1 0;
    z-index: 1;
  }
  .weclapp-popup__column-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 600;
    color: #5b6381;
    margin-bottom: 8px;
  }
  .weclapp-popup__empty {
    font-style: italic;
    color: #7b8299;
    font-size: 12px;
  }
  .weclapp-popup table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .weclapp-popup th {
    padding: 0 4px 6px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #5b6381;
  }
  .weclapp-popup td {
    padding: 4px 4px;
    vertical-align: middle;
  }
  .weclapp-popup__positions-table th.status,
  .weclapp-popup__positions-table td.status {
    width: 26px;
    text-align: center;
  }
  .weclapp-popup__positions-table td.article {
    font-weight: 600;
    color: #1f2537;
  }
  .weclapp-popup__positions-table td.title {
    color: #252b3d;
  }
  .weclapp-popup__positions-table td.qty {
    text-align: right;
    white-space: nowrap;
    color: #3b4256;
  }
  .weclapp-popup__positions-table th.qty {
    text-align: right;
  }
  .weclapp-popup__status-icon {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
  }
  .weclapp-popup__status-icon--true {
    background: #0f9d58;
  }
  .weclapp-popup__status-icon--true::before {
    content: "✓";
  }
  .weclapp-popup__status-icon--false {
    background: #d93025;
  }
  .weclapp-popup__status-icon--false::before {
    content: "✕";
  }
  .weclapp-popup__status-icon--null {
    background: #9aa0b1;
  }
  .weclapp-popup__status-icon--null::before {
    content: "–";
  }
  .weclapp-popup__supply-entry {
    border-radius: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 1px 3px rgba(14, 19, 36, 0.12);
    margin-bottom: 10px;
  }
  .weclapp-popup__supply-entry:last-child {
    margin-bottom: 0;
  }
  .weclapp-popup__supply-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .weclapp-popup__supply-number {
    font-weight: 700;
    font-size: 13px;
    color: #1b4dd5;
    text-decoration: none;
  }
  .weclapp-popup__supply-number:hover,
  .weclapp-popup__supply-number:focus {
    color: #0f34a6;
    text-decoration: underline;
  }
  .weclapp-popup__supply-status {
    font-size: 11px;
    color: #5b6381;
    font-weight: 600;
  }
  .weclapp-popup__supply-counterpart {
    font-size: 11px;
    color: #68708c;
    margin-bottom: 4px;
  }
  .weclapp-popup__supply-items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .weclapp-popup__supply-item {
    display: grid;
    grid-template-columns: 24px minmax(60px, auto) 1fr auto;
    gap: 6px;
    align-items: center;
  }
  .weclapp-popup__supply-item .article {
    font-weight: 600;
    color: #1f2537;
  }
  .weclapp-popup__supply-item .title {
    color: #252b3d;
  }
  .weclapp-popup__supply-item .qty {
    justify-self: end;
    white-space: nowrap;
    color: #3b4256;
  }
  .weclapp-popup__link {
    margin-top: 12px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    color: #1b4dd5;
    text-decoration: none;
  }
  .weclapp-popup__link:hover,
  .weclapp-popup__link:focus {
    color: #0f34a6;
    text-decoration: underline;
  }
  .weclapp-popup__column--center::before,
  .weclapp-popup__column--center::after {
    content: "";
    position: absolute;
    top: 24px;
    bottom: 24px;
    width: 18px;
    background-image: linear-gradient(90deg, rgba(14, 19, 36, 0.18), rgba(14, 19, 36, 0));
    z-index: -1;
  }
  .weclapp-popup__column--center::before {
    left: -18px;
  }
  .weclapp-popup__column--center::after {
    right: -18px;
    transform: scaleX(-1);
  }
  @media (max-width: 1080px) {
    .weclapp-popup__grid {
      flex-direction: column;
    }
    .weclapp-popup__column {
      min-width: unset;
    }
    .weclapp-popup__column--center::before,
    .weclapp-popup__column--center::after {
      display: none;
    }
  }
`;

let _popupStylesInjected = false;

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
  items: Array.isArray(order.orderItems) ? order.orderItems : [],
  supplyChain: normalizeSupplyChainData(order)
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
    ensurePopupStyles();
    const html = buildOrderPopupHtml(rec);
    if (!_infoWindow) {
      _infoWindow = new google.maps.InfoWindow({ maxWidth: 960 });
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
function ensurePopupStyles() {
  if (_popupStylesInjected || typeof document === 'undefined') return;
  if (document.getElementById('weclapp-popup-styles')) {
    _popupStylesInjected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = 'weclapp-popup-styles';
  style.textContent = POPUP_STYLE_STRING;
  document.head.appendChild(style);
  _popupStylesInjected = true;
}

function buildOrderPopupHtml(rec) {
  const categoryName = SALES_CHANNEL_NAMES[rec.category] || rec.category || '—';
  const linkLabel = rec.orderNumber ? escapeHtml(rec.orderNumber) : 'weclapp öffnen';
  const deeplink = WECLAPP_API.buildOrderDeeplink(rec.id);
  const positionsHtml = buildOrderPositionsHtml(rec.items);
  const inboundHtml = buildSupplyColumnHtml(rec?.supplyChain?.inbound, 'inbound');
  const outboundHtml = buildSupplyColumnHtml(rec?.supplyChain?.outbound, 'outbound');
  const addressParts = [];
  if (rec.street) addressParts.push(rec.street);
  const zipCity = [rec.zip, rec.city].filter(Boolean).join(' ');
  if (zipCity) addressParts.push(zipCity);
  const address = addressParts.length > 0 ? escapeHtml(addressParts.join(', ')) : '—';

  return `
    <div class="weclapp-popup">
      <div class="weclapp-popup__header">
        <div class="weclapp-popup__header-title">${escapeHtml(rec.bezeichnung)}</div>
        <div class="weclapp-popup__address">${address}</div>
        <div class="weclapp-popup__meta">
          <span><strong>Status:</strong> ${escapeHtml(rec.status || '')}</span>
          <span><strong>Kategorie:</strong> ${escapeHtml(categoryName)}</span>
          <span><strong>Lieferdatum:</strong> ${formatDate(rec.plannedDelDate)}</span>
        </div>
      </div>
      <div class="weclapp-popup__grid">
        <div class="weclapp-popup__column weclapp-popup__column--left">
          <div class="weclapp-popup__column-title">Bestellungen</div>
          ${inboundHtml}
        </div>
        <div class="weclapp-popup__column weclapp-popup__column--center">
          <div class="weclapp-popup__column-title">Auftragspositionen</div>
          ${positionsHtml}
        </div>
        <div class="weclapp-popup__column weclapp-popup__column--right">
          <div class="weclapp-popup__column-title">Lieferungen</div>
          ${outboundHtml}
        </div>
      </div>
      <a class="weclapp-popup__link" href="${deeplink}" target="_blank" rel="noopener">${linkLabel}</a>
    </div>
  `;
}

function buildOrderPositionsHtml(items) {
  const normalized = toArray(items).map(normalizeSupplyItem).filter(Boolean);
  if (normalized.length === 0) {
    return `<div class='weclapp-popup__empty'>Keine Positionen</div>`;
  }

  const rows = normalized.map(item => {
    const qtyText = formatQuantityDisplay(item.quantity, item.unit);
    const qtyDisplay = qtyText ? escapeHtml(qtyText) : '—';
    return `
      <tr>
        <td class="status">${renderStatusIcon(item.shipped)}</td>
        <td class="article">${escapeHtml(item.articleNumber || '—')}</td>
        <td class="title">${escapeHtml(item.title || '—')}</td>
        <td class="qty">${qtyDisplay}</td>
      </tr>
    `;
  }).join('');

  return `
    <table class="weclapp-popup__positions-table">
      <thead>
        <tr>
          <th class="status"></th>
          <th class="article">Artikel</th>
          <th class="title">Kurzbezeichnung</th>
          <th class="qty">Menge</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildSupplyColumnHtml(entries, type) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  if (list.length === 0) {
    const fallback = type === 'inbound' ? 'Keine abhängigen Bestellungen' : 'Keine Lieferungen';
    return `<div class='weclapp-popup__empty'>${fallback}</div>`;
  }
  return list.map(entry => buildSupplyEntryHtml(entry)).join('');
}

function buildSupplyEntryHtml(entry) {
  if (!entry) return '';
  const subtitleParts = [];
  if (entry.title) subtitleParts.push(entry.title);
  if (entry.counterpart) subtitleParts.push(entry.counterpart);
  const subtitle = subtitleParts.join(' · ');
  const itemsHtml = entry.items && entry.items.length > 0
    ? entry.items.map(it => buildSupplyItemHtml(it)).join('')
    : `<li class='weclapp-popup__empty'>Keine Positionen</li>`;

  return `
    <div class="weclapp-popup__supply-entry">
      <div class="weclapp-popup__supply-head">
        <a class="weclapp-popup__supply-number" href="${entry.deeplink || '#'}" target="_blank" rel="noopener">${escapeHtml(entry.number || '—')}</a>
        ${entry.status ? `<div class="weclapp-popup__supply-status">${escapeHtml(entry.status)}</div>` : ''}
      </div>
      ${subtitle ? `<div class="weclapp-popup__supply-counterpart">${escapeHtml(subtitle)}</div>` : ''}
      <ul class="weclapp-popup__supply-items">${itemsHtml}</ul>
    </div>
  `;
}

function buildSupplyItemHtml(item) {
  if (!item) return '';
  const qtyText = formatQuantityDisplay(item.quantity, item.unit);
  const qtyDisplay = qtyText ? escapeHtml(qtyText) : '—';
  return `
    <li class="weclapp-popup__supply-item">
      ${renderStatusIcon(item.shipped)}
      <span class="article">${escapeHtml(item.articleNumber || '—')}</span>
      <span class="title">${escapeHtml(item.title || '—')}</span>
      <span class="qty">${qtyDisplay}</span>
    </li>
  `;
}

function renderStatusIcon(value) {
  let modifier = 'null';
  let label = 'Status unbekannt';
  if (value === true) modifier = 'true';
  else if (value === false) modifier = 'false';

  if (value === true) label = 'Erledigt';
  else if (value === false) label = 'Offen';

  return `<span class="weclapp-popup__status-icon weclapp-popup__status-icon--${modifier}" title="${label}" aria-label="${label}"></span>`;
}

function formatQuantityDisplay(quantity, unit) {
  if (quantity === undefined || quantity === null || quantity === '') return '';
  const num = Number(quantity);
  let qtyText;
  if (Number.isFinite(num)) {
    const hasFraction = Math.abs(num % 1) > 0;
    qtyText = num.toLocaleString('de-DE', {
      maximumFractionDigits: hasFraction ? 2 : 0,
      minimumFractionDigits: hasFraction ? 0 : 0
    });
  } else {
    qtyText = String(quantity);
  }
  const unitText = unit ? ` ${unit}` : '';
  return `${qtyText}${unitText}`.trim();
}

function normalizeSupplyChainData(order) {
  if (!order || typeof order !== 'object') {
    return { inbound: [], outbound: [] };
  }

  const inboundCandidates = [
    order.inboundOrders,
    order.purchaseOrders,
    order.relatedPurchaseOrders,
    order.precedingOrders,
    order.relatedProcurements,
    order.dependencies?.inbound,
    order.supplyChain?.inbound
  ];
  const outboundCandidates = [
    order.outboundDeliveries,
    order.deliveryNotes,
    order.shipments,
    order.followUpDeliveries,
    order.relatedDeliveries,
    order.dependencies?.outbound,
    order.supplyChain?.outbound
  ];

  return {
    inbound: pickFirstArray(inboundCandidates).map(entry => normalizeSupplyEntry(entry, 'inbound')).filter(Boolean),
    outbound: pickFirstArray(outboundCandidates).map(entry => normalizeSupplyEntry(entry, 'outbound')).filter(Boolean)
  };
}

function normalizeSupplyEntry(entry, type) {
  if (!entry || typeof entry !== 'object') return null;
  const number = entry.orderNumber || entry.purchaseOrderNumber || entry.number || entry.documentNumber || entry.code || '';
  const id = entry.id || entry.orderId || entry.purchaseOrderId || entry.deliveryId || entry.deliveryNoteId || entry.documentId || entry.uuid || number;
  const title = entry.title || entry.name || entry.subject || entry.description || '';
  const counterpart = entry.vendorName || entry.supplierName || entry.supplier?.name || entry.customerName || entry.customer?.name || entry.partnerName || '';
  const status = entry.status || entry.state || '';
  const items = toArray(entry.positions || entry.items || entry.orderItems || entry.positionList || entry.components)
    .map(it => normalizeSupplyItem(it))
    .filter(Boolean);
  const resource = entry.resource || entry.resourceName || (type === 'inbound' ? 'purchase-order' : 'delivery-note');
  const deeplink = entry.deeplink || (WECLAPP_API?.buildResourceDeeplink ? WECLAPP_API.buildResourceDeeplink(resource, id) : '#');

  return {
    id,
    number,
    title,
    counterpart,
    status,
    items,
    deeplink
  };
}

function normalizeSupplyItem(item) {
  if (!item || typeof item !== 'object') return null;
  const quantity = item.quantity ?? item.plannedQuantity ?? item.confirmedQuantity ?? item.orderedQuantity ?? item.deliveredQuantity;
  const unit = item.quantityUnitName || item.quantityUnit || item.unitName || item.unit;
  let shipped = null;
  if (typeof item.shipped === 'boolean') shipped = item.shipped;
  else if (typeof item.delivered === 'boolean') shipped = item.delivered;
  else if (typeof item.received === 'boolean') shipped = item.received;
  else if (typeof item.completed === 'boolean') shipped = item.completed;
  else if (typeof item.status === 'string') {
    const status = item.status.toUpperCase();
    if ([
      'SHIPPED', 'DELIVERED', 'RECEIVED', 'DONE', 'COMPLETED', 'CLOSED', 'FERTIG'
    ].includes(status)) {
      shipped = true;
    } else if ([
      'OPEN', 'IN_PROGRESS', 'REQUESTED', 'PENDING', 'OFFEN'
    ].includes(status)) {
      shipped = false;
    }
  }

  return {
    articleNumber: item.articleNumber || item.article?.articleNumber || '',
    title: item.title || item.name || item.shortDescription || item.description || '',
    quantity,
    unit,
    shipped
  };
}

function pickFirstArray(candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) return candidate;
  }
  return [];
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
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
