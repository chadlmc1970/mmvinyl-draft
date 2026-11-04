(function () {
  'use strict';
  var OD = window.OD;
  var esc = OD.esc;

  var GUIDE = [
    {
      key: 'start', label: 'Start here', go: null,
      what: 'The dashboard is the one place you run M&M Vinyl. Seven screens in the left menu: Today, Orders, Gang Sheets, Social, Customers, Money, and Settings. Web and in-store orders show together.',
      why: 'Nothing slips by without you seeing it: a late order, a failed payment, a reseller who stopped ordering. You stop checking five different systems.',
      when: [
        ['Morning', 'Open Today. Clear What needs you now.'],
        ['Before the cutoff', 'Check Orders, In the shop. Is anything stuck or at risk?'],
        ['End of day', 'Orders, Ready. Every ready order should have a pickup text sent.'],
        ['Monday', 'Money, Weekly report. Customers, Resellers, to see who went quiet.']
      ],
      how: [
        'Click a screen in the left menu.',
        'Click any row to open its details on the right. Press Esc to close.',
        'Press ? anywhere to see the keyboard shortcuts.',
        'A number next to Today is how many things need you right now.'
      ]
    },
    {
      key: 'today', label: 'Today', go: 'today',
      what: 'A short list of what needs you right now, and a board of every order in the shop. The strip on top shows gang sheets this month, orders today, and sales for the last 6 open days.',
      why: 'The most urgent thing is always first, so you never hunt for it. Late orders, failed payments, waiting quotes, new applications, and resellers who went quiet all land here.',
      when: [
        ['First thing', 'Work the list from the top.'],
        ['Midday', 'Look again. New items show up as orders come in.'],
        ['Before the cutoff', 'Make sure nothing due soon is still not started.']
      ],
      how: [
        'Read the top item. The line under it says why it needs you.',
        'Press its button (Text about art, Text to retry, Reply, and so on). The item clears when it is done.',
        'Use the board to switch between In the shop and Ready.',
        'Keyboard: j and k move up and down, Enter does the action, e opens the order.'
      ]
    },
    {
      key: 'orders', label: 'Orders', go: 'orders',
      what: 'Every order in one list, web and in-store. Tabs: In the shop, Ready, Shipping, Done. The panel on the right shows how full Printer 1 and Printer 2 are today.',
      why: 'You can see exactly where an order is (Received, Art, Printing, Ready, Done) and whether it is at risk, without logging into the website admin or the register.',
      when: [
        ['A customer calls', 'Search their name or order number.'],
        ['A job finishes printing', 'Mark it ready.'],
        ['Printers look full', 'Check the load before promising a time.']
      ],
      how: [
        'Pick a tab, or type in Search orders.',
        'Use Filters to show only web or only store, or one payment type.',
        'Click an order to see its items, payment, and pickup or shipping.',
        'When it is printed, press Mark ready, then send the pickup text.'
      ]
    },
    {
      key: 'social', label: 'Social', go: 'social',
      what: 'Every Instagram and Facebook post, how many times it was seen, and how many orders came from social. What we are learning shows which kinds of posts work best and what the next batch will do.',
      why: 'Posts should bring in orders, not just likes. Each batch is shaped by what the last one proved, so the page gets smarter every week.',
      when: [
        ['Monday', 'Open Results. Are orders from social beating the number to beat?'],
        ['Once a month', 'Open What we are learning and read the next batch plan.']
      ],
      how: [
        'Click a post to see its picture, results, and link.',
        'Scores lock in at 48 hours and 7 days after a post goes out.',
        'Rules start after 12 scored posts and 21 days. Before that, topics stay evenly mixed.',
        'The score is reactions, comments, shares, and clicks for every 100 times seen.'
      ]
    },
    {
      key: 'customers', label: 'Customers', go: 'customers',
      what: 'Five tabs: Resellers (slipping accounts first), Applications, Quotes, Texts, and Reviews.',
      why: 'About 90% of your customers resell, so one reseller going quiet is real money. Quotes get a reminder after 24 hours. Approving an application unlocks that reseller\'s tier prices on the site.',
      when: [
        ['Monday', 'Resellers: who is slipping or gone quiet?'],
        ['Daily', 'Applications and Quotes when a number shows on the tab.'],
        ['Weekly', 'Reviews, and your Google listing.']
      ],
      how: [
        'Resellers: click one to see orders per week and a ready-made nudge text. Edit it and send.',
        'Applications: read it, then Approve.',
        'Quotes: press Reply.',
        'Texts: a log of every automated text sent, so you can check one went out.'
      ]
    },
    {
      key: 'money', label: 'Money', go: 'money',
      what: 'Sales for the last 6 open days against the 6 before, the average order (web and store), your next payout, and a daily sales chart. Buttons under the chart open more detail.',
      why: 'You know in seconds whether you are up or down, and you catch failed payments (Venmo and PayPal fail at times) before a customer gives up.',
      when: [
        ['End of day', 'A quick look at the chart.'],
        ['A failed payment shows on Today', 'Open Failed payments and send the retry.'],
        ['Monday', 'Print the Weekly report.']
      ],
      how: [
        'Hover a bar, or use the arrow keys, to see that day\'s sales.',
        'Buttons: By category, Top products, How people pay, Failed payments, Payouts.',
        'In Failed payments, press Text to retry to send the customer a new payment link.',
        'Press Weekly report, then Print or save as PDF.'
      ]
    },
    {
      key: 'settings', label: 'Settings', go: 'settings',
      what: 'Four tiles: Cutoffs and hours, Announcement banner, Text messages, and Connections.',
      why: 'You change the site and what customers are told without calling anyone. The cutoff you set drives the countdown on the website and on Today.',
      when: [
        ['Holiday or weather closure', 'Update hours and the banner.'],
        ['A sale or news', 'Turn the banner on.'],
        ['Before pickup texts go automatic', 'Read the wording and approve it.']
      ],
      how: [
        'Click a tile, change it, save.',
        'Pickup-ready texts stay off until you approve the wording.',
        'Connections shows where every number comes from: Live, Ready to connect, Needs access, or To confirm.',
        'Printer capacity is here too. Set it once and the printer meters on Orders use it.'
      ]
    }
  ];

  function box(letter, title, body) {
    return '<section class="od-gd__box od-gd__box--' + letter + '"><h3><span>' + letter.toUpperCase() + '</span>' + esc(title) + '</h3>' + body + '</section>';
  }

  function panel(g) {
    var when = '<ul class="od-gd__when">' + g.when.map(function (w) { return '<li><b>' + esc(w[0]) + '</b><span>' + esc(w[1]) + '</span></li>'; }).join('') + '</ul>';
    var how = '<ol class="od-gd__how">' + g.how.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>';
    return '<div class="od-gd__grid">' +
      '<div class="od-gd__col">' +
      box('w', 'What it is', '<p>' + esc(g.what) + '</p>') +
      box('y', 'Why it matters', '<p>' + esc(g.why) + '</p>') +
      '</div>' +
      '<div class="od-gd__col">' + box('t', 'When to use it', when) + box('h', 'How to use it', how) +
      (g.go ? '<a class="od-btn od-gd__go" href="#/' + g.go + '">Open ' + esc(g.label) + OD.icon('arrow') + '</a>' : '') +
      '</div></div>';
  }

  OD.views.guide = function () {
    var sel = OD.ui.guideSeg || 'start';
    var tabs = '<div class="od-seg" role="group" aria-label="Guide">' + GUIDE.map(function (g) {
      return '<button type="button" class="od-seg__b' + (g.key === sel ? ' is-on' : '') + '" data-gseg="' + g.key + '">' + esc(g.label) + '</button>';
    }).join('') + '</div>';
    function find(k) { return GUIDE.filter(function (g) { return g.key === k; })[0] || GUIDE[0]; }
    return {
      title: 'Guide',
      html: OD.card('', tabs + '<div data-gbody class="od-swap-in">' + panel(find(sel)) + '</div><p class="od-note od-gd__foot">' + (OD.isLive() ? 'This dashboard shows live store data.' : 'This preview uses sample data. Counts marked Real are real.') + '</p>', {}),
      mount: function (root) {
        var host = root.querySelector('[data-gbody]');
        root.addEventListener('click', function (e) {
          var b = e.target.closest('[data-gseg]');
          if (!b) return;
          OD.ui.guideSeg = b.getAttribute('data-gseg');
          root.querySelectorAll('[data-gseg]').forEach(function (x) { x.classList.toggle('is-on', x === b); });
          host.innerHTML = panel(find(OD.ui.guideSeg));
          host.classList.remove('od-swap-in');
          void host.offsetWidth;
          host.classList.add('od-swap-in');
        });
      }
    };
  };
})();
