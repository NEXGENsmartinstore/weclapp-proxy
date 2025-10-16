// api/weclapp-hook.js
export default async function handler(req, res) {
  try {
    // Nur POST-Requests akzeptieren
    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    const ticket = req.body;

    // Prüfe Status
    if (ticket.status && ticket.status.name === 'Einsatz planen') {

      // Weclapp API-Aufruf zum Erstellen eines Auftrags
      const salesOrder = {
        customerId: ticket.customerId,
        title: `Einsatz: ${ticket.title}`,
        description: ticket.description || '',
        salesOrderType: 'SERVICE', // anpassen
        currency: 'EUR'
      };

      const apiRes = await fetch('https://{deineSubdomain}.weclapp.com/webapp/api/v1/salesOrder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'AuthenticationToken': process.env.WECLAPP_API_TOKEN
        },
        body: JSON.stringify(salesOrder)
      });

      const result = await apiRes.json();

      console.log('SalesOrder erstellt:', result);

      // Optional: Auftrag-ID ins Ticket zurückschreiben
      await fetch(`https://{deineSubdomain}.weclapp.com/webapp/api/v1/ticket/${ticket.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'AuthenticationToken': process.env.WECLAPP_API_TOKEN
        },
        body: JSON.stringify({
          customField1: `Auftrag ${result.number}`
        })
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Fehler im Hook:', err);
    res.status(500).json({ error: err.message });
  }
}
