export default function handler(req, res) {
  res.json({ message: 'Middleware-Test', headers: req.headers.origin || 'none' });
}
