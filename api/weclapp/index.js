// /api/weclapp/index.js
//
// Allgemeiner Proxy + Spezialfall "customers-v5" für MAP v5
// ---------------------------------------------------------------

const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;

async function weclappFetch(pathAndQuery) {
  const base = WECLAPP_HOST.replace(/\/$/, "");
  const url = `${base}/webapp/api/v1${pathAndQuery}`;
  console.log("→ weclapp forward to:", url);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      AuthenticationToken: WECLAPP_TOKEN,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Weclapp API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.result || json;
}
async function weclappFetchV2(pathAndQuery) {
  const base = WECLAPP_HOST.replace(/\/$/, "");
  const url = `${base}/webapp/api/v2${pathAndQuery}`;
  console.log("→ weclapp forward to (v2):", url);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      AuthenticationToken: WECLAPP_TOKEN,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Weclapp API v2 error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  // v2 liefert ebenfalls { result: [...] } + Meta
  return json.result || json;
}

export default async function handler(req, res) {
  // --- CORS ---
  const allowed = [
    "https://smart-instore.eu",
    "https://smart-instore.vercel.app",
    "http://localhost:3000",
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { path = "", ...params } = req.query;

    // -----------------------------------------------------------
    // SPEZIALFALL: v5-Kunden-API ("customers-v5") - v1 + page/pageSize
    // -----------------------------------------------------------
    if (path === "customers-v5") {
      const q = (params.q || "").trim();

      // limit: 0 oder nicht gesetzt => "kein Limit" (alle laden)
      const rawLimit = parseInt(params.limit ?? "0", 10);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(rawLimit, 5000)
          : 0;
      const unlimited = !limit;

      const tokens = q
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      const properties = [
        "id",
        "customerNumber",
        "company",
        "company2",
        "salesChannel",
        "phone",
        "email",
        "website",
        "parentPartyId",
        "primaryAddressId",
        "deliveryAddressId",
        "lastModifiedDate",
        "addresses.id",
        "addresses.street1",
        "addresses.zipcode",
        "addresses.city",
        "addresses.countryCode",
        "addresses.primeAddress",
        "addresses.deliveryAddress",
      ].join(",");

      const PAGE_SIZE = 1000; // wie im Postman-Test
      const MAX_PAGES = 10;   // 10 * 1000 = 10.000 Kunden

      let page = 1;
      let totalMatches = 0;
      const items = [];

      while (page <= MAX_PAGES) {
        const pathAndQuery =
          `/customer?page=${page}` +
          `&pageSize=${PAGE_SIZE}` +
          `&partyType-eq=ORGANIZATION` +
          `&blocked-eq=false` +
          `&insolvent-eq=false` +
          `&expand=addresses` +
          `&properties=${encodeURIComponent(properties)}`;

        const chunk = await weclappFetch(pathAndQuery);
        if (!Array.isArray(chunk) || !chunk.length) {
          // keine Daten mehr -> Ende der Pagination
          break;
        }

        const mapped = chunk.map((c) => {
          const addresses = c.addresses || [];
          const addr =
            addresses.find((a) => a.primeAddress) ||
            addresses.find((a) => a.deliveryAddress) ||
            addresses[0] ||
            null;

          return {
            id: c.id,
            customerNumber: c.customerNumber,
            name: c.company || "",
            name2: c.company2 || "",
            salesChannel: c.salesChannel || "",
            street: addr?.street1 || "",
            zip: (addr?.zipcode || "").trim(),
            city: addr?.city || "",
            countryCode: addr?.countryCode || "DE",
            lat: null,
            lng: null,
          };
        });

        for (const item of mapped) {
          if (tokens.length) {
            const hay = (
              `${item.name} ${item.name2} ${item.city} ${item.zip} ` +
              `${item.customerNumber} ${item.salesChannel}`
            ).toLowerCase();
            if (!tokens.every((t) => hay.includes(t))) {
              continue;
            }
          }

          totalMatches++;

          if (unlimited || items.length < limit) {
            items.push(item);
          }
        }

        // Limit erreicht? Dann können wir die Pagination abbrechen
        if (!unlimited && items.length >= limit) {
          break;
        }

        // Wenn weniger als PAGE_SIZE zurückkommen, sind wir auf der letzten Seite
        if (chunk.length < PAGE_SIZE) {
          break;
        }

        page += 1;
      }

      return res.status(200).json({
        total: totalMatches,    // Treffer gesamt (über alle Seiten)
        returned: items.length, // tatsächlich zurückgelieferte Items
        items,
      });
    }



    // -----------------------------------------------------------
    // STANDARD-PROXY (v4 & alles andere)
    // -----------------------------------------------------------
    const queryString = new URLSearchParams(params).toString();
    const host = WECLAPP_HOST;
    const token = WECLAPP_TOKEN;

    const url = `${host.replace(/\/$/, "")}/webapp/api/v1/${path}${
      queryString ? "?" + queryString : ""
    }`;
    console.log("→ Forward to:", url);

    const upstream = await fetch(url, {
      method: "GET",
      headers: {
        AuthenticationToken: token,
        Accept: "application/json",
      },
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy crashed", message: err.message });
  }
}
