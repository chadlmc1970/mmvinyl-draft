(function () {
  'use strict';
  var MM = window.MM;

  function initGallery() {
    var root = MM.$('[data-gallery]');
    if (!root) return null;
    var imgs = MM.$$('.pdp-img', root);
    var thumbs = MM.$$('.pdp-thumb', root);
    var dialog = MM.$('[data-zoom-dialog]', root);
    var zoomImg = MM.$('[data-zoom-img]', root);

    function show(n) {
      var found = false;
      imgs.forEach(function (im) {
        var on = im.dataset.n === String(n);
        if (on) found = true;
        im.hidden = !on;
      });
      if (!found) return false;
      thumbs.forEach(function (t) {
        var on = t.dataset.n === String(n);
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      return true;
    }

    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        show(t.dataset.n);
      });
    });

    var zoomBtn = MM.$('[data-zoom]', root);
    if (zoomBtn && dialog && dialog.showModal) {
      zoomBtn.addEventListener('click', function () {
        var cur = imgs.filter(function (im) {
          return !im.hidden;
        })[0];
        if (!cur) return;
        zoomImg.src = cur.dataset.src;
        zoomImg.alt = cur.alt;
        dialog.showModal();
      });
      dialog.addEventListener('click', function (e) {
        if (e.target === dialog || e.target.closest('[data-zoom-close]')) dialog.close();
      });
    } else if (zoomBtn) {
      zoomBtn.style.cursor = 'default';
    }
    return { show: show };
  }

  function initBuy(data, gallery) {
    var form = MM.$('[data-pdp-form]');
    if (!form) return;
    var addBtn = MM.$('[data-pdp-add]', form);
    var priceEl = MM.$('[data-pdp-price]', form);
    var stockEl = MM.$('[data-pdp-stock]', form);
    var msgEl = MM.$('[data-pdp-msg]', form);
    var attrs = data.attrs || [];
    var variants = data.variants || [];
    var sel = {};
    var baseStockHtml = stockEl.innerHTML;
    var oosProduct = !data.inStock;

    function fmt(c) {
      return MM.money(c);
    }

    function inputsFor(name) {
      return MM.$$('[data-attr]', form).filter(function (el) {
        return el.dataset.attr === name;
      });
    }

    function read() {
      attrs.forEach(function (a) {
        var els = inputsFor(a.name);
        var v = '';
        els.forEach(function (el) {
          if (el.tagName === 'SELECT') v = el.value;
          else if (el.checked) v = el.value;
        });
        sel[a.name] = v;
      });
    }

    function matching(s) {
      return variants.filter(function (v) {
        return attrs.every(function (a) {
          var want = s[a.name];
          var have = v.a[a.name];
          return !want || have == null || have === want;
        });
      });
    }

    function label() {
      return attrs
        .map(function (a) {
          return sel[a.name];
        })
        .filter(Boolean)
        .join(' / ');
    }

    function setMsg(t) {
      msgEl.textContent = t || '';
    }

    function setAdd(text, disabled) {
      addBtn.textContent = text;
      if (disabled) {
        addBtn.setAttribute('disabled', '');
        addBtn.setAttribute('aria-disabled', 'true');
      } else {
        addBtn.removeAttribute('disabled');
        addBtn.removeAttribute('aria-disabled');
      }
    }

    function markOptions() {
      attrs.forEach(function (a) {
        var chosenLabel = MM.$('[data-opt-group="' + a.name.replace(/"/g, '\\"') + '"] [data-sel-label]', form);
        if (chosenLabel) chosenLabel.textContent = sel[a.name] ? sel[a.name] : '';
        inputsFor(a.name).forEach(function (el) {
          if (el.tagName === 'SELECT') {
            Array.prototype.forEach.call(el.options, function (o) {
              if (!o.value) return;
              if (!o.dataset.label) o.dataset.label = o.textContent;
              var test = Object.assign({}, sel);
              test[a.name] = o.value;
              var ok = matching(test).some(function (v) {
                return v.s;
              });
              o.textContent = o.dataset.label + (ok ? '' : ' (sold out)');
            });
            return;
          }
          var test = Object.assign({}, sel);
          test[a.name] = el.value;
          var ok = matching(test).some(function (v) {
            return v.s;
          });
          el.closest('.opt').classList.toggle('is-out', !ok);
        });
      });
    }

    function update() {
      read();
      markOptions();
      var m = matching(sel);
      var complete = attrs.every(function (a) {
        return sel[a.name];
      });
      var chosen = complete ? m[0] : null;
      var needs = attrs.filter(function (a) {
        return !sel[a.name];
      })[0];

      if (variants.length) {
        var imgN = null;
        if (m.length && (complete || m.every(function (v) { return v.i === m[0].i; }))) imgN = m[0].i;
        if (imgN && gallery && attrs.some(function (a) { return sel[a.name]; })) gallery.show(imgN);
      }

      if (!variants.length) {
        setAdd(oosProduct ? 'Out of stock' : 'Add to cart', oosProduct);
        return;
      }

      if (chosen) {
        priceEl.textContent = fmt(chosen.p);
        stockEl.innerHTML = chosen.s ? '<span class="status status--ok">In stock</span>' : '<span class="status status--late">Out of stock</span>';
        addBtn.dataset.priceCents = String(chosen.p);
        addBtn.dataset.variant = label();
        addBtn.dataset.liveId = String(chosen.id);
        addBtn.dataset.liveUrl = chosen.u || data.liveUrl;
        var thumb = data.imgs && data.imgs[chosen.i];
        if (thumb) addBtn.dataset.image = thumb;
        setAdd(chosen.s ? 'Add to cart' : 'Out of stock', !chosen.s);
        setMsg(chosen.s ? '' : 'This option is out of stock. Call us to order.');
      } else if (complete) {
        setAdd('Not available', true);
        stockEl.innerHTML = '<span class="status status--late">Not available</span>';
        setMsg('That combination is not available. Try another.');
      } else {
        if (m.length) {
          var prices = m.map(function (v) {
            return v.p;
          });
          var lo = Math.min.apply(null, prices);
          var hi = Math.max.apply(null, prices);
          priceEl.textContent = lo === hi ? fmt(lo) : 'From ' + fmt(lo);
          stockEl.innerHTML = m.some(function (v) { return v.s; }) ? '<span class="status status--ok">In stock</span>' : '<span class="status status--late">Out of stock</span>';
        } else {
          stockEl.innerHTML = baseStockHtml;
        }
        setAdd('Choose ' + (needs ? needs.label.toLowerCase() : 'options'), false);
        setMsg('');
      }
    }

    form.addEventListener('change', update);

    addBtn.addEventListener('click', function (e) {
      read();
      var needs = attrs.filter(function (a) {
        return !sel[a.name];
      })[0];
      if (variants.length && needs) {
        e.stopPropagation();
        e.preventDefault();
        setMsg('Choose a ' + needs.label.toLowerCase() + ' first.');
        var first = inputsFor(needs.name)[0];
        if (first) first.focus();
        return;
      }
      var qty = MM.$('#pdp-qty');
      if (qty) qty.value = String(Math.max(1, Math.min(999, parseInt(qty.value, 10) || 1)));
    });

    MM.$$('[data-qty-step]', form).forEach(function (b) {
      b.addEventListener('click', function () {
        var qty = MM.$('#pdp-qty');
        qty.value = String(Math.max(1, Math.min(999, (parseInt(qty.value, 10) || 1) + parseInt(b.dataset.qtyStep, 10))));
      });
    });

    attrs.forEach(function (a) {
      if (a.options.length === 1) {
        var el = inputsFor(a.name)[0];
        if (!el) return;
        if (el.tagName === 'SELECT') el.value = a.options[0];
        else el.checked = true;
      }
    });
    if (variants.length === 1 && !attrs.length) {
      var v = variants[0];
      addBtn.dataset.priceCents = String(v.p);
      addBtn.dataset.liveId = String(v.id);
      addBtn.dataset.liveUrl = v.u || data.liveUrl;
    }
    update();
  }

  function initBar() {
    var bar = MM.$('[data-pdp-bar]');
    var buy = MM.$('#buy');
    if (!bar || !buy || !('IntersectionObserver' in window)) return;
    var link = MM.$('a', bar);
    new IntersectionObserver(function (entries) {
      var en = entries[0];
      var on = !en.isIntersecting && en.boundingClientRect.top < 0;
      bar.classList.toggle('is-on', on);
      bar.setAttribute('aria-hidden', on ? 'false' : 'true');
      link.tabIndex = on ? 0 : -1;
    }).observe(buy);
  }

  MM.ready(function () {
    var el = document.getElementById('pdp-data');
    var data = {};
    try {
      data = JSON.parse(el.textContent);
    } catch (e) {}
    var gallery = initGallery();
    initBuy(data, gallery);
    initBar();
  });
})();
