(function () {
  var palette = [
    '#a78bfa', // violet
    '#60a5fa', // electric blue
    '#34d399', // teal
    '#7c3aed', // dark purple
    '#ca8a04', // golden yellow
    '#1d4ed8', // dark blue
    '#0e7490', // dark cyan
    '#86198f', // dark magenta
  ];

  var hex = palette[Math.floor(Math.random() * palette.length)];
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);

  function rgba(a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

  var root = document.documentElement;
  root.dataset.glowColor = hex; // read by glow-proximity.js

  // Strong glow — logos and member photos
  root.style.setProperty('--lg-base',  rgba(0.60));
  root.style.setProperty('--lg-hi',    rgba(0.90));
  root.style.setProperty('--lg-mid',   rgba(0.55));
  root.style.setProperty('--lg-lo',    rgba(0.30));
  root.style.setProperty('--lg-fade',  rgba(0.12));

  // Soft glow — frog (less intense)
  root.style.setProperty('--lg-soft-base',  rgba(0.22));
  root.style.setProperty('--lg-soft-hi',    rgba(0.38));
  root.style.setProperty('--lg-soft-mid',   rgba(0.18));
  root.style.setProperty('--lg-soft-lo',    rgba(0.08));
  root.style.setProperty('--lg-soft-fade',  rgba(0.03));

  // Text glow — titles
  root.style.setProperty('--lg-text-a', rgba(0.75));
  root.style.setProperty('--lg-text-b', rgba(0.38));
  root.style.setProperty('--lg-text-c', rgba(0.16));
})();
