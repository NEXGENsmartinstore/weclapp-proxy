// api/weclapp/salesOrder/weclapp-hook.js

const TARGET_STATUS_ID = process.env.WECLAPP_TARGET_TICKET_STATUS_ID || '5609151'; // "Einsatz planen"
const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;

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

  if (!res.ok) {
    const msg = `Weclapp API Error ${res.status} ${res.statusText}: ${JSON.stringify(data)}`;
    throw new Error(msg);
  }

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
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  if (!WECLAPP_HOST || !WECLAPP_TOKEN) {
    return res.status(500).json({ error: 'Missing WECLAPP_HOST or WECLAPP_TOKEN' });
  }

  try {
    const payload = ensureJsonBody(req);
    console.log('📬 Incoming payload:', JSON.stringify(payload, null, 2));

    // Ticket-ID aus Payload ermitteln
    let ticketId = null;
    if (payload?.entityId) ticketId = payload.entityId;
    else if (payload?.entity?.id) ticketId = payload.entity.id;
    else if (payload?.id) ticketId = payload.id;

    console.log('➡️ Ticket erkannt?', ticketId);

    if (!ticketId) {
      console.log('❌ Kein Ticket in Payload – nichts zu tun.');
      return res.status(200).json({ ok: true, skipped: 'no-ticket', raw: payload });
    }

    // Ticket aus Weclapp holen
    const freshTicket = await weclappFetch(`/ticket/id/${ticketId}`, { method: 'GET' });
    const { ticketStatusId, number, title, partyId, contactId, salesOrderId } = freshTicket || {};

    console.log('📦 Ticketdaten:', {
      ticketId,
      ticketStatusId,
      partyId,
      contactId,
      salesOrderId
    });

    // 1️⃣ Prüfen, ob bereits ein Auftrag ve
