/* ============================================================
   Стилус вместо курсора + след, будто делаешь набросок.

   Подключается одной строкой: <script src="js/stylus-cursor.js" defer></script>
   Работает только там, где есть настоящий курсор (мышь, трекпад).
   На тач-экранах и при отключённых анимациях не включается вовсе.

   Настройки — в объекте CFG ниже.
   ============================================================ */
(function () {
  'use strict';

  var CFG = {
    color:      '#f5f0d2',  // цвет следа
    stylus:     true,       // рисовать сам стилус
    life:       900,        // сколько живёт след, мс
    widthSlow:  9.5,          // толщина при медленном движении
    widthFast:  2.2,        // толщина при быстром
    pressBoost: 1.7,        // во сколько раз толще с зажатой кнопкой
    maxAlpha:   .75,        // непрозрачность свежего следа
    tilt:       35          // наклон стилуса, градусов
  };

  var fine = matchMedia('(pointer: fine)').matches;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

  /* ---------- холст для следа ---------- */
  var cv = document.createElement('canvas');
  cv.className = 'stylus-trail';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');

  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(innerWidth  * dpr);
    cv.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- сам стилус ---------- */
  var pen = null;
  if (CFG.stylus) {
    pen = document.createElement('div');
    pen.className = 'stylus-pen';
    pen.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;' +
                        'z-index:9999;opacity:0;transition:opacity .25s ease';
    pen.innerHTML =
      '<svg width="112" height="112" viewBox="0 0 112 112" style="position:absolute;left:-14px;top:-104px;' +
      'transform-origin:14px 104px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))">' +
        '<g id="stylus-body">' +
          /* корпус */
          '<path d="M7.5 26a6.5 6.5 0 0 1 13 0v56h-13z" fill="#f7f2d8"/>' +
          /* тень на корпусе, чтобы читался объём */
          '<path d="M15 19.6c3.3 1 5.5 3.9 5.5 6.4v56H15z" fill="#d9d2b0"/>' +
          /* поясок */
          '<rect x="7.5" y="82" width="13" height="7" fill="#b9b192"/>' +
          /* конус */
          '<path d="M7.5 89h13l-4.6 12.5a2 2 0 0 1-3.8 0z" fill="#efe9cd"/>' +
          /* грифель */
          '<path d="M12.1 101.5h3.8L14 106.6z" fill="#0b1222"/>' +
        '</g>' +
      '</svg>';
    document.body.appendChild(pen);
    document.documentElement.style.cursor = 'none';
  }
  var svg = pen && pen.querySelector('svg');

  /* ---------- состояние ---------- */
  var pts = [];            // точки следа
  var x = -999, y = -999;  // текущее положение
  var px = x, py = y;      // предыдущее
  var down = false;
  var lean = 0;            // наклон от скорости
  var visible = false;

  function show(v) {
    visible = v;
    if (pen) pen.style.opacity = v ? '1' : '0';
  }

  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    x = e.clientX; y = e.clientY;
    var d = Math.hypot(x - px, y - py);
    var w = CFG.widthSlow - (CFG.widthSlow - CFG.widthFast) * Math.min(d / 28, 1);
    if (down) w *= CFG.pressBoost;
    pts.push({ x: x, y: y, w: w, t: performance.now() });
    if (pts.length > 260) pts.shift();
    lean += ((x - px) * 0.55 - lean) * 0.25;
    px = x; py = y;
    if (!visible) show(true);
  }, { passive: true });

  addEventListener('pointerdown', function (e) { if (e.pointerType !== 'touch') down = true; }, { passive: true });
  addEventListener('pointerup',   function () { down = false; }, { passive: true });
  addEventListener('mouseleave',  function () { show(false); });
  addEventListener('mouseenter',  function () { show(true); });
  document.addEventListener('mouseleave', function () { show(false); });

  /* ---------- отрисовка ---------- */
  function frame() {
    var now = performance.now();

    /* стилус: остриё точно в точке курсора, наклон чуть ведёт за движением */
    if (pen) {
      pen.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      var t = CFG.tilt + Math.max(-14, Math.min(14, lean));
      svg.style.transform = 'rotate(' + t.toFixed(2) + 'deg)';
      lean *= 0.9;
    }

    /* след */
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    while (pts.length && now - pts[0].t > CFG.life) pts.shift();

    if (pts.length > 1) {
      ctx.strokeStyle = CFG.color;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var age = (now - b.t) / CFG.life;          // 0 — свежий, 1 — исчез
        var k = 1 - age;
        ctx.globalAlpha = CFG.maxAlpha * k * k;    // гаснет мягко, а не линейно
        ctx.lineWidth = Math.max(0.4, b.w * (0.35 + 0.65 * k));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ctx.quadraticCurveTo(a.x, a.y, mx, my);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* наружу — чтобы демо-страница могла переключать варианты */
  window.StylusCursor = {
    cfg: CFG,
    setColor: function (c) { CFG.color = c; },
    setStylus: function (on) {
      CFG.stylus = on;
      if (pen) pen.style.display = on ? '' : 'none';
      document.documentElement.style.cursor = on ? 'none' : '';
    }
  };
})();
