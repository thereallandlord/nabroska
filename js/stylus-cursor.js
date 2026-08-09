/* ============================================================
   Стилус вместо курсора + след, будто делаешь набросок.

   Подключается одной строкой: <script src="js/stylus-cursor.js" defer></script>
   Работает только там, где есть настоящий курсор (мышь, трекпад).
   🔴 На тач-экранах НЕ включается сознательно: холст перерисовывается
   каждый кадр, и на мобильном железе след заметно лагает. Проверено.

   🔴 Как рисуется след — важно.
   След НЕ собран из отрезков с круглыми торцами: у такой сборки торцы
   накладываются друг на друга и линия выглядит цепочкой кружочков.
   Здесь строится ОДНА цельная фигура: осевая линия сглаживается,
   от неё в обе стороны откладывается половина толщины, получившийся
   контур заливается одним заходом. Хвост плавно сходит на нет — поэтому
   след исчезает сам, без ступенек прозрачности.

   Настройки — в объекте CFG ниже.
   ============================================================ */
(function () {
  'use strict';

  var CFG = {
    color:      '#f5f0d2',  // цвет следа
    stylus:     true,       // рисовать сам стилус
    life:       1000,       // сколько живёт след, мс
    widthSlow:  7,          // толщина при медленном движении
    widthFast:  2,          // толщина при быстром
    pressBoost: 1.6,        // во сколько раз толще с зажатой кнопкой
    alpha:      .8,         // непрозрачность следа
    smooth:     .45,        // сглаживание руки: больше — плавнее, но «ленивее»
    tilt:       35          // наклон стилуса, градусов
  };

  var fine = matchMedia('(pointer: fine)').matches;
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || calm) return;

  /* ---------- холст ---------- */
  var cv = document.createElement('canvas');
  cv.className = 'stylus-trail';
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998';
  document.body.appendChild(cv);
  var ctx = cv.getContext('2d');

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width  = Math.round(innerWidth  * dpr);
    cv.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- стилус ---------- */
  var pen = null, svg = null;
  if (CFG.stylus) {
    pen = document.createElement('div');
    pen.className = 'stylus-pen';
    pen.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;' +
                        'z-index:9999;opacity:0;transition:opacity .25s ease';
    pen.innerHTML =
      '<svg width="112" height="112" viewBox="0 0 112 112" style="position:absolute;left:-14px;top:-104px;' +
      'transform-origin:14px 104px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.45))">' +
        '<path d="M7.5 26a6.5 6.5 0 0 1 13 0v56h-13z" fill="#f7f2d8"/>' +
        '<path d="M15 19.6c3.3 1 5.5 3.9 5.5 6.4v56H15z" fill="#d9d2b0"/>' +
        '<rect x="7.5" y="82" width="13" height="7" fill="#b9b192"/>' +
        '<path d="M7.5 89h13l-4.6 12.5a2 2 0 0 1-3.8 0z" fill="#efe9cd"/>' +
        '<path d="M12.1 101.5h3.8L14 106.6z" fill="#0b1222"/>' +
      '</svg>';
    document.body.appendChild(pen);
    document.documentElement.style.cursor = 'none';
    svg = pen.querySelector('svg');
  }

  /* ---------- состояние ---------- */
  var pts = [];               // {x, y, w, t}
  var rawX = -999, rawY = -999;
  var sx = -999, sy = -999;   // сглаженное положение пера
  var lastX = -999, lastY = -999;
  var speed = 0, down = false, lean = 0, visible = false, started = false;

  function show(v) { visible = v; if (pen) pen.style.opacity = v ? '1' : '0'; }

  addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    rawX = e.clientX; rawY = e.clientY;
    if (!started) { sx = rawX; sy = rawY; lastX = rawX; lastY = rawY; started = true; }
    if (!visible) show(true);
  }, { passive: true });

  addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    down = true;
  }, { passive: true });
  addEventListener('pointerup', function () { down = false; }, { passive: true });
  addEventListener('mouseleave',  function () { show(false); });
  addEventListener('mouseenter',  function () { show(true); });
  document.addEventListener('mouseleave', function () { show(false); });

  /* ---------- сглаживание осевой линии (Чайкин) ---------- */
  function chaikin(src) {
    if (src.length < 3) return src;
    var out = [src[0]];
    for (var i = 0; i < src.length - 1; i++) {
      var a = src[i], b = src[i + 1];
      out.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25, w: a.w * .75 + b.w * .25 });
      out.push({ x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75, w: a.w * .25 + b.w * .75 });
    }
    out.push(src[src.length - 1]);
    return out;
  }

  /* ---------- кадр ---------- */
  function frame() {
    var now = performance.now();

    /* рука: тянемся к настоящему курсору, но плавно — так линия перестаёт дёргаться */
    if (started) {
      sx += (rawX - sx) * CFG.smooth;
      sy += (rawY - sy) * CFG.smooth;

      var d = Math.hypot(sx - lastX, sy - lastY);
      speed += (d - speed) * 0.35;
      if (d > 1.2) {
        var w = CFG.widthSlow - (CFG.widthSlow - CFG.widthFast) * Math.min(speed / 22, 1);
        if (down) w *= CFG.pressBoost;
        pts.push({ x: sx, y: sy, w: w, t: now });
        if (pts.length > 200) pts.shift();
        lastX = sx; lastY = sy;
      }
    }

    /* стилус: остриё точно в точке курсора, наклон чуть ведёт за движением */
    if (pen) {
      pen.style.transform = 'translate3d(' + rawX + 'px,' + rawY + 'px,0)';
      lean += ((rawX - sx) * 1.6 - lean) * 0.12;
      var t = CFG.tilt + Math.max(-13, Math.min(13, lean));
      svg.style.transform = 'rotate(' + t.toFixed(2) + 'deg)';
    }

    /* след */
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    while (pts.length && now - pts[0].t > CFG.life) pts.shift();

    if (pts.length > 2) {
      /* толщина каждой точки: базовая × затухание по возрасту,
         плюс хвост принудительно сводится к нулю — без тупого обрыва */
      var n = pts.length, base = [];
      for (var i = 0; i < n; i++) {
        var age = (now - pts[i].t) / CFG.life;
        var fade = Math.pow(Math.max(0, 1 - age), 1.25);
        var tail = Math.min(1, i / 6);        // первые точки хвоста — на нет
        var head = Math.min(1, (n - 1 - i) / 2 + .35);
        base.push({ x: pts[i].x, y: pts[i].y, w: pts[i].w * fade * tail * head });
      }

      var line = chaikin(chaikin(base));      // два прохода — кривая без углов
      var m = line.length;

      /* контур: слева вперёд, справа назад — и одна заливка */
      var L = [], R = [];
      for (var j = 0; j < m; j++) {
        var p = line[j];
        var pa = line[Math.max(0, j - 1)], pb = line[Math.min(m - 1, j + 1)];
        var dx = pb.x - pa.x, dy = pb.y - pa.y;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        var h = p.w / 2;
        L.push([p.x + nx * h, p.y + ny * h]);
        R.push([p.x - nx * h, p.y - ny * h]);
      }

      ctx.beginPath();
      ctx.moveTo(L[0][0], L[0][1]);
      for (var k = 1; k < m; k++) ctx.lineTo(L[k][0], L[k][1]);
      for (var q = m - 1; q >= 0; q--) ctx.lineTo(R[q][0], R[q][1]);
      ctx.closePath();

      /* округлое пятно под остриём, чтобы линия начиналась от пера, а не обрывалась */
      var tip = line[m - 1];
      if (tip.w > 0.6) {
        ctx.moveTo(tip.x + tip.w / 2, tip.y);
        ctx.arc(tip.x, tip.y, tip.w / 2, 0, Math.PI * 2);
      }

      ctx.globalAlpha = CFG.alpha;
      ctx.fillStyle = CFG.color;
      ctx.fill();
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
