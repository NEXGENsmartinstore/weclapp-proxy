// /api/weclapp/salesOrder/[id].js

// Erzwinge Node.js Runtime (kein Edge)
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS zuerst setzen & OPTIONS sofort beantworten
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query || {};
    if (!id) {
      return res.status(400).json({ error: 'Missing id in path' });
    }

    const host = process.env.WECLAPP_HOST;
    const token = process.env.WECLAPP_TOKEN;

    if (!host || !token) {
      return res.status(500).json({ error: 'Missing env variables' });
    }

    const url = `${host.replace(/\/$/, '')}/salesOrder/id/${encodeURIComponent(id)}`;
    const upstream = await fetch(url, {
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
    return res.status(500).json({
      error: 'Function crashed',
      message: err?.message || String(err)
    });
  }
}
