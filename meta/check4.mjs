// one-off: which EFFR percentile (or SOFR − EFFR) leads a non-policy uptick in EFFR (the median)?
const out = [];
const j = await (await fetch('https://funding.manasbafna.com/data/latest.json?t=' + Date.now())).json();
const E = j.series.effr.data.filter(r => typeof r.rate === 'number'), sofr = new Map(j.series.sofr.data.map(r => [r.d, r.rate]));
const bp = x => Math.round(x * 1000) / 10;
// day t: same target range as t-1 and as the previous 5 days (so lookbacks don't straddle a Fed move)
const ok = i => i >= 6 && E.slice(i - 6, i + 1).every(r => r.tf === E[i].tf && r.tt === E[i].tt);
const up = i => E[i].rate > E[i - 1].rate + 1e-9;
const idx = []; for (let i = 6; i < E.length; i++) if (ok(i)) idx.push(i);
const base = idx.filter(up).length / idx.length;
out.push(`EFFR ${E[0].d}..${E[E.length - 1].d}; usable days ${idx.length}; non-policy EFFR upticks ${idx.filter(up).length}; base rate ${(100 * base).toFixed(1)}% per day`);

// 1) signal = percentile rose over the previous L days (t-L-1 -> t-1); outcome = EFFR up on day t
out.push('\n1) If a percentile ROSE over the last L days, how often does EFFR tick up the next day? (hit rate, vs base rate; n = signal days; caught = share of upticks it flagged)');
for (const [k, l] of [['p1', '1st'], ['p25', '25th'], ['p75', '75th'], ['p99', '99th']]) {
  const parts = [];
  for (const L of [1, 3, 5]) {
    const sig = idx.filter(i => typeof E[i - 1][k] === 'number' && typeof E[i - 1 - L][k] === 'number' && E[i - 1][k] > E[i - 1 - L][k] + 1e-9);
    const hits = sig.filter(up).length, all = idx.filter(up).length;
    parts.push(`L=${L}: ${(100 * hits / (sig.length || 1)).toFixed(0)}% (n=${sig.length}, ${(hits / (sig.length || 1) / base).toFixed(1)}x base, caught ${hits}/${all})`);
  }
  out.push(`  ${l}: ` + parts.join(' | '));
}
// 2) gap levels the day before: percentile − median
out.push('\n2) Gap vs EFFR the day before (bp): average before upticks vs all days; hit rate when gap >= threshold');
for (const [k, l] of [['p25', '25th − EFFR'], ['p75', '75th − EFFR'], ['p99', '99th − EFFR']]) {
  const g = i => typeof E[i - 1][k] === 'number' ? bp(E[i - 1][k] - E[i - 1].rate) : null;
  const all = idx.map(g).filter(v => v != null), bef = idx.filter(up).map(g).filter(v => v != null), avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const ths = k === 'p25' ? [0, 1] : k === 'p75' ? [1, 2, 3] : [5, 8, 10, 15];
  out.push(`  ${l}: avg before upticks ${avg(bef).toFixed(2)} vs all days ${avg(all).toFixed(2)} | ` + ths.map(t => { const s = idx.filter(i => g(i) != null && g(i) >= t); const h = s.filter(up).length; return `>=${t}: ${(100 * h / (s.length || 1)).toFixed(0)}% (n=${s.length}, caught ${h})`; }).join(' | '));
}
// 3) SOFR − EFFR the day before
{
  const g = i => sofr.has(E[i - 1].d) ? bp(sofr.get(E[i - 1].d) - E[i - 1].rate) : null;
  const all = idx.map(g).filter(v => v != null), bef = idx.filter(up).map(g).filter(v => v != null), avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  out.push(`  SOFR − EFFR: avg before upticks ${avg(bef).toFixed(2)} vs all days ${avg(all).toFixed(2)} | ` + [0, 5, 10, 15].map(t => { const s = idx.filter(i => g(i) != null && g(i) >= t); const h = s.filter(up).length; return `>=${t}: ${(100 * h / (s.length || 1)).toFixed(0)}% (n=${s.length}, caught ${h})`; }).join(' | '));
}
// 4) the upticks themselves: distribution on the day before and on the day
out.push('\n3) Each non-policy uptick: day before → day of (1st / 25th / EFFR / 75th / 99th; SOFR−EFFR)');
for (const i of idx.filter(up)) { const a = E[i - 1], b = E[i], f = r => [r.p1, r.p25, r.rate, r.p75, r.p99].map(v => typeof v === 'number' ? v.toFixed(2) : '—').join(' / ');
  const s = sofr.has(a.d) ? bp(sofr.get(a.d) - a.rate) : '—';
  out.push(`  ${b.d}: ${f(a)}  →  ${f(b)}   | SOFR−EFFR before ${s}`); }
// current state
const L = E[E.length - 1], P = E[E.length - 2];
out.push(`\nLatest ${L.d}: 1st ${L.p1} / 25th ${L.p25} / EFFR ${L.rate} / 75th ${L.p75} / 99th ${L.p99}; prev ${P.d}: ${P.p1} / ${P.p25} / ${P.rate} / ${P.p75} / ${P.p99}; SOFR−EFFR ${sofr.has(L.d) ? bp(sofr.get(L.d) - L.rate) : '—'}`);
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
