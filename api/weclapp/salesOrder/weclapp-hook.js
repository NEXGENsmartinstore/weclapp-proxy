
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

      // 📦 Bestehenden Auftrag laden
      const existingOrder = await weclappFetch(`/salesOrder/id/${testOrderId}`, { method: 'GET' });
      const mergedCustomAttributes = existingOrder.customAttributes || [];

      // 💾 Merge: bestehender Auftrag + neue Werte
      const mergedOrder = {
        ...existingOrder,
        ...salesOrderPayload,
        id: testOrderId,
        customAttributes: mergedCustomAttributes,
        commission: (salesOrderPayload.commission || existingOrder.commission) + ' (TEST_RUN)',
      };

      // 🧱 Simulierten Task auf Basis der Regeln erzeugen
      const ruleData = require('./rules').mapTicketToOrderRules(ticket);
      const serviceItem = ruleData.orderItems?.find(
        i => i.articleType === 'SERVICE' || i.articleId === '4074816'
      );
      const defaultTechUser = process.env.WECLAPP_DEFAULT_TECH_USERID || '298775';
      const taskSubject = `TBD SERVICE ${existingOrder.deliveryAddress?.company ?? existingOrder.customer?.name ?? ''} // ${existingOrder.orderNumber}`;
      let dateFrom = null, dateTo = null;
      if (existingOrder.plannedDeliveryDate) {
        const base = new Date(existingOrder.plannedDeliveryDate);
        const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
        const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
        dateFrom = start.getTime();
        dateTo = end.getTime();
      }

      const simulatedTaskPayload = {
        customerId: existingOrder.customerId,
        orderItemId: serviceItem?.id ?? '(keine SERVICE-Position)',
        subject: taskSubject,
        taskStatus: 'NOT_STARTED',
        taskPriority: 'MEDIUM',
        allowTimeBooking: true,
        allowOverBooking: true,
        billableStatus: true,
        taskVisibilityType: 'ORGANIZATION',
        assignees: [{ userId: defaultTechUser, plannedEffort: 5400 }],
        plannedEffort: 5400,
        dateFrom,
        dateTo,
      };

      console.log('🧾 TEST_RUN → Order-Payload:', JSON.stringify(salesOrderPayload, null, 2));
      console.log('🧱 TEST_RUN → Simulierter Task:', JSON.stringify(simulatedTaskPayload, null, 2));

      return res.status(200).json({
        ok: true,
        testRun: true,
        updatedOrder: mergedOrder,
        simulatedTask: simulatedTaskPayload,
      });
    } catch (testErr) {
      console.error('💥 TEST_RUN Fehler:', testErr);
      return res
        .status(500)
        .json({ error: `TEST_RUN failed: ${String(testErr.message || testErr)}` });
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
// 🧩 PRODUKTIV_RUN (Task-Handling + Kalenderintegration mit TEST_RUN)
// ---------------------------------------------------------------------
try {
  console.log(`🧩 Starte Dienstleistungsplanung für Auftrag ${createdOrder.id} (Status: ${createdOrder.status})...`);

  // 1️⃣ SERVICE-Position finden
  const serviceItem = createdOrder.orderItems?.find(
    i => i.itemType === 'SERVICE' || i.articleId === '4074816'
  );

  if (!serviceItem) {
    console.warn('⚠️ Keine SERVICE-Position gefunden – keine Task erstellt.');
    return res.status(200).json({ ok: true, createdOrder, skipped: 'no-service-item' });
  }

  // 2️⃣ Prüfen, ob bereits Task für dieses orderItemId existiert
  const taskCheck = await weclappFetch(`/task?filter=orderItemId="${serviceItem.id}"`, { method: 'GET' });
  const existingTask = (taskCheck.result && taskCheck.result.length > 0) ? taskCheck.result[0] : null;

  // 👤 Standard-Techniker
  const defaultTechUser = process.env.WECLAPP_DEFAULT_TECH_USERID || '298775';

  // 3️⃣ Task-Payload aufbauen
  const taskSubject = `TBD SERVICE ${createdOrder.deliveryAddress?.company ?? createdOrder.customer?.name ?? ''} // ${createdOrder.orderNumber}`;
  const taskPayload = {
    customerId: createdOrder.customerId,
    orderItemId: serviceItem.id,
    subject: taskSubject,
    taskStatus: 'NOT_STARTED',
    taskPriority: 'MEDIUM',
    allowTimeBooking: true,
    allowOverBooking: true,
    billableStatus: true,
    taskVisibilityType: 'ORGANIZATION',
    assignees: [{ userId: defaultTechUser, plannedEffort: 5400 }],
    plannedEffort: 5400
  };

  // ⏰ Termin aus geplantem Lieferdatum (immer 10–12 Uhr)
  if (createdOrder.plannedDeliveryDate) {
    const base = new Date(createdOrder.plannedDeliveryDate);
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
    const end = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
    taskPayload.dateFrom = start.getTime();
    taskPayload.dateTo = end.getTime();
  }

  // 4️⃣ TEST_RUN-Option
  const TEST_RUN = process.env.TEST_RUN === 'true';
  if (TEST_RUN) {
    console.log('🧪 TEST_RUN aktiv – Task/Kalender werden NICHT wirklich erstellt.');
    return res.status(200).json({
      ok: true,
      testRun: true,
      createdOrder,
      simulatedTask: taskPayload
    });
  }

  // 5️⃣ Task anlegen oder überschreiben
  let taskResult;
  if (existingTask) {
    console.log(`♻️ Überschreibe bestehenden Task ${existingTask.id}...`);
    taskResult = await weclappFetch(`/task/id/${existingTask.id}?ignoreMissingProperties=true`, {
      method: 'PUT',
      body: JSON.stringify(taskPayload)
    });
  } else {
    console.log('➕ Kein bestehender Task – neuer wird erstellt...');
    taskResult = await weclappFetch('/task?ignoreMissingProperties=true', {
      method: 'POST',
      body: JSON.stringify(taskPayload)
    });
  }

  console.log('✅ Task verarbeitet:', taskResult);

// 6️⃣ Kalenderintegration (Servicekalender – v3.1 only-update)
try {
  const calendarId = '4913008'; // globaler Service-Kalender

  // 🔹 Hilfsfunktion: Samstag/Sonntag -> Montag
  function normalizeToWeekday(date) {
    const d = new Date(date);
    const day = d.getDay(); // 0=So, 6=Sa
    if (day === 6) d.setDate(d.getDate() + 2); // Samstag → Montag
    else if (day === 0) d.setDate(d.getDate() + 1); // Sonntag → Montag
    return d;
  }

  // 🔹 Lieferdatum normalisieren & Uhrzeit setzen
  let base = new Date(createdOrder.plannedDeliveryDate);
  base = normalizeToWeekday(base);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 10, 0, 0);
  const end   = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);

  // 🔹 aktuellen Task prüfen
  const taskDetails = await weclappFetch(`/task/id/${taskResult.id}`, { method: 'GET' });

  // ---------------------------------------------------------------------
  // 🧠 1️⃣ Fall: Task hat bereits calendarEventId → Event nur aktualisieren
  // ---------------------------------------------------------------------
  if (taskDetails.calendarEventId) {
    const eventId = taskDetails.calendarEventId;
    console.log(`ℹ️ Task ${taskResult.id} hat calendarEventId ${eventId} – aktualisiere bestehenden Eintrag.`);

    const existingEvent = await weclappFetch(`/calendarEvent/id/${eventId}`, { method: 'GET' });

    const updatedEvent = {
      id: existingEvent.id,
      version: existingEvent.version,
      subject: taskSubject,
      calendarId,
      startDate: start.getTime(),
      endDate: end.getTime()
    };

    await weclappFetch(`/calendarEvent/id/${eventId}?ignoreMissingProperties=true`, {
      method: 'PUT',
      body: JSON.stringify(updatedEvent)
    });

    console.log(`✅ Kalender-Event ${eventId} erfolgreich aktualisiert.`);
  }

  // ---------------------------------------------------------------------
  // 🧠 2️⃣ Fall: Kein calendarEventId → vorhandenen Event suchen & zuordnen
  // ---------------------------------------------------------------------
  else {
    console.log(`🔍 Kein calendarEventId für Task ${taskResult.id} – suche passenden Eintrag im Kalender...`);

    const events = await weclappFetch(`/calendarEvent?maxResults=100&sort=-createdDate`, { method: 'GET' });
    const match = (events.result || []).find(ev =>
      ev.subject?.includes(createdOrder.orderNumber) ||
      ev.subject?.includes(createdOrder.customer?.name || '')
    );

    if (match) {
      console.log(`🔗 Bestehender Kalender-Event gefunden (${match.id}) – verknüpfe Task.`);

      // aktuelle Task-Version holen
      const latestTask = await weclappFetch(`/task/id/${taskResult.id}`, { method: 'GET' });

      // Task mit calendarEventId updaten
      const updateBody = {
        id: latestTask.id,
        version: latestTask.version,
        calendarEventId: match.id
      };

      await weclappFetch(`/task/id/${latestTask.id}?ignoreMissingProperties=true`, {
        method: 'PUT',
        body: JSON.stringify(updateBody)
      });

      console.log(`✅ Task ${latestTask.id} erfolgreich mit Event ${match.id} verknüpft.`);

      // Event anschließend aktualisieren (Betreff + Zeitfenster)
      const updatedEvent = {
        id: match.id,
        version: match.version,
        subject: taskSubject,
        calendarId,
        startDate: start.getTime(),
        endDate: end.getTime()
      };

      await weclappFetch(`/calendarEvent/id/${match.id}?ignoreMissingProperties=true`, {
        method: 'PUT',
        body: JSON.stringify(updatedEvent)
      });

      console.log(`✅ Kalender-Event ${match.id} aktualisiert.`);
    } else {
      console.log('⚠️ Kein passender Kalender-Event gefunden – Weclapp-Automatik bleibt zuständig.');
    }
  }

} catch (calErr) {
  console.warn('⚠️ Fehler beim Kalender-Update:', calErr.message);
}

console.log('✅ Kalenderintegration abgeschlossen.');


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
