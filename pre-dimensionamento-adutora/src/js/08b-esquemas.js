/* ------------------------------------------------------------------
 * Desenhos esquemáticos que explicam o dado pedido em cada campo.
 * Todos em SVG, com os valores do projeto anotados no desenho.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var Q = {};
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var UI;

  Q.init = function () { UI = PDA.UI; };

  function sv(tag, attrs, txt) {
    var e = document.createElementNS(SVG_NS, tag), k;
    for (k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
    if (txt !== undefined && txt !== null) e.textContent = txt;
    return e;
  }
  function svg(w, hh) {
    var e = sv('svg', { viewBox: '0 0 ' + w + ' ' + hh, class: 'esquema', preserveAspectRatio: 'xMidYMid meet' });
    return e;
  }
  function n(v, d) { return UI.num(v, d === undefined ? 2 : d); }

  /* cota anotada: linha tracejada horizontal + rótulo */
  function cotaH(g, x1, x2, y, txt, ancora) {
    g.appendChild(sv('line', { class: 'cota', x1: x1, x2: x2, y1: y, y2: y, 'stroke-dasharray': '4 3' }));
    var t = sv('text', { class: 'cota-t', x: ancora === 'fim' ? x2 - 2 : x1 + 2, y: y - 3,
                         'text-anchor': ancora === 'fim' ? 'end' : 'start' }, txt);
    g.appendChild(t);
  }

  /* seta de dimensão vertical entre y1 e y2 em x */
  function dimV(g, x, y1, y2, txt) {
    g.appendChild(sv('line', { class: 'cota', x1: x, x2: x, y1: y1, y2: y2 }));
    g.appendChild(sv('path', { class: 'cota', d: 'M' + (x - 3) + ' ' + (y1 + 4) + ' L' + x + ' ' + y1 + ' L' + (x + 3) + ' ' + (y1 + 4), fill: 'none' }));
    g.appendChild(sv('path', { class: 'cota', d: 'M' + (x - 3) + ' ' + (y2 - 4) + ' L' + x + ' ' + y2 + ' L' + (x + 3) + ' ' + (y2 - 4), fill: 'none' }));
    g.appendChild(sv('text', { class: 'cota-t', x: x + 5, y: (y1 + y2) / 2 + 3 }, txt));
  }

  /* ================================================================
     1. Níveis e cotas da elevatória
     ================================================================ */

  /* Rótulos de cota na margem esquerda, empurrados verticalmente para não
     se sobreporem, com linha de chamada tracejada até o ponto. */
  function rotulosCota(g, itens, alturaMin, alturaMax) {
    var GAP = 13;
    var ord = itens.slice().sort(function (a, b) { return a.y - b.y; });
    var i, y = alturaMin;
    for (i = 0; i < ord.length; i++) {
      ord[i].yTexto = Math.max(y, ord[i].y);
      y = ord[i].yTexto + GAP;
    }
    /* se estourou embaixo, comprime de volta para cima */
    var excesso = y - GAP - alturaMax;
    if (excesso > 0) {
      for (i = ord.length - 1; i >= 0; i--) {
        ord[i].yTexto -= excesso;
        if (i > 0 && ord[i].yTexto - ord[i - 1].yTexto >= GAP) break;
      }
    }
    ord.forEach(function (it) {
      /* o texto fica na margem; a linha de chamada começa depois dele, para
         que nunca cruze as letras (largura estimada pelo nº de caracteres) */
      var larg = it.txt.length * 4.75 + 10;
      var xIni = it.x1 + larg;
      g.appendChild(sv('text', { class: 'cota-t', x: it.x1, y: it.yTexto + 3 }, it.txt));
      if (Math.abs(it.yTexto - it.y) > 2) {
        g.appendChild(sv('path', { class: 'cota', fill: 'none', 'stroke-dasharray': '3 2',
          d: 'M' + xIni + ' ' + (it.yTexto) + ' L' + (xIni + 8) + ' ' + it.y + ' L' + it.x2 + ' ' + it.y }));
      } else {
        g.appendChild(sv('line', { class: 'cota', x1: xIni, x2: it.x2, y1: it.y, y2: it.y,
                                   'stroke-dasharray': '4 3' }));
      }
    });
  }

  /* Desenha poço de sucção, bomba, adutora e reservatório de chegada, com as
     cotas dos campos anotadas. */
  Q.niveisCotas = function (st, ctx, cen) {
    var W = 760, HH = 320;
    var s = svg(W, HH);
    var c = st.cotas;
    var nsMin = Number(c.nivelSuccaoMin) || 0;
    var nsMax = Number(c.nivelSuccaoMax) || nsMin;
    var eixo = Number(c.eixoBomba) || 0;
    var part = (c.cotaPartida === null || c.cotaPartida === undefined || c.cotaPartida === '')
      ? nsMin : Number(c.cotaPartida);
    var cheg = Number(c.nivelChegada) || 0;
    var submersivel = st.bombas.tipo === 'submersivel';

    /* faixa vertical: garante que o poço tenha altura visível */
    var baixo = Math.min(nsMin, nsMax, eixo, part, cheg);
    var alto = Math.max(nsMin, nsMax, eixo, part, cheg);
    var amplitude = Math.max(alto - baixo, 1);
    var fundo = baixo - amplitude * 0.22;
    var topo = alto + amplitude * 0.14;

    var mT = 40, mB = 40, mE = 200, mD = 96;
    function py(v) { return mT + (topo - v) / (topo - fundo) * (HH - mT - mB); }

    var g = sv('g');
    var rots = [];

    /* --- poço de sucção --- */
    var pE = mE, pD = mE + 104;
    var bordaPoco = Math.max(nsMax, part) + amplitude * 0.05;
    g.appendChild(sv('path', { class: 'estrutura',
      d: 'M' + pE + ' ' + py(bordaPoco) + ' L' + pE + ' ' + py(fundo) +
         ' L' + pD + ' ' + py(fundo) + ' L' + pD + ' ' + py(bordaPoco) }));
    g.appendChild(sv('rect', { class: 'agua', x: pE + 1.5, y: py(nsMax),
                               width: pD - pE - 3, height: Math.max(2, py(fundo) - py(nsMax)) }));
    g.appendChild(sv('line', { class: 'agua-l', x1: pE + 1.5, x2: pD - 1.5, y1: py(nsMax), y2: py(nsMax) }));
    if (Math.abs(nsMin - nsMax) > 1e-9) {
      g.appendChild(sv('line', { class: 'agua-l', x1: pE + 1.5, x2: pD - 1.5,
                                 y1: py(nsMin), y2: py(nsMin), 'stroke-dasharray': '5 3' }));
    }
    g.appendChild(sv('text', { class: 'rotulo', x: (pE + pD) / 2, y: py(fundo) + 14,
                               'text-anchor': 'middle' }, 'poço de sucção'));

    /* --- bomba --- */
    var bx = pD + 44;
    if (submersivel) {
      g.appendChild(sv('circle', { class: 'bomba', cx: (pE + pD) / 2, cy: py(fundo) - 12, r: 11 }));
      g.appendChild(sv('line', { class: 'tubo', x1: (pE + pD) / 2, x2: (pE + pD) / 2,
                                 y1: py(fundo) - 23, y2: py(part) }));
      g.appendChild(sv('line', { class: 'tubo', x1: (pE + pD) / 2, x2: bx + 14, y1: py(part), y2: py(part) }));
    } else {
      g.appendChild(sv('line', { class: 'tubo', x1: pD - 26, x2: bx - 13, y1: py(eixo), y2: py(eixo) }));
      g.appendChild(sv('circle', { class: 'bomba', cx: bx, cy: py(eixo), r: 13 }));
      g.appendChild(sv('text', { class: 'rotulo', x: bx, y: py(eixo) + 28, 'text-anchor': 'middle' }, 'bomba'));
    }

    /* --- adutora até a chegada --- */
    var ax = bx + 13, fx = W - mD;
    if (!submersivel) {
      g.appendChild(sv('path', { class: 'tubo',
        d: 'M' + ax + ' ' + py(eixo) + ' L' + (ax + 18) + ' ' + py(eixo) +
           ' L' + (ax + 30) + ' ' + py(part) }));
    }
    g.appendChild(sv('path', { class: 'tubo',
      d: 'M' + (ax + 30) + ' ' + py(part) + ' L' + (fx - 88) + ' ' + py(part) +
         ' L' + (fx - 22) + ' ' + py(cheg) + ' L' + fx + ' ' + py(cheg) }));
    g.appendChild(sv('text', { class: 'rotulo', x: (ax + 30 + fx - 88) / 2, y: py(part) + 15,
                               'text-anchor': 'middle' }, 'adutora / linha de recalque'));

    /* --- reservatório de chegada --- */
    var rE = fx, rD = fx + 66;
    var fundoR = cheg - amplitude * 0.16;
    var topoR = cheg + amplitude * 0.07;
    g.appendChild(sv('path', { class: 'estrutura',
      d: 'M' + rE + ' ' + py(topoR) + ' L' + rE + ' ' + py(fundoR) +
         ' L' + rD + ' ' + py(fundoR) + ' L' + rD + ' ' + py(topoR) }));
    g.appendChild(sv('rect', { class: 'agua', x: rE + 1.5, y: py(cheg),
                               width: rD - rE - 3, height: Math.max(2, py(fundoR) - py(cheg)) }));
    g.appendChild(sv('line', { class: 'agua-l', x1: rE + 1.5, x2: rD - 1.5, y1: py(cheg), y2: py(cheg) }));
    g.appendChild(sv('text', { class: 'rotulo', x: (rE + rD) / 2, y: Math.max(14, py(topoR) - 6),
                               'text-anchor': 'middle' }, 'chegada'));

    /* --- cotas anotadas na margem esquerda --- */
    rots.push({ y: py(nsMax), x1: 6, x2: pE, txt: 'cota do N.A. máximo   ' + n(nsMax) });
    if (Math.abs(nsMin - nsMax) > 1e-9) {
      rots.push({ y: py(nsMin), x1: 6, x2: pE, txt: 'cota do N.A. mínimo   ' + n(nsMin) });
    }
    if (!submersivel) {
      rots.push({ y: py(eixo), x1: 6, x2: bx, txt: 'cota do eixo da bomba   ' + n(eixo) });
    }
    rots.push({ y: py(part), x1: 6, x2: ax + 30, txt: 'cota de partida   ' + n(part) });
    rotulosCota(g, rots, mT - 18, HH - mB - 6);

    /* cota de chegada, à direita */
    g.appendChild(sv('line', { class: 'cota', x1: ax + 30, x2: W - 4, y1: py(cheg), y2: py(cheg),
                               'stroke-dasharray': '4 3' }));
    g.appendChild(sv('text', { class: 'cota-t', x: W - 4, y: Math.max(12, py(cheg) - 5),
                               'text-anchor': 'end' }, 'cota de chegada   ' + n(cheg)));

    /* --- Hg --- */
    var xg = ax + 52;
    dimV(g, xg, py(cheg), py(nsMin), 'Hg = ' + n(cheg - nsMin) + ' m');

    /* --- nota de referência --- */
    g.appendChild(sv('text', { x: 6, y: HH - 8, class: 'rotulo' },
      'todas as cotas são ALTITUDES ABSOLUTAS, na mesma referência de nível do projeto'));

    s.appendChild(g);
    return s;
  };

  /* ================================================================
     2. Barrilete: individual x comum
     ================================================================ */

  Q.barrilete = function (st, ctx) {
    var nb = Math.min(4, Math.max(2, ctx.nInst));
    var W = 660, HH = 42 + nb * 46;
    var s = svg(W, HH);
    var g = sv('g');
    var i, y, xB = 96, xInd = 250, xCom = 380, xSai = W - 70;

    g.appendChild(sv('text', { class: 'rotulo', x: xB, y: 16, 'text-anchor': 'middle' }, 'bombas'));
    g.appendChild(sv('text', { class: 'rotulo', x: (xInd + xCom) / 2, y: 16, 'text-anchor': 'middle' }, 'barrilete individual'));
    g.appendChild(sv('text', { class: 'rotulo', x: (xCom + xSai) / 2, y: 16, 'text-anchor': 'middle' }, 'barrilete comum'));

    for (i = 0; i < nb; i++) {
      y = 44 + i * 46;
      g.appendChild(sv('circle', { class: 'bomba', cx: xB, cy: y, r: 12 }));
      g.appendChild(sv('text', { x: xB, y: y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 9 }, String(i + 1)));
      g.appendChild(sv('line', { class: 'tubo', x1: xB + 12, x2: xCom, y1: y, y2: y }));
      g.appendChild(sv('text', { x: (xB + 12 + xCom) / 2, y: y - 5, 'text-anchor': 'middle' }, 'Q de 1 bomba'));
      /* trecho comum: desce até a linha coletora */
      g.appendChild(sv('line', { class: 'tubo', x1: xCom, x2: xCom, y1: y, y2: 44 }));
    }

    g.appendChild(sv('line', { class: 'tubo', x1: xCom, x2: xSai, y1: 44, y2: 44 }));
    for (i = 0; i < nb; i++) {
      var x1 = xCom + (xSai - xCom) * i / nb, x2 = xCom + (xSai - xCom) * (i + 1) / nb;
      g.appendChild(sv('line', { class: 'cota', x1: x2, x2: x2, y1: 30, y2: 58, 'stroke-dasharray': '3 2' }));
      g.appendChild(sv('text', { class: 'cota-t', x: (x1 + x2) / 2, y: 34, 'text-anchor': 'middle' },
        'Q de ' + (i + 1)));
    }
    g.appendChild(sv('text', { x: xSai + 4, y: 47 }, '→ adutora'));
    s.appendChild(g);
    return s;
  };

  /* ================================================================
     3. Adutora ramificada
     ================================================================ */

  Q.ramificacao = function (st, ctx) {
    var W = 660, HH = 138;
    var s = svg(W, HH);
    var g = sv('g');
    g.appendChild(sv('circle', { class: 'bomba', cx: 40, cy: 70, r: 12 }));
    g.appendChild(sv('text', { class: 'rotulo', x: 40, y: 96, 'text-anchor': 'middle' }, 'elevatória'));

    g.appendChild(sv('line', { class: 'tubo', x1: 52, x2: 250, y1: 70, y2: 70, 'stroke-width': 5 }));
    g.appendChild(sv('text', { x: 150, y: 60, 'text-anchor': 'middle' }, 'Trecho 1 — 100 % da vazão'));
    g.appendChild(sv('text', { x: 150, y: 86, 'text-anchor': 'middle', class: 'cota-t' }, 'DN maior'));

    g.appendChild(sv('circle', { cx: 250, cy: 70, r: 4, fill: 'var(--vermelho)' }));
    g.appendChild(sv('text', { class: 'cota-t', x: 250, y: 108, 'text-anchor': 'middle' }, 'derivação'));

    g.appendChild(sv('line', { class: 'tubo', x1: 250, x2: 250, y1: 70, y2: 126 }));
    g.appendChild(sv('line', { class: 'tubo', x1: 250, x2: 340, y1: 126, y2: 126, 'stroke-width': 2 }));
    g.appendChild(sv('text', { x: 344, y: 130 }, 'consumo intermediário — 40 %'));

    g.appendChild(sv('line', { class: 'tubo', x1: 250, x2: 470, y1: 70, y2: 70, 'stroke-width': 3 }));
    g.appendChild(sv('text', { x: 360, y: 60, 'text-anchor': 'middle' }, 'Trecho 2 — 60 % da vazão'));
    g.appendChild(sv('text', { x: 360, y: 86, 'text-anchor': 'middle', class: 'cota-t' }, 'DN menor'));

    g.appendChild(sv('path', { class: 'estrutura', d: 'M470 44 L470 92 L520 92 L520 44' }));
    g.appendChild(sv('rect', { class: 'agua', x: 471, y: 56, width: 48, height: 35 }));
    g.appendChild(sv('text', { class: 'rotulo', x: 495, y: 38, 'text-anchor': 'middle' }, 'chegada'));

    s.appendChild(g);
    return s;
  };

  /* ================================================================
     4. NPSH disponível
     ================================================================ */

  Q.npsh = function (st, ctx, cen) {
    var W = 620, HH = 210;
    var s = svg(W, HH);
    var g = sv('g');
    var afogada = cen.zSuccao >= 0;
    var yNa = afogada ? 62 : 128, yEixo = afogada ? 118 : 62;

    g.appendChild(sv('path', { class: 'estrutura', d: 'M50 ' + (yNa - 22) + ' L50 168 L164 168 L164 ' + (yNa - 22) }));
    g.appendChild(sv('rect', { class: 'agua', x: 51, y: yNa, width: 112, height: 167 - yNa }));
    g.appendChild(sv('line', { class: 'agua-l', x1: 51, x2: 163, y1: yNa, y2: yNa }));
    g.appendChild(sv('text', { x: 54, y: yNa - 5 }, 'N.A. mínimo'));

    g.appendChild(sv('line', { class: 'tubo', x1: 164, x2: 250, y1: yNa + 14, y2: yNa + 14 }));
    g.appendChild(sv('line', { class: 'tubo', x1: 250, x2: 250, y1: yNa + 14, y2: yEixo }));
    g.appendChild(sv('line', { class: 'tubo', x1: 250, x2: 292, y1: yEixo, y2: yEixo }));
    g.appendChild(sv('circle', { class: 'bomba', cx: 305, cy: yEixo, r: 13 }));
    g.appendChild(sv('text', { class: 'rotulo', x: 305, y: yEixo + 28, 'text-anchor': 'middle' }, 'eixo da bomba'));

    dimV(g, 210, Math.min(yNa, yEixo), Math.max(yNa, yEixo),
      (afogada ? '+' : '−') + n(Math.abs(cen.zSuccao)) + ' m');

    g.appendChild(sv('text', { x: 340, y: 40, class: 'rotulo' }, 'NPSH disponível'));
    var linhas = [
      'pressão atmosférica local (altitude ' + n(st.fluido.altitude, 0) + ' m)  + ' + n(ctx.patm) + ' mca',
      'pressão de vapor (a ' + n(st.fluido.temperatura, 0) + ' °C)              − ' + n(ctx.pvapor, 3) + ' mca',
      (afogada ? 'bomba afogada (N.A. acima do eixo)      + ' : 'bomba aspirando (N.A. abaixo do eixo)  − ') + n(Math.abs(cen.zSuccao)) + ' m',
      'perda de carga na sucção                − ' + n(cen.hSuccao) + ' m'
    ];
    linhas.forEach(function (t, i) {
      g.appendChild(sv('text', { x: 340, y: 60 + i * 15, 'font-family': 'monospace', 'font-size': 9 }, t));
    });
    g.appendChild(sv('line', { class: 'cota', x1: 340, x2: W - 8, y1: 124, y2: 124 }));
    g.appendChild(sv('text', { x: 340, y: 139, class: 'cota-t', 'font-family': 'monospace', 'font-size': 10 },
      'NPSHd = ' + n(cen.npshd === null ? 0 : cen.npshd) + ' mca'));
    g.appendChild(sv('text', { x: 340, y: 162 }, 'Compare com o NPSH requerido'));
    g.appendChild(sv('text', { x: 340, y: 175 }, 'da curva do fabricante, com folga'));
    g.appendChild(sv('text', { x: 340, y: 188 }, 'de 0,5 a 1,0 mca.'));

    s.appendChild(g);
    return s;
  };

  /* ================================================================
     5. Golpe de aríete: envoltória de pressões
     ================================================================ */

  Q.golpe = function () {
    var W = 620, HH = 200;
    var s = svg(W, HH);
    var g = sv('g');
    g.appendChild(sv('circle', { class: 'bomba', cx: 44, cy: 150, r: 11 }));
    g.appendChild(sv('line', { class: 'terreno', x1: 55, x2: 560, y1: 150, y2: 118 }));
    g.appendChild(sv('text', { x: 300, y: 168 }, 'perfil do terreno'));

    g.appendChild(sv('line', { class: 'tubo', x1: 55, x2: 560, y1: 100, y2: 74 }));
    g.appendChild(sv('text', { x: 300, y: 96 }, 'linha piezométrica em regime permanente'));

    g.appendChild(sv('path', { d: 'M55 46 L560 66', stroke: 'var(--vermelho)', 'stroke-width': 1.6, fill: 'none' }));
    g.appendChild(sv('text', { x: 60, y: 42, class: 'cota-t' }, 'envoltória máxima  =  permanente + Δh'));

    g.appendChild(sv('path', { d: 'M55 152 L560 116', stroke: 'var(--teal)', 'stroke-width': 1.6,
                               'stroke-dasharray': '5 3', fill: 'none' }));
    g.appendChild(sv('text', { x: 60, y: 186, fill: 'var(--teal)' }, 'envoltória mínima  =  permanente − Δh   (risco de subpressão)'));

    dimV(g, 500, 66, 100, 'Δh');
    s.appendChild(g);
    return s;
  };

  /* ================================================================
     Invólucro: caixa recolhível com o desenho
     ================================================================ */

  Q.caixa = function (titulo, elSvg, legenda, aberta) {
    var h = PDA.UI.h;
    var caixa = h('div', { class: 'caixa-esquema' + (aberta === false ? ' recolhida' : '') });
    var bt = h('button', {
      class: 'btn mini naoimprime', type: 'button',
      onclick: function () { caixa.classList.toggle('recolhida'); }
    }, aberta === false ? 'mostrar' : 'ocultar');
    caixa.appendChild(h('div', { class: 'tit' }, titulo, bt));
    caixa.appendChild(elSvg);
    if (legenda) caixa.appendChild(h('div', { class: 'leg' }, legenda));
    return caixa;
  };

  PDA.Q = Q;
})(window.PDA = window.PDA || {});
