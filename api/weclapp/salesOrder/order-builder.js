// api/weclapp/salesOrder/order-builder.js
const { mapTicketToOrderRules } = require('./rules');

/**
 * Baut das vollständige Payload für /salesOrder auf
 */
function buildSalesOrderPayload(ticket, customerId) {
  const { commission, orderItems } = mapTicketToOrderRules(ticket);

  const payload = {
    customerId,
    title: `Auto-Auftrag zu Ticket ${ticket.ticketNumber || ticket.id}`,
    currency: 'EUR',
    commission
  };

  if (orderItems.length > 0) {
    payload.orderItems = orderItems;
  }

  return payload;
}

module.exports = { buildSalesOrderPayload };
