
// PRODUKTIV_RUN
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

// 🔧 TEST_RUN-Logik: Ticket-Status löst gezielten Update-Test aus
const TEST_RUN = process.env.TEST_RUN; // z. B. "5905847-5908217"
if (TEST_RUN) {
  const [testTicketId, testOrderId] = TEST_RUN.split('-').map(s => s.trim());

  if (String(ticketId) === String(testTicketId)) {
    console.log(`🧪 TEST_RUN aktiv: Ticket ${testTicketId} → Update Auftrag ${testOrderId}`);

    try {
      // 🧩 Ticket holen + Payload aufbauen
      const ticket = await weclappFetch(`/ticket/id/${ticketId}`, { method: 'GET' });
      const salesOrderPayload = buildSalesOrderPayload(ticket, ticket.partyId);

      // 🧱 Pflicht-Custom-Attribute definieren
      const requiredCustomAttributes = [
        { attributeDefinitionId: '40227', selectedValueId: '40228' },
        { attributeDefinitionId: '198428', selectedValueId: '1517137' }
      ];

      // 📦 Bestehenden Auftrag laden
      const existingOrder = await weclappFetch(`/salesOrder/id/${testOrderId}`, { method: 'GET' });
      const mergedCustomAttributes = existingOrder.customAttributes || [];

      // Fehlt ein Pflichtattribut? → ergänzen
      for (const attr of requiredCustomAttributes) {
        const already = mergedCustomAttributes.some(
          a => String(a.attributeDefinitionId) === String(attr.attributeDefinitionId)
        );
        if (!already) {
          mergedCustomAttributes.push(attr);
          console.log(`➕ CustomAttribute ergänzt: ${attr.attributeDefinitionId}`);
        } else {
          console.log(`⏭️ CustomAttribute ${attr.attributeDefinitionId} war schon vorhanden`);
        }
      }

      // 💾 Merge: bestehender Auftrag + neue Werte
      const mergedOrder = {
        ...existingOrder,                 // alle Pflichtfelder behalten
        ...salesOrderPayload,             // unsere Regelwerte drüberlegen
        id: testOrderId,
        customAttributes: mergedCustomAttributes,
        commission: (salesOrderPayload.commission || existingOrder.commission) + ' (TEST_RUN)',
      };

      // 🚀 Auftrag PUTten (vollständiger Datensatz)
      const updatedOrder = await weclappFetch(`/salesOrder/id/${testOrderId}`, {
        method: 'PUT',
        body: JSON.stringify(mergedOrder)
      });

      console.log('✅ TEST_RUN: Auftrag erfolgreich aktualisiert.');
      return res.status(200).json({
        ok: true,
        testRun: true,
        updatedOrder
      });
    } catch (testErr) {
      console.error('💥 TEST_RUN Fehler:', testErr);
      return res.status(500).json({ error: `TEST_RUN failed: ${String(testErr.message || testErr)}` });
    }
  }
}

    
    // 🛑 Sicherheitsbremse 1: bereits verknüpft
    if (salesOrderId) {
      console.log(`⏹️ Ticket ${ticketId} ist bereits mit Auftrag ${salesOrderId} verknüpft – keine Neuerstellung.`);
      return res.status(200).json({ ok: true, skipped: 'already-linked', salesOrderId });
    }

    // 🛑 Sicherheitsbremse 2: vorhandener Auftrag mit gleicher Kommission (lokale Filterung)
    try {
    const allOrders = await weclappFetch(`/salesOrder?customerId-eq=${partyId}`, { method: 'GET' });
    const matchingOrders = (allOrders?.result || []).filter(o =>
    typeof o.commission === 'string' && o.commission.includes(`TICKET ${ticketNumber}:`)
    );

  if (matchingOrders.length > 0) {
    console.log(`⏹️ Auftrag mit Kommission "TICKET ${ticketNumber}:" bereits vorhanden: ${matchingOrders.map(o => o.id).join(', ')}`);
    return res.status(200).json({
      ok: true,
      skipped: 'commission-match',
      matchingOrders: matchingOrders.map(o => ({ id: o.id, commission: o.commission }))
    });
  }
} catch (err) {
  console.warn(`⚠️ Kommissions-Check fehlgeschlagen: ${err.message}`);
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
    // ---------------------------------------------------------------------
    // 🧩 PRODUKTIV_RUN: Dienstleistungsplanung (Task + Kalender)
    // ---------------------------------------------------------------------

    try {
      // 💡 Nur wenn Auftrag bestätigt ist (ORDER_CONFIRMATION_PRINTED)
      console.log(`🧩 Starte Dienstleistungsplanung für Auftrag ${createdOrder.id} (Status: ${createdOrder.status})...`);


        // 1️⃣ SERVICE-Position finden
        const serviceItem = createdOrder.orderItems?.find(
          i => i.itemType === 'SERVICE' || i.articleId === '4074816'
        );
        if (!serviceItem) {
          console.warn('⚠️ Keine SERVICE-Position gefunden – keine Task erstellt.');
          return res.status(200).json({ ok: true, createdOrder, skipped: 'no-service-item' });
        }

        // 2️⃣ Task-Payload aufbauen
        const taskPayload = {
          customerId: createdOrder.customerId,
          orderItemId: serviceItem.id,
          subject: `MSG SERVICE ${createdOrder.deliveryAddress?.company ?? createdOrder.customer?.name ?? ''} // ${createdOrder.orderNumber}`,
          taskStatus: 'NOT_STARTED',
          taskPriority: 'MEDIUM',
          allowTimeBooking: true,
          allowOverBooking: true,
          billableStatus: true,
          taskVisibilityType: 'ORGANIZATION'
        };

        // ⏰ Termin aus geplantem Versanddatum (10:00 – 11:30)
        if (createdOrder.plannedShippingDate) {
          const base = new Date(createdOrder.plannedShippingDate);
          const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
          taskPayload.dateFrom = start.getTime();
          taskPayload.dateTo = start.getTime() + 90 * 60 * 1000;
        }

        // 👤 Standard-Techniker (env oder fix)
        const defaultTechUser = process.env.WECLAPP_DEFAULT_TECH_USERID || '298775';
        taskPayload.assignees = [{ userId: defaultTechUser, plannedEffort: 5400 }];

        // 3️⃣ Task anlegen
        const task = await weclappFetch('/task?ignoreMissingProperties=true', {
          method: 'POST',
          body: JSON.stringify(taskPayload)
        });
        console.log('✅ Task erstellt:', task);

        // 4️⃣ Kalendereintrag im Service-Kalender erzeugen
        try {
          const eventBody = {
            calendarId: '4913008', // Service-Kalender
            allDayEvent: false,
            privateEvent: false,
            showAs: 'FREE',
            subject: task.subject,
            description: '<p>Automatisch aus Auftrag erstellt</p>',
            startDate: taskPayload.dateFrom,
            endDate: taskPayload.dateTo,
            userId: defaultTechUser
          };

          const calendarEvent = await weclappFetch('/calendarEvent?ignoreMissingProperties=true', {
            method: 'POST',
            body: JSON.stringify(eventBody)
          });

          console.log('📅 Kalender-Event erstellt:', calendarEvent);

          // 5️⃣ Task ↔ Kalender-Verknüpfung
          await weclappFetch(`/task/id/${task.id}?ignoreMissingProperties=true`, {
            method: 'PUT',
            body: JSON.stringify({ calendarEventId: calendarEvent.id })
          });
          console.log('🔗 Task mit Kalender-Event verknüpft.');
        } catch (calErr) {
          console.warn('⚠️ Fehler beim Kalender-Eintrag:', calErr.message);
        }
      }
    } catch (prodErr) {
      console.warn('⚠️ PRODUKTIV_RUN Fehler:', prodErr.message);
    }
    // ---------------------------------------------------------------------


    return res.status(200).json({ ok: true, createdOrder });
  } catch (err) {
    console.error('💥 Fehler im Hook:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

module.exports = handler;
