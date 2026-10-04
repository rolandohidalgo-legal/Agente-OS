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

  var IG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>';

  // Pestañas: cada píldora muestra una vista; la URL (#blog, #instagram…) la recuerda
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var views = {};
  tabs.forEach(function (t) { views[t.dataset.view] = document.getElementById('v-' + t.dataset.view); });
  var current = null;
  function show(id, scroll) {
    if (!views[id]) id = 'todo';
    if (id === current) return;
    current = id;
    tabs.forEach(function (t) {
      var on = t.dataset.view === id;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
    Object.keys(views).forEach(function (k) {
      var v = views[k]; if (!v) return;
      var on = k === id;
      v.hidden = !on;
      v.classList.remove('show');
      if (on) { void v.offsetWidth; v.classList.add('show'); }
    });
    if (scroll) {
      var bar = $('.tabs-bar'), top = bar.getBoundingClientRect().top + window.scrollY - bar.offsetHeight + 4;
      var hero = $('.hero').getBoundingClientRect().bottom + window.scrollY;
      if (window.scrollY > hero) window.scrollTo({ top: Math.max(0, hero - 1), behavior: 'smooth' });
    }
  }
  function fromHash() { return decodeURIComponent(location.hash.slice(1)) || 'todo'; }
  window.addEventListener('hashchange', function () { show(fromHash(), true); });
  show(fromHash(), false);

  Promise.all([getJSON('data/site.json'), getJSON('data/instagram.json'), getJSON('data/activity.json'), getJSON('blog/posts.json')])
    .then(function (r) {
      var site = r[0] || {}, ig = r[1] || [], act = r[2] || [], posts = (r[3] || []).filter(function (p) { return /^[a-z0-9-]+$/.test(p.slug || ''); });
      [ig, act, posts].forEach(function (a) { a.sort(function (x, y) { return String(y.date).localeCompare(String(x.date)); }); });
      renderSite(site);
      renderFeed(posts, ig);
      renderPosts(posts);
      renderGrid(ig);
      renderActivity(act);
    });

  function renderSite(site) {
    var handle = String(site.instagram || '').replace(/[^\w.]/g, '');
    var follow = $('#ig-follow');
    if (follow && handle) { follow.href = 'https://www.instagram.com/' + handle + '/'; follow.textContent = 'Seguir a @' + handle; follow.hidden = false; }
    var box = $('#socials');
    var items = [];
    if (handle) items.push({ label: 'Instagram', url: 'https://www.instagram.com/' + handle + '/' });
    (site.links || []).forEach(function (l) { if (l && l.label && /^https:\/\//.test(l.url || '')) items.push(l); });
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

  function igItem(it, i) {
    var url = safeUrl(it.url), img = safeUrl(it.image);
    var n = url ? el('a', 'item ig') : el('div', 'item ig');
    if (url) { n.href = url; n.target = '_blank'; n.rel = 'noopener noreferrer'; }
    n.style.setProperty('--i', Math.min(i, 8));
    var text = el('div');
    text.appendChild(meta('Instagram', it.date, '', it.sample));
    text.appendChild(el('p', 'cap', it.caption || ''));
    n.appendChild(text);
    var th = el('div', 'thumb');
    if (img) { var im = el('img'); im.src = img; im.alt = ''; im.loading = 'lazy'; th.appendChild(im); }
    else th.innerHTML = IG_ICON;
    n.appendChild(th);
    return n;
  }

  // "Todo": entradas del blog y publicaciones mezcladas por fecha
  function renderFeed(posts, ig) {
    all.replaceChildren();
    var items = posts.map(function (p) { return { t: 'blog', d: p.date, v: p }; })
      .concat(ig.map(function (x) { return { t: 'ig', d: x.date, v: x }; }));
    items.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
    if (!items.length) { all.appendChild(el('p', 'empty', 'Aquí aparecerán mis entradas y publicaciones.')); return; }
    items.forEach(function (it, i) {
      all.appendChild(it.t === 'blog' ? blogItem(it.v, i, i === 0) : igItem(it.v, i));
    });
  }

  function renderPosts(posts) {
    var box = $('#posts'); box.replaceChildren();
    if (!posts.length) { box.appendChild(el('p', 'empty', 'Aquí aparecerán mis entradas del blog.')); return; }
    posts.forEach(function (p, i) { box.appendChild(blogItem(p, i, false)); });
  }

  function renderGrid(ig) {
    var box = $('#grid'); box.replaceChildren();
    if (!ig.length) { box.appendChild(el('p', 'empty', 'Aquí aparecerán mis publicaciones de Instagram.')); return; }
    ig.forEach(function (it, i) {
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
