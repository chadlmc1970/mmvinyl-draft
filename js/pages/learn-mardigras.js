(function () {
  'use strict';
  var MM = window.MM;
  var FAT = Date.UTC(2027, 1, 9) / 86400000;
  var DAY = 86400000;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function toDate(n) {
    return new Date(n * DAY);
  }
  function dow(n) {
    return toDate(n).getUTCDay();
  }
  function label(n, withDow) {
    var d = toDate(n);
    return (withDow ? DOW[d.getUTCDay()] + ', ' : '') + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + (withDow ? '' : '');
  }
  function fullLabel(n) {
    return DOW[dow(n)] + ', ' + MONTHS[toDate(n).getUTCMonth()] + ' ' + toDate(n).getUTCDate() + ', ' + toDate(n).getUTCFullYear();
  }
  function parseISO(s) {
    var p = (s || '').split('-');
    if (p.length !== 3) return NaN;
    return Date.UTC(+p[0], +p[1] - 1, +p[2]) / DAY;
  }
  function openDay(n) {
    while (dow(n) === 0) n -= 1;
    return n;
  }

  var today = MM.learn.today();

  function countdown() {
    var days = FAT - today;
    var el = MM.$('[data-cd-days]');
    var open = 0;
    for (var d = today; d < FAT; d++) if (dow(d) !== 0) open++;
    MM.$('[data-cd-open]').textContent = open;
    var target = Math.max(0, days);
    if (reduce) {
      el.textContent = target;
      return;
    }
    var start = null;
    function tick(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / 1200);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  var planEl = MM.$('[data-plan]');
  var calEl = MM.$('[data-calendars]');
  var inDeadline = MM.$('[data-deadline]');
  var inBuffer = MM.$('[data-buffer]');
  var inPress = MM.$('[data-press]');
  var inArt = MM.$('[data-art]');

  function num(el, def) {
    var v = parseInt(el.value, 10);
    return isNaN(v) || v < 0 ? def : v;
  }

  function compute() {
    var deadline = parseISO(inDeadline.value);
    if (isNaN(deadline)) deadline = FAT;
    var buffer = num(inBuffer, 0);
    var press = num(inPress, 0);
    var art = num(inArt, 0);
    var finishPress = deadline - buffer;
    var startPress = openDay(finishPress - press);
    var orderSheets = openDay(startPress - 1);
    var startArt = openDay(orderSheets - art);
    return [
      { key: 'art', title: 'Start art and gather orders', date: startArt, note: 'Finish your files with the checklist, and collect your customers\' orders.' },
      { key: 'order', title: 'Order your gang sheets by', date: orderSheets, note: 'Order by 2 PM Monday to Friday or 10 AM Saturday to print the same day.' },
      { key: 'press', title: 'Start pressing', date: startPress, note: 'Pickup the day before if you can.' },
      { key: 'finish', title: 'Finish pressing', date: finishPress, note: buffer ? buffer + ' day' + (buffer === 1 ? '' : 's') + ' of buffer left for fixes.' : 'No buffer. Add a day or two.' },
      { key: 'done', title: 'Customers have their shirts', date: deadline, note: deadline === FAT ? 'Fat Tuesday.' : 'Your deadline.' }
    ];
  }

  function renderPlan(steps) {
    planEl.innerHTML = steps
      .map(function (s) {
        var diff = s.date - today;
        var when = diff > 0 ? 'in ' + diff + (diff === 1 ? ' day' : ' days') : diff === 0 ? 'today' : Math.abs(diff) + (Math.abs(diff) === 1 ? ' day' : ' days') + ' ago';
        var late = diff < 0 ? ' is-late' : '';
        return (
          '<li class="lr-plan__item lr-plan__item--' + s.key + late + '"><span class="lr-plan__date">' + MM.esc(fullLabel(s.date)) + '</span><div><strong>' + MM.esc(s.title) + '</strong><span>' + MM.esc(s.note) + '</span></div><span class="lr-plan__when">' + when + '</span></li>'
        );
      })
      .join('');
    var late = steps.some(function (s) {
      return s.date < today && s.key !== 'art';
    });
    if (late) planEl.insertAdjacentHTML('afterbegin', '<li class="lr-plan__warn" role="alert">One or more dates are already past. Move your deadline out, or shorten the days you need.</li>');
  }

  function renderCalendars(steps) {
    var min = Math.min.apply(null, steps.map(function (s) { return s.date; }).concat([today]));
    var max = Math.max.apply(null, steps.map(function (s) { return s.date; }));
    var first = toDate(min);
    var last = toDate(max);
    var months = [];
    var y = first.getUTCFullYear();
    var m = first.getUTCMonth();
    while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
      months.push([y, m]);
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    var mark = {};
    function set(n, cls) {
      mark[n] = (mark[n] || '') + ' ' + cls;
    }
    steps.forEach(function (s) {
      if (s.key === 'order') set(s.date, 'is-order');
      if (s.key === 'done') set(s.date, 'is-done');
    });
    var ps = steps.filter(function (s) { return s.key === 'press'; })[0].date;
    var pf = steps.filter(function (s) { return s.key === 'finish'; })[0].date;
    for (var d = ps; d <= pf; d++) set(d, 'is-press');
    set(FAT, 'is-fat');
    set(today, 'is-today');

    calEl.innerHTML = months
      .map(function (mm) {
        var startN = Date.UTC(mm[0], mm[1], 1) / DAY;
        var daysIn = new Date(Date.UTC(mm[0], mm[1] + 1, 0)).getUTCDate();
        var html = '<div class="lr-month"><p class="lr-month__name">' + MONTHS[mm[1]] + ' ' + mm[0] + '</p><div class="lr-month__grid" role="grid" aria-label="' + MONTHS[mm[1]] + ' ' + mm[0] + '">';
        DOW.forEach(function (d) {
          html += '<span class="lr-month__dow" role="columnheader">' + d.charAt(0) + '<span class="sr-only">' + d.slice(1) + '</span></span>';
        });
        for (var i = 0; i < dow(startN); i++) html += '<span class="lr-day lr-day--blank" aria-hidden="true"></span>';
        for (var day = 1; day <= daysIn; day++) {
          var n = startN + day - 1;
          var cls = 'lr-day' + (dow(n) === 0 ? ' is-closed' : '') + (mark[n] || '');
          var tip = [];
          if (mark[n] && mark[n].indexOf('is-order') > -1) tip.push('order sheets');
          if (mark[n] && mark[n].indexOf('is-press') > -1) tip.push('pressing');
          if (mark[n] && mark[n].indexOf('is-done') > -1) tip.push('deadline');
          if (n === FAT) tip.push('Fat Tuesday');
          if (n === today) tip.push('today');
          if (dow(n) === 0) tip.push('shop closed');
          html += '<span class="' + cls + '" role="gridcell"' + (tip.length ? ' title="' + tip.join(', ') + '"' : '') + '>' + day + (tip.length ? '<span class="sr-only">, ' + tip.join(', ') + '</span>' : '') + '</span>';
        }
        return html + '</div></div>';
      })
      .join('');
  }

  function update() {
    var steps = compute();
    renderPlan(steps);
    renderCalendars(steps);
  }

  [inDeadline, inBuffer, inPress, inArt].forEach(function (i) {
    i.addEventListener('input', update);
  });
  MM.$('[data-plan-form]').addEventListener('submit', function (e) {
    e.preventDefault();
  });
  countdown();
  update();
})();
