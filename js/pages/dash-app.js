(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;

  var NAV = [
    { key: 'today', label: 'Today', icon: 'today' },
    { key: 'orders', label: 'Orders', icon: 'orders' },
    { key: 'customers', label: 'Customers', icon: 'users' },
    { key: 'money', label: 'Money', icon: 'money' },
    { key: 'settings', label: 'Settings', icon: 'gear' }
  ];
  var ALIAS = { resellers: 'customers', messages: 'customers', reviews: 'customers', sales: 'money', payments: 'money', shipping: 'orders', sheets: 'orders', inventory: 'orders', integrations: 'settings' };

  var current = null;
  var tickers = [];
  var viewRoot = null;

  function navHtml() {
    return '<ul class="od-nav__list">' + NAV.map(function (it) {
      return '<li><a class="od-nav__link" href="#/' + it.key + '" data-nav="' + it.key + '" title="' + esc(it.label) + '">' + OD.icon(it.icon) + '<span>' + esc(it.label) + '</span><em data-nav-badge="' + it.key + '"></em></a></li>';
    }).join('') + '</ul>';
  }

  function routeKey() {
    var h = location.hash.replace(/^#\/?/, '').split('?')[0];
    if (ALIAS[h]) {
      if (h === 'integrations') OD.ui.openSetting = 'set-conn';
      return ALIAS[h];
    }
    return OD.views[h] ? h : 'today';
  }
  OD.currentRoute = function () { return current; };

  function setBadges() {
    var el = document.querySelector('[data-nav-badge="today"]');
    if (el) {
      var n = Math.min(5, OD.needsCandidates().length);
      el.textContent = n || '';
    }
  }

  function render(key, first) {
    var host = document.getElementById('od-view');
    var swap = function () {
      if (viewRoot && viewRoot.__cleanup) viewRoot.__cleanup();
      tickers = [];
      var v = OD.views[key]();
      host.innerHTML = '<div class="od-page od-page--' + key + '">' + v.html + '</div>';
      viewRoot = host.firstChild;
      document.querySelector('[data-title]').textContent = v.title;
      document.title = v.title + ' | Owner Dashboard (Preview) | M&M Vinyl';
      OD.hydrate(viewRoot);
      if (v.mount) v.mount(viewRoot);
      if (v.tick) {
        v.tick(viewRoot);
        tickers.push(function () { v.tick(viewRoot); });
      }
      document.querySelectorAll('[data-nav]').forEach(function (a) {
        if (a.getAttribute('data-nav') === key) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      setBadges();
      window.scrollTo(0, 0);
      var gr = document.querySelector('[data-greeting]');
      if (gr && key !== 'today') gr.textContent = '';
    };
    if (!first && !OD.reduce && document.startViewTransition) {
      document.documentElement.classList.add('od-vt');
      var t = document.startViewTransition(swap);
      t.finished.finally(function () { document.documentElement.classList.remove('od-vt'); });
    } else {
      swap();
      if (!first && !OD.reduce) {
        host.classList.remove('od-swap');
        void host.offsetWidth;
        host.classList.add('od-swap');
      }
    }
    current = key;
  }

  function topOffset() {
    var app = document.querySelector('.od');
    return app ? app.getBoundingClientRect().top + window.scrollY - 8 : 0;
  }

  OD.drawer = {
    open: function (html, opts) {
      var d = document.getElementById('od-drawer');
      d.classList.toggle('is-wide', !!(opts && opts.wide));
      d.querySelector('[data-drawer-body]').innerHTML = html;
      d.hidden = false;
      d.__ret = document.activeElement;
      requestAnimationFrame(function () {
        d.classList.add('is-open');
        var close = d.querySelector('[data-drawer-close]');
        if (close) close.focus();
      });
      document.body.classList.add('od-drawer-open');
    },
    close: function () {
      var d = document.getElementById('od-drawer');
      if (d.hidden) return;
      d.classList.remove('is-open');
      document.body.classList.remove('od-drawer-open');
      setTimeout(function () {
        d.hidden = true;
        if (d.__ret && d.__ret.focus) d.__ret.focus();
      }, OD.reduce ? 0 : 240);
    },
    refresh: function (html) {
      var d = document.getElementById('od-drawer');
      if (!d.hidden) d.querySelector('[data-drawer-body]').innerHTML = html;
    }
  };

  OD.shortcuts = function () {
    var rows = [['j and k', 'Move down and up through What needs you now'], ['Enter', 'Do the action on the highlighted item'], ['e', 'Open the order or page behind the highlighted item'], ['?', 'Show this list'], ['Esc', 'Close a panel']];
    OD.drawer.open('<div class="od-drawer__top"><h2>Keyboard shortcuts</h2></div><dl class="od-keys">' + rows.map(function (r) { return '<div><dt><kbd>' + esc(r[0]) + '</kbd></dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') + '</dl><p class="od-note">Shortcuts work on Today. They pause while you are typing.</p>');
  };

  var openOrderId = null;
  OD.openOrder = function (id) {
    openOrderId = id;
    OD.drawer.open(OD.orderDrawerHtml(id));
  };
  document.addEventListener('od:changed', function () {
    var d = document.getElementById('od-drawer');
    if (openOrderId && d && !d.hidden && d.querySelector('.od-steps')) OD.drawer.refresh(OD.orderDrawerHtml(openOrderId));
    setBadges();
  });

  function bindGlobal() {
    document.addEventListener('click', function (e) {
      var t = e.target;
      var send = t.closest('[data-send-text]');
      if (send) { e.preventDefault(); OD.sendText(send.getAttribute('data-send-text'), send); return; }
      var mr = t.closest('[data-mark-ready]');
      if (mr) { e.preventDefault(); OD.markReady(mr.getAttribute('data-mark-ready')); return; }
      var oo = t.closest('[data-open-order]');
      if (oo) { e.preventDefault(); OD.openOrder(oo.getAttribute('data-open-order')); return; }
      if (t.closest('[data-shortcuts]')) { OD.shortcuts(); return; }
      if (t.closest('[data-drawer-close]') || t.closest('[data-drawer-scrim]')) { OD.drawer.close(); return; }
    });
    document.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
      var drawerOpen = !document.getElementById('od-drawer').hidden;
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '?') { e.preventDefault(); OD.shortcuts(); return; }
        if (!drawerOpen && current === 'today' && OD.keys) {
          if (e.key === 'j') { e.preventDefault(); OD.keys.move(1); return; }
          if (e.key === 'k') { e.preventDefault(); OD.keys.move(-1); return; }
        }
        if (!drawerOpen && e.key === 'e') {
          if (OD.keys && OD.keys.expand && OD.keys.expand()) { e.preventDefault(); return; }
          var row = document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-row]');
          if (row) { e.preventDefault(); OD.openOrder(row.getAttribute('data-row')); return; }
        }
      }
      if (e.key === 'Escape') OD.drawer.close();
      var d = document.getElementById('od-drawer');
      if (!d.hidden) MM.trapFocus(d.querySelector('.od-drawer__panel'), e);
    });
    window.addEventListener('hashchange', function () {
      OD.drawer.close();
      var k = routeKey();
      if (k !== current) render(k, false);
    });
    var cs = document.querySelector('.site-header');
    var setTop = function () {
      var h = cs ? cs.getBoundingClientRect().height : 124;
      document.documentElement.style.setProperty('--od-top', Math.round(h) + 'px');
    };
    setTop();
    window.addEventListener('resize', setTop);
    var raf = 0;
    window.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; setTop(); });
    }, { passive: true });
  }

  function boot() {
    var app = document.querySelector('[data-od]');
    if (!app) return;
    app.querySelector('[data-od-nav]').innerHTML = navHtml();
    bindGlobal();
    OD.load().then(function () {
      app.classList.add('is-ready');
      var key = routeKey();
      if (!location.hash) history.replaceState(null, '', '#/today');
      render(key, true);
      setInterval(function () { tickers.forEach(function (f) { f(); }); }, 1000);
      var clockBtn = document.querySelector('[data-clock-toggle]');
      function syncClock() {
        clockBtn.textContent = OD.clockMode === 'sample' ? 'Use the real clock' : 'Show as Monday 11:42 AM';
      }
      syncClock();
      clockBtn.addEventListener('click', function () {
        OD.setClockMode(OD.clockMode === 'sample' ? 'live' : 'sample');
        syncClock();
        tickers.forEach(function (f) { f(); });
        var shop = document.querySelector('[data-shop-state]');
        if (shop && shop.__upd) shop.__upd();
      });
      var shop = document.querySelector('[data-shop-state]');
      if (shop) {
        var upd = function () {
          var st = MM.cutoff ? MM.cutoff.getStatus(OD.now(), MM.config.schedule) : null;
          if (!st) return;
          shop.setAttribute('data-state', st.state === 'open' ? 'open' : 'closed');
          shop.querySelector('span').textContent = st.state === 'open' ? 'Same-day closes in ' + MM.cutoff.formatRemaining(st.msRemaining) : 'Same-day is closed';
        };
        upd();
        shop.__upd = upd;
        setInterval(upd, 5000);
      }
    }).catch(function (err) {
      document.getElementById('od-view').innerHTML = '<div class="od-card"><div class="od-card__body"><h2>The sample data did not load.</h2><p>' + esc(err.message) + '. Run the site from a web server (npm run dev) so the dashboard can read data/dashboard/*.json.</p></div></div>';
    });
  }

  MM.ready(boot);
})();
