// api/weclapp/salesOrder/weclapp-hook.js

// Konfiguration
const TARGET_STATUS_ID = process.env.WECLAPP_TARGET_TICKET_STATUS_ID || '5609151'; // dein Status "Einsatz planen"
const WECLAPP_HOST = process.env.WECLAPP_HOST;   // z.B. https://nexgen.weclapp.com
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN; // dein API Token

// kleine Helper
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
  // weclapp liefert bei Fehlern oft JSON mit details
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  if (!WECLAPP_HOST || !WECLAPP_TOKEN) {
    return res.status(500).json({ error: 'Missing WECLAPP_HOST or WECLAPP_TOKEN' });
  }

  try {
    const payload = ensureJsonBody(req);

    // Weclapp Webhook: meistens steckt die Entität direkt drin.
    // Wir akzeptieren beide Varianten: direktes Ticket oder wrapped {entity: {…}}
    const ticket = payload?.entity?.id ? payload.entity : payload;

    console.log('Webhook payload keys:', Object.keys(payload || {}));
    console.log('Ticket snapshot:', { id: ticket?.id, ticketStatusId: ticket?.ticketStatusId });

    if (!ticket?.id) {
      console.log('Kein Ticket in Payload – nichts zu tun.');
      return res.status(200).json({ ok: true, skipped: 'no-ticket' });
    }

    // Ticket frisch aus weclapp holen (um sichere Felder wie customerId zu haben)
    const freshTicket = await weclappFetch(`/ticket/id/${ticket.id}`, { method: 'GET' });
    console.log('Fresh ticket keys:', Object.keys(freshTicket || {}));

    const { ticketStatusId, customerId, number, title } = freshTicket || {};

    if (!ticketStatusId) {
      console.log('Ticket hat keine ticketStatusId – abbrechen.');
      return res.status(200).json({ ok: true, skipped: 'no-status' });
    }

    if (String(ticketStatusId) !== String(TARGET_STATUS_ID)) {
      console.log(`Status passt nicht. Erwartet ${TARGET_STATUS_ID}, ist ${ticketStatusId}.`);
      return res.status(200).json({ ok: true, skipped: 'status-mismatch' });
    }

    if (!customerId) {
      console.log('Kein customerId am Ticket – Auftrag kann nicht angelegt werden.');
      return res.status(200).json({ ok: true, skipped: 'no-customerId' });
    }

    // Minimalen Auftrag erstellen – "blanko"
    const salesOrderPayload = {
      customerId,
      title: title ? `Auto-Auftrag zu Ticket ${number || ticket.id}: ${title}` : `Auto-Auftrag zu Ticket ${number || ticket.id}`,
      currency: 'EUR'
      // Positions etc. fügen wir später schrittweise hinzu
    };

    console.log('SalesOrder Payload:', salesOrderPayload);

    const createdOrder = await weclappFetch('/salesOrder', {
      method: 'POST',
      body: JSON.stringify(salesOrderPayload)
    });

    console.log('SalesOrder erstellt:', { id: createdOrder?.id, number: createdOrder?.number });

    // OPTIONAL: ins Ticket zurückschreiben (z.B. in ein freies Feld oder als Kommentar)
    // -> auskommentiert lassen, bis wir ein Feld vereinbaren
    // await weclappFetch(`/ticket/${ticket.id}`, {
    //   method: 'PUT',
    //   body: JSON.stringify({ customField1: `SO:${createdOrder.id}` })
    // });

    return res.status(200).json({
      ok: true,
      createdSalesOrder: { id: createdOrder?.id, number: createdOrder?.number }
    });

  } catch (err) {
    console.error('Fehler im Hook:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}
