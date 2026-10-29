// one-off: DTCC GCF CSV through the Cloudflare proxy, with and without a cache-busting query
const out = [], PROXY = 'https://black-bush-e1a3.mnsbafna.workers.dev/?url=';
for (const [name, u] of [['DTCC via proxy, ?t=', PROXY + encodeURIComponent('https://cms-prod.dtcc.com/data/gcfindex.csv?t=' + Date.now())], ['DTCC via proxy, plain', PROXY + encodeURIComponent('https://cms-prod.dtcc.com/data/gcfindex.csv')],
  ['DTCC direct, ?t=', 'https://cms-prod.dtcc.com/data/gcfindex.csv?t=' + Date.now()]]) {
  try { const r = await fetch(u); const t = await r.text(); const l = t.trim().split(/\r?\n/); out.push(`${name}: ${r.status} acao=${r.headers.get('access-control-allow-origin')} ctype=${r.headers.get('content-type')} bytes=${t.length}\n  ${l[0].slice(0, 120)}\n  last: ${l.slice(-2).join(' || ').slice(0, 160)}`); }
  catch (e) { out.push(`${name}: ERR ${e.message}`); }
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
