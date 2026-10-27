(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initRail(shelf) {
    var vp = MM.$('.shelf__vp', shelf);
    var prev = MM.$('[data-shelf-prev]', shelf);
    var next = MM.$('[data-shelf-next]', shelf);
    if (!vp || !prev || !next) return;

    function update() {
      var max = vp.scrollWidth - vp.clientWidth - 2;
      prev.disabled = vp.scrollLeft <= 2;
      next.disabled = vp.scrollLeft >= max;
    }

    function step(dir) {
      var card = MM.$('.product-card', vp);
      var w = card ? card.getBoundingClientRect().width + 16 : 240;
      var n = Math.max(1, Math.floor(vp.clientWidth / w) - 1);
      vp.scrollBy({ left: dir * w * n, behavior: reduce ? 'auto' : 'smooth' });
    }

    prev.addEventListener('click', function () {
      step(-1);
    });
    next.addEventListener('click', function () {
      step(1);
    });
    vp.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  MM.ready(function () {
    MM.$$('[data-shelf]').forEach(initRail);
  });
})();
