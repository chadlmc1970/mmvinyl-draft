(function () {
  'use strict';
  var MM = window.MM;

  function pressed(chip) {
    return chip.getAttribute('aria-pressed') === 'true';
  }

  function initPicker(root) {
    var chips = MM.$$('[data-pick]', root);
    var sheet = MM.$('[data-card-sheet]', root);
    var status = MM.$('[data-pick-status]', root);
    if (!chips.length || !sheet) return;
    var slots = parseInt(sheet.getAttribute('data-slots'), 10) || 4;
    var src = {};
    MM.$$('[data-card]', sheet).forEach(function (c) {
      src[c.getAttribute('data-card')] = c.cloneNode(true);
    });

    function render() {
      var keys = chips.filter(pressed).map(function (c) {
        return c.getAttribute('data-pick');
      }).filter(function (k) {
        return src[k];
      });
      if (!keys.length) return;
      sheet.innerHTML = '';
      for (var i = 0; i < slots; i++) {
        var card = src[keys[i % keys.length]].cloneNode(true);
        if (i > 0) card.setAttribute('aria-hidden', 'true');
        else card.removeAttribute('aria-hidden');
        sheet.appendChild(card);
      }
      if (status) {
        var names = chips.filter(pressed).map(function (c) {
          return c.textContent.trim();
        });
        status.textContent = keys.length === 1
          ? 'Page shows ' + slots + ' ' + names[0] + ' cards.'
          : 'Page shows ' + names.join(', ') + ', repeated to fill ' + slots + ' cards.';
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var on = pressed(chip);
        if (on && chips.filter(pressed).length === 1) return;
        chip.setAttribute('aria-pressed', on ? 'false' : 'true');
        render();
      });
    });
    render();
  }

  MM.ready(function () {
    MM.$$('[data-cardpick]').forEach(initPicker);
    MM.$$('[data-print-cards]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.body.classList.add('w1-print-cards');
        MM.printPage();
      });
    });
    window.addEventListener('afterprint', function () {
      document.body.classList.remove('w1-print-cards');
    });
  });
})();
