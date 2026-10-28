// Builds the daily data snapshot for the dashboard. It runs the page's own data layer (the <script id="data-layer">
// block in index.html) in Node, so the hosted numbers are exactly what the page computes when it fetches live.
// Output: _site/index.html, _site/data/latest.json, and data/dtcc-gcf-history.csv (DTCC only publishes ~12 months,
// so every day it sees is kept in this archive and merged back into the snapshot).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES_URL = process.env.PAGES_URL || 'https://drnas.github.io/funding-markets-monitor/';
const ARCHIVE = path.join(ROOT, 'data/dtcc-gcf-history.csv');
const ARCHIVE_COLS = [['date', 'd'], ['tsy_rate', 'v'], ['tsy_vol_bn', 'vol'], ['mbs_rate', 'mbs'], ['mbs_vol_bn', 'mbsvol']];
const CORE = ['sofr', 'effr'];   // without these the snapshot is useless: fail the build instead of publishing it

function runDataLayer(html, fetchImpl) {
  const m = /<script id="data-layer">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('<script id="data-layer"> not found in index.html');
  const f = (u, o = {}) => fetchImpl(u, {...o, headers: {'User-Agent': 'Mozilla/5.0 (funding-markets-monitor daily build)', Accept: '*/*', ...(o.headers || {})}});
  const noop = () => {};
  // renderStrip/scheduleRender are UI hooks the data layer calls after each series loads
  return new Function('fetch', 'renderStrip', 'scheduleRender', m[1] + '\nreturn {DATA, STATUS, P, CFG, loadAll, START, TODAY};')(f, noop, noop);
}

const parseArchive = csv => {
  const out = new Map();
  for (const line of (csv || '').split(/\r?\n/).slice(1)) {
    const c = line.split(','); if (!/^\d{4}-\d\d-\d\d$/.test(c[0] || '')) continue;
    const r = {}; ARCHIVE_COLS.forEach(([, k], i) => { r[k] = i ? (c[i] === '' || c[i] == null ? null : +c[i]) : c[i]; }); out.set(r.d, r);
  }
  return out;
};
const toArchive = rows => [ARCHIVE_COLS.map(c => c[0]).join(',')].concat(rows.map(r => ARCHIVE_COLS.map(([, k]) => r[k] == null || Number.isNaN(r[k]) ? '' : r[k]).join(','))).join('\n') + '\n';

export async function build({fetchImpl = fetch, fredKey = '', prev = null, archiveCsv = '', html} = {}) {
  const api = runDataLayer(html, fetchImpl);
  api.CFG.key = fredKey; api.CFG.proxy = '';   // no CORS on a server: every source is fetched directly
  api.loadAll(true);
  await Promise.allSettled(Object.values(api.P));
  const generated = new Date().toISOString(), series = {}, failed = [];
  for (const [id, S] of Object.entries(api.STATUS)) {
    const old = prev && prev.series && prev.series[id];
    const pack = data => ({label: S.label, state: S.state, n: S.n, latest: S.latest, src: S.src || '', fb: !!S.fb, note: S.note || '', built: generated, data});
    if (S.state === 'OK') { series[id] = pack(api.DATA[id]); continue; }
    failed.push(id);
    series[id] = old && old.data ? {...old, state: 'CACHED', note: `today's fetch failed (${S.note}); showing the copy built ${old.built || prev.generated}`} : pack(api.DATA[id] ?? null);
  }
  // DTCC: merge today's file into the archive (newer values win), and publish the full history
  const arch = parseArchive(archiveCsv);
  for (const r of (series.dtcc && Array.isArray(series.dtcc.data) ? series.dtcc.data : [])) arch.set(r.d, r);
  const rows = [...arch.values()].sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  if (rows.length && series.dtcc) Object.assign(series.dtcc, {data: rows, n: rows.length, latest: rows[rows.length - 1].d,
    note: (series.dtcc.note ? series.dtcc.note + ' · ' : '') + `includes the daily archive kept since ${rows[0].d}`});
  return {snapshot: {generated, today: api.TODAY, start: api.START, failed, series}, archiveCsv: rows.length ? toArchive(rows) : archiveCsv};
}

const api_note = s => s ? s.note : '';

async function main() {
  let prev = null;
  try { const r = await fetch(PAGES_URL + 'data/latest.json?t=' + Date.now()); if (r.ok) prev = await r.json(); } catch (e) {}
  console.log(prev ? `previous snapshot: ${prev.generated}` : 'no previous snapshot (first run?)');
  if (!process.env.FRED_API_KEY) console.log('::warning::FRED_API_KEY secret is not set (or empty): FRED series will fail. Add it under Settings > Secrets and variables > Actions.');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const archiveCsv = fs.existsSync(ARCHIVE) ? fs.readFileSync(ARCHIVE, 'utf8') : '';
  const fredKey = (process.env.FRED_API_KEY || '').trim().replace(/^["']|["']$/g, '');   // tolerate a pasted newline or quotes
  if (fredKey && !/^[a-z0-9]{32}$/.test(fredKey)) console.log(`::warning::FRED_API_KEY doesn't look like a FRED key (expected 32 lowercase letters/digits, got ${fredKey.length} characters).`);
  const {snapshot, archiveCsv: newCsv} = await build({fredKey, prev, archiveCsv, html});

  const lines = Object.entries(snapshot.series).map(([id, s]) => `| ${id} | ${s.state}${s.fb ? ' (fallback)' : ''} | ${s.n} | ${s.latest || ''} | ${(s.note || '').replace(/\|/g, '/').slice(0, 160)} |`);
  const summary = `### Data snapshot ${snapshot.generated}\n\n| series | state | rows | latest | note |\n|---|---|---|---|---|\n${lines.join('\n')}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  const missing = CORE.filter(id => !snapshot.series[id] || !Array.isArray(snapshot.series[id].data) || !snapshot.series[id].data.length);
  if (missing.length) { console.error('core series missing, not publishing: ' + missing.join(', ')); process.exit(1); }

  const site = path.join(ROOT, '_site');
  fs.mkdirSync(path.join(site, 'data'), {recursive: true});
  fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(site, 'index.html'));
  fs.writeFileSync(path.join(site, 'data/latest.json'), JSON.stringify(snapshot));
  fs.mkdirSync(path.dirname(ARCHIVE), {recursive: true});
  fs.writeFileSync(ARCHIVE, newCsv);
  fs.copyFileSync(ARCHIVE, path.join(site, 'data/dtcc-gcf-history.csv'));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `failed=${snapshot.failed.join(' ')}\n`);
  // one annotation per failed series, so the reason shows on the run page without opening the log
  for (const id of snapshot.failed) console.log(`::error title=${id} failed::${(api_note(snapshot.series[id]) || 'no detail').replace(/\r?\n/g, ' ').slice(0, 400)}`);
  console.log(`wrote _site/data/latest.json (${(fs.statSync(path.join(site, 'data/latest.json')).size / 1e6).toFixed(1)} MB); failed today: ${snapshot.failed.join(', ') || 'none'}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e); process.exit(1); });
