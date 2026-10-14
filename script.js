// F.22 — интерактивный слой сайта.
// Чистый JS без библиотек. Все анимации идут через один requestAnimationFrame
// и трогают только transform / opacity — это и держит скролл плавным.
// Мышиные эффекты (курсор, «магнитные» кнопки, параллакс от мыши) включаются
// только на устройствах с мышью; при «уменьшении движения» всё отключается.

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  // пока идёт прелоадер, первый экран не запускаем — он стартует, когда прелоадер уходит
  var preloaderActive = root.classList.contains('has-preloader');
  var readyQueued = false;
  function ready() {
    if (preloaderActive) { readyQueued = true; return; }
    root.classList.add('is-ready');
  }

  /* ------------------------------------------------------------------
     Переход между страницами: экран мягко «закрывается» цветом фона
     ------------------------------------------------------------------ */
  var fade = document.createElement('div');
  fade.className = 'page-fade';
  fade.setAttribute('aria-hidden', 'true');
  var cameWithTransition = false;
  try { cameWithTransition = sessionStorage.getItem('f22-fade') === '1'; sessionStorage.removeItem('f22-fade'); } catch (e) {}
  if (cameWithTransition && !reduceMotion) fade.classList.add('is-on');

  document.addEventListener('DOMContentLoaded', function () {
    document.body.appendChild(fade);

    /* ---------- прелоадер: счётчик 0→100 и линия, затем экран уезжает вверх ---------- */
    var pre = document.querySelector('.preloader');
    if (pre && preloaderActive) {
      var line = pre.querySelector('.preloader__line i');
      var count = pre.querySelector('.preloader__count');
      var start = performance.now(), DUR = 1400;
      var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
      (function tick(now) {
        var t = clamp((now - start) / DUR, 0, 1), v = ease(t);
        if (line) line.style.transform = 'scaleX(' + v + ')';
        if (count) count.textContent = String(Math.round(v * 100)).padStart(2, '0');
        if (t < 1) { requestAnimationFrame(tick); return; }
        // первый экран стартует под прелоадером, чтобы фото успело проявиться
        preloaderActive = false;
        if (readyQueued) root.classList.add('is-ready');
        setTimeout(function () {
          pre.classList.add('is-leaving');
          try { sessionStorage.setItem('f22-seen', '1'); } catch (e) {}
          setTimeout(function () {
            root.classList.remove('has-preloader');
            pre.remove();
          }, 850);
        }, 300);
      })(start);
    } else if (pre) { pre.remove(); }
    if (fade.classList.contains('is-on')) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { fade.classList.remove('is-on'); }); });
    }

    // уход со страницы по внутренней ссылке
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;

      // якорь на этой же странице — плавная прокрутка
      if (url.pathname === location.pathname && url.hash) {
        var target = url.hash === '#top' ? document.body : document.querySelector(url.hash);
        if (!target) return;
        e.preventDefault();
        var top = url.hash === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - 24;
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        history.replaceState(null, '', url.hash === '#top' ? location.pathname : url.hash);
        return;
      }
      if (reduceMotion) return;
      e.preventDefault();
      try { sessionStorage.setItem('f22-fade', '1'); } catch (err) {}
      fade.classList.add('is-on');
      setTimeout(function () { location.href = a.href; }, 420);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) fade.classList.remove('is-on'); });

    /* ---------- первый экран ---------- */
    var heroImg = document.querySelector('.hero__parallax img');
    if (!heroImg || reduceMotion) ready();
    else if (heroImg.complete && heroImg.naturalWidth) requestAnimationFrame(function () { requestAnimationFrame(ready); });
    else {
      heroImg.addEventListener('load', ready, { once: true });
      heroImg.addEventListener('error', ready, { once: true });
    }

    /* ---------- страницы кейсов: фото тоже открываются «шторкой» ---------- */
    document.querySelectorAll('.gallery-item.reveal').forEach(function (el) {
      el.classList.remove('reveal'); el.classList.add('reveal-media');
    });
    document.querySelectorAll('.project-sibling__image').forEach(function (el) {
      el.classList.add('reveal-media'); el.setAttribute('data-cursor', 'Открыть');
    });

    /* ---------- фото проявляются только когда уже загружены ---------- */
    document.querySelectorAll('.reveal-media').forEach(function (el) {
      var img = el.querySelector('img');
      if (!img) { el.classList.add('is-loaded'); return; }
      var done = function () { el.classList.add('is-loaded'); };
      if (img.complete && img.naturalWidth) done();
      else { img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true }); }
    });

    /* ---------- цитата: разбиваем на слова ---------- */
    var words = [];
    var statement = document.querySelector('[data-words]');
    if (statement && !reduceMotion) {
      var parts = statement.textContent.trim().split(/(\s+)/);
      statement.textContent = '';
      parts.forEach(function (p) {
        if (/^\s+$/.test(p)) { statement.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement('span');
        s.className = 'w'; s.textContent = p;
        statement.appendChild(s); words.push(s);
      });
    }

    /* ---------- появление при скролле ---------- */
    var items = document.querySelectorAll('.reveal, .reveal-media');
    document.querySelectorAll('[data-reveal-group]').forEach(function (group) {
      group.querySelectorAll('.reveal, .reveal-media').forEach(function (el, i) {
        var d = reduceMotion ? 0 : Math.min(i * 60, 180);
        el.style.transitionDelay = d + 'ms';
        var img = el.classList.contains('reveal-media') ? el.querySelector('img') : null;
        if (img) img.style.transitionDelay = d + 'ms';
      });
    });
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('visible'); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add('visible');
          io.unobserve(el);
          // после появления убираем задержку, чтобы наведение отвечало сразу
          setTimeout(function () {
            el.style.transitionDelay = '';
            var img = el.querySelector && el.querySelector('img');
            if (img) img.style.transitionDelay = '';
          }, 2000);
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
      items.forEach(function (el) { io.observe(el); });
    }

    /* ---------- шапка: подсветка текущего раздела ---------- */
    var spyLinks = document.querySelectorAll('[data-spy]');
    if (spyLinks.length && 'IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          spyLinks.forEach(function (l) { l.classList.toggle('is-active', l.getAttribute('data-spy') === entry.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      spyLinks.forEach(function (l) {
        var sec = document.getElementById(l.getAttribute('data-spy'));
        if (sec) spy.observe(sec);
      });
    }

    /* ---------- курсор над проектами: «стеклянный» кружок со стрелкой ----------
       Кружок плавно догоняет мышь, без пружины и без вытягивания —
       всегда остаётся ровным кругом. Только для мыши, при «уменьшении
       движения» выключен. */
    var cursor = null, cursorBlob = null;
    var mouse = { x: innerWidth / 2, y: innerHeight / 2 }, cur = { x: mouse.x, y: mouse.y };
    if (finePointer && !reduceMotion && document.querySelector('[data-cursor]')) {
      root.classList.add('has-cursor');
      cursor = document.createElement('div');
      cursor.className = 'cursor';
      cursor.setAttribute('aria-hidden', 'true');
      cursor.innerHTML = '<div class="cursor__blob"><div class="cursor__glass"></div></div>' +
        '<svg class="cursor__arrow" viewBox="0 0 24 24"><path d="M7 17 17 7M8.5 7H17v8.5"/></svg>';
      cursorBlob = cursor.querySelector('.cursor__blob');
      document.body.appendChild(cursor);
      document.addEventListener('mouseover', function (e) {
        if (e.target.closest('[data-cursor]')) cursor.classList.add('is-active');
      });
      document.addEventListener('mouseout', function (e) {
        var t = e.target.closest('[data-cursor]');
        if (t && !t.contains(e.relatedTarget)) cursor.classList.remove('is-active');
      });
    }
    window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

    /* ---------- «магнитные» кнопки ---------- */
    if (finePointer && !reduceMotion) {
      document.querySelectorAll('.btn, .to-top .btn__icon').forEach(function (b) {
        b.addEventListener('mousemove', function (e) {
          var r = b.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          b.style.transition = 'transform 0.7s cubic-bezier(0.45, 0, 0.15, 1), color 0.9s, border-color 0.9s, background-color 0.9s';
          b.style.transform = 'translate(' + (dx * 6).toFixed(2) + 'px,' + (dy * 5).toFixed(2) + 'px)';
        });
        b.addEventListener('mouseleave', function () {
          b.style.transition = 'transform 1s cubic-bezier(0.45, 0, 0.15, 1), color 0.9s, border-color 0.9s, background-color 0.9s';
          b.style.transform = '';
        });
      });
    }

    /* ---------- знак F.22 в подвале: на всю ширину + появление ----------
       Края букв (не «коробки» символов) совпадают с полями контейнера,
       база букв и точки стоит на одной линии, а отступ снизу равен
       боковому полю страницы. */
    var mark = document.querySelector('[data-mark]');
    if (mark) {
      var markInner = mark.querySelector('.footer__mark-inner');
      var markBase = mark.querySelector('.footer__mark-bl');
      var chars = mark.querySelectorAll('.ch');
      var ctx = document.createElement('canvas').getContext('2d');
      var fitMark = function () {
        var cs = getComputedStyle(mark);
        mark.style.fontSize = '100px';
        ctx.font = cs.fontWeight + ' 100px ' + cs.fontFamily;
        var firstCh = chars[0], lastCh = chars[chars.length - 1], dotCh = mark.querySelector('.ch--dot');
        var mFirst = ctx.measureText(firstCh.textContent);
        var mLast = ctx.measureText(lastCh.textContent);
        var capH = mFirst.actualBoundingBoxAscent;                 // высота заглавной
        var box = markInner.getBoundingClientRect();
        // реальные края «чернил» букв, без пустых полей символов и разрядки
        var inkL = firstCh.getBoundingClientRect().left - box.left - mFirst.actualBoundingBoxLeft;
        var inkR = lastCh.getBoundingClientRect().left - box.left + mLast.actualBoundingBoxRight;
        var ink = inkR - inkL;
        if (!ink) return;
        var k = mark.clientWidth / ink;
        var size = 100 * k;
        mark.style.fontSize = size.toFixed(2) + 'px';
        markInner.style.left = (-inkL * k).toFixed(2) + 'px';
        // точка круглая и чуть «проседает» под базовую линию — поднимаем её ровно на этот свес
        if (dotCh) dotCh.style.top = (-ctx.measureText(dotCh.textContent).actualBoundingBoxDescent * k).toFixed(2) + 'px';
        var pad = parseFloat(getComputedStyle(mark.parentNode).paddingLeft) || 24;  // боковое поле
        var top = Math.round(size * 0.04);
        mark.style.height = (top + capH * k + pad).toFixed(1) + 'px';
        markInner.style.top = '0px';
        var baseY = markBase.offsetTop;                            // где сейчас базовая линия
        markInner.style.top = (top + capH * k - baseY).toFixed(2) + 'px';
      };
      fitMark();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMark);
      var fitT;
      window.addEventListener('resize', function () { clearTimeout(fitT); fitT = setTimeout(fitMark, 120); });

      if (!('IntersectionObserver' in window) || reduceMotion) {
        mark.classList.add('is-in', 'is-done');
      } else {
        var markIO = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          mark.classList.add('is-in');
          setTimeout(function () { mark.classList.add('is-done'); }, 1700);
          markIO.disconnect();
        }, { threshold: 0.3 });
        markIO.observe(mark);
      }
    }

    /* ---------- копирование почты ---------- */
    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var value = btn.getAttribute('data-copy');
        var done = function () {
          btn.classList.add('is-copied');
          clearTimeout(btn._t);
          btn._t = setTimeout(function () { btn.classList.remove('is-copied'); }, 1800);
        };
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(value).then(done, function () { location.href = 'mailto:' + value; });
        } else {
          location.href = 'mailto:' + value;
        }
      });
    });

    /* ---------- живые часы Ростова в подвале ---------- */
    var clock = document.querySelector('[data-clock]');
    if (clock) {
      var out = clock.querySelector('[data-clock-time]');
      var tick = function () {
        try {
          out.textContent = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date());
          clock.hidden = false;
        } catch (e) { clock.hidden = true; }
      };
      tick(); setInterval(tick, 20000);
    }

    /* ------------------------------------------------------------------
       Один общий цикл: шапка, прогресс, параллакс первого экрана,
       проявление слов цитаты, движение курсора
       ------------------------------------------------------------------ */
    var header = document.getElementById('siteHeader');
    var progress = header && header.querySelector('.site-header__progress');
    var hero = document.querySelector('.hero');
    var heroLayer = document.querySelector('.hero__parallax');
    var heroInner = document.querySelector('.hero__inner');
    var overHeroMode = header && hero && header.hasAttribute('data-hero-header');
    var lastY = window.scrollY, hideAcc = 0;
    var heroMouse = { x: 0, y: 0 };

    function frame() {
      var y = window.scrollY;
      var vh = window.innerHeight;

      // шапка
      if (header) {
        var heroH = hero ? hero.offsetHeight : 0;
        if (overHeroMode) header.classList.toggle('is-over-hero', y < heroH - header.offsetHeight);
        var dy = y - lastY;
        hideAcc = (dy > 0) === (hideAcc > 0) ? hideAcc + dy : dy;
        if (y < Math.max(heroH * 0.6, 200)) header.classList.remove('is-hidden');
        else if (hideAcc > 40) header.classList.add('is-hidden');
        else if (hideAcc < -30) header.classList.remove('is-hidden');
        if (progress) {
          var max = document.documentElement.scrollHeight - vh;
          progress.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0).toFixed(4) + ')';
        }
      }
      lastY = y;

      // первый экран: фото уходит медленнее страницы, текст чуть растворяется
      if (hero && heroLayer && !reduceMotion && y < hero.offsetHeight) {
        if (finePointer) {
          heroMouse.x = lerp(heroMouse.x, (mouse.x / innerWidth - 0.5) * -14, 0.06);
          heroMouse.y = lerp(heroMouse.y, (mouse.y / innerHeight - 0.5) * -10, 0.06);
        }
        heroLayer.style.transform = 'translate3d(' + heroMouse.x.toFixed(2) + 'px,' + (y * 0.22 + heroMouse.y).toFixed(2) + 'px,0)';
        if (heroInner && root.classList.contains('is-ready')) {
          var p = clamp(y / (hero.offsetHeight * 0.7), 0, 1);
          heroInner.style.transform = 'translate3d(0,' + (y * -0.06).toFixed(2) + 'px,0)';
          heroInner.style.opacity = (1 - p * 0.85).toFixed(3);
        }
      }

      // цитата: слова проявляются по мере прокрутки
      if (words.length) {
        var r = statement.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          var prog = clamp((vh * 0.88 - r.top) / (r.height + vh * 0.38), 0, 1);
          var n = words.length;
          for (var i = 0; i < n; i++) {
            var o = clamp(prog * (n + 2) - i, 0, 1);
            words[i].style.setProperty('--o', (0.16 + o * 0.84).toFixed(3));
          }
        }
      }

      // курсор: мягко догоняет мышь, без пружины и без «желе»
      if (cursor) {
        cur.x = lerp(cur.x, mouse.x, 0.2);
        cur.y = lerp(cur.y, mouse.y, 0.2);
        cursor.style.transform = 'translate3d(' + cur.x.toFixed(1) + 'px,' + cur.y.toFixed(1) + 'px,0)';
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
})();
