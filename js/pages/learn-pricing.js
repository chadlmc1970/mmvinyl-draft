(function () {
  'use strict';
  var MM = window.MM;
  var inputs = {};
  MM.$$('[data-in]').forEach(function (i) {
    inputs[i.getAttribute('data-in')] = i;
    i.name = i.getAttribute('data-in');
  });
  var outPrice = MM.$('[data-out-price]');
  var outSub = MM.$('[data-out-sub]');
  var breakEl = MM.$('[data-break]');
  var markEl = MM.$('[data-markup]');
  var warn = MM.$('[data-out-warn]');
  var qty = MM.$('[data-qty]');
  qty.name = 'shirts';

  function num(el) {
    var v = parseFloat(el.value);
    return isNaN(v) ? null : v;
  }
  function usd(v) {
    return '$' + v.toFixed(2);
  }
  function set(sel, text) {
    MM.$(sel).textContent = text;
  }

  function calc() {
    warn.hidden = true;
    var blank = num(inputs.blank);
    var sheet = num(inputs.sheet);
    var pieces = num(inputs.pieces);
    var other = num(inputs.other) || 0;
    var minutes = num(inputs.minutes) || 0;
    var rate = num(inputs.rate) || 0;
    var fee = num(inputs.fee) || 0;
    var margin = num(inputs.margin);

    var transfer = sheet !== null && pieces ? sheet / pieces : 0;
    var time = (minutes / 60) * rate;
    var cost = (blank || 0) + transfer + other + time;
    var haveCost = blank !== null || (sheet !== null && pieces) || other || time;

    if (!haveCost || margin === null) {
      outPrice.textContent = 'Fill in the blanks';
      outSub.textContent = haveCost ? 'Add the profit you want to see a price.' : 'Enter your costs and the profit you want. Nothing is saved or sent.';
      breakEl.hidden = true;
      markEl.hidden = true;
      return;
    }
    var denom = 1 - margin / 100 - fee / 100;
    if (denom <= 0.01) {
      outPrice.textContent = 'Not possible';
      outSub.textContent = 'Profit plus fees add up to nearly 100% of the price.';
      warn.hidden = false;
      warn.textContent = 'Lower the profit percent or the fee percent.';
      breakEl.hidden = true;
      markEl.hidden = true;
      return;
    }
    var price = cost / denom;
    var fees = price * (fee / 100);
    var profit = price - cost - fees;
    outPrice.textContent = usd(price);
    outSub.textContent = 'Per shirt, to keep ' + margin + '% after fees. Round up to a price that feels right.';
    set('[data-b-blank]', usd(blank || 0));
    set('[data-b-transfer]', usd(transfer));
    set('[data-b-other]', usd(other));
    set('[data-b-time]', usd(time));
    set('[data-b-cost]', usd(cost));
    set('[data-b-fees]', usd(fees));
    set('[data-b-profit]', usd(profit));
    breakEl.hidden = false;
    markEl.hidden = false;
    set('[data-m-markup]', cost > 0 ? Math.round((price / cost - 1) * 100) + '%' : 'n/a');
    var q = parseInt(qty.value, 10);
    set('[data-m-total]', q > 0 ? usd(profit * q) : 'enter a number');
  }

  Object.keys(inputs).forEach(function (k) {
    inputs[k].addEventListener('input', calc);
  });
  qty.addEventListener('input', calc);
  MM.$('[data-calc-clear]').addEventListener('click', function () {
    Object.keys(inputs).forEach(function (k) {
      inputs[k].value = '';
    });
    qty.value = '';
    pick.value = '';
    calc();
  });
  MM.$$('[data-print]').forEach(function (b) {
    b.addEventListener('click', function () {
      window.print();
    });
  });

  var pick = MM.$('[data-pick-blank]');
  var hint = MM.$('[data-pick-hint]');
  var prices = {};
  fetch(MM.url('data/products.json'))
    .then(function (r) {
      return r.json();
    })
    .then(function (d) {
      var list = (d.products || []).filter(function (p) {
        return p.primary_category === 'blanks-apparel' && typeof p.price === 'number';
      });
      list.sort(function (a, b) {
        return a.display_name.localeCompare(b.display_name);
      });
      list.forEach(function (p) {
        prices[p.id] = p.price;
        var o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.display_name + ' (' + (p.price_is_from ? 'from ' : '') + usd(p.price) + ')';
        pick.appendChild(o);
      });
    })
    .catch(function () {
      pick.disabled = true;
      hint.textContent = 'The shop list did not load. Type your blank cost below.';
    });
  pick.addEventListener('change', function () {
    if (pick.value && prices[pick.value] != null) {
      inputs.blank.value = prices[pick.value].toFixed(2);
      calc();
    }
  });
  calc();
})();
