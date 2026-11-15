(function () {
  'use strict';
  var MM = window.MM;

  function initPrintOnly() {
    MM.$$('[data-print-only]').forEach(function (b) {
      b.addEventListener('click', function () {
        var target = MM.$(b.getAttribute('data-print-only'));
        if (!target) return;
        document.body.classList.add('mt-print-only');
        target.classList.add('mt-print-target');
        MM.printPage();
      });
    });
    window.addEventListener('afterprint', function () {
      document.body.classList.remove('mt-print-only');
      MM.$$('.mt-print-target').forEach(function (el) {
        el.classList.remove('mt-print-target');
      });
    });
  }

  function initPicker() {
    var form = MM.$('[data-picker]');
    if (!form) return;
    var qColor = MM.$('[data-q="color"]', form);
    var qDesign = MM.$('[data-q="design"]', form);
    var hint = MM.$('[data-pick-hint]', form);
    var results = MM.$$('[data-pick]', form);

    function val(name) {
      var el = MM.$('input[name="' + name + '"]:checked', form);
      return el ? el.value : '';
    }

    function pick(fabric, color, design) {
      if (fabric === 'nylon') return 'nylon';
      if (fabric === 'hard') return 'hard';
      if (!fabric || !design) return '';
      if (design === 'texture') return 'texture';
      if (design === 'text') return 'htv';
      if (fabric === 'cotton') return 'dtf';
      if (!color) return '';
      return color === 'light' ? 'sub-shirt' : 'dtf-poly';
    }

    function update() {
      var fabric = val('fabric');
      var color = val('color');
      var design = val('design');
      var garment = fabric === 'cotton' || fabric === 'poly';
      qColor.hidden = !garment;
      qDesign.hidden = !garment;
      var key = pick(fabric, color, design);
      results.forEach(function (r) {
        r.hidden = r.getAttribute('data-pick') !== key;
      });
      if (key) hint.textContent = garment ? 'Here is your pick.' : 'No more questions needed for this one.';
      else if (!fabric) hint.textContent = 'Start with question 1.';
      else if (fabric === 'poly' && !color) hint.textContent = 'Now question 2.';
      else hint.textContent = 'Now question 3.';
      return key;
    }

    form.addEventListener('change', function () {
      var key = update();
      if (!key) return;
      var shown = MM.$('[data-pick="' + key + '"]', form);
      var r = shown.getBoundingClientRect();
      if (r.bottom > window.innerHeight || r.top < 0) shown.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    MM.$('[data-pick-reset]', form).addEventListener('click', function () {
      form.reset();
      update();
      MM.$('input[name="fabric"]', form).focus();
    });
    update();
  }

  MM.ready(function () {
    initPrintOnly();
    initPicker();
  });
})();
