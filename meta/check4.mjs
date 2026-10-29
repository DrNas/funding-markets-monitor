// one-off: DNS and HTTPS state of manasbafna.com (recheck after adding www)
import dns from 'node:dns/promises';
const out = [];
for (const [name, type] of [['manasbafna.com', 'A'], ['manasbafna.com', 'AAAA'], ['manasbafna.com', 'CAA'], ['www.manasbafna.com', 'CNAME'], ['www.manasbafna.com', 'A'], ['funding.manasbafna.com', 'CNAME']]) {
  try { out.push(`${type} ${name}: ${JSON.stringify(await dns.resolve(name, type))}`); } catch (e) { out.push(`${type} ${name}: ${e.code}`); }
}
for (const u of ['http://manasbafna.com/ads.txt', 'https://manasbafna.com/ads.txt', 'https://www.manasbafna.com/', 'http://www.manasbafna.com/', 'https://manasbafna.com/']) {
  try { const r = await fetch(u, {redirect: 'manual'}); out.push(`${u} -> ${r.status} location=${r.headers.get('location')} server=${r.headers.get('server')}`); }
  catch (e) { out.push(`${u} -> ERR ${e.cause ? (e.cause.code || e.cause.message) : e.message}`); }
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
