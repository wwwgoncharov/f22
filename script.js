// F.22 — интерактивный слой сайта.
// Чистый JS без библиотек. Все анимации идут через один requestAnimationFrame
// и трогают только transform / opacity — это и держит скролл плавным.
// Мышиные эффекты (курсор, «магнитные» кнопки, параллакс от мыши) включаются
// только на устройствах с мышью; при «уменьшении движения» всё отключается.

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

    /* ------------------------------------------------------------------
       Мобильное меню (бургер). Собирается здесь, чтобы не дублировать
       разметку на всех 7 страницах. «Проекты» — ссылка на раздел,
       стрелка рядом раскрывает список кейсов.
       ------------------------------------------------------------------ */
    (function buildMobileMenu() {
      var hdr = document.getElementById('siteHeader');
      if (!hdr) return;
      var inProjects = /\/projects\//.test(location.pathname);
      var home = inProjects ? '../index.html' : '';
      var pdir = inProjects ? '' : 'projects/';
      var img = inProjects ? '../images/home/' : 'images/home/';
      var onHome = !!document.querySelector('.hero');
      var arrowOut = '<span class="arrow arrow--out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6"/></svg><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6"/></svg></span>';
      var projects = [
        ['entrance-malina-park', 'Входные группы ЖК «Малина Парк»', 'Девелопмент, Ростов-на-Дону, 2025', '11G11G458MPY3BJP7VB8PRRKVY'],
        ['apartment-arhitektor', 'Квартира 45,7 м² в ЖК «Архитектор»', 'Частный интерьер, Москва, 2025', '28259677558R3R0J8AFCT1VQPZ'],
        ['fromage', 'Ресторан «Fromage»', 'HoReCa, Санкт-Петербург, 2023', '77JVEY8MZJV588YZP59KXNN8CR'],
        ['entrance-greenside', 'Входные группы ЖК «Гринсайд»', 'Девелопмент, Ростов-на-Дону, 2025', '7MHP977G6SNSZMR1BA5CCB39PQ'],
        ['showroom-malina-park', 'Шоурум ЖК «Малина Парк»', 'Девелопмент, Ростов-на-Дону, 2025', '2ZYSMY14TABPABFVN132NM559C'],
        ['house', 'Частный дом 318 м²', 'Частный интерьер, концепт, 2026', '0J0ZRATZMKKG4VMBTREP3DQH4H', 'wip']
      ];
      var current = (location.pathname.match(/projects\/([^\/]+)\.html/) || [])[1];
      var sections = [['about', 'Обо мне'], ['projects', 'Проекты'], ['services', 'Услуги'], ['process', 'Этапы работы'], ['contacts', 'Контакты']];

      // готовые проекты — ссылками; проекты в разработке — отдельной группой внизу, без перехода
      var ready = projects.filter(function (p) { return !p[4]; });
      var wip = projects.filter(function (p) { return p[4] === 'wip'; });
      var subHtml = ready.map(function (p) {
        return '<li><a class="m-menu__project' + (p[0] === current ? ' is-current' : '') + '" href="' + pdir + p[0] + '.html">' +
          '<span class="m-menu__thumb"><img src="' + img + p[3] + '.webp" alt="" loading="lazy" decoding="async"></span>' +
          '<span class="m-menu__ptext"><span class="m-menu__ptitle">' + p[1] + '</span><span class="m-menu__pinfo">' + p[2] + '</span></span>' +
          '<span class="m-menu__parrow">' + arrowOut + '</span></a></li>';
      }).join('');
      if (wip.length) {
        subHtml += '<li class="m-menu__group" aria-hidden="true">В разработке</li>' + wip.map(function (p) {
          return '<li><button type="button" class="m-menu__project m-menu__project--wip" data-wip aria-haspopup="dialog">' +
            '<span class="m-menu__thumb"><img src="' + img + p[3] + '.webp" alt="" loading="lazy" decoding="async"></span>' +
            '<span class="m-menu__ptext"><span class="m-menu__ptitle">' + p[1] + '</span><span class="m-menu__pinfo">Проект в работе — кейс появится позже</span></span>' +
            '<span class="wip-dot" aria-hidden="true"></span></button></li>';
        }).join('');
      }

      var navHtml = sections.map(function (s, i) {
        var num = '<span class="m-menu__num">0' + (i + 1) + '</span>';
        var link = '<a class="m-menu__link" href="' + home + '#' + s[0] + '"' + (onHome ? ' data-spy="' + s[0] + '"' : '') + '>' + num +
          '<span class="m-menu__mask"><span class="m-menu__label">' + s[1] + (s[0] === 'projects' ? '<sup>' + ready.length + '</sup>' : '') + '</span></span></a>';
        if (s[0] !== 'projects') return '<li class="m-menu__item">' + link + '</li>';
        return '<li class="m-menu__item m-menu__item--sub' + (current ? ' is-open' : '') + '"><div class="m-menu__row">' + link +
          '<button type="button" class="m-menu__toggle" aria-expanded="' + (current ? 'true' : 'false') + '" aria-controls="mMenuProjects" aria-label="Список проектов">' +
          '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 6 8 10.5 12.5 6"/></svg></button></div>' +
          '<div class="m-menu__sub" id="mMenuProjects"><div class="m-menu__sub-inner"><ul>' + subHtml + '</ul></div></div></li>';
      }).join('');

      var menu = document.createElement('div');
      menu.className = 'm-menu';
      menu.id = 'mMenu';
      menu.setAttribute('aria-hidden', 'true');
      menu.innerHTML =
        '<div class="m-menu__scroll"><nav class="m-menu__nav" aria-label="Меню"><ul>' + navHtml + '</ul></nav>' +
        '<div class="m-menu__footer">' +
          '<a href="https://t.me/FedosovaKate" class="btn btn--light has-arrow m-menu__cta" target="_blank" rel="noopener"><span class="btn__label"><span data-text="Обсудить проект">Обсудить проект</span></span><span class="btn__icon">' + arrowOut + '</span></a>' +
          '<div class="m-menu__contacts"><a href="tel:+79044472189">+7 904 447-21-89</a><a href="https://t.me/FedosovaKate" target="_blank" rel="noopener" class="has-arrow">Telegram ' + arrowOut + '</a><a href="https://www.instagram.com/fedosova.kate/" target="_blank" rel="noopener" class="has-arrow">Instagram ' + arrowOut + '</a></div>' +
        '</div></div>';
      document.body.appendChild(menu);
      var menuScroll = menu.querySelector('.m-menu__scroll');
      menuScroll.addEventListener('scroll', function () {
        hdr.classList.toggle('is-menu-scrolled', menuScroll.scrollTop > 4);
      }, { passive: true });

      var burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'burger';
      burger.setAttribute('aria-label', 'Открыть меню');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-controls', 'mMenu');
      burger.innerHTML = '<span></span><span></span>';
      hdr.insertBefore(burger, hdr.querySelector('.site-header__progress'));

      var isOpen = false;
      function setOpen(open) {
        if (open === isOpen) return;
        isOpen = open;
        root.classList.toggle('menu-open', open);
        if (!open) hdr.classList.remove('is-menu-scrolled');
        if (open) menuScroll.scrollTop = 0;
        hdr.classList.toggle('is-menu-open', open);
        if (open) hdr.classList.remove('is-hidden');
        menu.setAttribute('aria-hidden', open ? 'false' : 'true');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
        if (open) setTimeout(function () { var f = menu.querySelector('.m-menu__link'); if (f) f.focus({ preventScroll: true }); }, 350);
      }
      burger.addEventListener('click', function () { setOpen(!isOpen); });

      var item = menu.querySelector('.m-menu__item--sub');
      var toggle = menu.querySelector('.m-menu__toggle');
      toggle.addEventListener('click', function () {
        var o = !item.classList.contains('is-open');
        item.classList.toggle('is-open', o);
        toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
      });

      // клик по пункту: сначала закрываем меню, дальше работает общая
      // логика ссылок (плавная прокрутка или переход на другую страницу)
      menu.addEventListener('click', function (e) {
        var a = e.target.closest('a[href]');
        if (a && a.target !== '_blank') setOpen(false);
      });
      // логотип при открытом меню тоже закрывает его
      var logo = hdr.querySelector('.site-header__logo');
      if (logo) logo.addEventListener('click', function () { setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { setOpen(false); burger.focus(); } });
      window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) setOpen(false); });
    })();

    /* ------------------------------------------------------------------
       Проект в разработке: вместо перехода — аккуратное окно
       (карточка на главной и пункт в мобильном меню, атрибут data-wip)
       ------------------------------------------------------------------ */
    (function wipDialog() {
      if (!document.querySelector('[data-wip]')) return;
      var closeIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';
      var out = '<span class="arrow arrow--out"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6"/></svg><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6"/></svg></span>';
      var dlg = document.createElement('div');
      dlg.className = 'wip-modal';
      dlg.setAttribute('role', 'dialog');
      dlg.setAttribute('aria-modal', 'true');
      dlg.setAttribute('aria-labelledby', 'wipTitle');
      dlg.setAttribute('aria-hidden', 'true');
      dlg.innerHTML =
        '<div class="wip-modal__backdrop" data-wip-close></div>' +
        '<div class="wip-modal__card">' +
          '<div class="wip-modal__top"><span class="wip-modal__label"><span class="wip-dot" aria-hidden="true"></span>Проект в разработке</span>' +
          '<button type="button" class="wip-modal__close" data-wip-close aria-label="Закрыть">' + closeIcon + '</button></div>' +
          '<h2 class="wip-modal__title" id="wipTitle">Частный дом 318 м²</h2>' +
          '<p class="wip-modal__text">Этот интерьер ещё в работе, поэтому подробного кейса пока нет. Когда проект будет реализован, здесь появятся фотографии и история создания.</p>' +
          '<p class="wip-modal__text wip-modal__text--soft">Следите за новостями студии:</p>' +
          '<div class="wip-modal__links">' +
            '<a href="https://t.me/FedosovaKate" target="_blank" rel="noopener" class="hover-line has-arrow">Telegram ' + out + '</a>' +
            '<a href="https://www.instagram.com/fedosova.kate/" target="_blank" rel="noopener" class="hover-line has-arrow">Instagram ' + out + '</a>' +
          '</div>' +
          '<button type="button" class="btn btn--dark btn--plain wip-modal__ok" data-wip-close><span class="btn__label"><span data-text="Понятно">Понятно</span></span></button>' +
        '</div>';
      document.body.appendChild(dlg);

      var lastFocus = null, open = false;
      function show() {
        if (open) return; open = true;
        lastFocus = document.activeElement;
        root.classList.add('modal-open');
        dlg.setAttribute('aria-hidden', 'false');
        dlg.classList.add('is-open');
        setTimeout(function () { dlg.querySelector('.wip-modal__close').focus({ preventScroll: true }); }, 60);
      }
      function hide() {
        if (!open) return; open = false;
        dlg.classList.remove('is-open');
        dlg.setAttribute('aria-hidden', 'true');
        root.classList.remove('modal-open');
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      }
      // перехват раньше общего обработчика ссылок (фаза захвата) — никуда не уводит
      document.addEventListener('click', function (e) {
        var t = e.target.closest('[data-wip]');
        if (!t) return;
        e.preventDefault();
        e.stopPropagation();
        show();
      }, true);
      dlg.addEventListener('click', function (e) { if (e.target.closest('[data-wip-close]')) hide(); });
      document.addEventListener('keydown', function (e) {
        if (!open) return;
        if (e.key === 'Escape') { e.stopPropagation(); hide(); }
        if (e.key === 'Tab') {   // фокус не уходит за пределы окна
          var f = dlg.querySelectorAll('button, a[href]'), first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }, true);
    })();

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
        '<svg class="cursor__arrow" viewBox="0 0 24 24"><path d="M7 17 17 7M8.5 7H17v8.5"/></svg>' +
        '<svg class="cursor__arrow cursor__wip" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/></svg>';
      cursorBlob = cursor.querySelector('.cursor__blob');
      document.body.appendChild(cursor);
      document.addEventListener('mouseover', function (e) {
        var t = e.target.closest('[data-cursor]');
        if (t) {
          // у проекта в разработке вместо стрелки ↗ — значок «часы»
          cursor.classList.toggle('is-wip', t.getAttribute('data-cursor') === 'wip');
          cursor.classList.add('is-active');
        }
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
