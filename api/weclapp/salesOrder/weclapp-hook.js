// api/weclapp/salesOrder/weclapp-hook.js

// -------------------------------
// Konfiguration
// -------------------------------
const TARGET_STATUS_ID = process.env.WECLAPP_TARGET_TICKET_STATUS_ID || '5609151'; // "Einsatz planen"
const WECLAPP_HOST = process.env.WECLAPP_HOST;   // z. B. https://nexgen.weclapp.com
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN; // API-Token

// -------------------------------
// Helper für API-Aufrufe
// -------------------------------
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

// -------------------------------
// Main Handler
// -------------------------------
async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  if (!WECLAPP_HOST || !WECLAPP_TOKEN) {
    return res.status(500).json({ error: 'Missing WECLAPP_HOST or WECLAPP_TOKEN' });
  }

  try {
    const payload = ensureJsonBody(req);
    const ticket = payload?.entity?.id ? payload.entity : payload;

    console.log('➡️ Webhook gestartet für Ticket', ticke
