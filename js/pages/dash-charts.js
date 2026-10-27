(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;
  var NS = 'http://www.w3.org/2000/svg';

  var PALETTE = ['s1', 's2', 's3', 's4', 's5', 's6'];
  OD.PALETTE = PALETTE;

  function niceMax(max) {
    if (max <= 0) return 1;
    var pow = Math.pow(10, Math.floor(Math.log10(max)));
    var n = max / pow;
    var step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
    return step * pow;
  }

  function seriesClass(s, i) {
    return s.ghost ? 'odc-ghost' : 'odc-' + PALETTE[i % PALETTE.length];
  }

  function swatch(s, i) {
    return '<i class="od-swatch ' + seriesClass(s, i) + '"></i>';
  }

  function legend(series) {
    if (series.length < 2) return '';
    return '<ul class="od-legend">' + series.map(function (s, i) {
      return '<li>' + swatch(s, i) + esc(s.name) + '</li>';
    }).join('') + '</ul>';
  }

  function tipHtml(label, rows) {
    return '<div class="od-tip__title">' + esc(label) + '</div>' + rows.map(function (r) {
      return '<div class="od-tip__row">' + (r.cls ? '<i class="od-swatch ' + r.cls + '"></i>' : '') + '<span>' + esc(r.name) + '</span><b>' + esc(r.value) + '</b></div>';
    }).join('');
  }

  function bindTip(svg, hit, getter) {
    function move(e) {
      var rect = svg.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var res = getter(x);
      if (!res) {
        OD.tip.hide();
        return;
      }
      OD.tip.show(res.html, e.clientX, e.clientY);
      if (res.onShow) res.onShow();
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', function () {
      OD.tip.hide();
      var g = svg.querySelector('.odc-guide');
      if (g) g.setAttribute('opacity', '0');
      Array.prototype.slice.call(svg.querySelectorAll('.odc-hl')).forEach(function (n) {
        n.classList.remove('odc-hl');
      });
    });
  }

  function monotone(pts) {
    if (pts.length < 3) return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
    var n = pts.length;
    var dx = [];
    var m = [];
    var t = [];
    for (var i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) {
        t[i] = 0;
        t[i + 1] = 0;
      } else {
        var a = t[i] / m[i];
        var b = t[i + 1] / m[i];
        var s = a * a + b * b;
        if (s > 9) {
          var k = 3 / Math.sqrt(s);
          t[i] = k * a * m[i];
          t[i + 1] = k * b * m[i];
        }
      }
    }
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (i = 0; i < n - 1; i++) {
      var x1 = pts[i][0] + dx[i] / 3;
      var y1 = pts[i][1] + (t[i] * dx[i]) / 3;
      var x2 = pts[i + 1][0] - dx[i] / 3;
      var y2 = pts[i + 1][1] - (t[i + 1] * dx[i]) / 3;
      d += 'C' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' ' + pts[i + 1][0].toFixed(1) + ' ' + pts[i + 1][1].toFixed(1);
    }
    return d;
  }

  function frame(cfg, W) {
    var H = cfg.height || 220;
    var m = { t: 12, r: 10, b: 26, l: cfg.leftPad || 44 };
    return { W: W, H: H, m: m, iw: W - m.l - m.r, ih: H - m.t - m.b };
  }

  function grid(f, max, fmt, ticks) {
    var out = '';
    for (var g = 0; g <= ticks; g++) {
      var y = f.m.t + f.ih - (f.ih * g) / ticks;
      out += '<line class="odc-grid' + (g === 0 ? ' odc-grid--base' : '') + '" x1="' + f.m.l + '" x2="' + (f.W - f.m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
      out += '<text class="odc-axis" x="' + (f.m.l - 8) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + esc(fmt((max * g) / ticks)) + '</text>';
    }
    return out;
  }

  function drawBars(el, cfg, W, animate) {
    var f = frame(cfg, W);
    var fmt = cfg.fmt || OD.num;
    var labels = cfg.labels;
    var series = cfg.series;
    var stacked = !!cfg.stacked;
    var totals = labels.map(function (_, i) {
      return stacked
        ? series.reduce(function (n, s) { return n + (+s.values[i] || 0); }, 0)
        : Math.max.apply(null, series.map(function (s) { return +s.values[i] || 0; }));
    });
    var max = cfg.max || niceMax(Math.max.apply(null, totals) * 1.04);
    var ticks = cfg.ticks || 4;
    var band = f.iw / labels.length;
    var groups = stacked ? 1 : series.length;
    var bw = Math.max(3, Math.min(cfg.maxBar || 34, (band * 0.74) / groups));
    var out = '<svg class="odc" viewBox="0 0 ' + W + ' ' + f.H + '" width="' + W + '" height="' + f.H + '" role="img" aria-label="' + esc(cfg.label || '') + '">' + grid(f, max, cfg.axisFmt || fmt, ticks);
    var every = cfg.labelEvery || Math.max(1, Math.ceil(labels.length / Math.floor(f.iw / 46)));
    var delay = 0;
    labels.forEach(function (l, i) {
      var cx = f.m.l + band * i + band / 2;
      var base = 0;
      series.forEach(function (s, si) {
        var v = +s.values[i] || 0;
        var bh = (v / max) * f.ih;
        var x = stacked ? cx - bw / 2 : cx - (bw * groups) / 2 + bw * si;
        var y = f.m.t + f.ih - bh - (stacked ? (base / max) * f.ih : 0);
        var radius = stacked && si < series.length - 1 ? 0 : 3;
        if (bh > 0.4) {
          out += '<rect class="odc-bar ' + seriesClass(s, si) + (cfg.highlight === i ? ' odc-bar--hl' : '') + (animate ? ' is-anim' : '') + '" data-i="' + i + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="' + radius + '" style="--d:' + Math.min(delay, 900) + 'ms"/>';
        }
        if (stacked) base += v;
      });
      delay += 14;
      if (i % every === 0) out += '<text class="odc-axis" x="' + cx.toFixed(1) + '" y="' + (f.H - 8) + '" text-anchor="middle">' + esc(l) + '</text>';
    });
    (cfg.ref || []).forEach(function (r) {
      var y = f.m.t + f.ih - (r.value / max) * f.ih;
      out += '<line class="odc-ref" x1="' + f.m.l + '" x2="' + (f.W - f.m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="odc-ref-label" x="' + (f.W - f.m.r) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="end">' + esc(r.label) + '</text>';
    });
    out += '<rect class="odc-hit" x="' + f.m.l + '" y="' + f.m.t + '" width="' + f.iw + '" height="' + f.ih + '" fill="transparent"/></svg>';
    el.innerHTML = out + legend(series);
    var svg = el.querySelector('svg');
    var tf = cfg.tipFmt || fmt;
    var tipFor = function (i) {
      return tipHtml(cfg.tipLabels ? cfg.tipLabels[i] : labels[i], series.map(function (s, si) {
        return { cls: seriesClass(s, si), name: s.name, value: tf(+s.values[i] || 0) };
      }).concat(stacked && series.length > 1 ? [{ name: 'Total', value: tf(totals[i]) }] : []));
    };
    var mark = function (i) {
      Array.prototype.slice.call(svg.querySelectorAll('.odc-hl')).forEach(function (n) { n.classList.remove('odc-hl'); });
      Array.prototype.slice.call(svg.querySelectorAll('.odc-bar[data-i="' + i + '"]')).forEach(function (n) { n.classList.add('odc-hl'); });
    };
    bindTip(svg, svg.querySelector('.odc-hit'), function (x) {
      var i = Math.floor((x - f.m.l) / band);
      if (i < 0 || i >= labels.length) return null;
      return { html: tipFor(i), onShow: function () { mark(i); } };
    });
    if (cfg.keyboard) {
      var idx = labels.length - 1;
      svg.setAttribute('tabindex', '0');
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-label', (cfg.label || 'Chart') + '. Use the left and right arrow keys to read each day.');
      var showIdx = function (i) {
        idx = Math.max(0, Math.min(labels.length - 1, i));
        var r = svg.getBoundingClientRect();
        OD.tip.show(tipFor(idx), r.left + f.m.l + band * idx + band / 2, r.top + f.m.t + f.ih - (totals[idx] / max) * f.ih);
        mark(idx);
      };
      svg.addEventListener('focus', function () { showIdx(idx); });
      svg.addEventListener('blur', function () { OD.tip.hide(); mark(-1); });
      svg.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        if (e.key === 'Home') { e.preventDefault(); showIdx(0); return; }
        if (e.key === 'End') { e.preventDefault(); showIdx(labels.length - 1); return; }
        if (!d) return;
        e.preventDefault();
        showIdx(idx + d);
      });
    }
  }

  function drawLine(el, cfg, W, animate) {
    var f = frame(cfg, W);
    var fmt = cfg.fmt || OD.num;
    var labels = cfg.labels;
    var series = cfg.series;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values.map(Number)); });
    var max = cfg.max || niceMax(Math.max.apply(null, all) * 1.05);
    var ticks = cfg.ticks || 4;
    var n = labels.length;
    var xAt = function (i) { return f.m.l + (f.iw * i) / Math.max(1, n - 1); };
    var yAt = function (v) { return f.m.t + f.ih - (v / max) * f.ih; };
    var out = '<svg class="odc" viewBox="0 0 ' + W + ' ' + f.H + '" width="' + W + '" height="' + f.H + '" role="img" aria-label="' + esc(cfg.label || '') + '">' + grid(f, max, cfg.axisFmt || fmt, ticks);
    var every = cfg.labelEvery || Math.max(1, Math.ceil(n / Math.floor(f.iw / 56)));
    labels.forEach(function (l, i) {
      if (i % every === 0) out += '<text class="odc-axis" x="' + xAt(i).toFixed(1) + '" y="' + (f.H - 8) + '" text-anchor="middle">' + esc(l) + '</text>';
    });
    series.forEach(function (s, si) {
      var pts = s.values.map(function (v, i) { return [xAt(i), yAt(+v || 0)]; });
      var d = cfg.straight ? pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('') : monotone(pts);
      if (cfg.area && si === 0) {
        out += '<path class="odc-area ' + seriesClass(s, si) + (animate ? ' is-anim' : '') + '" d="' + d + 'L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (f.m.t + f.ih) + 'L' + pts[0][0].toFixed(1) + ' ' + (f.m.t + f.ih) + 'Z"/>';
      }
      out += '<path class="odc-line ' + seriesClass(s, si) + (animate ? ' is-anim' : '') + '" pathLength="1" d="' + d + '"/>';
    });
    (cfg.ref || []).forEach(function (r) {
      var y = yAt(r.value);
      out += '<line class="odc-ref" x1="' + f.m.l + '" x2="' + (f.W - f.m.r) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="odc-ref-label" x="' + (f.W - f.m.r) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="end">' + esc(r.label) + '</text>';
    });
    out += '<line class="odc-guide" x1="0" x2="0" y1="' + f.m.t + '" y2="' + (f.m.t + f.ih) + '" opacity="0"/>';
    series.forEach(function (s, si) {
      out += '<circle class="odc-dot ' + seriesClass(s, si) + '" r="4.5" cx="0" cy="0" opacity="0"/>';
    });
    out += '<rect class="odc-hit" x="' + f.m.l + '" y="' + f.m.t + '" width="' + f.iw + '" height="' + f.ih + '" fill="transparent"/></svg>';
    el.innerHTML = out + legend(series);
    var svg = el.querySelector('svg');
    bindTip(svg, svg.querySelector('.odc-hit'), function (x) {
      var i = Math.round(((x - f.m.l) / f.iw) * (n - 1));
      if (i < 0 || i >= n) return null;
      return {
        html: tipHtml(cfg.tipLabels ? cfg.tipLabels[i] : labels[i], series.map(function (s, si) {
          return { cls: seriesClass(s, si), name: s.name, value: fmt(+s.values[i] || 0) };
        })),
        onShow: function () {
          var g = svg.querySelector('.odc-guide');
          g.setAttribute('x1', xAt(i));
          g.setAttribute('x2', xAt(i));
          g.setAttribute('opacity', '1');
          Array.prototype.slice.call(svg.querySelectorAll('.odc-dot')).forEach(function (dot, si) {
            dot.setAttribute('cx', xAt(i));
            dot.setAttribute('cy', yAt(+series[si].values[i] || 0));
            dot.setAttribute('opacity', '1');
          });
        }
      };
    });
  }

  var mounted = [];
  var ro = null;
  function watch() {
    if (ro || !('ResizeObserver' in window)) return;
    var t = null;
    ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) {
        var rec = mounted.filter(function (m) { return m.el === en.target; })[0];
        if (!rec) return;
        var w = Math.round(en.contentRect.width);
        if (Math.abs(w - rec.w) < 3 || w < 40) return;
        rec.w = w;
        clearTimeout(t);
        t = setTimeout(function () { rec.draw(w, false); }, 80);
      });
    });
  }

  function mount(el, kind, cfg) {
    watch();
    var draw = function (w, animate) {
      if (kind === 'bars') drawBars(el, cfg, w, animate && !OD.reduce);
      else drawLine(el, cfg, w, animate && !OD.reduce);
    };
    var w = Math.max(240, Math.round(el.clientWidth) || 560);
    el.classList.add('od-chart');
    draw(w, true);
    mounted = mounted.filter(function (m) { return document.body.contains(m.el); });
    mounted.push({ el: el, w: w, draw: draw });
    if (ro) ro.observe(el);
  }

  function spark(values, o) {
    o = o || {};
    var w = o.w || 84;
    var h = o.h || 26;
    var pad = 7;
    var v = values.map(Number);
    var min = Math.min.apply(null, v);
    var max = Math.max.apply(null, v);
    var span = max - min || 1;
    var pts = v.map(function (n, i) {
      return [pad + (i * (w - pad * 2)) / Math.max(1, v.length - 1), h - pad - ((n - min) / span) * (h - pad * 2)];
    });
    var d = monotone(pts);
    var last = pts[pts.length - 1];
    return '<svg class="od-spark' + (o.tone ? ' od-spark--' + o.tone : '') + (o.fluid ? ' od-spark--fluid' : '') + '" viewBox="0 0 ' + w + ' ' + h + '"' + (o.fluid ? '' : ' width="' + w + '" height="' + h + '"') + ' role="img" aria-label="' + esc(o.label || 'Trend') + '"><path pathLength="1" d="' + d + '"/><circle class="od-spark__halo" cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="6"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.4"/></svg>';
  }

  function donut(o) {
    var size = o.size || 176;
    var sw = o.stroke || 24;
    var R = (size - sw) / 2;
    var C = 2 * Math.PI * R;
    var total = o.values.reduce(function (a, b) { return a + b; }, 0) || 1;
    var cx = size / 2;
    var off = 0;
    var out = '<svg class="odc-donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" role="img" aria-label="' + esc(o.label || 'Breakdown') + '"><circle class="odc-donut__track" cx="' + cx + '" cy="' + cx + '" r="' + R + '" stroke-width="' + sw + '"/>';
    o.values.forEach(function (v, i) {
      var len = (v / total) * C;
      var gap = o.values.length > 1 ? 2.5 : 0;
      var seg = Math.max(0, len - gap);
      out += '<circle class="odc-seg ' + 'odc-st' + ((i % PALETTE.length) + 1) + '" style="--d:' + i * 90 + 'ms;--len:' + seg.toFixed(2) + ';--c:' + C.toFixed(2) + '" cx="' + cx + '" cy="' + cx + '" r="' + R + '" stroke-width="' + sw + '" stroke-dasharray="' + seg.toFixed(2) + ' ' + (C - seg).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 ' + cx + ' ' + cx + ')"><title>' + esc(o.labels[i] + ': ' + (o.fmt ? o.fmt(v) : OD.num(v))) + '</title></circle>';
      off += len;
    });
    if (o.center) out += '<text class="odc-center" x="' + cx + '" y="' + (cx + 2) + '" text-anchor="middle">' + esc(o.center) + '</text>' + (o.centerSub ? '<text class="odc-center-sub" x="' + cx + '" y="' + (cx + 20) + '" text-anchor="middle">' + esc(o.centerSub) + '</text>' : '');
    out += '</svg>';
    var leg = '<ul class="od-legend od-legend--col">' + o.labels.map(function (l, i) {
      return '<li><i class="od-swatch odc-s' + ((i % PALETTE.length) + 1) + '"></i><span>' + esc(l) + '</span><b>' + esc(o.fmt ? o.fmt(o.values[i]) : OD.num(o.values[i])) + '</b></li>';
    }).join('') + '</ul>';
    return '<div class="od-donut">' + out + leg + '</div>';
  }

  function ring(o) {
    var size = o.size || 168;
    var sw = o.stroke || 10;
    var R = (size - sw) / 2;
    var C = 2 * Math.PI * R;
    var pct = Math.max(0, Math.min(1, o.pct));
    return '<div class="od-ring" style="width:' + size + 'px;height:' + size + 'px"><svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-hidden="true"><circle class="od-ring__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + R + '" stroke-width="' + sw + '"/><circle class="od-ring__arc' + (o.tone ? ' od-ring__arc--' + o.tone : '') + '" data-c="' + C.toFixed(2) + '" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + R + '" stroke-width="' + sw + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - pct)).toFixed(2) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/></svg><div class="od-ring__center">' + (o.center || '') + '</div></div>';
  }

  function rank(items, o) {
    o = o || {};
    var max = o.max || Math.max.apply(null, items.map(function (i) { return i.value; })) || 1;
    return '<ol class="od-rank">' + items.map(function (it, i) {
      var delta = '';
      if (it.delta != null) {
        delta = '<span class="od-delta od-delta--' + (it.delta >= 0 ? 'good' : 'bad') + '">' + (it.delta >= 0 ? '&#9650;' : '&#9660;') + ' ' + Math.abs(it.delta).toFixed(0) + '%</span>';
      }
      return '<li class="od-rank__row" style="--i:' + i + '"><div class="od-rank__top"><span class="od-rank__label">' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span><span class="od-rank__val">' + esc(it.display) + delta + '</span></div><div class="od-rank__track"><span class="od-rank__bar' + (it.cls ? ' ' + it.cls : '') + '" style="--w:' + ((it.value / max) * 100).toFixed(1) + '%"></span></div></li>';
    }).join('') + '</ol>';
  }

  OD.charts = { bars: function (el, cfg) { mount(el, 'bars', cfg); }, line: function (el, cfg) { mount(el, 'line', cfg); }, spark: spark, donut: donut, ring: ring, rank: rank, legend: legend, niceMax: niceMax };
})();
