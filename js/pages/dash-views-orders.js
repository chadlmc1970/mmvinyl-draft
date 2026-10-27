(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var S = OD.session;

  var STEPS = [
    { key: 'new', label: 'Received' },
    { key: 'art_check', label: 'Art' },
    { key: 'printing', label: 'Printing' },
    { key: 'ready', label: 'Ready' },
    { key: 'picked_up', label: 'Done' }
  ];
  function stepIndex(status) {
    if (status === 'shipped') return 4;
    if (status === 'on_hold') return 1;
    if (status === 'payment_failed') return 0;
    return Math.max(0, STEPS.map(function (s) { return s.key; }).indexOf(status));
  }

  OD.orderDrawerHtml = function (id) {
    var o = OD.orderById(id);
    if (!o) return '<p>Order not found.</p>';
    var e = OD.eff(o);
    var idx = stepIndex(e.status);
    var steps = '<ol class="od-steps">' + STEPS.map(function (s, i) {
      return '<li class="' + (i < idx ? 'is-done' : i === idx ? 'is-now' : '') + '"><i>' + (i < idx ? OD.icon('check') : i + 1) + '</i><span>' + s.label + '</span></li>';
    }).join('') + '</ol>';
    var lines = o.lines.map(function (l) {
      return '<tr><td>' + esc(l.name) + (l.price_source !== 'catalog_from_price' ? '<small>Sample price. The real price is set by sheet size in Kixxl.</small>' : '') + '</td><td class="num">' + l.qty + '</td><td class="num">' + OD.money(l.qty * l.unit_price_cents) + '</td></tr>';
    }).join('');
    var pay = o.payment;
    var payNote = pay.state === 'paid' ? 'Paid' : pay.state === 'failed' ? 'Failed' : pay.state;
    var ful = o.fulfillment.type === 'ship' ? 'Ships with ' + esc(o.fulfillment.carrier) : 'Pickup at the shop';
    var actions = '';
    if (['new', 'art_check', 'printing'].indexOf(e.status) !== -1) actions = '<button class="od-btn" type="button" data-mark-ready="' + o.id + '">Mark ready</button>';
    var textBlock = e.status === 'ready' ? '<div class="od-drawer__row">' + OD.textButton(o, e) + '</div>' : '';
    return (
      '<div class="od-drawer__top"><h2>' + esc(o.number) + '</h2>' + OD.rowPill({ risk: o.risk }, e) + '</div>' +
      '<p class="od-drawer__who">' + esc(o.customer_label) + ' &middot; ' + (o.channel === 'web' ? 'website order' : 'in-store') + ' &middot; promised ' + esc(OD.relDay(o.promised_at, OD.data.queue.meta.as_of)) + ' ' + esc(OD.timeOf(o.promised_at)) + '</p>' +
      (o.risk_reason ? '<p class="od-callout">' + esc(o.risk_reason) + '</p>' : '') +
      steps +
      '<table class="od-mini-table"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Total</th></tr></thead><tbody>' + lines + '</tbody><tfoot><tr><td colspan="2">Total (sample, no tax)</td><td class="num">' + OD.money(o.total_cents) + '</td></tr></tfoot></table>' +
      '<p class="od-drawer__facts"><span>' + esc(OD.PAY[pay.method] || pay.method) + ', ' + payNote + '</span><span>' + ful + '</span>' + (o.gang_sheets ? '<span>' + o.gang_sheets + ' gang sheet' + (o.gang_sheets > 1 ? 's' : '') + ', Printer ' + o.printer + '</span>' : '') + '</p>' +
      textBlock + '<div class="od-drawer__actions">' + actions + '</div>'
    );
  };

  var ST = { seg: 'open', q: '', channel: 'all', pay: 'all', page: 0, per: 5 };

  function asRow(o) {
    var asOf = OD.data.orders.meta.as_of.slice(0, 10);
    return {
      order_id: o.id, number: o.number, promised_at: o.promised_at, customer_label: o.customer_label, gang_sheets: o.gang_sheets,
      summary: o.lines.map(function (l) { return l.qty + ' x ' + l.name; }).slice(0, 2).join(', ') + (o.lines.length > 2 ? ' +' + (o.lines.length - 2) + ' more' : ''),
      risk: o.risk, status: o.status, pickup_text: o.pickup_text, dayLabel: o.promised_at.startsWith(asOf) ? '' : OD.dateDow(o.promised_at).split(' ')[0]
    };
  }

  function groupOf(status) {
    if (['new', 'art_check', 'printing', 'on_hold', 'payment_failed'].indexOf(status) !== -1) return 'open';
    if (status === 'ready') return 'ready';
    return 'done';
  }

  function matches(o) {
    if (ST.channel !== 'all' && o.channel !== ST.channel) return false;
    if (ST.pay !== 'all' && o.payment.method !== ST.pay) return false;
    if (ST.q) {
      var hay = (o.number + ' ' + o.customer_label + ' ' + o.lines.map(function (l) { return l.name; }).join(' ')).toLowerCase();
      if (hay.indexOf(ST.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function counts() {
    var c = { open: 0, ready: 0, shipping: OD.data.shipments.shipments.length, done: 0 };
    OD.data.orders.orders.forEach(function (o) { c[groupOf(OD.eff(o).status)]++; });
    return c;
  }

  var SHIP = { label_created: ['Label made', 'gray'], in_transit: ['In transit', 'live'], delivered: ['Delivered', 'ok'], exception: ['Needs attention', 'bad'] };

  function listHtml() {
    var rows, total;
    if (ST.seg === 'shipping') {
      var SH = OD.data.shipments.shipments;
      total = SH.length;
      rows = SH.slice(ST.page * ST.per, (ST.page + 1) * ST.per).map(function (s) {
        var st = SHIP[s.state];
        return '<li class="od-row od-row--plain"><div class="od-row__main"><p class="od-row__title">' + esc(s.order_number) + ' <span>' + esc(s.customer_label) + '</span></p><p class="od-row__sub">' + esc(s.carrier) + ', ' + esc(s.service) + ', ' + esc(s.tracking) + '</p></div><div class="od-row__status">' + OD.tonePill(st[0], st[1]) + '</div></li>';
      }).join('');
    } else {
      var orders = OD.data.orders.orders.filter(function (o) { return groupOf(OD.eff(o).status) === ST.seg && matches(o); });
      if (ST.seg === 'open') orders.sort(function (a, b) { return a.promised_at < b.promised_at ? -1 : 1; });
      if (ST.seg === 'ready') orders.sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
      total = orders.length;
      var pages = Math.max(1, Math.ceil(total / ST.per));
      if (ST.page >= pages) ST.page = pages - 1;
      rows = orders.slice(ST.page * ST.per, (ST.page + 1) * ST.per).map(function (o, i) { return OD.orderRow(asRow(o), i); }).join('');
    }
    if (!rows) rows = '<li class="od-empty">' + OD.icon('search') + '<p>Nothing matches.</p></li>';
    return '<ul class="od-list">' + rows + '</ul>' + OD.pager('orders', ST.page, ST.per, total);
  }

  function filtersDrawer() {
    var payOptions = Object.keys(OD.PAY).map(function (k) { return '<option value="' + k + '"' + (ST.pay === k ? ' selected' : '') + '>' + OD.PAY[k] + '</option>'; }).join('');
    return '<div class="od-drawer__top"><h2>Filters</h2></div><label class="od-select"><span>Channel</span><select data-fch><option value="all">Web and store</option><option value="web"' + (ST.channel === 'web' ? ' selected' : '') + '>Web</option><option value="store"' + (ST.channel === 'store' ? ' selected' : '') + '>Store</option></select></label><label class="od-select"><span>Paid with</span><select data-fpay><option value="all">Anything</option>' + payOptions + '</select></label><div class="od-drawer__actions"><button class="od-btn" type="button" data-fapply>Apply</button><button class="od-link" type="button" data-freset>Clear filters</button></div>';
  }

  function detailDrawer() {
    var g = OD.data.gangsheets;
    var oos = OD.data.inventory.items.filter(function (i) { return i.state === 'out_of_stock'; });
    var low = OD.data.inventory.items.filter(function (i) { return i.state === 'low'; });
    return '<div class="od-drawer__top"><h2>Reprints and stock</h2></div>' +
      '<h3 class="od-h3">Reprints this month: ' + g.reprints['2026-10_to_date'] + '</h3><ul class="od-plain">' + g.reprints.reasons.map(function (r) { return '<li><span>' + esc(r.reason) + '</span><b>' + r.count + '</b></li>'; }).join('') + '</ul>' +
      '<h3 class="od-h3">Out of stock: ' + oos.length + ' ' + OD.realTag() + '</h3><ul class="od-plain">' + oos.map(function (i) { return '<li><span>' + esc(i.name) + '</span></li>'; }).join('') + '</ul>' +
      '<h3 class="od-h3">Running low: ' + low.length + '</h3><ul class="od-plain">' + low.map(function (i) { return '<li><span>' + esc(i.name) + '</span><b>' + i.qty + ' left</b></li>'; }).join('') + '</ul>' +
      '<p class="od-note">Low-stock counts are sample. Out-of-stock flags are read from the live catalog.</p>';
  }

  function printersPanel() {
    var g = OD.data.gangsheets;
    var cap = g.capacity_per_day;
    var t = g.today;
    var open = { 1: 0, 2: 0 };
    OD.data.queue.queue.forEach(function (x) {
      var e = OD.eff(x);
      if (x.printer && ['new', 'art_check', 'printing', 'on_hold'].indexOf(e.status) !== -1) open[x.printer] += x.gang_sheets;
    });
    function meter(name, done, queued, capacity) {
      var d = Math.max(0, done);
      return '<div class="od-load"><div class="od-load__top"><b>' + name + '</b><span>' + (d + queued) + ' of ' + capacity + ' sheets today</span></div><div class="od-load__track"><span class="od-load__done" style="--w:' + Math.min(100, d / capacity * 100).toFixed(1) + '%"></span><span class="od-load__queued" style="--w:' + Math.min(100, queued / capacity * 100).toFixed(1) + '%;--o:' + Math.min(100, d / capacity * 100).toFixed(1) + '%"></span></div></div>';
    }
    return OD.card('Printers today',
      meter('Printer 1', t.printer_1 - open[1], open[1], cap.printer_1) + meter('Printer 2', t.printer_2 - open[2], open[2], cap.printer_2) +
      '<p class="od-note">' + g.month_totals['2026-10_to_date'].total + ' gang sheets this month ' + OD.realTag() + '. Capacity of ' + cap.printer_1 + ' is a placeholder until you set it in Settings.</p><button class="od-link" type="button" data-more-printers>Reprints and stock ' + OD.icon('chev') + '</button>',
      { id: 'od-printers' });
  }

  OD.views.orders = function () {
    ST.seg = OD.ui.ordersSeg || ST.seg;
    OD.ui.ordersSeg = null;
    ST.page = 0;
    var c = counts();
    var seg = function (k, label) {
      return '<button type="button" class="od-seg__b' + (ST.seg === k ? ' is-on' : '') + '" data-oseg="' + k + '">' + label + ' <em>' + (c[k] != null ? c[k] : '') + '</em></button>';
    };
    var list = OD.card('',
      '<div class="od-bar"><div class="od-seg" role="group" aria-label="Orders">' + seg('open', 'In the shop') + seg('ready', 'Ready') + seg('shipping', 'Shipping') + seg('done', 'Done') + '</div>' +
      '<div class="od-bar__r"><label class="od-search">' + OD.icon('search') + '<input type="search" placeholder="Search orders" data-oq aria-label="Search orders" value="' + esc(ST.q) + '"></label><button class="od-link" type="button" data-filters>Filters</button></div></div>' +
      '<div data-olist class="od-swap-in">' + listHtml() + '</div>', {});
    return {
      title: 'Orders',
      html: '<div class="od-grid od-grid--main-side">' + list + printersPanel() + '</div>',
      mount: function (root) {
        var host = root.querySelector('[data-olist]');
        function redraw(swap) {
          host.innerHTML = listHtml();
          if (swap) { host.classList.remove('od-swap-in'); void host.offsetWidth; host.classList.add('od-swap-in'); }
          var cc = counts();
          root.querySelectorAll('[data-oseg]').forEach(function (b) { b.querySelector('em').textContent = cc[b.getAttribute('data-oseg')]; });
        }
        root.addEventListener('click', function (e) {
          var s = e.target.closest('[data-oseg]');
          if (s) {
            ST.seg = s.getAttribute('data-oseg');
            ST.page = 0;
            root.querySelectorAll('[data-oseg]').forEach(function (b) { b.classList.toggle('is-on', b === s); });
            redraw(true);
            return;
          }
          var pg = e.target.closest('[data-pg]');
          if (pg && pg.getAttribute('data-pg').indexOf('orders:') === 0) {
            ST.page += pg.getAttribute('data-pg') === 'orders:next' ? 1 : -1;
            redraw(true);
            return;
          }
          if (e.target.closest('[data-filters]')) { OD.drawer.open(filtersDrawer()); return; }
          if (e.target.closest('[data-more-printers]')) OD.drawer.open(detailDrawer());
        });
        root.querySelector('[data-oq]').addEventListener('input', function (e) { ST.q = e.target.value; ST.page = 0; redraw(false); });
        var onApply = function (e) {
          var d = e.target.closest('#od-drawer');
          if (!d) return;
          if (e.target.closest('[data-fapply]')) {
            ST.channel = d.querySelector('[data-fch]').value;
            ST.pay = d.querySelector('[data-fpay]').value;
            ST.page = 0;
            OD.drawer.close();
            redraw(true);
          } else if (e.target.closest('[data-freset]')) {
            ST.channel = 'all'; ST.pay = 'all'; ST.page = 0;
            OD.drawer.close();
            redraw(true);
          }
        };
        document.addEventListener('click', onApply);
        var onChange = function () {
          redraw(false);
          var p = root.querySelector('#od-printers');
          if (p) p.outerHTML = printersPanel();
        };
        document.addEventListener('od:changed', onChange);
        root.__cleanup = function () { document.removeEventListener('od:changed', onChange); document.removeEventListener('click', onApply); };
      }
    };
  };
})();
