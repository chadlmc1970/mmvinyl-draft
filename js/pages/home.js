(function () {
  'use strict';
  var MM = window.MM;
  if (!MM || !MM.cutoff) return;

  var cfg = (MM.config && MM.config.schedule) || MM.cutoff.DEFAULT_CONFIG;
  var tz = cfg.timeZone || 'America/Chicago';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  var frozen = null;
  try {
    var q = new URLSearchParams(location.search).get('now');
    if (q) {
      var t = new Date(q).getTime();
      if (!isNaN(t)) frozen = { base: t, start: Date.now() };
    }
  } catch (e) {}

  function now() {
    return frozen ? new Date(frozen.base + (Date.now() - frozen.start)) : new Date();
  }

  if (frozen) {
    var original = MM.cutoff.getStatus;
    MM.cutoff.getStatus = function (d, c) {
      return original(now(), c);
    };
    if (MM.cutoff.refresh) MM.cutoff.refresh();
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function hm(str) {
    var a = str.split(':');
    return { h: +a[0], mi: +a[1] };
  }

  function shortTime(str) {
    return MM.cutoff.formatTime(str).replace(':00', '');
  }

  function dayLabel(i, wd) {
    return i === 0 ? 'today' : i === 1 ? 'tomorrow' : WEEKDAYS[wd];
  }

  function nextWindow(date) {
    var p = MM.cutoff.zoneParts(date, tz);
    for (var i = 0; i <= 8; i++) {
      var t = new Date(Date.UTC(p.y, p.m - 1, p.d + i));
      var y = t.getUTCFullYear();
      var m = t.getUTCMonth() + 1;
      var d = t.getUTCDate();
      var wd = t.getUTCDay();
      var key = y + '-' + pad(m) + '-' + pad(d);
      if (cfg.closedDates && cfg.closedDates.indexOf(key) !== -1) continue;
      var s = cfg.days[String(wd)];
      if (!s) continue;
      var c = hm(s.cutoff);
      var o = hm(s.open);
      var cl = hm(s.close);
      var cutoffAt = MM.cutoff.zonedToUtc(y, m, d, c.h, c.mi, tz);
      var closeAt = MM.cutoff.zonedToUtc(y, m, d, cl.h, cl.mi, tz);
      var openAt = MM.cutoff.zonedToUtc(y, m, d, o.h, o.mi, tz);
      if (i === 0 && closeAt <= date.getTime() && cutoffAt <= date.getTime()) continue;
      return { i: i, wd: wd, sched: s, cutoffAt: cutoffAt, openAt: openAt, closeAt: closeAt };
    }
    return null;
  }

  /* Live cutoff clock */
  var ticket = MM.$('#home-ticket');
  if (ticket) {
    var cd = MM.$('#home-cd');
    var cdl = MM.$('#home-cdl');
    var msg = MM.$('#home-msg');
    var ring = MM.$('#home-ring');
    var ringLabel = MM.$('#home-ring-label');
    var sr = MM.$('#home-srmsg');
    var lastMin = -1;

    var tickClock = function () {
      var date = now();
      var next = null;
      var p = MM.cutoff.zoneParts(date, tz);
      for (var i = 0; i <= 8 && !next; i++) {
        var t = new Date(Date.UTC(p.y, p.m - 1, p.d + i));
        var y = t.getUTCFullYear();
        var m = t.getUTCMonth() + 1;
        var d = t.getUTCDate();
        var wd = t.getUTCDay();
        if (cfg.closedDates && cfg.closedDates.indexOf(y + '-' + pad(m) + '-' + pad(d)) !== -1) continue;
        var s = cfg.days[String(wd)];
        if (!s) continue;
        var c = hm(s.cutoff);
        var cutoffAt = MM.cutoff.zonedToUtc(y, m, d, c.h, c.mi, tz);
        if (cutoffAt > date.getTime()) {
          var o = hm(s.open);
          next = { i: i, wd: wd, sched: s, cutoffAt: cutoffAt, openAt: MM.cutoff.zonedToUtc(y, m, d, o.h, o.mi, tz) };
        }
      }
      if (!next) return;
      var left = Math.max(0, Math.floor((next.cutoffAt - date.getTime()) / 1000));
      var h = Math.floor(left / 3600);
      var mi = Math.floor((left % 3600) / 60);
      var sec = left % 60;
      var isOpen = next.i === 0;
      var status = MM.cutoff.getStatus(date, cfg);
      cd.textContent = h + ':' + pad(mi) + ':' + pad(sec);
      cdl.textContent = isOpen ? "until today's cutoff" : 'until ' + (next.i === 1 ? "tomorrow's" : WEEKDAYS[next.wd] + "'s") + ' cutoff';
      if (ringLabel) ringLabel.textContent = shortTime(next.sched.cutoff);
      var frac = isOpen ? Math.min(1, Math.max(0, (next.cutoffAt - date.getTime()) / (next.cutoffAt - next.openAt))) : 0;
      if (ring) ring.style.strokeDashoffset = (201.06 * (1 - frac)).toFixed(2);
      msg.textContent = isOpen ? 'Order now for same-day printing.' : 'Cutoff passed. Next window opens ' + (status.nextOpenLabel || dayLabel(next.i, next.wd)) + '.';
      ticket.classList.toggle('is-closed', !isOpen);
      if (mi !== lastMin) {
        lastMin = mi;
        sr.textContent = isOpen ? h + ' hours ' + mi + ' minutes until the same-day cutoff.' : msg.textContent;
      }
    };
    tickClock();
    setInterval(tickClock, 1000);
  }

  /* Open now state on the visit strip */
  var openEl = MM.$('#home-open');
  if (openEl) {
    var openText = MM.$('#home-open-text');
    var tickOpen = function () {
      var date = now();
      var w = nextWindow(date);
      if (!w) return;
      var t = date.getTime();
      if (w.i === 0 && t >= w.openAt && t < w.closeAt) {
        openEl.setAttribute('data-open', 'yes');
        openText.textContent = 'Open now, until ' + shortTime(w.sched.close);
      } else {
        openEl.setAttribute('data-open', 'no');
        openText.textContent = 'Closed now, opens ' + dayLabel(w.i, w.wd) + ' ' + shortTime(w.sched.open);
      }
    };
    tickOpen();
    setInterval(tickOpen, 30000);
  }

  /* Three doors: swap the one-line promise on hover and focus */
  var line = MM.$('#home-door-line');
  if (line) {
    var def = line.getAttribute('data-default') || line.textContent;
    MM.$$('.home-door').forEach(function (a) {
      var set = function () {
        line.textContent = a.getAttribute('data-line') || def;
      };
      var reset = function () {
        line.textContent = def;
      };
      a.addEventListener('pointerenter', set);
      a.addEventListener('focus', set);
      a.addEventListener('pointerleave', reset);
      a.addEventListener('blur', reset);
    });
  }

  /* Gang sheet film: cursor tilt (desktop only) and replay */
  var scene = MM.$('#home-scene');
  var stage = MM.$('#home-stage');
  var tiles = MM.$('#home-tiles');
  var head = MM.$('#home-head');
  if (scene && stage && !reduce && fine) {
    var raf = 0;
    var rx = 0;
    var ry = 0;
    scene.addEventListener('pointermove', function (e) {
      var r = scene.getBoundingClientRect();
      ry = ((e.clientX - r.left) / r.width - 0.5) * 9;
      rx = -((e.clientY - r.top) / r.height - 0.5) * 7;
      if (!raf) {
        raf = requestAnimationFrame(function () {
          raf = 0;
          stage.style.setProperty('--rx', rx.toFixed(2) + 'deg');
          stage.style.setProperty('--ry', ry.toFixed(2) + 'deg');
        });
      }
    });
    scene.addEventListener('pointerleave', function () {
      stage.style.setProperty('--rx', '0deg');
      stage.style.setProperty('--ry', '0deg');
    });
  }
  var replay = MM.$('[data-home-replay]');
  if (replay && tiles && head) {
    replay.addEventListener('click', function () {
      if (reduce) return;
      [tiles, head].forEach(function (el) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
    });
  }

  /* Bento cursor spotlight */
  if (fine && !reduce) {
    MM.$$('[data-spot]').forEach(function (tile) {
      tile.addEventListener('pointermove', function (e) {
        var r = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', e.clientX - r.left + 'px');
        tile.style.setProperty('--my', e.clientY - r.top + 'px');
      });
    });
  }

  /* Mardi Gras band: day countdown and the print pass when it scrolls into view */
  var mgDays = MM.$('#home-mg-days');
  if (mgDays) {
    var target = (mgDays.getAttribute('data-date') || '').split('-');
    var unitEl = MM.$('#home-mg-unit');
    var srEl = MM.$('#home-mg-sr');
    if (target.length === 3) {
      var pn = MM.cutoff.zoneParts(now(), tz);
      var days = Math.round((Date.UTC(+target[0], +target[1] - 1, +target[2]) - Date.UTC(pn.y, pn.m - 1, pn.d)) / 86400000);
      if (days > 0) {
        mgDays.textContent = days + (days === 1 ? ' day' : ' days');
        unitEl.textContent = 'until Fat Tuesday, Feb 9, 2027';
        srEl.textContent = days + (days === 1 ? ' day' : ' days') + ' until Fat Tuesday, February 9, 2027.';
      } else if (days === 0) {
        mgDays.textContent = 'Today';
        unitEl.textContent = 'is Fat Tuesday';
        srEl.textContent = 'Fat Tuesday is today.';
      }
    }
  }
  var mgFilm = MM.$('#home-mgfilm');
  if (mgFilm) {
    var play = function () {
      mgFilm.classList.add('is-in');
    };
    if (reduce || !('IntersectionObserver' in window)) {
      play();
    } else {
      var mgIo = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) {
            play();
            mgIo.disconnect();
          }
        },
        { threshold: 0.35 }
      );
      mgIo.observe(mgFilm);
    }
  }
})();
