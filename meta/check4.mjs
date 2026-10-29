// one-off (rerun): why does live mode get 403 from FRED through the Cloudflare proxy?
const out = [], KEY = 'e7482280d903251793be8ef678d3b6d0', PROXY = 'https://black-bush-e1a3.mnsbafna.workers.dev/?url=';
const fred = `https://api.stlouisfed.org/fred/series/observations?series_id=IORB&api_key=${KEY}&file_type=json&sort_order=desc&limit=2`;
const yc = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv';
const tries = [['FRED direct, browser UA', fred, {'User-Agent': 'Mozilla/5.0'}], ['FRED via proxy', PROXY + encodeURIComponent(fred), {}],
  ['Treasury curve via proxy', PROXY + encodeURIComponent(yc), {}], ['NY Fed via proxy (control)', PROXY + encodeURIComponent('https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json'), {}]];
for (const [name, u, h] of tries) {
  try { const r = await fetch(u, {headers: h}); const t = await r.text(); out.push(`${name}: ${r.status} server=${r.headers.get('server')} cf-ray=${r.headers.get('cf-ray')}\n  ${t.slice(0, 300).replace(/\s+/g, ' ')}`); }
  catch (e) { out.push(`${name}: ERR ${e.message}`); }
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
