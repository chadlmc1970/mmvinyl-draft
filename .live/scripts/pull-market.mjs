#!/usr/bin/env node
// Market trends for the owner dashboard's Marketing tab: data/dashboard/market.json (also copied to data-live/dashboard/).
// Free sources only. Google Trends (public, no key) for Louisiana search interest; a short calendar of local demand
// dates checked against official pages (sources stored with each date). Run: node scripts/pull-market.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEO = 'US-LA';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36';
const TERMS = [
  { key: 'mardi-gras', label: 'Mardi Gras shirts', q: 'mardi gras shirt' },
  { key: 'lsu', label: 'LSU shirts', q: 'lsu shirt' },
  { key: 'saints', label: 'Saints shirts', q: 'saints shirt' },
  { key: 'christmas', label: 'Christmas shirts', q: 'christmas shirt' },
  { key: 'dtf', label: 'DTF transfers', q: 'dtf transfers' }
];
// Seeds for "what people are starting to search": rising related searches in Louisiana, last 30 days.
const RISING_SEEDS = ['shirt', 'custom shirts', 'dtf'];

// Local dates that drive her rushes. Only dates published on the source page are listed.
const CALENDAR = [
  { date: '2026-11-14', title: 'LSU vs. Texas in Tiger Stadium', kind: 'game', source: 'https://lsusports.net/news/2026/11/06/football-returns-to-death-valley-for-november-showdown-with-alabama' },
  { date: '2026-11-15', title: 'Saints vs. Panthers in the Superdome', kind: 'game', source: 'https://www.neworleanssaints.com/news/saints-schedule-2026-nfl-season-opponents-matchups-key-dates' },
  { date: '2026-11-26', title: 'Thanksgiving', kind: 'holiday' },
  { date: '2026-12-25', title: 'Christmas', kind: 'holiday' },
  { date: '2027-01-29', title: 'Krewe of Artemis parade, Baton Rouge', kind: 'parade', source: 'https://www.visitbatonrouge.com/events/krewe-of-artemis-mardi-gras-parade/' },
  { date: '2027-01-30', title: 'Krewe of Orion parade, Baton Rouge', kind: 'parade', source: 'https://www.visitbatonrouge.com/events/krewe-of-orion-mardi-gras-parade/' },
  { date: '2027-02-08', title: 'Krewe of Shenandoah parade', kind: 'parade', source: 'https://www.visitbatonrouge.com/events/krewe-of-shenandoah-mardi-gras-parade/' },
  { date: '2027-02-09', title: 'Fat Tuesday', kind: 'holiday' },
  { date: '2027-02-14', title: "Valentine's Day", kind: 'holiday' },
  { date: '2027-03-17', title: "St. Patrick's Day", kind: 'holiday' }
];

let cookie = '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (t) => JSON.parse(t.slice(t.indexOf('{')));

async function get(url) {
  for (let t = 0; ; t++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Cookie: cookie, Accept: 'application/json, text/plain, */*' } });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    if (res.ok) return res.text();
    if (t >= 4 || ![429, 500, 502, 503].includes(res.status)) throw new Error(`${res.status} ${url.slice(0, 80)}`);
    await wait(4000 * (t + 1));
  }
}

async function explore(items, time) {
  const req = { comparisonItem: items.map((q) => ({ keyword: q, geo: GEO, time })), category: 0, property: '' };
  const q = new URLSearchParams({ hl: 'en-US', tz: '360', req: JSON.stringify(req) });
  return strip(await get(`https://trends.google.com/trends/api/explore?${q}`)).widgets;
}

async function widget(w, kind) {
  const q = new URLSearchParams({ hl: 'en-US', tz: '360', req: JSON.stringify(w.request), token: w.token });
  await wait(1200);
  return strip(await get(`https://trends.google.com/trends/api/widgetdata/${kind}?${q}`));
}

async function main() {
  await get('https://trends.google.com/trends/?geo=US-LA');
  const today = new Date().toISOString().slice(0, 10);
  const widgets = await explore(TERMS.map((t) => t.q), `2024-11-01 ${today}`);
  const series = await widget(widgets.find((w) => w.id === 'TIMESERIES'), 'multiline');
  const allPoints = series.default.timelineData.map((p) => ({ week: new Date(Number(p.time) * 1000).toISOString().slice(0, 10), values: p.value, partial: !!p.isPartial }));
  const points = allPoints.slice(-53);
  const terms = TERMS.map((t, i) => {
    const vals = points.map((p) => p.values[i]);
    const all = allPoints.map((p) => p.values[i]);
    const full = allPoints.filter((p) => !p.partial).map((p) => p.values[i]);
    const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const last4 = avg(full.slice(-4));
    const prev4 = avg(full.slice(-8, -4));
    const peakAt = vals.indexOf(Math.max(...vals)); // within the last 12 months
    // Same weeks last year: where this term was a year ago and where it went over the next 6 weeks.
    const lastFull = full.length - 1;
    const yearAgo = lastFull - 52 >= 0 ? full[lastFull - 52] : null;
    const aheadLastYear = lastFull - 52 >= 0 ? Math.round(avg(all.slice(lastFull - 51, lastFull - 45))) : null;
    return {
      key: t.key, label: t.label, query: t.q,
      weekly: vals,
      now: Math.round(last4),
      change_pct: prev4 ? Math.round((last4 - prev4) / prev4 * 100) : null,
      year_ago: yearAgo,
      next6_last_year: aheadLastYear,
      peak_week: points[peakAt] ? points[peakAt].week : null
    };
  });

  const rising = [];
  for (const seed of RISING_SEEDS) {
    try {
      await wait(2000);
      const w = (await explore([seed], 'today 1-m')).find((x) => x.id === 'RELATED_QUERIES');
      const r = await widget(w, 'relatedsearches');
      const list = (r.default.rankedList[1] || { rankedKeyword: [] }).rankedKeyword;
      list.filter((k) => /shirt|tee|hoodie|sweat|transfer|dtf|jersey|hat|decal/i.test(k.query) && !/meaning/i.test(k.query)).slice(0, 8).forEach((k) => rising.push({ seed, query: k.query, growth: k.formattedValue }));
    } catch (e) {
      console.warn(`rising for "${seed}" skipped: ${e.message}`);
    }
  }

  const out = {
    meta: {
      sample: false,
      generated_at: new Date().toISOString(),
      source: 'Google Trends, Louisiana, weekly since Nov 2024 (100 = the busiest week for any term shown). Calendar dates from the linked official pages.',
      geo: GEO
    },
    weeks: points.map((p) => p.week),
    terms,
    rising,
    calendar: CALENDAR
  };
  const json = JSON.stringify(out, null, 1);
  for (const dir of ['data/dashboard', 'data-live/dashboard']) {
    const d = path.join(ROOT, dir);
    if (fs.existsSync(d)) fs.writeFileSync(path.join(d, 'market.json'), json);
  }
  console.log(`market.json: ${terms.length} terms, ${points.length} weeks, ${rising.length} rising searches`);
  terms.forEach((t) => console.log(`  ${t.label}: now ${t.now}, ${t.change_pct}% vs prior 4 weeks, peak ${t.peak_week}`));
  rising.forEach((r) => console.log(`  rising (${r.seed}): ${r.query} ${r.growth}`));
}

main().catch((e) => { console.error(e.message); process.exit(1); });
