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

  const { ticketId, createdOrderId } = req.body || {};
  if (!ticketId || !createdOrderId) {
    return res.status(400).json({ error: 'Missing ticketId or createdOrderId' });
  }

  console.log(`🕓 Delay für Ticket-Update gestartet (Ticket ${ticketId}, Auftrag ${createdOrderId})`);

  // 1 Sekunde warten, damit Weclapp das Ticket freigibt
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const result = await weclappFetch(`/helpdeskTicket/update`, {
      method: 'POST',
      body: JSON.stringify({
        id: ticketId,
        customAttributes: [
          {
            attributeDefinitionId: "4234749",
            selectedValues: [{ id: "4234755" }]
          }
        ]
      })
    });

    console.log(`✅ Asynchrones Update erfolgreich für Ticket ${ticketId}`, result);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`💥 Fehler im Updater für Ticket ${ticketId}:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
