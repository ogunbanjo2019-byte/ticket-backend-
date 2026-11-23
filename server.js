import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { handleApi } from './ticket-service.js';
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((origin) => origin.trim());
function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = !origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  if (allowed) res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return allowed;
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function log(level, requestId, method, pathname, status, message = '') {
  const entry = { timestamp: new Date().toISOString(), level, requestId, method, path: pathname, status };
  if (message) entry.message = message;
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}
async function handleLiveEvents(req, res) {
  const apiKey = process.env.TM_API_KEY;
  if (!apiKey) { json(res, 200, { configured: false, events: [], message: 'Provider event discovery is not configured.' }); return true; }
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const params = new URLSearchParams({ apikey: apiKey, countryCode: requestUrl.searchParams.get('countryCode') || 'US', size: requestUrl.searchParams.get('size') || '24', sort: 'date,asc' });
  for (const key of ['keyword', 'city', 'classificationName', 'dmaId']) { const value = requestUrl.searchParams.get(key); if (value) params.set(key, value); }
  try {
    const upstream = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    const payload = await upstream.json();
    if (!upstream.ok) { json(res, upstream.status, { error: payload?.fault?.faultstring || 'Live event request failed.' }); return true; }
    json(res, 200, { configured: true, events: payload?._embedded?.events || [], page: payload?.page || null });
  } catch { json(res, 502, { error: 'Unable to reach the live event provider.' }); }
  return true;
}
createServer(async (req, res) => {
  const requestId = randomUUID();
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const started = Date.now();
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.on('finish', () => log(res.statusCode >= 500 ? 'error' : 'info', requestId, req.method, pathname, res.statusCode, `${Date.now() - started}ms`));
  if (!cors(req, res)) return json(res, 403, { error: 'Origin is not allowed. Configure ALLOWED_ORIGINS on the backend.', requestId });
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'ticketly-api' });
  if (pathname === '/api/live-events' && req.method === 'GET') return handleLiveEvents(req, res);
  if (pathname.startsWith('/api/')) {
    try { const handled = await handleApi(req, res, pathname); if (handled) return; }
    catch (error) { log('error', requestId, req.method, pathname, 500, error.message || 'Backend request failed'); return json(res, 500, { error: 'Backend request failed.', requestId }); }
  }
  json(res, 404, { error: 'API route not found.' });
}).listen(port, '0.0.0.0', () => console.log(`Ticketly API listening on ${port}`));
