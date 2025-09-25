export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { id } = req.query || {};
    const host = process.env.WECLAPP_HOST;
    const token = process.env.WECLAPP_TOKEN;

	const url = `${host.replace(/\/$/, '')}/webapp/api/v1/salesOrder/id/${encodeURIComponent(id)}`;


    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'AuthenticationToken': token,
        'Accept': 'application/json'
      }
    });

    const text = await upstream.text();

    // DEBUG-Ausgabe ins Log:
    console.log("Proxy Request URL:", url);
    console.log("AuthenticationToken:", token ? "gesetzt" : "leer");
    console.log("Upstream Status:", upstream.status);
    console.log("Upstream Response (first 200 chars):", text.slice(0,200));

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
