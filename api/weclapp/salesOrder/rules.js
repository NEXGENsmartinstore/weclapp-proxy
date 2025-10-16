// api/weclapp/salesOrder/rules.js

function mapTicketToOrderRules(ticket) {
  const { ticketNumber, subject, customAttributes = [] } = ticket || {};

  // 1️⃣ Kommission
  const commission = `TICKET ${ticketNumber || ''}: ${subject || ''}`.trim();

  // 2️⃣ Artikel-Regeln
  let orderItems = [];
  const matchAttr = customAttributes.find(a => a.attributeDefinitionId === '4234749');

  if (matchAttr?.selectedValues?.some(v => v.id === '4234755')) {
    orderItems.push({
      articleId: '5806524',
      quantity: 1,
      type: 'SALES_ITEM',
      positionNumber: 1,
      description: 'Auto-Artikel aus Regel 4234749/4234755'
    });
  }

  // 3️⃣ Lieferdatum (10 Tage ab heute, als UNIX-Timestamp in ms)
  const now = new Date();
  const deliveryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const plannedDeliveryDate = deliveryDate.getTime();

  // Optional: Versanddatum (einen Tag vorher)
  const plannedShippingDate = new Date(deliveryDate.getTime() - 1 * 24 * 60 * 60 * 1000).getTime();

  return { commission, orderItems, plannedDeliveryDate, plannedShippingDate };
}

module.exports = { mapTicketToOrderRules };
