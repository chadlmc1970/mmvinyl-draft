(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var S = OD.session;

  /* ---------- Gang Sheets ---------- */
  OD.views.sheets = function () {
    var G = OD.data.gangsheets;
    var daily = G.daily;
    var sept = G.month_totals['2026-09'].total;
    var oct = G.month_totals['2026-10_to_date'].total;
    var octDays = daily.filter(function (d) { return d.date >= '2026-10-01'; });
    var openOct = octDays.filter(function (d) { return OD.dowOf(d.date) !== 0; }).length;
    var perDay = oct / (openOct - 0.6);
    var remainingDates = [];
    for (var i = 27; i <= 31; i++) {
      var dt = '2026-10-' + i;
      if (OD.dowOf(dt) !== 0) remainingDates.push(dt);
    }
    var projected = Math.round(oct + perDay * remainingDates.length);
    var delta = OD.delta(oct, sept);
    var pct = Math.min(100, (oct / projected) * 100);
    var hero =
      '<section class="od-card od-card--dark od-sheethero">' +
      '<div class="od-sheethero__main"><p class="od-eyebrow">Gang sheets, October so far ' + OD.realTag('Real count') + '</p>' +
      '<div class="od-sheethero__num" data-od-count="' + oct + '">0</div>' +
      '<p class="od-sheethero__p">That is <b>' + (oct - sept) + ' more</b> than all of September (<b>' + sept + '</b>) with ' + remainingDates.length + ' open days left in the month. <span class="od-up">' + OD.pct(delta) + '</span></p></div>' +
      '<div class="od-sheethero__bar"><div class="od-track"><span class="od-track__fill" style="--w:' + (oct / projected * 100).toFixed(1) + '%"></span><span class="od-track__mark" style="--w:' + (sept / projected * 100).toFixed(1) + '%"><i>Sept ' + sept + '</i></span></div>' +
      '<div class="od-track__legend"><span>0</span><span>Pace to finish near <b>' + OD.num(projected) + '</b> <em>(estimate at the October daily average)</em></span></div></div>' +
      '</section>';
    var stats = '<div class="od-stats">' +
      OD.stat({ label: 'September total', count: sept, note: 'the baseline', real: true }) +
      OD.stat({ label: 'Per open day, October', count: Math.round(perDay), note: 'worked out from the real total', real: true, realText: 'Estimate' }) +
      OD.stat({ label: 'Reprint rate, October', html: (G.reprints['2026-10_to_date'] / oct * 100).toFixed(1) + '%', note: 'Sept ' + (G.reprints['2026-09'] / sept * 100).toFixed(1) + '%', source: 'Kixxl + shop log' }) +
      OD.stat({ label: 'Sheets today so far', count: G.today.total_so_far, note: G.today.queued_open + ' still queued', source: 'WooCommerce' }) +
      '</div>';
    var chartCard = OD.card('Sheets per day, September and October',
      '<div data-sheet-chart></div><p class="od-fine">The two monthly totals are real. How they split across days and between printers is sample, because daily counts need the Kixxl or WooCommerce feed.</p>',
      { source: 'Kixxl via WooCommerce', sub: 'Printer 2 arrived Oct 1, so October bars split in two.' });
    var wd = [0, 0, 0, 0, 0, 0, 0], wdn = [0, 0, 0, 0, 0, 0, 0];
    daily.forEach(function (d) {
      var k = OD.dowOf(d.date);
      if (d.date === G.today.date) return;
      wd[k] += d.total;
      wdn[k]++;
    });
    var avgs = [1, 2, 3, 4, 5, 6].map(function (k) { return wdn[k] ? Math.round(wd[k] / wdn[k]) : 0; });
    var weekdayCard = OD.card('Which days are busiest', '<div data-wd-chart></div>', { source: 'Kixxl via WooCommerce', sub: 'Average sheets by weekday, to plan who is in.' });
    var p1 = G.october_by_printer.printer_1, p2 = G.october_by_printer.printer_2;
    var splitCard = OD.card('October by printer', OD.charts.donut({ labels: ['Printer 1', 'Printer 2'], values: [p1, p2], center: OD.num(p1 + p2), centerSub: 'sheets', size: 150, stroke: 22, label: 'October sheets by printer' }), { source: 'Kixxl', sub: 'Printer 2 installed Oct 1.' });
    var reasons = G.reprints.reasons.map(function (r) { return { label: r.reason, value: r.count, display: String(r.count) }; });
    var reprintCard = OD.card('Reprints and why', OD.charts.rank(reasons) + '<p class="od-fine">Each reprint costs a sheet plus a person\'s time. The art check aims at the top two reasons: transparent backgrounds and low resolution.</p>', { source: 'Shop log (to build)', sub: G.reprints['2026-10_to_date'] + ' reprints in October so far, ' + G.reprints['2026-09'] + ' in September.' });
    var html = hero + stats + '<div class="od-grid od-grid--main-side"><div class="od-col">' + chartCard + weekdayCard + '</div><div class="od-col">' + OD.printersCard() + splitCard + reprintCard + '</div></div>';
    return {
      title: 'Gang Sheets',
      sub: 'Volume against the September baseline, printer load, and reprints.',
      html: html,
      mount: function (root) {
        var labels = daily.map(function (d) { return OD.dateShort(d.date); });
        OD.charts.bars(root.querySelector('[data-sheet-chart]'), {
          labels: labels,
          tipLabels: daily.map(function (d) { return OD.dateDow(d.date); }),
          series: [{ name: 'Printer 1', values: daily.map(function (d) { return d.printer_1; }) }, { name: 'Printer 2', values: daily.map(function (d) { return d.printer_2; }) }],
          stacked: true, height: 260, maxBar: 14, labelEvery: 7, label: 'Gang sheets per day by printer',
          ref: [{ value: Math.round(sept / 26), label: 'Sept average' }]
        });
        OD.charts.bars(root.querySelector('[data-wd-chart]'), {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          series: [{ name: 'Avg sheets', values: avgs }], height: 200, maxBar: 36, ticks: 5, max: 50, highlight: avgs.indexOf(Math.max.apply(null, avgs)), label: 'Average sheets by weekday'
        });
      }
    };
  };

  /* ---------- Shipping and Pickup ---------- */
  var SHIP_STATE = {
    label_created: { label: 'Label made', tone: 'gray' },
    in_transit: { label: 'In transit', tone: 'live' },
    delivered: { label: 'Delivered', tone: 'mint' },
    exception: { label: 'Needs attention', tone: 'red' }
  };

  function pickupRows() {
    var rows = [];
    OD.data.orders.orders.forEach(function (o) {
      var e = OD.eff(o);
      if (e.status !== 'ready' || o.fulfillment.type !== 'pickup') return;
      rows.push({ o: o, e: e });
    });
    rows.sort(function (a, b) { return a.o.created_at < b.o.created_at ? -1 : 1; });
    if (!rows.length) return '<tr><td colspan="5"><div class="od-empty">' + OD.icon('check') + '<p>No pickups waiting.</p></div></td></tr>';
    return rows.map(function (r) {
      var o = r.o;
      var days = Math.round((new Date(OD.data.orders.meta.as_of.slice(0, 10)) - new Date(o.created_at.slice(0, 10))) / 864e5);
      var sent = r.e.text && r.e.text.state === 'sent';
      var btn = r.e.text && r.e.text.state === 'not_opted_in' ? '<span class="od-muted-note">No text opt-in</span>' : sent && days >= 1
        ? '<button class="od-btn od-btn--line od-btn--sm" type="button" data-remind="' + o.id + '">' + OD.icon('send') + 'Remind</button>'
        : OD.textButton(o, r.e);
      return '<tr class="od-tr" data-open-order="' + o.id + '" tabindex="0"><td><b>' + esc(o.number) + '</b></td><td>' + esc(o.customer_label) + '</td><td>' + (days ? days + ' day' + (days > 1 ? 's' : '') + ' waiting' : 'Since today') + '</td><td>' + (sent ? OD.tonePill('Texted', 'mint') : OD.tonePill('Not texted', 'amber')) + '</td><td class="od-td-act" onclick="event.stopPropagation()">' + btn + '</td></tr>';
    }).join('');
  }

  OD.views.shipping = function () {
    var SH = OD.data.shipments;
    var waiting = SH.pickup_ready.length;
    var stats = '<div class="od-stats">' +
      OD.stat({ label: 'Ready for pickup', count: waiting, note: 'in the shop now', source: 'WooCommerce' }) +
      OD.stat({ label: 'Waiting a day or more', count: SH.pickup_ready.filter(function (p) { return p.age_days >= 1; }).length, note: 'worth a reminder text', source: 'WooCommerce', cls: 'od-stat--dark' }) +
      OD.stat({ label: 'Labels this week', count: SH.shipments.length, note: 'FedEx and UPS', source: 'FedEx + UPS' }) +
      OD.stat({ label: 'Needs attention', count: SH.shipments.filter(function (s) { return s.state === 'exception'; }).length, note: 'carrier exceptions', source: 'FedEx + UPS' }) +
      '</div>';
    var banner = '<div class="od-callout od-callout--soon">' + OD.icon('warn') + '<span><b>How much Desiree ships today is not confirmed.</b> Pickup stays the default. The labels below are sample rows that show how FedEx and UPS will look once her carrier accounts are connected.</span></div>';
    var pickups = OD.card('Pickup-ready list',
      '<div class="od-tablewrap"><table class="od-table"><thead><tr><th>Order</th><th>Customer</th><th>Waiting</th><th>Text</th><th></th></tr></thead><tbody data-pickups>' + pickupRows() + '</tbody></table></div>',
      { source: 'WooCommerce', sub: 'Ready orders nobody has picked up. One tap sends the text.' });
    var carriers = OD.card('Carriers',
      '<div class="od-carriers">' +
      ['FedEx', 'UPS'].map(function (c, i) {
        return '<div class="od-carrier"><div class="od-carrier__top"><b>' + c + '</b>' + OD.tonePill('Needs access', 'amber') + '</div><p>' + (i === 0 ? 'Her account has strong discounts. Needs the account number to pull live rates and print labels.' : 'Second option at checkout and on labels. Needs the account number.') + '</p><button class="od-btn od-btn--line od-btn--sm" type="button" disabled>Create label</button></div>';
      }).join('') + '</div>',
      { source: 'FedEx + UPS', sample: false, tagText: 'Not connected', sub: 'Start with light, flat items: transfers, gang sheets, patches.' });
    var labels = OD.card('Labels',
      '<div class="od-tablewrap"><table class="od-table"><thead><tr><th>Order</th><th>Customer</th><th>Carrier</th><th>Service</th><th>Tracking</th><th>Status</th></tr></thead><tbody>' + SH.shipments.map(function (s) {
        var st = SHIP_STATE[s.state];
        return '<tr><td><b>' + esc(s.order_number) + '</b></td><td>' + esc(s.customer_label) + '</td><td><span class="od-chip ' + (s.carrier === 'FedEx' ? 'od-chip--fedex' : 'od-chip--ups') + '">' + esc(s.carrier) + '</span></td><td>' + esc(s.service) + '<small>' + s.weight_oz + ' oz</small></td><td><code>' + esc(s.tracking) + '</code></td><td>' + OD.tonePill(st.label, st.tone) + '</td></tr>';
      }).join('') + '</tbody></table></div>',
      { source: 'FedEx + UPS', sub: 'Sample labels only.' });
    var html = stats + banner + '<div class="od-grid od-grid--main-side">' + pickups + '<div class="od-col">' + carriers + '</div></div>' + labels;
    return {
      title: 'Shipping and Pickup',
      sub: 'Pickup is the default. FedEx and UPS labels sit beside it.',
      html: html,
      mount: function (root) {
        var body = root.querySelector('[data-pickups]');
        function redraw() { body.innerHTML = pickupRows(); }
        document.addEventListener('od:changed', redraw);
        root.__cleanup = function () { document.removeEventListener('od:changed', redraw); };
        root.addEventListener('click', function (e) {
          var r = e.target.closest('[data-remind]');
          if (r) {
            OD.sendText(r.getAttribute('data-remind'), r, 'reminder');
          }
        });
      }
    };
  };

  /* ---------- Messages ---------- */
  var TPL = {};
  function tplLabel(k) {
    if (!TPL[k]) {
      OD.data.messages.templates.forEach(function (t) { TPL[t.key] = t.label; });
    }
    return TPL[k] || k;
  }

  function logRows() {
    var M = OD.data.messages;
    var all = S.log.map(function (l) { return { n: l.order_number, who: l.customer_label, tpl: l.template, when: l.sent_at_label, state: l.state, by: l.triggered_by, fresh: true }; })
      .concat(M.log.map(function (l) { return { n: l.order_number, who: l.customer_label, tpl: l.template, when: OD.relDay(l.sent_at, M.meta.as_of) + ' ' + OD.timeOf(l.sent_at), state: l.state, by: l.triggered_by, reason: l.failure_reason }; }));
    return all.map(function (l, i) {
      return '<li class="od-msg' + (l.fresh ? ' od-msg--fresh' : '') + '" style="--i:' + Math.min(i, 12) + '"><span class="od-msg__ic">' + OD.icon(l.state === 'failed' ? 'warn' : 'send') + '</span><div class="od-msg__main"><p><b>' + esc(tplLabel(l.tpl)) + '</b> to ' + esc(l.who) + ' <span class="od-muted">for ' + esc(l.n) + '</span></p><small>' + esc(l.by) + (l.reason ? ' &middot; ' + esc(l.reason) : '') + '</small></div><div class="od-msg__r">' + (l.state === 'failed' ? OD.tonePill('Failed', 'red') : OD.tonePill('Delivered', 'mint')) + '<small>' + esc(l.when) + '</small></div></li>';
    }).join('');
  }

  function quoteCards() {
    return OD.data.messages.quotes.map(function (q) {
      var replied = q.state === 'replied' || S.replied[q.id];
      var late = !replied && q.hours_waiting >= 24;
      return '<li class="od-quote' + (replied ? ' is-replied' : '') + (late ? ' is-late' : '') + '" data-quote="' + q.id + '"><div class="od-quote__top"><b>' + esc(q.label) + '</b>' + (replied ? OD.tonePill('Replied', 'mint') : late ? OD.tonePill('Waiting ' + OD.ageText(q.hours_waiting), 'red') : OD.tonePill('New, ' + OD.ageText(q.hours_waiting), 'amber')) + '</div><p>' + esc(q.summary) + '</p><div class="od-quote__foot"><small>' + esc(q.type) + (q.needed_by ? ' &middot; needed by ' + esc(OD.dateShort(q.needed_by)) : '') + '</small>' + (replied ? '<span class="od-sent">' + OD.icon('check') + '<span>Replied</span></span>' : '<button class="od-btn od-btn--mint od-btn--sm" type="button" data-reply="' + q.id + '">' + OD.icon('send') + 'Reply</button>') + '</div></li>';
    }).join('');
  }

  OD.views.messages = function () {
    var M = OD.data.messages;
    var t = M.texts_30d;
    var stats = '<div class="od-stats">' +
      OD.stat({ label: 'Texts sent, 30 days', count: t.sent, note: 'automatic plus yours', source: 'Texting service' }) +
      OD.stat({ label: 'Delivered', html: (t.delivered / t.sent * 100).toFixed(1) + '%', note: t.failed + ' failed', source: 'Texting service' }) +
      OD.stat({ label: 'Quotes unanswered', count: M.quotes.filter(function (q) { return q.state === 'new' && !S.replied[q.id]; }).length, note: 'instant acknowledgment already sent', source: 'Quote form', cls: 'od-stat--dark' }) +
      OD.stat({ label: 'Review asks sent, 30 days', count: M.review_requests.sent_30d, note: 'every customer after pickup', source: 'Texting service' }) +
      '</div>';
    var ready = M.templates.filter(function (x) { return x.key === 'ready'; })[0];
    var preview = ready.body.replace('{order}', 'S-1044').replace('{close}', '5 PM');
    var phone = '<div class="od-phone"><div class="od-phone__bar"><i></i></div><div class="od-phone__msgs"><span class="od-phone__from">M&amp;M Vinyl</span><p class="od-bubble">' + esc(preview) + '</p><span class="od-phone__time">Delivered</span></div></div>';
    var log = OD.card('Texts sent', '<ul class="od-msgs" data-msgs>' + logRows() + '</ul>', { source: 'Texting service', sub: 'Every automated message is logged. You can override any of them.' });
    var optin = OD.card('Who opted in', OD.charts.donut({ labels: ['Opted in', 'Opted out', 'Unknown'], values: [M.opt_in.opted_in, M.opt_in.opted_out, M.opt_in.unknown], center: Math.round(M.opt_in.opted_in / (M.opt_in.opted_in + M.opt_in.opted_out + M.opt_in.unknown) * 100) + '%', centerSub: 'opted in', size: 150, stroke: 22, label: 'Text opt-in status' }) + '<p class="od-fine">' + esc(M.opt_in.note) + '</p>', { source: 'WooCommerce checkout', sub: 'Consent and its source are stored per customer.' });
    var quotes = OD.card('Quote inbox', '<ul class="od-quotes" data-quotes>' + quoteCards() + '</ul>', { source: 'Quote form + email', sub: 'Team and business requests in one place, with a reminder after 24 hours.' });
    var pv = OD.card('What the customer sees', phone, { source: 'Template: Ready for pickup', sub: 'Edit the wording in Settings.' });
    var html = stats + '<div class="od-grid od-grid--main-side">' + log + '<div class="od-col">' + quotes + optin + pv + '</div></div>';
    return {
      title: 'Messages',
      sub: 'Texts sent, who opted in, and the quote inbox.',
      html: html,
      mount: function (root) {
        var list = root.querySelector('[data-msgs]');
        function redraw() { list.innerHTML = logRows(); }
        document.addEventListener('od:changed', redraw);
        root.__cleanup = function () { document.removeEventListener('od:changed', redraw); };
        root.addEventListener('click', function (e) {
          var b = e.target.closest('[data-reply]');
          if (!b) return;
          var id = b.getAttribute('data-reply');
          S.replied[id] = true;
          root.querySelector('[data-quotes]').innerHTML = quoteCards();
          var label = M.quotes.filter(function (q) { return q.id === id; })[0].label;
          OD.toast('Reply drafted to ' + label + ' from sales@mandmvinyl.com (preview)', { icon: 'send' });
          document.dispatchEvent(new CustomEvent('od:changed', { detail: {} }));
        });
      }
    };
  };

  /* ---------- Inventory ---------- */
  OD.views.inventory = function () {
    var items = OD.data.inventory.items;
    var oos = items.filter(function (i) { return i.state === 'out_of_stock'; });
    var low = items.filter(function (i) { return i.state === 'low'; });
    var stats = '<div class="od-stats">' +
      OD.stat({ label: 'Products in the catalog', count: 106, note: 'WooCommerce', real: true }) +
      OD.stat({ label: 'Out of stock now', count: oos.length, note: 'flagged in the live catalog', real: true, cls: 'od-stat--mint' }) +
      OD.stat({ label: 'Running low', count: low.length, note: 'below the reorder point', source: 'Shopkeep + WooCommerce' }) +
      OD.stat({ label: 'Special order via', html: 'Company Casuals', note: 'for items not on the shelf', real: true, realText: 'Her live site' }) +
      '</div>';
    var rows = items.map(function (i, k) {
      var pct = i.state === 'out_of_stock' ? 0 : Math.min(100, (i.qty / (i.reorder_point * 2)) * 100);
      return '<tr style="--i:' + k + '"><td><b>' + esc(i.name) + '</b><small>' + esc(i.category) + '</small></td><td>' + (i.state === 'out_of_stock' ? OD.tonePill('Out of stock', 'red') : OD.tonePill('Running low', 'amber')) + '</td><td><div class="od-stockbar"><span class="od-stockbar__fill od-stockbar__fill--' + (i.state === 'out_of_stock' ? 'red' : 'amber') + '" style="--w:' + pct.toFixed(0) + '%"></span><span class="od-stockbar__pt" style="--w:50%"></span></div><small>' + (i.state === 'out_of_stock' ? '0 on hand' : i.qty + ' on hand, reorder at ' + i.reorder_point) + '</small></td><td>' + esc(i.reorder) + '</td><td>' + (i.real_flag ? OD.realTag('Real flag') : OD.sampleTag()) + '</td></tr>';
    }).join('');
    var table = OD.card('Stock flags', '<div class="od-tablewrap"><table class="od-table"><thead><tr><th>Product</th><th>Status</th><th>On hand</th><th>Reorder through</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="od-fine">The live site says some items shown in stock may need to be ordered because products move quickly. Counts shown as sample need Shopkeep inventory access.</p>', { source: 'WooCommerce + Shopkeep', sample: false, tagText: 'Real flags and sample counts', sub: oos.length + ' out-of-stock flags are real, read from the product catalog. Low-stock counts are sample.' });
    return { title: 'Inventory', sub: 'What to reorder before a customer finds out.', html: stats + table };
  };
})();
