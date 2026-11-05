// one-off: has SOFR ever printed above the DTCC GCF Treasury index (and above OFR's GCF Treasury rate)?
const out = [];
const j = await (await fetch('https://funding.manasbafna.com/data/latest.json?t=' + Date.now())).json();
const sofr = new Map(j.series.sofr.data.filter(r => typeof r.rate === 'number').map(r => [r.d, r]));
const bp = x => Math.round(x * 1000) / 10;
for (const [id, key, name] of [['dtcc', 'v', 'DTCC GCF Treasury index'], ['gcf_ofr', 'v', 'OFR GCF Treasury (prelim)']]) {
  const rows = (j.series[id].data || []).filter(r => typeof r[key] === 'number' && sofr.has(r.d)).map(r => ({d: r.d, g: r[key], s: sofr.get(r.d).rate, s99: sofr.get(r.d).p99, sp: bp(sofr.get(r.d).rate - r[key])}));
  if (!rows.length) { out.push(`${name}: no overlap`); continue; }
  const above = rows.filter(r => r.sp > 0), eq = rows.filter(r => r.sp === 0), sorted = rows.map(r => r.sp).sort((a, b) => a - b);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  out.push(`\n${name}: ${rows[0].d} .. ${rows[rows.length - 1].d}, ${rows.length} common days`);
  out.push(`  SOFR above GCF: ${above.length} days (${(100 * above.length / rows.length).toFixed(1)}%) · equal: ${eq.length} · below: ${rows.length - above.length - eq.length}`);
  out.push(`  SOFR − GCF (bp): min ${sorted[0]} · 10th ${q(.1)} · median ${q(.5)} · 90th ${q(.9)} · max ${sorted[sorted.length - 1]}`);
  if (above.length) {
    out.push('  Days SOFR > GCF (most recent first, up to 40): date | SOFR | GCF | SOFR−GCF bp');
    for (const r of above.slice(-40).reverse()) out.push(`    ${r.d} | ${r.s.toFixed(2)} | ${r.g.toFixed(3)} | +${r.sp.toFixed(1)}`);
    const byYear = {}; for (const r of above) byYear[r.d.slice(0, 4)] = (byYear[r.d.slice(0, 4)] || 0) + 1;
    out.push('  By year: ' + Object.entries(byYear).map(([y, n]) => `${y}: ${n}`).join(' · '));
  }
  out.push('  Last 10 days: ' + rows.slice(-10).map(r => `${r.d.slice(5)} ${r.sp > 0 ? '+' : ''}${r.sp.toFixed(1)}`).join(' | '));
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
