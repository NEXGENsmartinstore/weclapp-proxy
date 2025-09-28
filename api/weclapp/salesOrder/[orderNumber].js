export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { orderNumber } = req.query;
    const host = process.env.WECLAPP_HOST;
    const token = process.env.WECLAPP_TOKEN;

    const url = `${host.replace(/\/$/, '')}/webapp/api/v1/salesOrder?orderNumber-eq=${encodeURIComponent(orderNumber)}`;

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'AuthenticationToken': token,
        'Accept': 'application/json'
      }
    });

    const text = await upstream.text();

    console.log("Proxy SalesOrder (orderNumber) URL:", url);
    console.log("Upstream Status:", upstream.status);

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