(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;

  var money = function (c) { return OD.money(c, { cents: false }); };
  var plural = function (n, word) { return OD.num(n) + ' ' + word + (n === 1 ? '' : 's'); };
  var when = function (iso) {
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };
  var weekLabel = function (w) { return new Date(w + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }); };
  var STATUS = { sent: 'Sent', scheduled: 'Scheduled', error: 'Failed' };

  function cell(label, valueHtml, note) {
    return '<div class="od-cell"><div class="od-cell__top"><span class="od-cell__label">' + esc(label) + '</span></div><b class="od-cell__value">' + valueHtml + '</b><span class="od-cell__note">' + note + '</span></div>';
  }
  var count = function (n) { return '<span data-od-count="' + n + '">' + OD.num(n) + '</span>'; };

  function perWeek(orders, days) { return days > 0 ? orders / days * 7 : 0; }

  function beforeNote(B) {
    var parts = [];
    if (B.posts.facebook) parts.push('FB ' + B.posts.facebook.avg_score);
    if (B.posts.instagram) parts.push('IG ' + B.posts.instagram.avg_score);
    return parts.length ? 'Usual: ' + parts.join(', ') : 'No earlier posts to compare';
  }

  function seenCell(c) {
    if (!c || c.status !== 'sent') return '<span class="od-soc-dim">Not yet</span>';
    return c.seen ? OD.num(c.seen) : '<span class="od-soc-dim">Counting</span>';
  }

  function scoreCell(p) {
    if (p.score != null) return '<b>' + p.score + '</b>';
    if (p.status === 'sent') return '<span class="od-soc-dim">After 48 hours</span>';
    return '<span class="od-soc-dim">Not yet</span>';
  }

  function resultsHtml(S) {
    var M = S.summary, B = S.before;
    var seenNote = B.posts.facebook ? 'Usual FB post: ' + OD.num(B.posts.facebook.avg_seen) : 'Across Instagram and Facebook';
    var strip = '<section class="od-card od-card--strip"><div class="od-cells">' +
      cell('Posts sent', count(M.sent), OD.num(M.scheduled) + ' more scheduled' + (M.failed ? ', ' + M.failed + ' failed' : '')) +
      cell('Times seen', count(M.seen), seenNote) +
      cell('Reaction score', M.score == null ? '<span class="od-soc-dim">Counting</span>' : M.score, beforeNote(B)) +
      (S.meta.orders_connected ? cell('Orders from social', count(M.orders), money(M.sales_cents) + ' in sales') : cell('Orders from social', '<span class="od-soc-dim">Not read</span>', 'Store orders could not be read')) +
      '</div></section>';
    var rows = S.posts.map(function (p, i) {
      return '<tr class="od-tr" tabindex="0" data-soc-post="' + i + '">' +
        '<td class="od-soc-pic"><img src="' + esc(p.image) + '" alt="" loading="lazy"></td>' +
        '<td><b>' + esc(p.title) + '</b><span class="od-soc-sub">' + esc(p.topic) + (p.is_test ? ', test' : '') + '</span></td>' +
        '<td class="od-soc-hide">' + (p.at ? esc(when(p.at)) : '') + '</td>' +
        '<td><span class="od-soc-status od-soc-status--' + esc(p.status) + '">' + esc(STATUS[p.status] || p.status) + '</span></td>' +
        '<td class="num">' + seenCell(p.channels.instagram) + '</td>' +
        '<td class="num">' + seenCell(p.channels.facebook) + '</td>' +
        '<td class="num">' + scoreCell(p) + '</td></tr>';
    }).join('');
    var table = OD.card('Every post', '<table class="od-mini-table od-gang-table od-soc-table"><thead><tr><th colspan="2">Post</th><th class="od-soc-hide">When</th><th>Status</th><th class="num">Instagram</th><th class="num">Facebook</th><th class="num">Score</th></tr></thead><tbody>' + rows + '</tbody></table>',
      { sub: 'Times each post was seen. Click a row for the details.', cls: 'od-gang-card' });
    var days = S.phase.days;
    var since = days >= 7 ? perWeek(M.orders, days).toFixed(1) : null;
    var before = perWeek(B.orders, B.order_days).toFixed(1);
    var ig = S.orders_by_channel.instagram, fb = S.orders_by_channel.facebook;
    var side = !S.meta.orders_connected ? OD.card('Is it bringing in orders?', '<p class="od-note">Store orders could not be read on the last refresh.</p>', { cls: 'od-gang-card' }) : OD.card('Is it bringing in orders?',
      '<div class="od-soc-compare"><div><b>' + before + '</b><span>Orders a week before, the number to beat</span></div>' +
      '<div><b>' + (since == null ? 'Soon' : since) + '</b><span>' + (since == null ? 'Orders a week now, after the first full week' : 'Orders a week since posts started') + '</span></div></div>' +
      OD.charts.rank([
        { label: 'Instagram', value: ig.orders, display: plural(ig.orders, 'order') + ', ' + money(ig.sales_cents) },
        { label: 'Facebook', value: fb.orders, display: plural(fb.orders, 'order') + ', ' + money(fb.sales_cents) }
      ]) +
      '<p class="od-fine">Web orders that arrived from Instagram or Facebook. Store and phone orders are not counted.</p>',
      { cls: 'od-gang-card' });
    return strip + '<div class="od-gang-main">' + table + side + '</div>';
  }

  function channelLine(name, c) {
    if (!c || c.status === 'missing') return '';
    var facts = c.status === 'sent'
      ? [OD.num(c.seen || 0) + ' seen', plural(c.reactions || 0, 'reaction'), plural(c.comments || 0, 'comment'), plural(c.shares || 0, 'share'), (c.saves ? plural(c.saves, 'save') : ''), plural(c.clicks || 0, 'click')].filter(Boolean)
      : [STATUS[c.status] || c.status];
    return '<div class="od-soc-chan"><b>' + esc(name) + '</b><span>' + esc(facts.join(', ')) + '</span>' +
      (c.link ? '<a href="' + esc(c.link) + '" target="_blank" rel="noopener">Open post</a>' : '') + '</div>';
  }

  function postDrawer(p) {
    return '<div class="od-drawer__top"><h2>' + esc(p.title) + '</h2></div>' +
      '<p class="od-drawer__who">' + (p.at ? esc(when(p.at)) : '') + '</p>' +
      '<p class="od-drawer__facts"><span>' + esc(p.topic) + '</span><span>' + esc(p.format) + '</span><span>' + esc(p.hook) + '</span></p>' +
      '<img class="od-soc-full" src="' + esc(p.image) + '" alt="' + esc(p.title) + '">' +
      channelLine('Instagram', p.channels.instagram) + channelLine('Facebook', p.channels.facebook) +
      (p.orders ? '<p class="od-note">' + plural(p.orders, 'order') + ' tied to this post, ' + money(p.sales_cents) + '.</p>' : '');
  }

  function step(n, label, text, state) {
    return '<li class="od-soc-step od-soc-step--' + state + '"><b>' + n + '</b><div><strong>' + esc(label) + '</strong><span>' + esc(text) + '</span></div></li>';
  }

  function meter(label, have, need) {
    var pct = Math.min(100, Math.round(have / need * 100));
    return '<div class="od-soc-meter"><div><span>' + esc(label) + '</span><b>' + have + ' of ' + need + '</b></div><i style="--w:' + pct + '%"></i></div>';
  }

  function loopCard(S) {
    var P = S.phase, learning = P.name === 'learning';
    return OD.card('How the loop works', '<ol class="od-soc-steps">' +
      step(1, 'Post', 'Every post is logged with its topic, format, and hook.', 'on') +
      step(2, 'Measure', 'Results lock in at 48 hours and 7 days, so posts are compared fairly.', 'on') +
      step(3, 'Learn', 'Each kind of post is compared with the average.', learning ? 'on' : 'wait') +
      step(4, 'Change', 'The winners shape the next batch, and one post stays a new test.', learning ? 'on' : 'wait') +
      '</ol>' + (learning ? '' : '<div class="od-soc-meters">' + meter('Posts with results', P.settled, P.need_posts) + meter('Days running', P.days, P.need_days) + '</div><p class="od-fine">Rules start once both are full. Fewer posts than this would be guessing.</p>'),
      { cls: 'od-gang-card' });
  }

  function winnersCard(S) {
    var rows = (S.kinds.topic || []).slice(0, 6);
    var body = rows.length
      ? OD.charts.rank(rows.map(function (r) { return { label: r.value + ' (' + plural(r.posts, 'post') + ')', value: r.avg_score, display: String(r.avg_score) }; }))
      : '<p class="od-note">The first scores land 48 hours after a post goes out.</p>';
    return OD.card('Best kinds of post so far', body, { sub: 'Reactions, comments, shares, and clicks for every 100 times seen.', cls: 'od-gang-card' });
  }

  function planCard(S) {
    var N = S.next_batch;
    var line = function (label, items) { return items.length ? '<div class="od-soc-plan"><span>' + esc(label) + '</span><b>' + esc(items.join(', ')) + '</b></div>' : ''; };
    var ruleLines = S.rules.slice(0, 4).map(function (r) {
      return '<li>' + esc(r.value) + ' (' + esc(r.label) + ') scores ' + r.vs_average + ' times the average across ' + plural(r.posts, 'post') + '.</li>';
    }).join('');
    return OD.card('Next batch', '<div class="od-soc-plan"><span>Plan</span><b>' + N.size + ' posts, ' + esc(N.mode.toLowerCase()) + '</b></div>' +
      line('Do more', N.more) + line('Do less', N.less) + line('New test', N.tests) +
      (ruleLines ? '<ul class="od-soc-rules">' + ruleLines + '</ul>' : '<p class="od-fine">Until the loop has enough results, topics stay evenly mixed so each kind gets a fair chance.</p>'),
      { cls: 'od-gang-card' });
  }

  function historyCard(S) {
    var scored = S.weekly.filter(function (w) { return w.avg_score != null; });
    var log = (S.rule_log || []).filter(function (e) { return e.score_after != null; }).slice(-3).reverse().map(function (e) {
      return '<li>Week of ' + esc(weekLabel(e.week)) + ': score went from ' + e.score_before + ' to ' + e.score_after + (e.helped ? '. Rules kept.' : '. Rules under review.') + '</li>';
    }).join('');
    var body = scored.length >= 2 ? '<div data-soc-chart></div>' : '<p class="od-note">The weekly chart starts after two weeks of scored posts.</p>';
    return OD.card('Score by week', body + (log ? '<ul class="od-soc-rules">' + log + '</ul>' : ''), { sub: 'Shows whether each change made the next week better.', cls: 'od-gang-card' });
  }

  function learningHtml(S) {
    return '<div class="od-soc-grid">' + loopCard(S) + winnersCard(S) + planCard(S) + historyCard(S) + '</div>';
  }

  function drawChart(root, S) {
    var el = root.querySelector('[data-soc-chart]');
    if (!el) return;
    var rows = S.weekly.filter(function (w) { return w.avg_score != null; });
    OD.charts.bars(el, {
      labels: rows.map(function (w) { return weekLabel(w.week); }),
      tipLabels: rows.map(function (w) { return 'Week of ' + weekLabel(w.week) + ', ' + plural(w.sent, 'post'); }),
      series: [{ name: 'Score', values: rows.map(function (w) { return w.avg_score; }) }], height: 180, maxBar: 44, ticks: 4, label: 'Average score by week'
    });
  }

  OD.views.social = function () {
    var S = OD.data['social-learning'];
    if (!S || !S.meta || !S.meta.connected) {
      return { title: 'Social', html: OD.card('', '<p class="od-note">Post results show here once live data is loaded.</p>', {}) };
    }
    var seg = OD.ui.socialSeg || 'results';
    var body = function (s) { return s === 'learning' ? learningHtml(S) : resultsHtml(S); };
    var tabs = '<div class="od-gang-tabs"><div class="od-seg" role="group" aria-label="Social">' + [['results', 'Results'], ['learning', 'What we are learning']].map(function (s) {
      return '<button type="button" class="od-seg__b' + (seg === s[0] ? ' is-on' : '') + '" data-soc-seg="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div></div>';
    return {
      title: 'Social',
      html: tabs + '<div data-soc-body class="od-gang-body od-swap-in">' + body(seg) + '</div>',
      mount: function (root) {
        var host = root.querySelector('[data-soc-body]');
        var openPost = function (row) { OD.drawer.open(postDrawer(S.posts[+row.getAttribute('data-soc-post')]), { wide: true }); };
        if (seg === 'learning') drawChart(root, S);
        root.addEventListener('click', function (e) {
          var row = e.target.closest('[data-soc-post]');
          if (row) { openPost(row); return; }
          var b = e.target.closest('[data-soc-seg]');
          if (!b) return;
          seg = OD.ui.socialSeg = b.getAttribute('data-soc-seg');
          root.querySelectorAll('[data-soc-seg]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          host.innerHTML = body(seg);
          OD.hydrate(host);
          if (seg === 'learning') drawChart(root, S);
        });
        root.addEventListener('keydown', function (e) {
          var row = e.target.closest('[data-soc-post]');
          if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPost(row); }
        });
      }
    };
  };
})();
