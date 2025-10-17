// api/weclapp/salesOrder/rules.js

function mapTicketToOrderRules(ticket) {
  const { ticketNumber, subject, customAttributes = [] } = ticket || {};

  // Debug-Ausgabe
  console.log('🔍 Ticket customAttributes:', JSON.stringify(customAttributes, null, 2));

  const commission = `TICKET ${ticketNumber || ''}: ${subject || ''}`.trim();

  const orderItems = [];
  const matchAttr = customAttributes.find(a => a.attributeDefinitionId === '4234749');

  console.log('🎯 matchAttr:', matchAttr);

  if (matchAttr?.selectedValues?.some(v => v.id === '4234755')) {
    console.log('✅ Regel ausgelöst: 4234749 / 4234755');
    orderItems.push({
      articleId: '4074816',
      itemType: 'SERVICE',
      invoicingType: 'FIXED_PRICE',
      quantity: 1
    });
  } else {
    console.log('⚠️ Regel NICHT ausgelöst.');
  }

  const now = new Date();
  const deliveryDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const plannedDeliveryDate = deliveryDate.getTime();
  const plannedShippingDate = new Date(deliveryDate.getTime() - 24 * 60 * 60 * 1000).getTime();

  return { commission, orderItems, plannedDeliveryDate, plannedShippingDate };
}

module.exports = { mapTicketToOrderRules };
