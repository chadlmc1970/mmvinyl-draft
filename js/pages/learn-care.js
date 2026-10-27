(function () {
  'use strict';
  var MM = window.MM;
  var KEY = 'mm.carecard.v1';
  var biz = MM.$('[data-care-biz]');
  var contact = MM.$('[data-care-contact]');
  var extra = MM.$('[data-care-extra]');
  var credit = MM.$('[data-care-credit]');
  var sheet = MM.$('[data-care-sheet]');

  function render() {
    var name = biz.value.trim() || 'Your business name';
    MM.$$('[data-care-biz-out]').forEach(function (el) {
      el.textContent = name;
      el.classList.toggle('is-placeholder', !biz.value.trim());
    });
    MM.$$('[data-care-contact-out]').forEach(function (el) {
      el.textContent = contact.value.trim();
    });
    MM.$$('.lr-card4__extra').forEach(function (el) {
      el.hidden = !extra.checked;
    });
    MM.$$('[data-care-credit-out]').forEach(function (el) {
      el.hidden = !credit.checked;
    });
    MM.store.set(KEY, { biz: biz.value, contact: contact.value, extra: extra.checked, credit: credit.checked });
  }

  var saved = MM.store.get(KEY, null);
  if (saved) {
    biz.value = saved.biz || '';
    contact.value = saved.contact || '';
    extra.checked = saved.extra !== false;
    credit.checked = saved.credit !== false;
  }

  [biz, contact].forEach(function (i) {
    i.addEventListener('input', render);
  });
  [extra, credit].forEach(function (i) {
    i.addEventListener('change', render);
  });
  MM.$('[data-care-reset]').addEventListener('click', function () {
    biz.value = '';
    contact.value = '';
    extra.checked = true;
    credit.checked = true;
    render();
  });
  MM.$$('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () {
      window.print();
    });
  });
  render();
  sheet.classList.add('is-ready');
})();
