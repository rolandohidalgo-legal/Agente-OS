(function () {
  var root = document.documentElement;
  root.classList.add('js');

  // ---------- utilidades ----------
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
  // Solo enlaces seguros: https, mailto o rutas del propio sitio
  function safeUrl(u) {
    u = String(u || '');
    return /^(https:\/\/|mailto:|#|[a-z0-9_\-\/.]+(\.html)?(#[\w-]+)?$)/i.test(u) ? u : '';
  }
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  }
  function reveal(node, delay) {
    node.classList.add('reveal');
    if (delay) node.style.setProperty('--d', delay + 's');
    if (io) io.observe(node); else node.classList.add('in');
  }
  function revealAll(scope) { (scope || document).querySelectorAll('.reveal:not(.in)').forEach(function (n) { if (io) io.observe(n); else n.classList.add('in'); }); }

  // ---------- tema ----------
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

  // ---------- scroll: progreso, nav, sección activa ----------
  var bar = $('#progress'), nav = $('#nav'), ticking = false;
  function onScroll() {
    var y = window.scrollY, max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (nav) nav.classList.toggle('scrolled', y > 12);
    ticking = false;
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  var links = document.querySelectorAll('a[data-spy]'), map = {};
  links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window && links.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          links.forEach(function (a) { a.classList.remove('active'); });
          map[e.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  document.querySelectorAll('.reveal').forEach(function (n) { if (io) io.observe(n); else n.classList.add('in'); });

  // ---------- contenido (solo en la portada) ----------
  var reel = $('#reel');
  if (!reel) return;

  Promise.all([getJSON('data/site.json'), getJSON('data/instagram.json'), getJSON('data/activity.json'), getJSON('blog/posts.json')])
    .then(function (r) {
      var site = r[0] || {}, ig = r[1] || [], act = r[2] || [], posts = r[3] || [];
      byDateDesc(ig); byDateDesc(act); byDateDesc(posts);
      renderSite(site); renderInstagram(site, ig); renderActivity(act); renderPosts(posts);
      renderNow(act);
      revealAll();
    });

  function byDateDesc(a) { a.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); }); }

  function renderSite(site) {
    var handle = String(site.instagram || '').replace(/[^\w.]/g, '');
    var follow = $('#ig-follow');
    if (follow) {
      if (handle) { follow.href = 'https://www.instagram.com/' + handle + '/'; follow.textContent = 'Seguir @' + handle + ' →'; follow.hidden = false; }
    }
    var box = $('#socials');
    if (box) {
      var items = [];
      if (handle) items.push({ label: 'Instagram', url: 'https://www.instagram.com/' + handle + '/' });
      (site.links || []).forEach(function (l) { if (l && l.label && safeUrl(l.url)) items.push(l); });
      items.forEach(function (l) {
        var a = el('a', 'btn', l.label); a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        box.appendChild(a);
      });
    }
    if (site.email) {
      var m = $('#mail'); if (m) { m.textContent = site.email; m.href = 'mailto:' + site.email; }
    }
  }

  function renderNow(act) {
    var box = $('#now'); if (!box || !act.length) return;
    var a = act[0];
    var node = a.url && safeUrl(a.url) ? el('a', 'now') : el('div', 'now');
    if (node.tagName === 'A') node.href = safeUrl(a.url);
    node.appendChild(el('span', 'pulse'));
    node.appendChild(el('b', null, a.type || 'Reciente'));
    node.appendChild(el('span', 't', a.text));
    box.replaceChildren(node);
  }

  function renderInstagram(site, items) {
    reel.replaceChildren();
    if (!items.length) { reel.appendChild(el('p', 'empty', 'Aquí aparecerán mis publicaciones de Instagram.')); return; }
    items.forEach(function (it, i) {
      var url = safeUrl(it.url), img = safeUrl(it.image);
      var t = url ? el('a', 'tile') : el('div', 'tile');
      if (url) { t.href = url; t.target = '_blank'; t.rel = 'noopener noreferrer'; }
      if (img) { t.classList.add('has-img'); var im = el('img'); im.src = img; im.alt = ''; im.loading = 'lazy'; t.appendChild(im); }
      var top = el('div', 'top');
      if (it.sample) top.appendChild(el('span', 'chip', 'Ejemplo'));
      t.appendChild(top);
      t.appendChild(el('p', 'cap', it.caption || ''));
      var meta = el('div', 'meta');
      meta.appendChild(el('span', null, fdate(it.date)));
      if (url) meta.appendChild(el('span', null, 'Ver en Instagram ↗'));
      t.appendChild(meta);
      reveal(t, Math.min(i, 5) * 0.06);
      reel.appendChild(t);
    });
    var step = function (dir) { return function () { reel.scrollBy({ left: dir * Math.max(240, reel.clientWidth * 0.7), behavior: 'smooth' }); }; };
    var prev = $('#reel-prev'), next = $('#reel-next');
    if (prev) prev.onclick = step(-1);
    if (next) next.onclick = step(1);
  }

  function renderActivity(items) {
    var ul = $('#feed'); if (!ul) return;
    ul.replaceChildren();
    if (!items.length) { ul.appendChild(el('li', 'empty', 'Aquí aparecerá mi actividad reciente.')); return; }
    items.slice(0, 8).forEach(function (a, i) {
      var li = el('li');
      var time = el('time', null, fdate(a.date)); time.setAttribute('datetime', a.date);
      li.appendChild(time);
      var body = el('div', 'body');
      body.appendChild(el('span', 'chip', a.type || 'Nota'));
      if (a.sample) body.appendChild(el('span', 'chip', 'Ejemplo'));
      body.appendChild(el('p', null, a.text));
      var u = safeUrl(a.url);
      if (u) { var l = el('a', null, 'Ver →'); l.href = u; if (/^https:/.test(u)) { l.target = '_blank'; l.rel = 'noopener noreferrer'; } body.appendChild(l); }
      li.appendChild(body);
      reveal(li, Math.min(i, 4) * 0.05);
      ul.appendChild(li);
    });
  }

  function renderPosts(items) {
    var ul = $('#posts'); if (!ul) return;
    ul.replaceChildren();
    if (!items.length) { ul.appendChild(el('li', 'empty', 'Aquí aparecerán mis entradas del blog.')); return; }
    items.forEach(function (p, i) {
      if (!/^[a-z0-9-]+$/.test(p.slug || '')) return;
      var li = el('li');
      var a = el('a', 'post-row'); a.href = 'blog.html#' + p.slug;
      var time = el('time', null, fdate(p.date)); time.setAttribute('datetime', p.date);
      a.appendChild(time);
      var mid = el('div');
      mid.appendChild(el('h3', null, p.title));
      mid.appendChild(el('p', null, p.summary || ''));
      a.appendChild(mid);
      a.appendChild(el('span', 'rt', (p.tags && p.tags[0]) ? p.tags[0] : 'Leer →'));
      li.appendChild(a);
      reveal(li, Math.min(i, 4) * 0.05);
      ul.appendChild(li);
    });
  }
})();
