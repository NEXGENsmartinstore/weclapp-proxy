export default async function handler(req, res) {
  // --- CORS ---
  const allowed = [
    'https://smart-instore.eu',
    'https://smart-instore.vercel.app',
    'http://localhost:3000'
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --- Proxy-Routing ---
  try {
    const { path = '', ...params } = req.query; // path: z.B. "salesOrder" oder "shipment"
    const queryString = new URLSearchParams(params).toString();
    const host = process.env.WECLAPP_HOST;
    const token = process.env.WECLAPP_TOKEN;

    const url = `${host.replace(/\/$/, '')}/webapp/api/v1/${path}${queryString ? '?' + queryString : ''}`;
    console.log("→ Forward to:", url);

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'AuthenticationToken': token,
        'Accept': 'application/json'
      }
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: 'Proxy crashed', message: err.message });
  }
}
