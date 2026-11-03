(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;

  var money = function (c) { return OD.money(c, { cents: false }); };
  var day = function (d) { return new Date(d + 'T12:00:00').toLocaleString('en-US', { month: 'short', day: 'numeric' }); };
  var feet = function (inches) { return inches == null ? 'Size not listed' : (inches / 12).toFixed(1).replace(/\.0$/, '') + ' ft'; };
  var plural = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };

  function cell(label, valueHtml, note) {
    return '<div class="od-cell"><div class="od-cell__top"><span class="od-cell__label">' + esc(label) + '</span></div><b class="od-cell__value">' + valueHtml + '</b><span class="od-cell__note">' + note + '</span></div>';
  }
  var count = function (n) { return '<span data-od-count="' + n + '">' + OD.num(n) + '</span>'; };
  var cash = function (c) { return '<span data-od-count="' + c + '" data-money="1">' + money(c) + '</span>'; };

  function delta(now, prior) {
    if (!prior) return '';
    var p = (now - prior) / prior * 100;
    return '<span class="od-delta od-delta--' + (p >= 0 ? 'good' : 'bad') + '">' + (p >= 0 ? 'Up ' : 'Down ') + Math.abs(p).toFixed(0) + '%</span> ';
  }

  function reordersHtml(R) {
    var S = R.same_sheet, U = R.reused_design;
    var strip = '<section class="od-card od-card--strip"><div class="od-cells">' +
      cell('Reorder value', cash(S.value_cents), S.share_of_sales_pct + '% of gang sheet sales') +
      cell('Sheets reordered', count(S.sheets), S.reorders + ' reorders of ' + OD.num(R.paid_sheets) + ' sheets') +
      cell('Customers reordering', count(S.customers), 'of ' + OD.num(R.customers) + ' customers') +
      cell('Sheets reusing old art', cash(U.value_cents), OD.num(U.sheets) + ' sheets, ' + U.share_of_sales_pct + '% of sales') +
      '</div></section>';
    var top = R.top10.length ? R.top10[0].reorder_value_cents : 1;
    var rows = R.top10.map(function (t, i) {
      return '<tr class="od-tr" tabindex="0" data-gang-sheet="' + i + '">' +
        '<td class="od-gang-rank">' + (i + 1) + '</td>' +
        '<td class="od-gang-pic">' + (t.preview_url ? '<img src="' + esc(t.preview_url) + '" alt="" loading="lazy">' : '') + '</td>' +
        '<td><b>' + esc(t.customer) + '</b></td>' +
        '<td>' + feet(t.length_in) + ', ' + plural(t.designs, 'design') + '</td>' +
        '<td class="od-gang-hide">' + day(t.first_date) + ' to ' + day(t.last_date) + '</td>' +
        '<td class="num">' + t.times_ordered + 'x</td>' +
        '<td class="od-gang-val"><b>' + money(t.reorder_value_cents) + '</b><i style="--w:' + (t.reorder_value_cents / top * 100).toFixed(1) + '%"></i></td></tr>';
    }).join('');
    var table = OD.card('Top 10 reordered sheets', '<table class="od-mini-table od-gang-table"><thead><tr><th colspan="3">Customer</th><th>Sheet</th><th class="od-gang-hide">Dates</th><th class="num">Ordered</th><th class="num">Reorder value</th></tr></thead><tbody>' + rows + '</tbody></table>',
      { sub: 'Same customer, same designs, paid again. Click a row to see the sheet.', cls: 'od-gang-card' });
    var funnel = OD.charts.rank([
      { label: 'Gang sheet customers', value: R.customers, display: OD.num(R.customers) },
      { label: 'Came back for another order', value: R.repeat_customers, display: OD.num(R.repeat_customers) },
      { label: 'Reused an old design', value: U.customers, display: OD.num(U.customers) },
      { label: 'Reordered the same sheet', value: S.customers, display: OD.num(S.customers) }
    ]);
    var side = OD.card('How customers come back', funnel +
      '<div class="od-gang-take"><b>' + Math.round(R.repeat_customers / R.customers * 100) + '%</b><span>of customers order again, and most bring new art. Half of same-sheet reorders land within ' + plural(Math.round(S.typical_days_between), 'day') + '.</span></div>' +
      '<p class="od-fine">Paid orders only. ' + OD.num(R.sheets_without_design_data) + ' sheets have no design file and are not counted.</p>', { cls: 'od-gang-card' });
    return strip + '<div class="od-gang-main">' + table + side + '</div>';
  }

  function sheetDrawer(t) {
    return '<div class="od-drawer__top"><h2>' + esc(t.customer) + '</h2></div>' +
      '<p class="od-drawer__who">Ordered ' + t.times_ordered + ' times, ' + day(t.first_date) + ' to ' + day(t.last_date) + '</p>' +
      '<p class="od-drawer__facts"><span>' + money(t.reorder_value_cents) + ' in reorders</span><span>' + money(t.total_value_cents) + ' across all orders</span><span>' + feet(t.length_in) + ', ' + plural(t.designs, 'design') + '</span></p>' +
      (t.preview_url ? '<a class="od-gang-full" href="' + esc(t.preview_url) + '" target="_blank" rel="noopener"><img src="' + esc(t.preview_url) + '" alt="Gang sheet ordered by ' + esc(t.customer) + '"></a>' : '<p class="od-note">No picture of this sheet.</p>');
  }

  function trendsHtml(T) {
    var N = T.season.now, P = T.season.prior;
    var strip = '<section class="od-card od-card--strip"><div class="od-cells">' +
      cell('Sheets', count(N.sheets), delta(N.sheets, P.sheets) + 'from ' + OD.num(P.sheets)) +
      cell('Sheet sales', cash(N.sales_cents), delta(N.sales_cents, P.sales_cents) + 'from ' + money(P.sales_cents)) +
      cell('New customers', count(N.new_customers), delta(N.new_customers, P.new_customers) + 'from ' + OD.num(P.new_customers)) +
      cell('Average sheet', OD.money(N.avg_sheet_cents), delta(N.avg_sheet_cents, P.avg_sheet_cents) + 'from ' + OD.money(P.avg_sheet_cents)) +
      '</div></section>';
    var fullMonths = T.monthly.filter(function (m) { return !m.partial; });
    var peak = fullMonths.reduce(function (a, b) { return b.sheets > a.sheets ? b : a; }, fullMonths[0]);
    var chart = OD.card('Gang sheets by month', '<div data-gang-chart></div>',
      { sub: esc(T.season.label) + ' compared with ' + esc(T.season.prior_label) + '. Builder orders start in ' + esc(T.monthly[0].label) + ', so there is no last year yet.', cls: 'od-gang-card' });
    var sizes = OD.charts.rank(T.season.sizes.map(function (s) {
      return { label: s.label, sub: 'was ' + Math.round(s.prior_share_pct) + '%', value: s.share_pct, display: Math.round(s.share_pct) + '%' };
    }));
    var side = OD.card('What people are buying', '<div class="od-gang-take"><b>' + OD.num(peak.sheets) + '</b><span>sheets in ' + esc(peak.label) + ', the biggest month so far, from ' + OD.num(peak.customers) + ' customers.</span></div>' + sizes,
      { sub: 'Sheet lengths, share of sheets this season.', cls: 'od-gang-card' });
    return strip + '<div class="od-gang-main">' + chart + side + '</div>';
  }

  function drawChart(root, T) {
    var el = root.querySelector('[data-gang-chart]');
    if (!el) return;
    var vals = T.monthly.map(function (m) { return m.sheets; });
    var fullVals = T.monthly.filter(function (m) { return !m.partial; }).map(function (m) { return m.sheets; });
    OD.charts.bars(el, {
      labels: T.monthly.map(function (m) { return m.label; }),
      tipLabels: T.monthly.map(function (m) { return m.label + (m.partial ? ' so far' : '') + ', ' + money(m.sales_cents); }),
      series: [{ name: 'Sheets', values: vals }], height: 320, maxBar: 44, ticks: 5,
      highlight: vals.indexOf(Math.max.apply(null, fullVals)), label: 'Gang sheets per month'
    });
  }

  OD.views.gangs = function () {
    var G = OD.data['gang-insights'];
    if (!G || !G.reorders) {
      return { title: 'Gang Sheets', html: OD.card('', '<p class="od-note">Reorders and trends read the live store orders. They show once live data is loaded.</p>', {}) };
    }
    var seg = OD.ui.gangSeg || 'reorders';
    var body = function (s) { return s === 'trends' ? trendsHtml(G.trends) : reordersHtml(G.reorders); };
    var tabs = '<div class="od-gang-tabs"><div class="od-seg" role="group" aria-label="Gang sheets">' + [['reorders', 'Reorders'], ['trends', 'Season trends']].map(function (s) {
      return '<button type="button" class="od-seg__b' + (seg === s[0] ? ' is-on' : '') + '" data-gang-seg="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div></div>';
    return {
      title: 'Gang Sheets',
      html: tabs + '<div data-gang-body class="od-gang-body od-swap-in">' + body(seg) + '</div>',
      mount: function (root) {
        var host = root.querySelector('[data-gang-body]');
        var openSheet = function (row) { OD.drawer.open(sheetDrawer(G.reorders.top10[+row.getAttribute('data-gang-sheet')]), { wide: true }); };
        if (seg === 'trends') drawChart(root, G.trends);
        root.addEventListener('click', function (e) {
          var row = e.target.closest('[data-gang-sheet]');
          if (row) { openSheet(row); return; }
          var b = e.target.closest('[data-gang-seg]');
          if (!b) return;
          seg = OD.ui.gangSeg = b.getAttribute('data-gang-seg');
          root.querySelectorAll('[data-gang-seg]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          host.innerHTML = body(seg);
          OD.hydrate(host);
          if (seg === 'trends') drawChart(root, G.trends);
        });
        root.addEventListener('keydown', function (e) {
          var row = e.target.closest('[data-gang-sheet]');
          if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openSheet(row); }
        });
      }
    };
  };
})();
