// weclapp_api.js — zentrale Kapselung für API-Calls und Business-Logik

const API_CONFIG = {
  proxy: (window.WECLAPP_CONFIG?.proxy || '').replace(/\/$/, ''),
  uiBase: (window.WECLAPP_CONFIG?.uiBase || 'https://nexgen.weclapp.com').replace(/\/$/, '')
};

// ---------------- Orders ----------------

async function fetchOrders(msStart, msEnd, pageSize = 200) {
  const url = `${API_CONFIG.proxy}/salesOrder?plannedDeliveryDate-ge=${msStart}&plannedDeliveryDate-le=${msEnd}&pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`fetchOrders: ${res.status}`);
  const data = await res.json();
  return data.result || [];
}

async function fetchCustomerAddresses(customerNumbers) {
  if (!customerNumbers || customerNumbers.length === 0) return {};
  const proxyBase = API_CONFIG.proxy.replace(/\/api\/weclapp\/?$/, '');
  const url = `${proxyBase}/api/customers/addresses`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ ids: customerNumbers })
  });
  if (!res.ok) throw new Error(`fetchCustomerAddresses: ${res.status}`);
  const data = await res.json();
  return data.addresses || {};
}

// ---------------- Business-Logik ----------------

/**
 * Monitor-Status bestimmen
 * @returns {"RED"|"GREEN"|"BLACK"|null}
 */
function getMonitorStatus(order) {
  if (!order.orderItems || !Array.isArray(order.orderItems)) return null;

  const monitorItems = order.orderItems.filter(it =>
    window.MONITOR_SKUS.includes(it.articleNumber)
  );
  if (monitorItems.length === 0) return null;

  const allShipped = monitorItems.every(it => it.shipped === true);
  const anyUnshipped = monitorItems.some(it => it.shipped === false);

  const plannedDate = new Date(Number(order.plannedDeliveryDate));
  const now = new Date();
  const soon = new Date();
  soon.setDate(now.getDate() + 2);

  if (anyUnshipped && plannedDate <= soon) return "RED";
  if (allShipped) return "GREEN";
  return "BLACK";
}

/**
 * Dealsize prüfen
 * @returns {boolean} true wenn >= 2500 EUR
 */
function isBigDeal(order) {
  const amount = parseFloat(order.netAmount || "0");
  return !isNaN(amount) && amount >= 2500;
}

/**
 * Serviceauftrag prüfen
 * @returns {boolean}
 */
function isServiceOrder(order) {
  if (!order.customAttributes) return false;
  return order.customAttributes.some(attr =>
    String(attr.attributeDefinitionId) === "40227" &&
    String(attr.selectedValueId) === "40228"
  );
}

/**
 * Deeplink erzeugen
 */
function buildOrderDeeplink(orderId) {
  return `${API_CONFIG.uiBase}/app/sales-order/${encodeURIComponent(orderId)}`;
}

// ---------------- Export ----------------

window.WECLAPP_API = {
  fetchOrders,
  fetchCustomerAddresses,
  getMonitorStatus,
  isBigDeal,
  isServiceOrder,
  buildOrderDeeplink
};
