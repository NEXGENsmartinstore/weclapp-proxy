// api/weclapp/salesOrder/order-builder.js

const { mapTicketToOrderRules } = require('./rules');

function buildSalesOrderPayload(ticket, customerId) {
  const { number, title, id } = ticket || {};
  const rules = mapTicketToOrderRules(ticket);

  return {
    customerId,
    title: title ? `Auto-Auftrag zu Ticket ${number || id}` : `Auto-Auftrag zu Ticket ${id}`,
    currency: 'EUR',
    commission: rules.commission,
    plannedDeliveryDate: rules.plannedDeliveryDate,
    plannedShippingDate: rules.plannedShippingDate,
    relatedEntities: [{ entityName: 'ticket', entityId: id }],
    _ruleData: rules // interner Transport (damit Hook weiß, welche Artikel folgen)
  };
}

module.exports = { buildSalesOrderPayload };
