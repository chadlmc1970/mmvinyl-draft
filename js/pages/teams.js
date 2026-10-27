(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  var KEY = 'mm.quotes.v1';

  function refCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i = 0; i < 5; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
    return 'Q-' + out;
  }

  function todayIso() {
    var p = MM.cutoff.zoneParts(MM.cutoff.now(), (MM.config.schedule && MM.config.schedule.timeZone) || 'America/Chicago');
    return p.y + '-' + ('0' + p.m).slice(-2) + '-' + ('0' + p.d).slice(-2);
  }

  function prettyDate(iso) {
    var a = iso.split('-');
    return new Date(Date.UTC(+a[0], +a[1] - 1, +a[2])).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function init() {
    var form = MM.$('[data-quote-form]');
    if (!form) return;
    var ack = MM.$('[data-quote-ack]');
    var errBox = MM.$('[data-quote-error]');
    var deadline = MM.$('#q-deadline');
    deadline.min = todayIso();

    function setError(input, msg) {
      var field = input.closest('.field');
      var hint = field.querySelector('.field__error');
      if (!msg) {
        field.classList.remove('has-error');
        input.removeAttribute('aria-invalid');
        if (hint) hint.remove();
        return;
      }
      field.classList.add('has-error');
      input.setAttribute('aria-invalid', 'true');
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'field__error';
        hint.id = input.id + '-err';
        field.appendChild(hint);
        var d = input.getAttribute('aria-describedby');
        input.setAttribute('aria-describedby', d ? d + ' ' + hint.id : hint.id);
      }
      hint.textContent = msg;
    }

    function validate() {
      var bad = [];
      var checks = [
        ['#q-name', function (v) { return v.trim() ? '' : 'Please add your name.'; }],
        ['#q-org', function (v) { return v.trim() ? '' : 'Please add your team, school, or business.'; }],
        ['#q-email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Please add an email we can reply to.'; }],
        ['#q-details', function (v) { return v.trim().length >= 3 ? '' : 'Tell us a little so we can help.'; }],
        ['#q-qty', function (v) { return parseInt(v, 10) >= 1 ? '' : 'Add a rough number, like 24.'; }],
        ['#q-deadline', function (v) { return !v || v >= todayIso() ? '' : 'That date has passed. Pick a date from today on.'; }]
      ];
      checks.forEach(function (c) {
        var input = MM.$(c[0], form);
        var msg = c[1](input.value);
        setError(input, msg);
        if (msg) bad.push(input);
      });
      return bad;
    }

    ['#q-name', '#q-org', '#q-email', '#q-details', '#q-qty', '#q-deadline'].forEach(function (sel) {
      var input = MM.$(sel, form);
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('has-error')) setError(input, '');
      });
    });

    function collect() {
      var needs = MM.$$('input[name="need"]:checked', form).map(function (c) { return c.value; });
      var files = MM.$('#q-files', form).files;
      var names = [];
      for (var i = 0; i < files.length; i++) names.push(files[i].name);
      return {
        name: MM.$('#q-name', form).value.trim(),
        organization: MM.$('#q-org', form).value.trim(),
        email: MM.$('#q-email', form).value.trim(),
        phone: MM.$('#q-phone', form).value.trim(),
        group_type: MM.$('#q-type', form).value,
        needs: needs,
        details: MM.$('#q-details', form).value.trim(),
        quantity: parseInt(MM.$('#q-qty', form).value, 10),
        deadline: MM.$('#q-deadline', form).value,
        file_names: names,
        fulfillment: (MM.$('input[name="fulfillment"]:checked', form) || {}).value || 'Pickup in Baton Rouge'
      };
    }

    function rows(q) {
      return [
        ['Name', q.name],
        ['Group', q.organization + ' (' + q.group_type + ')'],
        ['Email', q.email],
        ['Phone', q.phone || 'Not given'],
        ['Needs', q.needs.length ? q.needs.join(', ') : 'Not picked'],
        ['Details', q.details],
        ['How many', String(q.quantity)],
        ['Needed by', q.deadline ? prettyDate(q.deadline) : 'No date given'],
        ['Art files', q.file_names.length ? q.file_names.join(', ') + ' (names only)' : 'None added'],
        ['Pickup', q.fulfillment]
      ];
    }

    function mailtoFor(q, ref) {
      var body = rows(q).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');
      body = 'Quote request ' + ref + '\n\n' + body + '\n\n(Sent from the M&M Vinyl prototype. Please attach art files to your email.)';
      return 'mailto:' + form.getAttribute('action').replace(/^mailto:/, '') + '?subject=' + encodeURIComponent('Quote request: ' + q.organization + ' (' + ref + ')') + '&body=' + encodeURIComponent(body);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = validate();
      if (bad.length) {
        errBox.textContent = bad.length === 1 ? 'One thing to fix before we can send this.' : bad.length + ' things to fix before we can send this.';
        errBox.hidden = false;
        bad[0].focus();
        return;
      }
      errBox.hidden = true;
      var q = collect();
      var ref = refCode();
      var saved = MM.store.get(KEY, []);
      if (!Array.isArray(saved)) saved = [];
      saved.push({ id: ref, at: new Date().toISOString(), request: q });
      var ok = MM.store.set(KEY, saved);
      MM.$('[data-ack-ref]', ack).textContent = ref;
      MM.$('[data-ack-title]', ack).textContent = 'Thanks, ' + q.name.split(' ')[0] + '. We have your request.';
      var list = MM.$('[data-ack-list]', ack);
      list.innerHTML = rows(q).map(function (r) {
        return '<div><dt>' + MM.esc(r[0]) + '</dt><dd>' + MM.esc(r[1]) + '</dd></div>';
      }).join('');
      MM.$('[data-ack-mailto]', ack).setAttribute('href', mailtoFor(q, ref));
      form.hidden = true;
      ack.hidden = false;
      ack.focus();
      ack.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (!ok) MM.toast('Could not save on this device. Use the email button.');
    });

    MM.$('[data-quote-reset]', ack).addEventListener('click', function () {
      form.reset();
      deadline.min = todayIso();
      ack.hidden = true;
      form.hidden = false;
      MM.$('#q-name', form).focus();
    });
  }

  function watchQuote() {
    var section = MM.$('#quote');
    if (!section || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      document.body.classList.toggle('is-quoting', entries[0].isIntersecting);
    }, { rootMargin: '-15% 0px -15% 0px' }).observe(section);
  }

  MM.ready(function () {
    init();
    watchQuote();
  });
})();
