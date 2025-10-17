// api/weclapp/salesOrder/rules.js

function mapTicketToOrderRules(ticket) {
  const { ticketNumber, subject, customAttributes = [] } = ticket || {};

  // 1️⃣ Kommission (Feld im Auftrag)
  const commission = `TICKET ${ticketNumber || ''}: ${subject || ''}`.trim();

  // 2️⃣ Artikel-Regeln
  const orderItems = [];
  const matchAttr = customAttributes.find(a => a.attributeDefinitionId === '4234749');

  // Wenn Custom-Feld 4234749 -> 4234755 gesetzt ist → Serviceartikel 4074816
  if (matchAttr?.selectedValues?.some(v => v.id === '4234755')) {
    orderItems.push({
      articleId: '4074816',
      itemType: 'SERVICE',
      invoicingType: 'FIXED_PRICE',
      quantity: 1
    });
  }

  // 3️⃣ Lieferdatum: 10 Tage ab heute (UNIX-Timestamp)
  const now = new Date();
  const deliveryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const plannedDeliveryDate = deliveryDate.getTime();

  // Versanddatum: 1 Tag vorher
  const plannedShippingDate = new Date(deliveryDate.getTime() - 24 * 60 * 60 * 1000).getTime();

  return { commission, orderItems, plannedDeliveryDate, plannedShippingDate };
}

module.exports = { mapTicketToOrderRules };
