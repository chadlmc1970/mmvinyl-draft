(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  function initClock() {
    var root = MM.$('[data-cutoff-clock]');
    if (!root || !MM.cutoff) return;
    var bar = MM.$('[data-cc-bar]', root);
    var timeEl = MM.$('[data-cc-time]', root);
    var statusEl = MM.$('[data-cc-status]', root);
    var lastStatus = '';

    function pad(n) {
      return n < 10 ? '0' + n : String(n);
    }

    function windowMs(now, cfg) {
      var p = MM.cutoff.zoneParts(now, cfg.timeZone);
      var day = cfg.days[String(p.wd)];
      if (!day) return 0;
      var o = day.open.split(':');
      var c = day.cutoff.split(':');
      return ((+c[0] * 60 + +c[1]) - (+o[0] * 60 + +o[1])) * 60000;
    }

    function tick() {
      var cfg = MM.config.schedule;
      var now = MM.cutoff.now();
      var st = MM.cutoff.getStatus(now, cfg);
      var open = st.state === 'open';
      root.classList.toggle('is-closed', !open);
      if (open) {
        var total = windowMs(now, cfg) || st.msRemaining;
        var frac = Math.max(0, Math.min(1, st.msRemaining / total));
        if (bar) bar.style.strokeDashoffset = String(100 * (1 - frac));
        var s = Math.floor(st.msRemaining / 1000);
        var h = Math.floor(s / 3600);
        var m = Math.floor((s % 3600) / 60);
        timeEl.textContent = (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60);
      } else {
        if (bar) bar.style.strokeDashoffset = '100';
        timeEl.textContent = 'Closed';
      }
      var text = open ? st.message + '.' : (st.state === 'cutoff-passed' ? 'Cutoff passed for today. ' : '') + st.message + '.';
      if (text !== lastStatus) {
        statusEl.textContent = text;
        lastStatus = text;
      }
    }

    tick();
    setInterval(tick, 1000);
  }

  function initFatTuesday() {
    var el = MM.$('[data-fat-days]');
    if (!el || !MM.cutoff) return;
    var p = MM.cutoff.zoneParts(MM.cutoff.now(), 'America/Chicago');
    var days = Math.round((Date.UTC(2027, 1, 9) - Date.UTC(p.y, p.m - 1, p.d)) / 86400000);
    if (days < 0) return;
    el.textContent = String(days);
    var label = el.nextElementSibling;
    if (label) label.textContent = days === 1 ? ' day to go' : days === 0 ? ' days to go. It is Fat Tuesday!' : ' days to go';
  }

  function initChecklist() {
    var root = MM.$('[data-checklist]');
    if (!root) return;
    var boxes = MM.$$('input[type="checkbox"]', root);
    var countEl = MM.$('[data-check-count]', root);
    var barEl = MM.$('[data-check-bar]', root);
    var msgEl = MM.$('[data-check-msg]', root);

    function update() {
      var n = boxes.filter(function (b) {
        return b.checked;
      }).length;
      countEl.textContent = String(n);
      barEl.style.transform = 'scaleX(' + n / boxes.length + ')';
      root.classList.toggle('is-done', n === boxes.length);
      msgEl.textContent = n === boxes.length ? 'Looks ready. Go build your sheet.' : n === 0 ? '' : boxes.length - n + ' to go.';
    }

    boxes.forEach(function (b) {
      b.addEventListener('change', update);
    });
    update();
  }

  function initEstimator() {
    var root = MM.$('[data-estimator]');
    if (!root) return;
    var linesEl = MM.$('[data-est-lines]', root);
    var addBtn = MM.$('[data-est-add]', root);
    var sheetW = MM.$('[data-est="sheetw"]', root);
    var errEl = MM.$('[data-est-error]', root);
    var inEl = MM.$('[data-est-in]', root);
    var ftEl = MM.$('[data-est-ft]', root);
    var detailEl = MM.$('[data-est-detail]', root);
    var sheetEl = MM.$('[data-est-sheet]', root);
    var template = MM.$('[data-est-row]', root).cloneNode(true);
    var MARGIN = 0.5;
    var GAP = 0.25;
    var MAX_ROWS = 6;
    var NS = 'http://www.w3.org/2000/svg';
    var fills = ['#92d1a9', '#ffffff', '#cfe9da', '#7ec598', '#ffbc7d', '#e4e9e6'];
    var last = null;

    function fmt(n) {
      return String(Math.round(n * 100) / 100).replace(/\.0+$/, '');
    }

    function rows() {
      return MM.$$('[data-est-row]', linesEl);
    }

    function readRow(row) {
      return {
        w: parseFloat(MM.$('[data-est="w"]', row).value),
        h: parseFloat(MM.$('[data-est="h"]', row).value),
        q: parseInt(MM.$('[data-est="q"]', row).value, 10)
      };
    }

    function fit(line, usable) {
      var best = null;
      [[line.w, line.h], [line.h, line.w]].forEach(function (o) {
        if (o[0] > usable + 1e-9) return;
        var per = Math.floor((usable + GAP + 1e-9) / (o[0] + GAP));
        if (per < 1) return;
        var count = Math.ceil(line.q / per);
        var len = count * o[1] + (count - 1) * GAP;
        if (!best || len < best.len) best = { len: len, per: per, rows: count, w: o[0], h: o[1] };
      });
      return best;
    }

    function clearOut(msg) {
      inEl.textContent = '0';
      ftEl.textContent = '0';
      detailEl.textContent = '';
      sheetEl.textContent = '';
      last = null;
      errEl.textContent = msg || '';
      errEl.hidden = !msg;
    }

    function calc() {
      var W = parseFloat(sheetW.value);
      if (!(W >= 4)) return clearOut('Enter a sheet width of at least 4 inches.');
      var usable = W - MARGIN * 2;
      var placed = [];
      var total = MARGIN * 2;
      var info = [];
      var list = rows();
      for (var i = 0; i < list.length; i++) {
        var line = readRow(list[i]);
        if (!(line.w > 0) || !(line.h > 0) || !(line.q >= 1)) return clearOut('Enter a width, height, and how many for each design size.');
        if (line.q > 5000) return clearOut('That is a lot of designs. Try a smaller number to estimate.');
        var f = fit(line, usable);
        if (!f) return clearOut('A design is wider than the sheet. Check the width or the sheet width.');
        placed.push({ f: f, q: line.q });
        total += f.len + (i ? GAP : 0);
        info.push(fmt(line.q) + ' at ' + fmt(line.w) + ' x ' + fmt(line.h) + ' in: ' + f.per + ' across, ' + f.rows + (f.rows === 1 ? ' row' : ' rows'));
      }
      errEl.hidden = true;
      errEl.textContent = '';
      var inches = Math.ceil(total - 1e-9);
      inEl.textContent = String(inches);
      ftEl.textContent = String(Math.round((inches / 12) * 10) / 10).replace(/\.0$/, '');
      detailEl.innerHTML = info.map(MM.esc).join('<br>');
      last = { W: W, L: total, placed: placed };
      draw();
    }

    function draw() {
      if (!last) return;
      var W = last.W;
      var L = last.L;
      var avail = Math.max(120, sheetEl.clientWidth - 32);
      var scale = Math.min(avail / W, 340 / L);
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + L);
      svg.setAttribute('width', String(Math.round(W * scale)));
      svg.setAttribute('height', String(Math.round(L * scale)));
      svg.setAttribute('role', 'presentation');
      var sheet = document.createElementNS(NS, 'rect');
      sheet.setAttribute('width', W);
      sheet.setAttribute('height', L);
      sheet.setAttribute('rx', 0.6);
      sheet.setAttribute('fill', '#1b1b1b');
      sheet.setAttribute('stroke', '#92d1a9');
      sheet.setAttribute('stroke-width', 0.18);
      svg.appendChild(sheet);
      var usable = W - MARGIN * 2;
      var y = MARGIN;
      var k = 0;
      last.placed.forEach(function (p, idx) {
        var f = p.f;
        var rowW = f.per * f.w + (f.per - 1) * GAP;
        var x0 = MARGIN + Math.max(0, (usable - rowW) / 2);
        var left = p.q;
        for (var r = 0; r < f.rows; r++) {
          var n = Math.min(f.per, left);
          for (var c = 0; c < n; c++) {
            if (k < 400) {
              var rect = document.createElementNS(NS, 'rect');
              rect.setAttribute('class', 'est-piece');
              rect.setAttribute('x', x0 + c * (f.w + GAP));
              rect.setAttribute('y', y);
              rect.setAttribute('width', f.w);
              rect.setAttribute('height', f.h);
              rect.setAttribute('rx', Math.min(0.4, f.w / 6));
              rect.setAttribute('fill', fills[idx % fills.length]);
              rect.setAttribute('style', '--k:' + k);
              svg.appendChild(rect);
            }
            k++;
          }
          left -= n;
          y += f.h + GAP;
        }
      });
      sheetEl.textContent = '';
      sheetEl.appendChild(svg);
    }

    function syncRemoveButtons() {
      var list = rows();
      list.forEach(function (row) {
        MM.$('[data-est-remove]', row).hidden = list.length === 1;
      });
      addBtn.disabled = list.length >= MAX_ROWS;
    }

    addBtn.addEventListener('click', function () {
      if (rows().length >= MAX_ROWS) return;
      var row = template.cloneNode(true);
      MM.$$('input', row).forEach(function (inp) {
        inp.value = '';
      });
      MM.$('[data-est="q"]', row).value = '1';
      linesEl.appendChild(row);
      syncRemoveButtons();
      MM.$('[data-est="w"]', row).focus();
      calc();
    });

    linesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-est-remove]');
      if (!btn) return;
      btn.closest('[data-est-row]').remove();
      syncRemoveButtons();
      calc();
    });

    MM.$$('[data-est-preset]', root).forEach(function (chip) {
      chip.addEventListener('click', function () {
        var first = rows()[0];
        var w = MM.$('[data-est="w"]', first);
        w.value = chip.getAttribute('data-est-preset');
        MM.$('[data-est="h"]', first).value = w.value;
        calc();
      });
    });

    root.addEventListener('input', calc);
    root.addEventListener('submit', function (e) {
      e.preventDefault();
    });
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 120);
    });

    syncRemoveButtons();
    calc();
  }

  MM.ready(function () {
    initClock();
    initFatTuesday();
    initChecklist();
    initEstimator();
  });
})();
