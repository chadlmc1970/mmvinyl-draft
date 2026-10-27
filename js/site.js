/* 00-core.js */
(function () {
  'use strict';
  var MM = (window.MM = window.MM || {});

  var meta = document.querySelector('meta[name="mm-root"]');
  MM.root = meta ? meta.getAttribute('content') : './';

  MM.url = function (path) {
    return new URL(MM.root + String(path).replace(/^\//, ''), location.href).href;
  };

  MM.config = (function () {
    try {
      return JSON.parse(document.getElementById('mm-config').textContent);
    } catch (e) {
      return {};
    }
  })();

  MM.$ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };

  MM.$$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  MM.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  MM.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: function (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  MM.session = {
    get: function (key) {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {}
    }
  };

  MM.money = function (cents) {
    return '$' + (Number(cents || 0) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  MM.toast = function (message) {
    var region = document.querySelector('[data-toasts]');
    if (!region) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    region.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 2600);
  };

  MM.pageKey = function () {
    var p = location.pathname;
    try {
      var rootPath = new URL(MM.root, location.href).pathname;
      if (p.indexOf(rootPath) === 0) p = '/' + p.slice(rootPath.length);
    } catch (e) {}
    return p.replace(/index\.html$/, '') || '/';
  };

  MM.trapFocus = function (container, event) {
    if (event.key !== 'Tab') return;
    var f = MM.$$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', container).filter(function (el) {
      return el.offsetParent !== null;
    });
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      last.focus();
      event.preventDefault();
    } else if (!event.shiftKey && document.activeElement === last) {
      first.focus();
      event.preventDefault();
    }
  };

  MM.ready = function (fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  };
})();

;
/* 10-cutoff-logic.js */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MM = root.MM || {};
    root.MM.cutoff = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULT_CONFIG = {
    timeZone: 'America/Chicago',
    closedDates: [],
    days: {
      '0': null,
      '1': { open: '08:30', close: '17:00', cutoff: '14:00' },
      '2': { open: '08:30', close: '17:00', cutoff: '14:00' },
      '3': { open: '08:30', close: '17:00', cutoff: '14:00' },
      '4': { open: '08:30', close: '17:00', cutoff: '14:00' },
      '5': { open: '08:30', close: '17:00', cutoff: '14:00' },
      '6': { open: '09:00', close: '13:00', cutoff: '10:00' }
    }
  };

  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WD_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  var formatters = {};

  function formatter(tz) {
    if (!formatters[tz]) {
      formatters[tz] = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short'
      });
    }
    return formatters[tz];
  }

  function zoneParts(date, tz) {
    var out = {};
    formatter(tz)
      .formatToParts(date)
      .forEach(function (p) {
        out[p.type] = p.value;
      });
    return {
      y: +out.year,
      m: +out.month,
      d: +out.day,
      h: +out.hour % 24,
      mi: +out.minute,
      s: +out.second,
      wd: WD_INDEX[out.weekday]
    };
  }

  function offsetAt(utcMs, tz) {
    var p = zoneParts(new Date(utcMs), tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(utcMs / 1000) * 1000;
  }

  function zonedToUtc(y, m, d, h, mi, tz) {
    var guess = Date.UTC(y, m - 1, d, h, mi, 0);
    var utc = guess - offsetAt(guess, tz);
    utc = guess - offsetAt(utc, tz);
    return utc;
  }

  function addDays(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function dateKey(day) {
    return day.y + '-' + pad(day.m) + '-' + pad(day.d);
  }

  function hm(str) {
    var a = str.split(':');
    return { h: +a[0], mi: +a[1] };
  }

  function formatTime(str) {
    var t = hm(str);
    var h12 = t.h % 12 === 0 ? 12 : t.h % 12;
    return h12 + ':' + pad(t.mi) + ' ' + (t.h >= 12 ? 'PM' : 'AM');
  }

  function scheduleFor(day, cfg) {
    if (cfg.closedDates && cfg.closedDates.indexOf(dateKey(day)) !== -1) return null;
    return cfg.days[String(day.wd)] || null;
  }

  function formatRemaining(ms) {
    var totalMin = Math.floor(ms / 60000);
    var h = Math.floor(totalMin / 60);
    var m = totalMin % 60;
    if (h > 0) return m ? h + 'h ' + m + 'm' : h + 'h';
    return m + 'm';
  }

  function getStatus(now, config) {
    var cfg = config || DEFAULT_CONFIG;
    var tz = cfg.timeZone || DEFAULT_CONFIG.timeZone;
    var date = now instanceof Date ? now : new Date(now);
    var p = zoneParts(date, tz);
    var today = { y: p.y, m: p.m, d: p.d, wd: p.wd };
    var sched = scheduleFor(today, cfg);
    var wasOpenToday = false;

    if (sched) {
      var c = hm(sched.cutoff);
      var cutoffAt = zonedToUtc(today.y, today.m, today.d, c.h, c.mi, tz);
      var remaining = cutoffAt - date.getTime();
      if (remaining > 0) {
        return {
          state: 'open',
          message:
            remaining < 60000
              ? 'Less than a minute left to order for same-day'
              : 'Order in the next ' + formatRemaining(remaining) + ' for same-day',
          msRemaining: remaining,
          cutoffAt: new Date(cutoffAt).toISOString(),
          nextOpenAt: null,
          nextOpenLabel: null
        };
      }
      wasOpenToday = true;
    }

    for (var i = 1; i <= 21; i++) {
      var day = addDays(today.y, today.m, today.d, i);
      var s = scheduleFor(day, cfg);
      if (!s) continue;
      var o = hm(s.open);
      var openAt = zonedToUtc(day.y, day.m, day.d, o.h, o.mi, tz);
      var dayLabel = i === 1 ? 'tomorrow' : WEEKDAYS[day.wd];
      var label = dayLabel + ' ' + formatTime(s.open);
      return {
        state: wasOpenToday ? 'cutoff-passed' : 'closed',
        message: 'Next same-day window opens ' + label,
        msRemaining: 0,
        cutoffAt: null,
        nextOpenAt: new Date(openAt).toISOString(),
        nextOpenLabel: label
      };
    }

    return { state: 'closed', message: 'Call us for the next same-day window', msRemaining: 0, cutoffAt: null, nextOpenAt: null, nextOpenLabel: null };
  }

  return {
    getStatus: getStatus,
    zoneParts: zoneParts,
    zonedToUtc: zonedToUtc,
    formatTime: formatTime,
    formatRemaining: formatRemaining,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };
});

;
/* 11-cutoff.js */
(function () {
  'use strict';
  var MM = window.MM;
  if (!MM || !MM.cutoff) return;

  var frozen = null;
  try {
    var q = new URLSearchParams(location.search).get('now');
    var t = q ? new Date(q).getTime() : NaN;
    if (!isNaN(t)) frozen = { base: t, start: Date.now() };
  } catch (e) {}

  MM.cutoff.now = function () {
    return frozen ? new Date(frozen.base + (Date.now() - frozen.start)) : new Date();
  };

  if (frozen) {
    var realStatus = MM.cutoff.getStatus;
    MM.cutoff.getStatus = function (d, c) {
      return realStatus(MM.cutoff.now(), c);
    };
  }

  function render() {
    var status = MM.cutoff.getStatus(MM.cutoff.now(), MM.config.schedule);
    MM.$$('[data-cutoff]').forEach(function (el) {
      el.textContent = status.message;
      el.setAttribute('data-state', status.state === 'open' ? 'open' : 'closed');
      el.hidden = false;
    });
    document.documentElement.setAttribute('data-cutoff-state', status.state);
    document.dispatchEvent(new CustomEvent('mm:cutoff', { detail: status }));
  }

  MM.cutoff.refresh = render;
  MM.ready(function () {
    render();
    setInterval(render, 15000);
  });
})();

;
/* 20-nav.js */
(function () {
  'use strict';
  var MM = window.MM;

  MM.ready(function () {
    var toggle = MM.$('[data-menu-toggle]');
    var menu = MM.$('[data-menu]');
    var header = MM.$('#site-header');
    if (!toggle || !menu) return;

    function setOpen(open) {
      if (open && header) {
        var bottom = Math.max(0, Math.round(header.getBoundingClientRect().bottom));
        menu.style.setProperty('--menu-top', bottom + 'px');
      }
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
      menu.hidden = !open;
      document.body.classList.toggle('is-locked', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    var mq = window.matchMedia('(min-width: 64rem)');
    var onChange = function (e) {
      if (e.matches) setOpen(false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  });
})();

;
/* 25-ui.js */
(function () {
  'use strict';
  var MM = window.MM;

  function initTabs(root) {
    var tabs = MM.$$('[role="tab"]', root);
    var panels = MM.$$('[role="tabpanel"]', root);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach(function (p) {
        p.hidden = p.id !== tab.getAttribute('aria-controls');
      });
      if (focus) tab.focus();
    }
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () {
        select(tab, false);
      });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next, true);
        }
      });
    });
    var current = tabs.filter(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    })[0];
    select(current || tabs[0], false);
  }

  function initAccordionGroup(root) {
    var items = MM.$$('details', root);
    items.forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        items.forEach(function (o) {
          if (o !== d) o.open = false;
        });
      });
    });
  }

  function initSampleToggle() {
    var key = 'mm.sample.v1';
    var state = MM.store.get(key, 'on');
    document.documentElement.setAttribute('data-sample', state);
    MM.$$('[data-sample-toggle]').forEach(function (input) {
      input.checked = state === 'on';
      input.addEventListener('change', function () {
        var s = input.checked ? 'on' : 'off';
        MM.store.set(key, s);
        document.documentElement.setAttribute('data-sample', s);
        MM.$$('[data-sample-toggle]').forEach(function (o) {
          o.checked = input.checked;
        });
        document.dispatchEvent(new CustomEvent('mm:sample', { detail: s }));
      });
    });
  }

  function initToday() {
    var d = new Date();
    var text = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: (MM.config.schedule || {}).timeZone || 'America/Chicago' });
    MM.$$('[data-today]').forEach(function (el) {
      el.textContent = text;
    });
  }

  function initTableRegions() {
    MM.$$('.table-wrap').forEach(function (w, i) {
      if (w.hasAttribute('tabindex')) return;
      w.setAttribute('tabindex', '0');
      w.setAttribute('role', 'region');
      var cap = MM.$('caption', w);
      w.setAttribute('aria-label', (cap ? cap.textContent.trim() : 'Table') || 'Table ' + (i + 1));
    });
  }

  MM.ready(function () {
    initTableRegions();
    MM.$$('[data-tabs]').forEach(initTabs);
    MM.$$('[data-accordion-group]').forEach(initAccordionGroup);
    initSampleToggle();
    initToday();
    document.body.classList.toggle('has-bottom-tabs', !!MM.$('.app__tabs'));
  });
})();

;
/* 30-cart.js */
(function () {
  'use strict';
  var MM = window.MM;
  var KEY = 'mm.cart.v1';

  function read() {
    var data = MM.store.get(KEY, { items: [] });
    return Array.isArray(data.items) ? data.items : [];
  }

  function lineKey(item) {
    return String(item.id) + '|' + (item.variant || '');
  }

  var cart = {
    items: function () {
      return read();
    },
    count: function () {
      return read().reduce(function (n, i) {
        return n + i.qty;
      }, 0);
    },
    subtotal: function () {
      return read().reduce(function (n, i) {
        return n + i.priceCents * i.qty;
      }, 0);
    },
    save: function (items) {
      MM.store.set(KEY, { items: items, updated: Date.now() });
      document.dispatchEvent(new CustomEvent('mm:cart', { detail: { items: items, count: cart.count(), subtotal: cart.subtotal() } }));
    },
    add: function (item) {
      var items = read();
      var qty = Math.max(1, parseInt(item.qty, 10) || 1);
      var clean = {
        id: String(item.id),
        variant: item.variant || '',
        name: item.name || 'Item',
        priceCents: Math.max(0, Math.round(Number(item.priceCents) || 0)),
        image: item.image || '',
        url: item.url || '',
        liveId: item.liveId || String(item.id),
        liveUrl: item.liveUrl || '',
        type: item.type || 'simple',
        qty: qty
      };
      var found = items.filter(function (i) {
        return lineKey(i) === lineKey(clean);
      })[0];
      if (found) found.qty += qty;
      else items.push(clean);
      cart.save(items);
      return clean;
    },
    setQty: function (id, variant, qty) {
      var key = String(id) + '|' + (variant || '');
      var items = read()
        .map(function (i) {
          if (lineKey(i) === key) i.qty = Math.max(0, Math.min(999, parseInt(qty, 10) || 0));
          return i;
        })
        .filter(function (i) {
          return i.qty > 0;
        });
      cart.save(items);
    },
    remove: function (id, variant) {
      cart.setQty(id, variant, 0);
    },
    clear: function () {
      cart.save([]);
    },
    liveHandoff: function () {
      var live = (MM.config.liveUrl || 'https://mandmvinyl.com').replace(/\/$/, '');
      var items = read();
      var cartUrl = MM.config.liveCartUrl || live + '/cart/';
      var links = items.map(function (i) {
        var url =
          i.type === 'simple' && i.liveId
            ? live + '/cart/?add-to-cart=' + encodeURIComponent(i.liveId) + '&quantity=' + i.qty
            : i.liveUrl || live + '/products/';
        return { name: i.name, qty: i.qty, url: url, direct: i.type === 'simple' };
      });
      var primary = items.length === 1 ? links[0].url : cartUrl;
      return { primary: primary, links: links };
    }
  };

  MM.cart = cart;

  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      document.dispatchEvent(new CustomEvent('mm:cart', { detail: { items: read(), count: cart.count(), subtotal: cart.subtotal() } }));
    }
  });
})();

;
/* 31-cart-ui.js */
(function () {
  'use strict';
  var MM = window.MM;
  var drawer;
  var lastFocus = null;

  function renderCount() {
    var n = MM.cart.count();
    MM.$$('[data-cart-count]').forEach(function (el) {
      el.textContent = n > 99 ? '99+' : String(n);
      el.setAttribute('data-count', String(n));
    });
    MM.$$('[data-cart-open]').forEach(function (b) {
      b.setAttribute('aria-label', 'Open cart, ' + n + (n === 1 ? ' item' : ' items'));
    });
  }

  function lineHtml(i) {
    var img = i.image ? '<img class="cart-line__img" src="' + MM.esc(i.image) + '" alt="" width="72" height="72">' : '<span class="cart-line__img" aria-hidden="true"></span>';
    var name = i.url ? '<a href="' + MM.esc(i.url) + '">' + MM.esc(i.name) + '</a>' : MM.esc(i.name);
    return (
      '<li class="cart-line" data-id="' + MM.esc(i.id) + '" data-variant="' + MM.esc(i.variant) + '">' +
      img +
      '<div><p class="cart-line__name">' + name + '</p>' +
      '<p class="cart-line__meta">' + (i.variant ? MM.esc(i.variant) + ' &middot; ' : '') + MM.money(i.priceCents) + ' each</p>' +
      '<div class="qty" role="group" aria-label="Quantity for ' + MM.esc(i.name) + '">' +
      '<button type="button" data-qty-step="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<input type="number" min="1" max="999" value="' + i.qty + '" inputmode="numeric" aria-label="Quantity" data-qty-input>' +
      '<button type="button" data-qty-step="1" aria-label="Increase quantity">+</button></div></div>' +
      '<div><span class="cart-line__price">' + MM.money(i.priceCents * i.qty) + '</span>' +
      '<button type="button" class="cart-line__remove" data-remove>Remove</button></div></li>'
    );
  }

  function renderDrawer() {
    if (!drawer) return;
    var items = MM.cart.items();
    var list = MM.$('[data-cart-items]', drawer);
    var empty = MM.$('[data-cart-empty]', drawer);
    var foot = MM.$('[data-cart-foot]', drawer);
    list.innerHTML = items.map(lineHtml).join('');
    list.hidden = !items.length;
    empty.hidden = !!items.length;
    foot.hidden = !items.length;
    MM.$('[data-cart-subtotal]', drawer).textContent = MM.money(MM.cart.subtotal());
    var h = MM.cart.liveHandoff();
    var co = MM.$('[data-cart-checkout]', drawer);
    co.href = h.primary;
    var linksEl = MM.$('[data-cart-live-links]', drawer);
    linksEl.innerHTML =
      items.length > 1
        ? '<li><strong>Add each item on mandmvinyl.com:</strong></li>' +
          h.links
            .map(function (l) {
              return '<li><a href="' + MM.esc(l.url) + '" rel="noopener">' + MM.esc(l.name) + ' (' + l.qty + ')</a></li>';
            })
            .join('')
        : '';
  }

  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    renderDrawer();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    var close = MM.$('.cart-drawer__head button', drawer);
    if (close) close.focus();
  }

  function closeDrawer() {
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  MM.cartUI = { open: openDrawer, close: closeDrawer };

  MM.ready(function () {
    drawer = MM.$('[data-cart-drawer]');
    renderCount();
    renderDrawer();

    document.addEventListener('mm:cart', function () {
      renderCount();
      renderDrawer();
    });

    document.addEventListener('click', function (e) {
      var add = e.target.closest('[data-add-to-cart]');
      if (add) {
        e.preventDefault();
        var d = add.dataset;
        var qtyEl = d.qtyTarget ? MM.$(d.qtyTarget) : null;
        var variantEl = d.variantTarget ? MM.$(d.variantTarget) : null;
        MM.cart.add({
          id: d.id,
          name: d.name,
          priceCents: d.priceCents,
          image: d.image ? MM.url(d.image) : '',
          url: d.url ? MM.url(d.url) : '',
          variant: variantEl ? variantEl.value : d.variant,
          liveId: d.liveId,
          liveUrl: d.liveUrl,
          type: d.type,
          qty: qtyEl ? qtyEl.value : d.qty
        });
        MM.toast('Added to cart');
        if (d.openCart !== undefined) openDrawer();
        return;
      }
      if (e.target.closest('[data-cart-open]')) {
        openDrawer();
        return;
      }
      if (e.target.closest('[data-cart-close]')) {
        closeDrawer();
        return;
      }
      var line = e.target.closest('.cart-line');
      if (!line) return;
      var id = line.dataset.id;
      var variant = line.dataset.variant;
      var stepBtn = e.target.closest('[data-qty-step]');
      if (stepBtn) {
        var current = MM.cart.items().filter(function (i) {
          return i.id === id && i.variant === variant;
        })[0];
        if (current) MM.cart.setQty(id, variant, current.qty + parseInt(stepBtn.dataset.qtyStep, 10));
      } else if (e.target.closest('[data-remove]')) {
        MM.cart.remove(id, variant);
      }
    });

    document.addEventListener('change', function (e) {
      if (!e.target.matches('[data-qty-input]')) return;
      var line = e.target.closest('.cart-line');
      MM.cart.setQty(line.dataset.id, line.dataset.variant, e.target.value);
    });

    document.addEventListener('keydown', function (e) {
      if (!drawer || !drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeDrawer();
      else MM.trapFocus(drawer, e);
    });
  });
})();

;
/* 40-feedback.js */
(function () {
  'use strict';
  var MM = window.MM;
  var KEY = 'mm.feedback.v1';
  var MODE_KEY = 'mm.review.on';
  var state = MM.store.get(KEY, { pages: {}, general: '', name: '' });
  var sections = [];
  var panel = null;
  var fab = null;
  var on = false;

  function slug(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  }

  function pageEntry() {
    var key = MM.pageKey();
    if (!state.pages[key]) state.pages[key] = { title: document.title.split('|')[0].trim(), sections: {} };
    return state.pages[key];
  }

  function persist() {
    MM.store.set(KEY, state);
    updateCounts();
  }

  function discover() {
    var found = [];
    MM.$$('main [data-review]').forEach(function (el) {
      if (found.indexOf(el) === -1) found.push(el);
    });
    MM.$$('main > section, main > .section, main > div[class*="section"]').forEach(function (el) {
      if (found.indexOf(el) === -1) found.push(el);
    });
    found.sort(function (a, b) {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    sections = found.map(function (el, i) {
      var h = MM.$('h1, h2, h3', el);
      var label = el.getAttribute('data-review') || (h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '') || 'Section ' + (i + 1);
      return { el: el, label: label, id: i + 1 + '-' + (slug(label) || 'section') };
    });
  }

  function totals() {
    var t = { like: 0, dislike: 0, change: 0, notes: 0 };
    Object.keys(state.pages).forEach(function (p) {
      var secs = state.pages[p].sections;
      Object.keys(secs).forEach(function (id) {
        var s = secs[id];
        if (s.vote) t[s.vote]++;
        if (s.note) t.notes++;
      });
    });
    return t;
  }

  function updateCounts() {
    if (!panel) return;
    var t = totals();
    MM.$('[data-fb-like]', panel).textContent = t.like + ' liked';
    MM.$('[data-fb-dislike]', panel).textContent = t.dislike + ' disliked';
    MM.$('[data-fb-change]', panel).textContent = t.change + ' to change';
  }

  function buildTools(sec) {
    var saved = pageEntry().sections[sec.id] || {};
    var tools = document.createElement('div');
    tools.className = 'fb-tools';
    tools.setAttribute('data-fb-tools', '');
    tools.innerHTML =
      '<span class="fb-tools__label">' + MM.esc(sec.label) + '</span>' +
      ['like', 'dislike', 'change'].map(function (v) {
        var label = { like: 'Like', dislike: 'Dislike', change: 'Change' }[v];
        return '<button type="button" data-vote-btn="' + v + '" aria-pressed="' + (saved.vote === v) + '">' + label + '</button>';
      }).join('') +
      '<button type="button" data-note-btn aria-expanded="' + !!saved.note + '">Note</button>' +
      '<textarea name="fb_note" aria-label="Note for ' + MM.esc(sec.label) + '" placeholder="What should change? (optional)"' + (saved.note ? '' : ' hidden') + '>' + MM.esc(saved.note || '') + '</textarea>';
    sec.el.appendChild(tools);
    sec.el.setAttribute('data-review-active', '');
    if (saved.vote) sec.el.setAttribute('data-vote', saved.vote);

    tools.addEventListener('click', function (e) {
      var vb = e.target.closest('[data-vote-btn]');
      var nb = e.target.closest('[data-note-btn]');
      var entry = pageEntry();
      var cur = entry.sections[sec.id] || { label: sec.label, vote: '', note: '' };
      if (vb) {
        var v = vb.getAttribute('data-vote-btn');
        cur.vote = cur.vote === v ? '' : v;
        MM.$$('[data-vote-btn]', tools).forEach(function (b) {
          b.setAttribute('aria-pressed', String(b.getAttribute('data-vote-btn') === cur.vote));
        });
        if (cur.vote) sec.el.setAttribute('data-vote', cur.vote);
        else sec.el.removeAttribute('data-vote');
        if (cur.vote === 'change' || cur.vote === 'dislike') {
          var ta = MM.$('textarea', tools);
          ta.hidden = false;
          nb = MM.$('[data-note-btn]', tools);
          nb.setAttribute('aria-expanded', 'true');
          ta.focus();
        }
      } else if (nb) {
        var area = MM.$('textarea', tools);
        area.hidden = !area.hidden;
        nb.setAttribute('aria-expanded', String(!area.hidden));
        if (!area.hidden) area.focus();
        return;
      } else {
        return;
      }
      cur.label = sec.label;
      entry.sections[sec.id] = cur;
      persist();
    });

    tools.addEventListener('input', function (e) {
      if (e.target.tagName !== 'TEXTAREA') return;
      var entry = pageEntry();
      var cur = entry.sections[sec.id] || { label: sec.label, vote: '', note: '' };
      cur.note = e.target.value;
      cur.label = sec.label;
      entry.sections[sec.id] = cur;
      persist();
    });
  }

  function summary() {
    var lines = ['M&M Vinyl prototype feedback', 'Date: ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' (Central)'];
    if (state.name) lines.push('From: ' + state.name);
    lines.push('');
    var any = false;
    Object.keys(state.pages).forEach(function (p) {
      var page = state.pages[p];
      var rows = Object.keys(page.sections)
        .map(function (id) {
          return page.sections[id];
        })
        .filter(function (s) {
          return s.vote || s.note;
        });
      if (!rows.length) return;
      any = true;
      lines.push((page.title || p).toUpperCase() + ' (' + p + ')');
      rows.forEach(function (s) {
        var verdict = { like: 'LIKE', dislike: 'DISLIKE', change: 'CHANGE' }[s.vote] || 'NOTE';
        lines.push('- ' + s.label + ': ' + verdict + (s.note ? ': ' + s.note.replace(/\s+/g, ' ') : ''));
      });
      lines.push('');
    });
    if (state.general) {
      any = true;
      lines.push('GENERAL', state.general, '');
    }
    if (!any) lines.push('(No feedback entered yet.)');
    return lines.join('\n');
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      );
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {}
    ta.remove();
    return Promise.resolve(ok);
  }

  function send() {
    var text = summary();
    var to = MM.config.feedbackEmail || 'chad@siliconbayoudesigns.com';
    copy(text).then(function (ok) {
      MM.toast(ok ? 'Feedback copied. Opening your email.' : 'Opening your email.');
    });
    var body = text;
    var tail = '\n\n(Cut short for email. The full text was copied to your clipboard: paste it here.)';
    while (encodeURIComponent(body).length > 1700 && body.length > 200) body = body.slice(0, Math.floor(body.length * 0.85));
    if (body !== text) body += tail;
    location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('M&M Vinyl prototype feedback') + '&body=' + encodeURIComponent(body);
  }

  function buildPanel() {
    panel = document.createElement('div');
    panel.className = 'fb-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', 'Review mode');
    panel.innerHTML =
      '<h2>Review mode</h2>' +
      '<p>Tap Like, Dislike, or Change on any section. Add a note if you want. Nothing is sent until you press the button below.</p>' +
      '<div class="fb-panel__count"><span class="badge badge--outline" data-fb-like></span><span class="badge badge--outline" data-fb-dislike></span><span class="badge badge--outline" data-fb-change></span></div>' +
      '<label>Your name <input type="text" name="fb_name" data-fb-name autocomplete="name" value="' + MM.esc(state.name) + '"></label>' +
      '<label>Anything else? <textarea name="fb_general" data-fb-general placeholder="Big picture thoughts">' + MM.esc(state.general) + '</textarea></label>' +
      '<div class="fb-panel__actions">' +
      '<button type="button" class="btn btn--dark btn--sm" data-fb-send>Send my feedback</button>' +
      '<button type="button" class="btn btn--outline btn--sm" data-fb-copy>Copy to clipboard</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-fb-clear>Clear all feedback</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-fb-off>Turn off review mode</button></div>';
    document.body.appendChild(panel);
    panel.addEventListener('click', function (e) {
      if (e.target.closest('[data-fb-send]')) send();
      else if (e.target.closest('[data-fb-copy]'))
        copy(summary()).then(function (ok) {
          MM.toast(ok ? 'Copied to clipboard' : 'Copy failed. Select the text and copy it.');
        });
      else if (e.target.closest('[data-fb-clear]')) {
        if (window.confirm('Clear all saved feedback on this device?')) {
          state = { pages: {}, general: '', name: state.name };
          persist();
          setMode(false);
          setMode(true);
        }
      } else if (e.target.closest('[data-fb-off]')) setMode(false);
    });
    panel.addEventListener('input', function (e) {
      if (e.target.matches('[data-fb-name]')) state.name = e.target.value;
      if (e.target.matches('[data-fb-general]')) state.general = e.target.value;
      MM.store.set(KEY, state);
    });
    updateCounts();
  }

  function setMode(next) {
    on = next;
    MM.session.set(MODE_KEY, on ? '1' : '0');
    document.body.classList.toggle('review-mode', on);
    fab.setAttribute('aria-pressed', String(on));
    MM.$('[data-fb-label]', fab).textContent = on ? 'Review mode: on' : 'Review mode';
    MM.$$('[data-fb-tools]').forEach(function (t) {
      t.remove();
    });
    MM.$$('[data-review-active]').forEach(function (el) {
      el.removeAttribute('data-review-active');
      el.removeAttribute('data-vote');
    });
    if (panel) {
      panel.remove();
      panel = null;
    }
    if (on) {
      discover();
      sections.forEach(buildTools);
      buildPanel();
    }
  }

  MM.ready(function () {
    fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fb-fab';
    fab.setAttribute('aria-pressed', 'false');
    fab.innerHTML = '<span class="fb-fab__dot" aria-hidden="true"></span><span data-fb-label>Review mode</span>';
    document.body.appendChild(fab);
    fab.addEventListener('click', function () {
      if (!on) setMode(true);
      else if (panel) panel.hidden = !panel.hidden;
    });
    var wantOn = MM.session.get(MODE_KEY) === '1' || /[?&]review=1/.test(location.search);
    if (wantOn) setMode(true);
  });
})();

;
/* 50-banner.js */
(function () {
  'use strict';
  var MM = window.MM;
  MM.ready(function () {
    var banner = MM.$('[data-proto-banner]');
    if (!banner) return;
    var btn = MM.$('[data-proto-dismiss]', banner);
    if (btn) {
      btn.addEventListener('click', function () {
        MM.store.set('mm.banner.v1', 1);
        document.documentElement.classList.remove('has-proto-banner');
      });
    }
  });
})();

;
/* 60-reveal.js */
(function () {
  'use strict';
  var MM = window.MM;
  MM.ready(function () {
    var els = MM.$$('.reveal');
    if (!els.length) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) {
        el.classList.add('is-visible');
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-visible');
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    els.forEach(function (el) {
      io.observe(el);
    });
  });
})();

;
/* 65-motion.js */
(function () {
  'use strict';
  var MM = window.MM;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  function observe(els, cb, opts) {
    if (!els.length) return;
    if (reduce || !canObserve) {
      els.forEach(function (el) {
        cb(el, true);
      });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          cb(en.target, false);
          io.unobserve(en.target);
        }
      });
    }, opts || { threshold: 0.25 });
    els.forEach(function (el) {
      io.observe(el);
    });
  }

  function countUp(el, instant) {
    var to = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(to)) return;
    var from = parseFloat(el.getAttribute('data-count-from') || '0');
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = parseInt(el.getAttribute('data-duration') || '1400', 10);
    function show(v) {
      el.textContent = prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    }
    if (instant) {
      show(to);
      return;
    }
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      show(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
      else show(to);
    }
    show(from);
    requestAnimationFrame(tick);
  }

  function playSms(box, instant) {
    var items = MM.$$('.sms__msg, .sms__time', box);
    if (instant) {
      items.forEach(function (m) {
        m.classList.add('is-shown');
      });
      return;
    }
    var i = 0;
    function next() {
      if (i >= items.length) return;
      var item = items[i++];
      var incoming = item.classList.contains('sms__msg') && !item.classList.contains('sms__msg--out');
      var delay = parseInt(item.getAttribute('data-delay') || (incoming ? '900' : '500'), 10);
      var typing = null;
      if (incoming) {
        typing = document.createElement('div');
        typing.className = 'sms__typing';
        typing.setAttribute('aria-hidden', 'true');
        typing.innerHTML = '<i></i><i></i><i></i>';
        item.parentNode.insertBefore(typing, item);
      }
      setTimeout(function () {
        if (typing) typing.remove();
        item.classList.add('is-shown');
        setTimeout(next, 450);
      }, delay);
    }
    next();
  }

  function initGangSheet(fig) {
    var replay = MM.$('[data-gs-replay]', fig);
    function play() {
      fig.classList.remove('is-playing');
      void fig.offsetWidth;
      fig.classList.add('is-playing');
    }
    observe([fig], function (el, instant) {
      if (instant) el.classList.add('is-playing');
      else play();
    }, { threshold: 0.35 });
    if (replay) replay.addEventListener('click', play);
  }

  function initSticky() {
    var bar = MM.$('[data-sticky-cta]');
    if (!bar) return;
    document.body.classList.add('has-sticky-cta');
    var btn = MM.$('a', bar);
    function update() {
      var show = window.scrollY > 420;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (btn) btn.tabIndex = show ? 0 : -1;
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  MM.ready(function () {
    MM.$$('[data-reveal-stagger]').forEach(function (parent) {
      MM.$$(':scope > .reveal', parent).forEach(function (child, i) {
        child.style.setProperty('--i', i);
      });
    });
    observe(MM.$$('[data-count-to]'), countUp);
    observe(MM.$$('.chart, [data-chart]'), function (el) {
      el.classList.add('is-drawn');
    }, { threshold: 0.2 });
    observe(MM.$$('[data-sms-demo]'), playSms, { threshold: 0.4 });
    MM.$$('[data-gs-anim]').forEach(initGangSheet);
    initSticky();

    var last = MM.cart ? MM.cart.count() : 0;
    document.addEventListener('mm:cart', function (e) {
      var n = e.detail.count;
      if (n > last && !reduce) {
        MM.$$('.cart-btn__count').forEach(function (el) {
          el.classList.remove('is-bump');
          void el.offsetWidth;
          el.classList.add('is-bump');
        });
      }
      last = n;
    });
  });
})();

;
/* 70-charts.js */
(function () {
  'use strict';
  var MM = window.MM;
  var NS = 'http://www.w3.org/2000/svg';

  function num(v) {
    return Number(v) || 0;
  }

  function niceMax(max) {
    if (max <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log10(max)));
    var n = max / pow;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  }

  function fmt(v) {
    return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 10) / 10);
  }

  function srTable(title, labels, series) {
    var head = '<tr><th scope="col">' + MM.esc(title || 'Label') + '</th>' + series.map(function (s) {
      return '<th scope="col">' + MM.esc(s.name || 'Value') + '</th>';
    }).join('') + '</tr>';
    var rows = labels.map(function (l, i) {
      return '<tr><th scope="row">' + MM.esc(l) + '</th>' + series.map(function (s) {
        return '<td>' + MM.esc(fmt(num(s.values[i]))) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<table class="sr-only"><caption>' + MM.esc(title || 'Chart data') + '</caption><thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
  }

  function legend(series) {
    if (series.length < 2) return '';
    return '<ul class="legend">' + series.map(function (s, i) {
      return '<li><span class="legend__swatch s' + (i + 1) + '"></span>' + MM.esc(s.name) + '</li>';
    }).join('') + '</ul>';
  }

  function sparkline(values, opts) {
    opts = opts || {};
    var w = 96;
    var h = 32;
    var pad = 3;
    var v = values.map(num);
    var min = Math.min.apply(null, v);
    var max = Math.max.apply(null, v);
    var span = max - min || 1;
    var pts = v.map(function (n, i) {
      return [pad + (i * (w - pad * 2)) / Math.max(1, v.length - 1), h - pad - ((n - min) / span) * (h - pad * 2)];
    });
    var d = pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join('');
    var last = pts[pts.length - 1];
    return '<svg class="sparkline" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + MM.esc(opts.label || 'Trend') + '"><path d="' + d + '"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3"/></svg>';
  }

  function barChart(cfg) {
    var labels = cfg.labels;
    var series = cfg.series;
    var W = 560;
    var H = 240;
    var m = { t: 16, r: 8, b: 30, l: 40 };
    var all = [];
    series.forEach(function (s) {
      all = all.concat(s.values.map(num));
    });
    var stacked = cfg.stacked;
    var max = niceMax(
      stacked
        ? Math.max.apply(null, labels.map(function (_, i) {
            return series.reduce(function (n, s) {
              return n + num(s.values[i]);
            }, 0);
          }))
        : Math.max.apply(null, all)
    );
    var iw = W - m.l - m.r;
    var ih = H - m.t - m.b;
    var band = iw / labels.length;
    var groups = stacked ? 1 : series.length;
    var bw = Math.min(40, (band * 0.7) / groups);
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + MM.esc(cfg.label || cfg.title || 'Bar chart') + '">';
    for (var g = 0; g <= 4; g++) {
      var y = m.t + ih - (ih * g) / 4;
      out += '<line class="chart__grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/>';
      out += '<text class="chart__axis" x="' + (m.l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt((max * g) / 4) + '</text>';
    }
    labels.forEach(function (l, i) {
      var cx = m.l + band * i + band / 2;
      var base = 0;
      series.forEach(function (s, si) {
        var v = num(s.values[i]);
        var bh = (v / max) * ih;
        var x = stacked ? cx - bw / 2 : cx - (bw * groups) / 2 + bw * si;
        var yy = m.t + ih - bh - (stacked ? (base / max) * ih : 0);
        out += '<rect class="chart__bar s' + (si + 1) + '" x="' + x.toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, bh).toFixed(1) + '" rx="3"><title>' + MM.esc(l + ': ' + fmt(v)) + '</title></rect>';
        if (stacked) base += v;
      });
      out += '<text class="chart__axis" x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + MM.esc(l) + '</text>';
    });
    out += '</svg>';
    return out;
  }

  function lineChart(cfg) {
    var labels = cfg.labels;
    var series = cfg.series;
    var W = 560;
    var H = 240;
    var m = { t: 16, r: 12, b: 30, l: 40 };
    var all = [];
    series.forEach(function (s) {
      all = all.concat(s.values.map(num));
    });
    var max = niceMax(Math.max.apply(null, all));
    var iw = W - m.l - m.r;
    var ih = H - m.t - m.b;
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + MM.esc(cfg.label || cfg.title || 'Line chart') + '">';
    for (var g = 0; g <= 4; g++) {
      var y = m.t + ih - (ih * g) / 4;
      out += '<line class="chart__grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y + '" y2="' + y + '"/>';
      out += '<text class="chart__axis" x="' + (m.l - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt((max * g) / 4) + '</text>';
    }
    var step = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach(function (l, i) {
      if (i % step) return;
      var x = m.l + (iw * i) / Math.max(1, labels.length - 1);
      out += '<text class="chart__axis" x="' + x.toFixed(1) + '" y="' + (H - 10) + '" text-anchor="middle">' + MM.esc(l) + '</text>';
    });
    series.forEach(function (s, si) {
      var pts = s.values.map(function (v, i) {
        return [m.l + (iw * i) / Math.max(1, labels.length - 1), m.t + ih - (num(v) / max) * ih];
      });
      var d = pts.map(function (p, i) {
        return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }).join('');
      if (cfg.area && si === 0) {
        out += '<path class="chart__area s1" d="' + d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (m.t + ih) + 'L' + pts[0][0].toFixed(1) + ' ' + (m.t + ih) + 'Z"/>';
      }
      out += '<path class="chart__line s' + (si + 1) + '" pathLength="1" d="' + d + '"/>';
      pts.forEach(function (p, i) {
        out += '<circle class="chart__dot s' + (si + 1) + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4"><title>' + MM.esc(labels[i] + ': ' + fmt(num(s.values[i]))) + '</title></circle>';
      });
    });
    out += '</svg>';
    return out;
  }

  function donut(cfg) {
    var vals = cfg.series[0].values.map(num);
    var total = vals.reduce(function (a, b) {
      return a + b;
    }, 0) || 1;
    var R = 70;
    var C = 2 * Math.PI * R;
    var sw = 26;
    var out = '<svg viewBox="0 0 200 200" role="img" aria-label="' + MM.esc(cfg.label || cfg.title || 'Donut chart') + '" style="max-width:15rem;margin:auto">';
    out += '<circle class="chart__slice chart__slice--track" cx="100" cy="100" r="' + R + '" stroke-width="' + sw + '"/>';
    var offset = 0;
    vals.forEach(function (v, i) {
      var len = (v / total) * C;
      var gap = vals.length > 1 ? 3 : 0;
      out += '<circle class="chart__slice s' + ((i % 4) + 1) + '" cx="100" cy="100" r="' + R + '" stroke-width="' + sw + '" stroke-dasharray="' + Math.max(0, len - gap).toFixed(2) + ' ' + (C - Math.max(0, len - gap)).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) + '" transform="rotate(-90 100 100)"><title>' + MM.esc(cfg.labels[i] + ': ' + fmt(v)) + '</title></circle>';
      offset += len;
    });
    if (cfg.center) out += '<text class="chart__center" x="100" y="106" font-size="22">' + MM.esc(cfg.center) + '</text>';
    out += '</svg>';
    return out;
  }

  function legendForSlices(cfg) {
    return '<ul class="legend">' + cfg.labels.map(function (l, i) {
      return '<li><span class="legend__swatch s' + ((i % 4) + 1) + '"></span>' + MM.esc(l) + ' (' + MM.esc(fmt(num(cfg.series[0].values[i]))) + ')</li>';
    }).join('') + '</ul>';
  }

  function meter(cfg) {
    var v = num(cfg.value);
    var max = num(cfg.max) || 100;
    var pct = Math.max(0, Math.min(100, (v / max) * 100));
    var target = cfg.target ? Math.max(0, Math.min(100, (num(cfg.target) / max) * 100)) : null;
    return '<div class="meter' + (cfg.tone ? ' meter--' + cfg.tone : '') + '"><div class="meter__head"><span>' + MM.esc(cfg.title || '') + '</span><span class="meter__value">' + MM.esc(cfg.display || fmt(v) + ' of ' + fmt(max)) + '</span></div>' +
      '<div class="meter__track" role="meter" aria-valuemin="0" aria-valuemax="' + max + '" aria-valuenow="' + v + '" aria-label="' + MM.esc(cfg.title || 'Progress') + '"><span class="meter__fill" style="--pct:' + pct.toFixed(1) + '%"></span>' +
      (target !== null ? '<span class="meter__target" style="--target:' + target.toFixed(1) + '%" title="Target"></span>' : '') + '</div></div>';
  }

  function stackbar(cfg) {
    var vals = cfg.series[0].values.map(num);
    var total = vals.reduce(function (a, b) {
      return a + b;
    }, 0) || 1;
    return '<div class="stackbar" role="img" aria-label="' + MM.esc(cfg.label || cfg.title || 'Breakdown') + '">' + vals.map(function (v, i) {
      return '<span class="stackbar__seg s' + ((i % 4) + 1) + '" style="--w:' + ((v / total) * 100).toFixed(2) + '" title="' + MM.esc(cfg.labels[i] + ': ' + fmt(v)) + '"></span>';
    }).join('') + '</div>' + legendForSlices(cfg);
  }

  function parseList(s) {
    return String(s || '').split(',').map(function (x) {
      return x.trim();
    }).filter(function (x) {
      return x !== '';
    });
  }

  function hydrate(el) {
    var type = el.getAttribute('data-chart');
    var cfg = {
      title: el.getAttribute('data-title') || '',
      label: el.getAttribute('data-label') || el.getAttribute('data-title') || '',
      labels: parseList(el.getAttribute('data-labels')),
      center: el.getAttribute('data-center') || '',
      stacked: el.hasAttribute('data-stacked'),
      area: el.hasAttribute('data-area')
    };
    var names = parseList(el.getAttribute('data-series-names'));
    var rows = (el.getAttribute('data-values') || '').split('|');
    cfg.series = rows.map(function (r, i) {
      return { name: names[i] || 'Series ' + (i + 1), values: parseList(r).map(num) };
    });
    var html = '';
    if (type === 'sparkline') html = sparkline(cfg.series[0].values, { label: cfg.label });
    else if (type === 'bar') html = barChart(cfg) + legend(cfg.series) + srTable(cfg.title, cfg.labels, cfg.series);
    else if (type === 'line') html = lineChart(cfg) + legend(cfg.series) + srTable(cfg.title, cfg.labels, cfg.series);
    else if (type === 'donut') html = donut(cfg) + legendForSlices(cfg) + srTable(cfg.title, cfg.labels, cfg.series);
    else if (type === 'stackbar') html = stackbar(cfg) + srTable(cfg.title, cfg.labels, cfg.series);
    else if (type === 'meter')
      html = meter({
        title: cfg.title,
        value: el.getAttribute('data-value'),
        max: el.getAttribute('data-max'),
        target: el.getAttribute('data-target'),
        display: el.getAttribute('data-display'),
        tone: el.getAttribute('data-tone')
      });
    el.innerHTML = html;
    el.classList.add('chart');
  }

  MM.charts = {
    sparkline: sparkline,
    bar: barChart,
    line: lineChart,
    donut: donut,
    meter: meter,
    stackbar: stackbar,
    hydrate: hydrate
  };

  MM.ready(function () {
    MM.$$('[data-chart]').forEach(hydrate);
  });
})();

;
/* fold.js */
(function () {
  'use strict';

  function fold(sec) {
    var box = sec.querySelector(':scope > .container') || sec.querySelector('.container');
    if (!box || sec.classList.contains('is-folded')) return;
    var details = document.createElement('details');
    details.className = 'fold';
    var summary = document.createElement('summary');
    summary.className = 'fold__summary';
    summary.innerHTML = '<span class="fold__label"></span><span class="fold__plus" aria-hidden="true"></span>';
    summary.querySelector('.fold__label').textContent = sec.getAttribute('data-fold');
    details.appendChild(summary);
    var body = document.createElement('div');
    body.className = 'fold__body';
    while (box.firstChild) body.appendChild(box.firstChild);
    details.appendChild(body);
    box.appendChild(details);
    sec.classList.add('is-folded');
  }

  function openFor(target) {
    if (!target || !target.closest) return;
    var d = target.closest('details.fold');
    if (!d && target.classList && target.classList.contains('is-folded')) d = target.querySelector('details.fold');
    if (d && !d.open) d.open = true;
  }

  function init() {
    var secs = document.querySelectorAll('[data-fold]');
    for (var i = 0; i < secs.length; i++) fold(secs[i]);
    if (location.hash.length > 1) {
      try {
        openFor(document.getElementById(decodeURIComponent(location.hash.slice(1))));
      } catch (e) {}
    }
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href*="#"]') : null;
      if (!a) return;
      var h = a.getAttribute('href');
      var i = h.indexOf('#');
      if (i < 0 || h.length < i + 2) return;
      var id = h.slice(i + 1);
      var t = document.getElementById(id);
      if (t) openFor(t);
    });
    window.addEventListener('hashchange', function () {
      try {
        openFor(document.getElementById(decodeURIComponent(location.hash.slice(1))));
      } catch (e) {}
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

;
/* review-guide.js */
(function () {
  'use strict';
  var KEY = 'mm.reviewguide.v1';
  var dialog = null;
  var lastFocus = null;

  function read() {
    try {
      return window.localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  }

  function write() {
    try {
      window.localStorage.setItem(KEY, 'done');
    } catch (e) {}
  }

  function root(path) {
    return (window.MM && MM.url ? MM.url(path) : path);
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'rg';
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="rg__scrim" data-rg-close></div>' +
      '<div class="rg__card" role="dialog" aria-modal="true" aria-labelledby="rg-title" tabindex="-1">' +
      '<button type="button" class="rg__x" data-rg-close aria-label="Close this guide">&times;</button>' +
      '<p class="rg__eyebrow">First draft for Desiree</p>' +
      '<h2 id="rg-title" class="rg__title">How to review this draft</h2>' +
      '<p class="rg__lead">This is your new site, not the live one. Look around, tap what you like or do not like, and send it to Chad. It takes a few minutes.</p>' +
      '<ol class="rg__steps">' +
      '<li><span class="rg__num" aria-hidden="true">1</span><div><h3>Turn on Review mode</h3><p>Tap the <strong>Review mode</strong> button at the bottom right of any page. Small notes from us appear on the pages, and each section gets its own buttons.</p></div></li>' +
      '<li><span class="rg__num" aria-hidden="true">2</span><div><h3>Like, Dislike or Change</h3><p>Under each section tap <strong>Like</strong> if it is right, <strong>Dislike</strong> if it is not, or <strong>Change</strong> if it needs fixing. Tap <strong>Note</strong> to say what you want in your own words.</p></div></li>' +
      '<li><span class="rg__num" aria-hidden="true">3</span><div><h3>Send it to Chad</h3><p>Open the Review mode panel and tap <strong>Send my feedback</strong>. It opens an email to Chad with everything you marked. If that does not open, tap <strong>Copy to clipboard</strong> and paste it into a text or email.</p></div></li>' +
      '</ol>' +
      '<p class="rg__small">Your marks stay on this device until you send them. The questions we need you to answer are listed on <a href="' + root('/draft-guide/') + '">the draft guide</a>.</p>' +
      '<div class="rg__actions">' +
      '<button type="button" class="btn btn--sm" data-rg-start>Start reviewing</button>' +
      '<button type="button" class="btn btn--outline btn--sm" data-rg-close>Maybe later</button>' +
      '</div></div>';
    document.body.appendChild(wrap);
    return wrap;
  }

  function open() {
    if (!dialog) dialog = build();
    lastFocus = document.activeElement;
    dialog.hidden = false;
    document.documentElement.classList.add('rg-open');
    var card = dialog.querySelector('.rg__card');
    card.focus();
  }

  function close() {
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.documentElement.classList.remove('rg-open');
    write();
    if (lastFocus && lastFocus.focus) {
      try {
        lastFocus.focus();
      } catch (e) {}
    }
  }

  function trap(e) {
    if (!dialog || dialog.hidden) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    var items = dialog.querySelectorAll('button, a[href]');
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var card = dialog.querySelector('.rg__card');
    if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function addPanelLink(panel) {
    if (panel.querySelector('[data-review-guide]')) return;
    var p = document.createElement('p');
    p.className = 'rg__panel-link';
    p.innerHTML = '<button type="button" class="rg__link" data-review-guide>How to review</button>';
    var h = panel.querySelector('h2');
    if (h && h.nextSibling) panel.insertBefore(p, h.nextSibling);
    else panel.appendChild(p);
  }

  function init() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-review-guide]')) {
        e.preventDefault();
        open();
      } else if (t.closest('[data-rg-start]')) {
        close();
        var fab = document.querySelector('.fb-fab');
        if (fab && fab.getAttribute('aria-pressed') !== 'true') fab.click();
      } else if (t.closest('[data-rg-close]')) {
        close();
      }
    });
    document.addEventListener('keydown', trap);

    var existing = document.querySelector('.fb-panel');
    if (existing) addPanelLink(existing);
    if (window.MutationObserver) {
      new MutationObserver(function (list) {
        list.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1 && n.classList.contains('fb-panel')) addPanelLink(n);
          });
        });
      }).observe(document.body, { childList: true });
    }

    document.addEventListener('click', function (e) {
      var label = e.target && e.target.closest ? e.target.closest('.review-note__label') : null;
      if (!label) return;
      var note = label.closest('.review-note');
      if (note) note.classList.toggle('is-open');
    });

    var forced = /[?&]guide=1/.test(location.search);
    var skip = /[?&]guide=0/.test(location.search);
    if (forced) open();
    else if (!skip && !read() && !/\/(owner-dashboard|draft-guide)\//.test(location.pathname)) {
      window.setTimeout(open, 700);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
