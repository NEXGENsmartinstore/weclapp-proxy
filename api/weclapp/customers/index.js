// /api/weclapp/customers/index.js
//
// Kunden-API für MAP v5
// ---------------------------------------------------------------
// Features:
// - Holt Kunden + Adressen aus weclapp
// - Schlagwortsuche "Berlin EMH"
// - maxResults (default 50)
// - Liefert schlanke Map-Daten
// - Noch ohne Geocoding (lat/lng = null)
//
// Erwartete Query-Parameter:
// ?q=Berlin EMH&limit=50
//
// ---------------------------------------------------------------

const WECLAPP_HOST = process.env.WECLAPP_HOST;
const WECLAPP_TOKEN = process.env.WECLAPP_TOKEN;

async function weclappFetch(path) {
  const url = `${WECLAPP_HOST}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "AuthenticationToken": WECLAPP_TOKEN,
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Weclapp API error ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return json.result || json;
}

export default async function handler(req, res) {
  try {
    const q = (req.query.q || "").trim();
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    // Wörter der Suche extrahieren
    const tokens = q
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    // Basis-Abfrage an weclapp
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
      "addresses.deliveryAddress"
    ].join(",");

    const weclappData = await weclappFetch(
      `/customer?partyType-eq=ORGANIZATION&blocked-eq=false&insolvent-eq=false&maxResults=500&expand=addresses&properties=${properties}`
    );

    // Mapping der weclapp-Daten
    const mapped = weclappData.map((c) => {
      // beste Adresse finden
      let addr =
        (c.addresses || []).find((a) => a.primeAddress) ||
        (c.addresses || []).find((a) => a.deliveryAddress) ||
        c.addresses?.[0] ||
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
        lng: null
      };
    });

    // Filter nach Suchbegriffen (AND-Logik)
    const filtered = mapped.filter((item) => {
      if (tokens.length === 0) return true;

      const hay =
        `${item.name} ${item.name2} ${item.city} ${item.zip} ${item.customerNumber} ${item.salesChannel}`
          .toLowerCase();

      return tokens.every((t) => hay.includes(t));
    });

    // Begrenzen
    const result = filtered.slice(0, limit);

    res.status(200).json({
      total: filtered.length,
      returned: result.length,
      items: result
    });
  } catch (err) {
    console.error("customer API error:", err);
    res.status(500).json({ error: err.toString() });
  }
}
