// api/weclapp/salesOrder/test-run.js

const { buildSalesOrderPayload } = require('./order-builder');
const { mapTicketToOrderRules } = require('./rules');

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

/**
 * POST /api/weclapp/salesOrder/test-run
 * Body: { salesOrderId?: string, ticketMock?: object, updateExisting?: boolean }
 */
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  if (!WECLAPP_HOST || !WECLAPP_TOKEN) return res.status(500).json({ error: 'Missing WECLAPP_HOST or WECLAPP_TOKEN' });

  try {
    const { salesOrderId, ticketMock, updateExisting = false } = req.body || {};

    // 🧩 Dummy-Ticket falls nichts übergeben wurde
    const fakeTicket = ticketMock || {
      id: 'DUMMY-123',
      ticketNumber: '999999',
      subject: 'Testlauf Auftrag',
      customAttributes: [
        {
          attributeDefinitionId: '4234749',
          selectedValues: [{ id: '4234755' }] // löst Regel aus
        }
      ]
    };

    // 🔍 Regeln + Payload generieren
    const ruleData = mapTicketToOrderRules(fakeTicket);
    const payload = buildSalesOrderPayload(fakeTicket, '100000'); // Dummy-Kunde oder Testkunde

    // 🧱 Fixe Custom Attribute anhängen
    payload.customAttributes = [
      {
        attributeDefinitionId: '40227',
        selectedValueId: '40228'
      },
      {
        attributeDefinitionId: '198428',
        selectedValueId: '1517137'
      }
    ];

    console.log('🧩 RuleData:', ruleData);
    console.log('🧾 Payload mit CustomAttributes:', payload);

    // 🧪 DryRun → Nur anzeigen
    if (DRY_RUN && !updateExisting) {
      console.log('🧪 [DRY-RUN] Kein echter API-Call ausgeführt.');
      return res.status(200).json({ ok: true, dryRun: true, payload });
    }

    // 🔄 Update vorhandenen Auftrag
    if (salesOrderId && updateExisting) {
      const updated = await weclappFetch(`/salesOrder/id/${salesOrderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...payload,
          id: salesOrderId,
          commission: payload.commission + ' (TEST-RUN)',
        })
      });
      console.log(`✅ Auftrag ${salesOrderId} aktualisiert.`);
      return res.status(200).json({ ok: true, updated });
    }

    // 🆕 Neuen Testauftrag erstellen
    const created = await weclappFetch('/salesOrder', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    console.log('✅ Neuer Testauftrag erstellt:', created);
    return res.status(200).json({ ok: true, created });
  } catch (err) {
    console.error('💥 Fehler im Test-Run:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

module.exports = handler;
