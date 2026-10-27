(function () {
  'use strict';
  var MM = window.MM;

  function chicagoToday() {
    var tz = (MM.config.schedule || {}).timeZone || 'America/Chicago';
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-');
    return Date.UTC(+parts[0], +parts[1] - 1, +parts[2]) / 86400000;
  }

  MM.learn = { today: chicagoToday };

  function initPrint() {
    MM.$$('[data-print]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.print();
      });
    });
  }

  function initFilter() {
    var grid = MM.$('[data-grid]');
    if (!grid) return;
    var cards = MM.$$('.lr-card', grid);
    var chips = MM.$$('[data-cat]');
    var search = MM.$('[data-search]');
    var count = MM.$('[data-guide-count]');
    var empty = MM.$('[data-empty]');
    var cat = 'all';

    function apply() {
      var q = search.value.trim().toLowerCase();
      var words = q ? q.split(/\s+/) : [];
      var shown = 0;
      cards.forEach(function (c) {
        var hay = (c.getAttribute('data-text') + ' ' + c.textContent).toLowerCase();
        var okCat = cat === 'all' || c.getAttribute('data-cats').indexOf(cat) > -1;
        var okQ = words.every(function (w) {
          return hay.indexOf(w) > -1;
        });
        var show = okCat && okQ;
        c.hidden = !show;
        if (show) shown++;
      });
      count.textContent = shown + (shown === 1 ? ' guide' : ' guides');
      empty.hidden = shown > 0;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        cat = chip.getAttribute('data-cat');
        chips.forEach(function (c) {
          c.setAttribute('aria-pressed', c === chip ? 'true' : 'false');
        });
        apply();
      });
    });
    search.addEventListener('input', apply);
    apply();

    var fat = MM.$('[data-fat-days]');
    if (fat) {
      var days = Date.UTC(2027, 1, 9) / 86400000 - chicagoToday();
      if (days > 0) fat.textContent = days + ' days to Fat Tuesday';
      else if (days === 0) fat.textContent = 'Fat Tuesday is today';
    }
  }

  MM.ready(function () {
    initPrint();
    initFilter();
  });
})();
