// Página de lectura: carga blog/<slug>.md según el #slug de la URL y lo muestra.
(function () {
  var host = document.getElementById('article');
  if (!host) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Formato en línea sobre texto ya escapado: solo genera etiquetas de una lista fija
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((https:\/\/[^\s)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function markdown(src) {
    var blocks = src.replace(/\r/g, '').trim().split(/\n{2,}/), out = [];
    blocks.forEach(function (b) {
      var lines = b.split('\n'), m;
      if ((m = /^(#{2,3})\s+(.*)$/.exec(lines[0])) && lines.length === 1) {
        out.push('<h' + m[1].length + '>' + inline(m[2]) + '</h' + m[1].length + '>');
      } else if (/^---+$/.test(b.trim())) {
        out.push('<hr>');
      } else if (lines.every(function (l) { return /^>\s?/.test(l); })) {
        out.push('<blockquote>' + inline(lines.map(function (l) { return l.replace(/^>\s?/, ''); }).join(' ')) + '</blockquote>');
      } else if (lines.every(function (l) { return /^[-*]\s+/.test(l); })) {
        out.push('<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^[-*]\s+/, '')) + '</li>'; }).join('') + '</ul>');
      } else if (lines.every(function (l) { return /^\d+\.\s+/.test(l); })) {
        out.push('<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\d+\.\s+/, '')) + '</li>'; }).join('') + '</ol>');
      } else {
        out.push('<p>' + inline(lines.join(' ')) + '</p>');
      }
    });
    return out.join('\n');
  }

  var fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });
  function fdate(s) {
    var p = String(s || '').split('-');
    return p.length === 3 ? fmt.format(new Date(+p[0], +p[1] - 1, +p[2])) : '';
  }

  function fail(msg) {
    host.replaceChildren(el('p', 'notice', msg));
    document.title = 'Entrada no encontrada — Rolando Hidalgo';
  }

  function load() {
    var slug = decodeURIComponent(location.hash.slice(1));
    if (!/^[a-z0-9-]+$/.test(slug)) return fail('Esa entrada no existe.');
    Promise.all([
      fetch('blog/posts.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
      fetch('blog/' + slug + '.md', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.text(); })
    ]).then(function (r) {
      var meta = (r[0] || []).filter(function (p) { return p.slug === slug; })[0] || { title: slug };
      var text = r[1], words = text.split(/\s+/).length;
      document.title = meta.title + ' — Rolando Hidalgo';
      var h1 = el('h1', null, meta.title);
      var by = el('div', 'byline');
      by.appendChild(el('time', null, fdate(meta.date)));
      by.appendChild(el('span', null, Math.max(1, Math.round(words / 200)) + ' min de lectura'));
      (meta.tags || []).forEach(function (t) { by.appendChild(el('span', 'chip', t)); });
      if (meta.sample) by.appendChild(el('span', 'chip', 'Ejemplo'));
      var body = el('div', 'md'); body.innerHTML = markdown(text);
      host.replaceChildren(h1, by, body);
      window.scrollTo(0, 0);
    }).catch(function () { fail('Esa entrada no existe o no se pudo cargar.'); });
  }

  window.addEventListener('hashchange', load);
  load();
})();
