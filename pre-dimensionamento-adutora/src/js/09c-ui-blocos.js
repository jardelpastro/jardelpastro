/* ------------------------------------------------------------------
 * Aba Blocos de ancoragem.
 *
 * Cada bloco é um cartão: peça, tubo (herdado da adutora ou manual),
 * pressão de cálculo, solo e recobrimento. O resultado sai em duas
 * vias lado a lado — o bloco padronizado sugerido (★, clique para
 * adotar outro) e o bloco calculado pelo apoio no solo.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var UB = {};
  var UI, h, BA;
  var SVG = 'http://www.w3.org/2000/svg';

  UB.init = function () { UI = PDA.UI; h = UI.h; BA = PDA.BA; };

  function sv(t, a, txt) {
    var e = document.createElementNS(SVG, t), k;
    for (k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  /* ================================================================
     Esquema: planta da curva com o empuxo e o encosto no terreno
     ================================================================ */

  UB.esquema = function (info) {
    var p = BA.peca(info.b.pecaId);
    var svg = sv('svg', { viewBox: '0 0 340 150', class: 'esquema', role: 'img' });
    var cx = 150, cy = 78;

    function tubo(x1, y1, x2, y2) {
      svg.appendChild(sv('line', { x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: 'var(--azul)', 'stroke-width': 13, 'stroke-linecap': 'butt', opacity: 0.85 }));
      svg.appendChild(sv('line', { x1: x1, y1: y1, x2: x2, y2: y2,
        stroke: 'var(--surface)', 'stroke-width': 7, 'stroke-linecap': 'butt' }));
    }

    function seta(x1, y1, x2, y2, cor) {
      var ang = Math.atan2(y2 - y1, x2 - x1);
      svg.appendChild(sv('line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: cor, 'stroke-width': 2.4 }));
      svg.appendChild(sv('path', {
        d: 'M ' + x2 + ' ' + y2 +
           ' L ' + (x2 - 9 * Math.cos(ang - 0.44)) + ' ' + (y2 - 9 * Math.sin(ang - 0.44)) +
           ' L ' + (x2 - 9 * Math.cos(ang + 0.44)) + ' ' + (y2 - 9 * Math.sin(ang + 0.44)) + ' Z',
        fill: cor }));
    }

    /* bloco: retângulo entre a peça e a parede da vala */
    function bloco(x, y, w, hh) {
      svg.appendChild(sv('rect', { x: x, y: y, width: w, height: hh, rx: 2,
        fill: 'var(--teal)', opacity: 0.30, stroke: 'var(--teal-escuro, #0E6F66)', 'stroke-width': 1.4 }));
    }

    var eDir; /* direção do empuxo (para a legenda do encosto) */
    if (p.reducao || p.axial) {
      tubo(30, cy, cx, cy);
      if (p.reducao) {
        svg.appendChild(sv('line', { x1: cx, y1: cy, x2: 285, y2: cy, stroke: 'var(--azul)', 'stroke-width': 8, opacity: 0.85 }));
        svg.appendChild(sv('line', { x1: cx, y1: cy, x2: 285, y2: cy, stroke: 'var(--surface)', 'stroke-width': 4 }));
        svg.appendChild(sv('path', { d: 'M ' + (cx - 2) + ' ' + (cy - 8) + ' L ' + (cx + 16) + ' ' + (cy - 5) +
          ' L ' + (cx + 16) + ' ' + (cy + 5) + ' L ' + (cx - 2) + ' ' + (cy + 8) + ' Z',
          fill: 'var(--azul)' }));
      } else {
        svg.appendChild(sv('rect', { x: cx - 3, y: cy - 11, width: 8, height: 22, fill: 'var(--azul)' }));
      }
      bloco(cx + 12, cy - 26, 16, 52);
      seta(cx - 42, cy - 24, cx + 4, cy - 24, 'var(--vermelho, #b3261e)');
      svg.appendChild(sv('text', { x: cx - 46, y: cy - 20, 'text-anchor': 'end', 'font-size': 12,
        fill: 'var(--vermelho, #b3261e)', 'font-weight': 700 }, 'E'));
      eDir = { x: cx + 34, y: cy };
    } else {
      var ang = (180 - p.ang) * Math.PI / 180;   /* direção do segundo trecho */
      var x2 = cx + 110 * Math.cos(ang), y2 = cy - 110 * Math.sin(ang);
      tubo(30, cy, cx, cy);
      tubo(cx, cy, x2, y2);
      /* bissetriz externa: direção da resultante */
      var bis = (180 - p.ang / 2) * Math.PI / 180;
      var ex = Math.cos(bis), ey = -Math.sin(bis);
      bloco(cx + ex * 14 - 9, cy + ey * 14 - 9, 18 + Math.abs(ex) * 10, 18 + Math.abs(ey) * 10);
      seta(cx - ex * 4, cy - ey * 4, cx + ex * 44, cy + ey * 44, 'var(--vermelho, #b3261e)');
      svg.appendChild(sv('text', { x: cx + ex * 56, y: cy + ey * 56 + 4, 'text-anchor': 'middle',
        'font-size': 12, fill: 'var(--vermelho, #b3261e)', 'font-weight': 700 }, 'E'));
      svg.appendChild(sv('text', { x: cx - 8, y: cy + 22, 'font-size': 10, fill: 'var(--texto-suave, #667)' },
        'θ = ' + p.ang + '°'));
      eDir = { x: cx + ex * 30, y: cy + ey * 30 };
    }

    svg.appendChild(sv('rect', { x: 8, y: 8, width: 12, height: 9, rx: 2,
      fill: 'var(--teal)', opacity: 0.30, stroke: 'var(--teal-escuro, #0E6F66)', 'stroke-width': 1 }));
    svg.appendChild(sv('text', { x: 24, y: 16, 'font-size': 10,
      fill: 'var(--teal-escuro, #0E6F66)' }, 'bloco contra o terreno firme'));
    svg.appendChild(sv('text', { x: 8, y: 143, 'font-size': 10, fill: 'var(--texto-suave, #667)' },
      'Planta esquemática: E é a resultante da pressão; o bloco a transmite ao terreno.'));
    return svg;
  };

  /* ================================================================
     Desenho do bloco adotado: 4 vistas com cotas
     ================================================================ */

  /* linha de cota horizontal com setas e texto */
  function cotaH(g, x1, x2, y, rot) {
    var c = 'var(--texto-2, #556)';
    g.appendChild(sv('line', { x1: x1, y1: y, x2: x2, y2: y, stroke: c, 'stroke-width': 1 }));
    [[x1, 1], [x2, -1]].forEach(function (p) {
      g.appendChild(sv('path', { d: 'M ' + p[0] + ' ' + y + ' l ' + (6 * p[1]) + ' -2.6 l 0 5.2 Z', fill: c }));
      g.appendChild(sv('line', { x1: p[0], y1: y - 5, x2: p[0], y2: y + 5, stroke: c, 'stroke-width': 1 }));
    });
    g.appendChild(sv('text', { x: (x1 + x2) / 2, y: y - 4, 'text-anchor': 'middle',
      'font-size': 9.5, fill: c, stroke: 'var(--surface)', 'stroke-width': 3,
      'paint-order': 'stroke', 'stroke-linejoin': 'round' }, rot));
  }

  function cotaV(g, x, y1, y2, rot) {
    var c = 'var(--texto-2, #556)';
    g.appendChild(sv('line', { x1: x, y1: y1, x2: x, y2: y2, stroke: c, 'stroke-width': 1 }));
    [[y1, 1], [y2, -1]].forEach(function (p) {
      g.appendChild(sv('path', { d: 'M ' + x + ' ' + p[0] + ' l -2.6 ' + (6 * p[1]) + ' l 5.2 0 Z', fill: c }));
      g.appendChild(sv('line', { x1: x - 5, y1: p[0], x2: x + 5, y2: p[0], stroke: c, 'stroke-width': 1 }));
    });
    var t = sv('text', { x: x + 4, y: (y1 + y2) / 2 + 3, 'font-size': 9.5, fill: c,
      stroke: 'var(--surface)', 'stroke-width': 3, 'paint-order': 'stroke',
      'stroke-linejoin': 'round' });
    t.textContent = rot;
    g.appendChild(t);
  }

  function mRot(v) { return UI.num(v, 2) + ' m'; }

  var COR_BLOCO = 'var(--teal)';
  var COR_BORDA = 'var(--teal-escuro, #0E6F66)';
  var COR_TUBO = 'var(--azul)';
  var COR_SOLO = 'var(--texto-suave, #99a)';

  function vista(titulo, viewW, viewH, montar) {
    var svg = sv('svg', { viewBox: '0 0 ' + viewW + ' ' + viewH, class: 'vista-bloco', role: 'img' });
    svg.appendChild(sv('text', { x: viewW / 2, y: 13, 'text-anchor': 'middle', 'font-size': 10.5,
      'font-weight': 700, fill: 'var(--azul)' }, titulo));
    montar(svg);
    return svg;
  }

  function retBloco(g, x, y, w, hh) {
    g.appendChild(sv('rect', { x: x, y: y, width: w, height: hh,
      fill: COR_BLOCO, opacity: 0.28, stroke: COR_BORDA, 'stroke-width': 1.6 }));
  }

  /* 4 vistas do bloco adotado. info: C.blocoInfo; sol: BA.solucao */
  UB.desenhoBloco = function (info, sol) {
    var deM = info.deMm / 1000;
    var rec = sol.rec || 0.65;
    var lastro = BA.LASTRO;
    var profGeratriz = rec + deM;                 /* topo do tubo a fundo */
    var profVala = rec + deM + lastro;

    /* escala comum: cabe a maior dimensão em ~120 px */
    var maxDim = Math.max(sol.largura, sol.altura, sol.espessura, profVala, 0.8);
    var esc = 120 / maxDim;
    function m2px(v) { return v * esc; }

    var vistas = [];

    /* ---- PLANTA ---- */
    vistas.push(vista('PLANTA', 230, 190, function (svg) {
      var L = m2px(sol.largura), T = m2px(sol.espessura);
      var x0 = 115 - L / 2, y0 = 95 - T / 2;
      /* tubo passando */
      var dTubo = Math.max(6, m2px(deM));
      svg.appendChild(sv('rect', { x: 10, y: 95 - dTubo / 2, width: 210, height: dTubo,
        fill: COR_TUBO, opacity: 0.75 }));
      retBloco(svg, x0, y0, L, T);
      cotaH(svg, x0, x0 + L, y0 - 12, mRot(sol.largura));
      cotaV(svg, Math.min(x0, 10) - 0 + (x0 > 30 ? x0 - 14 : 18), y0, y0 + T, mRot(sol.espessura));
      svg.appendChild(sv('text', { x: 115, y: 182, 'text-anchor': 'middle', 'font-size': 9,
        fill: COR_SOLO }, 'largura × espessura (no sentido do empuxo)'));
    }));

    /* ---- CORTE TRANSVERSAL (perpendicular ao tubo) ----
       geometria do padrão de concessionária: o topo do bloco fica
       RECB_BLOCO abaixo do terreno e o bloco desce a altura H, envolvendo
       o tubo; sob ele, o berço de concreto magro. */
    var RECB_BLOCO = 0.20;
    var profValaDes = Math.max(profVala, RECB_BLOCO + sol.altura + lastro);
    vistas.push(vista('CORTE TRANSVERSAL', 250, 218, function (svg) {
      var terreno = 42;
      var A = m2px(sol.largura), H = m2px(sol.altura);
      var dTubo = Math.max(8, m2px(deM));
      var yTuboTopo = terreno + m2px(rec);
      var yBloco = terreno + m2px(RECB_BLOCO);
      var x0 = 125 - A / 2;
      svg.appendChild(sv('line', { x1: 14, y1: terreno, x2: 240, y2: terreno, stroke: COR_SOLO, 'stroke-width': 1.6 }));
      for (var xh = 18; xh < 240; xh += 14) {
        svg.appendChild(sv('line', { x1: xh, y1: terreno, x2: xh - 6, y2: terreno - 6, stroke: COR_SOLO, 'stroke-width': 1 }));
      }
      retBloco(svg, x0, yBloco, A, H);
      /* tubo em corte, dentro do bloco */
      svg.appendChild(sv('circle', { cx: 125, cy: yTuboTopo + dTubo / 2, r: dTubo / 2,
        fill: 'var(--surface)', stroke: COR_TUBO, 'stroke-width': 2.4 }));
      /* berço */
      svg.appendChild(sv('rect', { x: x0 - 6, y: yBloco + H, width: A + 12, height: Math.max(3, m2px(lastro)),
        fill: COR_SOLO, opacity: 0.45 }));
      cotaV(svg, x0 - 16, terreno, yTuboTopo, mRot(rec));
      cotaV(svg, x0 + A + 14, yBloco, yBloco + H, mRot(sol.altura));
      cotaH(svg, x0, x0 + A, yBloco + H + Math.max(3, m2px(lastro)) + 12, mRot(sol.largura));
      cotaV(svg, 22, terreno, yBloco + H + Math.max(3, m2px(lastro)), mRot(profValaDes));
      svg.appendChild(sv('text', { x: 125, y: 211, 'text-anchor': 'middle', 'font-size': 9,
        fill: COR_SOLO }, 'topo do bloco a ' + UI.num(RECB_BLOCO, 2) + ' m do terreno; tubo DE ' +
        UI.num(info.deMm, 0) + ' mm; berço de ' + UI.num(lastro * 100, 0) + ' cm'));
    }));

    /* ---- CORTE LONGITUDINAL (ao longo do tubo) ---- */
    vistas.push(vista('CORTE LONGITUDINAL', 230, 190, function (svg) {
      var terreno = 40;
      var T = m2px(sol.espessura), H = m2px(sol.altura);
      var dTubo = Math.max(8, m2px(deM));
      var yTuboTopo = terreno + m2px(rec);
      var yBloco = Math.max(terreno + 6, yTuboTopo + dTubo / 2 - H / 2);
      var x0 = 115 - T / 2;
      svg.appendChild(sv('line', { x1: 10, y1: terreno, x2: 220, y2: terreno, stroke: COR_SOLO, 'stroke-width': 1.6 }));
      for (var xh = 14; xh < 220; xh += 14) {
        svg.appendChild(sv('line', { x1: xh, y1: terreno, x2: xh - 6, y2: terreno - 6, stroke: COR_SOLO, 'stroke-width': 1 }));
      }
      /* tubo longitudinal */
      svg.appendChild(sv('rect', { x: 10, y: yTuboTopo, width: 210, height: dTubo,
        fill: 'var(--surface)', stroke: COR_TUBO, 'stroke-width': 2 }));
      retBloco(svg, x0, yBloco, T, H);
      cotaH(svg, x0, x0 + T, yBloco - 10, mRot(sol.espessura));
      cotaV(svg, x0 - 16, yBloco, yBloco + H, mRot(sol.altura));
      svg.appendChild(sv('text', { x: 115, y: 182, 'text-anchor': 'middle', 'font-size': 9,
        fill: COR_SOLO }, 'espessura no sentido da linha; o bloco envolve a peça'));
    }));

    /* ---- PERSPECTIVA ---- */
    vistas.push(vista('PERSPECTIVA', 230, 190, function (svg) {
      var c30 = Math.cos(Math.PI / 6), s30 = Math.sin(Math.PI / 6);
      var e2 = 78 / Math.max(sol.largura + sol.espessura, sol.altura * 1.5);
      function iso(x, y, z) {
        return [115 + (x - y) * c30 * e2, 118 + (x + y) * s30 * e2 - z * e2];
      }
      function face(pts, op) {
        svg.appendChild(sv('path', {
          d: 'M ' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L ') + ' Z',
          fill: COR_BLOCO, opacity: op, stroke: COR_BORDA, 'stroke-width': 1.4, 'stroke-linejoin': 'round'
        }));
      }
      var Lx = sol.largura, Ey = sol.espessura, Hz = sol.altura;
      /* topo, frente, lado */
      face([iso(0, 0, Hz), iso(Lx, 0, Hz), iso(Lx, Ey, Hz), iso(0, Ey, Hz)], 0.18);
      face([iso(0, Ey, 0), iso(Lx, Ey, 0), iso(Lx, Ey, Hz), iso(0, Ey, Hz)], 0.34);
      face([iso(Lx, 0, 0), iso(Lx, Ey, 0), iso(Lx, Ey, Hz), iso(Lx, 0, Hz)], 0.26);
      /* tubo atravessando (na meia altura) */
      var r = Math.max(4, m2px(deM) / 2) * 0.8;
      var pA = iso(-Lx * 0.35, Ey / 2, Hz / 2), pB = iso(Lx * 1.35, Ey / 2, Hz / 2);
      svg.appendChild(sv('line', { x1: pA[0], y1: pA[1], x2: pB[0], y2: pB[1],
        stroke: COR_TUBO, 'stroke-width': r * 2, opacity: 0.5, 'stroke-linecap': 'round' }));
      /* cotas nas arestas */
      var a1 = iso(0, Ey, 0), a2 = iso(Lx, Ey, 0), a3 = iso(Lx, 0, 0), a4 = iso(Lx, Ey, Hz);
      function rotIso(x, y, txt, anc) {
        svg.appendChild(sv('text', { x: x, y: y, 'text-anchor': anc || 'middle', 'font-size': 9.5,
          fill: COR_SOLO, stroke: 'var(--surface)', 'stroke-width': 3, 'paint-order': 'stroke',
          'stroke-linejoin': 'round' }, txt));
      }
      rotIso((a1[0] + a2[0]) / 2 - 8, (a1[1] + a2[1]) / 2 + 15, mRot(Lx));
      rotIso((a2[0] + a3[0]) / 2 + 4, (a2[1] + a3[1]) / 2 + 13, mRot(Ey), 'start');
      rotIso(Math.min((a2[0] + a4[0]) / 2 + 6, 200), (a2[1] + a4[1]) / 2, mRot(Hz), 'start');
    }));

    var grade = h('div', { class: 'vistas-bloco' });
    vistas.forEach(function (v) { grade.appendChild(h('div', { class: 'vista-caixa' }, v)); });
    return grade;
  };

  /* quantidades e dimensões da solução adotada */
  UB.quadroSolucao = function (info, sol) {
    var deM = info.deMm / 1000;
    var profVala = (sol.rec || 0) + deM + BA.LASTRO;
    var linhas = [
      ['Bloco adotado', sol.via === 'padrao'
        ? 'padronizado tipo ' + sol.tipo + ' (recobrimento ' + UI.numEdit(sol.rec) + ' m)'
        : (sol.via === 'peso' ? 'calculado — bloco de peso' : 'calculado — apoio no solo')],
      ['Dimensões (largura × altura × espessura)',
        UI.num(sol.largura, 2) + ' × ' + UI.num(sol.altura, 2) + ' × ' + UI.num(sol.espessura, 2) + ' m' +
        (sol.espessuraEquivalente ? '  (espessura média equivalente ao volume tabelado)' : '')],
      sol.via === 'padrao' ? ['Capacidade tabelada', UI.num(sol.cap, 0) + ' kgf  ≥  E = ' + UI.num(info.calc.E, 0) + ' kgf'] : null,
      sol.Anec ? ['Área de encosto  A = FS·E/σ', UI.num(sol.Anec, 2) + ' m²  (adotada ' + UI.num(sol.largura * sol.altura, 2) + ' m²)'] : null,
      sol.G ? ['Peso necessário  G = FS·E', UI.num(sol.G, 0) + ' kgf'] : null,
      ['Profundidade da vala', UI.num(Math.max(profVala, 0.20 + sol.altura + BA.LASTRO), 2) +
        ' m  (governa o maior entre recobrimento + DE + berço e 0,20 m + altura do bloco + berço)'],
      ['Concreto', UI.num(sol.concreto, 2) + ' m³'],
      ['Forma', UI.num(sol.forma, 2) + ' m²'],
      ['Armadura', UI.num(sol.aco, 0) + ' kg' + (sol.acoEstimado
        ? '  (previsão: ' + BA.TAXA_ACO + ' kg/m³ — malha nas faces, a detalhar no projeto estrutural)'
        : '  (do padrão da concessionária)')]
    ].filter(Boolean);
    return h('table', { class: 'tab-apoio' }, h('tbody', {},
      linhas.map(function (l) {
        return h('tr', {}, h('td', { class: 'esq' }, l[0]), h('td', {}, l[1]));
      })));
  };

  /* ================================================================
     Cartão de um bloco
     ================================================================ */

  function selectPeca(st, base, b) {
    return UI.select(st, 'Peça', base + '.pecaId',
      BA.pecas.map(function (p) { return { v: p.id, rot: p.rot }; }),
      { dica: 'A peça define a geometria do empuxo: E = p·A em tês, caps, flanges cegos e válvulas fechadas; E = 2·p·A·sen(θ/2) nas curvas; E = p·(A₁−A₂) nas reduções. A é a área da seção EXTERNA (DE).' });
  }

  function selectTubo(st, ctx, base, b) {
    var ops = (st.adutoras || []).map(function (a, i) {
      return { v: 'adutora.' + i, rot: a.rot + (a.itemRot ? ' — ' + a.itemRot : ' (sem diâmetro)') };
    });
    ops.push({ v: 'manual', rot: 'Escolher o tubo aqui' });
    return UI.select(st, 'Tubo', base + '.tuboOrigem', ops,
      { dica: 'Herdar do trecho da adutora traz catálogo, DN e DE automaticamente — e o bloco acompanha se o diâmetro do trecho mudar. "Escolher aqui" libera catálogo e DN próprios (é o modo da versão avulsa).' });
  }

  function camposTuboManual(st, ctx, base, b) {
    var cat = PDA.CAT.buscar(ctx.cats.todos, b.catalogoId);
    var itens = cat ? cat.itens : [];
    return [
      UI.select(st, 'Catálogo', base + '.catalogoId',
        ctx.cats.todos.map(function (c) { return { v: c.id, rot: c.nome }; })),
      UI.select(st, 'DN', base + '.itemRot',
        [{ v: '', rot: '—' }].concat(itens.map(function (it) {
          return { v: it.rot, rot: it.rot + (it.de ? '  (DE ' + UI.num(it.de, 0) + ')' : '') };
        }))),
      UI.campo(st, 'DE (mm)', base + '.deOverride',
        { dica: 'Deixe em branco para usar o DE do catálogo. Preencha para forçar outro diâmetro externo — por exemplo, o DE da bolsa da junta.', placeholder: 'do catálogo' })
    ];
  }

  function camposPressao(st, res, base, b) {
    var temRes = !!res;
    var ops = [];
    if (temRes) {
      ops.push({ v: 'transitorio', rot: 'Envoltória do transitório (recomendado)' });
      ops.push({ v: 'ensaio', rot: 'Pressão de ensaio (fator × Hm)' });
    }
    ops.push({ v: 'informada', rot: 'Pressão informada' });
    var out = [
      UI.select(st, 'Pressão de cálculo', base + '.pressaoFonte', ops,
        { chave: true,
          dica: 'O empuxo é proporcional à pressão. A envoltória do transitório usa a maior pressão calculada na linha (com a linha já protegida, se for o caso). A pressão de ensaio segue o critério clássico de bloco: fator (usualmente 1,5) sobre a pressão de serviço. A terceira opção aceita qualquer valor — por exemplo, o resultado de um estudo de transiente externo.' })
    ];
    if (b.pressaoFonte === 'ensaio') {
      out.push(UI.campo(st, 'Fator de ensaio', base + '.fatorEnsaio', { larg: 70 }));
    }
    if (b.pressaoFonte === 'informada' || !temRes) {
      out.push(UI.campo(st, 'Pressão (mca)', base + '.pressaoInformada', { chave: true }));
    }
    return out;
  }

  function camposSolo(st, base, b) {
    return [
      UI.select(st, 'Recobrimento (m)', base + '.recobrimento',
        BA.RECOBRIMENTOS.map(function (r) { return { v: r, rot: UI.numEdit(r) + ' m' }; }),
        { tipo: 'num',
          dica: 'Altura de solo sobre a geratriz do tubo. As capacidades dos blocos padronizados dependem dela: mais recobrimento, mais capacidade.' }),
      UI.select(st, 'Solo de apoio', base + '.soloId',
        BA.solos.map(function (s) {
          return { v: s.id, rot: s.rot + (s.sigma > 0 ? '  (' + UI.num(s.sigma / 1000, 0) + ' tf/m²)' : '') };
        }),
        { dica: 'Tensão admissível de apoio para anteprojeto (AWWA M41 / DIPRA; Azevedo Netto). O bloco encosta na parede NÃO escavada da vala — solo revolvido não conta. Confirmar com sondagem quando o bloco for grande.' }),
      UI.campo(st, 'σ adm (kgf/m²)', base + '.sigmaOverride',
        { placeholder: 'da tabela', dica: 'Preencha para adotar uma tensão admissível própria (sondagem, SPT). Em branco, vale o valor da tabela para o solo escolhido.' })
    ];
  }

  /* tabela dos blocos padronizados, com ★ no sugerido e clique para adotar */
  function tabelaPadrao(info, base) {
    var calc = info.calc;
    /* quando a sugestão só coube em recobrimento maior, é a tabela DESSE
       recobrimento que interessa ver — com a estrela nela */
    var recExib = (calc.padrao && calc.padrao.achou && !calc.padrao.recPedido)
      ? calc.padrao.rec : null;
    if (recExib !== null && info.dn) {
      calc = Object.assign({}, calc, { tabela: BA.tabelaPadrao(info.dn, recExib) });
    }
    if (!calc.tabela) {
      return h('p', { class: 'vazio' }, info.dn
        ? 'Não há blocos padronizados para DN ' + info.dn + ' com este recobrimento — vale o bloco calculado ao lado.'
        : 'Escolha o tubo para listar os blocos padronizados.');
    }
    var sugerido = calc.padrao && calc.padrao.achou &&
      (calc.padrao.recPedido || recExib !== null) ? calc.padrao.linha.tipo : null;
    var adotado = calc.escolhido ? calc.escolhido.tipo : sugerido;

    var linhas = calc.tabela.linhas.filter(function (l) { return l.cap !== null; }).map(function (l) {
      var atende = l.cap >= calc.E;
      var classe = atende ? (l.tipo === sugerido ? 'bom' : '') : 'ruim';
      return h('tr', {
        class: classe + (l.tipo === adotado ? ' selecionada' : ''),
        style: 'cursor:pointer',
        title: atende ? 'Resiste ao empuxo. Clique para adotar.' : 'NÃO resiste ao empuxo calculado.',
        'data-acao': 'blocoTipo', 'data-base': base, 'data-tipo-bloco': l.tipo
      },
        h('td', { class: 'esq' },
          l.tipo === sugerido ? h('span', { title: 'Sugestão: o menor bloco padronizado que resiste ao empuxo com o recobrimento pedido', style: 'color:var(--teal-vivo)' }, '★ ') : null,
          'Tipo ' + l.tipo),
        h('td', {}, UI.num(l.cap, 0)),
        h('td', {}, UI.num(l.H, 2) + ' × ' + UI.num(l.A, 2)),
        h('td', {}, UI.num(l.concreto, 2)),
        h('td', {}, UI.num(l.forma, 2)),
        h('td', {}, UI.num(l.aco, 0)),
        h('td', {}, UI.tagClasse(atende ? 'bom' : 'ruim')));
    });

    return h('div', {},
      UI.tabela([{ rot: 'Bloco', esq: true },
        { rot: 'E máx (kgf)', dica: 'Capacidade tabelada do bloco padronizado para este DN e recobrimento (tabela da concessionária transcrita da sua planilha, com as correções registradas na aba Fontes do memorial).' },
        'H × A (m)', 'Concreto (m³)', 'Forma (m²)', 'Aço (kg)', 'Situação'], linhas),
      h('p', { class: 'nota', style: 'margin-top:5px' },
        'DN da tabela: ' + calc.tabela.dnTabela + ' · recobrimento ' + UI.numEdit(calc.tabela.rec) + ' m' +
        (recExib !== null ? ' (nenhum tipo coube com o recobrimento pedido; esta é a tabela em que a sugestão coube)' : '') +
        '. Clique para adotar um tipo; ★ é a sugestão. ',
        info.b.tipoEscolhido ? h('button', { class: 'btn mini', type: 'button', 'data-acao': 'blocoTipo',
          'data-base': base, 'data-tipo-bloco': '' }, 'Voltar à sugestão') : null));
  }

  function resultado(info, base) {
    var calc = info.calc;
    var out = [];

    if (!(info.deMm > 0) || !(info.pMca > 0)) {
      return h('div', { class: 'aviso info' },
        'Escolha o tubo e a pressão de cálculo para o bloco ser dimensionado.');
    }

    /* linha-resumo do empuxo */
    out.push(h('div', { class: 'linha', style: 'gap:16px;flex-wrap:wrap;margin:7px 0' },
      h('span', {}, 'DE: ', h('b', {}, UI.num(info.deMm, 1) + ' mm'),
        info.trechoRot ? h('span', { class: 'nota' }, '  (de ' + info.trechoRot + ')') : null),
      h('span', {}, 'Pressão de cálculo: ', h('b', {}, UI.num(info.pMca, 1) + ' mca'),
        h('span', { class: 'nota' }, '  — ' + info.pOrigem)),
      h('span', {}, 'Empuxo: ', h('b', { style: 'font-size:15px' }, UI.num(calc.E, 0) + ' kgf'),
        h('span', { class: 'nota' }, '  (' + UI.num(calc.E / 1000, 2) + ' tf; ' +
          UI.num(calc.unit, 1) + ' kgf por mca)'))));

    info.avisos.forEach(function (a) {
      out.push(h('div', { class: 'aviso' }, a));
    });

    /* a solução que vale, dita com todas as letras — o tipo de solo altera
       só a verificação de apoio, nunca o bloco padronizado */
    var sol = BA.solucao(calc, info.b);
    if (sol) {
      out.push(h('div', { class: 'solucao-bloco ' + (sol.atende ? 'bom' : 'ruim') },
        h('b', {}, 'Solução adotada: '),
        sol.via === 'padrao'
          ? 'bloco padronizado tipo ' + sol.tipo + ' — ' + UI.num(sol.largura, 2) + ' × ' +
            UI.num(sol.altura, 2) + ' × ' + UI.num(sol.espessura, 2) + ' m, ' +
            UI.num(sol.concreto, 2) + ' m³ de concreto (capacidade ' + UI.num(sol.cap, 0) +
            ' kgf ≥ E = ' + UI.num(calc.E, 0) + ' kgf)'
          : 'bloco calculado — ' + UI.num(sol.largura, 2) + ' × ' + UI.num(sol.altura, 2) + ' × ' +
            UI.num(sol.espessura, 2) + ' m, ' + UI.num(sol.concreto, 2) + ' m³ de concreto' +
            (sol.via === 'peso' ? ' (bloco de peso)' : ' (apoio no solo)')));
    }

    if (calc.orientacao === 'horizontal') {
      out.push(h('div', { class: 'blocos-vias' },
        h('div', { class: 'via' },
          h('h4', {}, 'Bloco padronizado', UI.dica('Seleção entre os blocos-padrão da concessionária (tipos 1 a 26), pela capacidade tabelada por DN e recobrimento — a sistemática da sua planilha, com o empuxo calculado pelo DE. As capacidades são tabeladas: NÃO dependem do tipo de solo escolhido.')),
          tabelaPadrao(info, base)),
        h('div', { class: 'via' },
          h('h4', {}, 'Verificação de apoio no solo (bloco calculado)', UI.dica('Método clássico de anteprojeto: a área de encosto na parede da vala precisa transmitir FS·E ao terreno sem exceder a tensão admissível σ. A = FS·E/σ (Azevedo Netto; AWWA M41).\n\nÉ ESTA coluna que muda quando o tipo de solo muda — o bloco padronizado ao lado continua o mesmo. As duas vias são independentes: a tabela dá o bloco-padrão; o cálculo dá o bloco mínimo para o SEU solo.')),
          viaApoio(calc))));
    } else {
      out.push(h('div', { class: 'blocos-vias' },
        h('div', { class: 'via' },
          h('h4', {}, calc.orientacao === 'vert_cima'
            ? 'Curva vertical convexa — bloco de peso'
            : 'Curva vertical côncava — apoio no fundo da vala'),
          calc.orientacao === 'vert_cima' ? viaPeso(calc) : viaApoio(calc))));
    }

    /* desenho do bloco adotado + quantidades */
    if (sol) {
      out.push(h('div', { style: 'margin-top:12px' },
        h('h4', { class: 'titulo-desenho' }, 'Desenho do bloco adotado'),
        UB.desenhoBloco(info, sol),
        h('div', { style: 'max-width:640px;margin-top:8px' }, UB.quadroSolucao(info, sol))));
    }
    return h('div', {}, out);
  }

  function viaApoio(calc) {
    var a = calc.apoio;
    if (!a || !a.ok) {
      return h('div', { class: 'aviso' }, 'O solo escolhido não tem capacidade de apoio — solução específica.');
    }
    return h('div', {},
      h('table', { class: 'tab-apoio' }, h('tbody', {},
        h('tr', {}, h('td', { class: 'esq' }, 'Área de encosto necessária  A = FS·E/σ'),
          h('td', {}, h('b', {}, UI.num(a.Anec, 2) + ' m²'))),
        h('tr', {}, h('td', { class: 'esq' }, 'Sugestão de encosto (altura × largura)'),
          h('td', {}, UI.num(a.b, 2) + ' × ' + UI.num(a.L, 2) + ' m  (' + UI.num(a.Aefetiva, 2) + ' m²)')),
        h('tr', {}, h('td', { class: 'esq' }, 'Espessura no sentido do empuxo'),
          h('td', {}, UI.num(a.esp, 2) + ' m')),
        h('tr', {}, h('td', { class: 'esq' }, 'Concreto do bloco calculado (muda com o solo)'),
          h('td', {}, UI.num(a.concreto, 2) + ' m³')),
        h('tr', {}, h('td', { class: 'esq' }, 'Tensão atuante com o encosto sugerido'),
          h('td', {}, UI.num(a.sigmaAtuante, 0) + ' kgf/m²  (FS efetivo ' + UI.num(a.fsEfetivo, 2) + ')')))),
      h('p', { class: 'nota', style: 'margin-top:5px' },
        'O encosto vale contra solo firme, não escavado. Curvas verticais e blocos grandes pedem verificação estrutural própria.'));
  }

  function viaPeso(calc) {
    var p = calc.peso;
    return h('div', {},
      h('table', { class: 'tab-apoio' }, h('tbody', {},
        h('tr', {}, h('td', { class: 'esq' }, 'Peso necessário  G = FS·E'),
          h('td', {}, h('b', {}, UI.num(p.G, 0) + ' kgf'))),
        h('tr', {}, h('td', { class: 'esq' }, 'Concreto  V = G/γ'),
          h('td', {}, h('b', {}, UI.num(p.concreto, 2) + ' m³'))),
        h('tr', {}, h('td', { class: 'esq' }, 'Sugestão (base × largura)'),
          h('td', {}, UI.num(p.b, 2) + ' × ' + UI.num(p.L, 2) + ' m')))),
      h('p', { class: 'nota', style: 'margin-top:5px' },
        'Na curva vertical convexa o empuxo é para cima e quem resiste é o peso próprio do bloco (o solo de cobertura é desprezado a favor da segurança). Verificar a tração no tubo e o envolvimento da peça.'));
  }

  UB.cartaoBloco = function (st, ctx, res, b, i, total) {
    var base = 'blocos.itens.' + i;
    var info = PDA.C.blocoInfo(st, ctx, res, b);
    var manual = b.tuboOrigem === 'manual' || !(st.adutoras || []).length;

    var linha1 = [selectPeca(st, base, b)];
    if (b.pecaId === 'reducao') {
      linha1.push(UI.campo(st, 'DN de saída', base + '.dn2',
        { dica: 'DN comercial do lado menor da redução. O programa busca o DE correspondente no catálogo.' }));
    }
    linha1.push(UI.select(st, 'Orientação', base + '.orientacao', [
      { v: 'horizontal', rot: 'Horizontal (planta)' },
      { v: 'vert_baixo', rot: 'Vertical — empuxo para baixo' },
      { v: 'vert_cima', rot: 'Vertical — empuxo para cima' }
    ], { dica: 'Curva em planta: o bloco encosta na parede da vala. Curva vertical côncava (fundo de vale): o empuxo é para baixo, apoiado no fundo. Curva vertical convexa (crista): o empuxo é para cima e quem segura é o peso do bloco.' }));
    if (!PDA.MODO_BLOCO) linha1.push(selectTubo(st, ctx, base, b));
    if (manual || PDA.MODO_BLOCO) camposTuboManual(st, ctx, base, b).forEach(function (c) { linha1.push(c); });

    return UI.cartao(
      h('span', {}, h('input', { type: 'text', value: b.rot, 'data-bind': base + '.rot', 'data-tipo': 'texto',
                                 class: 'titulo', 'aria-label': 'Nome do bloco' }),
        ' ', UI.tagClasse(info.classe)),
      null,
      h('div', {},
        h('div', { class: 'linha campos' }, linha1),
        h('div', { class: 'linha campos' },
          camposPressao(st, res, base, b).concat(camposSolo(st, base, b))),
        h('div', { class: 'linha', style: 'align-items:flex-start;gap:14px;flex-wrap:wrap' },
          h('div', { style: 'flex:0 0 340px;max-width:100%' }, UB.esquema(info)),
          h('div', { style: 'flex:1 1 420px;min-width:280px' }, resultado(info, base)))),
      h('div', { class: 'linha', style: 'gap:6px' },
        i > 0 ? h('button', { class: 'btn mini', type: 'button', 'data-acao': 'blocoMover', 'data-i': i, 'data-d': -1, title: 'Mover para cima' }, '↑') : null,
        i < total - 1 ? h('button', { class: 'btn mini', type: 'button', 'data-acao': 'blocoMover', 'data-i': i, 'data-d': 1, title: 'Mover para baixo' }, '↓') : null,
        h('button', { class: 'btn mini', type: 'button', 'data-acao': 'blocoDuplicar', 'data-i': i }, 'Duplicar'),
        h('button', { class: 'btn mini perigo', type: 'button', 'data-acao': 'blocoExcluir', 'data-i': i }, 'Excluir')));
  };

  /* ================================================================
     Memória de cálculo na tela (card separado, no fim da aba)
     ================================================================ */

  function memoriaDeUm(st, info) {
    var calc = info.calc;
    var b = info.b;
    if (!(info.deMm > 0) || !(info.pMca > 0)) return null;
    var p = BA.peca(b.pecaId);
    var deM = info.deMm / 1000;
    var A = Math.PI * deM * deM / 4;
    var nn = function (v, d) { return UI.num(v, d === undefined ? 2 : d); };
    var linhas = [];

    /* empuxo */
    linhas.push('A = \\frac{\\pi \\cdot ' + nn(deM, 4) + '^2}{4} = ' + nn(A, 4) + '\\ \\text{m}^2');
    if (p.reducao) {
      var de2M = info.de2Mm / 1000;
      var A2 = Math.PI * de2M * de2M / 4;
      linhas.push('A_2 = \\frac{\\pi \\cdot ' + nn(de2M, 4) + '^2}{4} = ' + nn(A2, 4) + '\\ \\text{m}^2');
      linhas.push('E = 1000 \\cdot p \\cdot ( A - A_2 ) = 1000 \\cdot ' + nn(info.pMca, 1) +
        ' \\cdot ' + nn(A - A2, 4) + ' = ' + nn(calc.E, 0) + '\\ \\text{kgf}');
    } else if (p.axial) {
      linhas.push('E = 1000 \\cdot p \\cdot A = 1000 \\cdot ' + nn(info.pMca, 1) +
        ' \\cdot ' + nn(A, 4) + ' = ' + nn(calc.E, 0) + '\\ \\text{kgf}');
    } else {
      linhas.push('E = 2 \\cdot 1000 \\cdot p \\cdot A \\cdot sen ( \\frac{' + nn(p.ang, 1) +
        '°}{2} ) = ' + nn(calc.E, 0) + '\\ \\text{kgf}');
    }

    var passos = [
      h('p', { class: 'nota' }, 'Pressão de cálculo: ' + nn(info.pMca, 1) + ' mca — ' + info.pOrigem +
        '. DE = ' + nn(info.deMm, 1) + ' mm' + (info.trechoRot ? ' (de ' + info.trechoRot + ')' : '') + '.'),
      PDA.FX.bloco(linhas, { tam: 15 })
    ];

    /* seleção do padronizado */
    if (calc.orientacao === 'horizontal' && calc.padrao && calc.padrao.achou) {
      passos.push(h('p', { class: 'nota' },
        'Bloco padronizado: menor tipo com capacidade ≥ E na tabela do DN ' +
        (calc.tabela ? calc.tabela.dnTabela : info.dn) + ' → tipo ' + calc.padrao.linha.tipo +
        ' (capacidade ' + nn(calc.padrao.linha.cap, 0) + ' kgf, recobrimento ' +
        UI.numEdit(calc.padrao.rec) + ' m)' +
        (calc.escolhido ? '; adotado manualmente o tipo ' + calc.escolhido.tipo + '.' : '.')));
    }

    /* apoio / peso */
    if (calc.apoio && calc.apoio.ok && calc.orientacao !== 'vert_cima') {
      var ap = calc.apoio;
      passos.push(PDA.FX.bloco([
        'A_{nec} = \\frac{FS \\cdot E}{\\sigma_{adm}} = \\frac{' + UI.numEdit(calc.fs) +
          ' \\cdot ' + nn(calc.E, 0) + '}{' + nn(calc.sigma, 0) + '} = ' + nn(ap.Anec, 2) + '\\ \\text{m}^2',
        '\\sigma = \\frac{' + nn(calc.E, 0) + '}{' + nn(ap.b, 2) + ' \\cdot ' + nn(ap.L, 2) +
          '} = ' + nn(ap.sigmaAtuante, 0) + '\\ \\text{kgf/m}^2 \\qquad \\text{(admissível: ' +
          nn(calc.sigma, 0) + ' kgf/m², ' + calc.solo.rot.toLowerCase() + ')}'
      ], { tam: 15 }));
    }
    if (calc.peso) {
      passos.push(PDA.FX.bloco([
        'G = FS \\cdot E = ' + UI.numEdit(calc.fs) + ' \\cdot ' + nn(calc.E, 0) + ' = ' +
          nn(calc.peso.G, 0) + '\\ \\text{kgf}',
        'V = \\frac{G}{\\gamma} = \\frac{' + nn(calc.peso.G, 0) + '}{' +
          UI.numEdit(st.blocos.gamaConcreto) + '} = ' + nn(calc.peso.concreto, 2) + '\\ \\text{m}^3'
      ], { tam: 15 }));
    }

    return h('div', { class: 'memoria-bloco' },
      h('h4', {}, b.rot + ' — ' + p.rot + (info.dn ? ', DN ' + info.dn : '')),
      passos);
  }

  UB.cartaoMemoria = function (st, ctx, res) {
    var itens = (st.blocos.itens || [])
      .map(function (b) { return memoriaDeUm(st, PDA.C.blocoInfo(st, ctx, res, b)); })
      .filter(Boolean);
    if (!itens.length) return null;
    return UI.cartao('Memória de cálculo dos blocos',
      'As mesmas contas que vão para o memorial, com os números do projeto', itens);
  };

  /* ================================================================
     Aba
     ================================================================ */

  UB.aba = function (st, ctx, res) {
    var out = [];
    var bl = st.blocos;

    /* ligar a opção já apresenta um bloco pronto para preencher */
    if ((bl.ativo || PDA.MODO_BLOCO) && !(bl.itens || []).length) {
      var b0 = PDA.E.novoBloco(1);
      if (PDA.MODO_BLOCO) { b0.tuboOrigem = 'manual'; b0.pressaoFonte = 'informada'; }
      bl.itens = [b0];
    }

    if (!PDA.MODO_BLOCO) {
      out.push(UI.cartao('Blocos de ancoragem', 'Pré-dimensionamento dos blocos nas curvas, tês, reduções e extremidades', [
        UI.check(st, 'Dimensionar os blocos de ancoragem desta linha', 'blocos.ativo', {
          dica: 'Toda mudança de direção ou de seção em tubulação com junta não travada gera um empuxo que precisa ser transmitido ao terreno. Esta aba pré-dimensiona os blocos: pela tabela de blocos padronizados e pelo cálculo clássico de apoio no solo.'
        }),
        !bl.ativo ? h('p', { class: 'nota', style: 'margin-top:9px' },
          'Com a opção desligada, nada muda no restante do programa nem no memorial.') : null
      ]));
      if (!bl.ativo) return out;
    }

    out.push(UI.cartao('Parâmetros', null,
      h('div', { class: 'linha campos' },
        UI.campo(st, 'Fator de segurança FS', 'blocos.fs',
          { dica: 'Aplicado sobre o empuxo na verificação de apoio (A = FS·E/σ) e no bloco de peso (G = FS·E). Usual: 1,5.' }),
        UI.campo(st, 'γ do concreto (kgf/m³)', 'blocos.gamaConcreto',
          { dica: 'Peso específico do concreto do bloco de peso. Concreto simples: 2400 kgf/m³; ciclópico: 2200 a 2400.' }))));

    (bl.itens || []).forEach(function (b, i) {
      out.push(UB.cartaoBloco(st, ctx, res, b, i, bl.itens.length));
    });

    out.push(h('div', { class: 'linha', style: 'margin:4px 0 10px' },
      h('button', { class: 'btn', type: 'button', 'data-acao': 'blocoNovo' },
        '+ Adicionar bloco de ancoragem')));

    var mem = UB.cartaoMemoria(st, ctx, res);
    if (mem) out.push(mem);

    out.push(UI.cartao('Como este pré-dimensionamento funciona', null,
      h('div', { class: 'nota', style: 'line-height:1.6' },
        h('p', {}, h('b', {}, 'Empuxo.'), ' E = p·A nas extremidades, tês e válvulas fechadas; E = 2·p·A·sen(θ/2) nas curvas; ' +
          'E = p·(A₁−A₂) nas reduções — com A na seção EXTERNA do tubo (DE), porque a pressão atua na junta. ' +
          'A planilha de origem usava o DN nominal, o que subestimava o empuxo em até 23 % no ferro fundido.'),
        h('p', {}, h('b', {}, 'Bloco padronizado.'), ' A tabela de tipos 1 a 26 com capacidade por DN e recobrimento foi transcrita ' +
          'da sua planilha (dois valores digitados errados foram corrigidos; as colunas DN 900/1000 de 1,75 m, omitidas por incoerência).'),
        h('p', {}, h('b', {}, 'Bloco calculado.'), ' Área de encosto A = FS·E/σ contra a parede não escavada da vala ' +
          '(Azevedo Netto; AWWA M41 / DIPRA). Cobre também curvas verticais e os casos em que nenhum bloco padronizado atende.'),
        h('p', {}, h('b', {}, 'Alcance.'), ' É pré-dimensionamento: define a ordem de grandeza e aponta os pontos críticos. ' +
          'Blocos grandes, solos moles e pressões altas pedem verificação geotécnica e estrutural específicas. ' +
          'Dimensione os blocos com a linha já protegida contra o transitório — bloco bom não compensa linha desprotegida.'))));

    return out;
  };

  PDA.UB = UB;
})(window.PDA = window.PDA || {});
