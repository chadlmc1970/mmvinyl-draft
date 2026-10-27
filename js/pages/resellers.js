(function () {
  'use strict';
  var MM = window.MM;
  var KEY = 'mm.reseller.application.v1';
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

  function initFinder() {
    var box = MM.$('[data-finder]');
    if (!box) return;
    var answers = {};
    var result = MM.$('[data-finder-result]', box);
    var tiers = MM.$$('[data-tier]');
    function render() {
      tiers.forEach(function (t) {
        t.classList.remove('is-match', 'is-dim');
      });
      if (!answers.cert || !answers.reg) return;
      var pick = 'standard';
      var msg = '';
      if (answers.cert === 'yes' && answers.reg === 'yes') {
        pick = 'volume';
        msg = 'Volume looks like your fit. Apply and tell us how often you order. Reseller works too if you would rather start there.';
      } else if (answers.cert === 'yes') {
        pick = 'reseller';
        msg = 'Reseller is your fit. Apply with your certificate and your price shows after approval.';
      } else {
        pick = 'standard';
        msg = 'Standard works today with no application. Get a resale or tax-exempt certificate and you can apply for Reseller any time.';
      }
      result.textContent = msg;
      tiers.forEach(function (t) {
        var on = t.getAttribute('data-tier') === pick;
        t.classList.toggle('is-match', on);
        t.classList.toggle('is-dim', !on);
      });
    }
    MM.$$('[data-q]', box).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var q = btn.getAttribute('data-q');
        answers[q] = btn.getAttribute('data-a');
        MM.$$('[data-q="' + q + '"]', box).forEach(function (b) {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        render();
      });
    });
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
    var done = MM.$('[data-apply-done]');
    var summary = MM.$('[data-apply-summary]', done);
    var fileInput = MM.$('#cert-file', form);
    var later = MM.$('[data-cert-later]', form);
    var drop = MM.$('[data-drop]', form);
    var dropName = MM.$('[data-drop-name]', form);
    var dropHint = MM.$('[data-drop-hint]', form);
    var certFieldset = fileInput.closest('.rs-fieldset');
    function el(n) {
      return form.elements.namedItem(n);
    }

    function sizeText(n) {
      if (n > 1048576) return (n / 1048576).toFixed(1) + ' MB';
      return Math.max(1, Math.round(n / 1024)) + ' KB';
    }

    function syncFile() {
      var f = fileInput.files && fileInput.files[0];
      drop.classList.toggle('has-file', !!f);
      if (f) {
        dropName.textContent = f.name;
        dropHint.textContent = sizeText(f.size) + ' (not uploaded in this prototype)';
        later.checked = false;
      } else {
        dropName.textContent = 'Choose a file';
        dropHint.textContent = 'PDF, JPG, or PNG';
      }
      showCertError(false);
    }

    function showCertError(on) {
      var err = document.getElementById('cert-err');
      err.hidden = !on;
      certFieldset.classList.toggle('has-error', on);
    }

    fileInput.addEventListener('change', syncFile);
    later.addEventListener('change', function () {
      if (later.checked) {
        fileInput.value = '';
        syncFile();
      }
      showCertError(false);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function () {
        drop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function () {
        drop.classList.remove('is-over');
      });
    });

    function collect() {
      var data = {};
      data.business = el('business').value.trim();
      data.name = el('name').value.trim();
      data.email = el('email').value.trim();
      data.phone = el('phone').value.trim();
      var f = fileInput.files && fileInput.files[0];
      data.certificate = f ? f.name : later.checked ? 'Will send later' : drop.classList.contains('has-file') ? dropName.textContent : '';
      data.press = MM.$$('input[name="press"]:checked', form).map(function (i) {
        return i.value;
      });
      data.pressOther = el('pressOther').value.trim();
      return data;
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
      var certOk = !!data.certificate;
      showCertError(!certOk);
      if (!certOk) {
        ok = false;
        if (!first) first = fileInput;
      }
      var pressOk = data.press.length > 0 || !!data.pressOther;
      document.getElementById('press-err').hidden = pressOk;
      if (!pressOk) {
        ok = false;
        if (!first) first = MM.$('input[name="press"]', form);
      }
      if (first) first.focus();
      return ok;
    }

    function row(label, value) {
      return '<dt>' + MM.esc(label) + '</dt><dd>' + MM.esc(value || 'Not given') + '</dd>';
    }

    function showDone(data, saved) {
      summary.innerHTML =
        row('Business', data.business) +
        row('Certificate', data.certificate) +
        row('Contact', [data.name, data.email, data.phone].filter(Boolean).join(', ')) +
        row('What you press', data.press.concat(data.pressOther ? [data.pressOther] : []).join('; ')) +
        row('Saved', saved);
      form.hidden = true;
      done.hidden = false;
      done.focus({ preventScroll: true });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = collect();
      if (!validate(data)) return;
      var saved = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      data.savedAt = saved;
      MM.store.set(KEY, data);
      showDone(data, saved);
      var card = MM.$('[data-form-card]');
      if (card) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    });

    MM.$$('input, textarea', form).forEach(function (i) {
      i.addEventListener('input', function () {
        if (i.name === 'business') showError(i, 'biz-name-err', false);
        if (i.name === 'name') showError(i, 'contact-name-err', false);
        if (i.name === 'email') showError(i, 'contact-email-err', false);
        if (i.name === 'press' || i.name === 'pressOther') document.getElementById('press-err').hidden = true;
      });
    });

    MM.$('[data-apply-edit]', done).addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      el('business').focus();
    });

    MM.$('[data-apply-clear]', done).addEventListener('click', function () {
      MM.store.remove(KEY);
      form.reset();
      syncFile();
      done.hidden = true;
      form.hidden = false;
      MM.toast('Saved application cleared');
    });

    var saved = MM.store.get(KEY, null);
    if (saved && saved.business) {
      el('business').value = saved.business;
      el('name').value = saved.name || '';
      el('email').value = saved.email || '';
      el('phone').value = saved.phone || '';
      el('pressOther').value = saved.pressOther || '';
      MM.$$('input[name="press"]', form).forEach(function (i) {
        i.checked = (saved.press || []).indexOf(i.value) > -1;
      });
      if (saved.certificate === 'Will send later') later.checked = true;
      else if (saved.certificate) {
        dropName.textContent = saved.certificate;
        dropHint.textContent = 'Saved name only. Choose the file again to change it.';
        drop.classList.add('has-file');
      }
      showDone(saved, saved.savedAt || '');
    }
  }

  MM.ready(function () {
    setHeaderOffset();
    initSubnav();
    initFinder();
    initForm();
  });
})();
