// api/weclapp/salesOrder/rules.js

function mapTicketToOrderRules(ticket) {
  const { ticketNumber, subject, customAttributes = [] } = ticket || {};

  // 1️⃣ Kommission (Feld "commission" im Auftrag)
  const commission = `TICKET ${ticketNumber || ''}: ${subject || ''}`.trim();

  // 2️⃣ Artikel-Regeln
  const orderItems = [];
  const matchAttr = customAttributes.find(a => a.attributeDefinitionId === '4234749');

  // Wenn Custom-Feld 4234749 -> 4234755 gesetzt ist → Serviceartikel anlegen
  if (matchAttr?.selectedValues?.some(v => v.id === '4234755')) {
    orderItems.push({
      articleId: '4074816',           // Serviceartikel-ID
      itemType: 'SERVICE',            // wichtig: SERVICE
      invoicingType: 'FIXED_PRICE',   // MUSS mitgegeben werden für Serviceartikel
      quantity: 1,                    // einfache Menge
      positionNumber: 1,              // erste Position
      description: 'Automatisch angelegter Serviceeinsatz (Regel 4234749/4234755)'
    });
  }

  // 3️⃣ Lieferdatum (10 Tage ab heute, als UNIX-Timestamp in ms)
  const now = new Date();
  const deliveryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const plannedDeliveryDate = deliveryDate.getTime();

  // Optional: Versanddatum (einen Tag vorher)
  const plannedShippingDate = new Date(deliveryDate.getTime() - 1 * 24 * 60 * 60 * 1000).getTime();

  // Rückgabe der berechneten Felder
  return { commission, orderItems, plannedDeliveryDate, plannedShippingDate };
}

module.exports = { mapTicketToOrderRules };
