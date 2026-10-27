(function () {
  'use strict';
  var MM = window.MM;
  if (!MM || !MM.cutoff) return;

  var cfg = MM.config.schedule || MM.cutoff.DEFAULT_CONFIG;
  var tz = cfg.timeZone || 'America/Chicago';
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var clockFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' });

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function short(str) {
    return MM.cutoff.formatTime(str).replace(':00', '');
  }

  function mins(str) {
    var a = str.split(':');
    return +a[0] * 60 + +a[1];
  }

  function todaySchedule(p) {
    var key = p.y + '-' + pad(p.m) + '-' + pad(p.d);
    if (cfg.closedDates && cfg.closedDates.indexOf(key) !== -1) return null;
    return cfg.days[String(p.wd)] || null;
  }

  function nextOpen(p) {
    for (var i = 1; i <= 7; i++) {
      var wd = (p.wd + i) % 7;
      var s = cfg.days[String(wd)];
      if (s) return { label: (i === 1 ? 'tomorrow' : DAY_NAMES[wd]) + ' at ' + short(s.open) };
    }
    return null;
  }

  function status(p) {
    var sched = todaySchedule(p);
    var now = p.h * 60 + p.mi;
    if (sched) {
      var open = mins(sched.open);
      var close = mins(sched.close);
      if (now >= open && now < close) {
        var left = close - now;
        return {
          tone: left <= 30 ? 'warn' : 'ok',
          pill: left <= 30 ? 'Closing soon' : 'Open now',
          text: 'Closes at ' + short(sched.close)
        };
      }
      if (now < open) return { tone: 'late', pill: 'Closed now', text: 'Opens today at ' + short(sched.open) };
    }
    var next = nextOpen(p);
    return { tone: 'late', pill: sched ? 'Closed now' : 'Closed today', text: next ? 'Opens ' + next.label : 'Call us for the next day we are open' };
  }

  function render() {
    var now = new Date();
    var p = MM.cutoff.zoneParts(now, tz);
    var st = status(p);

    MM.$$('[data-chicago-now]').forEach(function (el) {
      el.textContent = clockFmt.format(now);
    });

    MM.$$('[data-open-status]').forEach(function (el) {
      el.innerHTML = '<span class="status status--' + st.tone + '">' + st.pill + '</span> <span class="story-status-text">' + st.text + '</span>';
    });

    MM.$$('[data-open-status-text]').forEach(function (el) {
      el.textContent = st.pill + '. ' + st.text + '.';
    });

    MM.$$('[data-hours] tr[data-day]').forEach(function (row) {
      var isToday = +row.getAttribute('data-day') === p.wd;
      row.classList.toggle('is-today', isToday);
      if (isToday) row.setAttribute('aria-current', 'date');
      else row.removeAttribute('aria-current');
    });

    MM.$$('[data-today-note]').forEach(function (el) {
      el.textContent = 'Today is ' + DAY_NAMES[p.wd] + ', highlighted in mint.';
    });

    MM.$$('[data-cutoff-card]').forEach(function (el) {
      var k = el.getAttribute('data-cutoff-card');
      var match = (k === 'weekday' && p.wd >= 1 && p.wd <= 5) || (k === 'saturday' && p.wd === 6) || (k === 'sunday' && p.wd === 0);
      el.classList.toggle('is-today', match);
    });
  }

  MM.ready(function () {
    render();
    setInterval(render, 20000);
  });
})();
