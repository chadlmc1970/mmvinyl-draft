(function () {
  'use strict';
  var MM = window.MM;
  var SHEET_W = 22;
  var GAP = 0.5;
  var colors = ['#92d1a9', '#ffbc7d', '#ffffff', '#6fb88b', '#d8d8d8', '#c4e9d2'];

  function fmt(v) {
    return (Math.round(v * 100) / 100).toString();
  }

  // Same row packing as the gang sheet sizing estimator.
  function pack(designs) {
    var items = [];
    designs.forEach(function (d) {
      for (var i = 0; i < Math.min(d.n, 500); i++) items.push(d);
    });
    items.sort(function (a, b) {
      return b.h - a.h || b.w - a.w;
    });
    var rows = [];
    var cur = null;
    items.forEach(function (it) {
      if (!cur || cur.x + it.w > SHEET_W + 1e-9) {
        cur = { x: 0, h: it.h };
        rows.push(cur);
      }
      cur.x += it.w + GAP;
      if (it.h > cur.h) cur.h = it.h;
    });
    var len = rows.reduce(function (s, r) {
      return s + r.h + GAP;
    }, 0);
    return { length: rows.length ? len - GAP : 0, rows: rows.length, count: items.length };
  }

  function lengthText(r) {
    return 'About ' + Math.ceil(r.length) + ' inches';
  }

  function lengthSub(r) {
    return fmt(Math.round((r.length / 12) * 10) / 10) + ' feet long, 22 wide, ' + r.count + (r.count === 1 ? ' design' : ' designs') + ' in ' + r.rows + (r.rows === 1 ? ' row' : ' rows') + '.';
  }

  function initPrintOne() {
    var main = MM.$('main');
    function clear() {
      document.body.classList.remove('lp-print-one');
      MM.$$('.lp-print-skip').forEach(function (el) {
        el.classList.remove('lp-print-skip');
      });
    }
    MM.$$('[data-lp-print]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = MM.$(btn.getAttribute('data-lp-print'));
        if (!target || !main) return MM.printPage();
        clear();
        Array.prototype.forEach.call(main.children, function (el) {
          if (el !== target) el.classList.add('lp-print-skip');
        });
        document.body.classList.add('lp-print-one');
        MM.printPage();
      });
    });
    window.addEventListener('afterprint', clear);
  }

  /* Placement picker */

  var GARMENTS = {
    tee: { label: 'Adult tee', group: 'adult', chest: 20, sizes: ['S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'] },
    hood: { label: 'Adult sweatshirt or hoodie', group: 'adult', chest: 22, hoodie: true, sizes: ['S', 'M', 'L', 'XL', '2X', '3X', '4X', '5X'] },
    ytee: { label: 'Youth tee', group: 'youth', chest: 16, sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    yhood: { label: 'Youth sweatshirt or hoodie', group: 'youth', chest: 17, hoodie: true, sizes: ['XS', 'S', 'M', 'L', 'XL'] },
    tod: { label: 'Toddler tee', group: 'toddler', chest: 12, sizes: ['2T', '3T', '4T', '5/6'] },
    baby: { label: 'Infant onesie', group: 'baby', chest: 10, sizes: ['NB', '6M', '12M', '18M'] }
  };

  var FULL_W = { S: 11, M: 11, L: 11, XL: 11, '2X': 11, '3X': 12, '4X': 13, '5X': 13 };

  var SPOTS = [
    { id: 'lc', name: 'Left chest', side: 'front', adult: [3.5, 2], youth: [2.5, 1.5], down: 3, where: 'About 3 in below the collar, 4 to 6 in over from the center line', x: 4.5 },
    { id: 'cc', name: 'Center chest', side: 'front', adult: [8, 4], youth: [6, 3], down: 3, where: '3 in below the collar, centered' },
    { id: 'ff', name: 'Full front', side: 'front', full: true, down: 3, where: '3 in below the collar, centered' },
    { id: 'sl', name: 'Sleeve', side: 'sleeve', adult: [2.5, 1], youth: [1.5, 1], where: 'About 1 in above the sleeve hem, centered on the sleeve' },
    { id: 'bc', name: 'Back collar', side: 'back', adult: [2, 2], youth: [1.5, 1.5], down: 1.5, where: '1 to 2 in below the back collar, centered' },
    { id: 'ub', name: 'Upper back', side: 'back', adult: [12, 4], youth: [10, 2.5], down: 4, where: 'About 4 in below the collar, centered' },
    { id: 'fb', name: 'Full back', side: 'back', adult: [12, 14], youth: [10, 12], down: 4, where: 'About 4 in below the collar, centered' },
    { id: 'os', name: 'Oversize', side: 'front', adult: [13, 15], youth: [10, 12], down: 2, where: 'About 2 in below the collar, centered' },
    { id: 'pk', name: 'Pocket', side: 'front', down: 3, x: 4.5 }
  ];

  var TEE_FRONT = 'M70 20 Q100 44 130 20 L165 30 L195 70 L170 88 L160 78 L160 205 L40 205 L40 78 L30 88 L5 70 L35 30 Z';
  var TEE_BACK = 'M70 20 Q100 30 130 20 L165 30 L195 70 L170 88 L160 78 L160 205 L40 205 L40 78 L30 88 L5 70 L35 30 Z';
  var BODY_W = 120;
  var COLLAR_FRONT = 32;
  var COLLAR_BACK = 25;

  function result(g, size, spot) {
    var G = GARMENTS[g];
    var out = { w: null, h: null, down: spot.where || '', note: '', ask: false, src: 'Typical, per Ninja Transfers (retailer guidance).' };
    if (G.group === 'baby') {
      out.ask = true;
      out.down = 'No published sizes for onesies. Lay it flat, measure the spot, and stay well inside the seams and snaps.';
      out.src = '';
      return out;
    }
    if (G.group === 'toddler') {
      if (spot.full) {
        out.w = 6.5;
        out.h = 6.5;
        out.down = 'Centered. No published distance below the collar for toddler tees, so hold it up before you press.';
        out.src = 'Width is our recommended toddler size from the Build a Gang Sheet page. Height depends on your art.';
      } else {
        out.ask = true;
        out.down = 'No published size for this spot on toddler tees.';
        out.src = '';
      }
      return out;
    }
    var youth = G.group === 'youth';
    if (spot.id === 'pk') {
      if (G.hoodie) {
        out.w = 6;
        out.h = 4;
        out.down = 'On the pouch pocket, centered. Size it for the smallest hoodie in your run.';
        out.note = 'Up to about 6 x 4 in on a hoodie pouch.';
        out.side = 'pouch';
      } else {
        out.w = 3;
        out.h = 3;
        out.down = 'On the pocket, centered. Keep it off the pocket seams.';
        out.note = 'Keep a tee pocket print under 3 x 3 in.';
      }
      out.src = 'Per Ninja Transfers (retailer guidance).';
      return out;
    }
    if (spot.full) {
      out.w = youth ? 8 : FULL_W[size] || 11;
      out.h = out.w;
      out.src = 'Width is our recommended full front size from the Build a Gang Sheet page. Height depends on your art. Ninja Transfers lists a typical ' + (youth ? '9 x 9' : '11 x 11') + ' in (retailer guidance).';
    } else {
      var s = youth ? spot.youth : spot.adult;
      out.w = s[0];
      out.h = s[1];
    }
    if (G.hoodie && spot.side !== 'sleeve') {
      out.down = spot.side === 'back' ? out.down : out.down.replace('the collar', 'the collar or hood seam');
      if (spot.full || spot.id === 'os') out.note = 'Keep the bottom of the design above the pouch pocket.';
    }
    if (!spot.full && G.group === 'adult') out.note = (out.note ? out.note + ' ' : '') + 'Same size on every adult size.';
    return out;
  }

  function drawShirt(svg, g, spot, r) {
    var G = GARMENTS[g];
    var back = spot.side === 'back';
    var s = BODY_W / G.chest;
    var parts = '<path class="lp-tee__shape" d="' + (back ? TEE_BACK : TEE_FRONT) + '"/>';
    if (G.hoodie) {
      parts += back ? '<path class="lp-tee__hood" d="M70 20 Q100 -6 130 20"/>' : '<path class="lp-tee__hood" d="M70 20 Q100 2 130 20"/><path class="lp-tee__pouch" d="M64 150 L136 150 L148 196 L52 196 Z"/>';
    }
    if (r.w && r.h) {
      var w = r.w * s;
      var h = r.h * s;
      if (spot.side === 'sleeve') {
        parts += '<rect class="lp-z lp-z--hot" x="' + -w / 2 + '" y="' + -h / 2 + '" width="' + w + '" height="' + h + '" transform="translate(' + (182.5 - 0.58 * (6 + h / 2)) + ' ' + (79 - 0.81 * (6 + h / 2)) + ') rotate(-36)"/>';
      } else if (r.side === 'pouch') {
        parts += '<rect class="lp-z lp-z--hot" x="' + (100 - w / 2) + '" y="' + (173 - h / 2) + '" width="' + w + '" height="' + h + '"/>';
      } else {
        var top = (back ? COLLAR_BACK : COLLAR_FRONT) + (spot.down || 3) * s;
        if (G.hoodie && !back) top += 4;
        var cx = spot.x ? 100 + spot.x * s : 100;
        parts += '<rect class="lp-z lp-z--hot" x="' + (cx - w / 2) + '" y="' + top + '" width="' + w + '" height="' + h + '"/>';
      }
    }
    parts += '<text class="lp-tees__cap" x="100" y="200" text-anchor="middle">' + (back ? 'Back' : 'Front') + '</text>';
    svg.innerHTML = parts;
  }

  function initPicker() {
    var root = MM.$('[data-pick]');
    if (!root) return;
    var KEY = 'mm.placement.v1';
    var gSel = MM.$('[data-pick-garment]');
    var sSel = MM.$('[data-pick-size]');
    var spotsEl = MM.$('[data-pick-spots]');
    var whatOut = MM.$('[data-pick-what]');
    var sizeOut = MM.$('[data-pick-size-out]');
    var downOut = MM.$('[data-pick-down]');
    var noteOut = MM.$('[data-pick-note]');
    var askEl = MM.$('[data-pick-ask]');
    var svg = MM.$('[data-pick-svg]');
    var addEl = MM.$('[data-pick-add]');
    var wIn = MM.$('[data-pick-w]');
    var hIn = MM.$('[data-pick-h]');
    var nIn = MM.$('[data-pick-n]');
    var errEl = MM.$('[data-pick-err]');
    var listEl = MM.$('[data-pick-list]');
    var emptyEl = MM.$('[data-pick-empty]');
    var lenOut = MM.$('[data-pick-len]');
    var lenSub = MM.$('[data-pick-lensub]');
    var lenSubDefault = lenSub.innerHTML;
    var spot = SPOTS[2];
    var list = MM.store.get(KEY, []);
    if (!Array.isArray(list)) list = [];

    SPOTS.forEach(function (sp) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = sp.name;
      b.setAttribute('data-spot', sp.id);
      b.setAttribute('aria-pressed', sp === spot ? 'true' : 'false');
      b.addEventListener('click', function () {
        spot = sp;
        MM.$$('[data-spot]', spotsEl).forEach(function (c) {
          c.setAttribute('aria-pressed', c === b ? 'true' : 'false');
        });
        render();
      });
      spotsEl.appendChild(b);
    });

    function fillSizes() {
      var G = GARMENTS[gSel.value];
      var prev = sSel.value;
      sSel.innerHTML = G.sizes
        .map(function (z) {
          return '<option value="' + z + '">' + (G.group === 'youth' ? 'Youth ' : '') + z + '</option>';
        })
        .join('');
      if (G.sizes.indexOf(prev) > -1) sSel.value = prev;
      else if (G.sizes.indexOf('M') > -1) sSel.value = 'M';
    }

    function label(g, size, sp) {
      var G = GARMENTS[g];
      var sz = size;
      var name = sp.id === 'pk' && G.hoodie ? 'Pouch pocket' : sp.name;
      return G.label + ' ' + sz + ', ' + name.toLowerCase();
    }

    function render() {
      var g = gSel.value;
      var size = sSel.value;
      var r = result(g, size, spot);
      whatOut.textContent = label(g, size, spot);
      if (r.ask) {
        sizeOut.textContent = 'Ask us';
      } else {
        sizeOut.textContent = fmt(r.w) + ' x ' + fmt(r.h) + ' in';
      }
      downOut.textContent = r.down;
      noteOut.textContent = [r.note, r.src].filter(Boolean).join(' ');
      askEl.hidden = !r.ask;
      addEl.hidden = r.ask;
      if (!r.ask) {
        wIn.value = fmt(r.w);
        hIn.value = fmt(r.h);
      }
      errEl.hidden = true;
      drawShirt(svg, g, spot, r);
    }

    function renderList() {
      listEl.innerHTML = '';
      list.forEach(function (d, i) {
        var li = document.createElement('li');
        li.className = 'lp-list__item';
        li.innerHTML =
          '<span class="lr-swatch" style="background:' + colors[i % colors.length] + '"></span>' +
          '<span class="lp-list__txt"><strong>' + MM.esc(d.label) + '</strong><span>' + fmt(d.w) + ' x ' + fmt(d.h) + ' in, ' + d.n + ' ' + (d.n === 1 ? 'copy' : 'copies') + '</span></span>' +
          '<button class="icon-btn lr-del" type="button" aria-label="Remove ' + MM.esc(d.label) + '"><svg aria-hidden="true"><use href="#i-close"/></svg></button>';
        MM.$('.lr-del', li).addEventListener('click', function () {
          list.splice(i, 1);
          save();
        });
        listEl.appendChild(li);
      });
      emptyEl.hidden = list.length > 0;
      if (!list.length) {
        lenOut.textContent = 'Add a design';
        lenSub.innerHTML = lenSubDefault;
        return;
      }
      var r = pack(list);
      lenOut.textContent = lengthText(r);
      lenSub.textContent = lengthSub(r) + ' Packed with 0.5 inch spacing, no rotating.';
    }

    function save() {
      MM.store.set(KEY, list);
      renderList();
    }

    MM.$('[data-pick-push]').addEventListener('click', function () {
      var w = parseFloat(wIn.value);
      var h = parseFloat(hIn.value);
      var n = parseInt(nIn.value, 10);
      errEl.hidden = true;
      if (!(w > 0) || !(h > 0) || !(n > 0)) {
        errEl.textContent = 'Fill in a width, a height, and how many.';
        errEl.hidden = false;
        return;
      }
      if (w > SHEET_W) {
        errEl.textContent = 'A design ' + fmt(w) + ' inches wide does not fit a 22 inch sheet.';
        errEl.hidden = false;
        return;
      }
      list.push({ label: label(gSel.value, sSel.value, spot), w: w, h: h, n: Math.min(n, 500) });
      save();
      MM.toast('Added to your sheet list');
    });
    MM.$('[data-pick-clear]').addEventListener('click', function () {
      list = [];
      save();
    });
    gSel.addEventListener('change', function () {
      fillSizes();
      render();
    });
    sSel.addEventListener('change', render);

    fillSizes();
    render();
    renderList();
  }

  /* Placement ruler ticks, drawn in inches */

  function initRuler() {
    var g = MM.$('[data-ruler-ticks]');
    if (!g) return;
    var out = '';
    var cx = 3.5;
    var top = 1.5;
    for (var q = -13; q <= 13; q++) {
      var x = cx + q / 4;
      var len = q % 4 === 0 ? 0.25 : q % 2 === 0 ? 0.17 : 0.1;
      out += '<line x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + len) + '"/>';
      if (q % 4 === 0) out += '<text x="' + x + '" y="' + (top + 0.4) + '" text-anchor="middle">' + Math.abs(q / 4) + '</text>';
    }
    for (var k = 2; k <= 21; k++) {
      var y = top + k / 4;
      var l2 = k % 4 === 0 ? 0.25 : k % 2 === 0 ? 0.17 : 0.1;
      out += '<line x1="3.2" y1="' + y + '" x2="' + (3.2 + l2) + '" y2="' + y + '"/>';
      if (k % 4 === 0) out += '<text x="3.62" y="' + (y + 0.05) + '" text-anchor="middle">' + k / 4 + '</text>';
    }
    out += '<text class="lp-r__tiny" x="3.5" y="6.68" text-anchor="middle">in down</text>';
    g.innerHTML = out;
  }

  /* Team size run */

  var SPLITS = {
    small: { sizes: ['S', 'M', 'L', 'XL', '2X'], w: [1, 2, 3, 3, 1], label: 'Rush Order Tees small order split' },
    big: { sizes: ['XS', 'S', 'M', 'L', 'XL', '2X', '3X'], w: [1, 10, 23, 31, 23, 9, 3], label: 'Rush Order Tees 100 plus split' },
    rt: { sizes: ['XS', 'S', 'M', 'L', 'XL', '2X'], w: [3, 20, 28, 28, 16, 5], label: 'Real Thread 100 shirt example' }
  };
  var YOUTH = { sizes: ['YXS', 'YS', 'YM', 'YL', 'YXL'], w: [1, 2, 3, 3, 1] };

  function spread(total, weights) {
    var sum = weights.reduce(function (a, b) {
      return a + b;
    }, 0);
    var raw = weights.map(function (w) {
      return (total * w) / sum;
    });
    var counts = raw.map(Math.floor);
    var left = total - counts.reduce(function (a, b) {
      return a + b;
    }, 0);
    raw
      .map(function (v, i) {
        return { i: i, r: v - Math.floor(v), w: weights[i] };
      })
      .sort(function (a, b) {
        return b.r - a.r || b.w - a.w;
      })
      .slice(0, left)
      .forEach(function (o) {
        counts[o.i]++;
      });
    return counts;
  }

  function initRun() {
    var root = MM.$('[data-run]');
    if (!root) return;
    var totalIn = MM.$('[data-run-total]');
    var youthIn = MM.$('[data-run-youth]');
    var splitSel = MM.$('[data-run-split]');
    var hint = MM.$('[data-run-splithint]');
    var sheetChk = MM.$('[data-run-sheet]');
    var hWrap = MM.$('[data-run-hwrap]');
    var hIn = MM.$('[data-run-h]');
    var err = MM.$('[data-run-err]');
    var big = MM.$('[data-run-big]');
    var sub = MM.$('[data-run-sub]');
    var tbody = MM.$('[data-run-table] tbody');
    var sheetOut = MM.$('[data-run-sheetout]');
    var lenOut = MM.$('[data-run-len]');
    var lenSub = MM.$('[data-run-lensub]');
    var rows = [];

    function calc() {
      err.hidden = true;
      var total = parseInt(totalIn.value, 10);
      var youth = parseInt(youthIn.value, 10);
      if (!(total > 0)) total = 0;
      if (!(youth >= 0)) youth = 0;
      if (total > 2000) total = 2000;
      if (youth > total) {
        err.textContent = 'Youth shirts cannot be more than the total. We used ' + total + '.';
        err.hidden = false;
        youth = total;
      }
      var adult = total - youth;
      var key = splitSel.value;
      if (key === 'auto') key = adult >= 100 ? 'big' : 'small';
      hint.textContent = splitSel.value === 'auto' ? 'Using the ' + SPLITS[key].label + (adult >= 100 ? ' for 100 or more adult shirts.' : ' for under 100 adult shirts.') : SPLITS[key].label + '.';
      var sp = SPLITS[key];
      var a = adult ? spread(adult, sp.w) : [];
      var y = youth ? spread(youth, YOUTH.w) : [];
      rows = [];
      YOUTH.sizes.forEach(function (s, i) {
        if (youth) rows.push({ size: 'Youth ' + s.slice(1), code: s, n: y[i], youth: true });
      });
      sp.sizes.forEach(function (s, i) {
        if (adult) rows.push({ size: 'Adult ' + s, code: s, n: a[i], youth: false });
      });
      var max = rows.reduce(function (m, r) {
        return Math.max(m, r.n);
      }, 0);
      big.textContent = total + (total === 1 ? ' shirt' : ' shirts');
      sub.textContent = adult + ' adult, ' + youth + ' youth';
      tbody.innerHTML = rows
        .map(function (r) {
          return '<tr' + (r.n ? '' : ' class="is-zero"') + '><th scope="row">' + r.size + '</th><td class="num">' + r.n + '</td><td><span class="lp-run__bar" style="--p:' + (max ? Math.round((r.n / max) * 100) : 0) + '"></span></td></tr>';
        })
        .join('');
      if (!rows.length) tbody.innerHTML = '<tr><td colspan="3">Put in how many shirts.</td></tr>';

      hWrap.hidden = !sheetChk.checked;
      sheetOut.hidden = !sheetChk.checked || !rows.length;
      if (sheetChk.checked && rows.length) {
        var h = parseFloat(hIn.value);
        if (!(h > 0)) h = 11;
        var designs = [];
        rows.forEach(function (r) {
          if (!r.n) return;
          var w = r.youth ? 8 : FULL_W[r.code] || 11;
          designs.push({ w: w, h: (h * w) / 11, n: r.n });
        });
        var res = pack(designs);
        lenOut.textContent = lengthText(res);
        lenSub.textContent = lengthSub(res) + ' Front designs only. Add names and numbers in the builder.';
      }
    }

    MM.$('[data-run-copy]').addEventListener('click', function () {
      var text = rows
        .filter(function (r) {
          return r.n;
        })
        .map(function (r) {
          return r.size + ': ' + r.n;
        })
        .join('\n');
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () {
            MM.toast('Size list copied');
          },
          function () {
            MM.toast('Could not copy. Select the table and copy it instead.');
          }
        );
      } else {
        MM.toast('Could not copy. Select the table and copy it instead.');
      }
    });

    MM.$('[data-run-form]').addEventListener('input', calc);
    MM.$('[data-run-form]').addEventListener('change', calc);
    calc();
  }

  /* Sign-up sheet */

  function initSignup() {
    var sheet = MM.$('[data-sign-sheet]');
    if (!sheet) return;
    var KEY = 'mm.signup.v1';
    var team = MM.$('[data-sign-team]');
    var who = MM.$('[data-sign-who]');
    var due = MM.$('[data-sign-due]');
    var num = MM.$('[data-sign-num]');
    var back = MM.$('[data-sign-back]');
    var tbody = MM.$('[data-sign-rows]');
    var ROWS = 24;

    function rowsHtml() {
      var out = '';
      for (var i = 1; i <= ROWS; i++) {
        out += '<tr><td class="lp-c-n">' + i + '</td><td></td><td class="lp-c-size"></td><td class="lp-c-num" data-sign-col="num"></td><td class="lp-c-back" data-sign-col="back"></td></tr>';
      }
      return out;
    }

    function dueText(v) {
      if (!v) return '';
      var p = v.split('-');
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(d);
    }

    function render() {
      var t = team.value.trim();
      MM.$('[data-sign-team-out]').textContent = t ? t + ' shirt order' : 'Team shirt order';
      MM.$('[data-sign-who-out]').textContent = who.value.trim();
      MM.$('[data-sign-due-out]').textContent = dueText(due.value);
      MM.$$('[data-sign-col="num"]', sheet).forEach(function (el) {
        el.hidden = !num.checked;
      });
      MM.$$('[data-sign-col="back"]', sheet).forEach(function (el) {
        el.hidden = !back.checked;
      });
      MM.store.set(KEY, { team: team.value, who: who.value, due: due.value, num: num.checked, back: back.checked });
    }

    tbody.innerHTML = rowsHtml();
    var saved = MM.store.get(KEY, null);
    if (saved) {
      team.value = saved.team || '';
      who.value = saved.who || '';
      due.value = saved.due || '';
      num.checked = saved.num !== false;
      back.checked = !!saved.back;
    }
    [team, who, due].forEach(function (i) {
      i.addEventListener('input', render);
    });
    [due, num, back].forEach(function (i) {
      i.addEventListener('change', render);
    });
    MM.$('[data-sign-reset]').addEventListener('click', function () {
      team.value = '';
      who.value = '';
      due.value = '';
      num.checked = true;
      back.checked = false;
      render();
    });
    render();
  }

  MM.ready(function () {
    initPrintOne();
    initPicker();
    initRuler();
    initRun();
    initSignup();
  });
})();
