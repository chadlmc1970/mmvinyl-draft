(function () {
  'use strict';
  var MM = window.MM;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setHeaderOffset() {
    var header = MM.$('.site-header');
    if (!header) return;
    function apply() {
      var top = parseFloat(getComputedStyle(header).top) || 0;
      document.documentElement.style.setProperty('--rs-top', Math.max(0, header.getBoundingClientRect().height + top) + 'px');
    }
    apply();
    if ('ResizeObserver' in window) new ResizeObserver(apply).observe(header);
    window.addEventListener('resize', apply);
  }

  function initSubnav() {
    var nav = MM.$('[data-subnav]');
    if (!nav) return;
    var links = MM.$$('a[href^="#"]', nav);
    var map = [];
    links.forEach(function (a) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) map.push({ a: a, el: target });
    });
    function update() {
      var offset = (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + 8;
      var current = null;
      map.forEach(function (m) {
        if (m.el.getBoundingClientRect().top - offset <= 0) current = m;
      });
      map.forEach(function (m) {
        if (m === current) m.a.setAttribute('aria-current', 'true');
        else m.a.removeAttribute('aria-current');
      });
      if (current) {
        var list = current.a.parentNode.parentNode;
        var left = current.a.offsetLeft - list.clientWidth / 2 + current.a.offsetWidth / 2;
        if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
      }
    }
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }, { passive: true });
    update();
  }

  function fieldOf(el) {
    return el.closest('.field') || el.closest('.rs-fieldset');
  }

  function showError(input, errId, on) {
    var err = document.getElementById(errId);
    if (!err) return;
    err.hidden = !on;
    var f = fieldOf(input);
    if (f) f.classList.toggle('has-error', on);
    if (input.setAttribute) input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }

  function initForm() {
    var form = MM.$('[data-apply-form]');
    if (!form) return;
    function el(n) {
      return form.elements.namedItem(n);
    }

    function collect() {
      return {
        business: el('business').value.trim(),
        name: el('name').value.trim(),
        email: el('email').value.trim(),
        phone: el('phone').value.trim(),
        press: MM.$$('input[name="press"]:checked', form).map(function (i) {
          return i.value;
        }),
        pressOther: el('pressOther').value.trim()
      };
    }

    function validate(data) {
      var ok = true;
      var first = null;
      function check(cond, input, errId) {
        showError(input, errId, !cond);
        if (!cond) {
          ok = false;
          if (!first) first = input;
        }
      }
      check(!!data.business, el('business'), 'biz-name-err');
      check(!!data.name, el('name'), 'contact-name-err');
      check(/^\S+@\S+\.\S+$/.test(data.email), el('email'), 'contact-email-err');
      var pressOk = data.press.length > 0 || !!data.pressOther;
      document.getElementById('press-err').hidden = pressOk;
      if (!pressOk) {
        ok = false;
        if (!first) first = MM.$('input[name="press"]', form);
      }
      if (first) first.focus();
      return ok;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = collect();
      if (!validate(data)) return;
      var lines = [
        'Hello M&M Vinyl,',
        '',
        'I would like to set up reseller pricing.',
        '',
        'Business: ' + data.business,
        'Name: ' + data.name,
        'Email: ' + data.email
      ];
      if (data.phone) lines.push('Phone: ' + data.phone);
      if (data.press.length) lines.push('I press: ' + data.press.join(', '));
      if (data.pressOther) lines.push('Other: ' + data.pressOther);
      lines.push('', 'I will email my resale or tax-exempt certificate after you reply.');
      window.location.href = MM.mailto('Reseller pricing: ' + data.business, lines);
    });

    MM.$$('input, textarea', form).forEach(function (i) {
      i.addEventListener('input', function () {
        if (i.name === 'business') showError(i, 'biz-name-err', false);
        if (i.name === 'name') showError(i, 'contact-name-err', false);
        if (i.name === 'email') showError(i, 'contact-email-err', false);
        if (i.name === 'press' || i.name === 'pressOther') document.getElementById('press-err').hidden = true;
      });
    });
  }

  MM.ready(function () {
    setHeaderOffset();
    initSubnav();
    initForm();
  });
})();
