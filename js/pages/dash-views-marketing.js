(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;

  // Market trends from free sources (Google Trends for Louisiana, plus a short local calendar), built by scripts/pull-market.mjs.
  // Loaded on its own so a missing file never stops the rest of the dashboard.
  var promise = null;
  OD.market = function () {
    if (!promise) {
      promise = fetch(MM.url('data/dashboard/market.json'), { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    }
    return promise;
  };

  var shortDate = function (d) { return new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }); };
  var KIND = { game: 'Game day', parade: 'Parade', holiday: 'Holiday' };

  // Plain-words read on one search term: what it is doing now and what it did over the same weeks last year.
  OD.marketSignal = function (t) {
    var up = t.next6_last_year != null && t.year_ago != null && t.next6_last_year >= Math.max(5, t.year_ago * 1.5);
    if (up) return { tone: 'ok', tag: 'Heading up', text: 'Last year it climbed from ' + t.year_ago + ' to ' + t.next6_last_year + ' over these next 6 weeks.' };
    if (t.change_pct != null && t.change_pct >= 25) return { tone: 'ok', tag: 'Climbing now', text: 'Up ' + t.change_pct + '% on the 4 weeks before.' };
    if (t.change_pct == null && t.now > 0) return { tone: 'ok', tag: 'Starting', text: 'Searches just started showing up again.' };
    if (t.change_pct != null && t.change_pct <= -25) return { tone: 'gray', tag: 'Cooling off', text: 'Down ' + Math.abs(t.change_pct) + '% on the 4 weeks before.' };
    return { tone: 'gray', tag: 'Steady', text: t.now ? 'About the same as last month.' : 'Quiet right now.' };
  };

  function daysUntil(d) {
    var p = MM.cutoff.zoneParts(new Date(), 'America/Chicago');
    var today = Date.UTC(p.y, p.m - 1, p.d);
    var parts = d.split('-');
    return Math.round((Date.UTC(+parts[0], +parts[1] - 1, +parts[2]) - today) / 86400000);
  }

  function cellsHtml(M) {
    var order = M.terms.slice().sort(function (a, b) {
      var sa = OD.marketSignal(a).tone === 'ok' ? 1 : 0, sb = OD.marketSignal(b).tone === 'ok' ? 1 : 0;
      return sb - sa || b.now - a.now;
    }).slice(0, 4);
    return '<section class="od-card od-card--strip"><div class="od-cells">' + order.map(function (t) {
      var s = OD.marketSignal(t);
      return '<div class="od-cell"><div class="od-cell__top"><span class="od-cell__label">' + esc(t.label) + '</span>' + OD.tonePill(s.tag, s.tone) + '</div><b class="od-cell__value">' + t.now + '</b><span class="od-cell__note">' + esc(s.text) + '</span></div>';
    }).join('') + '</div></section>';
  }

  function calendarHtml(M) {
    var next = M.calendar.filter(function (c) { return daysUntil(c.date) >= 0; }).slice(0, 7);
    if (!next.length) return '<p class="od-note">No dates coming up. The calendar refreshes with the next market pull.</p>';
    return '<ul class="od-plain od-mkt-cal">' + next.map(function (c) {
      var n = daysUntil(c.date);
      var when = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
      var title = c.source ? '<a href="' + esc(c.source) + '" target="_blank" rel="noopener">' + esc(c.title) + '</a>' : esc(c.title);
      return '<li><span><b>' + esc(shortDate(c.date)) + '</b> ' + title + ' <i>' + esc(KIND[c.kind] || '') + '</i></span><b>' + when + '</b></li>';
    }).join('') + '</ul>';
  }

  function risingHtml(M) {
    var seen = {};
    var list = (M.rising || []).filter(function (r) { var k = r.query.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; }).slice(0, 10);
    if (!list.length) return '<p class="od-note">Nothing new rising this month.</p>';
    return '<div class="od-chips od-mkt-rising">' + list.map(function (r) {
      return '<span class="od-chip" title="Searches in Louisiana, last 30 days">' + esc(r.query) + ' <em>' + esc(r.growth === 'Breakout' ? 'new' : r.growth) + '</em></span>';
    }).join('') + '</div>';
  }

  var SEGS = [['trends', 'Trends'], ['dates', 'Coming up'], ['rising', 'Rising searches']];

  function body(seg, M) {
    if (seg === 'dates') return OD.card('Coming up', calendarHtml(M), { sub: 'Dates that bring rushes. Tap one for the official page.', cls: 'od-mkt-card' });
    if (seg === 'rising') return OD.card('Rising searches', risingHtml(M), { sub: 'New or fast-growing in Louisiana this month. Ideas for designs and posts.', cls: 'od-mkt-card' });
    var pulled = new Date(M.meta.generated_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric' });
    return cellsHtml(M) + OD.card('What Louisiana is searching for', '<div data-mkt-chart></div>',
      { sub: 'Google searches by week, past 12 months. 100 is the busiest week for any line. Pulled ' + esc(pulled) + '.', cls: 'od-mkt-card' });
  }

  function drawChart(box, M) {
    var el = box.querySelector('[data-mkt-chart]');
    if (!el) return;
    var top = el.getBoundingClientRect().top;
    OD.charts.line(el, {
      labels: M.weeks.map(shortDate), tipLabels: M.weeks.map(function (w) { return 'Week of ' + shortDate(w); }),
      series: M.terms.map(function (t) { return { name: t.label, values: t.weekly }; }),
      height: Math.max(150, Math.min(340, window.innerHeight - top - 90)), max: 100, ticks: 4, labelEvery: 8, label: 'Weekly search interest in Louisiana'
    });
  }

  OD.views.marketing = function () {
    var seg = OD.ui.mktSeg || 'trends';
    var tabs = '<div class="od-gang-tabs"><div class="od-seg" role="group" aria-label="Marketing">' + SEGS.map(function (x) {
      return '<button type="button" class="od-seg__b' + (seg === x[0] ? ' is-on' : '') + '" data-mkt-seg="' + x[0] + '">' + x[1] + '</button>';
    }).join('') + '</div></div>';
    return {
      title: 'Marketing',
      html: tabs + '<div data-mkt class="od-gang-body od-swap-in"><p class="od-note">Loading market trends...</p></div>',
      mount: function (root) {
        OD.market().then(function (M) {
          var box = root.querySelector('[data-mkt]');
          if (!box) return;
          if (!M || !M.terms) {
            box.innerHTML = OD.card('', '<p class="od-note">Market trends are not loaded yet. They show after the next market pull.</p>', {});
            return;
          }
          var show = function () {
            box.innerHTML = body(seg, M);
            if (OD.hydrate) OD.hydrate(box);
            if (seg === 'trends') drawChart(box, M);
          };
          show();
          root.addEventListener('click', function (e) {
            var b = e.target.closest('[data-mkt-seg]');
            if (!b) return;
            seg = OD.ui.mktSeg = b.getAttribute('data-mkt-seg');
            root.querySelectorAll('[data-mkt-seg]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
            show();
          });
        });
      }
    };
  };
})();
