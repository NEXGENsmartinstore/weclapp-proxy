// /api/customers/addresses.js
export const config = { runtime: 'nodejs' };

const ALLOWED_ORIGINS = new Set([
  'https://smart-instore.eu',
  'https://www.smart-instore.eu',
  'https://project-8u32m.vercel.app'
]);

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://smart-instore.eu';

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Max-Age', '86400');

  const requested = (req.headers['access-control-request-headers'] || '')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);
  const headers = new Set(['Content-Type', 'Accept', 'X-Requested-With']);
  for (const h of requested) headers.add(h);
  res.setHeader('Access-Control-Allow-Headers', Array.from(headers).join(', '));
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const SHEET_ID  = process.env.SHEET_ID;   // z.B. 1qVV_...
    const SHEET_TAB = process.env.SHEET_TAB || 'Adressen';
    if (!SHEET_ID) return res.status(500).json({ error: 'Missing SHEET_ID env' });

    const ids = await readIds(req); // ["11780","16253",...]
    if (ids.length === 0) return res.status(400).json({ error: 'No customer ids provided' });

    // CSV gesamt ziehen
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(502).json({ error: 'Sheet upstream error', status: upstream.status, body: body.slice(0,200) });
    }
    const csv = await upstream.text();
    const rows = parseCsv(csv);

    // Filter nach übergebenen IDs
    const setIds = new Set(ids.map(x => String(x).trim()));
    const out = {};
    for (const r of rows) {
      const customerNumber = (r['Kundennummer'] || r['A'] || '').toString().trim();
      if (!customerNumber) continue;
      if (!setIds.has(customerNumber)) continue;

      out[customerNumber] = {
        company: r['Firma'] || '',
        street:  r['Straße'] || r['Strasse'] || '',
        zip:     r['PLZ'] || '',
        city:    r['Stadt'] || ''
      };
    }

    return res.status(200).json({ addresses: out });
  } catch (err) {
    return res.status(500).json({ error: 'Function crashed', message: err?.message || String(err) });
  }
}

// ---- Helpers ----
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  // Robust split: trennt an Kommas, aber entfernt führende/abschließende Quotes
  const splitLine = (line) =>
    line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map(c => c.replace(/^"(.*)"$/, '$1').trim());

  const header = splitLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = splitLine(lines[i]);

    // Nur die ersten 5 Spalten beachten (alles dahinter sind leere)
    const obj = {
      Kundennummer: cols[0] || '',
      Firma: cols[1] || '',
      Straße: cols[2] || '',
      PLZ: cols[3] || '',
      Stadt: cols[4] || ''
    };
    rows.push(obj);
  }

  return rows;
}


function readIds(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => {
      try {
        const parsed = JSON.parse(data || '{}');
        const ids = Array.isArray(parsed?.ids) ? parsed.ids : [];
        resolve(ids.map(x => String(x).trim()).filter(Boolean));
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}
