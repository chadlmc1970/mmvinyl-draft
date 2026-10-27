(function () {
  'use strict';
  var MM = window.MM;
  var form = MM.$('[data-est-form]');
  var tbody = MM.$('[data-est-rows] tbody');
  var widthIn = MM.$('[data-est-width]');
  var gapIn = MM.$('[data-est-gap]');
  var lenOut = MM.$('[data-est-length]');
  var subOut = MM.$('[data-est-sub]');
  var utilOut = MM.$('[data-est-util]');
  var svg = MM.$('[data-est-svg]');
  var wLabel = MM.$('[data-est-w-label]');
  var errEl = MM.$('[data-est-error]');
  var colors = ['#92d1a9', '#ffbc7d', '#ffffff', '#6fb88b', '#d8d8d8', '#c4e9d2'];
  var rowCount = 0;

  function addRow(w, h, n) {
    rowCount++;
    var id = rowCount;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<th scope="row"><span class="lr-swatch" style="background:' + colors[(id - 1) % colors.length] + '"></span>Design ' + id + '</th>' +
      '<td><input class="input" type="number" inputmode="decimal" min="0.1" step="0.25" aria-label="Design ' + id + ' width in inches" data-k="w"></td>' +
      '<td><input class="input" type="number" inputmode="decimal" min="0.1" step="0.25" aria-label="Design ' + id + ' height in inches" data-k="h"></td>' +
      '<td><input class="input" type="number" inputmode="numeric" min="1" step="1" aria-label="Design ' + id + ' quantity" data-k="n"></td>' +
      '<td><button class="icon-btn lr-del" type="button" aria-label="Remove design ' + id + '"><svg aria-hidden="true"><use href="#i-close"/></svg></button></td>';
    tr.setAttribute('data-color', colors[(id - 1) % colors.length]);
    if (w) {
      MM.$('[data-k="w"]', tr).value = w;
      MM.$('[data-k="h"]', tr).value = h;
      MM.$('[data-k="n"]', tr).value = n;
    }
    MM.$$('[data-k]', tr).forEach(function (i) {
      i.name = 'design' + id + '-' + i.getAttribute('data-k');
    });
    tbody.appendChild(tr);
    MM.$('.lr-del', tr).addEventListener('click', function () {
      tr.remove();
      calc();
    });
    return tr;
  }

  function read() {
    return MM.$$('tr', tbody)
      .map(function (tr) {
        return {
          w: parseFloat(MM.$('[data-k="w"]', tr).value),
          h: parseFloat(MM.$('[data-k="h"]', tr).value),
          n: parseInt(MM.$('[data-k="n"]', tr).value, 10),
          color: tr.getAttribute('data-color')
        };
      })
      .filter(function (d) {
        return d.w > 0 && d.h > 0 && d.n > 0;
      });
  }

  function fmt(v) {
    return (Math.round(v * 10) / 10).toString();
  }

  function calc() {
    errEl.hidden = true;
    var W = parseFloat(widthIn.value);
    var gap = parseFloat(gapIn.value);
    if (!(W > 0)) W = 22;
    if (!(gap >= 0)) gap = 0;
    wLabel.textContent = fmt(W) + ' inches wide, runs left to right';
    var designs = read();
    svg.innerHTML = '';
    if (!designs.length) {
      lenOut.textContent = 'Add a design';
      subOut.textContent = 'Fill in a width, a height, and how many.';
      utilOut.textContent = '';
      svg.setAttribute('viewBox', '0 0 220 120');
      return;
    }
    var tooWide = designs.filter(function (d) {
      return d.w > W;
    })[0];
    if (tooWide) {
      lenOut.textContent = 'Too wide';
      subOut.textContent = '';
      utilOut.textContent = '';
      errEl.hidden = false;
      errEl.textContent = 'A design that is ' + fmt(tooWide.w) + ' inches wide does not fit a ' + fmt(W) + ' inch sheet.';
      return;
    }
    var items = [];
    designs.forEach(function (d) {
      for (var i = 0; i < Math.min(d.n, 500); i++) items.push(d);
    });
    var total = designs.reduce(function (s, d) {
      return s + d.n;
    }, 0);
    items.sort(function (a, b) {
      return b.h - a.h || b.w - a.w;
    });
    var rows = [];
    var cur = null;
    items.forEach(function (it) {
      if (!cur || cur.x + it.w > W + 1e-9) {
        cur = { x: 0, h: it.h, items: [] };
        rows.push(cur);
      }
      cur.items.push({ x: cur.x, w: it.w, h: it.h, color: it.color });
      cur.x += it.w + gap;
      if (it.h > cur.h) cur.h = it.h;
    });
    var y = 0;
    var area = 0;
    var parts = '';
    rows.forEach(function (r) {
      r.items.forEach(function (it) {
        area += it.w * it.h;
        parts += '<rect x="' + y + '" y="' + it.x + '" width="' + it.h + '" height="' + it.w + '" rx="0.4" fill="' + it.color + '" stroke="#000" stroke-width="0.12"/>';
      });
      y += r.h + gap;
    });
    var L = y - gap;
    svg.setAttribute('viewBox', '-0.4 -0.4 ' + (L + 0.8) + ' ' + (W + 0.8));
    svg.innerHTML = '<rect x="0" y="0" width="' + L + '" height="' + W + '" fill="#262626"/>' + parts;
    var ft = L / 12;
    lenOut.textContent = 'About ' + fmt(Math.ceil(L)) + ' inches';
    subOut.textContent = fmt(ft) + ' feet long, ' + fmt(W) + ' wide, ' + total + (total === 1 ? ' design' : ' designs') + ' in ' + rows.length + (rows.length === 1 ? ' row' : ' rows') + '.';
    utilOut.textContent = 'About ' + Math.round((area / (W * L)) * 100) + '% of the sheet is covered. Rotating or shuffling designs in the builder can shorten it.';
  }

  MM.$('[data-est-add]').addEventListener('click', function () {
    var tr = addRow();
    MM.$('input', tr).focus();
  });
  MM.$('[data-est-clear]').addEventListener('click', function () {
    tbody.innerHTML = '';
    rowCount = 0;
    addRow();
    calc();
  });
  MM.$('[data-est-example]').addEventListener('click', function () {
    tbody.innerHTML = '';
    rowCount = 0;
    addRow(11, 11, 6);
    addRow(8, 8, 6);
    addRow(3.5, 3.5, 12);
    calc();
  });
  form.addEventListener('input', calc);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
  });
  addRow();
  calc();
})();
