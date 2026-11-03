// one-off: which EFFR percentile moves the most day to day (excluding Fed rate-change days)
const out = [];
const j = await (await fetch('https://funding.manasbafna.com/data/latest.json?t=' + Date.now())).json();
const E = j.series.effr.data, keys = [['p1', '1st'], ['p25', '25th'], ['rate', 'median (EFFR)'], ['p75', '75th'], ['p99', '99th']];
const stats = (from, to) => {
  const rows = E.filter(r => r.d >= from && r.d <= to);
  const res = {};
  for (const [k] of keys) res[k] = {n: 0, moved: 0, abs: 0, sq: 0, max: 0, maxD: '', up: 0, dn: 0};
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i]; if (a.tf !== b.tf || a.tt !== b.tt) continue;   // skip Fed rate changes
    for (const [k] of keys) {
      if (typeof a[k] !== 'number' || typeof b[k] !== 'number') continue;
      const c = Math.round((b[k] - a[k]) * 1000) / 10, s = res[k];
      s.n++; s.abs += Math.abs(c); s.sq += c * c; if (Math.abs(c) > 0.05) { s.moved++; c > 0 ? s.up++ : s.dn++; }
      if (Math.abs(c) > Math.abs(s.max)) { s.max = c; s.maxD = b.d; }
    }
  }
  out.push(`\n${from} to ${to}`);
  out.push('percentile | days | days it moved | % of days | avg |move| bp | std dev bp | up / down | biggest move (date)');
  for (const [k, l] of keys) { const s = res[k]; if (!s.n) continue;
    out.push(`${l} | ${s.n} | ${s.moved} | ${(100 * s.moved / s.n).toFixed(0)}% | ${(s.abs / s.n).toFixed(2)} | ${Math.sqrt(s.sq / s.n).toFixed(2)} | ${s.up} / ${s.dn} | ${s.max > 0 ? '+' : ''}${s.max.toFixed(0)} (${s.maxD})`); }
};
const last = E[E.length - 1].d;
out.push(`EFFR data ${E[0].d} to ${last}`);
stats(E[0].d, last);
stats('2025-11-01', last);
stats('2026-05-01', last);
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
