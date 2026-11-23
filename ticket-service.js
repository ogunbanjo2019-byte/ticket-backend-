function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}
export async function handleApi(req, res, pathname) {
  if (pathname === '/api/tickets' && req.method === 'POST') {
    json(res, 410, { error: 'Ticket checkout and issuance are handled by the official ticket provider. Save ticket details in My Tickets in the frontend.' });
    return true;
  }
  return false;
}
