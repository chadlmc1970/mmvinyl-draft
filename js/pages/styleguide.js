(function () {
  'use strict';
  var demos = Array.prototype.slice.call(document.querySelectorAll('.sg-demo'));
  var sources = demos.map(function (d) {
    return d.innerHTML;
  });

  function dedent(html) {
    var lines = html.replace(/\t/g, '  ').split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    var min = Infinity;
    lines.forEach(function (l) {
      if (l.trim()) min = Math.min(min, l.match(/^ */)[0].length);
    });
    if (!isFinite(min)) min = 0;
    return lines
      .map(function (l) {
        return l.slice(min);
      })
      .join('\n');
  }

  demos.forEach(function (demo, i) {
    var label = demo.getAttribute('data-sg');
    if (label) {
      var tag = document.createElement('span');
      tag.className = 'sg-demo__tag';
      tag.textContent = label;
      demo.insertBefore(tag, demo.firstChild);
    }
    var code = dedent(sources[i]);
    var box = document.createElement('details');
    box.className = 'sg-code';
    var sum = document.createElement('summary');
    sum.textContent = 'Show markup';
    var pre = document.createElement('pre');
    var c = document.createElement('code');
    c.textContent = code;
    pre.appendChild(c);
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn--sm btn--outline';
    copy.textContent = 'Copy markup';
    copy.addEventListener('click', function () {
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () {
        copy.textContent = 'Copied';
        setTimeout(function () {
          copy.textContent = 'Copy markup';
        }, 1500);
      });
    });
    box.appendChild(sum);
    box.appendChild(copy);
    box.appendChild(pre);
    demo.appendChild(box);
  });
})();
