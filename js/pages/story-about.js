(function () {
  'use strict';
  var MM = window.MM;
  if (!MM) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  MM.ready(function () {
    var tl = MM.$('[data-story-timeline]');
    if (!tl) return;
    var items = MM.$$('.story-timeline__item', tl);

    if (reduce) {
      tl.style.setProperty('--p', '1');
      items.forEach(function (i) {
        i.classList.add('is-reached');
      });
      return;
    }

    tl.classList.add('is-tracking');
    var ticking = false;

    function update() {
      ticking = false;
      var rect = tl.getBoundingClientRect();
      var mid = window.innerHeight * 0.55;
      var p = Math.max(0, Math.min(1, (mid - rect.top) / rect.height));
      tl.style.setProperty('--p', p.toFixed(4));
      items.forEach(function (it) {
        var dot = it.querySelector('.story-timeline__dot').getBoundingClientRect();
        it.classList.toggle('is-reached', dot.top < mid);
      });
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  });
})();
