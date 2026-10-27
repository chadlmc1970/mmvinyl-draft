(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;
  var TONE = { live: 'ok', ready: 'ok', needs_access: 'warn', unknown: 'gray' };

  function segments(text) { return text.length <= 160 ? 1 : Math.ceil(text.length / 153); }
  function stored() { return MM.store.get('mm.od.settings.v1', {}) || {}; }

  function hoursDrawer() {
    var ST = OD.data.settings, cap = OD.data.gangsheets.capacity_per_day;
    return '<div class="od-drawer__top"><h2>Cutoffs and hours</h2></div>' +
      '<div class="od-fields"><label class="od-field"><span>Mon-Fri cutoff</span><input class="od-input" name="cut-wk" type="time" value="' + ST.cutoffs.weekday + '" data-cut="wk"></label><label class="od-field"><span>Saturday cutoff</span><input class="od-input" name="cut-sat" type="time" value="' + ST.cutoffs.saturday + '" data-cut="sat"></label></div><p class="od-note" data-cut-note></p>' +
      '<table class="od-mini-table"><tbody>' + ST.hours.map(function (h) { return '<tr><td>' + esc(h.days) + '</td><td>' + (h.open ? esc(OD.timeOf('0000-00-00T' + h.open + ':00')) + ' to ' + esc(OD.timeOf('0000-00-00T' + h.close + ':00')) : 'Closed') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="od-fields"><label class="od-field"><span>Printer 1, sheets a day</span><input class="od-input" name="cap-1" type="number" min="1" max="500" value="' + cap.printer_1 + '" data-cap="printer_1"></label><label class="od-field"><span>Printer 2, sheets a day</span><input class="od-input" name="cap-2" type="number" min="1" max="500" value="' + cap.printer_2 + '" data-cap="printer_2"></label></div><p class="od-note">Printer capacity is a placeholder until you set the real number. Hours and cutoffs match your live site.</p>';
  }
  function bindHours(d) {
    var wk = d.querySelector('[data-cut="wk"]'), sat = d.querySelector('[data-cut="sat"]');
    function fmt(v) { var p = v.split(':'); var h = +p[0]; return (h % 12 || 12) + ':' + p[1] + ' ' + (h >= 12 ? 'PM' : 'AM'); }
    function note() { d.querySelector('[data-cut-note]').textContent = 'Customers will see: order by ' + fmt(wk.value) + ' Mon-Fri, ' + fmt(sat.value) + ' Sat for same-day.'; }
    note();
    wk.addEventListener('input', note);
    sat.addEventListener('input', note);
    d.querySelectorAll('[data-cap]').forEach(function (inp) {
      inp.addEventListener('input', function () { OD.data.gangsheets.capacity_per_day[inp.getAttribute('data-cap')] = Math.max(1, +inp.value || 1); });
    });
  }

  function bannerDrawer() {
    var ST = OD.data.settings, saved = stored();
    var banner = saved.banner != null ? saved.banner : ST.banner.text;
    var enabled = saved.enabled != null ? saved.enabled : ST.banner.enabled;
    return '<div class="od-drawer__top"><h2>Announcement banner</h2></div><p class="od-note">The bar at the top of every page on the site.</p><div class="od-prev" data-banner-prev></div>' +
      '<label class="od-field"><span>Banner text</span><textarea class="od-textarea" name="banner" rows="2" maxlength="120" data-banner-text>' + esc(banner) + '</textarea><small data-banner-count></small></label>' +
      '<div class="od-presets">' + ST.banner_presets.map(function (p, i) { return '<button class="od-link" type="button" data-preset="' + i + '">' + esc(p) + '</button>'; }).join('') + '</div>' +
      '<div class="od-row-actions"><label class="od-switch"><input type="checkbox" name="banner-on" data-banner-on ' + (enabled ? 'checked' : '') + '> <span>Show the banner</span></label><button class="od-btn" type="button" data-save-banner>Publish banner</button></div>';
  }
  function bindBanner(d) {
    var ST = OD.data.settings;
    var bt = d.querySelector('[data-banner-text]'), on = d.querySelector('[data-banner-on]'), prev = d.querySelector('[data-banner-prev]');
    function draw() {
      var st = MM.cutoff ? MM.cutoff.getStatus(OD.now(), MM.config.schedule) : null;
      prev.innerHTML = on.checked
        ? '<div class="announce"><div class="announce__inner"><p class="announce__deadline">' + esc(bt.value || 'Your message here') + '</p>' + (st ? '<p class="announce__live" data-state="' + (st.state === 'open' ? 'open' : 'closed') + '">' + esc(st.message) + '</p>' : '') + '</div></div>'
        : '<div class="od-prev__off">The banner is hidden</div>';
      d.querySelector('[data-banner-count]').textContent = bt.value.length + ' of 120 characters';
    }
    draw();
    bt.addEventListener('input', draw);
    on.addEventListener('change', draw);
    d.querySelectorAll('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { bt.value = ST.banner_presets[+b.getAttribute('data-preset')]; draw(); }); });
    d.querySelector('[data-save-banner]').addEventListener('click', function () {
      var s = stored();
      s.banner = bt.value;
      s.enabled = on.checked;
      MM.store.set('mm.od.settings.v1', s);
      OD.toast('Banner saved in this browser. On the real site it goes live in under a minute (preview).', { icon: 'check' });
    });
  }

  function textsDrawer() {
    var ST = OD.data.settings, tplList = OD.data.messages.templates;
    return '<div class="od-drawer__top"><h2>Text messages</h2></div><div class="od-seg" role="tablist" aria-label="Template">' + tplList.map(function (t) { return '<button class="od-seg__b' + (t.key === 'ready' ? ' is-on' : '') + '" type="button" data-tpl="' + t.key + '">' + esc(t.label) + '</button>'; }).join('') + '</div>' +
      '<label class="od-field"><span>Message</span><textarea class="od-textarea" name="tpl" rows="4" data-tpl-text></textarea><small data-tpl-count></small></label>' +
      '<div class="od-presets"><button class="od-link" type="button" data-ins="{order}">Add order number</button><button class="od-link" type="button" data-ins="{close}">Add closing time</button><button class="od-link" type="button" data-ins="{cutoff}">Add cutoff</button></div>' +
      '<div class="od-phone"><div class="od-phone__bar"><i></i></div><div class="od-phone__msgs"><span class="od-phone__from">M&amp;M Vinyl</span><p class="od-bubble" data-tpl-prev></p></div></div>' +
      '<div class="od-row-actions"><label class="od-switch"><input type="checkbox" name="auto" data-auto ' + (ST.texts.send_pickup_ready_automatically ? 'checked' : '') + '> <span>Send "ready" texts automatically</span></label><button class="od-btn" type="button" data-save-tpl>Save template</button></div>';
  }
  function bindTexts(d) {
    var tplList = OD.data.messages.templates, tpls = stored().templates || {};
    var cur = 'ready', ta = d.querySelector('[data-tpl-text]'), tprev = d.querySelector('[data-tpl-prev]');
    function body(key) { return tpls[key] != null ? tpls[key] : tplList.filter(function (t) { return t.key === key; })[0].body; }
    function sub(txt) { return txt.replace(/\{order\}/g, 'S-1044').replace(/\{close\}/g, '5 PM').replace(/\{cutoff\}/g, '2 PM').replace(/\{issue\}/g, 'the background is not transparent'); }
    function draw() {
      var t = sub(ta.value);
      tprev.textContent = t;
      d.querySelector('[data-tpl-count]').textContent = t.length + ' characters, ' + segments(t) + ' text segment' + (segments(t) > 1 ? 's' : '') + ' (each one costs a message fee)';
      tprev.classList.remove('od-bubble--in'); void tprev.offsetWidth; tprev.classList.add('od-bubble--in');
    }
    function load(key) { cur = key; ta.value = body(key); draw(); }
    load(cur);
    ta.addEventListener('input', draw);
    d.querySelectorAll('[data-tpl]').forEach(function (b) { b.addEventListener('click', function () { d.querySelectorAll('[data-tpl]').forEach(function (x) { x.classList.toggle('is-on', x === b); }); load(b.getAttribute('data-tpl')); }); });
    d.querySelectorAll('[data-ins]').forEach(function (b) { b.addEventListener('click', function () { var pos = ta.selectionStart; ta.value = ta.value.slice(0, pos) + b.getAttribute('data-ins') + ta.value.slice(pos); ta.focus(); draw(); }); });
    d.querySelector('[data-save-tpl]').addEventListener('click', function () {
      tpls[cur] = ta.value;
      var s = stored(); s.templates = tpls; MM.store.set('mm.od.settings.v1', s);
      OD.toast('Template saved in this browser (preview). Texts stay off until you approve automation.', { icon: 'check' });
    });
  }

  function connList() {
    var I = OD.data.integrations;
    return '<div class="od-drawer__top"><h2>Connections</h2></div><p class="od-note">Where each number comes from. Tap one for the details.</p><ul class="od-conns">' + I.integrations.map(function (i) {
      return '<li><button type="button" class="od-conn" data-conn="' + i.key + '"><span class="od-conn__name">' + esc(i.name.replace(' (mandmvinyl.com)', '').replace(' gang sheet builder', '').replace(' point of sale', '')) + '</span>' + OD.tonePill(i.status_label, TONE[i.status]) + OD.icon('chev') + '</button></li>';
    }).join('') + '</ul>';
  }
  function connDetail(key) {
    var I = OD.data.integrations;
    var i = I.integrations.filter(function (x) { return x.key === key; })[0];
    var unconf = key === 'kixxl' || key === 'shopkeep';
    return '<button class="od-link od-back" type="button" data-conn-back>' + OD.icon('chev', 'od-flip') + ' All connections</button><div class="od-drawer__top"><h2>' + esc(i.name) + '</h2>' + OD.tonePill(i.status_label, TONE[i.status]) + '</div><dl class="od-dl"><dt>What flows in</dt><dd>' + i.flows_in.map(esc).join(', ') + '</dd><dt>How</dt><dd>' + esc(i.method) + '</dd><dt>What we need from Desiree</dt><dd>' + esc(i.need) + '</dd><dt>Monthly cost</dt><dd>' + esc(i.cost) + '</dd><dt>Sources checked</dt><dd>' + (i.sources.length ? i.sources.map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>'; }).join('<br>') : 'None needed') + '</dd></dl>' + (unconf ? '<p class="od-note">This one is not confirmed yet. Nothing on this page assumes an answer.</p>' : '');
  }
  function bindConn(d) {
    var body = d.querySelector('[data-drawer-body]');
    d.addEventListener('click', function handler(e) {
      var c = e.target.closest('[data-conn]');
      if (c) { body.innerHTML = connDetail(c.getAttribute('data-conn')); return; }
      if (e.target.closest('[data-conn-back]')) body.innerHTML = connList();
    });
  }

  OD.views.settings = function () {
    var ST = OD.data.settings, saved = stored();
    var I = OD.data.integrations;
    var counts = { live: 0, ready: 0, needs_access: 0, unknown: 0 };
    I.integrations.forEach(function (i) { counts[i.status]++; });
    var enabled = saved.enabled != null ? saved.enabled : ST.banner.enabled;
    var tiles = [
      ['hours', 'Cutoffs and hours', '2 PM Mon-Fri, 10 AM Sat. Open M-F 8:30 to 5, Sat 9 to 1.', 'gear'],
      ['banner', 'Announcement banner', 'The bar at the top of every page. ' + (enabled ? 'Showing now.' : 'Hidden.'), 'chat'],
      ['texts', 'Text messages', 'Pickup-ready texts are ' + (ST.texts.send_pickup_ready_automatically ? 'on' : 'off') + ' until you approve the wording.', 'send'],
      ['conns', 'Connections', I.integrations.length + ' systems: ' + counts.live + ' live, ' + counts.ready + ' ready, ' + counts.needs_access + ' need access, ' + counts.unknown + ' to confirm.', 'plug']
    ];
    return {
      title: 'Settings',
      html: '<div class="od-tiles">' + tiles.map(function (t) {
        return '<button type="button" class="od-tile" data-set="' + t[0] + '">' + OD.icon(t[3], 'od-tile__ic') + '<span class="od-tile__t"><b>' + t[1] + '</b><span>' + esc(t[2]) + '</span></span>' + OD.icon('chev', 'od-tile__go') + '</button>';
      }).join('') + '</div><p class="od-note">Changes are saved in this browser only. This is a preview.</p>',
      mount: function (root) {
        function open(key) {
          var d = document.getElementById('od-drawer');
          var html = key === 'hours' ? hoursDrawer() : key === 'banner' ? bannerDrawer() : key === 'texts' ? textsDrawer() : connList();
          OD.drawer.open(html, { wide: true });
          if (key === 'hours') bindHours(d);
          if (key === 'banner') bindBanner(d);
          if (key === 'texts') bindTexts(d);
          if (key === 'conns') bindConn(d);
        }
        root.addEventListener('click', function (e) {
          var t = e.target.closest('[data-set]');
          if (t) open(t.getAttribute('data-set'));
        });
        if (OD.ui.openSetting) {
          var k = OD.ui.openSetting;
          OD.ui.openSetting = null;
          setTimeout(function () { open(k === 'set-conn' ? 'conns' : k); }, 60);
        }
      }
    };
  };
})();
