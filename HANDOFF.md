# Funding Markets Monitor — handoff

## What this is
`index.html` (formerly `funding-markets-monitor.html`) is a single self-contained HTML dashboard (Chart.js 4.4.1 from cdnjs, a small inline UTC date adapter, no backend). It fetches live data in the browser on every open and renders five sections. It is opened locally, not published as a hosted page (hosted pages block the external API calls). Nothing is hard-coded or interpolated: a chart with no data shows "no data – see status".

`cors-proxy-worker.js` is a Cloudflare Worker CORS proxy (allowlisted hosts only). The user has deployed it; its URL is baked into `PROXY_BASE` at the top of the HTML (`?url=` style). The FRED key is in `FRED_API_KEY` in the same block. Both can be overridden from the in-page Settings panel (saved to localStorage).

## Today, Fed balance sheet, markers, DVP
- **Today** (`s0`, top of the dashboard, `drawToday()`): boxes of Table-view metric ids (`TODAY_BOXES`). `todayStat()` takes the latest print on the series' own dates, Δ vs the previous print and vs the print a week earlier (rates in bp). Weekly series (`WEEKLY`) show the week-on-week change only. The calendar box shows the next settlement (`computeNI`), this month's SR1−ZQ, and the next month-end/quarter-end/tax date/GSE window/FOMC.
- **6 · Fed balance sheet and reserves** (`s13`): NY Fed `soma/summary.json` (weekly holdings by type, $) → weekly change stacked. `resDrivers()` uses H.4.1 Wednesday levels from FRED (`H41_SERIES`: WALCL, WSHOSHO, WRBWFRBL, WLRRAL) plus the DTS TGA close: Δreserves = Δsecurities + Δother assets − ΔTGA − Δreverse repos − residual (mostly currency). Summary table for 1/4/13 weeks.
- **Calendar markers** (`calEvents()`, `evt` plugin, header "markers" toggle → `OPT.mk`): month-ends, quarter-ends, FOMC decision days (`FOMC`, hard-coded: **add each new year**), tax dates (Apr/Jun/Sep/Dec 15), mid-month coupon settlement (15th), and shaded GSE windows. Drawn on every date-axis chart.
- **Month-end and quarter-end** (Analysis, `s14`, `meRows()`): last business day vs the 5 fixings before it; measures in `ME_MEAS` (rate − EFFR, its Δ, 99th − median, − IORB, rate Δ, SRF, ON RRP and its Δ).
- **DVP** (`dvp`): OFR `REPO-DVP_AR_OO-P` (rate) and `REPO-DVP_TV_OO-P` (volume, $ → bn). Table bases `DVP`, `DVPVOL`; spreads vs SOFR/GCO/TGCR/IORB.
- Dashboard section titles were renumbered: Fed balance sheet is 6, so the old 6–9 are now 7–10 (ids unchanged).

## Analysis view (`#analysis`, header switch)
Sections with `view: 'analysis'` render into `#analysispage` (same card, range and control machinery as the dashboard).
- **10 · GSE cash week** (`gseRows()`): for each month, the window is the fixing dates from `OPT.gStart` (18th) up to the day before `OPT.gPay` (25th), both rolled forward to a business day. The baseline is the 5 fixings before the window. Per month it computes: average rate, Δ vs the week before, EFFR average, rate − EFFR (window and week before) and its Δ, and rate − IORB. Controls: rate (SOFR/TGCR/BGCR), measure, month (chart by year), year (chart by month), window days. A year × month heat grid and a table of every month sit below.
- **11 · Bills vs SOFR**: FRED DGS1MO/DGS3MO (Treasury curve '1 Mo'/'3 Mo' fallback) × 360/365 to a money-market basis, minus SOFR.
- **12 · Primary dealers**: NY Fed `/api/pd/get/<key>.json` returns the full history across series breaks (from 2013). Keys are in `PD_KEYS` (net positions by maturity, Treasury repo/reverse repo, $mn → $bn). Note the July 2024 series break.
- Table view gains 1m/3m bill and dealer bases, plus bill − SOFR/RRP spreads.

## Daily snapshot (GitHub Actions + Pages)
- `.github/workflows/daily-data.yml` runs on weekdays at ~9:17am and ~5:47pm New York, on "Run workflow", and on pushes to main that touch the page or scripts.
- `scripts/build-data.mjs` runs the page's own `<script id="data-layer">` block in Node (via `new Function`, with the UI hooks stubbed). It fetches every source directly (no proxy needed on a server, FRED key from the `FRED_API_KEY` secret) and writes `_site/data/latest.json` = `{generated, today, start, failed, series: {id: {label, state, n, latest, src, fb, note, built, data}}}`. The site is deployed to Pages from that artifact, so nothing is committed daily except the DTCC archive.
- If a series fails, the previous snapshot's copy is kept (state CACHED), and the job ends red so GitHub emails the owner. If SOFR or EFFR is missing, nothing is published.
- `data/dtcc-gcf-history.csv` archives every DTCC GCF day seen (DTCC publishes only ~12 months), merged into the snapshot.
- The header's **Live | Cached** switch (`CFG.src`, saved as `fmm_src`; default Live) picks live fetching or the snapshot. The FRED key and proxy are fixed in the CONFIG block (no settings panel). In Cached mode the page loads the snapshot first. It falls back to live fetching if the file is missing or older than `SNAPSHOT_MAX_AGE_D` (4 days). "Live from each source" mode uses `FRED_API_KEY` in the HTML (public, at the owner's request), or a key saved in Settings.
- Keep the data layer free of DOM access (`document`, `getComputedStyle`, Chart) at top level, or the build breaks.

1. **Net issuance** (settlement-date bars for 50 days, monthly bars, table of announced auctions)
2. **Overnight rates vs the corridor** (SOFR/TGCR/EFFR vs SRF-top, IORB, RRP; SOFR percentile bands; DTCC GCF Treasury index)
3. **Spreads** (3x3: SOFR-RRP, SOFR-IORB, EFFR-IORB, SOFR-EFFR with 7d/30d calendar-day averages, TGCR-RRP, TGCR-SOFR, BGCR-TGCR, GCF-SOFR (OFR + implied), DTCC GCF Treasury-SOFR)
4. **Dispersion** (75th-25th, 99th-median)
5. **Liquidity** (reserves, reserves/GDP, ON RRP, TGA, SRF, repo volumes with 30d averages)
6. **Monthly net issuance — history** (`ni_hist`): month-end change in marketable debt outstanding by class (bills, notes, bonds, TIPS, FRNs; FFB excluded) from FiscalData MSPD table 1 (`mspdNet()`), 5 years fetched, own 1Y/2Y/3Y/5Y buttons (not driven by the header). Includes SOMA; current month appears only after MSPD publishes (~4th business day).
7. **GC vs IORB**: GCF − SOFR, SOFR (median/75th/99th) − IORB, GC − IORB with days ≥ threshold marked and SOFR ringed, a scatter (x = GC − IORB, y = SOFR − IORB), and a table of every flagged day. Section controls pick the GC series (DTCC GCF / OFR GCF / TGCR) and threshold (default 2 bp); saved in localStorage `fmm_opt`.
8. **2y and 7y Treasuries**: yield levels (+ 7s2s on the right axis), monthly net move (month-end to month-end, current month MTD), daily move bars for each tenor, and a last-20-sessions table. Toggle Yield (bp) / Price: price = a constant-maturity par bond at the prior close repriced at the new yield (`bondPx`), no carry or roll-down. Data: FRED DGS2/DGS7, falling back to Treasury's daily par yield curve CSV (home.treasury.gov, via the proxy). Yahoo Finance was not used: it has no 2y/7y yield tickers and blocks browser requests.

Sections 2-5 have their own 3M/6M/1Y/2Y buttons plus a custom "from" date; header buttons set all at once. Data fetch window is ~760 days. A Data status strip shows each series as OK / OK via fallback / CACHED / BLOCKED (CORS) / FAILED / EMPTY.
9. **SR1 − ZQ expiries** (`sr1zq()`, `expStats()`): for each contract month, the SOFR and EFFR fixing in force on every calendar day (Friday's covers weekends/holidays), averaged; SR1/ZQ = 100 − average rounded to 3dp (`r3`, Excel ROUND semantics); Exp = SR1 − ZQ in bp = (EFFR avg − SOFR avg) × 100, shown both unrounded and at settlement rounding. Current month: unfixed days use the section's "rest of month" SOFR/EFFR inputs (blank = carry the last fixing). Bar chart, monthly table, and a clickable daily breakdown. Checked against the user's spreadsheet example (96.3843 / 96.3719 / 1.239 unrounded; 96.384 / 96.372 / 1.200 settled).


## Table view (`#table`, header switch "Dashboard | Table")
A daily table like the user's spreadsheet. Newest first, `Days` business days back from `End date`, with Average/Min/Max rows at the bottom and an Excel-style red–white–blue heat map per column (min / median / max of the window).
- Each column header is a dropdown of every metric: spreads (`SPREADS`), custom spreads, SR1−ZQ expiry and month to date, rates and volumes (`BASES`). Metric ids are `L:<code>` (level), `S:<a>:<b>` (spread in bp) and `X:SR1` / `X:SR1MTD`.
- "Custom spread A − B" adds any rate pair as a new column and keeps it in the dropdowns.
- The Dash chart plots the ticked columns on the left or right axis, plus SR1−ZQ expiry as a dashed step (the current month uses the section 9 projection). Chips above list each contract month in the window.
- "Download CSV" exports the table. The layout is saved in localStorage `fmm_tbl`.
- The fetch window `START` is now ~2000 days so the table can go back to ~2021. DTCC GCF (GCO) is ~12 months only; use GCF (OFR) further back.

## Data sources and what works from a browser
| Source | Works directly? | Notes |
|---|---|---|
| NY Fed markets API (rates, RRP, SRF, SOMA) | yes | |
| Treasury FiscalData (TGA, auctions_query) | yes | Cloudflare proxy gets HTTP 525 for this host, so it must NOT go through the worker |
| OFR short-term funding monitor | yes | GCF Treasury series found by searching metadata: `REPO-GCF_AR_T-P` (preliminary) |
| FRED (IORB, DFEDTARL/U, WRESBAL, GDP, RRPONTSYD) | no CORS | goes through the proxy. WRESBAL is $ millions (divided by 1000) |
| TreasuryDirect auctions | no CORS | goes through the proxy; falls back to FiscalData `auctions_query` (same fields) if that fails |
| DTCC GCF Repo Index `https://cms-prod.dtcc.com/data/gcfindex.csv` | no CORS | goes through the proxy; ~12 months only; Treasury and MBS columns (MBS not used) |
| FiscalData MSPD table 1 | yes | monthly issuance history |
| Treasury daily par yield curve CSV (home.treasury.gov) | no CORS | proxy; fallback for 2y/7y only. Needs the worker redeployed with `home.treasury.gov` in ALLOWED |

`PROXY_HOSTS` in the script lists hosts sent through the proxy first; other hosts are tried directly and retried via the proxy only on a network/CORS error. Fallbacks: RRP floor/SRF top from the NY Fed EFFR target range (`targetRateFrom/To`) if FRED is down; ON RRP take-up from NY Fed RRP ops. IORB, reserves and GDP have no fallback.

## Net issuance method (`computeNI()`)
Net issuance on a settlement date = bills and coupons sold − publicly held maturities − coupon interest paid.
- Sold: announced offering amounts. Later auctions repeat the latest size per term on the usual calendar (bills weekly, 52-week every 4 weeks, coupons monthly) and are drawn paler. TIPS and CMBs are not projected.
- Maturing (public) = sum of accepted amounts per CUSIP for settled auctions minus SOMA par (NY Fed latest as-of file). Projected bills that mature inside the window are subtracted at maturity.
- Interest: public par x coupon / 2 on each coupon date (maturity date and six-monthly back). TIPS inflation accrual, buybacks and FRN reset rates are ignored.
- Settlement dates roll forward over weekends and US bond-market holidays (`holidays()`); FRNs settle at month-end. Validated against a Wrightson reference: Oct 20 = +32, Nov 2 interest about 25, Nov 2 net about -49 vs -47.
- Estimates are only as good as the latest announced sizes; Dec/Jan are the least reliable (refunding and tax-date bill paydowns are not forecast).

## Gotchas learned
- `L()` must resolve colours as `css('--' + col)`; it used `css(col)` (empty string), so Chart.js silently applied its default palette and lines did not match legends. Fixed.
- Card `units` can be a getter; `drawCard` rewrites the units line on every draw (used by the yield/price toggle).
- Chart.js treats function-valued options as scriptable (infinite recursion if you put a formatter in plugin options). The end-label formatter is stored on the chart instance (`ch._endFmt`).
- localStorage cache turns NaN into null; the script redefines `isFinite` to be strict (`typeof v === 'number'`).
- cdnjs has no `chartjs-adapter-date-fns` 3.0.0 (404), hence the inline adapter.
- The spread cards pass dataset options through `simple()`; the SOFR-EFFR card has a custom `build` that works on a calendar-day axis (Friday fixing carried over Sat/Sun/holidays).

## Open ideas
- DTCC GCF par volume card (too small vs SOFR volume to share a chart).
- Use the Treasury's own "estimated publicly held maturing" field from auctions as a cross-check on maturities.
- Anchor projected bill sizes on Treasury's quarterly borrowing estimate instead of flat sizes.

## Testing
Serve the folder over `http://localhost` (the browser pane could not open `file://`), open the page, and check `Object.values(STATUS)` in the console. Run `computeNI()` to inspect events (`computeNI.lastEvents`).
