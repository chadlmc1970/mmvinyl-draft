(function () {
  'use strict';
  var MM = window.MM;
  var boxes = MM.$$('[data-checks] input[type="checkbox"]');
  var ring = MM.$('[data-ring]');
  var ringText = MM.$('[data-ring-text]');
  var title = MM.$('[data-progress-title]');
  var sub = MM.$('[data-progress-sub]');
  var result = MM.$('[data-result]');
  var actions = MM.$('[data-actions]');
  var circ = 2 * Math.PI * 19;
  ring.style.strokeDasharray = circ;

  
  function update() {
    var n = boxes.filter(function (b) {
      return b.checked;
    }).length;
    var total = boxes.length;
    ring.style.strokeDashoffset = circ * (1 - n / total);
    ringText.textContent = n + '/' + total;
    title.textContent = n + ' of ' + total + ' checked';
    sub.textContent = n === 0 ? 'Start at the top.' : n === total ? 'All checked.' : n === total - 1 ? 'One left.' : n < total / 2 ? 'Good start.' : 'Over halfway.';
    var done = n === total;
    result.hidden = !done;
    actions.hidden = done;
  }

  boxes.forEach(function (b) {
    b.addEventListener('change', update);
  });
  MM.$$('[data-reset]').forEach(function (r) {
    r.addEventListener('click', function () {
      boxes.forEach(function (b) {
        b.checked = false;
      });
      update();
      boxes[0].focus();
    });
  });
  update();
})();
