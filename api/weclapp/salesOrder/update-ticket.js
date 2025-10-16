// api/weclapp/salesOrder/update-ticket.js

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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  // 🔍 Body robust parsen (string oder object)
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (err) {
    console.error('❌ Body konnte nicht geparst werden:', err.message);
  }

  const { ticketId, createdOrderId } = body || {};
  console.log('📥 Eingehender Updater-Body:', body);

  if (!ticketId || !createdOrderId) {
    console.log('❌ ticketId oder createdOrderId fehlt!');
    return res.status(400).json({ error: 'Missing ticketId or createdOrderId', body });
  }

  console.log(`🕓 Delay für Ticket-Update gestartet (Ticket ${ticketId}, Auftrag ${createdOrderId})`);

  // kleine Verzögerung
  await new Promise(resolve => setTimeout(resolve, 1500));

  try {
    const payload = {
      id: ticketId,
      salesOrderId: createdOrderId
    };

    console.log('📤 Sende Update an Weclapp (salesOrderId):', JSON.stringify(payload, null, 2));

    const result = await weclappFetch(`/helpdeskTicket/update`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log(`✅ Asynchrones Update erfolgreich für Ticket ${ticketId}`);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error(`💥 Fehler im Updater für Ticket ${ticketId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
