(function () {
  var bg = document.getElementById('bg');
  if (!bg) return;

  var files = ['image1.jpg', 'image3.jpg', 'image4.jpg', 'image13.jpg', 'image18.jpg'];

  // Fisher-Yates shuffle, pick 4
  for (var i = files.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = files[i]; files[i] = files[j]; files[j] = tmp;
  }
  files = files.slice(0, 4);

  bg.style.display = 'flex';
  bg.style.alignItems = 'stretch';
  bg.style.width = 'auto';
  bg.style.animation = 'none';
  bg.style.background = '#07070f';

  // Each image overlaps the next by OVERLAP px; gradient mask fades both edges
  // so adjacent images visually blend rather than hard-cutting.
  var OVERLAP = 90;
  var mask = 'linear-gradient(to right, transparent 0px, black ' + OVERLAP + 'px, black calc(100% - ' + OVERLAP + 'px), transparent 100%)';

  var loaded = 0;

  files.forEach(function (name) {
    var img = document.createElement('img');
    img.src = 'assets/css/images/backgrounds/' + name;
    img.style.height = '100%';
    img.style.width = 'auto';
    img.style.display = 'block';
    img.style.flexShrink = '0';
    img.style.marginRight = '-' + OVERLAP + 'px';
    img.style.maskImage = mask;
    img.style.webkitMaskImage = mask;
    img.onload = function () {
      loaded++;
      if (loaded === files.length) startAnimation();
    };
    bg.appendChild(img);
  });

  function startAnimation() {
    var totalWidth = bg.scrollWidth;
    bg.style.width = totalWidth + 'px';
    var scrollAmount = Math.max(0, totalWidth - window.innerWidth);
    var styleEl = document.createElement('style');
    styleEl.textContent =
      '@keyframes bg-dynamic {' +
      '  0%   { transform: translate3d(0,0,0); }' +
      '  100% { transform: translate3d(-' + scrollAmount + 'px,0,0); }' +
      '}';
    document.head.appendChild(styleEl);
    var isMobile = window.matchMedia('(hover: none)').matches;
    bg.style.animation = 'bg-dynamic ' + (isMobile ? '120' : '60') + 's linear infinite alternate';
  }
})();
