(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var S = OD.session;

  var CAD = {
    on_track: { label: 'On track', tone: 'ok', rank: 3 },
    due: { label: 'Due to reorder', tone: 'warn', rank: 2 },
    slipping: { label: 'Slipping', tone: 'bad', rank: 1 },
    lapsed: { label: 'Gone quiet', tone: 'bad', rank: 0 }
  };
  var TIER = { volume: 'Volume', reseller: 'Reseller', standard: 'Standard' };
  var ST = { page: 0, per: 5 };

  function ago(d) { return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; }

  function cadTrack(c) {
    var pos = Math.min(100, (c.days_since_last_order / (c.typical_gap_days * 3)) * 100);
    return '<span class="od-cad" aria-hidden="true"><span class="od-cad__dot" style="--p:' + pos.toFixed(1) + '%"></span></span>';
  }

  function resellers() {
    return OD.data.customers.customers.filter(function (c) { return c.type === 'reseller'; }).sort(function (a, b) {
      return CAD[a.cadence_status].rank - CAD[b.cadence_status].rank || b.spend_90d_cents - a.spend_90d_cents;
    });
  }

  function resellerRows() {
    var list = resellers();
    var pages = Math.max(1, Math.ceil(list.length / ST.per));
    if (ST.page >= pages) ST.page = pages - 1;
    var html = list.slice(ST.page * ST.per, (ST.page + 1) * ST.per).map(function (c, i) {
      var cs = CAD[c.cadence_status];
      var needs = c.cadence_status !== 'on_track';
      var act = !needs ? '' : S.done['nudge:' + c.id] ? '<span class="od-sent">' + OD.icon('check') + '<span>Nudged</span></span>' : '<button class="od-btn" type="button" data-nudge="' + c.id + '"><span class="od-btn__label">Text a nudge</span><span class="od-btn__spin" aria-hidden="true"></span></button>';
      return '<li class="od-row od-row--acct" style="--i:' + i + '"><button class="od-row__hit" type="button" data-open-acct="' + c.id + '" aria-label="Open ' + esc(c.label) + '"></button><div class="od-row__main"><p class="od-row__title">' + esc(c.label) + ' <span>' + TIER[c.tier] + '</span></p><p class="od-row__sub">Last order ' + esc(ago(c.days_since_last_order)) + ', usually every ' + c.typical_gap_days + ' days</p></div>' + cadTrack(c) + '<div class="od-row__status">' + OD.tonePill(cs.label, cs.tone) + '</div><div class="od-row__action">' + act + '</div></li>';
    }).join('');
    return '<ul class="od-list">' + html + '</ul>' + OD.pager('cust', ST.page, ST.per, list.length);
  }

  function appsHtml() {
    var apps = OD.data.customers.applications;
    return '<ul class="od-list">' + apps.map(function (a) {
      var done = S.approved[a.id];
      if (done) return '<li class="od-row od-row--plain is-done"><div class="od-row__main"><p class="od-row__title">' + esc(a.label) + '</p><p class="od-row__sub">' + (done === 'declined' ? 'Declined. A polite note is queued (preview).' : 'Approved as ' + esc(done) + '. A welcome email is queued (preview).') + '</p></div><div class="od-row__action"><span class="od-sent">' + OD.icon('check') + '<span>Done</span></span></div></li>';
      return '<li class="od-row od-row--plain"><div class="od-row__main"><p class="od-row__title">' + esc(a.label) + '</p><p class="od-row__sub">' + esc(a.business_type) + ', applied ' + esc(OD.relDay(a.submitted_at, OD.data.queue.meta.as_of).toLowerCase()) + '. ' + (a.tax_exempt_doc ? 'Tax-exempt form attached.' : 'No tax-exempt form.') + '</p></div><div class="od-row__action od-row__action--wide"><label class="od-select"><span class="sr-only">Tier</span><select data-app-tier="' + a.id + '"><option>Reseller</option><option>Volume</option><option>Standard</option></select></label><button class="od-link" type="button" data-app-no="' + a.id + '">Decline</button><button class="od-btn" type="button" data-app-ok="' + a.id + '">Approve</button></div></li>';
    }).join('') + '</ul>';
  }

  function quotesHtml() {
    return '<ul class="od-list">' + OD.data.messages.quotes.map(function (q) {
      var rep = q.state === 'replied' || S.replied[q.id];
      return '<li class="od-row od-row--plain"><div class="od-row__main"><p class="od-row__title">' + esc(q.label) + ' <span>' + esc(q.type) + '</span></p><p class="od-row__sub">' + esc(q.summary) + (q.needed_by ? ', needed by ' + esc(OD.dateShort(q.needed_by)) : '') + (rep ? '' : ', waiting ' + esc(OD.ageText(q.hours_waiting))) + '</p></div><div class="od-row__action">' + (rep ? '<span class="od-sent">' + OD.icon('check') + '<span>Replied</span></span>' : '<button class="od-btn" type="button" data-reply="' + q.id + '">Reply</button>') + '</div></li>';
    }).join('') + '</ul>';
  }

  var TPL = null;
  function tplLabel(k) {
    if (!TPL) { TPL = {}; OD.data.messages.templates.forEach(function (t) { TPL[t.key] = t.label; }); }
    return TPL[k] || (k === 'art' ? 'Art needs a fix' : k);
  }
  function textsHtml() {
    var M = OD.data.messages;
    var all = S.log.map(function (l) { return { n: l.order_number, who: l.customer_label, tpl: l.template, when: l.sent_at_label, state: l.state }; })
      .concat(M.log.map(function (l) { return { n: l.order_number, who: l.customer_label, tpl: l.template, when: OD.relDay(l.sent_at, M.meta.as_of) + ' ' + OD.timeOf(l.sent_at), state: l.state }; }));
    var pages = Math.max(1, Math.ceil(all.length / 4));
    if (ST.page >= pages) ST.page = pages - 1;
    return '<ul class="od-list">' + all.slice(ST.page * 4, ST.page * 4 + 4).map(function (l) {
      return '<li class="od-row od-row--plain"><div class="od-row__main"><p class="od-row__title">' + esc(tplLabel(l.tpl)) + ' <span>to ' + esc(l.who) + ' for ' + esc(l.n) + '</span></p><p class="od-row__sub">' + esc(l.when) + '</p></div><div class="od-row__status">' + (l.state === 'failed' ? OD.tonePill('Failed', 'bad') : OD.tonePill('Delivered', 'ok')) + '</div></li>';
    }).join('') + '</ul>' + OD.pager('cust', ST.page, 4, all.length);
  }

  function reviewsHtml() {
    var R = OD.data.reviews;
    return '<div class="od-rating"><div class="od-stars" aria-label="No rating yet">' + [1, 2, 3, 4, 5].map(function () { return OD.icon('star'); }).join('') + '</div><p>Your Google rating and new reviews appear here once Google Business Profile is connected. Nothing has been invented.</p></div>' +
      '<ul class="od-quotelist">' + R.featured.map(function (r) {
        return '<li class="od-rq"><p>' + esc(r.quote.length > 150 ? r.quote.slice(0, 147).replace(/\s+\S*$/, '') + '...' : r.quote) + '</p><footer>' + esc(r.reviewer) + ' ' + OD.realTag('Real') + '</footer></li>';
      }).join('') + '</ul>' +
      '<button class="od-link" type="button" data-checklist>Get found as a DTF store: 0 of ' + R.checklist.length + ' steps done ' + OD.icon('chev') + '</button>';
  }

  function checklistDrawer() {
    var R = OD.data.reviews;
    return '<div class="od-drawer__top"><h2>Get found as a DTF store</h2></div><p class="od-note">From Master Plan v2. Your fight to be listed as a DTF store, not a craft store.</p><ul class="od-plain od-plain--check">' + R.checklist.map(function (c) { return '<li><span>' + esc(c.item) + (c.note ? '<small>' + esc(c.note) + '</small>' : '') + '</span>' + OD.tonePill('To do', 'gray') + '</li>'; }).join('') + '</ul>';
  }

  function acctDrawer(id) {
    var c = OD.data.customers.customers.filter(function (x) { return x.id === id; })[0];
    if (!c) return '';
    var cs = CAD[c.cadence_status];
    var draft = c.cadence_status === 'on_track'
      ? 'Hi, it is M&M Vinyl. Want to rebuild your last gang sheet order? Order by 2 PM and it is ready today.'
      : 'Hi, it is M&M Vinyl. We have not seen your order in a bit. Want us to hold a spot for same-day pickup? Order by 2 PM Mon-Fri.';
    return '<div class="od-drawer__top"><h2>' + esc(c.label) + '</h2>' + OD.tonePill(cs.label, cs.tone) + '</div><p class="od-drawer__who">' + TIER[c.tier] + ' tier &middot; ' + (c.tax_exempt_on_file ? 'tax-exempt on file' : 'no tax-exempt form') + '</p>' +
      '<p class="od-drawer__facts"><span>Last order ' + esc(ago(c.days_since_last_order)) + '</span><span>Usually every ' + c.typical_gap_days + ' days</span><span>' + OD.money(c.spend_90d_cents, { cents: false }) + ' in 90 days</span></p>' +
      '<h3 class="od-h3">Orders per week</h3><div data-acct-chart></div>' +
      '<h3 class="od-h3">Nudge text</h3><textarea class="od-textarea" rows="3">' + esc(draft) + '</textarea>' +
      '<div class="od-drawer__actions"><button class="od-btn" type="button" data-drawer-nudge="' + c.id + '">Send text</button><span class="od-quiet">' + (c.sms_opt_in === true ? 'Opted in to texts' : c.sms_opt_in === false ? 'Opted out, this will not send' : 'Opt-in unknown') + '</span></div>';
  }

  function body(seg) {
    if (seg === 'resellers') return resellerRows();
    if (seg === 'applications') return '<div data-apps>' + appsHtml() + '</div>';
    if (seg === 'quotes') return '<div data-quotes>' + quotesHtml() + '</div>';
    if (seg === 'texts') return '<div data-texts>' + textsHtml() + '</div>';
    return reviewsHtml();
  }

  OD.views.customers = function () {
    var D = OD.data;
    var slipping = resellers().filter(function (c) { return c.cadence_status === 'slipping' || c.cadence_status === 'lapsed'; }).length;
    var counts = {
      resellers: slipping + ' need a nudge',
      applications: D.customers.applications.filter(function (a) { return !S.approved[a.id]; }).length,
      quotes: D.messages.quotes.filter(function (q) { return q.state === 'new' && !S.replied[q.id]; }).length,
      texts: '', reviews: ''
    };
    var segs = [['resellers', 'Resellers'], ['applications', 'Applications'], ['quotes', 'Quotes'], ['texts', 'Texts'], ['reviews', 'Reviews']];
    var seg = OD.ui.customersSeg;
    ST.page = 0;
    var tabs = '<div class="od-seg" role="group" aria-label="Customers">' + segs.map(function (s) {
      var n = s[0] === 'resellers' ? '' : counts[s[0]];
      return '<button type="button" class="od-seg__b' + (seg === s[0] ? ' is-on' : '') + '" data-cseg="' + s[0] + '">' + s[1] + (n !== '' ? ' <em data-ccount="' + s[0] + '">' + n + '</em>' : '') + '</button>';
    }).join('') + '</div>';
    var subs = { resellers: 'Slipping accounts come first. About 90% of customers resell, from the Oct 26 call.', applications: 'Approving unlocks their tier prices on the site.', quotes: 'Team and business requests, with a reminder after 24 hours.', texts: 'Every automated text is logged.', reviews: 'Reviews and your Google listing.' };
    return {
      title: 'Customers',
      html: OD.card('', tabs + '<p class="od-note" data-csub>' + subs[seg] + '</p><div data-cbody class="od-swap-in">' + body(seg) + '</div>', {}),
      mount: function (root) {
        var host = root.querySelector('[data-cbody]');
        var sub = root.querySelector('[data-csub]');
        function show(s) {
          if (s !== seg) ST.page = 0;
          seg = OD.ui.customersSeg = s;
          host.innerHTML = body(s);
          host.classList.remove('od-swap-in'); void host.offsetWidth; host.classList.add('od-swap-in');
          sub.textContent = subs[s];
          root.querySelectorAll('[data-cseg]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-cseg') === s); });
        }
        function refreshCounts() {
          var a = root.querySelector('[data-ccount="applications"]');
          if (a) a.textContent = D.customers.applications.filter(function (x) { return !S.approved[x.id]; }).length;
          var q = root.querySelector('[data-ccount="quotes"]');
          if (q) q.textContent = D.messages.quotes.filter(function (x) { return x.state === 'new' && !S.replied[x.id]; }).length;
        }
        root.addEventListener('click', function (e) {
          var t = e.target;
          var sg = t.closest('[data-cseg]');
          if (sg) { show(sg.getAttribute('data-cseg')); return; }
          var pg = t.closest('[data-pg]');
          if (pg && pg.getAttribute('data-pg').indexOf('cust:') === 0) {
            ST.page += pg.getAttribute('data-pg') === 'cust:next' ? 1 : -1;
            host.innerHTML = body(seg);
            host.classList.remove('od-swap-in'); void host.offsetWidth; host.classList.add('od-swap-in');
            return;
          }
          if (t.closest('[data-checklist]')) { OD.drawer.open(checklistDrawer()); return; }
          var n = t.closest('[data-nudge]');
          if (n) {
            var id = n.getAttribute('data-nudge');
            n.classList.add('is-sending');
            n.disabled = true;
            setTimeout(function () {
              S.done['nudge:' + id] = true;
              OD.toast('Nudge sent to ' + OD.custMap()[id].label + '. This is a preview, nothing was really sent.', { icon: 'send' });
              show('resellers');
              OD.changed({});
            }, OD.reduce ? 0 : 700);
            return;
          }
          var a = t.closest('[data-open-acct]');
          if (a) {
            var cid = a.getAttribute('data-open-acct');
            OD.drawer.open(acctDrawer(cid));
            var c = OD.custMap()[cid];
            var hostC = document.querySelector('[data-acct-chart]');
            requestAnimationFrame(function () {
              OD.charts.bars(hostC, { labels: c.weekly_orders_8w.map(function (_, i) { return i === 7 ? 'Now' : '-' + (7 - i) + 'w'; }), series: [{ name: 'Orders', values: c.weekly_orders_8w }], height: 120, ticks: 2, label: 'Orders per week' });
            });
            return;
          }
          var ok = t.closest('[data-app-ok]'), no = t.closest('[data-app-no]');
          if (ok || no) {
            var aid = (ok || no).getAttribute(ok ? 'data-app-ok' : 'data-app-no');
            var sel = root.querySelector('[data-app-tier="' + aid + '"]');
            S.approved[aid] = ok ? (sel ? sel.value : 'Reseller') : 'declined';
            host.querySelector('[data-apps]').innerHTML = appsHtml();
            var lbl = D.customers.applications.filter(function (x) { return x.id === aid; })[0].label;
            OD.toast(ok ? lbl + ' approved as ' + S.approved[aid] + ' (preview).' : lbl + ' declined (preview).', { icon: ok ? 'check' : 'close' });
            refreshCounts();
            OD.changed({});
            return;
          }
          var r = t.closest('[data-reply]');
          if (r) {
            var qid = r.getAttribute('data-reply');
            S.replied[qid] = true;
            host.querySelector('[data-quotes]').innerHTML = quotesHtml();
            OD.toast('Reply drafted from sales@mandmvinyl.com (preview).', { icon: 'send' });
            refreshCounts();
            OD.changed({});
          }
        });
        root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('[data-open-acct]')) e.target.click(); });
        var onChange = function () {
          var texts = root.querySelector('[data-texts]');
          if (texts) texts.innerHTML = textsHtml();
          refreshCounts();
        };
        document.addEventListener('od:changed', onChange);
        root.__cleanup = function () { document.removeEventListener('od:changed', onChange); };
      }
    };
  };

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-drawer-nudge]');
    if (b) {
      S.done['nudge:' + b.getAttribute('data-drawer-nudge')] = true;
      OD.toast('Nudge sent (preview, nothing was really sent).', { icon: 'send' });
      OD.drawer.close();
      OD.changed({});
      if (OD.currentRoute && OD.currentRoute() === 'customers') {
        var host = document.querySelector('[data-cbody]');
        if (host && OD.ui.customersSeg === 'resellers') host.innerHTML = body('resellers');
      }
    }
  });
})();
