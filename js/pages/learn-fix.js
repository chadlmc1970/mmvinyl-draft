(function () {
  'use strict';
  var MM = window.MM;

  function initPrintOne() {
    var target = null;
    function clear() {
      document.body.classList.remove('fx-print-one');
      if (target) target.classList.remove('fx-print-target');
      target = null;
    }
    MM.$$('[data-fx-print]').forEach(function (b) {
      b.addEventListener('click', function () {
        clear();
        target = MM.$(b.getAttribute('data-fx-print'));
        if (!target) return MM.printPage();
        document.body.classList.add('fx-print-one');
        target.classList.add('fx-print-target');
        MM.printPage();
      });
    });
    window.addEventListener('afterprint', clear);
  }

  function initFinder() {
    var root = MM.$('[data-finder]');
    if (!root) return;
    var whenChips = MM.$$('[data-when]', MM.$('[data-finder-when]', root));
    var step2 = MM.$('[data-finder-step2]', root);
    var looks = MM.$('[data-finder-looks]', root);
    var result = MM.$('[data-finder-result]', root);
    var foot = MM.$('[data-finder-foot]', root);
    var syms = MM.$$('[data-sym]');

    function press(chips, active) {
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c === active ? 'true' : 'false');
      });
    }

    function show(sym) {
      var body = MM.$('.fx-sym__body', sym).cloneNode(true);
      var icon = MM.$('.fx-sym__icon', sym).cloneNode(true);
      var title = MM.$('h3', body);
      var card = document.createElement('div');
      card.className = 'fx-sym fx-sym--result';
      title.removeAttribute('id');
      title.setAttribute('tabindex', '-1');
      card.appendChild(icon);
      card.appendChild(body);
      result.innerHTML = '';
      result.appendChild(card);
      foot.hidden = false;
      title.focus({ preventScroll: true });
      if (card.getBoundingClientRect().top > window.innerHeight * 0.6) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function pickWhen(chip) {
      var when = chip.getAttribute('data-when');
      press(whenChips, chip);
      looks.innerHTML = '';
      result.innerHTML = '';
      foot.hidden = true;
      var matches = syms.filter(function (s) {
        return (' ' + s.getAttribute('data-when') + ' ').indexOf(' ' + when + ' ') > -1;
      });
      var lookChips = matches.map(function (s) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.setAttribute('aria-pressed', 'false');
        b.textContent = MM.$('h3', s).textContent;
        b.addEventListener('click', function () {
          press(lookChips, b);
          show(s);
        });
        looks.appendChild(b);
        return b;
      });
      step2.hidden = false;
      if (lookChips.length) lookChips[0].focus({ preventScroll: true });
    }

    whenChips.forEach(function (c) {
      c.addEventListener('click', function () {
        pickWhen(c);
      });
    });

    MM.$('[data-finder-reset]', root).addEventListener('click', function () {
      press(whenChips, null);
      looks.innerHTML = '';
      result.innerHTML = '';
      step2.hidden = true;
      foot.hidden = true;
      whenChips[0].focus();
    });
  }

  MM.ready(function () {
    initPrintOne();
    initFinder();
  });
})();
