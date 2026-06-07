(function () {
  const canvas = document.getElementById('waves-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  var NAV_H = 20; // matches CSS nav height

  // Index has photo panorama BG so waves are subtle; other pages have solid dark BG so boost
  var isIndex = !!document.getElementById('bg');
  var waveOpacity = isIndex ? 0.22 : 0.30;
  var waveShadow  = isIndex ? 14   : 24;
  var waveWidth   = isIndex ? 1.1  : 1.5;

  // Non-index: track scroll so waves live in document space instead of viewport space
  var scrollY = 0;
  if (!isIndex) {
    window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });
  }

  function resize() {
    canvas.width = window.innerWidth * dpr;
    canvas.height = (window.innerHeight - NAV_H) * dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  // mouse velocity tracking — offset by nav height
  let mx = canvas.width / 2, my = canvas.height / 2;
  let prevMx = mx, prevMy = my;
  let mouseVel = 0;

  document.addEventListener('mousemove', function (e) {
    mx = e.clientX * dpr;
    my = (e.clientY - NAV_H) * dpr;
  });

  // Touch: spawn ripples on tap and drag, treating each touch point like a mouse
  var lastTouchX = -1, lastTouchY = -1;

  function spawnTouchRipple(clientX, clientY, strength) {
    var tx = clientX * dpr;
    var ty = (clientY - NAV_H) * dpr;
    var scrollPx = scrollY * dpr;
    ripples.push({ x: tx, viewY: ty, docY: ty + scrollPx, age: 0, strength: strength });
    if (ripples.length > 18) ripples.shift();
  }

  document.addEventListener('touchstart', function (e) {
    var touch = e.touches[0];
    lastTouchX = touch.clientX;
    lastTouchY = touch.clientY;
    spawnTouchRipple(touch.clientX, touch.clientY, 0.55);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    var touch = e.touches[0];
    var dx = touch.clientX - lastTouchX;
    var dy = touch.clientY - lastTouchY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4) {
      var strength = Math.min(1, dist / 40);
      spawnTouchRipple(touch.clientX, touch.clientY, strength);
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
  }, { passive: true });

  // Pre-build enough waves for the tallest possible page; active count computed per-frame
  const waves = Array.from({ length: 80 }, function (_, i) {
    var j = i % 9;
    return {
      phase: i * 0.9,
      driftSpeed: 0.006 + j * 0.0015,
      amp: 9 + j * 2.5,
      hue: 238 + j * 13,
    };
  });

  var ripples = [];
  var spawnCooldown = 0;
  var t = 0;

  function draw() {
    var W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    t += 0.16;

    // Scroll offset in canvas pixels — shifts wave Y positions so they move with the page
    var scrollPx = scrollY * dpr;

    // smooth velocity
    var dx = mx - prevMx, dy = my - prevMy;
    var rawVel = Math.sqrt(dx * dx + dy * dy);
    mouseVel = mouseVel * 0.55 + rawVel * 0.45;
    prevMx = mx; prevMy = my;

    // spawn ripples proportional to velocity
    spawnCooldown = Math.max(0, spawnCooldown - 1);
    if (mouseVel > 0.5 && spawnCooldown === 0) {
      var strength = Math.min(1, (mouseVel - 0.5) / 28);
      // Store ripple Y in document space so it stays in place when scrolling
      ripples.push({ x: mx, viewY: my, docY: my + scrollPx, age: 0, strength: strength });
      spawnCooldown = Math.max(2, Math.round(8 - strength * 6));
      if (ripples.length > 18) ripples.shift();
    }

    ripples.forEach(function (r) { r.age += 0.28; });
    ripples = ripples.filter(function (r) { return r.age < 280; });

    // Active wave count: index always 9; non-index scales with page height so density stays constant
    var n = isIndex ? 9 : Math.max(9, Math.min(waves.length, Math.round(document.body.scrollHeight / window.innerHeight * 9)));
    var docH = Math.max(document.body.scrollHeight, window.innerHeight) * dpr;

    for (var i = 0; i < n; i++) {
      var w = waves[i];
      // Non-index: distribute waves across the full document height, then offset by scroll
      // so they scroll with the page. Index: distribute across viewport as before.
      var yBase;
      if (isIndex) {
        yBase = H * 0.08 + (i / (n - 1)) * H * 0.84;
      } else {
        var docYBase = docH * 0.04 + (i / (n - 1)) * docH * 0.92;
        yBase = docYBase - scrollPx;
      }

      ctx.beginPath();

      for (var x = 0; x <= W; x += 3) {
        var y = yBase + Math.sin(x * 0.0065 + t * w.driftSpeed + w.phase) * w.amp;

        ripples.forEach(function (rip) {
          var rdx = x - rip.x;
          // Convert ripple to the same coordinate space as yBase (viewport canvas px)
          var ripY = isIndex ? rip.viewY : (rip.docY - scrollPx);
          var rdy = yBase - ripY;
          var dist = Math.sqrt(rdx * rdx + rdy * rdy);
          // Spread grows with age so the wave front expands outward over time
          var spread = W * W * (0.025 + rip.strength * 0.06) * (1 + rip.age * 0.012);
          var spatialFade = Math.exp(-dist * dist / spread);
          // Quick attack, then slow exponential decay — no hard cutoff
          var timeFade = Math.min(1, rip.age / 6) * Math.exp(-rip.age * 0.010);
          var maxAmp = 2.0 + rip.strength * 11;
          y += Math.sin(dist * 0.028 - rip.age * 0.2) * maxAmp * spatialFade * timeFade;
        });

        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      ctx.strokeStyle = 'hsla(' + w.hue + ', 88%, 68%, ' + waveOpacity + ')';
      ctx.lineWidth = waveWidth;
      ctx.shadowColor = 'hsla(' + w.hue + ', 100%, 72%, 1)';
      ctx.shadowBlur = waveShadow;
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    requestAnimationFrame(draw);
  }

  draw();
})();
