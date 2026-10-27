(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var S = OD.session;

  var moneyAxis = function (v) { return OD.money(v, { compact: true, cents: false }); };
  var moneyExact = function (v) { return '$' + (v / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var LIVE = { live: ['Live', 'ok'], live_intermittent: ['Fails at times', 'warn'], planned: ['Planned, not on yet', 'gray'] };

  function failsHtml() {
    var F = OD.data.payments.failures;
    return '<ul class="od-list">' + F.map(function (f) {
      var done = f.recovered || S.recovered[f.id];
      return '<li class="od-row od-row--plain"><div class="od-row__main"><p class="od-row__title">' + esc(f.order_number) + ' <span>' + esc(OD.PAY[f.method]) + ', ' + esc(OD.dateShort(f.date)) + '</span></p><p class="od-row__sub">' + esc(f.reason) + '</p></div><div class="od-row__action">' + (done ? '<span class="od-sent">' + OD.icon('check') + '<span>Paid another way</span></span>' : '<button class="od-btn" type="button" data-retry="' + f.id + '">Text to retry</button>') + '</div></li>';
    }).join('') + '</ul>';
  }

  function drawerFor(key) {
    var SA = OD.data.sales, P = OD.data.payments;
    if (key === 'categories') {
      var cats = SA.by_category_28d.slice().sort(function (a, b) { return b.revenue_cents - a.revenue_cents; });
      return '<div class="od-drawer__top"><h2>Sales by category</h2></div><p class="od-note">Last 28 days. The arrow shows change on the 28 days before.</p>' + OD.charts.rank(cats.map(function (c, i) { return { label: c.category, display: OD.money(c.revenue_cents, { cents: false }), value: c.revenue_cents, delta: OD.delta(c.revenue_cents, c.prev_period_cents), cls: i === 0 ? 'is-mint' : '' }; }));
    }
    if (key === 'products') {
      return '<div class="od-drawer__top"><h2>Top products</h2></div><p class="od-note">Real product names and prices from your catalog. Sales figures are sample.</p><table class="od-mini-table"><thead><tr><th>Product</th><th class="num">Price</th><th class="num">Units</th><th class="num">Sales</th></tr></thead><tbody>' + SA.top_products_30d.slice(0, 9).map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td class="num">' + (p.product_id === 60967 ? 'By size' : esc(p.price_note || OD.money(p.unit_price_cents))) + '</td><td class="num">' + OD.num(p.units_30d) + '</td><td class="num">' + OD.money(p.revenue_30d_cents, { cents: false }) + '</td></tr>'; }).join('') + '</tbody></table><p class="od-note">The gang sheet unit count is the real October total. Its price is set by sheet size in Kixxl, so its sales are a sample estimate.</p>';
    }
    if (key === 'methods') {
      return '<div class="od-drawer__top"><h2>How people pay</h2></div><p class="od-note">Venmo and PayPal fail at times today and the cause is not confirmed. Apple Pay and Google Pay are planned and not on yet, so their rows show what the page will look like.</p><table class="od-mini-table"><thead><tr><th>Method</th><th></th><th class="num">Share</th><th class="num">Failed</th></tr></thead><tbody>' + P.methods.map(function (m) { var l = LIVE[m.live_status]; return '<tr><td>' + esc(m.label) + '</td><td>' + OD.tonePill(l[0], l[1]) + '</td><td class="num">' + m.share_pct + '%</td><td class="num">' + m.fail_rate_pct + '%</td></tr>'; }).join('') + '</tbody></table>';
    }
    if (key === 'failed') return '<div class="od-drawer__top"><h2>Failed payments</h2></div><div data-fails>' + failsHtml() + '</div>';
    return '<div class="od-drawer__top"><h2>Payouts</h2></div><p class="od-note">The card processor is not chosen yet.</p><ul class="od-plain">' + P.payouts.map(function (p) { return '<li><span>' + esc(OD.dateShort(p.date)) + ', ' + esc(p.source) + '</span><b>' + OD.money(p.amount_cents, { cents: false }) + ' ' + (p.state === 'paid' ? 'paid' : 'on its way') + '</b></li>'; }).join('') + '</ul>';
  }

  OD.views.money = function () {
    var SA = OD.data.sales, P = OD.data.payments;
    var cur = OD.rollingSales(6, 0), prev = OD.rollingSales(6, 6);
    var d = OD.delta(cur, prev);
    var fails = P.failures.filter(function (f) { return !(f.recovered || S.recovered[f.id]); }).length;
    var cells = '<section class="od-card od-card--strip"><div class="od-cells">' +
      '<div class="od-cell"><span class="od-cell__label">Sales, last 6 open days</span><b class="od-cell__value" data-od-count="' + cur + '" data-money="1">' + OD.money(cur, { cents: false }) + '</b><span class="od-cell__note"><span class="od-delta od-delta--' + (d >= 0 ? 'good' : 'bad') + '">' + (d >= 0 ? 'Up ' : 'Down ') + Math.abs(d).toFixed(1) + '%</span> on the 6 days before</span></div>' +
      '<div class="od-cell"><span class="od-cell__label">Average web order</span><b class="od-cell__value" data-od-count="' + SA.averages.avg_order_web_cents + '" data-money="1">' + OD.money(SA.averages.avg_order_web_cents, { cents: false }) + '</b><span class="od-cell__note">Store: ' + OD.money(SA.averages.avg_order_store_cents, { cents: false }) + '</span></div>' +
      '<div class="od-cell"><span class="od-cell__label">Next payout</span><b class="od-cell__value">' + OD.money(P.payouts[0].amount_cents, { cents: false }) + '</b><span class="od-cell__note">on its way, ' + OD.dateShort(P.payouts[0].date) + '</span></div></div></section>';
    var chart = OD.card('Daily sales', '<div data-money-chart></div><div class="od-chips" role="group" aria-label="More detail"><button class="od-chip" type="button" data-md="categories">By category</button><button class="od-chip" type="button" data-md="products">Top products</button><button class="od-chip" type="button" data-md="methods">How people pay</button><button class="od-chip" type="button" data-md="failed">Failed payments' + (fails ? ' <em>' + fails + '</em>' : '') + '</button><button class="od-chip" type="button" data-md="payouts">Payouts</button></div>',
      { sub: 'Web and store, the last four weeks. Hover or use the arrow keys for each day.', actions: '<a class="od-btn" href="/owner-dashboard/report/">Weekly report</a>' });
    return {
      title: 'Money',
      html: cells + chart,
      mount: function (root) {
        var rows = SA.daily.slice(-28);
        OD.charts.bars(root.querySelector('[data-money-chart]'), {
          labels: rows.map(function (r) { return OD.dateShort(r.date); }),
          tipLabels: rows.map(function (r) { return OD.dateDow(r.date); }),
          series: [{ name: 'Web', values: rows.map(function (r) { return r.web_cents; }) }, { name: 'Store', values: rows.map(function (r) { return r.store_cents; }) }],
          stacked: true, height: Math.max(190, Math.min(360, window.innerHeight - 560)), maxBar: 22, fmt: moneyAxis, tipFmt: moneyExact, axisFmt: moneyAxis, labelEvery: 7, leftPad: 58, keyboard: true, label: 'Daily sales, web and store'
        });
        root.addEventListener('click', function (e) {
          var b = e.target.closest('[data-md]');
          if (b) OD.drawer.open(drawerFor(b.getAttribute('data-md')));
        });
        var onClick = function (e) {
          var r = e.target.closest('#od-drawer [data-retry]');
          if (!r) return;
          S.recovered[r.getAttribute('data-retry')] = true;
          OD.toast('Retry link sent. This is a preview, nothing was really sent.', { icon: 'send' });
          document.querySelector('#od-drawer [data-fails]').innerHTML = failsHtml();
          var left = P.failures.filter(function (f) { return !(f.recovered || S.recovered[f.id]); }).length;
          var chip = root.querySelector('[data-md="failed"]');
          if (chip) chip.innerHTML = 'Failed payments' + (left ? ' <em>' + left + '</em>' : '');
          OD.changed({});
        };
        document.addEventListener('click', onClick);
        root.__cleanup = function () { document.removeEventListener('click', onClick); };
      }
    };
  };
})();
