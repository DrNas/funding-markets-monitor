// Minimal CORS proxy for the Funding Markets Monitor (Cloudflare Worker, free tier is plenty).
// Only the hosts the dashboard uses are allowed, so this can't be used as an open proxy.
const ALLOWED = new Set([
  'api.stlouisfed.org',
  'www.treasurydirect.gov',
  'markets.newyorkfed.org',
  'api.fiscaldata.treasury.gov',
  'data.financialresearch.gov',
  'cms-prod.dtcc.com',      // DTCC GCF Repo Index CSV
  'home.treasury.gov',      // daily par yield curve CSV (fallback for 2y/7y if FRED is down)
]);

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors});
    const target = new URL(request.url).searchParams.get('url');
    let u;
    try { u = new URL(target); } catch (e) { return new Response('missing or bad ?url=', {status: 400, headers: cors}); }
    if (u.protocol !== 'https:' || !ALLOWED.has(u.hostname)) return new Response('host not allowed', {status: 403, headers: cors});
    const upstream = await fetch(u.toString(), {headers: {'User-Agent': 'Mozilla/5.0 (funding-markets-monitor)', 'Accept': '*/*'}});
    const headers = new Headers(upstream.headers);
    for (const k in cors) headers.set(k, cors[k]);
    return new Response(upstream.body, {status: upstream.status, headers});
  },
};
