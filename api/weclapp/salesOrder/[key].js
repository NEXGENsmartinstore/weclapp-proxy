export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { key } = req.query;  // kann UUID oder orderNumber sein
    const host = process.env.WECLAPP_HOST;
    const token = process.env.WECLAPP_TOKEN;

    let url;
    if (/^[0-9a-fA-F-]{36}$/.test(key)) {
      // Sieht wie UUID aus
      url = `${host.replace(/\/$/, '')}/webapp/api/v1/salesOrder/${encodeURIComponent(key)}`;
    } else {
      // Sonst nehmen wir an: es ist eine orderNumber
      url = `${host.replace(/\/$/, '')}/webapp/api/v1/salesOrder?orderNumber-eq=${encodeURIComponent(key)}`;
    }

    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'AuthenticationToken': token,
        'Accept': 'application/json'
      }
    });

    const text = await upstream.text();

    console.log("Proxy SalesOrder URL:", url);
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
