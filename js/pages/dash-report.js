(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;

  function num(label, value, note, real) {
    return '<div class="od-num"><span class="od-num__label">' + esc(label) + (real ? OD.realTag() : '') + '</span><b class="od-num__value">' + value + '</b><span class="od-num__note">' + esc(note || '') + '</span></div>';
  }
  function block(title, lines) {
    return '<section class="od-sum"><h2>' + esc(title) + '</h2>' + lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '</section>';
  }

  function render() {
    var R = OD.data.report;
    var SA = OD.data.sales;
    var h = R.headline;
    var g = R.gang_sheets;
    var host = document.getElementById('od-report');
    var slipping = OD.data.customers.customers.filter(function (c) { return c.type === 'reseller' && (c.cadence_status === 'slipping' || c.cadence_status === 'lapsed'); }).length;
    var d = OD.delta(h.total_cents, h.prior_total_cents);
    host.innerHTML =
      '<header class="od-sheet__head"><div><p class="od-sheet__eyebrow">Weekly report</p><h1>Week of ' + esc(OD.dateShort(R.week_start)) + ' to ' + esc(OD.dateShort(R.week_end)) + '</h1></div><p class="od-sheet__tag">Sample data. Real counts are marked.</p></header>' +
      '<section class="od-sheet__nums">' +
      num('Sales', OD.money(h.total_cents, { cents: false }), (d >= 0 ? 'Up ' : 'Down ') + Math.abs(d).toFixed(1) + '% on the week before') +
      num('Orders', OD.num(h.orders), 'web and store') +
      num('Gang sheets this week', OD.num(g.this_week), 'week before: ' + OD.num(g.prior_week)) +
      num('Gang sheets in October', OD.num(g.month_to_date), 'September was ' + g.september_baseline, true) +
      num('Web share of sales', Math.round(h.web_cents / (h.web_cents + h.store_cents) * 100) + '%', 'the rest is the store') +
      num('Resellers to call', String(slipping), 'slipping or gone quiet') +
      '</section>' +
      '<section class="od-sheet__chart"><h2>Sales by week, web and store</h2><div data-report-chart></div></section>' +
      '<section class="od-sheet__cols">' + block('What went up', R.summary.went_up) + block('What needs attention', R.summary.needs_attention) + block('What to do next week', R.summary.next_week) + '</section>';
    var weeks = SA.weekly.filter(function (w) { return !w.partial; });
    OD.charts.bars(host.querySelector('[data-report-chart]'), {
      labels: weeks.map(function (w) { return OD.dateShort(w.week_start); }),
      series: [{ name: 'Web', values: weeks.map(function (w) { return w.web_cents; }) }, { name: 'Store', values: weeks.map(function (w) { return w.store_cents; }) }],
      stacked: true, height: 150, maxBar: 52, fmt: function (v) { return OD.money(v, { cents: false }); }, axisFmt: function (v) { return OD.money(v, { compact: true, cents: false }); }, leftPad: 50, label: 'Sales by week, web and store', highlight: weeks.length - 1
    });
  }

  MM.ready(function () {
    var btn = document.querySelector('[data-print]');
    if (btn) btn.addEventListener('click', function () { window.print(); });
    OD.load(['report', 'sales', 'customers']).then(render).catch(function (e) {
      document.getElementById('od-report').innerHTML = '<p>The sample data did not load: ' + esc(e.message) + '</p>';
    });
  });
})();
