(function () {
  var root = document.documentElement;

  function $(s, c) { return (c || document).querySelector(s); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function getJSON(path) {
    return fetch(path, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return null; });
  }
  var fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
  function fdate(s) {
    var p = String(s || '').split('-');
    if (p.length !== 3) return '';
    return fmt.format(new Date(+p[0], +p[1] - 1, +p[2])).replace('.', '');
  }
  // Solo enlaces seguros: https, mailto, anclas o rutas del propio sitio
  function safeUrl(u) {
    u = String(u || '');
    return /^(https:\/\/|mailto:|#|[a-z0-9_\-\/.]+(#[\w-]+)?$)/i.test(u) ? u : '';
  }

  // ---------- tema y año (todas las páginas) ----------
  var key = 'theme';
  try { var saved = localStorage.getItem(key); if (saved) root.setAttribute('data-theme', saved); } catch (e) {}
  var btn = $('#theme');
  if (btn) btn.addEventListener('click', function () {
    var dark = root.getAttribute('data-theme') === 'dark' ||
      (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(key, next); } catch (e) {}
  });
  var year = $('#year'); if (year) year.textContent = new Date().getFullYear();

  // ---------- portada ----------
  var all = $('#all');
  if (!all) return;

  var TT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 3v11.2a3.7 3.7 0 1 1-3.7-3.7"/><path d="M14.5 3c.3 2.4 1.9 4.2 4.5 4.4"/></svg>';
  var SOURCES = [
    { key: 'instagram', label: 'Instagram', file: 'data/instagram.json', icon: null, grid: '#grid-instagram', follow: '#ig-follow', profile: function (h) { return 'https://www.instagram.com/' + h + '/'; } },
    { key: 'tiktok', label: 'TikTok', file: 'data/tiktok.json', icon: TT_ICON, grid: '#grid-tiktok', follow: '#tt-follow', profile: function (h) { return 'https://www.tiktok.com/@' + h; } }
  ];
  var IG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>';

  SOURCES[0].icon = IG_ICON;

  // Pestañas en forma de rueda. Con el puntero encima, la píldora se centra y su descripción
  // aparece abajo (vista previa); el contenido solo cambia al hacer clic. La URL (#blog, #instagram…)
  // recuerda la sección elegida.
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var tabsEl = $('.tabs'), trackEl = $('.track'), hint = $('#hint');
  var views = {};
  tabs.forEach(function (t) { views[t.dataset.view] = document.getElementById('v-' + t.dataset.view); });
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAD = 24;
  var current = null, selected = tabs[0], peekTab = null, leaveT = null, hoverMouse = false, capT = null, wheel = false;
  var dwellT = null, px = 0, gate = null;
  var DWELL = 140;                    // ms que el puntero debe quedarse sobre una opción para que la rueda la centre
  var EDGE = 6;                       // tolerancia (px) alrededor de cada píldora, solo si el puntero no está sobre ninguna
  var MOVE = 3;                       // movimiento mínimo (px) para cambiar de opción justo después de girar la rueda
  var sentinel = $('#tabs-sentinel'), tbar = $('#tabs-bar');

  // Al bajar, la barra se compacta: se oculta la leyenda y se afinan los márgenes
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      tbar.classList.toggle('stuck', !e[0].isIntersecting && e[0].boundingClientRect.top < 0);
    }).observe(sentinel);
  }

  // Rueda: solo con mouse y cuando todas las opciones caben en la barra.
  // En pantallas táctiles o angostas la barra se desliza con el dedo.
  function slotW() { return (tabsEl.clientWidth - PAD * 2) / tabs.length; }
  function setMode() {
    tabsEl.style.setProperty('--tabs-w', tabsEl.clientWidth + 'px');
    var w = matchMedia('(hover: hover) and (pointer: fine)').matches && slotW() >= 100;
    wheel = w;
    tabsEl.classList.toggle('wheel', w);
    trackEl.style.transform = '';
    tabsEl.scrollLeft = 0;
  }
  // Coloca la pista para que la píldora dada quede al centro (o en reposo si no hay ninguna)
  function align(t, instant) {
    if (wheel) {
      if (!t) { trackEl.style.transform = ''; return; }
      // Tras girar, el puntero puede quedar sobre otra píldora: se ignora el temblor mínimo del mouse
      // hasta que haya un movimiento real, para que la rueda no siga girando sola.
      if (hoverMouse) gate = px;
      var c = t.offsetLeft + t.offsetWidth / 2;
      trackEl.style.transform = 'translateX(' + (tabsEl.clientWidth / 2 - c) + 'px)';
    } else if (t) {
      var left = t.offsetLeft + t.offsetWidth / 2 - tabsEl.clientWidth / 2;
      tabsEl.scrollTo({ left: left, behavior: (instant || reduced) ? 'auto' : 'smooth' });
    }
  }
  function setCaption(text) {
    if (!hint || hint.textContent === text) return;
    clearTimeout(capT);
    hint.classList.add('swap');
    capT = setTimeout(function () { hint.textContent = text; hint.classList.remove('swap'); }, reduced ? 0 : 140);
  }
  function markPeek() { tabs.forEach(function (x) { x.classList.toggle('peek', x === peekTab && x !== selected); }); }
  function peek(t, center) {
    peekTab = t; markPeek();
    setCaption(t.dataset.caption);
    if (center) align(t);
  }
  function rest() {
    clearTimeout(dwellT); gate = null;
    peekTab = null; markPeek();
    setCaption(selected.dataset.caption);
    align(wheel ? null : selected);
  }

  // Píldora que realmente se ve bajo el puntero. Gana la que lo contiene; la tolerancia solo se usa si no hay ninguna.
  function pillAt(x) {
    var bar = tabsEl.getBoundingClientRect(), inside = null, id = Infinity, near = null, nd = Infinity;
    tabs.forEach(function (t) {
      var r = t.getBoundingClientRect();
      if (r.right < bar.left || r.left > bar.right) return;                 // fuera de la barra
      var c = Math.abs(x - (r.left + r.right) / 2);
      if (x >= r.left && x <= r.right) { if (c < id) { id = c; inside = t; } }
      else if (x >= r.left - EDGE && x <= r.right + EDGE) { if (c < nd) { nd = c; near = t; } }
    });
    return inside || near;
  }
  function isCentered(t) {
    var bar = tabsEl.getBoundingClientRect(), r = t.getBoundingClientRect();
    return Math.abs((r.left + r.right) / 2 - (bar.left + bar.right) / 2) < 3;
  }
  tabsEl.addEventListener('pointerenter', function (e) {
    if (e.pointerType !== 'mouse') return;
    hoverMouse = true; clearTimeout(leaveT); gate = null;
  });
  tabsEl.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX;
    if (!wheel) {
      var h = e.target.closest ? e.target.closest('.tab') : null;
      if (h && h !== peekTab) peek(h, false);
      return;
    }
    if (gate !== null) { if (Math.abs(px - gate) < MOVE) return; gate = null; }
    var t = pillAt(px);
    if (!t) return;                                  // zona vacía: se mantiene la opción actual
    if (t !== peekTab) peek(t, false);               // vista previa inmediata (descripción y resalte)
    clearTimeout(dwellT);
    if (!isCentered(t)) {                            // la rueda gira solo si el puntero se queda un momento
      dwellT = setTimeout(function () { if (peekTab === t && hoverMouse && !isCentered(t)) align(t); }, DWELL);
    }
  });
  tabsEl.addEventListener('pointerleave', function (e) {
    if (e.pointerType !== 'mouse') return;
    hoverMouse = false; clearTimeout(dwellT); gate = null;
    leaveT = setTimeout(rest, 160);
  });
  tabsEl.addEventListener('focusin', function (e) {
    if (e.target.matches && e.target.matches(':focus-visible')) peek(e.target, true);
  });
  tabsEl.addEventListener('focusout', function (e) {
    if (!tabsEl.contains(e.relatedTarget)) rest();
  });
  tabsEl.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('.tab') : null;
    // En la rueda, el clic confirma la opción que está en vista previa, aunque la píldora ya no esté bajo el puntero
    var t = (hoverMouse && wheel && peekTab) ? peekTab : a;
    if (!t) return;
    e.preventDefault();
    if (location.hash === '#' + t.dataset.view) { show(t.dataset.view, true); return; }
    location.hash = t.dataset.view;
  });
  window.addEventListener('resize', function () { setMode(); align(wheel ? peekTab : (peekTab || selected), true); });

  function show(id, scroll) {
    if (!views[id]) id = 'todo';
    if (id === current) { if (scroll) toBar(); return; }
    current = id;
    tabs.forEach(function (t) {
      var on = t.dataset.view === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) selected = t;
    });
    markPeek();
    setCaption((peekTab || selected).dataset.caption);
    align(wheel ? peekTab : (peekTab || selected), !scroll);
    Object.keys(views).forEach(function (k) {
      var v = views[k]; if (!v) return;
      var on = k === id;
      v.hidden = !on;
      v.classList.remove('show');
      if (on) { void v.offsetWidth; v.classList.add('show'); }
    });
    if (scroll) toBar();
  }
  function toBar() {
    var start = sentinel.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > start) window.scrollTo({ top: start, behavior: 'smooth' });
  }
  function fromHash() { return decodeURIComponent(location.hash.slice(1)) || 'todo'; }
  window.addEventListener('hashchange', function () { show(fromHash(), true); });
  setMode();
  show(fromHash(), false);
  if (hint) hint.textContent = selected.dataset.caption;
  align(wheel ? null : selected, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setMode(); align(wheel ? peekTab : (peekTab || selected), true); });

  Promise.all([getJSON('data/site.json'), getJSON('data/activity.json'), getJSON('blog/posts.json')].concat(SOURCES.map(function (src) { return getJSON(src.file); })))
    .then(function (r) {
      var site = r[0] || {}, act = r[1] || [], posts = (r[2] || []).filter(function (p) { return /^[a-z0-9-]+$/.test(p.slug || ''); });
      var byDate = function (a) { a.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); }); };
      byDate(act); byDate(posts);
      var social = [];
      SOURCES.forEach(function (src, i) {
        var list = r[3 + i] || []; byDate(list);
        list.forEach(function (it) { social.push({ src: src, v: it }); });
        renderGrid(src, list);
      });
      renderSite(site);
      renderFeed(posts, social);
      renderPosts(posts);
      renderActivity(act);
    });

  function handleOf(site, key) { return String(site[key] || '').replace(/[^\w.]/g, ''); }

  function renderSite(site) {
    var items = [];
    SOURCES.forEach(function (src) {
      var h = handleOf(site, src.key);
      var f = $(src.follow);
      if (h) {
        if (f) { f.href = src.profile(h); f.textContent = 'Seguir a @' + h; f.hidden = false; }
        items.push({ label: src.label, url: src.profile(h) });
      }
    });
    (site.links || []).forEach(function (l) { if (l && l.label && /^https:\/\//.test(l.url || '')) items.push(l); });
    var box = $('#socials');
    if (box) items.forEach(function (l) {
      box.appendChild(el('span', 'sep', '·'));
      var a = el('a', null, l.label); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      box.appendChild(a);
    });
    if (site.email) { var m = $('#mail'); if (m) { m.textContent = site.email; m.href = 'mailto:' + site.email; } }
  }

  function meta(kind, date, extra, sample) {
    var m = el('p', 'meta');
    m.appendChild(el('span', 'kind', kind));
    if (date) m.appendChild(el('span', null, fdate(date)));
    if (extra) m.appendChild(el('span', null, extra));
    if (sample) m.appendChild(el('span', 'chip', 'Ejemplo'));
    return m;
  }

  function blogItem(p, i, lead) {
    var a = el('a', 'item blog' + (lead ? ' lead' : ''));
    a.href = 'blog.html#' + p.slug;
    a.style.setProperty('--i', Math.min(i, 8));
    a.appendChild(meta('Blog', p.date, p.minutes ? p.minutes + ' min de lectura' : '', p.sample));
    a.appendChild(el('h3', null, p.title));
    if (p.summary) a.appendChild(el('p', 'sum', p.summary));
    a.appendChild(el('span', 'go', 'Leer entrada'));
    return a;
  }

  function socialItem(src, it, i) {
    var url = safeUrl(it.url), img = safeUrl(it.image);
    var n = url ? el('a', 'item ig') : el('div', 'item ig');
    if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; }
    n.style.setProperty('--i', Math.min(i, 8));
    var text = el('div');
    text.appendChild(meta(src.label, it.date, '', it.sample));
    text.appendChild(el('p', 'cap', it.caption || ''));
    n.appendChild(text);
    var th = el('div', 'thumb');
    if (img) { var im = el('img'); im.src = img; im.alt = ''; im.loading = 'lazy'; th.appendChild(im); }
    else th.innerHTML = src.icon;
    n.appendChild(th);
    return n;
  }

  // "Todo": entradas del blog y publicaciones de todas las redes, mezcladas por fecha
  function renderFeed(posts, social) {
    all.replaceChildren();
    var items = posts.map(function (p) { return { t: 'blog', d: p.date, v: p }; })
      .concat(social.map(function (x) { return { t: 'social', d: x.v.date, v: x.v, src: x.src }; }));
    items.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
    if (!items.length) { all.appendChild(el('p', 'empty', 'Aquí aparecerán mis entradas y publicaciones.')); return; }
    items.forEach(function (it, i) {
      all.appendChild(it.t === 'blog' ? blogItem(it.v, i, i === 0) : socialItem(it.src, it.v, i));
    });
  }

  function renderPosts(posts) {
    var box = $('#posts'); box.replaceChildren();
    if (!posts.length) { box.appendChild(el('p', 'empty', 'Aquí aparecerán mis entradas del blog.')); return; }
    posts.forEach(function (p, i) { box.appendChild(blogItem(p, i, false)); });
  }

  function renderGrid(src, list) {
    var box = $(src.grid); if (!box) return;
    box.replaceChildren();
    if (!list.length) { box.appendChild(el('p', 'empty', 'Aquí aparecerán mis publicaciones de ' + src.label + '.')); return; }
    list.forEach(function (it, i) {
      var url = safeUrl(it.url), img = safeUrl(it.image);
      var t = url ? el('a', 'tile') : el('div', 'tile');
      if (url) { t.href = url; t.target = '_blank'; t.rel = 'noopener noreferrer'; }
      t.style.setProperty('--i', Math.min(i, 10));
      if (img) { t.classList.add('has-img'); var im = el('img'); im.src = img; im.alt = ''; im.loading = 'lazy'; t.appendChild(im); }
      var top = el('div', 'top'); if (it.sample) top.appendChild(el('span', 'chip', 'Ejemplo'));
      t.appendChild(top);
      t.appendChild(el('p', 'cap', it.caption || ''));
      var foot = el('div', 'foot');
      foot.appendChild(el('span', null, fdate(it.date)));
      if (url) foot.appendChild(el('span', null, 'Ver ↗'));
      t.appendChild(foot);
      box.appendChild(t);
    });
  }

  function renderActivity(act) {
    var box = $('#activity'); box.replaceChildren();
    if (!act.length) { box.appendChild(el('p', 'empty', 'Aquí aparecerá mi actividad reciente.')); return; }
    act.slice(0, 12).forEach(function (a, i) {
      var row = el('div', 'row'); row.style.setProperty('--i', Math.min(i, 10));
      var time = el('time', null, fdate(a.date)); time.setAttribute('datetime', a.date);
      row.appendChild(time);
      var p = el('p');
      p.appendChild(el('span', 'kind', a.type || 'Nota'));
      p.appendChild(document.createTextNode(a.text || ''));
      var u = safeUrl(a.url);
      if (u) { var l = el('a', 'go', 'Ver'); l.href = u; if (/^https:/.test(u)) { l.target = '_blank'; l.rel = 'noopener noreferrer'; } p.appendChild(l); }
      row.appendChild(p);
      box.appendChild(row);
    });
  }
})();
