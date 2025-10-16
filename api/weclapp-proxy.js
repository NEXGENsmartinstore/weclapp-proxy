export default async function handler(req, res) {
  try {
    const targetUrl = 'https://project-8u32m.vercel.app/api/weclapp/salesOrder/weclapp-hook';
    const body = JSON.stringify(req.body || {});
    const forward = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });
    const data = await forward.text();
    console.log('Forwarded webhook to salesOrder hook');
    res.status(200).send(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
}
