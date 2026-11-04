#!/usr/bin/env node
// Pull real WooCommerce data into data-live/dashboard/*.json (git-ignored, never published).
// Needs .env.woo with WC_KEY and WC_SECRET (read-only REST key). Customer emails and phones are never written.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { token as igToken, call as igCall } from './ig-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data-live', 'dashboard');
const BASE = process.env.WC_BASE || 'https://mandmvinyl.com/wp-json/wc/v3';
if (!BASE.startsWith('https://')) throw new Error('WC_BASE must be https');
const TZ = 'America/Chicago';

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.woo'), 'utf8').split('\n')
    .map((l) => l.split('=')).filter((p) => p.length >= 2)
    .map(([k, ...v]) => [k.trim(), v.join('=').replace(/[\s"']/g, '')])
);
if (!env.WC_KEY || !env.WC_SECRET) throw new Error('.env.woo needs WC_KEY and WC_SECRET');
const auth = 'Basic ' + Buffer.from(`${env.WC_KEY}:${env.WC_SECRET}`).toString('base64');

async function getAll(endpoint, params = {}) {
  const rows = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ per_page: '100', page: String(page), ...params });
    const res = await fetch(`${BASE}/${endpoint}?${q}`, { headers: { Authorization: auth } });
    if (!res.ok) throw new Error(`${endpoint} page ${page}: HTTP ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (page >= Number(res.headers.get('x-wp-totalpages') || 1)) break;
  }
  return rows;
}

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset' });
function parts(d) {
  const o = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const off = (o.timeZoneName || 'GMT-06:00').replace('GMT', '') || '+00:00';
  return { date: `${o.year}-${o.month}-${o.day}`, iso: `${o.year}-${o.month}-${o.day}T${o.hour}:${o.minute}:${o.second}${off}` };
}
const cents = (s) => Math.round(parseFloat(s || '0') * 100);
const dayOf = (iso) => iso.slice(0, 10);
const addDays = (date, n) => { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (date) => { const d = new Date(date + 'T12:00:00Z'); return addDays(date, -((d.getUTCDay() + 6) % 7)); };

const now = new Date();
const today = parts(now).date;
const since = addDays(today, -90);

const STATUS = { 'on-hold': 'on_hold', processing: 'printing', completed: 'picked_up', failed: 'payment_failed' };
const OPEN = new Set(['new', 'on_hold', 'printing']);
const METHOD = { stripe: 'card', 'ppcp-credit-card-gateway': 'card', 'ppcp-gateway': 'paypal', 'ppcp-applepay': 'apple_pay', 'ppcp-googlepay': 'google_pay' };
const METHOD_LABEL = { card: 'Cards', paypal: 'PayPal', apple_pay: 'Apple Pay', google_pay: 'Google Pay', other: 'Klarna, Affirm and other' };

const [rawOrders, products] = await Promise.all([
  getAll('orders', { after: since + 'T00:00:00', orderby: 'date', order: 'desc' }),
  getAll('products', { status: 'publish' }),
]);
const catOf = new Map(products.map((p) => [p.id, p.categories?.[0]?.name || 'Other']));

const CLOSE = { 6: '13:00' };
function offsetFor(day, hhmm) {
  for (const off of ['-05:00', '-06:00']) {
    if (parts(new Date(`${day}T${hhmm}:00${off}`)).iso.startsWith(`${day}T${hhmm}`)) return off;
  }
  return '-06:00';
}
function promiseFor(t) {
  const [date, time] = [t.date, t.iso.slice(11, 16)];
  const dow = new Date(date + 'T12:00:00Z').getUTCDay();
  const cutoff = dow === 6 ? '10:00' : '14:00';
  let day = date;
  if (dow === 0 || (dow >= 1 && dow <= 6 && time >= cutoff)) day = addDays(date, 1);
  while (new Date(day + 'T12:00:00Z').getUTCDay() === 0) day = addDays(day, 1);
  const close = CLOSE[new Date(day + 'T12:00:00Z').getUTCDay()] || '17:00';
  return { iso: `${day}T${close}:00${offsetFor(day, close)}` };
}

const orders = rawOrders.map((o) => {
  const t = parts(new Date((o.date_created_gmt || o.date_created) + 'Z'));
  const status = STATUS[o.status] || null;
  const b = o.billing || {};
  const label = (b.company || '').trim() || [b.first_name, (b.last_name || '').slice(0, 1) && b.last_name.slice(0, 1) + '.'].filter(Boolean).join(' ') || 'Guest';
  const lines = o.line_items.map((l) => ({
    product_id: l.product_id,
    name: l.parent_name || l.name,
    category: catOf.get(l.product_id) || 'Other',
    qty: l.quantity,
    unit_price_cents: l.quantity ? Math.round(cents(l.total) / l.quantity) : 0,
    price_source: 'woocommerce_order',
  }));
  const isSheet = o.line_items.some((l) => /gang sheet/i.test(l.parent_name || l.name));
  const flagged = o.line_items.some((l) => l.meta_data.some((m) => (m.key === '_has_low_dpi_images' || m.key === '_has_overlapping_images') && (m.value === true || m.value === 'true' || m.value === '1')));
  const promised = promiseFor(t);
  const ship = o.shipping_lines[0]?.method_id;
  const method = METHOD[o.payment_method] || 'other';
  return {
    id: 'ord_' + o.id,
    number: String(o.number),
    channel: 'web',
    source_system: 'WooCommerce',
    customer_id: 'cust_' + (o.customer_id || 'g' + crypto.createHash('sha1').update(((b.company || '') + '|' + (b.first_name || '') + '|' + (b.last_name || '') + '|' + (b.postcode || '')).toLowerCase()).digest('hex').slice(0, 10)),
    customer_label: label,
    created_at: t.iso,
    promised_at: promised.iso,
    status,
    risk: null,
    risk_reason: null,
    lines,
    gang_sheets: lines.filter((l) => /gang sheet/i.test(l.name)).reduce((n, l) => n + l.qty, 0),
    printer: null,
    subtotal_cents: cents(o.total) - cents(o.total_tax) - cents(o.shipping_total),
    total_cents: cents(o.total) - cents(o.total_tax) + (o.refunds || []).reduce((n, r) => n + cents(r.total), 0),
    total_note: 'Excludes tax',
    payment: { method, state: o.status === 'failed' ? 'failed' : o.status === 'refunded' ? 'refunded' : 'paid', gateway: o.payment_method, ...(o.status === 'failed' ? { failure_reason: null } : {}) },
    fulfillment: ship === 'local_pickup' || !ship ? { type: 'pickup' } : { type: 'ship', carrier: null, tracking: null },
    art_check: !isSheet ? null : flagged ? 'needs_review' : 'passed',
    pickup_text: null,
    notes: null,
    _wc_status: o.status,
    _date: t.date,
  };
});

for (const o of orders) {
  if (!OPEN.has(o.status)) continue;
  const mins = (new Date(o.promised_at) - now) / 60000;
  if (mins < 0) { o.risk = 'late'; o.risk_reason = 'Past the promised time and still open'; }
  else if (mins < 120) { o.risk = 'due_soon'; o.risk_reason = 'Due within two hours'; }
  if (o.art_check === 'needs_review' && !o.risk) { o.risk = 'art'; o.risk_reason = 'Art check flagged low resolution or overlapping images'; }
}

const counted = orders.filter((o) => o._wc_status === 'completed' || o._wc_status === 'processing' || o._wc_status === 'on-hold');
const meta = (source, extra = {}) => ({
  schema_version: '1.1',
  sample: false,
  sample_note: null,
  generated_at: parts(now).iso,
  as_of: parts(now).iso,
  timezone: TZ,
  currency: 'USD',
  money_unit: 'cents',
  source,
  ...extra,
});
const NO_STORE = { store_connected: false, store_note: 'Shopkeep is not connected yet. Store figures are not included.' };

const sumBy = (rows, f) => rows.reduce((n, r) => n + f(r), 0);
const days = [];
for (let d = since; d <= today; d = addDays(d, 1)) days.push(d);
const daily = days.map((date) => {
  const os = counted.filter((o) => o._date === date);
  return { date, web_cents: sumBy(os, (o) => o.total_cents), store_cents: null, orders_web: os.length, orders_store: null };
});

const weeks = new Map();
for (const d of daily) {
  const w = mondayOf(d.date);
  const row = weeks.get(w) || { week_start: w, web_cents: 0, store_cents: null, orders: 0, total_cents: 0, partial: false };
  row.web_cents += d.web_cents; row.total_cents += d.web_cents; row.orders += d.orders_web;
  weeks.set(w, row);
}
const thisWeek = mondayOf(today);
const weekly = [...weeks.values()].sort((a, b) => a.week_start.localeCompare(b.week_start)).map((w) => ({ ...w, partial: w.week_start === thisWeek || w.week_start === mondayOf(since) && since !== w.week_start }));
const full = weekly.filter((w) => !w.partial);
const lastFull = full[full.length - 1], priorFull = full[full.length - 2];

const inWindow = (days) => counted.filter((o) => o._date > addDays(today, -days));
const lineRows = (os) => os.flatMap((o) => o.lines.map((l) => ({ ...l, line_cents: l.unit_price_cents * l.qty })));
const cur28 = lineRows(inWindow(28)), prev28 = lineRows(counted.filter((o) => o._date <= addDays(today, -28) && o._date > addDays(today, -56)));
const catTotals = (rows) => rows.reduce((m, r) => m.set(r.category, (m.get(r.category) || 0) + r.line_cents), new Map());
const c28 = catTotals(cur28), p28 = catTotals(prev28), c28sum = [...c28.values()].reduce((a, b) => a + b, 0) || 1;
const by_category_28d = [...c28.entries()].sort((a, b) => b[1] - a[1]).map(([category, revenue_cents]) => ({ category, revenue_cents, prev_period_cents: p28.get(category) || 0, share_pct: Math.round((revenue_cents / c28sum) * 100) }));

const prodMap = new Map();
for (const r of lineRows(inWindow(30))) {
  const p = prodMap.get(r.product_id) || { product_id: r.product_id, name: r.name, category: r.category, unit_price_cents: r.unit_price_cents, price_note: null, units_30d: 0, revenue_30d_cents: 0, real_units: true };
  p.units_30d += r.qty; p.revenue_30d_cents += r.line_cents;
  prodMap.set(r.product_id, p);
}
const top_products_30d = [...prodMap.values()].sort((a, b) => b.revenue_30d_cents - a.revenue_30d_cents).slice(0, 10);

const o30 = inWindow(30);
const openDays = new Set(o30.map((o) => o._date)).size || 1;
const sales = {
  meta: meta('WooCommerce orders (live, read-only). Excludes cancelled, failed, and refunded.', NO_STORE),
  daily,
  weekly,
  week_over_week: lastFull && priorFull ? { this_week: lastFull, prior_week: priorFull, note: 'Last full week compared with the week before. Web orders only.' } : null,
  current_week_to_date: { week_start: thisWeek, total_cents: weeks.get(thisWeek)?.total_cents || 0 },
  by_category_28d,
  top_products_30d,
  averages: {
    avg_order_web_cents: o30.length ? Math.round(sumBy(o30, (o) => o.total_cents) / o30.length) : null,
    avg_order_store_cents: null,
    orders_per_open_day: Math.round((o30.length / openDays) * 10) / 10,
    reseller_share_of_revenue_pct: null,
    repeat_order_rate_pct: null,
  },
};

const w28 = orders.filter((o) => o._date > addDays(today, -28) && ['completed', 'processing', 'on-hold', 'failed'].includes(o._wc_status));
const methods = Object.keys(METHOD_LABEL).map((key) => {
  const rows = w28.filter((o) => o.payment.method === key);
  const paid = rows.filter((o) => o.payment.state === 'paid');
  const failed = rows.length - paid.length;
  return { key, label: METHOD_LABEL[key], amount_cents: sumBy(paid, (o) => o.total_cents), count: paid.length, failed_count: failed, fail_rate_pct: rows.length ? Math.round((failed / rows.length) * 1000) / 10 : 0, live_status: rows.length ? 'live' : 'planned' };
}).filter((m) => m.count || m.failed_count);
const paidTotal = sumBy(methods, (m) => m.amount_cents) || 1;
methods.forEach((m) => { m.share_pct = Math.round((m.amount_cents / paidTotal) * 100); });
const payments = {
  meta: meta('WooCommerce orders by payment gateway (live, read-only). Venmo is inside PayPal and is not split out.', NO_STORE),
  window: 'last 28 days',
  methods,
  failures: w28.filter((o) => o.payment.state === 'failed').slice(0, 20).map((o) => ({ id: 'fail_' + o.id, date: o._date, method: o.payment.method, reason: null, order_number: o.number, recovered: counted.some((c) => c.customer_id === o.customer_id && c.created_at > o.created_at) })),
  payouts: [],
  web_vs_store: { web_cents: paidTotal === 1 ? 0 : paidTotal, store_cents: null },
  note: 'Payouts and store payments are not connected yet.',
};

const queue = orders.filter((o) => OPEN.has(o.status) && o._date >= addDays(today, -7)).reverse().map((o) => ({
  order_id: o.id, number: o.number, promised_at: o.promised_at, status: o.status, risk: o.risk, risk_reason: o.risk_reason, customer_label: o.customer_label,
  summary: o.lines.map((l) => `${l.qty} x ${l.name}`).join(', ').slice(0, 120), gang_sheets: o.gang_sheets, printer: null, channel: 'web', fulfillment: o.fulfillment.type, pickup_text: null,
}));
const todayOrders = orders.filter((o) => o._date === today);

const sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard/kpis.json'), 'utf8'));
const kpis = {
  meta: meta('Derived from live WooCommerce orders. Fields marked null are not connected yet.', NO_STORE),
  today: {
    orders_today: todayOrders.filter((o) => ['completed', 'processing', 'on-hold'].includes(o._wc_status)).length,
    open_in_queue: queue.length,
    done_today: todayOrders.filter((o) => o._wc_status === 'completed').length,
    ready_waiting: null, at_risk: null, sheets_so_far_today: sumBy(todayOrders.filter((o) => o._wc_status !== 'failed'), (o) => o.gang_sheets),
    revenue_today_cents: sumBy(todayOrders.filter((o) => ['completed', 'processing', 'on-hold'].includes(o._wc_status)), (o) => o.total_cents),
    quotes_unanswered: null, applications_pending: null, texts_not_sent: null,
  },
  real: { products: products.length },
  week: { revenue_vs_prior_pct: lastFull && priorFull && priorFull.total_cents ? Math.round(((lastFull.total_cents - priorFull.total_cents) / priorFull.total_cents) * 1000) / 10 : null },
  scorecard: sample.scorecard,
};


const readSample = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard', f), 'utf8'));
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const curYm = today.slice(0, 7);
const priorYm = (() => { const d = new Date(curYm + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })();
const monthName = (ym) => MONTH_NAMES[parseInt(ym.slice(5, 7), 10) - 1];
const sheetsOn = (date) => sumBy(counted.filter((o) => o._date === date), (o) => o.gang_sheets);
const sheetsIn = (from, to) => sumBy(counted.filter((o) => o._date >= from && o._date <= to), (o) => o.gang_sheets);

const gsDaily = days.filter((d) => d.startsWith(priorYm) || d.startsWith(curYm)).map((date) => ({ date, total: sheetsOn(date), printer_1: null, printer_2: null }));
const sheetsCur = sumBy(gsDaily.filter((d) => d.date.startsWith(curYm)), (d) => d.total);
const sheetsPrior = sumBy(gsDaily.filter((d) => d.date.startsWith(priorYm)), (d) => d.total);
const sampleGs = readSample('gangsheets.json');
const gangsheets = {
  meta: meta('Gang sheet units counted from WooCommerce order lines (live). Printer split and reprints are not recorded anywhere yet.', NO_STORE),
  month_totals: {
    [priorYm]: { total: sheetsPrior, real: true, source: 'WooCommerce orders' },
    [curYm + '_to_date']: { total: sheetsCur, real: true, source: 'WooCommerce orders', through: today },
  },
  printers: sampleGs.printers,
  capacity_per_day: sampleGs.capacity_per_day,
  october_by_printer: { printer_1: null, printer_2: null },
  today: { date: today, total_so_far: sheetsOn(today), printer_1: null, printer_2: null, queued_open: sumBy(queue, (q) => q.gang_sheets) },
  daily: gsDaily,
  reprints: { [priorYm]: null, [curYm + '_to_date']: null, reasons: [], note: 'No reprint log exists yet.' },
};

const byCust = new Map();
for (const o of counted) {
  const c = byCust.get(o.customer_id) || { label: o.customer_label, orders: [] };
  c.orders.push(o);
  byCust.set(o.customer_id, c);
}
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const initials = (l) => l.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const customers = [...byCust.entries()].map(([id, c]) => {
  const dates = c.orders.map((o) => o._date).sort();
  const gaps = dates.slice(1).map((d, i) => dayDiff(dates[i], d)).filter((g) => g > 0);
  const gap = median(gaps);
  const since = dayDiff(dates[dates.length - 1], today);
  const spend = sumBy(c.orders, (o) => o.total_cents);
  const weekly8 = Array.from({ length: 8 }, (_, i) => c.orders.filter((o) => o._date > addDays(today, -7 * (8 - i)) && o._date <= addDays(today, -7 * (7 - i))).length);
  const ratio = gap ? since / gap : null;
  return {
    id, label: c.label, initials: initials(c.label), type: c.label.includes('.') && !/\b(LLC|Inc|Co|Company|Shop|Designs?|Prints?)\b/i.test(c.label) ? 'walk_in' : 'business', tier: 'standard',
    wholesale_approved: null, tax_exempt_on_file: null, first_order_at: null, last_order_at: dates[dates.length - 1], days_since_last_order: since,
    typical_gap_days: gap, orders_90d: c.orders.length, spend_90d_cents: spend, avg_order_cents: Math.round(spend / c.orders.length),
    cadence_status: gap == null ? 'on_track' : ratio >= 3 ? 'lapsed' : ratio >= 1.5 ? 'slipping' : ratio >= 1 ? 'due' : 'on_track',
    weekly_orders_8w: weekly8, sms_opt_in: null, sms_consent_source: null, preferred_pickup: null,
  };
}).sort((a, b) => b.spend_90d_cents - a.spend_90d_cents).slice(0, 150);
const repeaters = [...byCust.values()].filter((c) => c.orders.length > 1).length;
const customersFile = { meta: meta('Customers grouped from the last 90 days of WooCommerce orders. Business name or first name and last initial; no emails or phones. Tier, tax-exempt, and texting consent are not read yet.', NO_STORE), customers, applications: [] };

const inventory = {
  meta: meta('WooCommerce product stock (live).', NO_STORE),
  items: products.flatMap((p) => {
    if (p.stock_status === 'outofstock') return [{ product_id: p.id, name: p.name, category: p.categories?.[0]?.name || 'Other', state: 'out_of_stock', qty: 0, real_flag: true, note: 'Marked out of stock in the catalog', reorder: null }];
    if (p.manage_stock && p.stock_quantity != null && p.stock_quantity <= 5) return [{ product_id: p.id, name: p.name, category: p.categories?.[0]?.name || 'Other', state: 'low', qty: p.stock_quantity, real_flag: true, note: 'Five or fewer left', reorder: null }];
    return [];
  }),
};

const shipOrders = orders.filter((o) => o.fulfillment.type === 'ship' && ['completed', 'processing', 'on-hold'].includes(o._wc_status)).slice(0, 50);
const shipments = {
  meta: meta('WooCommerce orders that ship (live). Carrier labels and tracking are not read yet.', NO_STORE),
  shipments: shipOrders.map((o) => ({ id: 'shp_' + o.number, order_id: o.id, order_number: o.number, customer_label: o.customer_label, carrier: null, service: null, state: o._wc_status === 'completed' ? 'shipped' : 'to_ship', tracking: null, created_at: o.created_at, weight_oz: null })),
  pickup_ready: [],
};

const sampleInt = readSample('integrations.json');
const seenMethod = (k) => methods.some((m) => m.key === k && m.count > 0);
const LIVE = {
  woocommerce: 'WooCommerce store, read-only key connected',
  ...(orders.some((o) => o.gang_sheets > 0) ? { kixxl: 'Kixxl gang sheet orders are arriving in the store' } : {}),
  ...(seenMethod('paypal') ? { paypal: 'PayPal orders seen in the last 28 days' } : {}),
  ...(seenMethod('apple_pay') || seenMethod('google_pay') ? { wallets: 'Apple Pay or Google Pay orders seen in the last 28 days' } : {}),
};
const integrations = { ...sampleInt, meta: meta('Statuses derived from the live store orders.', NO_STORE), integrations: sampleInt.integrations.map((i) => LIVE[i.key] ? { ...i, status: 'live', status_label: 'Live today', need: LIVE[i.key] } : i) };

const lastFullEnd = lastFull ? addDays(lastFull.week_start, 6) : today;
const wkSheets = lastFull ? sheetsIn(lastFull.week_start, lastFullEnd) : 0;
const pwSheets = priorFull ? sheetsIn(priorFull.week_start, addDays(priorFull.week_start, 6)) : 0;
const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
const money = (c) => '$' + Math.round(c / 100).toLocaleString('en-US');
const wowPct = lastFull && priorFull ? pct(lastFull.total_cents, priorFull.total_cents) : null;
const slipping = customers.filter((c) => c.cadence_status === 'slipping' || c.cadence_status === 'lapsed');
const report = {
  summary: {
    went_up: [...(sheetsCur >= sheetsPrior * (parseInt(today.slice(8), 10) / new Date(Date.UTC(+curYm.slice(0, 4), +curYm.slice(5, 7), 0)).getUTCDate()) ? [`${monthName(curYm)} is ahead of ${monthName(priorYm)}'s pace: ${sheetsCur} gang sheets so far against ${sheetsPrior} in all of ${monthName(priorYm)}.`] : []), ...by_category_28d.filter((c) => c.prev_period_cents && pct(c.revenue_cents, c.prev_period_cents) > 5).slice(0, 2).map((c) => `${c.category} is up ${Math.round(pct(c.revenue_cents, c.prev_period_cents))}% on the 28 days before.`)],
    needs_attention: [...(wowPct != null && wowPct < 0 ? [`Web sales were ${money(lastFull.total_cents)}, down ${Math.abs(wowPct)}% on the week before.`] : []), ...(slipping.length ? [`${slipping.length} repeat ${slipping.length === 1 ? 'customer has' : 'customers have'} gone quiet past their usual gap.`] : [])],
    note: `Store (Shopkeep) sales are not included. ${monthName(curYm)} is at ${sheetsCur} gang sheets so far, ${monthName(priorYm)} finished at ${sheetsPrior}. Sales include shipping charges and exclude tax.`,
    next_week: [...slipping.slice(0, 2).map((c) => `Call ${c.label}. Usual order gap is ${c.typical_gap_days} days and it has been ${c.days_since_last_order}.`), 'Connect Shopkeep so store sales show here.'],
  },
  week_label: lastFull ? `${lastFull.week_start} to ${lastFullEnd}` : '',
  week_start: lastFull?.week_start || null,
  week_end: lastFullEnd,
  headline: { total_cents: lastFull?.total_cents || 0, prior_total_cents: priorFull?.total_cents || 0, web_cents: lastFull?.web_cents || 0, store_cents: null, orders: lastFull?.orders || 0 },
  gang_sheets: { this_week: wkSheets, prior_week: pwSheets, month_to_date: sheetsCur, september_baseline: sheetsPrior, month_label: monthName(curYm), prior_label: monthName(priorYm), month_to_date_real: true, weekly_split_sample: false },
  by_category: by_category_28d,
  top_accounts: customers.slice(0, 5).map((c) => ({ label: c.label, tier: c.tier, spend_90d_cents: c.spend_90d_cents, last_order_at: c.last_order_at, cadence_status: c.cadence_status })),
  reorders_due: slipping.slice(0, 5).map((c) => ({ label: c.label, days_since_last_order: c.days_since_last_order, typical_gap_days: c.typical_gap_days, cadence_status: c.cadence_status })),
  review_requests: { sent: null },
  reprints: { this_week: null },
  notes: ['Orders, sales, and gang sheet counts come from WooCommerce. Store sales, texts, and reprints are not connected yet.'],
};
report.meta = meta('Derived from live WooCommerce orders.', NO_STORE);
kpis.scorecard = {
  gang_sheets_per_month: { value: sheetsCur, baseline: sheetsPrior, real: true },
  reseller_share_of_orders_pct: { value: null, note: 'Reseller tier is not read from the store yet' },
  repeat_order_rate_pct: { value: byCust.size ? Math.round((repeaters / byCust.size) * 100) : null, real: true, note: 'Share of customers with more than one order in 90 days' },
  reprints_per_month: { value: null, note: 'No reprint log yet' },
  status_calls_per_week: { value: null, note: 'Desiree estimate needed' },
  order_to_ready_minutes: { value: null, note: 'Ready time is not recorded yet' },
};

let social = { meta: meta('Instagram is not connected yet.', { connected: false }), followers: null, posts: [] };
if (igToken()) {
  try {
    const prof = await igCall('/me', { fields: 'username,followers_count,media_count' });
    const media = (await igCall('/me/media', { limit: '12', fields: 'id,media_type,permalink,timestamp,caption,like_count,comments_count' })).data || [];
    const posts = await Promise.all(media.map(async (m) => {
      const ins = {};
      try {
        for (const r of (await igCall(`/${m.id}/insights`, { metric: 'reach,shares,saved' })).data || []) ins[r.name] = r.values?.[0]?.value ?? null;
      } catch (e) {
        console.warn(`Instagram insights skipped for ${m.id}: ${e.message.slice(0, 100)}`);
      }
      return { id: m.id, type: m.media_type, url: m.permalink, at: m.timestamp, caption: (m.caption || '').slice(0, 120), likes: m.like_count ?? null, comments: m.comments_count ?? null, reach: ins.reach ?? null, shares: ins.shares ?? null, saves: ins.saved ?? null };
    }));
    social = { meta: meta('Instagram API (live, read-only).', { connected: true }), username: prof.username, followers: prof.followers_count, posts };
  } catch (e) {
    console.warn('Instagram API call failed: ' + e.message.slice(0, 120));
    social.meta = meta('Instagram API call failed: ' + e.message.slice(0, 120), { connected: false });
  }
} else {
  const snapFile = path.join(ROOT, 'data-live', 'social-browser.json');
  if (fs.existsSync(snapFile)) {
    try {
      const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
      if (Number.isFinite(snap.followers)) {
        social = { meta: meta(`Instagram follower count read from the logged-in profile on ${snap.as_of}. Not live; reach is not connected.`, { connected: true, snapshot: true }), username: snap.username, followers: snap.followers, as_of: snap.as_of, posts: [] };
      }
    } catch (e) {
      console.warn('Instagram snapshot unreadable: ' + e.message.slice(0, 100));
    }
  }
}

const clean = ({ _wc_status, _date, ...o }) => o;
const writes = {
  'sales.json': sales,
  'payments.json': payments,
  'orders.json': { meta: meta('WooCommerce orders (live, read-only). Customer labels are business name or first name and last initial. No emails or phones.', { ...NO_STORE, statuses: ['new', 'art_check', 'printing', 'on_hold', 'payment_failed', 'ready', 'picked_up', 'shipped'] }), orders: orders.filter((o) => o.status && !(o.status === 'payment_failed' && o._date < addDays(today, -2))).slice(0, 300).map(clean) },
  'queue.json': { meta: meta('Open WooCommerce orders from the last 7 days (live). Promise times and risk are not computed yet.', NO_STORE), queue, counts: { open: queue.length, done_today: kpis.today.done_today, ready_waiting: null, at_risk: null } },
  'kpis.json': kpis,
  'gangsheets.json': gangsheets,
  'customers.json': customersFile,
  'inventory.json': inventory,
  'shipments.json': shipments,
  'integrations.json': integrations,
  'social.json': social,
  'report.json': report,
  'messages.json': {
    meta: meta('Texting service and quote inbox are not connected.', { connected: false }),
    texts_30d: { sent: null, delivered: null, failed: null },
    opt_in: { opted_in: null, opted_out: null, unknown: null, consent_stored: false, note: 'Not connected.' },
    templates: readSample('messages.json').templates,
    log: [],
    quotes: [],
    review_requests: { sent_30d: null, note: 'Not connected.' },
  },
};
fs.mkdirSync(OUT, { recursive: true });
for (const [f, data] of Object.entries(writes)) fs.writeFileSync(path.join(OUT, f), JSON.stringify(data, null, 2));
console.log(`Pulled ${rawOrders.length} orders (${since} to ${today}), ${products.length} products -> data-live/dashboard/ (${Object.keys(writes).join(', ')})`);
