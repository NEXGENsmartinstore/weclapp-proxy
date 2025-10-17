// api/weclapp/salesOrder/weclapp-hook.js

const { buildSalesOrderPayload } = require('./order-builder');

const TARGET_STATUS_ID = process.env.WECLAPP_TARGET_TICKET_STATUS_ID || '5609151';
const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;
const DRY_RUN = process.env.DRY_RUN === 'true';

async function weclappFetch(path, options = {}) {
  const url = `${WECLAPP_HOST.replace(/\/$/, '')}/webapp/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'AuthenticationToken': WECLAPP_TOKEN,
      ...(options.headers || {})
    }
  });

  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(`Weclapp API Error ${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

function ensureJsonBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!WECLAPP_HOST || !WECLAPP_TOKEN) return res.status(500).json({ error: 'Missing WECLAPP_HOST or WECLAPP_TOKEN' });

  try {
    const payload = ensureJsonBody(req);
    const ticketId = payload?.entityId || payload?.entity?.id || payload?.id;
    console.log('📬 Incoming payload:', payload);

    if (!ticketId) {
      console.log('❌ Kein Ticket in Payload – nichts zu tun.');
      return res.status(200).json({ ok: true, skipped: 'no-ticket' });
    }

    // 🔹 Ticket abrufen
    const ticket = await weclappFetch(`/ticket/id/${ticketId}`, { method: 'GET' });
    const { ticketStatusId, partyId, salesOrderId, ticketNumber, subject } = ticket || {};

    console.log('📦 Ticketdaten:', { ticketId, ticketStatusId, partyId, salesOrderId, ticketNumber, subject });

    // 🛑 Sicherheitsbremse 1: bereits verknüpft
    if (salesOrderId) {
      console.log(`⏹️ Ticket ${ticketId} ist bereits mit Auftrag ${salesOrderId} verknüpft – keine Neuerstellung.`);
      return res.status(200).json({ ok: true, skipped: 'already-linked', salesOrderId });
    }

    // 🛑 Sicherheitsbremse 2: vorhandener Auftrag mit gleicher Kommission
    const commissionSearch = encodeURIComponent(`TICKET ${ticketNumber}:`);
    const existingOrders = await weclappFetch(`/salesOrder?commission-like=${commissionSearch}`, { method: 'GET' });
    if (existingOrders?.result?.length > 0) {
      console.log(`⏹️ Es existiert bereits ein Auftrag mit Kommission "TICKET ${ticketNumber}:" – keine Neuerstellung.`);
      return res.status(200).json({ ok: true, skipped: 'commission-match', orders: existingOrders.result.map(o => o.id) });
    }

    // 🎯 Status prüfen
    if (String(ticketStatusId) !== String(TARGET_STATUS_ID)) {
      console.log(`⏭️ Status passt nicht. Erwartet ${TARGET_STATUS_ID}, ist ${ticketStatusId}.`);
      return res.status(200).json({ ok: true, skipped: 'status-mismatch' });
    }

    if (!partyId) {
      console.log('❌ Kein Kunde im Ticket.');
      return res.status(200).json({ ok: true, skipped: 'no-customerId' });
    }

    // 📦 Auftrag aufbauen
    const salesOrderPayload = buildSalesOrderPayload(ticket, partyId);
    console.log('🧾 SalesOrder Payload:', salesOrderPayload);

    // 🚫 Trockenlauf
    if (DRY_RUN) {
      console.log('🧪 [DRY-RUN] Auftrag NICHT erstellt.');
      return res.status(200).json({ ok: true, dryRun: true, payload: salesOrderPayload });
    }

    // 🧾 Auftrag anlegen
    const createdOrder = await weclappFetch('/salesOrder', {
      method: 'POST',
      body: JSON.stringify(salesOrderPayload)
    });
    console.log('✅ Auftrag erstellt:', createdOrder);

    // 🔗 Ticket mit Auftrag verknüpfen
    try {
      const linkPayload = {
        salesOrderId: createdOrder.id,
        taskIdToOrderItemId: {}
      };
      console.log(`🔗 Verknüpfe Ticket ${ticketId} mit Auftrag ${createdOrder.id}...`);
      const linkResponse = await weclappFetch(`/ticket/id/${ticketId}/linkSalesOrder`, {
        method: 'POST',
        body: JSON.stringify(linkPayload)
      });
      console.log('✅ Ticket erfolgreich mit Auftrag verknüpft:', linkResponse);
    } catch (linkErr) {
      console.log('⚠️ Fehler beim Verknüpfen:', linkErr.message);
    }

    return res.status(200).json({ ok: true, createdOrder });
  } catch (err) {
    console.error('💥 Fehler im Hook:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

module.exports = handler;
