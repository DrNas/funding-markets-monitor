# Funding Markets Monitor

US repo/funding dashboard: Treasury net issuance, SOFR/TGCR/BGCR/EFFR vs. the Fed corridor, spreads, dispersion, liquidity, GC vs. IORB, 2y/7y Treasuries, SR1 − ZQ expiries, and a configurable daily table.

**Live page:** https://drnas.github.io/funding-markets-monitor/

The data is rebuilt every weekday by a GitHub Action (`.github/workflows/daily-data.yml`) and published with the page. You can also open `index.html` locally: it loads the same daily file.

## One-time setup
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → New repository secret:** name `FRED_API_KEY`, value = your FRED API key.
3. **Actions → Daily data → Run workflow** to build the first snapshot (later runs happen on their own).

If a run fails, GitHub emails you; the run's summary page lists every series and its status.

See `HANDOFF.md` for how everything works.
