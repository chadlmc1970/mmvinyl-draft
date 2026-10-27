(function () {
  'use strict';
  var MM = window.MM;

  function row(i) {
    var img = i.image ? '<img class="cart-row__img" src="' + MM.esc(i.image) + '" alt="" width="96" height="96" loading="lazy">' : '<span class="cart-row__img cart-row__img--ph" aria-hidden="true"></span>';
    var name = i.url ? '<a href="' + MM.esc(i.url) + '">' + MM.esc(i.name) + '</a>' : MM.esc(i.name);
    return (
      '<li class="cart-row" data-id="' + MM.esc(i.id) + '" data-variant="' + MM.esc(i.variant) + '">' +
      img +
      '<div class="cart-row__main"><p class="cart-row__name">' + name + '</p>' +
      (i.variant ? '<p class="cart-row__meta">' + MM.esc(i.variant) + '</p>' : '') +
      '<p class="cart-row__meta">' + MM.money(i.priceCents) + ' each</p></div>' +
      '<div class="cart-row__qty"><div class="qty" role="group" aria-label="Quantity for ' + MM.esc(i.name) + '">' +
      '<button type="button" data-qty-step="-1" aria-label="Decrease quantity">&minus;</button>' +
      '<input type="number" min="1" max="999" value="' + i.qty + '" inputmode="numeric" aria-label="Quantity" data-qty-input>' +
      '<button type="button" data-qty-step="1" aria-label="Increase quantity">+</button></div>' +
      '<button type="button" class="cart-row__remove" data-remove>Remove</button></div>' +
      '<p class="cart-row__total">' + MM.money(i.priceCents * i.qty) + '</p></li>'
    );
  }

  function render() {
    var items = MM.cart.items();
    var rows = MM.$('[data-cart-rows]');
    var empty = MM.$('[data-cart-page-empty]');
    var side = MM.$('[data-cart-side]');
    rows.innerHTML = items.map(row).join('');
    rows.hidden = !items.length;
    empty.hidden = !!items.length;
    side.hidden = !items.length;
    MM.$('[data-cart-page-subtotal]').textContent = MM.money(MM.cart.subtotal());
    var h = MM.cart.liveHandoff();
    MM.$('[data-cart-page-checkout]').href = h.primary;
    var links = MM.$('[data-cart-page-links]');
    if (items.length > 1) {
      links.hidden = false;
      links.innerHTML =
        '<p><strong>Add each item on mandmvinyl.com</strong></p><ul>' +
        h.links
          .map(function (l) {
            return '<li><a href="' + MM.esc(l.url) + '" rel="noopener">' + MM.esc(l.name) + ' (' + l.qty + ')</a></li>';
          })
          .join('') +
        '</ul>';
    } else {
      links.hidden = true;
      links.innerHTML = '';
    }
  }

  MM.ready(function () {
    var rows = MM.$('[data-cart-rows]');
    render();
    document.addEventListener('mm:cart', render);
    rows.addEventListener('click', function (e) {
      var line = e.target.closest('.cart-row');
      if (!line) return;
      var id = line.dataset.id;
      var variant = line.dataset.variant;
      var step = e.target.closest('[data-qty-step]');
      if (step) {
        var cur = MM.cart.items().filter(function (i) {
          return i.id === id && i.variant === variant;
        })[0];
        if (cur) MM.cart.setQty(id, variant, cur.qty + parseInt(step.dataset.qtyStep, 10));
      } else if (e.target.closest('[data-remove]')) {
        MM.cart.remove(id, variant);
      }
    });
    rows.addEventListener('change', function (e) {
      if (!e.target.matches('[data-qty-input]')) return;
      var line = e.target.closest('.cart-row');
      MM.cart.setQty(line.dataset.id, line.dataset.variant, e.target.value);
    });
  });
})();
