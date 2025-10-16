// api/weclapp/salesOrder/order-builder.js
const { mapTicketToOrderRules } = require('./rules');

function buildSalesOrderPayload(ticket, customerId) {
  const { commission, orderItems, plannedDeliveryDate, plannedShippingDate } =
    require('./rules').mapTicketToOrderRules(ticket);

  const payload = {
    customerId,
    title: `Auto-Auftrag zu Ticket ${ticket.ticketNumber || ticket.id}`,
    currency: 'EUR',
    commission,
    plannedDeliveryDate,
    plannedShippingDate,
    relatedEntities: [
      {
        entityName: 'ticket',
        entityId: ticket.id
      }
    ]
  };

  if (orderItems?.length) {
    payload.orderItems = orderItems;
  }

  return payload;
}


module.exports = { buildSalesOrderPayload };
