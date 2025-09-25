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
    const SHEET_ID  = process.env.SHEET_ID;   // z.B. 1qVV_00RV1tjwc8jzMITOtN_utUYpzxFeNJ8aIAJqb2c
    const SHEET_TAB = process.env.SHEET_TAB || 'Adressen';
    if (!SHEET_ID) return res.status(500).json({ error: 'Missing SHEET_ID env' });

    const ids = await readIds(req);               // ["11780","16253",...]
    if (ids.length === 0) return res.status(400).json({ error: 'No customer ids provided' });

    // Chunks gegen zu lange URLs
    const chunks = chunk(ids, 40);
    const aggregated = [];

    for (const chunkIds of chunks) {
      // Versuch A: numerische IN-Liste (ohne Quotes)
      const numericList = chunkIds
        .map(x => String(x).trim())
        .filter(Boolean)
        .filter(x => /^\d+$/.test(x)) // nur reine Ziffern
        .join(',');

      let rows = [];
      if (numericList) {
        const tqNum = `select A,B,C,D,E where A in (${numericList})`;
        rows = await fetchCsvRows(SHEET_ID, SHEET_TAB, tqNum);
      }

      // Wenn keine Treffer (oder IDs nicht rein numerisch): Versuch B mit Quotes
      if (rows.length === 0) {
        const quotedList = chunkIds
          .map(x => `'${String(x).trim().replace(/'/g, "\\'")}'`)
          .join(',');
        const tqStr = `select A,B,C,D,E where A in (${quotedList})`;
        rows = await fetchCsvRows(SHEET_ID, SHEET_TAB, tqStr);
      }

      aggregated.push(...rows);
    }

    // Zu Map normalisieren
    const out = {};
    for (const r of aggregated) {
      const customerNumber = (r['Kundennummer'] || r['A'] || '').toString().trim();
      if (!customerNumber) continue;
      out[customerNumber] = {
        company: (r['Firma']   || r['B'] || '').toString().trim(),
        street:  (r['Straße']  || r['Strasse'] || r['C'] || '').toString().trim(),
        zip:     (r['PLZ']     || r['D'] || '').toString().trim(),
        city:    (r['Stadt']   || r['E'] || '').toString().trim(),
        // optional, falls du später eine Spalte "Land" ergänzt:
        // country: (r['Land'] || r['F'] || '').toString().trim()
      };
    }

    return res.status(200).json({ addresses: out });
  } catch (err) {
    return res.status(500).json({ error: 'Function crashed', message: err?.message || String(err) });
  }
}

// ---- Helpers ----
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchCsvRows(SHEET_ID, SHEET_TAB, tq) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}&tq=${encodeURIComponent(tq)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    // Bei Rechten/Tab-Problemen frühzeitig sichtbarer Fehler
    const body = await resp.text();
    throw new Error(`Sheet upstream error ${resp.status}: ${body.slice(0,200)}`);
  }
  const csv = await resp.text();
  return parseCsv(csv);
}

function parseCsv(text) {
  // einfacher CSV-Parser für Komma-getrennte Google-CSV (keine eingebetteten Kommas)
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cols = lines[i].split(',').map(c => c.trim());
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
