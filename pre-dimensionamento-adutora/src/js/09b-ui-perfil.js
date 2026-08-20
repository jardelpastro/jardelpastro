/* ------------------------------------------------------------------
 * Aba Perfil: lançamento do perfil da linha (colado de planilha) e
 * envoltórias de pressão do transitório ponto a ponto.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var Pf = {};
  var UI, h;
  var SVG = 'http://www.w3.org/2000/svg';

  Pf.init = function () { UI = PDA.UI; h = UI.h; };

  function sv(t, a, txt) {
    var e = document.createElementNS(SVG, t), k;
    for (k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  /* ================================================================
     Aba
     ================================================================ */

  Pf.aba = function (st, ctx, res) {
    var out = [];

    out.push(UI.cartao('Perfil da linha', 'Cole as estacas e as cotas direto da sua planilha', [
      UI.check(st, 'Lançar o perfil da linha e traçar as envoltórias de pressão', 'perfil.ativo', {
        dica: 'Com o perfil lançado, o programa interpola a linha piezométrica em cada ponto, soma e subtrai a sobrepressão do transitório e mostra onde a pressão estoura a classe do tubo ou cai abaixo de zero.'
      }),
      st.perfil.ativo ? Pf.entrada(st, ctx, res) : h('p', { class: 'nota', style: 'margin-top:9px' },
        'Sem o perfil, a verificação de pressão usa apenas os nós de trecho (início e fim de cada trecho da adutora).')
    ]));

    if (st.perfil.ativo && res.envoltoria) {
      out.push(Pf.cartaoEnvoltoria(st, ctx, res));
    } else if (st.perfil.ativo) {
      out.push(UI.cartao('Envoltórias de pressão', null, h('div', { class: 'aviso info' },
        'Lance ao menos dois pontos de perfil e um trecho de adutora com extensão e diâmetro para o programa ' +
        'traçar as envoltórias.')));
    }
    return out;
  };

  Pf.entrada = function (st, ctx, res) {
    var pts = st.perfil.pontos || [];
    var calc = PDA.C.perfilPontos(st);
    var lTrechos = 0;
    res.projeto.adutoras.forEach(function (r) { lTrechos += r.L; });

    var linhas = pts.map(function (p, i) {
      return UI.linhaArrastavel(h('tr', {},
        UI.celulaMover('perfil.pontos', i, pts.length),
        h('td', {}, h('input', { type: 'text', class: 'num', value: UI.numEdit(p.est),
                                 'data-bind': 'perfil.pontos.' + i + '.est', 'data-tipo': 'num', inputmode: 'decimal' })),
        h('td', {}, h('input', { type: 'text', class: 'num', value: UI.numEdit(p.cota),
                                 'data-bind': 'perfil.pontos.' + i + '.cota', 'data-tipo': 'num', inputmode: 'decimal' })),
        h('td', { class: 'esq' }, h('input', { type: 'text', value: p.rot || '', placeholder: 'opcional',
                                 'data-bind': 'perfil.pontos.' + i + '.rot', 'data-tipo': 'texto' })),
        h('td', {}, UI.num(calc.pontos[i] ? calc.pontos[i].x : 0, 1)),
        h('td', { class: 'col-x naoimprime' },
          h('button', { class: 'btn mini icone perigo', type: 'button',
                        'data-acao': 'delPontoPerfil', 'data-i': i }, '×'))),
        'perfil.pontos', i);
    });

    return h('div', {},
      h('div', { class: 'grade', style: 'margin-top:11px' },
        UI.select(st, 'A coluna de distância é', 'perfil.modo', [
          { v: 'acumulada', rot: 'distância acumulada desde a elevatória' },
          { v: 'individual', rot: 'extensão de cada trecho (o programa acumula)' }
        ], { dica: 'Use "acumulada" quando a sua planilha traz a estaca ou a distância a partir da origem. Use "extensão de cada trecho" quando traz o comprimento entre pontos consecutivos.' }),
        UI.select(st, 'Unidade da distância', 'perfil.unidExt',
          PDA.U.lista('extensao').map(function (u) { return { v: u, rot: u }; }))),

      h('div', { class: 'linha naoimprime', style: 'margin:11px 0 8px' },
        h('button', { class: 'btn primario', type: 'button', 'data-acao': 'colarPerfil' },
          'Colar perfil da planilha'),
        h('button', { class: 'btn', type: 'button', 'data-acao': 'addPontoPerfil' }, '+ ponto'),
        pts.length ? h('button', { class: 'btn perigo', type: 'button', 'data-acao': 'limparPerfil' }, 'Limpar tudo') : null,
        h('span', { class: 'nota' }, pts.length + ' ponto(s) · extensão do perfil ' + UI.num(calc.ultimoX, 1) + ' m' +
          (lTrechos > 0 ? ' · soma dos trechos ' + UI.num(lTrechos, 1) + ' m' : ''))),

      linhas.length
        ? h('div', { class: 'rolagem', style: 'max-height:340px;overflow-y:auto' },
            h('table', { class: 'enxuta pecas-tab' },
              h('thead', {}, h('tr', {},
                h('th', { class: 'naoimprime' }, 'Ordem'),
                h('th', {}, 'Distância (' + st.perfil.unidExt + ')'),
                h('th', {}, 'Cota do terreno / GI (m)',
                  UI.dica('Cota da geratriz inferior da tubulação, ou do terreno se você preferir trabalhar com o eixo do tubo. O programa compara a linha piezométrica com esta cota para obter a pressão disponível.')),
                h('th', { class: 'esq' }, 'Identificação'),
                h('th', {}, 'Acumulada (m)'),
                h('th', {}, ''))),
              h('tbody', {}, linhas)))
        : h('p', { class: 'vazio' }, 'Nenhum ponto lançado. Use "Colar perfil da planilha".'),

      lTrechos > 0 && calc.ultimoX > 0 && Math.abs(calc.ultimoX - lTrechos) / lTrechos > 0.02
        ? h('div', { class: 'aviso' },
            'A extensão do perfil (' + UI.num(calc.ultimoX, 0) + ' m) difere da soma das extensões dos trechos da ' +
            'adutora (' + UI.num(lTrechos, 0) + ' m). A envoltória usa a extensão dos trechos e interpola o perfil ' +
            'proporcionalmente — se as duas deviam ser iguais, ajuste a extensão dos trechos na aba Adutora.')
        : null);
  };

  /* ================================================================
     Envoltórias
     ================================================================ */

  Pf.cartaoEnvoltoria = function (st, ctx, res) {
    var env = res.envoltoria;
    var criticos = env.pontos.filter(function (p) { return p.classe === 'ruim'; });
    var atencao = env.pontos.filter(function (p) { return p.classe === 'atencao'; });

    var linhas = env.pontos.map(function (p) {
      return h('tr', { class: p.classe, title: p.motivos.join(' · ') },
        h('td', { class: 'esq' }, UI.num(p.x, 1) + (p.rot ? ' — ' + p.rot : '')),
        h('td', {}, UI.num(p.cota, 2)),
        h('td', {}, UI.num(p.hgl, 2)),
        h('td', {}, UI.tab(p.pPerm)),
        h('td', {}, h('b', {}, UI.tab(p.pMax))),
        h('td', {}, h('b', {}, UI.tab(p.pMin))),
        h('td', {}, p.pn ? UI.num(p.pn, 0) : '—'),
        h('td', {}, UI.tagClasse(p.classe)));
    });

    return UI.cartao('Envoltórias de pressão ao longo da linha',
      'Regime permanente, sobrepressão e subpressão do transitório', [
      Pf.grafico(st, ctx, res),
      h('div', { class: 'faixa-resumo', style: 'margin:11px 0' },
        PDA.F.chip('Δh adotado na elevatória', UI.num(env.dh, 1), 'mca'),
        PDA.F.chipAlerta('Maior pressão', UI.num(env.criticoMax.pMax, 1),
          'mca  em ' + UI.num(env.criticoMax.x, 0) + ' m',
          env.criticoMax.classe === 'ruim'
            ? { grave: true, txt: env.criticoMax.motivos.join(' · ') } : null, 'forte'),
        PDA.F.chipAlerta('Menor pressão', UI.num(env.criticoMin.pMin, 1),
          'mca  em ' + UI.num(env.criticoMin.x, 0) + ' m',
          env.criticoMin.pMin < 0
            ? { grave: env.criticoMin.pMin <= -10,
                txt: env.criticoMin.pMin <= -10
                  ? 'Subpressão abaixo de −10 mca: separação de coluna. É o caso clássico de necessidade de proteção contra o golpe.'
                  : 'Subpressão: risco de cavitação, entrada de ar pelas juntas e, em tubo de parede fina, colapso. Avalie ventosas de duplo efeito e proteção contra o transitório.' }
            : null, 'forte'),
        PDA.F.chip('Pontos críticos', String(criticos.length), 'de ' + env.pontos.length +
          (atencao.length ? '  ·  ' + atencao.length + ' em atenção' : ''))),

      criticos.length ? h('div', { class: 'aviso erro' },
        h('b', {}, criticos.length + ' ponto(s) reprovado(s)'),
        h('ul', {}, criticos.slice(0, 8).map(function (p) {
          return h('li', {}, UI.num(p.x, 0) + ' m' + (p.rot ? ' (' + p.rot + ')' : '') + ': ' + p.motivos.join('; '));
        })),
        criticos.length > 8 ? h('p', { class: 'nota' }, 'e outros ' + (criticos.length - 8) + ' pontos na tabela abaixo.') : null) : null,

      UI.tabela([{ rot: 'Distância (m)', esq: true }, 'Cota (m)', 'L.P. permanente (m)',
                 { rot: 'p permanente (mca)', dica: 'Pressão disponível em regime permanente: linha piezométrica menos a cota do ponto.' },
                 { rot: 'p máxima (mca)', dica: 'Permanente + sobrepressão do transitório. Compare com a pressão admissível do tubo.' },
                 { rot: 'p mínima (mca)', dica: 'Permanente − sobrepressão do transitório. Valores negativos indicam subpressão; abaixo de −10 mca há separação de coluna.' },
                 'PN (mca)', 'Situação'], linhas),

      h('div', { class: 'aviso' },
        h('b', {}, 'Como as envoltórias foram traçadas'),
        'Hipótese de anteprojeto: a sobrepressão Δh vale integralmente na elevatória e decai linearmente até zero ' +
        'no ponto de chegada, onde o nível do reservatório é fixo. As duas envoltórias são a linha piezométrica ' +
        'permanente mais e menos essa parcela. É o traçado clássico de anteprojeto, equivalente ao que se fazia ' +
        'com os gráficos de Allievi.',
        h('p', { style: 'margin:6px 0 0' },
          'O que ele NÃO faz: não integra as equações do transitório pelo método das características, não ' +
          'representa a reflexão de ondas em mudanças de diâmetro e de material, não modela a separação e o ' +
          'retorno da coluna líquida, e não considera dispositivo de proteção nenhum. Serve para identificar os ' +
          'pontos altos que pedem ventosa, os trechos onde a classe de pressão fica curta e se o transitório é ' +
          'crítico o suficiente para exigir estudo específico.'))
    ], UI.botaoFonte(['nbr12215']));
  };

  /* ================================================================
     Gráfico do perfil com as envoltórias
     ================================================================ */

  Pf.grafico = function (st, ctx, res) {
    var env = res.envoltoria;
    var pts = env.pontos;
    if (pts.length < 2) return h('p', { class: 'vazio' }, 'Ao menos dois pontos para desenhar.');

    var W = 940, HH = 380, mE = 58, mD = 16, mT = 18, mB = 46;
    var xMax = pts[pts.length - 1].x;
    var vals = [];
    pts.forEach(function (p) { vals.push(p.cota, p.hgl, p.envMax, p.envMin); });
    var yMin = Math.min.apply(null, vals), yMax = Math.max.apply(null, vals);
    var pad = Math.max(1, (yMax - yMin) * 0.08);
    yMin -= pad; yMax += pad;

    function px(x) { return mE + (xMax > 0 ? x / xMax : 0) * (W - mE - mD); }
    function py(c) { return mT + (yMax - c) / (yMax - yMin) * (HH - mT - mB); }

    var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + HH, class: 'perfil',
                        preserveAspectRatio: 'xMidYMid meet' });

    var i, nd = 6, c, x;
    for (i = 0; i <= nd; i++) {
      c = yMin + (yMax - yMin) * i / nd;
      s.appendChild(sv('line', { class: 'grade-l', x1: mE, x2: W - mD, y1: py(c), y2: py(c) }));
      s.appendChild(sv('text', { x: mE - 5, y: py(c) + 3, 'text-anchor': 'end' }, UI.num(c, 1)));
    }
    for (i = 0; i <= nd; i++) {
      x = xMax * i / nd;
      s.appendChild(sv('line', { class: 'grade-l', x1: px(x), x2: px(x), y1: mT, y2: HH - mB }));
      s.appendChild(sv('text', { x: px(x), y: HH - mB + 14, 'text-anchor': 'middle' }, UI.num(x, 0)));
    }

    function poli(campo) {
      return pts.map(function (p) { return px(p.x) + ',' + py(p[campo]); }).join(' ');
    }

    /* faixa entre as envoltórias */
    var area = pts.map(function (p) { return px(p.x) + ',' + py(p.envMax); })
      .concat(pts.slice().reverse().map(function (p) { return px(p.x) + ',' + py(p.envMin); })).join(' ');
    s.appendChild(sv('polygon', { points: area, fill: 'var(--vermelho)', opacity: 0.07 }));

    /* terreno preenchido */
    s.appendChild(sv('polygon', {
      points: poli('cota') + ' ' + px(xMax) + ',' + py(yMin) + ' ' + px(0) + ',' + py(yMin),
      fill: 'var(--texto-3)', opacity: 0.16
    }));

    s.appendChild(sv('polyline', { class: 'terreno', points: poli('cota'), 'stroke-dasharray': 'none',
                                   'stroke-width': 1.6 }));
    s.appendChild(sv('polyline', { points: poli('envMax'), fill: 'none',
                                   stroke: 'var(--vermelho)', 'stroke-width': 1.6 }));
    s.appendChild(sv('polyline', { points: poli('envMin'), fill: 'none',
                                   stroke: 'var(--teal)', 'stroke-width': 1.6, 'stroke-dasharray': '5 3' }));
    s.appendChild(sv('polyline', { class: 'lp', points: poli('hgl') }));

    /* pontos reprovados em destaque */
    pts.forEach(function (p) {
      if (p.classe === 'ruim') {
        s.appendChild(sv('circle', { cx: px(p.x), cy: py(p.cota), r: 3.6,
                                     fill: 'var(--vermelho)', stroke: 'var(--surface)', 'stroke-width': 1 }));
      }
    });

    s.appendChild(sv('text', { x: W - mD, y: HH - 6, 'text-anchor': 'end' }, 'distância (m)'));
    s.appendChild(sv('text', { x: 4, y: 11 }, 'cota (m)'));

    /* legenda em HTML, fora do desenho, para nunca cobrir as curvas */
    var leg = [
      ['var(--vermelho)', 'envoltória máxima — permanente + Δh', false],
      ['var(--azul)', 'linha piezométrica em regime permanente', false],
      ['var(--teal)', 'envoltória mínima — permanente − Δh', true],
      ['var(--texto-3)', 'perfil do terreno / geratriz da tubulação', false]
    ];
    var legenda = h('div', { style: 'display:flex;gap:16px;flex-wrap:wrap;margin-top:7px' },
      leg.map(function (l) {
        return h('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--texto-2)' },
          h('span', { style: 'display:inline-block;width:22px;height:0;border-top:' +
            (l[2] ? '2px dashed ' : '2px solid ') + l[0] }),
          l[1]);
      }),
      h('span', { style: 'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--texto-2)' },
        h('span', { style: 'display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--vermelho)' }),
        'ponto reprovado'));

    return h('div', {}, s, legenda);
  };

  /* ================================================================
     Colagem de planilha
     ================================================================ */

  Pf.modalColar = function (st) {
    var ta = h('textarea', { rows: 12, style: 'font-family:var(--mono);font-size:12px',
      placeholder: '0\t126,40\n120\t128,10\n350\t134,80\n720\t141,20' });
    var previa = h('div', { class: 'nota' }, 'Cole e clique em Interpretar.');
    var lidos = [];

    function interpretar() {
      var linhas = ta.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      lidos = [];
      var erros = 0;
      linhas.forEach(function (l) {
        /* separadores: tabulação, ponto e vírgula, barra vertical ou espaços.
           A vírgula é o separador decimal e nunca separa colunas. */
        var p = l.split(/[\t;|]+|\s+/).filter(function (x) { return x !== ''; });
        var a = UI.parseNum(p[0]), b = UI.parseNum(p[1]);
        if (a === null || b === null) { erros++; return; }
        lidos.push({ est: a, cota: b, rot: p.slice(2).join(' ') || '' });
      });
      UI.limpar(previa);
      UI.add(previa, lidos.length + ' ponto(s) interpretado(s)' +
        (erros ? '. ' + erros + ' linha(s) ignorada(s) por não ter dois números.' : '.'));
      previa.className = lidos.length ? 'aviso ok' : 'aviso';
    }

    UI.modal('Colar perfil da planilha', [
      h('p', { class: 'nota' },
        'Duas colunas: distância e cota. Selecione as duas colunas na sua planilha, copie e cole aqui. ' +
        'As colunas podem estar separadas por tabulação, ponto e vírgula ou espaços; a vírgula é lida como ' +
        'separador decimal. Uma terceira coluna de texto, se houver, entra como identificação do ponto ' +
        '(ponto alto, travessia, ventosa…).'),
      h('p', { class: 'nota' },
        'A interpretação de "distância acumulada" ou "extensão de cada trecho" e a unidade seguem o que está ' +
        'selecionado na aba Perfil.'),
      h('div', { class: 'linha', style: 'margin:9px 0' },
        h('button', { class: 'btn', type: 'button', onclick: interpretar }, 'Interpretar')),
      ta, previa
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button', onclick: function () {
          if (!lidos.length) interpretar();
          if (!lidos.length) { UI.toast('Nenhum ponto interpretado.'); return; }
          st.perfil.pontos = lidos;
          st.perfil.ativo = true;
          UI.fecharModal();
          UI.toast(lidos.length + ' pontos de perfil carregados.');
          PDA.App.render();
        }
      }, 'Substituir o perfil')
    ]);
  };

  Pf.modalColarCurva = function (st) {
    var ta = h('textarea', { rows: 10, style: 'font-family:var(--mono);font-size:12px',
      placeholder: '0\t62,0\n50\t60,5\n100\t56,0\n150\t48,0' });
    var previa = h('div', { class: 'nota' }, 'Cole e clique em Interpretar.');
    var lidos = [];

    function interpretar() {
      var linhas = ta.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      lidos = [];
      linhas.forEach(function (l) {
        var p = l.split(/[\t;|]+|\s+/).filter(function (x) { return x !== ''; });
        var a = UI.parseNum(p[0]), b = UI.parseNum(p[1]);
        if (a === null || b === null) return;
        lidos.push({ q: a, H: b });
      });
      UI.limpar(previa);
      UI.add(previa, lidos.length + ' ponto(s) interpretado(s).');
      previa.className = lidos.length >= 3 ? 'aviso ok' : 'aviso';
      if (lidos.length < 3) UI.add(previa, ' São necessários ao menos 3 pontos.');
    }

    UI.modal('Colar curva da bomba', [
      h('p', { class: 'nota' },
        'Duas colunas: vazão e altura manométrica de UMA bomba, na unidade de vazão selecionada no cartão da ' +
        'curva. Ao menos 3 pontos — o programa ajusta H = a₀ + a₁Q + a₂Q² por mínimos quadrados. ' +
        'Se tiver a altura com vazão nula (shut-off), inclua.'),
      h('div', { class: 'linha', style: 'margin:9px 0' },
        h('button', { class: 'btn', type: 'button', onclick: interpretar }, 'Interpretar')),
      ta, previa
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button', onclick: function () {
          if (!lidos.length) interpretar();
          if (lidos.length < 3) { UI.toast('São necessários ao menos 3 pontos.'); return; }
          st.curvaBomba.pontos = lidos;
          st.curvaBomba.ativo = true;
          UI.fecharModal();
          UI.toast(lidos.length + ' pontos de curva carregados.');
          PDA.App.render();
        }
      }, 'Substituir a curva')
    ]);
  };

  PDA.Pf = Pf;
})(window.PDA = window.PDA || {});
