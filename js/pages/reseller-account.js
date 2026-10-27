(function () {
  'use strict';
  var MM = window.MM;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FAV_KEY = 'mm.acctpreview.favs.v1';
  var NAME_KEY = 'mm.acctpreview.names.v1';

  var CAT = {
    g: { name: 'Gang sheet (DTF)', gang: true },
    p62058: { name: 'Siser EasyWeed HTV', cents: 350, from: true },
    p50579: { name: 'Gildan Softstyle Unisex 64000', cents: 475, from: true },
    p9074: { name: 'Bella+Canvas 3001 Unisex Jersey Tee', cents: 675, from: true },
    p66239: { name: 'Sequin Game Day Patch', cents: 800, from: false },
    p62288: { name: 'Transfer Tape (10 YRDS)', cents: 3150, from: false }
  };

  var state = { tray: [], pickup: 2 };

  function parseLines(str) {
    return str.split(',').map(function (p) {
      var a = p.split(':');
      return { key: a[0], qty: parseInt(a[1], 10) };
    });
  }

  function productsTotal(lines) {
    var total = 0;
    var anyFrom = false;
    lines.forEach(function (l) {
      var c = CAT[l.key];
      if (c && !c.gang) {
        total += c.cents * l.qty;
        if (c.from) anyFrom = true;
      }
    });
    return { cents: total, from: anyFrom };
  }

  function bump(el) {
    if (!el || reduce) return;
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }

  /* Tray */
  var trayList = MM.$('[data-tray-list]');
  var trayEmpty = MM.$('[data-tray-empty]');
  var trayFoot = MM.$('[data-tray-foot]');
  var trayCount = MM.$('[data-tray-count]');
  var sideTray = MM.$('[data-side-tray]');

  function renderTray() {
    var n = state.tray.reduce(function (s, t) {
      return s + t.qty;
    }, 0);
    trayList.innerHTML = state.tray
      .map(function (t) {
        return '<li><span>' + MM.esc(t.name) + '</span><strong>x ' + t.qty + '</strong></li>';
      })
      .join('');
    trayEmpty.hidden = state.tray.length > 0;
    trayFoot.hidden = state.tray.length === 0;
    trayCount.textContent = n;
    sideTray.textContent = n;
    bump(trayCount);
  }

  function addToTray(name, qty) {
    var hit = state.tray.filter(function (t) {
      return t.name === name;
    })[0];
    if (hit) hit.qty += qty;
    else state.tray.push({ name: name, qty: qty });
    renderTray();
  }

  MM.$('[data-tray-clear]').addEventListener('click', function () {
    state.tray = [];
    renderTray();
    resetLines();
  });

  /* Reorder last order */
  var linesEl = MM.$('[data-lines]');
  var lineEls = MM.$$('.rs-line', linesEl);
  var bigBtn = MM.$('[data-reorder-last]');
  var bigLabel = MM.$('[data-reorder-label]');

  function resetLines() {
    lineEls.forEach(function (li) {
      li.classList.remove('is-sent');
    });
    bigBtn.removeAttribute('aria-busy');
    bigLabel.textContent = 'Reorder last order';
  }

  MM.$$('.qty', linesEl).forEach(function (q, qi) {
    var input = MM.$('input', q);
    input.name = 'qty' + qi;
    MM.$$('[data-step]', q).forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(b.getAttribute('data-step'), 10));
      });
    });
  });

  function nameOf(li) {
    return CAT[li.getAttribute('data-key')].name;
  }

  bigBtn.addEventListener('click', function () {
    if (bigBtn.getAttribute('aria-busy') === 'true') return;
    var todo = lineEls.filter(function (li) {
      return !li.classList.contains('is-sent') && (parseInt(MM.$('input', li).value, 10) || 0) > 0;
    });
    if (!todo.length) {
      MM.toast('Those lines are already in your tray');
      return;
    }
    bigBtn.setAttribute('aria-busy', 'true');
    bigLabel.textContent = 'Adding';
    var step = reduce ? 0 : 420;
    todo.forEach(function (li, i) {
      setTimeout(function () {
        li.classList.add('is-sent');
        addToTray(nameOf(li), parseInt(MM.$('input', li).value, 10) || 0);
        if (i === todo.length - 1) {
          setTimeout(function () {
            bigBtn.removeAttribute('aria-busy');
            bigLabel.textContent = 'Added. Reorder again';
            MM.toast(todo.length + (todo.length === 1 ? ' line' : ' lines') + ' added to the sample tray');
          }, reduce ? 0 : 300);
        }
      }, step * (i + 1));
    });
  });

  /* Quick order */
  var qoItem = MM.$('[data-qo-item]');
  var qoQty = MM.$('[data-qo-qty]');
  var qoList = MM.$('[data-qo-list]');
  var qoPrice = MM.$('[data-qo-price]');
  var products = {};
  fetch(MM.url('data/products.json'))
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      (d.products || []).forEach(function (p) {
        if (p.is_gang_sheet_builder || p.primary_category === 'dtf' || p.primary_category === 'gift-cards') return;
        products[p.display_name.toLowerCase()] = p;
        var o = document.createElement('option');
        o.value = p.display_name;
        qoList.appendChild(o);
      });
    })
    .catch(function () {
      qoPrice.textContent = 'The product list did not load. Reload the page to try again.';
    });
  function qoFind() {
    return products[qoItem.value.trim().toLowerCase()];
  }
  qoItem.addEventListener('input', function () {
    var p = qoFind();
    qoPrice.textContent = p
      ? p.display_name + ': Standard price ' + (p.price_display || 'see the product page') + '. Your price shows here after approval.'
      : 'Pick a product to see its Standard price. Your price shows here after approval.';
  });
  var qoAdd = MM.$('[data-qo-add]');
  var qoTimer = 0;

  function qoError(input, msg) {
    var field = input.closest('.field');
    var hint = field.querySelector('.field__error');
    if (!msg) {
      field.classList.remove('has-error');
      input.removeAttribute('aria-invalid');
      if (hint) hint.remove();
      return;
    }
    field.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'field__error';
      hint.id = input.id + '-err';
      field.appendChild(hint);
      input.setAttribute('aria-describedby', hint.id);
    }
    hint.textContent = msg;
  }

  qoItem.addEventListener('input', function () {
    qoError(qoItem, '');
  });
  qoQty.addEventListener('input', function () {
    qoError(qoQty, '');
  });

  MM.$('[data-qo]').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = qoFind();
    var q = parseInt(qoQty.value, 10);
    if (!p) {
      qoError(qoItem, qoItem.value.trim() ? 'We could not find that product. Pick one from the list.' : 'Start typing a product name and pick it from the list.');
      qoItem.focus();
      return;
    }
    if (!(q > 0)) {
      qoError(qoQty, 'Add a quantity of 1 or more.');
      qoQty.focus();
      return;
    }
    addToTray(p.display_name, q);
    MM.toast(p.display_name + ' x ' + q + ' added to the sample tray');
    qoItem.value = '';
    qoQty.value = 1;
    qoPrice.textContent = 'Pick a product to see its Standard price. Your price shows here after approval.';
    qoAdd.classList.add('is-added');
    qoAdd.textContent = 'Added';
    var tray = MM.$('[data-tray]');
    if (tray) {
      tray.classList.remove('is-flash');
      void tray.offsetWidth;
      tray.classList.add('is-flash');
    }
    window.clearTimeout(qoTimer);
    qoTimer = window.setTimeout(function () {
      qoAdd.classList.remove('is-added');
      qoAdd.textContent = 'Add line';
    }, 1600);
    qoItem.focus();
  });

  /* Orders */
  var orderRows = MM.$$('[data-order]');
  var ordersByKey = {};
  orderRows.forEach(function (tr) {
    ordersByKey[tr.getAttribute('data-order')] = {
      tr: tr,
      label: MM.$('th', tr).firstChild.textContent,
      lines: parseLines(tr.getAttribute('data-lines'))
    };
    MM.$('[data-order-reorder]', tr).addEventListener('click', function () {
      var o = ordersByKey[tr.getAttribute('data-order')];
      o.lines.forEach(function (l) {
        addToTray(CAT[l.key].name, l.qty);
      });
      MM.toast(o.label + ' added to the sample tray');
    });
  });

  MM.$$('[data-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      MM.$$('[data-filter]').forEach(function (c) {
        c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
      });
      orderRows.forEach(function (tr) {
        tr.hidden = f !== 'all' && tr.getAttribute('data-state') !== f;
      });
    });
  });

  /* Pickup status */
  var track = MM.$$('[data-track] li');
  var sms = MM.$('[data-sms]');
  var pickupTitle = MM.$('[data-pickup-title]');
  var sideReady = MM.$('[data-side-ready]');
  var o1 = ordersByKey.o1;
  var MESSAGES = [
    'M&M Vinyl: We got your order and it is in the queue. (Sample message)',
    'M&M Vinyl: Your order is printing now. (Sample message)',
    'M&M Vinyl: Your order is ready for pickup at 12232 Industriplex Blvd, Suite 19, Bldg D. (Sample message)',
    'M&M Vinyl: Thanks for picking up. See you next time. (Sample message)'
  ];
  var TITLES = [
    'Sample order 1 is in the queue.',
    'Sample order 1 is printing.',
    'Sample order 1 is ready for pickup.',
    'Sample order 1 was picked up.'
  ];

  function renderPickup(animate) {
    track.forEach(function (li, i) {
      li.classList.toggle('is-done', i < state.pickup);
      li.classList.toggle('is-now', i === state.pickup);
      if (i === state.pickup) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    pickupTitle.textContent = TITLES[state.pickup];
    sms.innerHTML = '';
    for (var i = 0; i <= state.pickup; i++) {
      var p = document.createElement('p');
      p.className = 'rs-sms__bubble';
      p.textContent = MESSAGES[i];
      if (i < state.pickup || !animate) p.style.animation = 'none';
      sms.appendChild(p);
    }
    var labels = ['In the queue', 'Printing', 'Ready for pickup', 'Picked up'];
    var tone = ['status status--info', 'status status--info', 'status status--ok', 'status'];
    var st = MM.$('[data-status]', o1.tr);
    st.className = tone[state.pickup];
    st.textContent = labels[state.pickup];
    o1.tr.setAttribute('data-state', state.pickup === 3 ? 'done' : state.pickup === 2 ? 'ready' : 'queue');
    sideReady.textContent = state.pickup === 2 ? '1' : '0';
  }

  MM.$('[data-pickup-next]').addEventListener('click', function () {
    state.pickup = Math.min(3, state.pickup + 1);
    renderPickup(true);
  });
  MM.$('[data-pickup-back]').addEventListener('click', function () {
    state.pickup = Math.max(0, state.pickup - 1);
    renderPickup(true);
  });

  /* Price demo */
  var priceBox = MM.$('[data-pricedemo]');
  var priceToggle = MM.$('[data-price-toggle]');
  priceToggle.addEventListener('change', function () {
    priceBox.classList.toggle('is-in', priceToggle.checked);
  });
  (function () {
    if (!('IntersectionObserver' in window) || reduce) {
      priceToggle.checked = true;
      priceBox.classList.add('is-in');
      return;
    }
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      io.disconnect();
      setTimeout(function () {
        priceToggle.checked = true;
        priceBox.classList.add('is-in');
      }, 700);
    }, { threshold: 0.6 });
    io.observe(priceBox);
  })();

  /* Saved sheets */
  var sheets = MM.$$('[data-sheet]');
  var favs = MM.store.get(FAV_KEY, []);
  var names = MM.store.get(NAME_KEY, {});
  var search = MM.$('[data-sheet-search]');
  var favOnly = MM.$('[data-fav-only]');
  var countEl = MM.$('[data-sheet-count]');
  var emptyEl = MM.$('[data-sheet-empty]');

  function rng(seed) {
    var s = seed;
    return function () {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  function thumb(seed) {
    var r = rng(seed);
    var W = 120;
    var H = 160;
    var out = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false"><rect width="' + W + '" height="' + H + '" fill="#262626"/>';
    [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]].forEach(function (p) {
      out += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3" fill="none" stroke="#92d1a9" stroke-width="0.8"/><path d="M' + (p[0] - 5) + ' ' + p[1] + 'h10M' + p[0] + ' ' + (p[1] - 5) + 'v10" stroke="#92d1a9" stroke-width="0.6"/>';
    });
    var y = 18;
    var palette = ['#92d1a9', '#ffffff', '#000000', '#ffbc7d', '#92d1a9'];
    while (y < H - 26) {
      var rowH = 22 + Math.floor(r() * 22);
      if (y + rowH > H - 18) rowH = H - 18 - y;
      var x = 14;
      while (x < W - 20) {
        var w = 18 + Math.floor(r() * 30);
        if (x + w > W - 14) w = W - 14 - x;
        if (w < 10) break;
        var c = palette[Math.floor(r() * palette.length)];
        var shape = r();
        var inner = '';
        if (shape < 0.34) inner = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + rowH + '" rx="4" fill="' + c + '" stroke="#000" stroke-width="1"/>';
        else if (shape < 0.67) inner = '<ellipse cx="' + (x + w / 2) + '" cy="' + (y + rowH / 2) + '" rx="' + w / 2 + '" ry="' + rowH / 2 + '" fill="' + c + '" stroke="#000" stroke-width="1"/>';
        else inner = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + rowH + '" rx="4" fill="none" stroke="' + c + '" stroke-width="1.4" stroke-dasharray="3 2"/>';
        out += '<g class="rs-blk">' + inner + '</g>';
        x += w + 5;
      }
      y += rowH + 5;
    }
    return out + '</svg>';
  }

  function sheetName(el) {
    return MM.$('[data-name]', el).textContent;
  }

  sheets.forEach(function (el, i) {
    var id = 's' + i;
    el.setAttribute('data-id', id);
    var th = MM.$('.rs-sheet__thumb', el);
    th.insertAdjacentHTML('afterbegin', thumb(parseInt(el.getAttribute('data-seed'), 10)));
    var fav = MM.$('.rs-sheet__fav', el);
    var nm = MM.$('[data-name]', el);
    if (names[id]) {
      nm.textContent = names[id];
      fav.setAttribute('aria-label', 'Favorite ' + names[id]);
    }
    if (favs.indexOf(id) > -1) fav.setAttribute('aria-pressed', 'true');
    fav.addEventListener('click', function () {
      var on = fav.getAttribute('aria-pressed') !== 'true';
      fav.setAttribute('aria-pressed', on ? 'true' : 'false');
      favs = favs.filter(function (f) {
        return f !== id;
      });
      if (on) favs.push(id);
      MM.store.set(FAV_KEY, favs);
      filterSheets();
    });
    MM.$('[data-sheet-add]', el).addEventListener('click', function () {
      addToTray('Gang sheet: ' + sheetName(el), 1);
      MM.toast('Added to the sample tray');
    });
    MM.$('[data-rename]', el).addEventListener('click', function (e) {
      var btn = e.currentTarget;
      var cur = sheetName(el);
      if (MM.$('input', nm)) {
        commit();
        return;
      }
      nm.innerHTML = '<label class="sr-only" for="rn-' + id + '">Sheet name</label><input id="rn-' + id + '" type="text" maxlength="60" value="' + MM.esc(cur) + '">';
      var input = MM.$('input', nm);
      input.focus();
      input.select();
      btn.textContent = 'Save name';
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') commit();
        if (ev.key === 'Escape') {
          nm.textContent = cur;
          btn.textContent = 'Rename';
        }
      });
      function commit() {
        var v = MM.$('input', nm).value.trim() || cur;
        nm.textContent = v;
        names[id] = v;
        MM.store.set(NAME_KEY, names);
        fav.setAttribute('aria-label', 'Favorite ' + v);
        btn.textContent = 'Rename';
        MM.toast('Renamed (saved on this device)');
        filterSheets();
      }
    });
  });

  function filterSheets() {
    var q = search.value.trim().toLowerCase();
    var shown = 0;
    sheets.forEach(function (el) {
      var isFav = MM.$('.rs-sheet__fav', el).getAttribute('aria-pressed') === 'true';
      var match = (!q || sheetName(el).toLowerCase().indexOf(q) > -1) && (!favOnly.checked || isFav);
      el.hidden = !match;
      if (match) shown++;
    });
    countEl.textContent = shown + (shown === 1 ? ' sheet' : ' sheets');
    emptyEl.hidden = shown > 0;
  }
  search.addEventListener('input', filterSheets);
  favOnly.addEventListener('change', filterSheets);

  /* Receipts */
  var dlg = MM.$('[data-dialog]');
  var body = MM.$('[data-receipt-body]');
  var taxToggle = MM.$('[data-tax-toggle]');
  var currentText = '';
  var currentName = '';

  function money(c) {
    return MM.money(c);
  }

  function buildReceipt(key) {
    var o = ordersByKey[key];
    var t = productsTotal(o.lines);
    var html = '<dl>';
    var text = ['M&M Vinyl, SAMPLE RECEIPT (sample data, not a real order)', o.label, ''];
    o.lines.forEach(function (l) {
      var c = CAT[l.key];
      var price = c.gang ? 'priced by size in the builder' : (c.from ? 'from ' : '') + money(c.cents) + ' each';
      var line = c.gang ? '' : money(c.cents * l.qty);
      html += '<div class="row"><span>' + MM.esc(c.name) + ' x ' + l.qty + '<br><small>' + MM.esc(price) + '</small></span><span>' + MM.esc(line) + '</span></div>';
      text.push(c.name + ' x ' + l.qty + ' (' + price + ')' + (line ? ' ' + line : ''));
    });
    var taxLine = taxToggle.checked ? 'Tax-exempt: certificate on file (sample)' : 'Tax-exempt not applied';
    var sub = (t.from ? 'Products, from ' : 'Products ') + money(t.cents);
    html += '<div class="row total"><span>' + MM.esc(sub) + '</span></div><div class="row"><span>' + MM.esc(taxLine) + '</span></div></dl>';
    html += '<p class="rs-note">Standard prices shown. A real receipt shows your price, tax, and total.</p>';
    text.push('', sub, taxLine, 'Standard prices shown. A real receipt shows your price, tax, and total.');
    body.innerHTML = html;
    currentText = text.join('\n');
    currentName = key;
    MM.$('#rcpt-h').textContent = o.label + ' receipt';
  }

  MM.$$('[data-receipt]').forEach(function (b) {
    b.addEventListener('click', function () {
      buildReceipt(b.getAttribute('data-receipt'));
      if (dlg.showModal) dlg.showModal();
      else dlg.setAttribute('open', '');
    });
  });

  function closeDlg() {
    if (dlg.close) dlg.close();
    else dlg.removeAttribute('open');
  }
  MM.$('[data-dialog-close]').addEventListener('click', closeDlg);
  dlg.addEventListener('click', function (e) {
    if (e.target === dlg) closeDlg();
  });
  MM.$('[data-receipt-print]').addEventListener('click', function () {
    document.body.classList.add('rs-print-receipt');
    window.print();
    document.body.classList.remove('rs-print-receipt');
  });
  MM.$('[data-receipt-download]').addEventListener('click', function () {
    var blob = new Blob([currentText], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sample-receipt-' + currentName + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 500);
  });

  /* Side jump nav */
  var jump = MM.$$('[data-jump] a');
  var targets = jump.map(function (a) {
    return document.getElementById(a.getAttribute('href').slice(1));
  });
  function spy() {
    var cur = 0;
    targets.forEach(function (t, i) {
      if (t && t.getBoundingClientRect().top < window.innerHeight * 0.35) cur = i;
    });
    jump.forEach(function (a, i) {
      if (i === cur) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('scroll', spy, { passive: true });
  spy();

  /* Header offset for sticky side card */
  var header = MM.$('.site-header');
  if (header) {
    var setTop = function () {
      var top = parseFloat(getComputedStyle(header).top) || 0;
      document.documentElement.style.setProperty('--rs-top', Math.max(0, header.getBoundingClientRect().height + top) + 'px');
    };
    setTop();
    window.addEventListener('resize', setTop);
  }

  /* Reset */
  MM.$('[data-reset]').addEventListener('click', function () {
    state.tray = [];
    state.pickup = 2;
    favs = [];
    names = {};
    MM.store.remove(FAV_KEY);
    MM.store.remove(NAME_KEY);
    renderTray();
    resetLines();
    renderPickup(false);
    sheets.forEach(function (el, i) {
      MM.$('.rs-sheet__fav', el).setAttribute('aria-pressed', 'false');
    });
    MM.$$('[data-name]').forEach(function (n, i) {
      var orig = ['Sample sheet A: front chest designs', 'Sample sheet B: Mardi Gras pocket pack', 'Sample sheet C: youth sizes', 'Sample sheet D: team numbers', 'Sample sheet E: sleeve prints'][i];
      if (orig) n.textContent = orig;
    });
    search.value = '';
    favOnly.checked = false;
    filterSheets();
    MM.toast('Demo reset');
  });

  renderTray();
  renderPickup(false);
  filterSheets();
})();
