(function () {
  'use strict';
  var MM = window.MM;
  var OD = (window.OD = window.OD || {});

  OD.reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  var esc = (OD.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  });

  var SAMPLE_BASE = Date.UTC(2026, 9, 26, 16, 42, 0);
  var loadedAt = Date.now();
  OD.clockMode = (MM.store.get('mm.od.clock', 'live') === 'sample' || /[?&]clock=sample/.test(location.search)) ? 'sample' : 'live';
  OD.now = function () {
    return OD.clockMode === 'sample' ? new Date(SAMPLE_BASE + (Date.now() - loadedAt)) : new Date();
  };
  OD.setClockMode = function (m) {
    OD.clockMode = m;
    loadedAt = Date.now();
    MM.store.set('mm.od.clock', m);
  };

  OD.money = function (cents, opts) {
    opts = opts || {};
    var v = Number(cents || 0) / 100;
    if (opts.compact && Math.abs(v) >= 10000) return '$' + (v / 1000).toFixed(v >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: opts.cents === false || Math.abs(v) >= 1000 ? 0 : 2, maximumFractionDigits: opts.cents === false || Math.abs(v) >= 1000 ? 0 : 2 });
  };
  OD.num = function (n) {
    return Number(n || 0).toLocaleString('en-US');
  };
  OD.pct = function (n, d) {
    if (n == null) return '';
    return (n > 0 ? '+' : '') + Number(n).toFixed(d == null ? 1 : d).replace(/\.0$/, '') + '%';
  };
  OD.delta = function (a, b) {
    if (!b) return null;
    return ((a - b) / b) * 100;
  };

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  OD.MONTHS = MONTHS;
  OD.DAYS = DAYS;

  OD.dowOf = function (date) {
    return new Date(date.slice(0, 10) + 'T12:00:00Z').getUTCDay();
  };
  OD.timeOf = function (isoStr) {
    if (!isoStr) return '';
    var h = parseInt(isoStr.slice(11, 13), 10);
    var m = isoStr.slice(14, 16);
    return (h % 12 === 0 ? 12 : h % 12) + ':' + m + ' ' + (h >= 12 ? 'PM' : 'AM');
  };
  OD.minOf = function (isoStr) {
    return parseInt(isoStr.slice(11, 13), 10) * 60 + parseInt(isoStr.slice(14, 16), 10);
  };
  OD.dateShort = function (date) {
    var d = date.slice(0, 10).split('-');
    return MONTHS[+d[1] - 1] + ' ' + +d[2];
  };
  OD.dateDow = function (date) {
    return DAYS[OD.dowOf(date)] + ' ' + OD.dateShort(date);
  };
  OD.relDay = function (isoStr, asOf) {
    var a = isoStr.slice(0, 10);
    var b = asOf.slice(0, 10);
    var diff = Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return OD.dateDow(a);
  };
  OD.ageText = function (hours) {
    if (hours < 1) return 'under 1 h';
    if (hours < 48) return Math.round(hours) + ' h';
    return Math.round(hours / 24) + ' days';
  };

  var ICONS = {
    today: '<path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5z"/>',
    orders: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 20c.5-3.4 3-5.2 6-5.2s5.5 1.8 6 5.2M16 5.6a3.3 3.3 0 0 1 0 6.1M18 15.2c1.6.7 2.7 2.2 3 4.8"/>',
    sheet: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><rect x="7" y="7" width="4" height="4" rx="1"/><rect x="13" y="7" width="4" height="7" rx="1"/><rect x="7" y="13" width="4" height="4" rx="1"/>',
    chart: '<path d="M5 20V10m5 10V4m5 16v-7m5 7H3"/>',
    money: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 9.2c-.4-.9-1.3-1.4-2.5-1.4-1.5 0-2.5.8-2.5 1.9 0 2.7 5.2 1.3 5.2 4 0 1.1-1.1 1.9-2.7 1.9-1.3 0-2.3-.6-2.7-1.6M12 6.2v1.6m0 8.4v1.6"/>',
    truck: '<path d="M3 6.5h11v10H3zM14 10h4l3 3v3.5h-7"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    chat: '<path d="M4 5.5h16a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-9l-5 4v-4H4a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5z"/>',
    star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4-4 5.6-.8z"/>',
    box: '<path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9zM3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    plug: '<path d="M9 3v5m6-5v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4"/>',
    gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.3m0 12.4v2.3M3.5 12h2.3m12.4 0h2.3M6 6l1.6 1.6m8.8 8.8L18 18M18 6l-1.6 1.6M7.6 16.4 6 18"/>',
    report: '<path d="M7 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 7 20zM14.5 3.5V8H19M10 12.5h6M10 16h6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    send: '<path d="M4 12 20 4l-4 16-4.5-6.5zM11.5 13.5 20 4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    warn: '<path d="M12 4 3 19.5h18zM12 10v4.5M12 17.3v.2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    phone: '<path d="M6.6 3.5h3l1.3 4-2 1.4a11 11 0 0 0 5.2 5.2l1.4-2 4 1.3v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
    printer: '<path d="M7 9V3.5h10V9M7 17H4.5V9h15v8H17M7 14h10v6.5H7z"/>',
    bag: '<path d="M5 8h14l-1 12H6zM9 8V6.5a3 3 0 0 1 6 0V8"/>',
    shop: '<path d="M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1 2.3 2.7 2.3S9.3 10.900 9.3 9.500c0 1.400 1 2.300 2.700 2.300s2.700-.900 2.700-2.300c0 1.400 1 2.300 2.700 2.300S20 10.900 20 9.500M10 20v-5h4v5"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.500 12h17M12 3.500c2.400 2.400 3.500 5.200 3.500 8.500s-1.100 6.100-3.500 8.500c-2.400-2.400-3.500-5.200-3.500-8.500S9.600 5.900 12 3.500z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    undo: '<path d="M9 8H5V4M5.500 8A8 8 0 1 1 4 12"/>',
    eye: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>',
    download: '<path d="M12 4v11m-4.500-4.500L12 15l4.500-4.500M5 19.500h14"/>',
    bolt: '<path d="m13 3-7.500 10H11l-1 8 7.500-10H12z"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>'
  };
  OD.icon = function (name, cls) {
    return '<svg class="od-icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };

  var STATUS = {
    new: { label: 'New', tone: 'gray' },
    art_check: { label: 'Art check', tone: 'warn' },
    printing: { label: 'Printing', tone: 'live' },
    on_hold: { label: 'On hold', tone: 'bad' },
    payment_failed: { label: 'Payment failed', tone: 'bad' },
    ready: { label: 'Ready for pickup', tone: 'ok' },
    picked_up: { label: 'Picked up', tone: 'done' },
    shipped: { label: 'Shipped', tone: 'done' }
  };
  OD.STATUS = STATUS;
  var TONE_ALIAS = { mint: 'ok', amber: 'warn', red: 'bad' };
  OD.tonePill = function (label, tone) {
    tone = TONE_ALIAS[tone] || tone || 'gray';
    return '<span class="od-pill"><i class="od-dot od-dot--' + tone + '"></i>' + esc(label) + '</span>';
  };
  OD.pill = function (status) {
    var s = STATUS[status] || { label: status, tone: 'gray' };
    return OD.tonePill(s.label, s.tone);
  };
  OD.PAY = { card: 'Card', apple_pay: 'Apple Pay', google_pay: 'Google Pay', paypal: 'PayPal', venmo: 'Venmo', cash: 'Cash' };

  OD.sampleTag = function () { return ''; };
  OD.realTag = function (text) {
    return '<span class="od-real"><i></i>' + esc(text && text !== 'Real count' ? text : 'Real') + '</span>';
  };
  OD.source = function () { return ''; };

  OD.card = function (title, body, o) {
    o = o || {};
    return (
      '<section class="od-card' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '>' +
      (title ? '<header class="od-card__head"><div><h2 class="od-card__title">' + title + '</h2>' + (o.sub ? '<p class="od-card__sub">' + o.sub + '</p>' : '') + '</div>' + (o.actions ? '<div class="od-card__actions">' + o.actions + '</div>' : '') + '</header>' : '') +
      '<div class="od-card__body">' + body + '</div>' +
      '</section>'
    );
  };

  OD.stat = function (o) {
    var delta = '';
    if (o.delta != null) {
      var up = o.delta >= 0;
      delta = '<span class="od-delta od-delta--' + (up ? 'good' : 'bad') + '">' + (up ? 'Up ' : 'Down ') + Math.abs(o.delta).toFixed(1).replace(/\.0$/, '') + '%</span>';
    }
    var valueAttrs = o.count != null ? ' data-od-count="' + o.count + '"' + (o.prefix ? ' data-prefix="' + esc(o.prefix) + '"' : '') + (o.suffix ? ' data-suffix="' + esc(o.suffix) + '"' : '') + (o.money ? ' data-money="1"' : '') + (o.compact ? ' data-compact="1"' : '') : '';
    return (
      '<div class="od-num' + (o.cls ? ' ' + o.cls : '') + '">' +
      '<span class="od-num__label">' + esc(o.label) + (o.real ? OD.realTag(o.realText) : '') + '</span>' +
      '<b class="od-num__value"' + valueAttrs + '>' + (o.html != null ? o.html : esc(o.value == null ? '' : o.value)) + '</b>' +
      '<span class="od-num__note">' + delta + (o.note ? esc(o.note) : '') + '</span></div>'
    );
  };

  OD.countUp = function (el, instant) {
    var to = parseFloat(el.getAttribute('data-od-count'));
    if (isNaN(to)) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var money = el.getAttribute('data-money');
    var compact = el.getAttribute('data-compact');
    function show(v) {
      if (money) el.textContent = OD.money(Math.round(v), { compact: !!compact, cents: false });
      else el.textContent = prefix + Math.round(v).toLocaleString('en-US') + suffix;
    }
    if (OD.reduce || instant === true) {
      show(to);
      return;
    }
    var start = null;
    var dur = 900 + Math.min(600, Math.abs(to) > 1000 ? 400 : 0);
    function tick(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      show(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
      else show(to);
    }
    show(0);
    requestAnimationFrame(tick);
  };

  OD.pager = function (key, page, per, total) {
    var pages = Math.max(1, Math.ceil(total / per));
    if (total <= per) return '';
    var from = page * per + 1;
    var to = Math.min(total, (page + 1) * per);
    return '<div class="od-pager"><span>' + from + ' to ' + to + ' of ' + total + '</span><span class="od-pager__btns"><button class="od-pager__b" type="button" data-pg="' + key + ':prev"' + (page === 0 ? ' disabled' : '') + ' aria-label="Previous page">' + OD.icon('chev', 'od-flip') + '</button><button class="od-pager__b" type="button" data-pg="' + key + ':next"' + (page >= pages - 1 ? ' disabled' : '') + ' aria-label="Next page">' + OD.icon('chev') + '</button></span></div>';
  };

  OD.partOfDay = function () {
    var h = 12;
    try { h = +OD.now().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/Chicago' }) % 24; } catch (e) {}
    return h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';
  };

  OD.toast = function (message, o) {
    o = o || {};
    var region = document.querySelector('.od-toasts');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'od-toast' + (o.tone ? ' od-toast--' + o.tone : '');
    el.innerHTML = OD.icon(o.icon || 'check') + '<span>' + esc(message) + '</span>';
    region.appendChild(el);
    requestAnimationFrame(function () {
      el.classList.add('is-in');
    });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () {
        el.remove();
      }, 300);
    }, o.ms || 3200);
  };

  var FILES = ['kpis', 'queue', 'orders', 'customers', 'gangsheets', 'sales', 'payments', 'shipments', 'messages', 'reviews', 'inventory', 'integrations', 'settings', 'report'];
  OD.data = {};
  OD.load = function (names) {
    names = names || FILES;
    return Promise.all(
      names.map(function (n) {
        if (OD.data[n]) return Promise.resolve(OD.data[n]);
        return fetch(MM.url('data/dashboard/' + n + '.json'))
          .then(function (r) {
            if (!r.ok) throw new Error(n + '.json ' + r.status);
            return r.json();
          })
          .then(function (j) {
            OD.data[n] = j;
            return j;
          });
      })
    ).then(function () {
      return OD.data;
    });
  };

  OD.session = {
    texted: {},
    approved: {},
    log: []
  };

  OD.firstRender = true;
  OD.hydrate = function (root) {
    var animate = OD.firstRender;
    OD.firstRender = false;
    Array.prototype.slice.call(root.querySelectorAll('[data-od-count]')).forEach(function (el) { OD.countUp(el, !animate); });
    Array.prototype.slice.call(root.querySelectorAll('.od-card')).forEach(function (el, i) {
      el.style.setProperty('--i', Math.min(i, 14));
    });
  };

  var tipEl = null;
  OD.tip = {
    show: function (html, x, y) {
      if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.className = 'od-tip';
        tipEl.setAttribute('role', 'presentation');
        document.body.appendChild(tipEl);
      }
      tipEl.innerHTML = html;
      tipEl.classList.add('is-on');
      var w = tipEl.offsetWidth;
      var h = tipEl.offsetHeight;
      var left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14));
      var top = y - h - 14;
      if (top < 8) top = y + 18;
      tipEl.style.transform = 'translate(' + left + 'px,' + top + 'px)';
    },
    hide: function () {
      if (tipEl) tipEl.classList.remove('is-on');
    }
  };
})();
