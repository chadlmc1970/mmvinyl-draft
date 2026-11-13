(function () {
  'use strict';
  var OD = window.OD;
  var MM = window.MM;
  var esc = OD.esc;
  var DO = MM.daysOff;
  OD.views = OD.views || {};

  // On the store (mandmvinyl.com) days off save through the owner login to WordPress. Anywhere else (draft site, local) they stay on this device.
  var API = '/wp-json/mm/v1/owner/days-off';
  var LIVE = /(^|\.)mandmvinyl\.com$/.test(location.hostname);
  var LOCAL_KEY = 'mm.od.daysoff';
  var NOTE_MAX = 60;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var state = { days: null, error: null, cursor: null, selected: null };

  var schedule = function () { return MM.config.schedule; };
  var todayKey = function () {
    var p = MM.cutoff.zoneParts(new Date(), schedule().timeZone);
    return DO.keyOf({ y: p.y, m: p.m, d: p.d });
  };
  var keys = function () { return (state.days || []).map(function (d) { return d.date; }); };
  var noteFor = function (k) {
    var hit = (state.days || []).filter(function (d) { return d.date === k; })[0];
    return hit ? hit.note || '' : '';
  };
  var clean = function (list) {
    var seen = {};
    return (Array.isArray(list) ? list : []).filter(function (d) {
      if (!d || !DO.parseKey(d.date) || seen[d.date]) return false;
      seen[d.date] = true;
      return true;
    }).map(function (d) { return { date: d.date, note: String(d.note || '').slice(0, NOTE_MAX) }; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  };

  function request(method, body) {
    return fetch(API, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json', 'X-MM-Owner': '1' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error('Your sign-in ran out. Reload the page and sign in again.');
        if (!r.ok || !j.ok) throw new Error(j.message || 'That did not save. Try again.');
        return clean(j.days);
      });
    });
  }

  var store = {
    load: function () {
      return LIVE ? request('GET') : Promise.resolve(clean(MM.store.get(LOCAL_KEY, [])));
    },
    save: function (date, off, note) {
      if (LIVE) return request('POST', { date: date, off: off, note: note || '' });
      var list = clean(MM.store.get(LOCAL_KEY, [])).filter(function (d) { return d.date !== date; });
      if (off) list.push({ date: date, note: note || '' });
      list = clean(list);
      MM.store.set(LOCAL_KEY, list);
      return Promise.resolve(list);
    }
  };

  // Social posts hook: when the owner picks how days off get announced (not built yet), call it from here with the saved day.
  function onSaved(date, off) {
    document.dispatchEvent(new CustomEvent('od:days-off-changed', { detail: { date: date, off: off, days: state.days } }));
  }

  function customerText(k) {
    var d = DO.parseKey(k);
    var before = DO.addDays(d, -1);
    var at = MM.cutoff.zonedToUtc(before.y, before.m, before.d, 15, 0, schedule().timeZone);
    var b = DO.banner(new Date(at), schedule(), keys(), { windowDays: 1 });
    return b ? b.message : '';
  }

  function calendarHtml() {
    var c = state.cursor;
    var first = { y: c.y, m: c.m, d: 1, wd: new Date(Date.UTC(c.y, c.m - 1, 1)).getUTCDay() };
    var len = new Date(Date.UTC(c.y, c.m, 0)).getUTCDate();
    var today = todayKey();
    var off = keys();
    var t = DO.parseKey(today);
    var canBack = c.y > t.y || (c.y === t.y && c.m > t.m);
    var cells = '';
    for (var i = 0; i < first.wd; i++) cells += '<span class="od-doff__pad" aria-hidden="true"></span>';
    for (var n = 1; n <= len; n++) {
      var day = DO.addDays(first, n - 1);
      var k = DO.keyOf(day);
      var isOff = off.indexOf(k) !== -1;
      var open = !!MM.cutoff.hoursFor(day, schedule());
      var past = k < today;
      var can = !past && (open || isOff);
      var cls = 'od-doff__day' + (isOff ? ' is-off' : '') + (k === today ? ' is-today' : '') + (!open ? ' is-closed' : '') + (k === state.selected ? ' is-sel' : '');
      var lbl = DO.label(day) + (isOff ? ', day off' : !open ? ', shop closed' : '') + (k === today ? ', today' : '');
      cells += '<button type="button" class="' + cls + '" data-doff-day="' + k + '"' + (can ? '' : ' disabled') + ' aria-pressed="' + isOff + '" aria-label="' + esc(lbl) + '">' + n + '</button>';
    }
    return '<div class="od-doff__cal">' +
      '<div class="od-doff__month"><button type="button" class="od-doff__nav" data-doff-month="-1"' + (canBack ? '' : ' disabled') + ' aria-label="Previous month">' + OD.icon('chev') + '</button>' +
      '<b aria-live="polite">' + MONTHS[c.m - 1] + ' ' + c.y + '</b>' +
      '<button type="button" class="od-doff__nav" data-doff-month="1" aria-label="Next month">' + OD.icon('chev') + '</button></div>' +
      '<div class="od-doff__grid" role="group" aria-label="Pick days off">' +
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (w) { return '<span class="od-doff__wd" aria-hidden="true">' + w + '</span>'; }).join('') +
      cells + '</div>' +
      '<p class="od-doff__key"><span><i class="is-off"></i>Day off</span><span><i class="is-closed"></i>Closed</span><span>Tap a date to mark or unmark it.</span></p>' +
      '</div>';
  }

  function noteHtml() {
    var k = state.selected;
    if (!k || keys().indexOf(k) === -1) return '';
    return '<form class="od-doff__note" data-doff-note>' +
      '<label class="od-field"><span>Note for ' + esc(DO.label(DO.parseKey(k))) + ' (optional, just for you)</span>' +
      '<input class="od-input" name="note" maxlength="' + NOTE_MAX + '" value="' + esc(noteFor(k)) + '" placeholder="Example: family trip"></label>' +
      '<button class="od-btn" type="submit">Save note</button></form>';
  }

  function listHtml() {
    var today = todayKey();
    var up = (state.days || []).filter(function (d) { return d.date >= today; });
    if (!up.length) return '<p class="od-doff__empty">No days off coming up. Tap a date on the calendar to add one.</p>';
    return '<ul class="od-doff__list">' + up.map(function (d) {
      var next = DO.nextPrintDay(d.date, schedule(), keys());
      return '<li><div><b>' + esc(DO.label(DO.parseKey(d.date))) + '</b>' +
        '<span>' + (next ? 'Orders print ' + esc(DO.label(DO.parseKey(next))) : 'Orders print the next open day') + (d.note ? ' · ' + esc(d.note) : '') + '</span></div>' +
        '<button type="button" class="od-doff__rm" data-doff-rm="' + d.date + '" aria-label="Remove day off ' + esc(DO.label(DO.parseKey(d.date))) + '">' + OD.icon('close') + '</button></li>';
    }).join('') + '</ul>';
  }

  function sideHtml() {
    var today = todayKey();
    var next = (state.days || []).filter(function (d) { return d.date >= today; })[0];
    return '<h2 class="od-doff__h">Coming up</h2>' + listHtml() +
      (next ? '<div class="od-doff__see"><span>Customers see this from 3 days before:</span><p>' + esc(customerText(next.date)) + '</p></div>' : '') +
      '<p class="od-doff__how">Orders keep coming in on days off. The same-day timer skips the day, and checkout stays open.</p>' +
      (LIVE ? '' : '<p class="od-doff__how"><b>Preview:</b> saved on this device only. On mandmvinyl.com it saves to the store.</p>');
  }

  function bodyHtml() {
    if (state.error) return OD.card('', '<p class="od-note">' + esc(state.error) + '</p>', {});
    if (!state.days) return '<div class="od-loading"><i></i><i></i><i></i></div>';
    return '<div class="od-doff">' +
      '<section class="od-card od-doff__left">' + calendarHtml() + '<div data-doff-notebox>' + noteHtml() + '</div></section>' +
      '<section class="od-card od-doff__right" data-doff-side>' + sideHtml() + '</section></div>';
  }

  OD.views.daysoff = function () {
    if (!state.cursor) {
      var t = DO.parseKey(todayKey());
      state.cursor = { y: t.y, m: t.m };
    }
    return {
      title: 'Days Off',
      html: '<div data-doff-root>' + bodyHtml() + '</div>',
      mount: function (root) {
        var host = root.querySelector('[data-doff-root]');
        var busy = false;
        var paint = function () { host.innerHTML = bodyHtml(); };
        if (!state.days) {
          store.load().then(function (d) { state.days = d; state.error = null; paint(); })
            .catch(function (e) { state.error = e.message; paint(); });
        }
        var save = function (date, off, note, msg) {
          if (busy) return;
          busy = true;
          host.classList.add('is-busy');
          store.save(date, off, note).then(function (d) {
            state.days = d;
            onSaved(date, off);
            paint();
            OD.toast(msg);
          }).catch(function (e) {
            OD.toast(e.message, { tone: 'bad', icon: 'warn' });
          }).then(function () {
            busy = false;
            host.classList.remove('is-busy');
          });
        };
        host.addEventListener('click', function (e) {
          var nav = e.target.closest('[data-doff-month]');
          if (nav && !nav.disabled) {
            var m = state.cursor.m + +nav.getAttribute('data-doff-month');
            state.cursor = { y: state.cursor.y + (m > 12 ? 1 : m < 1 ? -1 : 0), m: m > 12 ? 1 : m < 1 ? 12 : m };
            paint();
            return;
          }
          var day = e.target.closest('[data-doff-day]');
          if (day && !day.disabled) {
            var k = day.getAttribute('data-doff-day');
            var off = keys().indexOf(k) === -1;
            state.selected = k;
            var lbl = DO.label(DO.parseKey(k));
            save(k, off, off ? '' : null, off ? lbl + ' is a day off. Orders still come in.' : lbl + ' is a printing day again.');
            return;
          }
          var rm = e.target.closest('[data-doff-rm]');
          if (rm) {
            var r = rm.getAttribute('data-doff-rm');
            save(r, false, null, DO.label(DO.parseKey(r)) + ' is a printing day again.');
          }
        });
        host.addEventListener('submit', function (e) {
          var f = e.target.closest('[data-doff-note]');
          if (!f) return;
          e.preventDefault();
          save(state.selected, true, f.note.value.trim().slice(0, NOTE_MAX), 'Note saved.');
        });
      }
    };
  };
})();
