(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  var KEY = 'mm.contact.v1';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function saved() {
    var list = MM.store.get(KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function mailto(rec, to) {
    var subject = 'Website message from ' + rec.name + ' (' + rec.topic + ')';
    var lines = [
      rec.message,
      '',
      '---',
      'Name: ' + rec.name,
      'Email: ' + rec.email
    ];
    if (rec.phone) lines.push('Phone: ' + rec.phone);
    if (rec.order) lines.push('Order number: ' + rec.order);
    lines.push('I am a: ' + rec.who);
    lines.push('Sent from the M&M Vinyl website prototype');
    return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  function setError(field, bad) {
    var wrap = field.closest('.field');
    wrap.classList.toggle('has-error', bad);
    if (bad) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  MM.ready(function () {
    var form = MM.$('[data-contact-form]');
    if (!form) return;
    var wrap = MM.$('[data-form-wrap]');
    var sent = MM.$('[data-form-sent]');
    var nameEl = MM.$('[data-sent-name]', sent);
    var countEl = MM.$('[data-sent-count]', sent);
    var clearBtn = MM.$('[data-form-clear]', sent);
    var mailBtn = MM.$('[data-sent-mailto]', sent);

    function updateCount() {
      var n = saved().length;
      countEl.textContent = n ? n + (n === 1 ? ' message is' : ' messages are') + ' saved in this browser.' : '';
      clearBtn.hidden = !n;
    }

    function validate() {
      var f = form.elements;
      var checks = [
        [f.name, !f.name.value.trim()],
        [f.email, !EMAIL_RE.test(f.email.value.trim())],
        [f.message, !f.message.value.trim()]
      ];
      var first = null;
      checks.forEach(function (c) {
        setError(c[0], c[1]);
        if (c[1] && !first) first = c[0];
      });
      return first;
    }

    ['name', 'email', 'message'].forEach(function (n) {
      form.elements[n].addEventListener('input', function () {
        setError(form.elements[n], false);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = validate();
      if (bad) {
        bad.focus();
        return;
      }
      var f = form.elements;
      var rec = {
        at: new Date().toISOString(),
        name: f.name.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        order: f.order.value.trim(),
        who: f.who.value,
        topic: f.topic.value,
        message: f.message.value.trim()
      };
      var list = saved();
      list.push(rec);
      var ok = MM.store.set(KEY, list);
      nameEl.textContent = rec.name.split(/\s+/)[0];
      mailBtn.href = mailto(rec, form.getAttribute('action').replace(/^mailto:/, ''));
      updateCount();
      if (!ok) countEl.textContent = 'This browser would not let us save it, so use the email button to keep a copy.';
      wrap.hidden = true;
      sent.hidden = false;
      sent.focus();
    });

    MM.$('[data-form-reset]', sent).addEventListener('click', function () {
      form.reset();
      MM.$$('.field.has-error', form).forEach(function (el) {
        el.classList.remove('has-error');
      });
      sent.hidden = true;
      wrap.hidden = false;
      form.elements.name.focus();
    });

    clearBtn.addEventListener('click', function () {
      MM.store.remove(KEY);
      updateCount();
      MM.toast('Saved messages cleared');
    });
  });
})();
