/* ------------------------------------------------------------------
 * Identidade visual: marca no cabeçalho.
 *
 * O símbolo abaixo é uma reprodução em SVG (engrenagem + gota + onda).
 * Para usar o arquivo oficial da logo, o botão "Logo" no cabeçalho
 * carrega uma imagem PNG/JPG/SVG, que fica gravada no navegador como
 * data URI e passa a ser usada no lugar do desenho — inclusive na
 * impressão do memorial.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var M = {};
  var LS_LOGO = 'pda.logo.v1';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  M.cores = {
    navy: '#0E2148',
    navy2: '#16305F',
    teal: '#14A5A0',
    tealEscuro: '#0E6F66',
    verdeTeal: '#1A6B5A'
  };

  function sv(tag, attrs, filho) {
    var e = document.createElementNS(SVG_NS, tag), k;
    for (k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (filho) (Array.isArray(filho) ? filho : [filho]).forEach(function (f) { e.appendChild(f); });
    return e;
  }

  /* símbolo: engrenagem envolvendo uma gota com onda */
  M.simbolo = function (alturaPx) {
    var svg = sv('svg', {
      viewBox: '0 0 120 124', width: alturaPx * 120 / 124, height: alturaPx,
      role: 'img', 'aria-label': 'Pastro Engenharia'
    });

    var defs = sv('defs');
    var grad = sv('linearGradient', { id: 'pdaOnda', x1: '0', y1: '1', x2: '1', y2: '0' });
    grad.appendChild(sv('stop', { offset: '0', 'stop-color': M.cores.tealEscuro }));
    grad.appendChild(sv('stop', { offset: '1', 'stop-color': '#1FC6BE' }));
    defs.appendChild(grad);
    var clip = sv('clipPath', { id: 'pdaGota' });
    clip.appendChild(sv('path', { d: 'M60 22 C60 22 88 58 88 76 A28 28 0 1 1 32 76 C32 58 60 22 60 22 Z' }));
    defs.appendChild(clip);
    svg.appendChild(defs);

    /* engrenagem: anel + dentes */
    var g = sv('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': 8,
                      'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    var i, ang, dentes = 10;
    for (i = 0; i < dentes; i++) {
      ang = -90 + (360 / dentes) * i;
      if (ang > -140 && ang < -40) continue;            /* abertura no topo, para a gota */
      g.appendChild(sv('rect', {
        x: 54, y: 6, width: 12, height: 16, rx: 2,
        transform: 'rotate(' + (ang + 90) + ' 60 70)'
      }));
    }
    g.appendChild(sv('circle', { cx: 60, cy: 70, r: 48 }));
    svg.appendChild(g);

    /* gota */
    svg.appendChild(sv('path', {
      d: 'M60 22 C60 22 88 58 88 76 A28 28 0 1 1 32 76 C32 58 60 22 60 22 Z',
      fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': 8, 'stroke-linejoin': 'round'
    }));

    /* onda dentro da gota */
    svg.appendChild(sv('path', {
      d: 'M32 82 C42 74 52 88 64 84 C74 81 82 74 88 68 L88 84 A28 28 0 0 1 34 92 Z',
      fill: 'url(#pdaOnda)', 'clip-path': 'url(#pdaGota)'
    }));

    return svg;
  };

  /* marca completa (símbolo + nome) para o cabeçalho */
  M.marca = function (alturaPx) {
    var logo = M.logoGravada();
    var caixa = document.createElement('div');
    caixa.className = 'marca-bloco';

    if (logo) {
      var img = document.createElement('img');
      img.src = logo;
      img.alt = 'Logo';
      img.className = 'marca-img';
      img.style.height = alturaPx + 'px';
      caixa.appendChild(img);
      return caixa;
    }

    var simb = document.createElement('span');
    simb.className = 'marca-simbolo';
    simb.appendChild(M.simbolo(alturaPx));
    caixa.appendChild(simb);

    var txt = document.createElement('span');
    txt.className = 'marca-nome';
    txt.innerHTML = '<b>PASTRO</b><i>ENGENHARIA</i>';
    caixa.appendChild(txt);
    return caixa;
  };

  M.logoGravada = function () {
    try { return localStorage.getItem(LS_LOGO) || null; } catch (e) { return null; }
  };

  M.gravarLogo = function (dataUri) {
    try { localStorage.setItem(LS_LOGO, dataUri); return true; } catch (e) { return false; }
  };

  M.removerLogo = function () {
    try { localStorage.removeItem(LS_LOGO); } catch (e) {}
  };

  PDA.M = M;
})(window.PDA = window.PDA || {});
