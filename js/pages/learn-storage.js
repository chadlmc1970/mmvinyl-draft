(function () {
  'use strict';
  var MM = window.MM;
  var KEY = 'mm.binlabels.v1';
  var SLOTS = 6;

  MM.ready(function () {
    var form = MM.$('[data-label-form]');
    if (!form) return;
    var product = MM.$('[data-lb-product]', form);
    var note = MM.$('[data-lb-note]', form);
    var received = MM.$('[data-lb-received]', form);
    var useby = MM.$('[data-lb-useby]', form);
    var add = MM.$('[data-lb-add]', form);
    var status = MM.$('[data-lb-status]', form);
    var sheet = MM.$('[data-lb-sheet]');
    var tpl = MM.$('[data-lb-template]');
    var hint = status.textContent;
    var labels = MM.store.get(KEY, []);
    if (!Array.isArray(labels)) labels = [];
    labels = labels.slice(0, SLOTS);

    function todayIso() {
      var days = MM.learn && MM.learn.today ? MM.learn.today() : Math.floor(Date.now() / 86400000);
      return new Date(days * 86400000).toISOString().slice(0, 10);
    }

    function nice(iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
      var p = iso.split('-');
      return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function render() {
      sheet.innerHTML = '';
      for (var i = 0; i < SLOTS; i++) {
        var data = labels[i];
        var card = tpl.content.firstElementChild.cloneNode(true);
        var del = MM.$('[data-lb-del]', card);
        if (data) {
          MM.$('[data-lb-out="product"]', card).textContent = data.product;
          MM.$('[data-lb-out="note"]', card).textContent = data.note;
          MM.$('[data-lb-out="received"]', card).textContent = nice(data.received);
          MM.$('[data-lb-out="useby"]', card).textContent = nice(data.useby);
          del.setAttribute('data-i', String(i));
        } else {
          card.classList.add('is-blank');
          del.remove();
        }
        sheet.appendChild(card);
      }
      add.disabled = labels.length >= SLOTS;
      status.textContent = labels.length >= SLOTS ? 'The page is full. Print it, then clear it for the next six.' : hint;
      MM.store.set(KEY, labels);
    }

    add.addEventListener('click', function () {
      if (labels.length >= SLOTS) return;
      labels.push({
        product: product.value,
        note: note.value.trim(),
        received: received.value,
        useby: useby.value
      });
      note.value = '';
      render();
      MM.toast('Label added');
    });

    sheet.addEventListener('click', function (e) {
      var del = e.target.closest('[data-lb-del]');
      if (!del) return;
      labels.splice(+del.getAttribute('data-i'), 1);
      render();
      add.focus();
    });

    MM.$('[data-lb-clear]', form).addEventListener('click', function () {
      labels = [];
      render();
    });

    received.value = todayIso();
    render();
  });
})();
