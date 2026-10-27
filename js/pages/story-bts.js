(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initTexts(root) {
    var phone = MM.$('[data-phone]', root);
    var sms = MM.$('[data-sms]', root);
    var items = MM.$$('[data-step]', sms);
    var logRows = MM.$$('[data-log] li', root);
    var buttons = MM.$$('[data-go]', root);
    var optin = MM.$('[data-optin]', root);
    var phoneOff = MM.$('[data-phone-off]', root);
    var logOff = MM.$('[data-log-off]', root);
    var logList = MM.$('[data-log]', root);
    var consent = MM.$('[data-consent]', root);
    var replay = MM.$('[data-replay]', root);
    var timers = [];
    var started = false;

    root.classList.add('is-enhanced');

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
      MM.$$('.sms__typing', sms).forEach(function (t) {
        t.remove();
      });
    }

    function render(n) {
      items.forEach(function (el) {
        el.classList.toggle('is-shown', +el.getAttribute('data-step') <= n && !el.hasAttribute('data-late-pending'));
      });
      logRows.forEach(function (el) {
        el.classList.toggle('is-shown', +el.getAttribute('data-step') <= n);
      });
      buttons.forEach(function (b) {
        var s = +b.getAttribute('data-go');
        b.classList.toggle('is-done', s < n);
        b.classList.toggle('is-now', s === n);
        b.setAttribute('aria-current', s === n ? 'step' : 'false');
      });
    }

    function later(fn, ms) {
      timers.push(setTimeout(fn, ms));
    }

    function stepEls(step) {
      return items.filter(function (el) {
        return +el.getAttribute('data-step') === step;
      });
    }

    function typing(before) {
      var t = document.createElement('div');
      t.className = 'sms__typing';
      t.setAttribute('aria-hidden', 'true');
      t.innerHTML = '<i></i><i></i><i></i>';
      before.parentNode.insertBefore(t, before);
      return t;
    }

    function play() {
      clearTimers();
      render(0);
      items.forEach(function (el) {
        el.classList.remove('is-shown');
      });
      var step = 1;
      function next() {
        if (step > 3) return;
        var s = step++;
        var els = stepEls(s);
        var firstMsg = els.filter(function (e) {
          return e.classList.contains('sms__msg') && !e.classList.contains('sms__msg--out');
        })[0];
        var t = firstMsg ? typing(firstMsg) : null;
        later(function () {
          if (t) t.remove();
          els.forEach(function (el) {
            if (!el.classList.contains('sms__msg--out')) el.classList.add('is-shown');
          });
          logRows.forEach(function (el) {
            el.classList.toggle('is-shown', +el.getAttribute('data-step') <= s);
          });
          buttons.forEach(function (b) {
            var bs = +b.getAttribute('data-go');
            b.classList.toggle('is-done', bs < s);
            b.classList.toggle('is-now', bs === s);
          });
          if (s === 3) {
            later(function () {
              els.forEach(function (el) {
                if (el.classList.contains('sms__msg--out')) el.classList.add('is-shown');
              });
            }, 1300);
          } else {
            later(next, 1100);
          }
        }, 1000);
      }
      next();
    }

    function setOptin(on) {
      phone.classList.toggle('is-off', !on);
      sms.hidden = !on;
      phoneOff.hidden = on;
      logList.hidden = !on;
      logOff.hidden = on;
      consent.innerHTML = on
        ? '<span class="status status--ok">Consent stored</span> with the date and time'
        : '<span class="status">No consent</span> so no texts are sent';
      buttons.forEach(function (b) {
        b.disabled = !on;
      });
      replay.disabled = !on;
    }

    optin.addEventListener('change', function () {
      clearTimers();
      setOptin(optin.checked);
      if (optin.checked) {
        if (reduce) render(3);
        else play();
      }
    });

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        clearTimers();
        var n = +b.getAttribute('data-go');
        items.forEach(function (el) {
          el.classList.toggle('is-shown', +el.getAttribute('data-step') <= n);
        });
        render(n);
      });
    });

    replay.addEventListener('click', function () {
      if (reduce) render(3);
      else play();
    });

    setOptin(true);
    render(0);
    items.forEach(function (el) {
      el.classList.remove('is-shown');
    });

    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) {
        el.classList.add('is-shown');
      });
      render(3);
      return;
    }

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !started) {
            started = true;
            play();
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(phone);
  }

  function initQueue(root) {
    var jobs = MM.$$('[data-job]', root);
    var note = MM.$('[data-queue-note]', root);
    var reset = MM.$('[data-queue-reset]', root);
    var initial = jobs.map(function (j) {
      return j.getAttribute('data-state');
    });
    var PILL = {
      queued: { text: 'Queued', cls: 'status' },
      printing: { text: 'Printing', cls: 'status status--info' },
      ready: { text: 'Ready for pickup', cls: 'status status--ok' }
    };
    var BTN = { queued: 'Start printing', printing: 'Mark ready and text', ready: 'Sent' };

    function title(j) {
      return MM.$('.list-row__title', j).textContent.split(',')[0];
    }

    function paint(j) {
      var state = j.getAttribute('data-state');
      var pill = MM.$('[data-pill]', j);
      var btn = MM.$('[data-advance]', j);
      pill.className = PILL[state].cls;
      pill.textContent = PILL[state].text;
      btn.textContent = BTN[state];
      btn.disabled = state === 'ready';
      btn.classList.toggle('btn--outline', state !== 'printing');
      j.classList.toggle('is-ready', state === 'ready');
    }

    function counts() {
      ['queued', 'printing', 'ready'].forEach(function (k) {
        MM.$('[data-count="' + k + '"]', root).textContent = jobs.filter(function (j) {
          return j.getAttribute('data-state') === k;
        }).length;
      });
    }

    function refresh() {
      jobs.forEach(paint);
      counts();
    }

    jobs.forEach(function (j) {
      MM.$('[data-advance]', j).addEventListener('click', function () {
        var s = j.getAttribute('data-state');
        if (s === 'queued') {
          j.setAttribute('data-state', 'printing');
          note.textContent = title(j) + ' is printing.';
        } else if (s === 'printing') {
          j.setAttribute('data-state', 'ready');
          note.textContent = 'Sample text sent for ' + title(j) + ': "Your order is ready for pickup." Logged with the time.';
        }
        refresh();
      });
    });

    reset.addEventListener('click', function () {
      jobs.forEach(function (j, i) {
        j.setAttribute('data-state', initial[i]);
      });
      note.textContent = '';
      refresh();
    });

    refresh();
  }

  function initArt(root) {
    var chips = MM.$$('[data-file]', root);
    var verdict = MM.$('[data-verdict]', root);
    var checks = MM.$$('[data-check]', root);
    var fix = MM.$('[data-fix]', root);
    var thumb = MM.$('[data-art-thumb]', root);
    var DATA = {
      a: {
        verdict: '<span class="status status--ok">Ready to print</span>',
        checks: {
          size: ['ok', 'Pass', 'Fits the sheet'],
          res: ['ok', 'Pass', 'Sharp at this size'],
          gap: ['ok', 'Pass', 'Example of a gap check, to decide with you']
        },
        fix: ''
      },
      b: {
        verdict: '<span class="status status--warn">Needs a look before printing</span>',
        checks: {
          size: ['ok', 'Pass', 'Fits the sheet'],
          res: ['warn', 'Check', 'Looks soft at this size'],
          gap: ['ok', 'Pass', 'Example of a gap check, to decide with you']
        },
        fix: 'Plain-language fix: this picture looks fuzzy when it is printed this big. Send a larger version of the file, or make the design smaller on the sheet. Not sure which? Call us and we will look at it with you.'
      }
    };

    function show(key) {
      var d = DATA[key];
      verdict.innerHTML = d.verdict;
      checks.forEach(function (li) {
        var v = d.checks[li.getAttribute('data-check')];
        MM.$('.status', li).className = 'status status--' + v[0];
        MM.$('.status', li).textContent = v[1];
        MM.$('small', li).textContent = v[2];
      });
      fix.hidden = !d.fix;
      fix.textContent = d.fix;
      thumb.classList.toggle('is-soft', key === 'b');
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-file') === key ? 'true' : 'false');
      });
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        show(c.getAttribute('data-file'));
      });
    });
  }

  function initPay(root) {
    var btn = MM.$('[data-pay-btn]', root);
    var note = MM.$('[data-pay-note]', root);
    var radios = MM.$$('input[name="bts-pay"]', root);
    radios.forEach(function (r) {
      r.addEventListener('change', function () {
        btn.textContent = 'Pay with ' + r.value;
        note.textContent = 'Preview only. Nothing is charged.';
      });
    });
    btn.addEventListener('click', function () {
      var r = radios.filter(function (x) {
        return x.checked;
      })[0];
      note.textContent = 'This is a Preview. On the real checkout, ' + r.value + ' would open here.';
    });
  }

  function initShip(root) {
    var detail = MM.$('[data-ship-detail]', root);
    var COPY = {
      pickup: '<p><strong>Pickup is ready at the counter.</strong> Same-day if you order by the cutoff. This stays the default.</p>',
      fedex: '<p><strong>Rate comes live from Desiree\'s own FedEx account,</strong> at her discounts. A label prints at the shop. Starts with light, flat items: transfers, gang sheets, patches.</p>',
      ups: '<p><strong>UPS is the second option.</strong> Same live-rate idea, labels printed at the shop. Weight and size profiles for flat transfers are set up first.</p>'
    };
    MM.$$('input[name="bts-ship"]', root).forEach(function (r) {
      r.addEventListener('change', function () {
        detail.innerHTML = COPY[r.value];
      });
    });
  }

  function initGl(root) {
    var chips = MM.$$('[data-gl-mode]', root);
    var cat = MM.$('[data-gl-cat]', root);
    var empty = MM.$('[data-gl-empty]', root);
    var list = MM.$('[data-gl-chips]', root);
    var after = MM.$('[data-gl-after]', root);
    var hours = MM.$('[data-gl-hours]', root);
    var note = MM.$('[data-gl-note]', root);
    var card = MM.$('[data-gl-card]', root);

    function set(mode) {
      var isAfter = mode === 'after';
      cat.innerHTML = isAfter
        ? 'Closest DTF-type category <small>(exact name to confirm in your profile)</small>'
        : 'Craft store <small>(what you told us Google shows today)</small>';
      empty.hidden = isAfter;
      list.hidden = !isAfter;
      after.hidden = !isAfter;
      hours.textContent = isAfter
        ? 'Hours: Mon to Fri 8:30 AM to 5 PM, Sat 9 AM to 1 PM, with holiday overrides'
        : 'Hours: Mon to Fri 8:30 AM to 5 PM, Sat 9 AM to 1 PM';
      note.textContent = isAfter
        ? 'The category is the part we confirm first. Google only offers certain names inside each profile.'
        : 'Today\'s category is what you told us on the call. We have not seen your live Google profile.';
      card.classList.toggle('is-after', isAfter);
      chips.forEach(function (c) {
        c.setAttribute('aria-pressed', c.getAttribute('data-gl-mode') === mode ? 'true' : 'false');
      });
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        set(c.getAttribute('data-gl-mode'));
      });
    });
  }

  MM.ready(function () {
    var el;
    if ((el = MM.$('[data-texts]'))) initTexts(el);
    if ((el = MM.$('[data-queue]'))) initQueue(el);
    if ((el = MM.$('[data-art]'))) initArt(el);
    if ((el = MM.$('[data-pay]'))) initPay(el);
    if ((el = MM.$('[data-ship]'))) initShip(el);
    if ((el = MM.$('[data-gl]'))) initGl(el);
  });
})();
