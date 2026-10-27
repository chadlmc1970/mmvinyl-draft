(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;

  var TONE = { live: 'mint', ready: 'mint', needs_access: 'amber', unknown: 'gray' };

  function mapSvg(list, W) {
    var left = ['woocommerce', 'kixxl', 'shopkeep', 'paypal', 'wallets'];
    var right = ['fedex', 'ups', 'google', 'social', 'texting', 'email'];
    var byKey = {};
    list.forEach(function (i) { byKey[i.key] = i; });
    var rows = Math.max(left.length, right.length);
    var rowH = 66;
    var H = rows * rowH + 24;
    var nw = Math.min(236, (W - 200) / 2 - 20);
    var hubX = W / 2, hubY = H / 2;
    var out = '<svg class="od-map__svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-label="Where your information comes from">';
    out += '<g class="od-map__lines">';
    var nodes = '';
    function place(keys, side) {
      var step = (H - 24) / keys.length;
      keys.forEach(function (k, i) {
        var it = byKey[k];
        var y = 12 + step * i + step / 2;
        var x = side === 'l' ? 10 : W - 10 - nw;
        var ex = side === 'l' ? x + nw : x;
        var hx = side === 'l' ? hubX - 70 : hubX + 70;
        var c1 = ex + (hx - ex) * 0.5;
        var d = 'M' + ex + ' ' + y + 'C' + c1 + ' ' + y + ' ' + c1 + ' ' + hubY + ' ' + hx + ' ' + hubY;
        out += '<path class="od-map__line od-map__line--' + it.status + '" id="ml-' + k + '" pathLength="1" d="' + d + '" style="--d:' + i * 90 + 'ms"/>';
        if (!OD.reduce && (it.status === 'live' || it.status === 'ready')) {
          out += '<circle r="3.6" class="od-map__packet"><animateMotion dur="' + (3 + i * 0.4) + 's" repeatCount="indefinite" begin="' + i * 0.5 + 's" ' + (side === 'l' ? '' : 'keyPoints="1;0" keyTimes="0;1" calcMode="linear" ') + '><mpath href="#ml-' + k + '"/></animateMotion></circle>';
        }
        nodes += '<foreignObject x="' + x + '" y="' + (y - 28) + '" width="' + nw + '" height="56"><button class="od-node od-node--' + it.status + '" type="button" data-node="' + k + '" xmlns="http://www.w3.org/1999/xhtml"><i></i><span><b>' + esc(it.name.replace(' (mandmvinyl.com)', '').replace(' gang sheet builder', '').replace(' point of sale', '')) + '</b><small>' + esc(it.status_label) + '</small></span></button></foreignObject>';
      });
    }
    place(left, 'l');
    place(right, 'r');
    out += '</g>';
    out += '<g class="od-map__hub"><circle cx="' + hubX + '" cy="' + hubY + '" r="72" class="od-map__halo"/><circle cx="' + hubX + '" cy="' + hubY + '" r="58" class="od-map__core"/><image href="' + MM.url('assets/img/brand/badge-mark.svg') + '" x="' + (hubX - 34) + '" y="' + (hubY - 50) + '" width="68" height="68"/><text x="' + hubX + '" y="' + (hubY + 36) + '" text-anchor="middle" class="od-map__hubtxt">Dashboard</text></g>';
    out += nodes + '</svg>';
    return out;
  }

  OD.views.integrations = function () {
    var I = OD.data.integrations;
    var list = I.integrations;
    var counts = { live: 0, ready: 0, needs_access: 0, unknown: 0 };
    list.forEach(function (i) { counts[i.status]++; });
    var legend = '<ul class="od-maplegend">' + Object.keys(I.status_legend).map(function (k) {
      return '<li><i class="od-lg od-lg--' + k + '"></i>' + esc(I.status_legend[k]) + ' <b>' + counts[k] + '</b></li>';
    }).join('') + '</ul>';
    var map = OD.card('How it all connects',
      '<div class="od-map" data-map></div>' + legend,
      { source: '11 systems', sample: false, tagText: 'Checked Oct 26', sub: 'Lines show how each system feeds this dashboard. Tap a box for the details below.' });
    var unconfirmed = OD.card('Not confirmed yet', '<ul class="od-todo od-todo--plain">' + I.unconfirmed.map(function (u) { return '<li><span class="od-q">?</span><span>' + esc(u) + '</span></li>'; }).join('') + '</ul><p class="od-fine">These came up on the Oct 26 call and are still open. Nothing on this page assumes an answer.</p>', { source: 'Call assessment', sample: false, tagText: 'Open questions', cls: 'od-card--risk' });
    var cards = list.map(function (i) {
      return (
        '<article class="od-int" id="int-' + i.key + '" data-int="' + i.key + '"><header><h3>' + esc(i.name) + '</h3>' + OD.tonePill(i.status_label, TONE[i.status]) + '</header>' +
        '<dl><dt>What flows in</dt><dd>' + i.flows_in.map(esc).join(', ') + '</dd>' +
        '<dt>How</dt><dd>' + esc(i.method) + '</dd>' +
        '<dt>What we need from Desiree</dt><dd>' + esc(i.need) + '</dd>' +
        '<dt>Monthly cost</dt><dd>' + esc(i.cost) + '</dd>' +
        '<dt>Sources checked</dt><dd>' + (i.sources.length ? i.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>'; }).join('<br>') : 'None needed') + '</dd></dl></article>'
      );
    }).join('');
    var detail = OD.card('Each connection in plain words', '<div class="od-ints">' + cards + '</div>', { source: 'Vendor docs', sample: false, tagText: 'Checked Oct 26' });
    var html = '<div class="od-grid od-grid--main-side">' + map + unconfirmed + '</div>' + detail;
    return {
      title: 'Where your information comes from',
      sub: 'Every system, how it connects, and what is still missing.',
      html: html,
      mount: function (root) {
        var host = root.querySelector('[data-map]');
        function draw() {
          var w = Math.round(host.clientWidth);
          if (w < 520) { host.innerHTML = '<p class="od-muted">The map needs a wider screen. The details are listed below.</p>'; return; }
          host.innerHTML = mapSvg(list, w);
        }
        draw();
        var last = host.clientWidth;
        if ('ResizeObserver' in window) {
          var t;
          var ro = new ResizeObserver(function () {
            clearTimeout(t);
            t = setTimeout(function () {
              if (Math.abs(host.clientWidth - last) > 6) { last = host.clientWidth; draw(); }
            }, 120);
          });
          ro.observe(host);
          root.__cleanup = function () { ro.disconnect(); };
        }
        root.addEventListener('click', function (e) {
          var n = e.target.closest('[data-node]');
          if (!n) return;
          var el = root.querySelector('#int-' + n.getAttribute('data-node'));
          if (el) {
            el.scrollIntoView({ behavior: OD.reduce ? 'auto' : 'smooth', block: 'center' });
            el.classList.remove('is-flash');
            void el.offsetWidth;
            el.classList.add('is-flash');
          }
        });
      }
    };
  };

  /* ---------- Settings ---------- */
  function segments(text) {
    var len = text.length;
    return len <= 160 ? 1 : Math.ceil(len / 153);
  }

  OD.views.settings = function () {
    var ST = OD.data.settings;
    var saved = MM.store.get('mm.od.settings.v1', {}) || {};
    var banner = saved.banner != null ? saved.banner : ST.banner.text;
    var enabled = saved.enabled != null ? saved.enabled : ST.banner.enabled;
    var tpls = saved.templates || {};
    var cap = OD.data.gangsheets.capacity_per_day;

    var bannerCard = OD.card('Announcement banner',
      '<div class="od-prev"><p class="od-prev__label">Live preview of the bar at the top of every page</p><div class="od-prev__bar" data-banner-prev></div></div>' +
      '<label class="od-field"><span>Banner text</span><textarea class="od-textarea" rows="2" maxlength="120" data-banner-text>' + esc(banner) + '</textarea><small data-banner-count></small></label>' +
      '<div class="od-filters" aria-label="Quick text">' + ST.banner_presets.map(function (p, i) { return '<button class="od-fchip" type="button" data-preset="' + i + '">' + esc(p.length > 38 ? p.slice(0, 36) + '...' : p) + '</button>'; }).join('') + '</div>' +
      '<div class="od-row-actions"><label class="od-switch"><input type="checkbox" data-banner-on ' + (enabled ? 'checked' : '') + '> <span>Show the banner</span></label><button class="od-btn od-btn--mint" type="button" data-save-banner>' + OD.icon('check') + 'Publish banner</button></div>',
      { source: 'Her live site', sample: false, tagText: 'Preview, not saved', sub: 'She edits this in under a minute. The preview updates as you type.' });

    var cutCard = OD.card('Cutoffs and hours',
      '<div class="od-fields"><label class="od-field"><span>Mon-Fri cutoff</span><input class="od-input" type="time" value="' + ST.cutoffs.weekday + '" data-cut="wk"></label><label class="od-field"><span>Saturday cutoff</span><input class="od-input" type="time" value="' + ST.cutoffs.saturday + '" data-cut="sat"></label></div>' +
      '<p class="od-fine" data-cut-note></p>' +
      '<table class="od-mini-table"><thead><tr><th>Days</th><th>Open</th><th>Close</th></tr></thead><tbody>' + ST.hours.map(function (h) { return '<tr><td>' + esc(h.days) + '</td><td>' + (h.open ? esc(OD.timeOf('0000-00-00T' + h.open + ':00')) : 'Closed') + '</td><td>' + (h.close ? esc(OD.timeOf('0000-00-00T' + h.close + ':00')) : '') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<p class="od-fine">Holiday closures are added as dates with a banner. None are set. The live site still shows an old Labor Day closure.</p>',
      { source: 'Her live site', real: true, realText: 'Real hours', sub: 'Same-day DTF cutoffs drive the clock on the Today page.' });

    var capCard = OD.card('Printer capacity',
      '<div class="od-fields"><label class="od-field"><span>Printer 1, sheets a day</span><input class="od-input" type="number" min="1" max="500" value="' + cap.printer_1 + '" data-cap="printer_1"></label><label class="od-field"><span>Printer 2, sheets a day</span><input class="od-input" type="number" min="1" max="500" value="' + cap.printer_2 + '" data-cap="printer_2"></label></div><p class="od-fine">Placeholder values. How many sheets a day each printer can really run was not covered on the call. Set the real numbers and the load bars on Today follow.</p>',
      { source: 'Desiree', sample: false, tagText: 'Placeholder values' });

    var tplCard = OD.card('Text templates',
      '<div class="od-tpl"><div class="od-tpl__edit"><div class="od-filters" role="tablist" aria-label="Template">' + ST_templates().map(function (t, i) { return '<button class="od-fchip' + (i === 2 ? ' is-on' : '') + '" type="button" data-tpl="' + t.key + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' +
      '<label class="od-field"><span>Message</span><textarea class="od-textarea" rows="5" data-tpl-text></textarea><small data-tpl-count></small></label>' +
      '<div class="od-filters" aria-label="Insert"><button class="od-fchip" type="button" data-ins="{order}">+ order number</button><button class="od-fchip" type="button" data-ins="{close}">+ closing time</button><button class="od-fchip" type="button" data-ins="{cutoff}">+ cutoff</button></div>' +
      '<div class="od-row-actions"><label class="od-switch"><input type="checkbox" data-auto ' + (ST.texts.send_pickup_ready_automatically ? 'checked' : '') + '> <span>Send "ready" texts automatically</span></label><button class="od-btn od-btn--mint" type="button" data-save-tpl>' + OD.icon('check') + 'Save template</button></div>' +
      '<p class="od-fine">Automation is off until you turn it on. Quiet hours ' + esc(ST.texts.quiet_hours.start) + ' to ' + esc(ST.texts.quiet_hours.end) + '. Every message ends with a STOP line and is logged.</p></div>' +
      '<div class="od-tpl__prev"><div class="od-phone"><div class="od-phone__bar"><i></i></div><div class="od-phone__msgs"><span class="od-phone__from">M&amp;M Vinyl</span><p class="od-bubble" data-tpl-prev></p><span class="od-phone__time">Preview</span></div></div></div></div>',
      { source: 'Texting service', sample: false, tagText: 'Preview, not saved', sub: 'Plain words, and the preview shows exactly what the customer gets.' });

    function ST_templates() { return OD.data.messages.templates; }

    return {
      title: 'Settings',
      sub: 'Cutoffs, hours, the banner, and the words in every text.',
      html: '<div class="od-grid od-grid--halves">' + bannerCard + cutCard + '</div><div class="od-grid od-grid--main-side">' + tplCard + capCard + '</div>',
      mount: function (root) {
        var bt = root.querySelector('[data-banner-text]');
        var on = root.querySelector('[data-banner-on]');
        var prev = root.querySelector('[data-banner-prev]');
        function drawBanner() {
          var st = MM.cutoff ? MM.cutoff.getStatus(OD.now(), MM.config.schedule) : null;
          prev.innerHTML = on.checked
            ? '<div class="announce"><div class="announce__inner"><p class="announce__deadline">' + esc(bt.value || 'Your message here') + '</p>' + (st ? '<p class="announce__live" data-state="' + (st.state === 'open' ? 'open' : 'closed') + '">' + esc(st.message) + '</p>' : '') + '</div></div>'
            : '<div class="od-prev__off">Banner is hidden</div>';
          root.querySelector('[data-banner-count]').textContent = bt.value.length + ' of 120 characters';
        }
        drawBanner();
        bt.addEventListener('input', drawBanner);
        on.addEventListener('change', drawBanner);
        root.querySelectorAll('[data-preset]').forEach(function (b) {
          b.addEventListener('click', function () { bt.value = ST.banner_presets[+b.getAttribute('data-preset')]; drawBanner(); });
        });
        root.querySelector('[data-save-banner]').addEventListener('click', function () {
          var s = MM.store.get('mm.od.settings.v1', {}) || {};
          s.banner = bt.value;
          s.enabled = on.checked;
          MM.store.set('mm.od.settings.v1', s);
          OD.toast('Banner saved in this browser. On the real site it goes live in under a minute (preview).', { icon: 'check' });
        });

        var wk = root.querySelector('[data-cut="wk"]');
        var sat = root.querySelector('[data-cut="sat"]');
        function cutNote() {
          function fmt(v) { var p = v.split(':'); var h = +p[0]; return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM'); }
          root.querySelector('[data-cut-note]').textContent = 'Customers will see: order by ' + fmt(wk.value) + ' Mon-Fri, ' + fmt(sat.value) + ' Sat for same-day. (Preview only: the live clock still uses the site settings.)';
        }
        cutNote();
        wk.addEventListener('input', cutNote);
        sat.addEventListener('input', cutNote);

        root.querySelectorAll('[data-cap]').forEach(function (inp) {
          inp.addEventListener('input', function () {
            var v = Math.max(1, +inp.value || 1);
            OD.data.gangsheets.capacity_per_day[inp.getAttribute('data-cap')] = v;
          });
        });

        var list = ST_templates();
        var cur = 'ready';
        var ta = root.querySelector('[data-tpl-text]');
        var tprev = root.querySelector('[data-tpl-prev]');
        function body(key) { return tpls[key] != null ? tpls[key] : list.filter(function (t) { return t.key === key; })[0].body; }
        function sub(txt) { return txt.replace(/\{order\}/g, 'S-1044').replace(/\{close\}/g, '5 PM').replace(/\{cutoff\}/g, '2 PM').replace(/\{issue\}/g, 'the background is not transparent'); }
        function drawTpl() {
          tprev.textContent = sub(ta.value);
          var n = sub(ta.value).length;
          root.querySelector('[data-tpl-count]').textContent = n + ' characters after names fill in, ' + segments(sub(ta.value)) + ' text segment' + (segments(sub(ta.value)) > 1 ? 's' : '') + ' (each costs a message fee)';
          tprev.classList.remove('od-bubble--in');
          void tprev.offsetWidth;
          tprev.classList.add('od-bubble--in');
        }
        function load(key) { cur = key; ta.value = body(key); drawTpl(); }
        load(cur);
        ta.addEventListener('input', drawTpl);
        root.querySelectorAll('[data-tpl]').forEach(function (b) {
          b.addEventListener('click', function () {
            root.querySelectorAll('[data-tpl]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
            load(b.getAttribute('data-tpl'));
          });
        });
        root.querySelectorAll('[data-ins]').forEach(function (b) {
          b.addEventListener('click', function () {
            var pos = ta.selectionStart;
            ta.value = ta.value.slice(0, pos) + b.getAttribute('data-ins') + ta.value.slice(pos);
            ta.focus();
            drawTpl();
          });
        });
        root.querySelector('[data-save-tpl]').addEventListener('click', function () {
          tpls[cur] = ta.value;
          var s = MM.store.get('mm.od.settings.v1', {}) || {};
          s.templates = tpls;
          MM.store.set('mm.od.settings.v1', s);
          OD.toast('Template saved in this browser (preview). Texts stay off until you approve automation.', { icon: 'check' });
        });
      }
    };
  };
})();
