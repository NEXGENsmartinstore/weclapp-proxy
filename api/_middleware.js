// /api/weclapp/_middleware.js
export function middleware(req, ev) {
  const origin = req.headers.get('origin');
  const allowed = [
    'https://smart-instore.eu',
    'https://smart-instore.vercel.app',
    'http://localhost:3000'
  ];
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });

  if (allowed.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  return new Response(null, { headers });
}
