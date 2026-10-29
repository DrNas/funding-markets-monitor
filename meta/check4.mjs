// one-off: what does the published snapshot contain?
const out = [];
for (const base of ['https://funding.manasbafna.com/', 'https://drnas.github.io/funding-markets-monitor/']) {
  try {
    const r = await fetch(base + 'data/latest.json?t=' + Date.now()); out.push(`${base} -> ${r.status} final=${r.url}`);
    if (!r.ok) continue; const j = await r.json();
    out.push(`generated ${j.generated} failed=[${j.failed}]`);
    for (const [id, s] of Object.entries(j.series)) out.push(`  ${id}: ${s.state} n=${s.n} latest=${s.latest} dataRows=${Array.isArray(s.data) ? s.data.length : typeof s.data} last=${Array.isArray(s.data) && s.data.length ? JSON.stringify(s.data[s.data.length - 1]).slice(0, 120) : ''}`);
    break;
  } catch (e) { out.push(base + ' ERR ' + e.message); }
}
(await import('node:fs')).writeFileSync('meta/check4.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
