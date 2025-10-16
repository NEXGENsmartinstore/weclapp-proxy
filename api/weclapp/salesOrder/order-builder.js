// api/weclapp/salesOrder/order-builder.js
const { mapTicketToOrderRules } = require('./rules');

function buildSalesOrderPayload(ticket, customerId) {
  const { commission, orderItems, plannedDeliveryDate } = mapTicketToOrderRules(ticket);

  const payload = {
    customerId,
    title: `Auto-Auftrag zu Ticket ${ticket.ticketNumber || ticket.id}`,
    currency: 'EUR',
    commission,
    plannedDeliveryDate
  };

  if (orderItems && orderItems.length > 0) {
    payload.orderItems = orderItems;
  }

  return payload;
}

module.exports = { buildSalesOrderPayload };

