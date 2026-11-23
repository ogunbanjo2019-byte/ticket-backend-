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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return allowed;
}
function json(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
function log(level, requestId, method, pathname, status, message = '') {
  const entry = { timestamp: new Date().toISOString(), level, requestId, method, path: pathname, status };
  if (message) entry.message = message;
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}
function boundedParam(params, source, target, requestUrl, max = 100) {
  const value = (requestUrl.searchParams.get(source) || '').trim().slice(0, max);
  if (value) params.set(target, value);
}
async function handleLiveEvents(req, res) {
  const apiKey = process.env.TM_API_KEY;
  if (!apiKey) { json(res, 200, { configured: false, events: [], message: 'Provider event discovery is not configured.' }); return true; }
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const countryCode = (requestUrl.searchParams.get('countryCode') || 'US').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'US';
  const requestedSize = Number(requestUrl.searchParams.get('size') || 24);
  const params = new URLSearchParams({ apikey: apiKey, countryCode, size: String(Math.max(1, Math.min(50, Number.isFinite(requestedSize) ? requestedSize : 24))), sort: 'date,asc' });
  boundedParam(params, 'keyword', 'keyword', requestUrl, 120);
  boundedParam(params, 'city', 'city', requestUrl, 80);
  boundedParam(params, 'classificationName', 'classificationName', requestUrl, 80);
  boundedParam(params, 'dmaId', 'dmaId', requestUrl, 30);
  try {
    const upstream = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    const payload = await upstream.json();
    if (!upstream.ok) { json(res, upstream.status, { error: payload?.fault?.faultstring || 'Live event request failed.' }); return true; }
    json(res, 200, { configured: true, events: payload?._embedded?.events || [], page: payload?.page || null, source: 'Ticketmaster Discovery API', inventoryMode: 'event-discovery-only' });
  } catch { json(res, 502, { error: 'Unable to reach the live event provider.' }); }
  return true;
}
function providerStatus() {
  return {
    eventDiscovery: { configured: Boolean(process.env.TM_API_KEY), provider: 'Ticketmaster Discovery API' },
    partnerInventory: { credentialsConfigured: Boolean(process.env.TM_PARTNER_API_KEY), apiFlowIntegrated: false, accessApprovalRequired: true, active: false },
    checkoutAndReservations: { integrated: false, active: false },
    entryValidation: { integrated: false, active: false },
    note: 'Credentials alone do not grant access. Partner APIs require provider approval, agreements, and an implemented authorized transaction flow.'
  };
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
  if (pathname === '/api/provider-status' && req.method === 'GET') return json(res, 200, providerStatus());
  if (pathname === '/api/live-events' && req.method === 'GET') return handleLiveEvents(req, res);
  if (pathname.startsWith('/api/')) {
    try { const handled = await handleApi(req, res, pathname); if (handled) return; }
    catch (error) { log('error', requestId, req.method, pathname, 500, error.message || 'Backend request failed'); return json(res, 500, { error: 'Backend request failed.', requestId }); }
  }
  json(res, 404, { error: 'API route not found.' });
}).listen(port, '0.0.0.0', () => console.log(`Ticketly API listening on ${port}`));
