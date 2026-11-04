// The social learning loop: score each post, compare kinds of posts, and turn the results into rules for the next batch.
// Pure functions only, so the same inputs always give the same scorecard.

export const SETTLE_HOURS = 48;
export const FINAL_HOURS = 168;
export const MIN_POSTS = 12;
export const MIN_DAYS = 21;
export const MIN_PER_KIND = 3;
export const MORE_AT = 1.25;
export const LESS_AT = 0.75;
export const TEST_QUEUE = ['Customer reviews', 'New and restocked products', 'Shop numbers', 'Customer work', 'Behind the scenes'];

const ACTION_TYPES = new Set(['reactions', 'likes', 'comments', 'shares', 'saves', 'saved', 'clicks', 'replies']);
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TZ = 'America/Chicago';
const HOUR = 3600000;

export function readMetrics(metrics) {
  const by = {};
  for (const m of metrics || []) {
    const v = Number(m.value);
    if (m.type && Number.isFinite(v)) by[m.type] = v;
  }
  const actions = Object.entries(by).reduce((n, [k, v]) => (ACTION_TYPES.has(k) ? n + v : n), 0);
  const seen = by.reach > 0 ? by.reach : by.impressions > 0 ? by.impressions : by.views > 0 ? by.views : 0;
  return { seen, actions, reactions: by.reactions ?? by.likes ?? 0, comments: by.comments ?? 0, shares: by.shares ?? 0, saves: by.saves ?? by.saved ?? 0, clicks: by.clicks ?? 0 };
}

export const scoreOf = (seen, actions) => (seen > 0 ? Math.round((actions / seen) * 1000) / 10 : null);

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

function chicago(iso) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: 'numeric', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

export function weekStart(iso) {
  const c = chicago(iso);
  const d = new Date(c.date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((c.weekday + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function slotOf(iso) {
  const h = chicago(iso).hour;
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export function orderChannel(o) {
  const s = `${o.utm_source || ''} ${o.referrer || ''}`.toLowerCase();
  if (/instagram|(^|\s)ig(\s|$)/.test(s)) return 'instagram';
  if (/facebook|fb\.com|(^|\s)fb(\s|$)/.test(s)) return 'facebook';
  return null;
}

// Results are frozen at 48 hours and again at 7 days, so an old post is not favored just for having had longer to collect likes.
export function freezeSnapshots(history, posts, now) {
  const snaps = { ...(history.snapshots || {}) };
  for (const p of posts) {
    if (!p.at || p.status !== 'sent') continue;
    const age = (now - Date.parse(p.at)) / HOUR;
    const s = { ...(snaps[p.key] || {}) };
    const live = { seen: p.seen, actions: p.actions };
    if (p.seen > 0 && age >= SETTLE_HOURS && !s.h48) s.h48 = live;
    if (p.seen > 0 && age >= FINAL_HOURS && !s.d7) s.d7 = live;
    if (Object.keys(s).length) snaps[p.key] = s;
  }
  return snaps;
}

export function settledScore(snapshot) {
  const s = snapshot?.d7 || snapshot?.h48;
  return s ? scoreOf(s.seen, s.actions) : null;
}

function kinds(post) {
  return {
    topic: post.topic,
    format: post.format,
    hook: post.hook,
    day: post.at ? DAY_NAMES[chicago(post.at).weekday] : null,
    time: post.at ? slotOf(post.at) : null,
  };
}

export function compareKinds(posts) {
  const scored = posts.filter((p) => p.score != null);
  const overall = mean(scored.map((p) => p.score));
  const out = {};
  for (const dim of ['topic', 'format', 'hook', 'day', 'time']) {
    const groups = new Map();
    for (const p of scored) {
      const v = kinds(p)[dim];
      if (!v) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(p.score);
    }
    out[dim] = [...groups].map(([value, xs]) => {
      const avg = mean(xs);
      return { value, posts: xs.length, avg_score: round1(avg), vs_average: overall ? Math.round((avg / overall) * 100) / 100 : null };
    }).sort((a, b) => b.avg_score - a.avg_score);
  }
  return { overall: round1(overall), kinds: out };
}

const DIM_LABEL = { topic: 'topic', format: 'format', hook: 'hook', day: 'day', time: 'time of day' };

export function makeRules(compared) {
  const rules = [];
  for (const [dim, rows] of Object.entries(compared.kinds)) {
    if (rows.length < 2) continue;
    for (const r of rows) {
      if (r.posts < MIN_PER_KIND || r.vs_average == null) continue;
      const action = r.vs_average >= MORE_AT ? 'more' : r.vs_average <= LESS_AT ? 'less' : null;
      if (!action) continue;
      rules.push({ dim, label: DIM_LABEL[dim], value: r.value, action, vs_average: r.vs_average, posts: r.posts });
    }
  }
  return rules.sort((a, b) => Math.abs(b.vs_average - 1) - Math.abs(a.vs_average - 1));
}

export function nextTest(posts) {
  const tried = new Set(posts.map((p) => p.topic));
  return TEST_QUEUE.find((t) => !tried.has(t)) || null;
}

export function phaseOf(posts, launchedAt, now) {
  const settled = posts.filter((p) => p.score != null).length;
  const days = Math.max(0, Math.floor((now - Date.parse(launchedAt)) / (24 * HOUR)));
  return { name: settled >= MIN_POSTS && days >= MIN_DAYS ? 'learning' : 'baseline', settled, need_posts: MIN_POSTS, days, need_days: MIN_DAYS };
}

export function weeklyScores(posts, orders) {
  const weeks = new Map();
  const row = (w) => {
    if (!weeks.has(w)) weeks.set(w, { week: w, sent: 0, scores: [], orders: 0, sales_cents: 0 });
    return weeks.get(w);
  };
  for (const p of posts) {
    if (p.status !== 'sent' || !p.at) continue;
    const r = row(weekStart(p.at));
    r.sent += 1;
    if (p.score != null) r.scores.push(p.score);
  }
  for (const o of orders) {
    const r = row(weekStart(o.at));
    r.orders += 1;
    r.sales_cents += o.cents;
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).map(({ scores, ...r }) => ({ ...r, avg_score: round1(mean(scores)) }));
}

// The recursive part: each week's rules are saved, and the following week's score shows whether they helped.
export function updateRuleLog(log, rules, weekly, thisWeek) {
  const next = (log || []).map((e) => ({ ...e }));
  const scoreFor = (w) => weekly.find((x) => x.week === w)?.avg_score ?? null;
  for (const e of next) {
    if (e.score_after != null || e.week >= thisWeek) continue;
    const later = weekly.find((x) => x.week > e.week && x.avg_score != null);
    if (!later) continue;
    e.score_after = later.avg_score;
    e.score_before = scoreFor(e.week);
    e.helped = e.score_before == null ? null : later.avg_score > e.score_before;
  }
  if (rules.length && !next.some((e) => e.week === thisWeek)) {
    next.push({ week: thisWeek, rules: rules.map(({ dim, value, action }) => ({ dim, value, action })), score_before: null, score_after: null, helped: null });
  }
  return next;
}

export function nextBatch(phase, rules, test) {
  if (phase.name === 'baseline') {
    return { size: 5, mode: 'Even mix', tests: test ? [test] : [], more: [], less: [] };
  }
  return {
    size: 5,
    mode: 'Lean toward what works',
    tests: test ? [test] : [],
    more: rules.filter((r) => r.action === 'more').map((r) => r.value),
    less: rules.filter((r) => r.action === 'less').map((r) => r.value),
  };
}

export function priorPostsBaseline(nodes, launchedAt) {
  const before = nodes.filter((n) => n.status === 'sent' && n.sentAt && Date.parse(n.sentAt) < Date.parse(launchedAt));
  const out = {};
  for (const ch of ['facebook', 'instagram']) {
    const rows = before.filter((n) => n.channelService === ch).map((n) => readMetrics(n.metrics)).filter((m) => m.seen > 0);
    out[ch] = rows.length ? { posts: rows.length, avg_seen: Math.round(mean(rows.map((m) => m.seen))), avg_score: round1(mean(rows.map((m) => scoreOf(m.seen, m.actions)))) } : null;
  }
  return out;
}
