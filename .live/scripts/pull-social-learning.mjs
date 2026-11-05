#!/usr/bin/env node
// Post results from Buffer and social orders from WooCommerce into data-live/dashboard/social-learning.json (git-ignored).
// Frozen results and the rule log live in data-live/social-history.json so each run builds on the last one.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readMetrics, scoreOf, freezeSnapshots, settledScore, compareKinds, makeRules, nextTest, phaseOf, weeklyScores, updateRuleLog, nextBatch, priorPostsBaseline, orderChannel, weekStart } from './social-learning-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data-live', 'dashboard', 'social-learning.json');
const HISTORY = path.join(ROOT, 'data-live', 'social-history.json');
const LEDGER = path.join(ROOT, 'deploy', 'social-ledger.json');
const ORG = '6aeb89168282ac69bc7917af';
const API = /^http:\/\/127\.0\.0\.1:/.test(process.env.BUFFER_BASE || '') ? process.env.BUFFER_BASE : 'https://api.buffer.com';
const WC = process.env.WC_BASE || 'https://mandmvinyl.com/wp-json/wc/v3';
const IMAGE_BASE = 'https://chadlmc1970.github.io/mmvinyl-draft/';
const BASELINE_DAYS = 30;
const SKIP_STATUS = new Set(['cancelled', 'failed', 'refunded', 'pending', 'trash']);

function bufferKey() {
  if (process.env.BUFFER_KEY) return process.env.BUFFER_KEY;
  try {
    return execFileSync('security', ['find-generic-password', '-s', 'mm-vinyl-buffer-key', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function wooAuth() {
  const file = path.join(ROOT, '.env.woo');
  if (!fs.existsSync(file)) return null;
  const env = Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n').map((l) => l.split('=')).filter((p) => p.length >= 2).map(([k, ...v]) => [k.trim(), v.join('=').replace(/[\s"']/g, '')]));
  return env.WC_KEY && env.WC_SECRET ? 'Basic ' + Buffer.from(`${env.WC_KEY}:${env.WC_SECRET}`).toString('base64') : null;
}

async function bufferPosts(key) {
  const query = `query ($input: PostsInput!, $first: Int, $after: String) {
    posts(input: $input, first: $first, after: $after) {
      edges { node { id status sentAt dueAt channelService externalLink metrics { type value } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const nodes = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, variables: { input: { organizationId: ORG }, first: 100, after } }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`Buffer HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error('Buffer: ' + json.errors[0].message);
    const { edges, pageInfo } = json.data.posts;
    nodes.push(...edges.map((e) => e.node));
    if (!pageInfo.hasNextPage) break;
    after = pageInfo.endCursor;
  }
  return nodes;
}

async function socialOrders(auth, since) {
  const rows = [];
  for (let page = 1; page <= 60; page++) {
    const q = new URLSearchParams({ per_page: '100', page: String(page), orderby: 'date', order: 'asc', after: since });
    const res = await fetch(`${WC}/orders?${q}`, { headers: { Authorization: auth }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`WooCommerce HTTP ${res.status}`);
    const batch = await res.json();
    rows.push(...batch);
    if (page >= Number(res.headers.get('x-wp-totalpages') || 1)) break;
  }
  const out = [];
  for (const o of rows) {
    if (SKIP_STATUS.has(o.status)) continue;
    const meta = Object.fromEntries((o.meta_data || []).filter((m) => m.key.startsWith('_wc_order_attribution_')).map((m) => [m.key.replace('_wc_order_attribution_', ''), m.value]));
    const channel = orderChannel(meta);
    if (channel) out.push({ at: (o.date_created_gmt || o.date_created) + 'Z', channel, cents: Math.round(parseFloat(o.total || '0') * 100), post: meta.utm_content || null });
  }
  return out;
}

const readJson = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fallback;
  }
};

const write = (data) => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
};

const meta = (note, extra = {}) => ({ sample: false, source: note, generated_at: new Date().toISOString(), timezone: 'America/Chicago', ...extra });

const MAX_AGE_HOURS = Number(process.env.SOCIAL_MAX_AGE_HOURS) || 0;
const previous = readJson(OUT, null);
if (MAX_AGE_HOURS && previous?.meta?.connected && Date.now() - Date.parse(previous.meta.generated_at) < MAX_AGE_HOURS * 3600000) {
  console.log('Social learning: still fresh, skipped');
  process.exit(0);
}

const key = bufferKey();
if (!key) {
  write({ meta: meta('Buffer key not set.', { connected: false }) });
  console.warn('::warning::Social learning skipped: no Buffer key');
  process.exit(0);
}

const now = Date.now();
const ledger = readJson(LEDGER, { posts: [] });
const history = readJson(HISTORY, {});
let nodes;
try {
  nodes = await bufferPosts(key);
} catch (e) {
  console.warn('::warning::Social learning skipped: ' + e.message.replace(/\s+/g, ' ').slice(0, 120));
  if (previous?.meta?.connected) process.exit(0);
  write({ meta: meta('Buffer could not be read.', { connected: false }) });
  process.exit(0);
}
const byId = new Map(nodes.map((n) => [n.id, n]));

const posts = ledger.posts.map((p) => {
  const channels = {};
  let seen = 0, actions = 0, at = null, sentAny = false, failed = false;
  for (const [ch, id] of Object.entries(p.buffer)) {
    const n = byId.get(id);
    if (!n) { channels[ch] = { status: 'missing' }; continue; }
    const m = readMetrics(n.metrics);
    channels[ch] = { status: n.status, link: n.externalLink, seen: m.seen, actions: m.actions, reactions: m.reactions, comments: m.comments, shares: m.shares, saves: m.saves, clicks: m.clicks };
    seen += m.seen;
    actions += m.actions;
    at = at || n.sentAt || n.dueAt;
    if (n.status === 'sent') sentAny = true;
    if (n.status === 'error') failed = true;
  }
  return { ...p, buffer: undefined, image: IMAGE_BASE + p.image, at, status: failed ? 'error' : sentAny ? 'sent' : Object.values(channels).every((c) => c.status === 'missing') ? 'missing' : 'scheduled', channels, seen, actions, score: null };
});

const snapshots = freezeSnapshots(history, posts, now);
for (const p of posts) {
  p.score = settledScore(snapshots[p.key]);
  p.live_score = scoreOf(p.seen, p.actions);
}

const launched = ledger.launched_at;
const auth = wooAuth();
let allOrders = [];
let ordersRead = !!auth;
if (auth) {
  const since = new Date(Date.parse(launched) - BASELINE_DAYS * 86400000).toISOString().replace(/\.\d+Z$/, '');
  try {
    allOrders = await socialOrders(auth, since);
  } catch (e) {
    console.warn('::warning::Social orders skipped: ' + e.message.replace(/\s+/g, ' ').slice(0, 120));
    if (previous?.meta?.connected) process.exit(0);
    ordersRead = false;
  }
}
const afterLaunch = allOrders.filter((o) => Date.parse(o.at) >= Date.parse(launched));
const beforeLaunch = allOrders.filter((o) => Date.parse(o.at) < Date.parse(launched));
for (const p of posts) {
  const mine = afterLaunch.filter((o) => o.post === p.key);
  p.orders = mine.length;
  p.sales_cents = mine.reduce((n, o) => n + o.cents, 0);
}

const sent = posts.filter((p) => p.status === 'sent');
const phase = phaseOf(sent, launched, now);
const compared = compareKinds(sent);
const rules = phase.name === 'learning' ? makeRules(compared) : [];
const weekly = weeklyScores(posts, afterLaunch);
const thisWeek = weekStart(new Date(now).toISOString());
const ruleLog = updateRuleLog(history.rule_log, rules, weekly, thisWeek);
const sum = (rows, k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
const channelOrders = (rows, ch) => {
  const mine = rows.filter((o) => o.channel === ch);
  return { orders: mine.length, sales_cents: sum(mine, 'cents') };
};

fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
fs.writeFileSync(HISTORY, JSON.stringify({ snapshots, rule_log: ruleLog }, null, 2));

write({
  meta: meta('Buffer post results and WooCommerce order sources (live, read-only).', { connected: true, orders_connected: ordersRead }),
  launched_at: launched,
  phase,
  summary: {
    sent: sent.length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    failed: posts.filter((p) => p.status === 'error').length,
    seen: sum(sent, 'seen'),
    actions: sum(sent, 'actions'),
    score: scoreOf(sum(sent, 'seen'), sum(sent, 'actions')),
    orders: afterLaunch.length,
    sales_cents: sum(afterLaunch, 'cents'),
  },
  before: {
    posts: priorPostsBaseline(nodes, launched),
    order_days: BASELINE_DAYS,
    orders: beforeLaunch.length,
    sales_cents: sum(beforeLaunch, 'cents'),
  },
  orders_by_channel: { instagram: channelOrders(afterLaunch, 'instagram'), facebook: channelOrders(afterLaunch, 'facebook') },
  posts: posts.sort((a, b) => String(a.at).localeCompare(String(b.at))),
  overall_score: compared.overall,
  kinds: compared.kinds,
  rules,
  next_batch: nextBatch(phase, rules, nextTest(ledger.posts)),
  weekly,
  rule_log: ruleLog,
});
console.log(`Social learning: ${sent.length} sent, ${phase.settled} settled, ${afterLaunch.length} social orders`);
