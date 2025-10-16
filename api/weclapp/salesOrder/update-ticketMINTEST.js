// api/weclapp/salesOrder/update-ticketMINTEST.js

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
  if (!res.ok) throw new Error(`Weclapp API Error ${res.status} ${res.statusText}: ${JSON.stringify(data)}`);
  return data;
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { ticketId } = body || {};
  console.log('📥 Eingehender Test-Body:', body);

  if (!ticketId) return res.status(400).json({ error: 'Missing ticketId' });

  try {
    // Schreibe in ein Custom-Feld (z. B. dein Attribut 4234749)
    const payload = {
      id: ticketId,
      customAttributes: [
        {
          attributeDefinitionId: "4234749",
          value: `TEST-${Date.now()}`
        }
      ]
    };

    console.log('📤 Sende Update an Weclapp:', payload);
    const result = await weclappFetch(`/ticket/update`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log(`✅ Custom-Feld 4234749 aktualisiert für Ticket ${ticketId}`);
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error(`💥 Fehler beim Test-Update:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
