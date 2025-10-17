// api/weclapp/salesOrder/weclapp-hook.js

const { buildSalesOrderPayload } = require('./order-builder');

const TARGET_STATUS_ID = process.env.WECLAPP_TARGET_TICKET_STATUS_ID || '5609151';
const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;
const DRY_RUN = process.env.DRY_RUN === 'true'; // 👈 neu!

// -------------------------------
async function weclappFetch(path, options = {}) {
  const url = `${WECLAPP_HOST.replace(/\/$/, '')}/webapp/api/v1${path}`;

  if (DRY_RUN && options.method && options.method.toUpperCase() !== 'GET') {
    console.log(`🧪 [DRY-RUN] ${options.method} ${url}`);
    if (options.body) console.log('🧾 Body:', options.body);
    return { dryRun: true, simulatedUrl: url };
  }

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

// -------------------------------
function ensureJsonBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (req.body && typeof req.body === 'object') return req.body;
  return {};
}

// -------------------------------
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

    const ticket = await weclappFetch(`/ticket/id/${ticketId}`, { method: 'GET' });
    const { ticketStatusId, partyId } = ticket || {};
    console.log('📦 Ticketdaten:', { ticketId, ticketStatusId, partyId });

    if (String(ticketStatusId) !== String(TARGET_STATUS_ID)) {
      console.log(`⏭️ Status passt nicht. Erwartet ${TARGET_STATUS_ID}, ist ${ticketStatusId}.`);
      return res.status(200).json({ ok: true, skipped: 'status-mismatch' });
    }

    if (!partyId) {
      console.log('❌ Kein Kunde im Ticket.');
      return res.status(200).json({ ok: true, skipped: 'no-customerId' });
    }

    // 📦 Auftrag vorbereiten
    const salesOrderPayload = buildSalesOrderPayload(ticket, partyId);
    console.log('🧾 SalesOrder Payload:', salesOrderPayload);

    // Dry-Run → keine Erstellung
    if (DRY_RUN) {
      console.log('🧪 [DRY-RUN] Auftrag NICHT erstellt. Vollständiger Payload:', JSON.stringify(salesOrderPayload, null, 2));
      return res.status(200).json({
        ok: true,
        dryRun: true,
        wouldCreateOrder: salesOrderPayload
      });
    }

    // Auftrag anlegen
    const createdOrder = await weclappFetch('/salesOrder', {
      method: 'POST',
      body: JSON.stringify(salesOrderPayload)
    });
    console.log('✅ Auftrag erstellt:', createdOrder);

    // 🔗 Danach: Ticket verknüpfen
    try {
      const linkPayload = {
        salesOrderId: createdOrder.id,
        taskIdToOrderItemId: {}
      };
    
      const linkResponse = await weclappFetch(`/ticket/id/${ticketId}/linkSalesOrder`, {
        method: 'POST',
        body: JSON.stringify(linkPayload)
      });

  console.log('✅ Ticket erfolgreich verknüpft:', linkResponse);
} catch (err) {
  console.log('⚠️ Fehler beim Verknüpfen:', err.message);
}
    
    // Artikel hinzufügen
    const rules = salesOrderPayload._ruleData;
    if (rules.orderItems && rules.orderItems.length > 0) {
      for (const item of rules.orderItems) {
        console.log(`➕ Füge Artikel ${item.articleId} zu Auftrag ${createdOrder.id} hinzu...`);
        try {
          await weclappFetch(`/salesOrder/id/${createdOrder.id}/addItem`, {
            method: 'POST',
            body: JSON.stringify({ item })
          });
          console.log(`✅ Artikel ${item.articleId} erfolgreich hinzugefügt.`);
        } catch (e) {
          console.log('⚠️ Fehler beim Hinzufügen eines Artikels:', e.message);
        }
      }
    } else {
      console.log('ℹ️ Keine Artikel laut Regel definiert.');
    }

    return res.status(200).json({ ok: true, createdOrder });

  } catch (err) {
    console.error('💥 Fehler im Hook:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

module.exports = handler;
