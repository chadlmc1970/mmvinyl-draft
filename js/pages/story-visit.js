(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  var EMBED =
    'https://www.openstreetmap.org/export/embed.html?bbox=-91.0521%2C30.3786%2C-91.0361%2C30.3886&layer=mapnik&marker=30.3836062%2C-91.0441619';

  function loadMap(card) {
    var canvas = MM.$('[data-map-canvas]', card);
    var frame = document.createElement('iframe');
    frame.src = EMBED;
    frame.title = 'Map showing M&M Vinyl on Industriplex Boulevard, Baton Rouge';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.className = 'story-map__frame';
    canvas.appendChild(frame);
    canvas.classList.add('is-loaded');
    var load = MM.$('.story-map__load', canvas);
    if (load) load.setAttribute('hidden', '');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {}
      ta.remove();
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  MM.ready(function () {
    var card = MM.$('[data-map-card]');
    if (card) {
      var btn = MM.$('[data-map-load]', card);
      if (btn) btn.addEventListener('click', function () {
        loadMap(card);
      });
    }
    MM.$$('[data-copy-address]').forEach(function (b) {
      b.addEventListener('click', function () {
        copyText(b.getAttribute('data-address')).then(
          function () {
            MM.toast('Address copied');
          },
          function () {
            MM.toast('Could not copy. Press and hold the address to copy it.');
          }
        );
      });
    });
  });
})();
