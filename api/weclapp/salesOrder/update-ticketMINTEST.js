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
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (e) { console.error('❌ Body parse error:', e.message); }

  const { ticketId } = body || {};
  console.log('📥 Eingehender Test-Body:', body);

  if (!ticketId) {
    console.log('❌ ticketId fehlt!');
    return res.status(400).json({ error: 'Missing ticketId', body });
  }

  console.log(`🕓 Starte Test-Update für Ticket ${ticketId}`);
  await new Promise(r => setTimeout(r, 1000));

  try {
    const newSubject = `TEST-UPDATE ${Date.now()}`;
    const payload = { id: ticketId, subject: newSubject };
    console.log('📤 Sende Update an Weclapp:', JSON.stringify(payload, null, 2));

    const result = await weclappFetch(`/ticket/update`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log(`✅ Subject geändert auf: ${newSubject}`);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error(`💥 Fehler im Updater für Ticket ${ticketId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
