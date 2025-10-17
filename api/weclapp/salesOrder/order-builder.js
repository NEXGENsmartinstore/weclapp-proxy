// api/weclapp/salesOrder/order-builder.js

const { mapTicketToOrderRules } = require('./rules');

/**
 * Baut das finale Payload-Objekt für POST /salesOrder
 * basierend auf Ticketdaten und Regellogik.
 */
function buildSalesOrderPayload(ticket, customerId) {
  const { ticketNumber, subject, id: ticketId } = ticket || {};

  // 🎯 Regel-Engine anwenden (Kommission, Artikel, Lieferdatum, etc.)
  const ruleData = mapTicketToOrderRules(ticket);

  // 🧱 Grundstruktur des Auftrags
  const payload = {
    customerId,
    title: `Auto-Auftrag zu Ticket ${ticketNumber || ticketId}`,
    currency: 'EUR',
    commission: ruleData.commission,
    plannedDeliveryDate: ruleData.plannedDeliveryDate,
    plannedShippingDate: ruleData.plannedShippingDate,
    relatedEntities: [
      { entityName: 'ticket', entityId: ticketId }
    ]
  };

  // 🧩 Wenn Artikel vorhanden sind → Payload ergänzen
  if (ruleData.orderItems && ruleData.orderItems.length > 0) {
    payload.orderItems = ruleData.orderItems;
  } else {
    console.log('ℹ️ Keine Artikel laut Regel definiert.');
  }

  return payload;
}

module.exports = { buildSalesOrderPayload };
