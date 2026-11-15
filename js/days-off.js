(function () {
if (window.MM && window.MM.daysOff) return;
window.MM = window.MM || {};
window.MM.config = window.MM.config || {"schedule":{"timeZone":"America/Chicago","closedDates":["2026-11-26","2026-11-27","2026-11-28","2026-11-29","2026-12-25","2026-12-26","2026-12-28","2027-01-01","2027-01-02"],"specialDates":{"2026-12-24":{"open":"09:00","close":"13:00","cutoff":null},"2026-12-29":{"open":"09:00","close":"14:00","cutoff":"11:00"},"2026-12-30":{"open":"09:00","close":"14:00","cutoff":"11:00"},"2026-12-31":{"open":"09:00","close":"14:00","cutoff":"11:00"}},"days":{"0":null,"1":{"open":"08:30","close":"17:00","cutoff":"14:00"},"2":{"open":"08:30","close":"17:00","cutoff":"14:00"},"3":{"open":"08:30","close":"17:00","cutoff":"14:00"},"4":{"open":"08:30","close":"17:00","cutoff":"14:00"},"5":{"open":"08:30","close":"17:00","cutoff":"14:00"},"6":{"open":"09:00","close":"13:00","cutoff":"10:00"}}},"daysOff":{"url":"/wp-json/mm/v1/days-off"}};
if (!document.querySelector('link[href*="css/days-off.css"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/css/days-off.css?v=9ac51018'; document.head.appendChild(l); }
var prevCutoff = window.MM.cutoff;
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

  function hoursFor(day, cfg) {
    var key = dateKey(day);
    if (cfg.closedDates && cfg.closedDates.indexOf(key) !== -1) return null;
    if (cfg.specialDates && Object.prototype.hasOwnProperty.call(cfg.specialDates, key)) return cfg.specialDates[key] || null;
    return cfg.days[String(day.wd)] || null;
  }

  function scheduleFor(day, cfg) {
    if (cfg.noPrintDates && cfg.noPrintDates.indexOf(dateKey(day)) !== -1) return null;
    var h = hoursFor(day, cfg);
    return h && h.cutoff ? h : null;
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
    hoursFor: hoursFor,
    scheduleFor: scheduleFor,
    zoneParts: zoneParts,
    zonedToUtc: zonedToUtc,
    formatTime: formatTime,
    formatRemaining: formatRemaining,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };
});

;
if (prevCutoff && prevCutoff !== window.MM.cutoff) { var nc = window.MM.cutoff; for (var k in nc) { if (Object.prototype.hasOwnProperty.call(nc, k)) prevCutoff[k] = nc[k]; } window.MM.cutoff = prevCutoff; }
(function (root, factory) {
  var api = factory(function () {
    return (root.MM && root.MM.cutoff) || (typeof require === 'function' ? require('./10-cutoff-logic.js') : null);
  });
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.MM = root.MM || {};
    root.MM.daysOff = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (getCutoff) {
  'use strict';

  // Days off: days the owner is not printing. Orders stay open; anything placed then prints on the next printing day.
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var LOOKAHEAD = 60;

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function parseKey(key) {
    var m = KEY_RE.exec(String(key || ''));
    if (!m) return null;
    var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (t.getUTCFullYear() !== +m[1] || t.getUTCMonth() !== +m[2] - 1 || t.getUTCDate() !== +m[3]) return null;
    return { y: +m[1], m: +m[2], d: +m[3], wd: t.getUTCDay() };
  }

  function keyOf(day) {
    return day.y + '-' + pad(day.m) + '-' + pad(day.d);
  }

  function addDays(day, n) {
    var t = new Date(Date.UTC(day.y, day.m - 1, day.d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
  }

  function label(day) {
    return WEEKDAYS[day.wd] + ', ' + MONTHS[day.m - 1] + ' ' + day.d;
  }

  // Accepts ["2026-11-21"] or [{date: "2026-11-21", note: "..."}]; returns sorted, unique, valid date keys.
  function normalize(list) {
    var seen = {};
    (Array.isArray(list) ? list : []).forEach(function (item) {
      var k = typeof item === 'string' ? item : item && item.date;
      if (parseKey(k)) seen[k] = true;
    });
    return Object.keys(seen).sort();
  }

  var NOTE_MAX = 120;

  // Short plain-text note for one day: no tags, no control characters, single spaces, at most 120 characters.
  function cleanNote(v) {
    if (typeof v !== 'string') return '';
    var s = v.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    return s.length > NOTE_MAX ? s.slice(0, NOTE_MAX).trim() : s;
  }

  // Notes by date from {date: note} and/or [{date, note}] lists; empty notes are left out.
  function notesOf(list, map) {
    var out = {};
    (Array.isArray(list) ? list : []).forEach(function (item) {
      if (item && typeof item === 'object' && parseKey(item.date)) {
        var n = cleanNote(item.note);
        if (n) out[item.date] = n;
      }
    });
    if (map && typeof map === 'object' && !Array.isArray(map)) {
      Object.keys(map).forEach(function (k) {
        var n = cleanNote(map[k]);
        if (parseKey(k) && n) out[k] = n;
      });
    }
    return out;
  }

  function isOff(day, offs) {
    return offs.indexOf(keyOf(day)) !== -1;
  }

  // A printing day is any day the shop has hours (her regular hours plus holiday closures and special days) that is not a day off.
  function isPrintDay(day, cfg, offs) {
    return !!getCutoff().hoursFor(day, cfg) && !isOff(day, offs || []);
  }

  function nextPrintDay(fromKey, cfg, list) {
    var from = parseKey(fromKey);
    if (!from) return null;
    var offs = normalize(list);
    for (var i = 1; i <= LOOKAHEAD; i++) {
      var d = addDays(from, i);
      if (isPrintDay(d, cfg, offs)) return keyOf(d);
    }
    return null;
  }

  // The day an order placed at `now` gets printed: today if it is a printing day and the cutoff (or closing time) has not passed, otherwise the next printing day.
  function printDayFor(now, cfg, list) {
    var cut = getCutoff();
    var offs = normalize(list);
    var p = cut.zoneParts(now instanceof Date ? now : new Date(now), cfg.timeZone);
    var today = { y: p.y, m: p.m, d: p.d, wd: p.wd };
    var h = cut.hoursFor(today, cfg);
    if (h && !isOff(today, offs)) {
      var last = (h.cutoff || h.close).split(':');
      if (p.h * 60 + p.mi < +last[0] * 60 + +last[1]) return keyOf(today);
    }
    return nextPrintDay(keyOf(today), cfg, offs);
  }

  // Banner shows from `windowDays` days before a day off through the day off itself (Chicago calendar days).
  // The owner's note for that day (opts.notes {date: note}, or note fields in the list) follows the standard sentence.
  function banner(now, cfg, list, opts) {
    var cut = getCutoff();
    var windowDays = opts && opts.windowDays != null ? opts.windowDays : 3;
    var offs = normalize(list);
    if (!offs.length) return null;
    var date = now instanceof Date ? now : new Date(now);
    var p = cut.zoneParts(date, cfg.timeZone);
    var today = { y: p.y, m: p.m, d: p.d, wd: p.wd };
    for (var i = 0; i <= windowDays; i++) {
      var day = addDays(today, i);
      if (!isOff(day, offs)) continue;
      var nextKey = nextPrintDay(keyOf(day), cfg, offs);
      var next = parseKey(nextKey);
      var printsOn = printDayFor(date, cfg, offs);
      var normally = printDayFor(date, cfg, []);
      var placedNow = i === 0 || (normally && offs.indexOf(normally) !== -1 && printsOn === nextKey);
      var when = i === 0 ? 'today, ' + label(day) : label(day);
      var after = next
        ? (placedNow ? 'Orders placed now still go through and print ' : 'Orders placed that day still go through and print ') + label(next) + '.'
        : 'Orders still go through and print on our next open day.';
      var note = notesOf(list, opts && opts.notes)[keyOf(day)] || '';
      var message = 'Heads up: we\'re not printing ' + when + '. ' + after;
      return {
        date: keyOf(day),
        dateLabel: label(day),
        isToday: i === 0,
        nextPrint: nextKey,
        nextPrintLabel: next ? label(next) : null,
        note: note || null,
        message: note ? message + ' ' + note : message
      };
    }
    return null;
  }

  return {
    normalize: normalize,
    cleanNote: cleanNote,
    notesOf: notesOf,
    parseKey: parseKey,
    keyOf: keyOf,
    addDays: addDays,
    label: label,
    isPrintDay: isPrintDay,
    nextPrintDay: nextPrintDay,
    printDayFor: printDayFor,
    banner: banner
  };
});

;
(function () {
  'use strict';
  var MM = window.MM;
  if (!MM || !MM.cutoff || !MM.daysOff) return;
  var root = document.documentElement;
  if (root.hasAttribute('data-days-off-on')) return;
  root.setAttribute('data-days-off-on', '');

  var cfg = MM.config || {};
  var schedule = cfg.schedule || MM.cutoff.DEFAULT_CONFIG;
  var src = cfg.daysOff || (/(^|\.)mandmvinyl\.com$/.test(location.hostname) ? { url: '/wp-json/mm/v1/days-off' } : {});
  var now = function () {
    return MM.cutoff.now ? MM.cutoff.now() : new Date();
  };

  function ready(fn) {
    if (MM.ready) return MM.ready(fn);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  // Example dates for non-store builds: ?dayoff=YYYY-MM-DD, otherwise the next Saturday.
  function exampleDates() {
    var q = null;
    try {
      q = new URLSearchParams(location.search).get('dayoff');
    } catch (e) {}
    if (q) return q.split(',');
    var p = MM.cutoff.zoneParts(now(), schedule.timeZone);
    var today = { y: p.y, m: p.m, d: p.d, wd: p.wd };
    return [MM.daysOff.keyOf(MM.daysOff.addDays(today, (6 - today.wd + 7) % 7))];
  }

  function load() {
    if (src.url && window.fetch) {
      return fetch(src.url, { credentials: 'omit', headers: { Accept: 'application/json' } })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (j) {
          return { dates: (j && j.dates) || [], notes: (j && j.notes) || {} };
        })
        .catch(function () {
          return { dates: [], notes: {} };
        });
    }
    return Promise.resolve({ dates: src.sample ? exampleDates() : [], notes: {} });
  }

  function slot() {
    var el = document.querySelector('[data-days-off]');
    if (el || document.querySelector('[data-od]')) return el;
    var bar = document.querySelector('.announce');
    el = document.createElement('p');
    el.className = 'dayoff' + (bar ? '' : ' dayoff--top');
    el.setAttribute('data-days-off', '');
    if (!document.querySelector('link[href*="css/site.css"]')) {
      el.style.cssText = 'margin:0;padding:.6rem 1rem;background:#92D1A9;color:#060606;border-bottom:1px solid #000;font:600 15px/1.4 Inter,system-ui,-apple-system,sans-serif;text-align:center;';
    }
    if (bar) bar.insertBefore(el, bar.firstChild);
    else document.body.insertBefore(el, document.body.firstChild);
    return el;
  }

  function render(dates, notes) {
    schedule.noPrintDates = dates;
    if (MM.cutoff.refresh) MM.cutoff.refresh();
    var b = MM.daysOff.banner(now(), schedule, dates, { windowDays: src.sample ? 6 : 3, notes: notes });
    var el = document.querySelector('[data-days-off]');
    if (!b) {
      if (el) el.hidden = true;
      root.removeAttribute('data-day-off');
      return;
    }
    el = el || slot();
    if (!el) return;
    el.textContent = '';
    if (src.label) {
      var tag = document.createElement('span');
      tag.className = 'dayoff__tag';
      tag.textContent = src.label;
      el.appendChild(tag);
    }
    var msg = document.createElement('span');
    msg.className = 'dayoff__msg';
    msg.textContent = b.message;
    el.appendChild(msg);
    el.hidden = false;
    root.setAttribute('data-day-off', b.isToday ? 'today' : 'soon');
  }

  ready(function () {
    load().then(function (res) {
      var dates = MM.daysOff.normalize(res.dates);
      var notes = MM.daysOff.notesOf(res.dates, res.notes);
      render(dates, notes);
      setInterval(function () {
        render(dates, notes);
      }, 60000);
    });
  });
})();

})();
