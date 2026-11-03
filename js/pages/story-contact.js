(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(field, bad) {
    var wrap = field.closest('.field');
    wrap.classList.toggle('has-error', bad);
    if (bad) field.setAttribute('aria-invalid', 'true');
    else field.removeAttribute('aria-invalid');
  }

  MM.ready(function () {
    var form = MM.$('[data-contact-form]');
    if (!form) return;

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
      var lines = [f.message.value.trim(), '', '---', 'Name: ' + f.name.value.trim(), 'Email: ' + f.email.value.trim()];
      if (f.phone.value.trim()) lines.push('Phone: ' + f.phone.value.trim());
      if (f.order.value.trim()) lines.push('Order number: ' + f.order.value.trim());
      lines.push('I am a: ' + f.who.value);
      window.location.href = MM.mailto(f.topic.value + ' (' + f.name.value.trim() + ')', lines);
    });
  });
})();
