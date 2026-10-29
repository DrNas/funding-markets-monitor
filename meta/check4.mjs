// one-off: what can the AdSense crawler see?
const out = [];
for (const u of ['https://funding.manasbafna.com/ads.txt', 'https://funding.manasbafna.com/', 'https://manasbafna.com/ads.txt', 'https://manasbafna.com/', 'https://www.manasbafna.com/', 'http://manasbafna.com/ads.txt']) {
  try { const r = await fetch(u, {redirect: 'follow', headers: {'User-Agent': 'Mozilla/5.0 (compatible; Mediapartners-Google)'}}); const t = await r.text();
    out.push(`${u} -> ${r.status} final=${r.url} bytes=${t.length} hasPub=${t.includes('2104381144893771')} server=${r.headers.get('server')}\n  ${t.slice(0, 160).replace(/\s+/g, ' ')}`); }
  catch (e) { out.push(`${u} -> ERR ${e.cause ? e.cause.code || e.cause.message : e.message}`); }
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
