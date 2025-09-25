// /api/weclapp/salesOrder/index.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const host  = process.env.WECLAPP_HOST;   // z.B. https://nexgen.weclapp.com
    const token = process.env.WECLAPP_TOKEN;  // AuthenticationToken
    if (!host || !token) {
      return res.status(500).json({ error: 'Missing env variables' });
    }

    // Query-String 1:1 übernehmen
    const qs = new URLSearchParams(req.query || {}).toString();
    const url = `${host.replace(/\/$/, '')}/webapp/api/v1/salesOrder${qs ? `?${qs}` : ''}`;

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
    return res.send(text);
  } catch (err) {
    return res.status(500).json({ error: 'Function crashed', message: err?.message || String(err) });
  }
}
