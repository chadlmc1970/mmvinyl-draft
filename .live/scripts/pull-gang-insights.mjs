#!/usr/bin/env node
// Gang sheet reorders and season trends into data-live/dashboard/gang-insights.json (git-ignored).
// Each sheet's design list comes from its Kixxl JSON. Results are cached in data-live/, so later runs only read recent orders and new sheets.
// A reorder is the same customer paying again for the same set of design files on a later order.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = path.join(ROOT, 'data-live');
const LINES = path.join(LIVE, 'gang-lines.ndjson');
const DESIGNS = path.join(LIVE, 'sheet-designs.ndjson');
const BASE = process.env.WC_BASE || 'https://mandmvinyl.com/wp-json/wc/v3';
if (!BASE.startsWith('https://')) throw new Error('WC_BASE must be https');
const REFRESH_DAYS = Number(process.env.REFRESH_DAYS) || 60;

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.woo'), 'utf8').split('\n')
    .map((l) => l.split('=')).filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join('=').replace(/[\s"']/g, '')])
);
if (!env.WC_KEY || !env.WC_SECRET) throw new Error('.env.woo needs WC_KEY and WC_SECRET');
const auth = 'Basic ' + Buffer.from(`${env.WC_KEY}:${env.WC_SECRET}`).toString('base64');

const readNd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const hash = (s) => (s ? crypto.createHash('sha256').update(s.trim().toLowerCase()).digest('hex').slice(0, 16) : null);
const cents = (s) => Math.round(parseFloat(s || '0') * 100);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function ordersPage(params, page) {
  const q = new URLSearchParams({ per_page: '100', page: String(page), orderby: 'date', order: 'asc', ...params });
  for (let t = 0; ; t++) {
    try {
      const res = await fetch(`${BASE}/orders?${q}`, { headers: { Authorization: auth } });
      if (res.ok) return { rows: await res.json(), pages: Number(res.headers.get('x-wp-totalpages') || 1) };
      if (t >= 4) throw new Error(`orders page ${page}: HTTP ${res.status}`);
    } catch (e) {
      if (t >= 4) throw e;
    }
    await wait(3000 * (t + 1));
  }
}

async function allOrders(params) {
  const first = await ordersPage(params, 1);
  const out = [...first.rows];
  let next = 2;
  const worker = async () => {
    while (next <= first.pages) out.push(...(await ordersPage(params, next++)).rows);
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}

function linesOf(o) {
  const cust = o.customer_id ? 'u' + o.customer_id : 'e' + hash(o.billing?.email);
  const rows = [];
  for (const l of o.line_items) {
    const m = Object.fromEntries((l.meta_data || []).map((x) => [x.key, x.value]));
    if (m._app_name !== 'Kixxl' && !/gang/i.test(l.parent_name || l.name)) continue;
    const edit = String(m.edit_sheet || '');
    rows.push({
      order: o.id, date: o.date_created, status: o.status, cust, qty: l.quantity, total: l.total,
      name: (l.parent_name || l.name).slice(0, 50), sheet_size: m.sheet_size || null,
      json: (edit.match(/json=([^&]+)/) || [])[1] || null, preview: m.sheet_preview || null,
    });
  }
  return rows;
}

let lines = readNd(LINES);
const newest = lines.reduce((d, r) => (r.date > d ? r.date : d), '');
const since = newest ? new Date(Date.parse(newest + 'Z') - REFRESH_DAYS * 864e5).toISOString().slice(0, 19) : null;
const fresh = await allOrders(since ? { after: since } : {});
const freshIds = new Set(fresh.map((o) => o.id));
lines = lines.filter((r) => !freshIds.has(r.order)).concat(fresh.flatMap(linesOf));
fs.writeFileSync(LINES, lines.map((r) => JSON.stringify(r)).join('\n') + '\n');

const designs = new Map(readNd(DESIGNS).map((d) => [d.u, d]));
const missing = [...new Set(lines.filter((r) => r.json).map((r) => decodeURIComponent(r.json)))].filter((u) => !designs.has(u));
let idx = 0;
const designWorker = async () => {
  while (idx < missing.length) {
    const u = missing[idx++];
    let entry = { u, err: 1 };
    for (let t = 0; t < 3; t++) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          const p = await res.json();
          const o = (p.objects || []).filter((x) => x.originalSrc || x.src).map((x) => ({ s: String(x.originalSrc || x.src).split('/').pop().split('?')[0].slice(0, 80) }));
          entry = { u, n: (p.objects || []).length, o };
          break;
        }
        if (res.status === 403 || res.status === 404) break;
      } catch { await wait(1500); }
    }
    designs.set(u, entry);
    fs.appendFileSync(DESIGNS, JSON.stringify(entry) + '\n');
  }
};
await Promise.all(Array.from({ length: 8 }, designWorker));

const paid = lines.filter((r) => r.status === 'completed' || r.status === 'processing').sort((a, b) => (a.date < b.date ? -1 : 1));
for (const r of paid) {
  const d = r.json && designs.get(decodeURIComponent(r.json));
  const ids = d && !d.err ? [...new Set(d.o.map((o) => o.s).filter(Boolean))].sort() : [];
  r.ids = ids;
  r.designs = d && !d.err ? d.o.length : 0;
  r.cents = cents(r.total);
  r.length_in = parseFloat((String(r.sheet_size || '').match(/x\s*([\d.]+)/) || [])[1]) || null;
  r.sqft = parseFloat((String(r.sheet_size || '').match(/([\d.]+)\s*ft/) || [])[1]) || null;
}
const sum = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
const uniq = (rows, f) => new Set(rows.map(f)).size;
const sales = sum(paid, (r) => r.cents);
const units = sum(paid, (r) => r.qty);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };

const groups = new Map();
for (const r of paid.filter((x) => x.ids.length)) {
  const k = r.cust + '#' + r.ids.join('|');
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const repeats = [...groups.values()].filter((g) => uniq(g, (r) => r.order) > 1).map((g) => {
  const later = g.filter((r) => r.order !== g[0].order);
  return {
    first: g[0], last: g[g.length - 1], later,
    orders: uniq(g, (r) => r.order), reorders: uniq(later, (r) => r.order),
    reorder_cents: sum(later, (r) => r.cents), total_cents: sum(g, (r) => r.cents),
    gap_days: (Date.parse(later[0].date) - Date.parse(g[0].date)) / 864e5,
  };
}).sort((a, b) => b.reorder_cents - a.reorder_cents);

const seen = new Map();
const reused = paid.filter((r) => {
  let hit = false;
  for (const id of r.ids) {
    const k = r.cust + '#' + id;
    if (!seen.has(k)) seen.set(k, r.order);
    else if (seen.get(k) !== r.order) hit = true;
  }
  return hit;
});

const top = repeats.slice(0, 10);
const labels = new Map();
if (top.length) {
  const { rows } = await ordersPage({ include: top.map((t) => t.last.order).join(',') }, 1);
  for (const o of rows) {
    const b = o.billing || {};
    labels.set(o.id, (b.company || '').trim() || [b.first_name, b.last_name ? b.last_name.slice(0, 1) + '.' : ''].filter(Boolean).join(' ') || 'Guest');
  }
}

const ymOf = (r) => r.date.slice(0, 7);
const byMonth = new Map();
for (const r of paid) {
  if (!byMonth.has(ymOf(r))) byMonth.set(ymOf(r), []);
  byMonth.get(ymOf(r)).push(r);
}
const firstSeen = new Map();
for (const r of paid) if (!firstSeen.has(r.cust)) firstSeen.set(r.cust, r.date);
const summary = (rows) => {
  const sized = rows.filter((r) => r.sqft);
  const start = rows.length ? rows[0].date : '';
  return {
    sheets: sum(rows, (r) => r.qty), sales_cents: sum(rows, (r) => r.cents),
    avg_sheet_cents: Math.round(sum(rows, (r) => r.cents) / (sum(rows, (r) => r.qty) || 1)),
    avg_sqft: sized.length ? +(sum(sized, (r) => r.sqft) / sized.length).toFixed(2) : null,
    customers: uniq(rows, (r) => r.cust),
    new_customers: new Set(rows.filter((r) => firstSeen.get(r.cust) >= start).map((r) => r.cust)).size,
  };
};
const curYm = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
const monthsAll = [...byMonth.keys()].sort();
const startYm = monthsAll.find((m) => sum(byMonth.get(m), (r) => r.qty) >= 50) || monthsAll[0];
const months = monthsAll.filter((m) => m >= startYm);
const full = months.filter((m) => m < curYm);
const nowMonths = full.slice(-2);
const priorMonths = full.slice(-4, -2);
const rowsIn = (ms) => paid.filter((r) => ms.includes(ymOf(r)));
const monthName = (ym, style = 'long') => new Date(ym + '-15T12:00:00Z').toLocaleString('en-US', { month: style, timeZone: 'UTC' });
const BUCKETS = [['Under 2 feet', 0, 24], ['2 to 5 feet', 24, 60], ['5 to 10 feet', 60, 120], ['Over 10 feet', 120, Infinity]];
const mix = (rows) => {
  const sized = rows.filter((r) => r.length_in);
  return BUCKETS.map(([label, lo, hi]) => ({ label, share_pct: +(sized.filter((r) => r.length_in >= lo && r.length_in < hi).length / (sized.length || 1) * 100).toFixed(1) }));
};
const nowMix = mix(rowsIn(nowMonths));
const priorMix = mix(rowsIn(priorMonths));

const stamp = new Date().toISOString();
const out = {
  meta: {
    sample: false, generated_at: stamp, as_of: stamp, currency: 'USD', money_unit: 'cents',
    source: 'WooCommerce orders and Kixxl sheet files. Paid orders only. Sales are sheet prices before tax and shipping.',
  },
  reorders: {
    paid_sheets: units, sheet_sales_cents: sales, customers: uniq(paid, (r) => r.cust),
    repeat_customers: Object.values(Object.groupBy(paid, (r) => r.cust)).filter((g) => uniq(g, (r) => r.order) > 1).length,
    sheets_without_design_data: paid.filter((r) => !r.ids.length).length,
    same_sheet: {
      sheets: repeats.length, reorders: sum(repeats, (g) => g.reorders), customers: uniq(repeats, (g) => g.first.cust),
      value_cents: sum(repeats, (g) => g.reorder_cents), share_of_sales_pct: +(sum(repeats, (g) => g.reorder_cents) / sales * 100).toFixed(1),
      typical_days_between: +median(repeats.map((g) => g.gap_days)).toFixed(1),
    },
    reused_design: {
      sheets: sum(reused, (r) => r.qty), customers: uniq(reused, (r) => r.cust), value_cents: sum(reused, (r) => r.cents),
      share_of_sales_pct: +(sum(reused, (r) => r.cents) / sales * 100).toFixed(1),
    },
    top10: top.map((t) => ({
      customer: labels.get(t.last.order) || 'Guest', times_ordered: t.orders, first_date: t.first.date.slice(0, 10), last_date: t.last.date.slice(0, 10),
      designs: t.first.designs, length_in: t.last.length_in, reorder_value_cents: t.reorder_cents, total_value_cents: t.total_cents,
      preview_url: String(t.last.preview || '').split('#')[0] || null,
    })),
  },
  trends: {
    first_month: startYm,
    monthly: months.map((m) => ({ month: m, label: monthName(m, 'short'), partial: m === curYm, ...summary(byMonth.get(m)) })),
    season: {
      label: nowMonths.map((m) => monthName(m)).join(' and '), prior_label: priorMonths.map((m) => monthName(m)).join(' and '),
      now: summary(rowsIn(nowMonths)), prior: summary(rowsIn(priorMonths)),
      sizes: nowMix.map((b, i) => ({ ...b, prior_share_pct: priorMix[i].share_pct })),
    },
  },
};
fs.mkdirSync(path.join(LIVE, 'dashboard'), { recursive: true });
fs.writeFileSync(path.join(LIVE, 'dashboard', 'gang-insights.json'), JSON.stringify(out, null, 2));
console.log(`Gang insights: ${units} sheets, ${repeats.length} reordered, ${missing.length} new sheet files read`);
