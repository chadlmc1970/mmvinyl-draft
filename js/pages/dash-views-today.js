(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;
  OD.views = OD.views || {};

  var S = (OD.session = OD.session || {});
  S.status = S.status || {};
  S.texted = S.texted || {};
  S.log = S.log || [];
  S.approved = S.approved || {};
  S.replied = S.replied || {};
  S.done = S.done || {};
  S.recovered = S.recovered || {};
  OD.ui = OD.ui || { customersSeg: 'resellers', ordersSeg: 'open' };

  OD.nowLabel = function () {
    try {
      return OD.now().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' });
    } catch (e) {
      return '';
    }
  };

  var _cust = null;
  OD.custMap = function () {
    if (!_cust) {
      _cust = {};
      OD.data.customers.customers.forEach(function (c) { _cust[c.id] = c; });
    }
    return _cust;
  };
  var _orders = null;
  OD.orderById = function (id) {
    if (!_orders) {
      _orders = {};
      OD.data.orders.orders.forEach(function (o) { _orders[o.id] = o; });
    }
    return _orders[id];
  };

  OD.eff = function (o) {
    var id = o.order_id || o.id;
    var status = S.status[id] || o.status;
    var text = S.texted[id] ? { state: 'sent', sent_at_label: S.texted[id] } : o.pickup_text;
    if (status !== o.status && status === 'ready' && !S.texted[id]) {
      var base = OD.orderById(id);
      var cust = base ? OD.custMap()[base.customer_id] : null;
      text = cust && cust.sms_opt_in === false ? { state: 'not_opted_in' } : { state: 'not_sent' };
    }
    return { status: status, text: text };
  };

  function changed(detail) {
    document.dispatchEvent(new CustomEvent('od:changed', { detail: detail || {} }));
  }
  OD.changed = changed;

  OD.sendText = function (orderId, btn, kind, quiet) {
    var o = OD.orderById(orderId);
    var label = o ? o.customer_label : 'customer';
    var num = o ? o.number : orderId;
    if (btn) {
      btn.classList.add('is-sending');
      btn.disabled = true;
    }
    var finish = function () {
      var t = OD.nowLabel();
      if (!kind || kind === 'ready' || kind === 'reminder') S.texted[orderId] = t;
      S.log.unshift({ id: 'sess_' + Date.now(), order_number: num, customer_label: label, template: kind || 'ready', sent_at_label: t, state: 'delivered', triggered_by: 'Sent by you from the dashboard (preview)' });
      if (!quiet) OD.toast('Text sent to ' + label + ' about ' + num + '. This is a preview, nothing was really sent.', { icon: 'send' });
      changed({ id: orderId });
    };
    if (OD.reduce) finish();
    else setTimeout(finish, 700);
  };

  OD.markReady = function (orderId) {
    S.status[orderId] = 'ready';
    var o = OD.orderById(orderId);
    OD.toast((o ? o.number : 'Order') + ' is marked ready. You can text the customer now.', { icon: 'check' });
    changed({ id: orderId, ready: true });
  };

  OD.textButton = function (q, eff) {
    var id = q.order_id || q.id;
    if (eff.status === 'ready') {
      if (eff.text && eff.text.state === 'sent') {
        return '<span class="od-sent">' + OD.icon('check') + '<span>Texted ' + esc(eff.text.sent_at_label || OD.timeOf(eff.text.sent_at)) + '</span></span>';
      }
      if (eff.text && eff.text.state === 'not_opted_in') return '<span class="od-quiet">No text opt-in</span>';
      return '<button class="od-btn od-text-btn" type="button" data-send-text="' + id + '"><span class="od-btn__label">' + OD.icon('send') + 'Text: ready</span><span class="od-btn__spin" aria-hidden="true"></span></button>';
    }
    return '';
  };

  OD.rowPill = function (q, e) {
    if (e.status !== 'ready' && e.status !== 'picked_up' && e.status !== 'shipped') {
      if (q.risk === 'late') return OD.tonePill('Late', 'bad');
      if (q.risk === 'blocked') return OD.tonePill('Payment failed', 'bad');
      if (q.risk === 'due_soon') return OD.tonePill('Due soon', 'warn');
    }
    return OD.pill(e.status);
  };

  OD.orderRow = function (x, i) {
    var e = OD.eff(x);
    var meta = x.customer_label + (x.gang_sheets ? ', ' + x.gang_sheets + ' sheet' + (x.gang_sheets > 1 ? 's' : '') : '');
    return (
      '<li class="od-row" data-row="' + x.order_id + '" style="--i:' + Math.min(i, 10) + '">' +
      '<button class="od-row__hit" type="button" data-open-order="' + x.order_id + '" aria-label="Open order ' + esc(x.number) + '"></button>' +
      '<span class="od-row__time">' + esc(OD.timeOf(x.promised_at)) + (x.dayLabel ? '<small>' + esc(x.dayLabel) + '</small>' : '') + '</span>' +
      '<div class="od-row__main"><p class="od-row__title">' + esc(x.number) + ' <span>' + esc(meta) + '</span></p><p class="od-row__sub">' + esc(x.summary) + '</p></div>' +
      '<div class="od-row__status">' + OD.rowPill(x, e) + '</div>' +
      '<div class="od-row__action">' + OD.textButton(x, e) + '</div></li>'
    );
  };

  /* ---------- Needs you ---------- */
  function queueItems() {
    return OD.data.queue.queue;
  }

  function goTo(route, seg) {
    if (route === 'customers') OD.ui.customersSeg = seg || 'resellers';
    if (route === 'orders') OD.ui.ordersSeg = seg || 'open';
    location.hash = '#/' + route;
  }

  function needsCandidates() {
    var D = OD.data;
    var out = [];
    queueItems().forEach(function (x) {
      var e = OD.eff(x);
      if (e.status === 'ready') return;
      if (x.risk === 'late' && !S.done['late:' + x.order_id]) {
        out.push({ key: 'late:' + x.order_id, orderId: x.order_id, title: x.number + ' for ' + x.customer_label + ' is late', sub: x.risk_reason, label: 'Text about art', run: function (btn, fin) {
          OD.sendText(x.order_id, btn, 'art');
          setTimeout(fin, OD.reduce ? 0 : 750);
        } });
      }
    });
    queueItems().forEach(function (x) {
      if (x.risk === 'blocked' && !S.done['pay:' + x.order_id]) {
        out.push({ key: 'pay:' + x.order_id, orderId: x.order_id, title: x.number + ': ' + x.customer_label + ' payment failed', sub: 'Not charged. A text with a retry link usually fixes it.', label: 'Text to retry', run: function (btn, fin) {
          btn.classList.add('is-sending');
          setTimeout(function () { OD.toast('Retry link sent to ' + x.customer_label + '. This is a preview, nothing was really sent.', { icon: 'send' }); fin(); }, OD.reduce ? 0 : 700);
        } });
      }
    });
    var toText = queueItems().filter(function (x) {
      var e = OD.eff(x);
      return e.status === 'ready' && e.text && e.text.state === 'not_sent';
    });
    if (toText.length) {
      out.push({ key: 'texts', go: ['orders', 'ready'], title: toText.length + ' ready order' + (toText.length > 1 ? 's still need' : ' still needs') + ' a pickup text', sub: 'Customers do not know yet. One tap sends them all.', label: 'Text all ' + toText.length, run: function (btn, fin) {
        btn.classList.add('is-sending');
        toText.forEach(function (x, i) { setTimeout(function () { OD.sendText(x.order_id, null, undefined, true); }, OD.reduce ? 0 : i * 220); });
        setTimeout(function () { OD.toast('Pickup texts sent to ' + toText.length + ' customers. This is a preview, nothing was really sent.', { icon: 'send' }); fin(); }, OD.reduce ? 0 : toText.length * 220 + 800);
      } });
    }
    var quotes = D.messages.quotes.filter(function (q) { return q.state === 'new' && !S.replied[q.id]; }).sort(function (a, b) { return b.hours_waiting - a.hours_waiting; });
    if (quotes.length) {
      var q = quotes[0];
      out.push({ key: 'quote:' + q.id, go: ['customers', 'quotes'], title: q.label + ' is waiting on a quote', sub: q.summary + ', waiting ' + OD.ageText(q.hours_waiting), label: 'Reply', run: function (btn, fin) {
        btn.classList.add('is-sending');
        setTimeout(function () { S.replied[q.id] = true; OD.toast('Reply drafted to ' + q.label + ' from sales@mandmvinyl.com (preview).', { icon: 'send' }); fin(); }, OD.reduce ? 0 : 600);
      } });
    }
    var apps = D.customers.applications.filter(function (a) { return !S.approved[a.id]; });
    if (apps.length) {
      out.push({ key: 'apps', go: ['customers', 'applications'], title: apps.length + ' reseller application' + (apps.length > 1 ? 's are' : ' is') + ' waiting', sub: 'Approving unlocks their tier prices on the site.', label: 'Review', run: function () { goTo('customers', 'applications'); }, noDone: true });
    }
    queueItems().forEach(function (x) {
      var e = OD.eff(x);
      if (x.risk === 'due_soon' && e.status !== 'ready' && !S.done['soon:' + x.order_id]) {
        out.push({ key: 'soon:' + x.order_id, orderId: x.order_id, title: x.number + ' is due ' + OD.timeOf(x.promised_at), sub: x.customer_label + ' is ' + (e.status === 'new' ? 'not started yet' : e.status === 'art_check' ? 'in art check' : 'printing') + '.', label: 'Mark ready', run: function (btn, fin) { OD.markReady(x.order_id); fin(); } });
      }
    });
    D.customers.customers.filter(function (c) { return c.type === 'reseller' && c.cadence_status === 'slipping'; }).sort(function (a, b) { return b.spend_90d_cents - a.spend_90d_cents; }).forEach(function (c) {
      if (!S.done['nudge:' + c.id]) {
        out.push({ key: 'nudge:' + c.id, go: ['customers', 'resellers'], title: c.label + ' has gone quiet', sub: 'No order in ' + c.days_since_last_order + ' days. They usually order every ' + c.typical_gap_days + '.', label: 'Text a nudge', run: function (btn, fin) {
          btn.classList.add('is-sending');
          setTimeout(function () { OD.toast('Nudge sent to ' + c.label + '. This is a preview, nothing was really sent.', { icon: 'send' }); fin(); }, OD.reduce ? 0 : 700);
        } });
      }
    });
    return out;
  }
  OD.needsCandidates = needsCandidates;

  function nextReady() {
    var open = queueItems().filter(function (x) { return OD.eff(x).status !== 'ready'; }).sort(function (a, b) { return a.promised_at < b.promised_at ? -1 : 1; });
    return open[0] || null;
  }

  var shownNeeds = [];
  var needsLock = false;
  function needsHtml() {
    var all = needsCandidates();
    var top = all.slice(0, 5);
    shownNeeds = top;
    if (!top.length) {
      var nr = nextReady();
      return '<div class="od-caught"><svg class="od-caught__mark" viewBox="0 0 88 88" aria-hidden="true"><circle class="od-caught__halo" cx="44" cy="44" r="40"/><circle class="od-caught__ring" cx="44" cy="44" r="30" pathLength="1"/><path class="od-caught__check" d="m30 45 10 10 19-21" pathLength="1"/></svg><div class="od-caught__text"><b>You are all caught up.</b><span>Nothing needs you right now.</span></div></div>' +
        '<dl class="od-next"><div><dt>Next cutoff</dt><dd data-next-cutoff>Checking the clock...</dd></div><div><dt>Next order to be ready</dt><dd>' + (nr ? esc(nr.number + ' for ' + nr.customer_label + ', promised ' + OD.timeOf(nr.promised_at)) : 'Nothing in the shop right now') + '</dd></div></dl>';
    }
    return '<ul class="od-needs" data-needs-list>' + top.map(function (n, i) {
      return '<li class="od-need" data-need="' + esc(n.key) + '" style="--i:' + i + '"><span class="od-need__n">' + (i + 1) + '</span><div class="od-need__main"><p class="od-need__title">' + esc(n.title) + '</p><p class="od-need__sub" title="' + esc(n.sub) + '">' + esc(n.sub) + '</p></div><button class="od-btn" type="button" data-need-run="' + i + '"><span class="od-btn__label">' + esc(n.label) + '</span><span class="od-btn__spin" aria-hidden="true"></span></button></li>';
    }).join('') + '</ul>' + (all.length > 5 ? '<p class="od-more-note">' + (all.length - 5) + ' more will show up here as you clear these.</p>' : '');
  }

  /* ---------- Board ---------- */
  var BOARD = { seg: 'open', page: 0, per: 5 };
  function boardList() {
    return queueItems().filter(function (x) {
      var e = OD.eff(x);
      return BOARD.seg === 'ready' ? e.status === 'ready' : e.status !== 'ready';
    });
  }
  function boardHtml() {
    var q = boardList();
    var pages = Math.max(1, Math.ceil(q.length / BOARD.per));
    if (BOARD.page >= pages) BOARD.page = pages - 1;
    var rows = q.slice(BOARD.page * BOARD.per, (BOARD.page + 1) * BOARD.per).map(OD.orderRow).join('');
    if (!rows) rows = '<li class="od-empty">' + OD.icon('check') + '<p>Nothing here.</p></li>';
    return '<ul class="od-list">' + rows + '</ul>' + OD.pager('board', BOARD.page, BOARD.per, q.length);
  }
  function boardCounts() {
    var open = 0, ready = 0;
    queueItems().forEach(function (x) { if (OD.eff(x).status === 'ready') ready++; else open++; });
    return { open: open, ready: ready };
  }

  function lastFullDays(arr, n) {
    var asOf = OD.data.queue.meta.as_of.slice(0, 10);
    return arr.filter(function (d) { return OD.dowOf(d.date) !== 0 && d.date < asOf; }).slice(-n);
  }
  function weekSales(daysBack, offset) {
    var rows = OD.data.sales.daily.filter(function (d) { return OD.dowOf(d.date) !== 0; });
    var end = rows.length - offset;
    return rows.slice(Math.max(0, end - daysBack), end).reduce(function (n, d) { return n + d.web_cents + d.store_cents; }, 0);
  }
  OD.rollingSales = weekSales;

  function stripCell(label, valueHtml, note, series, caption, real) {
    return '<div class="od-cell"><div class="od-cell__top"><span class="od-cell__label">' + esc(label) + (real ? OD.realTag() : '') + '</span></div><b class="od-cell__value">' + valueHtml + '</b><span class="od-cell__note">' + note + '</span><div class="od-cell__spark">' + OD.charts.spark(series, { w: 200, h: 44, fluid: true, label: caption }) + '<span class="od-cell__cap">' + esc(caption) + '</span></div></div>';
  }

  OD.views.today = function () {
    var D = OD.data;
    var c = boardCounts();
    var cur = weekSales(6, 0);
    var prev = weekSales(6, 6);
    var G = D.gangsheets.month_totals;
    var d = OD.delta(cur, prev);
    var sheets = lastFullDays(D.gangsheets.daily, 21).map(function (x) { return x.total; });
    var orders = lastFullDays(D.sales.daily, 21).map(function (x) { return x.orders_web + x.orders_store; });
    var sales = lastFullDays(D.sales.daily, 21).map(function (x) { return x.web_cents + x.store_cents; });
    var seg = function (key, label, n) {
      return '<button type="button" class="od-seg__b' + (BOARD.seg === key ? ' is-on' : '') + '" data-board-seg="' + key + '">' + label + ' <em>' + n + '</em></button>';
    };
    var html =
      '<section class="od-card od-card--strip"><div class="od-cells">' +
      stripCell('Gang sheets, October', '<span data-od-count="' + G['2026-10_to_date'].total + '">' + G['2026-10_to_date'].total + '</span>', 'September: ' + G['2026-09'].total, sheets, 'Sample trend', true) +
      stripCell('Orders today', '<span data-od-count="' + D.kpis.today.orders_today + '">' + D.kpis.today.orders_today + '</span>', 'so far today', orders, 'Sample trend') +
      stripCell('Sales, last 6 open days', '<span data-od-count="' + cur + '" data-money="1">' + OD.money(cur, { cents: false }) + '</span>', '<span class="od-delta od-delta--' + (d >= 0 ? 'good' : 'bad') + '">' + (d >= 0 ? 'Up ' : 'Down ') + Math.abs(d).toFixed(1) + '%</span> vs prior 6', sales, 'Sample trend') +
      '</div></section>' +
      '<div class="od-today">' +
      OD.card('What needs you now', '<div data-needs>' + needsHtml() + '</div>', { cls: 'od-card--lead' }) +
      OD.card('What is on the board', '<div class="od-seg" role="group" aria-label="Board">' + seg('open', 'In the shop', c.open) + seg('ready', 'Ready', c.ready) + '</div><div data-board>' + boardHtml() + '</div>', {}) +
      '</div>';
    return {
      title: 'Today',
      html: html,
      mount: function (root) {
        var needsEl = root.querySelector('[data-needs]');
        var board = root.querySelector('[data-board]');
        var kbd = false;
        function redrawBoard() {
          board.innerHTML = boardHtml();
          var cc = boardCounts();
          root.querySelectorAll('[data-board-seg]').forEach(function (b) {
            b.querySelector('em').textContent = cc[b.getAttribute('data-board-seg') === 'open' ? 'open' : 'ready'];
          });
        }
        function renderNeeds(focusIdx) {
          needsEl.innerHTML = needsHtml();
          needsEl.querySelectorAll('.od-need').forEach(function (x) { x.classList.add('od-static'); });
          if (kbd && focusIdx != null) {
            var bs = needsEl.querySelectorAll('[data-need-run]');
            var b = bs[Math.min(focusIdx, bs.length - 1)];
            if (b) b.focus();
          }
        }
        root.addEventListener('click', function (e) {
          var run = e.target.closest('[data-need-run]');
          if (run) {
            var idx = +run.getAttribute('data-need-run');
            var n = shownNeeds[idx];
            if (!n) return;
            var li = run.closest('.od-need');
            needsLock = !n.noDone;
            var fin = function () {
              needsLock = false;
              if (!n.noDone) S.done[n.key] = true;
              li.classList.add('is-leaving');
              setTimeout(function () {
                renderNeeds(idx);
                redrawBoard();
                OD.changed({ silent: true });
              }, OD.reduce ? 0 : 220);
            };
            run.disabled = true;
            n.run(run, fin);
            return;
          }
          var sg = e.target.closest('[data-board-seg]');
          if (sg) {
            BOARD.seg = sg.getAttribute('data-board-seg');
            BOARD.page = 0;
            root.querySelectorAll('[data-board-seg]').forEach(function (b) { b.classList.toggle('is-on', b === sg); });
            redrawBoard();
            return;
          }
          var pg = e.target.closest('[data-pg]');
          if (pg && pg.getAttribute('data-pg').indexOf('board:') === 0) {
            BOARD.page += pg.getAttribute('data-pg') === 'board:next' ? 1 : -1;
            redrawBoard();
          }
        });
        OD.keys = {
          move: function (dir) {
            var bs = [].slice.call(needsEl.querySelectorAll('[data-need-run]'));
            if (!bs.length) return;
            var cur = bs.indexOf(document.activeElement);
            var next = cur === -1 ? (dir > 0 ? 0 : bs.length - 1) : Math.max(0, Math.min(bs.length - 1, cur + dir));
            kbd = true;
            bs[next].focus();
          },
          expand: function () {
            var li = document.activeElement && document.activeElement.closest && document.activeElement.closest('.od-need');
            if (!li) return false;
            var n = shownNeeds.filter(function (x) { return x.key === li.getAttribute('data-need'); })[0];
            if (!n) return false;
            if (n.orderId) OD.openOrder(n.orderId);
            else if (n.go) goTo(n.go[0], n.go[1]);
            return true;
          }
        };
        function onChange(ev) {
          redrawBoard();
          if (needsLock || (ev && ev.detail && ev.detail.silent)) return;
          var fresh = needsHtml();
          if (!needsEl.querySelector('.is-leaving') && needsEl.innerHTML.replace(/data-need-run="\d+"/g, '') !== fresh.replace(/data-need-run="\d+"/g, '')) renderNeeds();
        }
        document.addEventListener('od:changed', onChange);
        root.__cleanup = function () { document.removeEventListener('od:changed', onChange); OD.keys = null; };
      },
      tick: function (root) {
        var st = MM.cutoff ? MM.cutoff.getStatus(OD.now(), MM.config.schedule) : null;
        var greet = document.querySelector('[data-greeting]');
        var n = Math.min(5, needsCandidates().length);
        if (st && greet) {
          var fact = st.state === 'open' ? 'Same-day orders close in ' + MM.cutoff.formatRemaining(st.msRemaining) + '.' : 'Same-day is closed. ' + st.message + '.';
          greet.textContent = OD.partOfDay() + ' ' + fact + ' ' + (n ? n + (n === 1 ? ' thing needs' : ' things need') + ' you.' : 'You are all caught up.');
        }
        var nc = root.querySelector('[data-next-cutoff]');
        if (nc && st) {
          nc.textContent = st.state === 'open' ? 'Today at ' + (function () { var sc = MM.config.schedule.days[String(MM.cutoff.zoneParts(OD.now(), MM.config.schedule.timeZone).wd)]; return MM.cutoff.formatTime(sc.cutoff); })() + ', in ' + MM.cutoff.formatRemaining(st.msRemaining) : st.message.replace('Next same-day window opens ', 'Opens ');
        }
      }
    };
  };
})();
