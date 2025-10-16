// api/weclapp/salesOrder/rules.js

/**
 * Regelt, wie Ticket-Daten in den Auftrag übersetzt werden.
 * -> Gibt z. B. commission-Text und optionale Artikel zurück.
 */

function mapTicketToOrderRules(ticket) {
  const { ticketNumber, subject, customAttributes = [] } = ticket || {};

  // 1️⃣ Kommission = "TICKET {ticketNumber}: {subject}"
  const commission = `TICKET ${ticketNumber || ''}: ${subject || ''}`.trim();

  // 2️⃣ Wenn Attribut 4234749 == 4234755 → Artikel hinzufügen
  let orderItems = [];

  const matchAttr = customAttributes.find(
    a => a.attributeDefinitionId === '4234749'
  );

  if (matchAttr?.selectedValues?.some(v => v.id === '4234755')) {
    orderItems.push({
      articleId: '5806524',
      quantity: 1,
      price: 0,
      description: 'Auto-Artikel aus Regel 4234749/4234755'
    });
  }

  return { commission, orderItems };
}

module.exports = { mapTicketToOrderRules };
