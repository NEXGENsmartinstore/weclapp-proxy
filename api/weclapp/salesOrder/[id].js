export default async function handler(req, res) {
  const { id } = req.query;
  const host = process.env.WECLAPP_HOST;   // z. B. https://nexgen.weclapp.com
  const token = process.env.WECLAPP_TOKEN; // dein AuthenticationToken

  if (!host || !token) {
    res.status(500).json({ error: 'Missing env variables' });
    return;
  }

  const r = await fetch(`${host}/salesOrder/id/${encodeURIComponent(id)}`, {
    headers: {
      'AuthenticationToken': token,
      'Accept': 'application/json'
    }
  });

  // CORS erlauben
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const body = await r.text();
  res.status(r.status).type('application/json').send(body);
}
