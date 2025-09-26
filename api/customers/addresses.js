// /api/customers/addresses.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://smart-instore.eu');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        company: (r['Firma']   || r['B'] || '').toString().trim(),
        street:  (r['Straße']  || r['Strasse'] || r['C'] || '').toString().trim(),
        zip:     (r['PLZ']     || r['D'] || '').toString().trim(),
        city:    (r['Stadt']   || r['E'] || '').toString().trim(),
        // optional: Land, falls später Spalte F
        // country: (r['Land'] || r['F'] || '').toString().trim()
      };
    }

    return res.status(200).json({ addresses: out });
  } catch (err) {
    return res.status(500).json({ error: 'Function crashed', message: err?.message || String(err) });
  }
}

// ---- Helpers ----
function parseCsv(text) {
  // Erkennung: Komma oder Semikolon als Trenner
  const delimiter = text.includes(';') ? ';' : ',';

  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(delimiter).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = lines[i].split(delimiter).map(c => c.trim());
    const obj = {};
    header.forEach((h, idx) => obj[h] = cols[idx] ?? '');
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
