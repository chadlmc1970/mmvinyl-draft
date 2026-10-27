(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var S = OD.session;

  var CAD = {
    on_track: { label: 'On track', tone: 'mint' },
    due: { label: 'Due to reorder', tone: 'amber' },
    slipping: { label: 'Slipping', tone: 'red' },
    lapsed: { label: 'Lapsed', tone: 'red' }
  };
  var TIER = { volume: 'Volume', reseller: 'Reseller', standard: 'Standard' };
  var STATE = { f: 'all', sort: 'spend', dir: -1 };

  function cadTrack(c) {
    var span = c.typical_gap_days * 3;
    var pos = Math.min(100, (c.days_since_last_order / span) * 100);
    return '<span class="od-cad" title="' + c.days_since_last_order + ' days since last order, usually every ' + c.typical_gap_days + '"><span class="od-cad__dot" style="--p:' + pos.toFixed(1) + '%"></span></span>';
  }

  function ago(days) {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return days + ' days ago';
  }

  function accounts() {
    return OD.data.customers.customers.filter(function (c) { return c.type === 'reseller'; });
  }

  function rows() {
    var list = accounts().filter(function (c) { return STATE.f === 'all' || c.cadence_status === STATE.f; });
    var key = STATE.sort;
    list.sort(function (a, b) {
      var av = key === 'spend' ? a.spend_90d_cents : key === 'since' ? a.days_since_last_order : key === 'name' ? a.label : a.typical_gap_days;
      var bv = key === 'spend' ? b.spend_90d_cents : key === 'since' ? b.days_since_last_order : key === 'name' ? b.label : b.typical_gap_days;
      return (av < bv ? -1 : av > bv ? 1 : 0) * STATE.dir;
    });
    return list.map(function (c, i) {
      var cs = CAD[c.cadence_status];
      return (
        '<tr class="od-tr" tabindex="0" data-open-acct="' + c.id + '" style="--i:' + Math.min(i, 14) + '">' +
        '<td class="od-nw"><b>' + esc(c.label) + '</b></td>' +
        '<td><span class="od-tier od-tier--' + c.tier + '">' + TIER[c.tier] + '</span></td>' +
        '<td class="od-nw">' + esc(ago(c.days_since_last_order)) + '<small>usually every ' + c.typical_gap_days + ' days</small></td>' +
        '<td>' + cadTrack(c) + '</td>' +
        '<td>' + OD.charts.spark(c.weekly_orders_8w, { w: 72, tone: c.cadence_status === 'slipping' || c.cadence_status === 'lapsed' ? 'bad' : '', label: 'Orders per week, last 8 weeks' }) + '</td>' +
        '<td class="num">' + OD.money(c.spend_90d_cents, { cents: false }) + '</td>' +
        '<td>' + OD.tonePill(cs.label, cs.tone) + '</td></tr>'
      );
    }).join('');
  }

  function acctDrawer(id) {
    var c = OD.data.customers.customers.filter(function (x) { return x.id === id; })[0];
    if (!c) return '';
    var cs = CAD[c.cadence_status];
    var orders = OD.data.orders.orders.filter(function (o) { return o.customer_id === id; }).slice(0, 4);
    var draft = c.cadence_status === 'on_track'
      ? 'Hi, it is M&M Vinyl. Want to rebuild your last gang sheet order? Order by 2 PM and it is ready today.'
      : 'Hi, it is M&M Vinyl. We have not seen your order in a bit. Want me to hold a spot for same-day pickup? Order by 2 PM Mon-Fri.';
    return (
      '<div class="od-drawer__top"><p class="od-eyebrow">Reseller account</p><h2>' + esc(c.label) + ' ' + OD.tonePill(cs.label, cs.tone) + '</h2><p class="od-drawer__who">' + TIER[c.tier] + ' tier &middot; ' + (c.tax_exempt_on_file ? 'tax-exempt on file' : 'no tax-exempt form on file') + ' &middot; ' + (c.preferred_pickup === 'ship' ? 'usually ships' : 'usually picks up') + '</p></div>' +
      '<div class="od-drawer__grid"><div class="od-drawer__block"><h3>Last order</h3><p><b>' + esc(ago(c.days_since_last_order)) + '</b></p><small>Usually reorders every ' + c.typical_gap_days + ' days</small></div><div class="od-drawer__block"><h3>Spend, 90 days</h3><p><b>' + OD.money(c.spend_90d_cents, { cents: false }) + '</b></p><small>' + c.orders_90d + ' orders, avg ' + OD.money(c.avg_order_cents, { cents: false }) + '</small></div></div>' +
      '<div class="od-drawer__block"><h3>Orders per week, last 8 weeks</h3><div class="od-drawer__chart" data-acct-chart="' + id + '"></div></div>' +
      (orders.length ? '<div class="od-drawer__block"><h3>Recent orders</h3><ul class="od-mini">' + orders.map(function (o) {
        return '<li><button type="button" class="od-mini__btn" data-open-order="' + o.id + '"><span><b>' + esc(o.number) + '</b> ' + esc(o.lines[0].qty + ' x ' + o.lines[0].name) + '</span><small>' + OD.money(o.total_cents, { cents: false }) + '</small></button></li>';
      }).join('') + '</ul></div>' : '') +
      '<div class="od-drawer__block"><h3>Reorder nudge (draft)</h3><textarea class="od-textarea" rows="3" data-nudge>' + esc(draft) + '</textarea><div class="od-drawer__actions"><button class="od-btn od-btn--mint" type="button" data-send-nudge="' + c.id + '">' + OD.icon('send') + 'Send text</button><span class="od-fine">' + (c.sms_opt_in === true ? 'Opted in to texts' : c.sms_opt_in === false ? 'Opted out: this will not send' : 'Opt-in unknown') + '</span></div></div>' +
      '<p class="od-fine">' + OD.sampleTag() + ' Sample account.</p>'
    );
  }

  function appCard() {
    var apps = OD.data.customers.applications;
    var body = '<ul class="od-apps">' + apps.map(function (a) {
      var done = S.approved[a.id];
      if (done) {
        return '<li class="od-app is-done" data-app="' + a.id + '"><div class="od-app__done">' + OD.icon('check') + '<div><b>' + esc(a.label) + '</b><small>' + (done === 'declined' ? 'Declined. A polite note is queued (preview).' : 'Approved as ' + esc(done) + '. Welcome email queued (preview).') + '</small></div></div></li>';
      }
      return (
        '<li class="od-app" data-app="' + a.id + '"><div class="od-app__top"><div><b>' + esc(a.label) + '</b><small>' + esc(a.business_type) + ' &middot; ' + esc(OD.relDay(a.submitted_at, OD.data.queue.meta.as_of)) + ' ' + esc(OD.timeOf(a.submitted_at)) + '</small></div>' + OD.tonePill(a.tax_exempt_doc ? 'Tax-exempt form' : 'No tax form', a.tax_exempt_doc ? 'mint' : 'amber') + '</div>' +
        '<div class="od-app__act"><label class="od-select"><span class="sr-only">Tier</span><select data-app-tier="' + a.id + '"><option value="Reseller">Reseller</option><option value="Volume">Volume</option><option value="Standard">Standard</option></select></label><button class="od-btn od-btn--mint od-btn--sm" type="button" data-app-ok="' + a.id + '">' + OD.icon('check') + 'Approve</button><button class="od-btn od-btn--line od-btn--sm" type="button" data-app-no="' + a.id + '">Decline</button></div></li>'
      );
    }).join('') + '</ul>';
    return OD.card('Applications to approve', body, { id: 'od-apps', source: 'WooCommerce form', sub: 'Approving unlocks their tier prices on the live site.' });
  }

  function slippingCard() {
    var list = accounts().filter(function (c) { return c.cadence_status === 'slipping' || c.cadence_status === 'lapsed'; }).sort(function (a, b) { return b.spend_90d_cents - a.spend_90d_cents; });
    var body = '<ul class="od-mini">' + list.slice(0, 6).map(function (c) {
      var over = Math.round(c.days_since_last_order / c.typical_gap_days * 10) / 10;
      return '<li><button type="button" class="od-mini__btn" data-open-acct="' + c.id + '"><span><b>' + esc(c.label) + '</b> <em class="od-em">' + c.days_since_last_order + ' days quiet</em></span><small>usually ' + c.typical_gap_days + ' &middot; ' + over + 'x</small></button></li>';
    }).join('') + '</ul>';
    return OD.card('Slipping accounts', body, { source: 'WooCommerce', cls: 'od-card--risk', sub: 'No order in 1.5x their usual gap. Biggest spenders first.' });
  }

  OD.views.resellers = function () {
    var list = accounts();
    var slip = list.filter(function (c) { return c.cadence_status === 'slipping' || c.cadence_status === 'lapsed'; }).length;
    var due = list.filter(function (c) { return c.cadence_status === 'due'; }).length;
    var counts = { all: list.length, on_track: 0, due: 0, slipping: 0, lapsed: 0 };
    list.forEach(function (c) { counts[c.cadence_status]++; });
    var tiers = { volume: 0, reseller: 0, standard: 0 };
    list.forEach(function (c) { tiers[c.tier]++; });
    var pending = OD.data.customers.applications.filter(function (a) { return !S.approved[a.id]; }).length;
    var stats = '<div class="od-stats">' +
      OD.stat({ label: 'Reseller accounts', count: list.length, note: 'in the top-account list', source: 'WooCommerce' }) +
      OD.stat({ label: 'Slipping or lapsed', count: slip, note: due + ' more are due to reorder', source: 'WooCommerce', cls: 'od-stat--dark' }) +
      OD.stat({ label: 'Applications waiting', count: pending, note: 'approve in the right column', source: 'WooCommerce form' }) +
      OD.stat({ label: 'Customers who resell', html: 'About 90%', note: 'said on the Oct 26 call', real: true, realText: 'From the call', cls: 'od-stat--mint' }) +
      '</div>';
    var chips = [['all', 'All accounts'], ['on_track', 'On track'], ['due', 'Due'], ['slipping', 'Slipping'], ['lapsed', 'Lapsed']].map(function (x) {
      return '<button class="od-fchip' + (STATE.f === x[0] ? ' is-on' : '') + '" type="button" data-rf="' + x[0] + '">' + x[1] + ' <b>' + counts[x[0]] + '</b></button>';
    }).join('');
    var table = OD.card('Top accounts and reorder rhythm',
      '<div class="od-filters">' + chips + '</div>' +
      '<div class="od-tablewrap"><table class="od-table od-table--accts"><thead><tr><th><button type="button" data-rs="name">Account</button></th><th>Tier</th><th><button type="button" data-rs="since">Last order</button></th><th>Cadence <span class="od-cadkey">on time</span></th><th>8 weeks</th><th class="num"><button type="button" data-rs="spend">90-day spend</button></th><th>Status</th></tr></thead><tbody data-acct-body>' + rows() + '</tbody></table></div>' +
      '<p class="od-fine">Cadence track: the dot moves right the longer a reseller goes without ordering. Mint zone is their normal gap, amber is late, red is slipping.</p>',
      { source: 'WooCommerce orders', sub: 'The Master Plan asks for the top 50 accounts. This shows 20 sample accounts.' });
    var tierCard = OD.card('Tier mix', OD.charts.donut({ labels: ['Volume', 'Reseller', 'Standard'], values: [tiers.volume, tiers.reseller, tiers.standard], center: String(list.length), centerSub: 'accounts', size: 150, stroke: 22, label: 'Accounts by tier' }), { source: 'WooCommerce roles', sub: 'Roles: standard, reseller, volume' });
    var html = stats + '<div class="od-grid od-grid--main-side">' + table + '<div class="od-col">' + slippingCard() + appCard() + tierCard + '</div></div>';
    return {
      title: 'Resellers',
      sub: 'Who reorders, who is slipping, and who is waiting for approval.',
      html: html,
      mount: function (root) {
        var body = root.querySelector('[data-acct-body]');
        function redraw() { body.innerHTML = rows(); }
        root.querySelectorAll('[data-rf]').forEach(function (b) {
          b.addEventListener('click', function () {
            STATE.f = b.getAttribute('data-rf');
            root.querySelectorAll('[data-rf]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
            redraw();
          });
        });
        root.querySelectorAll('[data-rs]').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.getAttribute('data-rs');
            if (STATE.sort === k) STATE.dir = -STATE.dir;
            else { STATE.sort = k; STATE.dir = k === 'name' ? 1 : -1; }
            redraw();
          });
        });
        root.addEventListener('click', function (e) {
          var a = e.target.closest('[data-open-acct]');
          if (a) {
            OD.drawer.open(acctDrawer(a.getAttribute('data-open-acct')));
            var host = document.querySelector('[data-acct-chart]');
            var c = OD.data.customers.customers.filter(function (x) { return x.id === a.getAttribute('data-open-acct'); })[0];
            if (host && c) {
              var labels = c.weekly_orders_8w.map(function (_, i) { return i === 7 ? 'This wk' : '-' + (7 - i) + 'w'; });
              requestAnimationFrame(function () { OD.charts.bars(host, { labels: labels, series: [{ name: 'Orders', values: c.weekly_orders_8w }], height: 130, ticks: 2, label: 'Orders per week' }); });
            }
            return;
          }
          var ok = e.target.closest('[data-app-ok]');
          var no = e.target.closest('[data-app-no]');
          if (ok || no) {
            var id = (ok || no).getAttribute(ok ? 'data-app-ok' : 'data-app-no');
            var tierSel = root.querySelector('[data-app-tier="' + id + '"]');
            S.approved[id] = ok ? (tierSel ? tierSel.value : 'Reseller') : 'declined';
            var apps = OD.data.customers.applications;
            var label = apps.filter(function (x) { return x.id === id; })[0].label;
            var host = root.querySelector('#od-apps');
            host.outerHTML = appCard();
            root.querySelector('#od-apps').classList.add('od-static');
            OD.toast(ok ? label + ' approved as ' + S.approved[id] + ' (preview)' : label + ' declined (preview)', { icon: ok ? 'check' : 'close' });
            document.dispatchEvent(new CustomEvent('od:changed', { detail: {} }));
            return;
          }
        });
        root.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-open-acct]')) e.target.click();
        });
      }
    };
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest('.od-drawer [data-send-nudge]');
    if (a) {
      OD.toast('Reorder nudge sent (preview, nothing was really sent)', { icon: 'send' });
      OD.drawer.close();
    }
  });
})();
