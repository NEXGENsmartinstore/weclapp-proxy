// /api/weclapp/customers/index.js
//
// Kunden-API für MAP v5
// ---------------------------------------------------------------

const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;

async function weclappFetch(pathAndQuery) {
  const base = WECLAPP_HOST.replace(/\/$/, "");
  const url = `${base}/webapp/api/v1${pathAndQuery}`;
  console.log("→ Customers forward to:", url);

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

export default async function handler(req, res) {
  // --- CORS wie bei /api/weclapp/index.js ---
  const allowed = [
    "https://smart-instore.eu",
    "https://smart-instore.vercel.app",
    "http://localhost:3000",
  ];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

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

    const pathAndQuery =
      `/customer?partyType-eq=ORGANIZATION` +
      `&blocked-eq=false` +
      `&insolvent-eq=false` +
      `&maxResults=500` +
      `&expand=addresses` +
      `&properties=${encodeURIComponent(properties)}`;

    const weclappData = await weclappFetch(pathAndQuery);

    const mapped = weclappData.map((c) => {
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

    const filtered = mapped.filter((item) => {
      if (!tokens.length) return true;
      const hay = (
        `${item.name} ${item.name2} ${item.city} ${item.zip} ` +
        `${item.customerNumber} ${item.salesChannel}`
      ).toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });

    const result = filtered.slice(0, limit);

    res.status(200).json({
      total: filtered.length,
      returned: result.length,
      items: result,
    });
  } catch (err) {
    console.error("customer API error:", err);
    res.status(500).json({ error: err.toString() });
  }
}
