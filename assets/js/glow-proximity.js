(function () {
  var palette = [
    '#a78bfa', '#60a5fa', '#34d399', '#7c3aed',
    '#ca8a04', '#1d4ed8', '#0e7490', '#86198f',
  ];

  function pickColor() {
    var hex = palette[Math.floor(Math.random() * palette.length)];
    return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
  }

  function rgba(c, a) { return 'rgba('+c.r+','+c.g+','+c.b+','+a+')'; }

  function dropGlow(t, c, strong) {
    var s = strong ? 1 : 0.45;
    return 'brightness('+(1+0.12*t*s)+') '+
      'drop-shadow(0 0 8px '+rgba(c,1.00*t*s)+') '+
      'drop-shadow(0 0 35px '+rgba(c,0.60*t*s)+') '+
      'drop-shadow(0 0 80px '+rgba(c,0.28*t*s)+')';
  }

  function textGlow(t, c) {
    return '0 0 6px '+rgba(c,1.00*t)+', 0 0 25px '+rgba(c,0.65*t)+', 0 0 60px '+rgba(c,0.30*t);
  }

  function memberGlow(t, c) {
    return '0 0 10px '+rgba(c,1.00*t)+', 0 0 32px '+rgba(c,0.60*t)+', 0 0 70px '+rgba(c,0.28*t);
  }

  function socialGlow(t, c) {
    return 'drop-shadow(0 0 5px '+rgba(c,0.95*t)+') '+
           'drop-shadow(0 0 20px '+rgba(c,0.55*t)+') '+
           'drop-shadow(0 0 45px '+rgba(c,0.25*t)+')';
  }

  function navGlow(t, c) {
    return '0 0 6px '+rgba(c,0.90*t)+', 0 0 22px '+rgba(c,0.45*t);
  }

  function cardGlow(t, c) {
    return '0 0 14px '+rgba(c,0.70*t)+', 0 0 45px '+rgba(c,0.35*t);
  }

  function distToRect(mx, my, rect) {
    var dx = Math.max(rect.left - mx, 0, mx - rect.right);
    var dy = Math.max(rect.top  - my, 0, my - rect.bottom);
    return Math.sqrt(dx*dx + dy*dy);
  }

  function falloff(dist, maxDist) {
    if (dist >= maxDist) return 0;
    var t = 1 - dist / maxDist;
    return t * t;
  }

  function col(el) {
    if (!el._gc) el._gc = pickColor();
    return el._gc;
  }

  // Each target: { el, maxDist, apply, prevT }
  // prevT lets us skip style mutations when intensity barely changed
  var allTargets = [];
  var cachedRects = [];
  var initialized = false;
  var isMobile = window.matchMedia('(hover: none)').matches;

  function addTargets(nodeList, maxDist, applyFn) {
    Array.from(nodeList).forEach(function(el) {
      col(el);
      allTargets.push({ el: el, maxDist: maxDist, apply: applyFn, prevT: -1 });
    });
  }

  function buildTargetList() {
    allTargets = [];

    addTargets(document.querySelectorAll('.site-logo'), 320, function(t, el) {
      el.style.filter = t > 0 ? dropGlow(t, col(el), true) : '';
    });
    addTargets(document.querySelectorAll('.footer-logo'), 260, function(t, el) {
      el.style.filter = t > 0 ? dropGlow(t, col(el), true) : '';
    });
    addTargets(document.querySelectorAll('.frog-image'), 220, function(t, el) {
      el.style.filter = t > 0 ? dropGlow(t, col(el), false) : '';
    });
    addTargets(document.querySelectorAll('.section-title, .page-title'), 220, function(t, el) {
      el.style.textShadow = t > 0 ? textGlow(t, col(el)) : 'none';
    });
    // Set each member's border to their own color immediately, then animate glow on proximity
    Array.from(document.querySelectorAll('.band-member-photo')).forEach(function(el) {
      el.style.borderColor = rgba(col(el), 0.55);
    });
    addTargets(document.querySelectorAll('.band-member-photo'), 200, function(t, el) {
      el.style.boxShadow = t > 0 ? memberGlow(t, col(el)) : 'none';
    });
    addTargets(document.querySelectorAll('.photo-grid img'), 200, function(t, el) {
      el.style.boxShadow = t > 0 ? memberGlow(t, col(el)) : 'none';
    });
    addTargets(document.querySelectorAll('div.content nav a'), 180, function(t, el) {
      el.style.filter = t > 0 ? socialGlow(t, col(el)) : '';
    });
    addTargets(document.querySelectorAll('.video-card'), 160, function(t, el) {
      el.style.boxShadow = t > 0 ? cardGlow(t, col(el)) : '';
    });
    if (!isMobile) {
      addTargets(document.querySelectorAll('.topnav a'), 150, function(t, el) {
        el.style.textShadow = t > 0 ? navGlow(t, col(el)) : 'none';
      });
    }

    refreshRects();
    initialized = true;
    if (isMobile) mobileUpdate();
  }

  // Rects cached at startup and on scroll/resize — never on mousemove
  function refreshRects() {
    cachedRects = allTargets.map(function(tgt) {
      return tgt.el.getBoundingClientRect();
    });
  }

  var rectRafPending = false;
  function scheduleRectRefresh() {
    if (!rectRafPending) {
      rectRafPending = true;
      requestAnimationFrame(function() { rectRafPending = false; refreshRects(); });
    }
  }

  var THRESHOLD = 0.015; // skip style update if intensity changed less than this

  var mx = -9999, my = -9999, rafPending = false;

  function desktopUpdate() {
    rafPending = false;
    for (var i = 0; i < allTargets.length; i++) {
      var tgt = allTargets[i];
      var t = falloff(distToRect(mx, my, cachedRects[i]), tgt.maxDist);
      if (Math.abs(t - tgt.prevT) < THRESHOLD) continue;
      tgt.prevT = t;
      tgt.apply(t, tgt.el);
    }
  }

  function mobileUpdate() {
    if (!initialized) return;
    var vh = window.innerHeight;
    var fadeRange = vh * 0.25;
    for (var i = 0; i < allTargets.length; i++) {
      var tgt = allTargets[i];
      var rect = cachedRects[i];
      var elCenter = (rect.top + rect.bottom) / 2;
      var t = falloff(Math.abs(elCenter - vh / 2), fadeRange);
      if (Math.abs(t - tgt.prevT) < THRESHOLD) continue;
      tgt.prevT = t;
      tgt.apply(t, tgt.el);
    }
  }

  if (!isMobile) {
    document.addEventListener('mousemove', function(e) {
      mx = e.clientX; my = e.clientY;
      if (!rafPending) { rafPending = true; requestAnimationFrame(desktopUpdate); }
    });
    document.addEventListener('mouseleave', function() {
      mx = -9999; my = -9999;
      requestAnimationFrame(desktopUpdate);
    });
  } else {
    var scrollPending = false;
    window.addEventListener('scroll', function() {
      scheduleRectRefresh();
      if (!scrollPending && initialized) {
        scrollPending = true;
        requestAnimationFrame(function() { scrollPending = false; mobileUpdate(); });
      }
    }, { passive: true });
  }

  window.addEventListener('scroll', scheduleRectRefresh, { passive: true });
  window.addEventListener('resize', scheduleRectRefresh, { passive: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildTargetList);
  } else {
    buildTargetList();
  }
})();
