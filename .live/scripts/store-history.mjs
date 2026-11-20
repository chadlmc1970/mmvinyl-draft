// Keep dashboard history in Postgres so trends can be shown later.
// Env: DATABASE_URL. Needs psql on the PATH (no npm packages). Schema: deploy/db/001_init.sql.
// Usage:
//   node store-history.mjs <folder with the dashboard *.json>    upsert orders and lines, overwrite today's snapshot
//   node store-history.mjs --backfill <orders file>              load a full order pull, rebuild past days from orders
// The refresh calls it with `|| echo '::warning::...'`, so a failure here never stops the dashboard.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const url = process.env.DATABASE_URL || '';
const backfill = process.argv[2] === '--backfill';
const arg = process.argv[backfill ? 3 : 2];
if (!url || !arg) {
  console.error('store-history: missing DATABASE_URL or input');
  process.exit(2);
}

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const int = (v) => (Number.isFinite(v) ? Math.round(v) : null);
const WC = { printing: 'processing', picked_up: 'completed', on_hold: 'on-hold', payment_failed: 'failed' };

function orderRows(list) {
  const orders = [], lines = [];
  for (const o of list) {
    orders.push({
      id: o.id, number: o.number, created_at: o.created_at, shop_date: o.created_at.slice(0, 10),
      status: o.status ?? null, wc_status: o.wc_status ?? WC[o.status] ?? null,
      channel: o.channel, source_system: o.source_system, customer_id: o.customer_id ?? null, customer_label: o.customer_label ?? null,
      subtotal_cents: int(o.subtotal_cents), total_cents: int(o.total_cents),
      payment_method: o.payment?.method ?? null, payment_state: o.payment?.state ?? null, payment_gateway: o.payment?.gateway ?? null,
      fulfillment_type: o.fulfillment?.type ?? null, gang_sheets: int(o.gang_sheets) ?? 0,
    });
    (o.lines || []).forEach((l, i) => lines.push({
      order_id: o.id, line_no: i + 1, product_id: int(l.product_id), name: l.name ?? null, category: l.category ?? null,
      qty: int(l.qty) ?? 0, unit_price_cents: int(l.unit_price_cents),
    }));
  }
  return { orders, lines };
}

function literal(value) {
  const text = JSON.stringify(value);
  let tag;
  do tag = '$mm' + randomBytes(6).toString('hex') + '$'; while (text.includes(tag));
  return `${tag}${text}${tag}::jsonb`;
}

const ORDER_COLS = ['id', 'number', 'created_at', 'shop_date', 'status', 'wc_status', 'channel', 'source_system', 'customer_id', 'customer_label', 'subtotal_cents', 'total_cents', 'payment_method', 'payment_state', 'payment_gateway', 'fulfillment_type', 'gang_sheets'];
const LINE_COLS = ['order_id', 'line_no', 'product_id', 'name', 'category', 'qty', 'unit_price_cents'];
const SNAP_COLS = ['snap_date', 'as_of', 'source', 'orders_today', 'revenue_today_cents', 'web_cents', 'store_cents', 'orders_web', 'orders_store', 'gang_sheets_today', 'gang_sheets_month', 'open_in_queue', 'done_today', 'at_risk', 'customers_on_track', 'customers_due', 'customers_slipping', 'customers_lapsed', 'products', 'out_of_stock', 'kpis'];

function upsertOrdersSql({ orders, lines }) {
  const out = [];
  for (let i = 0; i < orders.length; i += 500) {
    const chunk = orders.slice(i, i + 500);
    const ids = new Set(chunk.map((o) => o.id));
    out.push(`INSERT INTO orders (${ORDER_COLS.join(', ')})
SELECT ${ORDER_COLS.map((c) => 'r.' + c).join(', ')} FROM jsonb_populate_recordset(NULL::orders, ${literal(chunk)}) r
ON CONFLICT (id) DO UPDATE SET ${ORDER_COLS.slice(1).map((c) => c === 'wc_status' ? 'wc_status = COALESCE(EXCLUDED.wc_status, orders.wc_status)' : `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now();`);
    out.push(`DELETE FROM order_lines WHERE order_id IN (SELECT jsonb_array_elements_text(${literal([...ids])}));`);
    const ls = lines.filter((l) => ids.has(l.order_id));
    if (ls.length) out.push(`INSERT INTO order_lines (${LINE_COLS.join(', ')})
SELECT ${LINE_COLS.map((c) => 'r.' + c).join(', ')} FROM jsonb_populate_recordset(NULL::order_lines, ${literal(ls)}) r;`);
  }
  return out;
}

function todaySnapshot(dir) {
  const f = (n) => read(join(dir, n + '.json'));
  const kpis = f('kpis'), sales = f('sales'), gs = f('gangsheets'), cust = f('customers'), inv = f('inventory'), queue = f('queue');
  const asOf = kpis.meta.as_of;
  const date = asOf.slice(0, 10);
  const day = sales.daily.find((d) => d.date === date) || {};
  const monthKey = Object.keys(gs.month_totals || {}).find((k) => k === date.slice(0, 7) + '_to_date');
  const cadence = (s) => cust.customers.filter((c) => c.cadence_status === s).length;
  return {
    snap_date: date, as_of: asOf, source: 'refresh',
    orders_today: int(kpis.today.orders_today), revenue_today_cents: int(kpis.today.revenue_today_cents),
    web_cents: int(day.web_cents), store_cents: int(day.store_cents), orders_web: int(day.orders_web), orders_store: int(day.orders_store),
    gang_sheets_today: gs.today?.date === date ? int(gs.today.total_so_far) : null, gang_sheets_month: monthKey ? int(gs.month_totals[monthKey].total) : null,
    open_in_queue: int(kpis.today.open_in_queue), done_today: int(kpis.today.done_today),
    at_risk: int(kpis.today.at_risk) ?? queue.queue.filter((q) => q.risk).length,
    customers_on_track: cadence('on_track'), customers_due: cadence('due'), customers_slipping: cadence('slipping'), customers_lapsed: cadence('lapsed'),
    products: int(kpis.real?.products), out_of_stock: inv.items.filter((i) => i.state === 'out_of_stock').length,
    kpis,
  };
}

// Past days rebuilt from stored orders, counted the same way as pull-live.mjs (completed, processing, on-hold).
// Rows written by a refresh are never touched. Today is left to the refresh.
const REBUILD_SQL = `INSERT INTO daily_snapshots (snap_date, source, orders_today, revenue_today_cents, web_cents, orders_web, gang_sheets_today, gang_sheets_month)
SELECT d, 'orders', n, cents, cents, n, sheets, SUM(sheets) OVER (PARTITION BY date_trunc('month', d) ORDER BY d)
FROM (
  SELECT d::date AS d, COUNT(o.id)::int AS n, COALESCE(SUM(o.total_cents), 0)::int AS cents, COALESCE(SUM(o.gang_sheets), 0)::int AS sheets
  FROM generate_series((SELECT MIN(shop_date) FROM orders), (now() AT TIME ZONE 'America/Chicago')::date - 1, interval '1 day') d
  LEFT JOIN orders o ON o.shop_date = d::date AND o.status IN ('printing', 'picked_up', 'on_hold')
  GROUP BY d
) x
ON CONFLICT (snap_date) DO UPDATE SET orders_today = EXCLUDED.orders_today, revenue_today_cents = EXCLUDED.revenue_today_cents, web_cents = EXCLUDED.web_cents,
  orders_web = EXCLUDED.orders_web, gang_sheets_today = EXCLUDED.gang_sheets_today, gang_sheets_month = EXCLUDED.gang_sheets_month, updated_at = now()
WHERE daily_snapshots.source = 'orders';`;

let rows, snapshot = null, asOf = null;
if (backfill) {
  const data = read(arg);
  rows = orderRows(data.orders);
  asOf = data.as_of ?? null;
} else {
  rows = orderRows(read(join(arg, 'orders.json')).orders);
  snapshot = todaySnapshot(arg);
  asOf = snapshot.as_of;
}

const sql = ['BEGIN;', ...upsertOrdersSql(rows)];
if (snapshot) sql.push(`INSERT INTO daily_snapshots (${SNAP_COLS.join(', ')})
SELECT ${SNAP_COLS.map((c) => 'r.' + c).join(', ')} FROM jsonb_populate_record(NULL::daily_snapshots, ${literal(snapshot)}) r
ON CONFLICT (snap_date) DO UPDATE SET ${SNAP_COLS.slice(1).map((c) => `${c} = EXCLUDED.${c}`).join(', ')}, updated_at = now();`);
if (backfill) sql.push(REBUILD_SQL);
sql.push(`INSERT INTO refresh_log (kind, run_id, data_as_of, orders_written, lines_written, snapshots_written)
VALUES (${backfill ? "'backfill'" : "'refresh'"}, ${process.env.GITHUB_RUN_ID ? `'${String(process.env.GITHUB_RUN_ID).replace(/\D/g, '')}'` : 'NULL'}, ${asOf ? `'${asOf.replace(/[^0-9T:+\-.Z]/g, '')}'` : 'NULL'}, ${rows.orders.length}, ${rows.lines.length}, ${backfill ? "(SELECT COUNT(*) FROM daily_snapshots WHERE source = 'orders')" : 1});`);
sql.push('COMMIT;');

const res = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', url], { input: sql.join('\n'), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
const redact = (s) => String(s || '').replace(/postgres(ql)?:\/\/\S+/g, '[database url]').trim().slice(0, 400);
if (res.error || res.status !== 0) {
  console.error('store-history: ' + (res.error ? res.error.message : redact(res.stderr) || `psql exit ${res.status}`));
  process.exit(1);
}
console.log(`store-history: ${rows.orders.length} orders, ${rows.lines.length} lines${snapshot ? `, snapshot ${snapshot.snap_date}` : ', past days rebuilt from orders'}`);
