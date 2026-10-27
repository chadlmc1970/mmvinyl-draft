(function () {
  'use strict';
  var MM = window.MM;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function daysToFatTuesday() {
    var els = MM.$$('[data-fat-days]');
    if (!els.length) return;
    var parts = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }).split('-');
    var today = Date.UTC(+parts[0], +parts[1] - 1, +parts[2]);
    var days = Math.round((Date.UTC(2027, 1, 9) - today) / 86400000);
    var text = days > 1 ? days + ' days to go.' : days === 1 ? 'Tomorrow.' : days === 0 ? 'Today.' : '';
    els.forEach(function (el) {
      if (text) el.textContent = text;
    });
  }

  function initRails() {
    MM.$$('[data-rail]').forEach(function (rail) {
      var track = MM.$('.rail__track', rail);
      if (!track) return;
      ['prev', 'next'].forEach(function (dir) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'rail__btn rail__btn--' + dir;
        b.setAttribute('aria-label', dir === 'next' ? 'Scroll right' : 'Scroll left');
        b.innerHTML = '<svg aria-hidden="true"><use href="#i-arrow"/></svg>';
        b.addEventListener('click', function () {
          track.scrollBy({ left: (dir === 'next' ? 1 : -1) * track.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
        });
        rail.appendChild(b);
      });
      function edges() {
        rail.classList.toggle('at-start', track.scrollLeft < 8);
        rail.classList.toggle('at-end', track.scrollLeft + track.clientWidth >= track.scrollWidth - 8);
      }
      track.addEventListener('scroll', edges, { passive: true });
      window.addEventListener('resize', edges);
      edges();
    });
  }

  function initShop(root) {
    var grid = MM.$('[data-shop-grid]', root);
    var cards = MM.$$('.shop-item', grid);
    var total = Number(root.dataset.total) || cards.length;
    var q = MM.$('[data-shop-q]', root);
    var countEl = MM.$('[data-shop-count]', root);
    var emptyEl = MM.$('[data-shop-empty]', root);
    var clearBtns = MM.$$('[data-shop-clear]', root);
    var stockEl = MM.$('[data-filter-stock]', root);
    var sortEl = MM.$('[data-sort]', root);
    var chips = MM.$$('.shop-cats .chip, .shop-subs .chip', root);
    var subs = MM.$$('.shop-subs', root);
    var selects = {};
    MM.$$('select[data-filter]', root).forEach(function (s) {
      selects[s.dataset.filter] = s;
    });
    var scope = root.dataset.scope || '';
    var state = { q: '', cat: scope, brand: '', aud: '', size: '', color: '', stock: false, sort: 'featured' };
    var defaults = JSON.stringify(state);

    function inCat(card, slug) {
      return (' ' + card.dataset.cat + ' ').indexOf(' ' + slug + ' ') > -1;
    }

    function topOf(slug) {
      for (var i = 0; i < subs.length; i++) {
        if (MM.$('[data-cat="' + slug + '"]', subs[i])) return subs[i].dataset.subs;
      }
      return slug;
    }

    function readUrl() {
      var p = new URLSearchParams(location.search);
      ['q', 'cat', 'brand', 'aud', 'size', 'color', 'sort'].forEach(function (k) {
        if (p.get(k)) state[k] = p.get(k);
      });
      if (p.get('stock') === '1') state.stock = true;
      if (scope && state.cat !== scope && !chipFor(state.cat)) state.cat = scope;
    }

    function chipFor(slug) {
      return chips.filter(function (c) {
        return c.dataset.cat === slug;
      })[0];
    }

    function writeUrl() {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.cat && state.cat !== scope) p.set('cat', state.cat);
      ['brand', 'aud', 'size', 'color'].forEach(function (k) {
        if (state[k]) p.set(k, state[k]);
      });
      if (state.stock) p.set('stock', '1');
      if (state.sort !== 'featured') p.set('sort', state.sort);
      var qs = p.toString();
      try {
        history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
      } catch (e) {}
    }

    function matches(card) {
      var d = card.dataset;
      if (state.cat && !inCat(card, state.cat)) return false;
      if (state.brand && d.brand !== state.brand) return false;
      if (state.aud && (' ' + d.aud + ' ').indexOf(' ' + state.aud + ' ') < 0) return false;
      if (state.size && ('|' + d.sizes + '|').indexOf('|' + state.size + '|') < 0) return false;
      if (state.color && ('|' + d.colors + '|').indexOf('|' + state.color + '|') < 0) return false;
      if (state.stock && d.stock !== '1') return false;
      if (state.q) {
        var hay = d.text + ' ' + (d.colors || '').toLowerCase().replace(/\|/g, ' ');
        var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      }
      return true;
    }

    function sorter() {
      var s = state.sort;
      var num = function (c) {
        return c.dataset.price === '' ? Infinity : parseFloat(c.dataset.price);
      };
      if (s === 'price-asc') return function (a, b) { return num(a) - num(b) || a.dataset.idx - b.dataset.idx; };
      if (s === 'price-desc') return function (a, b) { return (num(b) === Infinity ? -1 : num(b)) - (num(a) === Infinity ? -1 : num(a)) || a.dataset.idx - b.dataset.idx; };
      if (s === 'name') return function (a, b) { return a.dataset.name.localeCompare(b.dataset.name); };
      return function (a, b) { return a.dataset.idx - b.dataset.idx; };
    }

    function apply(opts) {
      opts = opts || {};
      var shown = 0;
      cards.forEach(function (c) {
        var ok = matches(c);
        c.hidden = !ok;
        if (ok) shown++;
      });
      cards
        .slice()
        .sort(sorter())
        .forEach(function (c) {
          grid.appendChild(c);
        });
      var active = JSON.stringify(state) !== defaults;
      countEl.textContent = shown + (shown === 1 ? ' product' : ' products') + (shown !== total ? ' of ' + total : '');
      emptyEl.hidden = shown !== 0;
      grid.hidden = shown === 0;
      clearBtns.forEach(function (b) {
        if (!b.closest('[data-shop-empty]')) b.hidden = !active;
      });
      var top = state.cat ? topOf(state.cat) : '';
      chips.forEach(function (c) {
        var on = c.dataset.cat === state.cat || (c.closest('.shop-cats') && c.dataset.cat === top && !!state.cat) || (!state.cat && c.dataset.cat === '' && c.closest('.shop-cats'));
        c.classList.toggle('is-active', !!on);
        if (on) c.setAttribute('aria-current', 'true');
        else c.removeAttribute('aria-current');
      });
      subs.forEach(function (s) {
        s.hidden = !(top && s.dataset.subs === top);
      });
      if (opts.animate && !reduce) {
        grid.classList.remove('is-fresh');
        void grid.offsetWidth;
        grid.classList.add('is-fresh');
      }
      writeUrl();
    }

    function syncControls() {
      q.value = state.q;
      Object.keys(selects).forEach(function (k) {
        selects[k].value = state[k];
      });
      if (stockEl) stockEl.checked = state.stock;
      sortEl.value = state.sort;
    }

    var timer;
    q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        state.q = q.value.trim();
        apply({ animate: true });
      }, 120);
    });
    MM.$('[data-shop-search-form]', root).addEventListener('submit', function (e) {
      e.preventDefault();
      state.q = q.value.trim();
      apply({ animate: true });
    });
    Object.keys(selects).forEach(function (k) {
      selects[k].addEventListener('change', function () {
        state[k] = selects[k].value;
        apply({ animate: true });
      });
    });
    if (stockEl)
      stockEl.addEventListener('change', function () {
        state.stock = stockEl.checked;
        apply({ animate: true });
      });
    sortEl.addEventListener('change', function () {
      state.sort = sortEl.value;
      apply({ animate: true });
    });
    clearBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        state = JSON.parse(defaults);
        syncControls();
        apply({ animate: true });
      });
    });

    root.addEventListener('click', function (e) {
      var chip = e.target.closest('.shop-cats .chip, .shop-subs .chip');
      if (!chip) return;
      var slug = chip.dataset.cat;
      var have = slug === '' ? cards.length : cards.filter(function (c) {
        return inCat(c, slug);
      }).length;
      if (have !== Number(chip.dataset.count)) return;
      e.preventDefault();
      state.cat = slug === '' ? scope : slug;
      apply({ animate: true });
    });

    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-audience-link]');
      if (a) {
        e.preventDefault();
        state.aud = a.dataset.audienceLink;
        syncControls();
        apply({ animate: true });
        root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        return;
      }
      if (e.target.closest('[data-jump-search]')) {
        e.preventDefault();
        root.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        setTimeout(function () {
          q.focus({ preventScroll: true });
        }, reduce ? 0 : 350);
      }
    });

    var filters = MM.$('[data-shop-filters]', root);
    readUrl();
    syncControls();
    apply();
    if (filters && window.matchMedia('(max-width: 47.99rem)').matches && JSON.stringify(state) === defaults) filters.open = false;
  }

  function initSpotlight() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    MM.$$('.cat-tile__media').forEach(function (t) {
      t.addEventListener('pointermove', function (e) {
        var r = t.getBoundingClientRect();
        t.style.setProperty('--mx', e.clientX - r.left + 'px');
        t.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }

  MM.ready(function () {
    daysToFatTuesday();
    initSpotlight();
    initRails();
    var root = MM.$('[data-shop]');
    if (root) initShop(root);
  });
})();
