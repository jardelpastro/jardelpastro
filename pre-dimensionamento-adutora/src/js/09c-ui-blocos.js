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
    if (!calc.tabela) {
      return h('p', { class: 'vazio' }, info.dn
        ? 'Não há blocos padronizados para DN ' + info.dn + ' com este recobrimento — vale o bloco calculado ao lado.'
        : 'Escolha o tubo para listar os blocos padronizados.');
    }
    var sugerido = calc.padrao && calc.padrao.achou && calc.padrao.recPedido ? calc.padrao.linha.tipo : null;
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
        'DN da tabela: ' + calc.tabela.dnTabela + ' · recobrimento ' + UI.numEdit(calc.tabela.rec) +
        ' m. Clique para adotar um tipo; ★ é a sugestão. ',
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

    if (calc.orientacao === 'horizontal') {
      out.push(h('div', { class: 'blocos-vias' },
        h('div', { class: 'via' },
          h('h4', {}, 'Bloco padronizado', UI.dica('Seleção entre os blocos-padrão da concessionária (tipos 1 a 26), pela capacidade tabelada por DN e recobrimento — a sistemática da sua planilha, com o empuxo calculado pelo DE.')),
          tabelaPadrao(info, base)),
        h('div', { class: 'via' },
          h('h4', {}, 'Bloco calculado pelo apoio no solo', UI.dica('Método clássico de anteprojeto: a área de encosto na parede da vala precisa transmitir FS·E ao terreno sem exceder a tensão admissível σ. A = FS·E/σ (Azevedo Netto; AWWA M41).')),
          viaApoio(calc))));
    } else {
      out.push(h('div', { class: 'blocos-vias' },
        h('div', { class: 'via' },
          h('h4', {}, calc.orientacao === 'vert_cima'
            ? 'Curva vertical convexa — bloco de peso'
            : 'Curva vertical côncava — apoio no fundo da vala'),
          calc.orientacao === 'vert_cima' ? viaPeso(calc) : viaApoio(calc))));
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
        h('tr', {}, h('td', { class: 'esq' }, 'Concreto estimado'),
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
