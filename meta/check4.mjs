// one-off: recent EFFR upticks and the SOFR − EFFR spread around them (from the published daily snapshot)
const out = [];
const j = await (await fetch('https://funding.manasbafna.com/data/latest.json?t=' + Date.now())).json();
const S = j.series, sofr = new Map(S.sofr.data.map(r => [r.d, r])), effr = S.effr.data.filter(r => typeof r.rate === 'number');
out.push(`snapshot ${j.generated}; EFFR through ${effr[effr.length - 1].d}, SOFR through ${S.sofr.latest}`);
const bp = v => (v >= 0 ? '+' : '') + v.toFixed(1);
const ups = [];
for (let i = 1; i < effr.length; i++) {
  const a = effr[i - 1], b = effr[i];
  if (b.rate > a.rate + 1e-9) ups.push({i, prev: a, cur: b, policy: b.tf !== a.tf || b.tt !== a.tt});
}
out.push(`EFFR upticks in the data: ${ups.length} (of which ${ups.filter(u => u.policy).length} on Fed rate changes)`);
out.push('Most recent upticks, excluding Fed rate changes (date | EFFR prev → new | SOFR prev / new | SOFR−EFFR day before | on the day | target range):');
for (const u of ups.filter(u => !u.policy).slice(-8).reverse()) {
  const sp = sofr.get(u.prev.d), sc = sofr.get(u.cur.d);
  out.push(`  ${u.cur.d} | ${u.prev.rate.toFixed(2)} (${u.prev.d}) → ${u.cur.rate.toFixed(2)} | ${sp ? sp.rate.toFixed(2) : '—'} / ${sc ? sc.rate.toFixed(2) : '—'} | ${sp ? bp((sp.rate - u.prev.rate) * 100) : '—'} bp | ${sc ? bp((sc.rate - u.cur.rate) * 100) : '—'} bp | ${u.cur.tf}–${u.cur.tt}`);
}
out.push('Most recent Fed-rate-change upticks:');
for (const u of ups.filter(u => u.policy).slice(-3).reverse()) out.push(`  ${u.cur.d} | ${u.prev.rate.toFixed(2)} → ${u.cur.rate.toFixed(2)} | range ${u.prev.tf}–${u.prev.tt} → ${u.cur.tf}–${u.cur.tt}`);
out.push('Last 12 fixings (date | EFFR | SOFR | SOFR−EFFR):');
for (const r of effr.slice(-12)) { const s = sofr.get(r.d); out.push(`  ${r.d} | ${r.rate.toFixed(2)} | ${s ? s.rate.toFixed(2) : '—'} | ${s ? bp((s.rate - r.rate) * 100) : '—'}`); }
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
