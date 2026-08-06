/* ------------------------------------------------------------------
 * Aba de resultados: cenários, composição de perdas, perfil
 * piezométrico, transitório, comparação de métodos e memorial.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var Res = {};
  var UI = PDA.UI, h;

  Res.init = function () { h = UI.h; };

  /* ---------------- faixa de resumo do topo ---------------- */

  Res.faixa = function (st, ctx, res) {
    var c = res.projeto;
    var av = Res.alertas(st, ctx, res);
    return h('div', { class: 'faixa-resumo' },
      PDA.F.chip('Vazão total', UI.num(ctx.qTotal * 1000, 1), 'L/s'),
      PDA.F.chip('Por bomba', UI.num(ctx.qBomba * 1000, 1), 'L/s'),
      PDA.F.chipAlerta('Hg', UI.num(c.Hg, 2), 'm', av.hg),
      PDA.F.chipAlerta('Perdas totais', UI.num(c.hSuccao + c.hRecalque, 2), 'm', av.perdas),
      PDA.F.chipAlerta('Hm', UI.num(c.Hm, 2), 'mca', av.hm, 'forte'),
      PDA.F.chip('BHP por bomba', UI.num(c.bhpCv, 1), 'cv'),
      PDA.F.chipAlerta('Motor', UI.numEdit(c.motorCv), 'cv (' + UI.num(c.motorKw, 1) + ' kW)', av.motor),
      c.npshd !== null ? PDA.F.chipAlerta('NPSH disp.', UI.num(c.npshd, 2), 'mca', av.npsh) : null,
      PDA.F.chipAlerta('Pressão máx.',
        res.golpe && res.golpe.length ? UI.num(Math.max.apply(null, res.golpe.map(function (g) { return g.pressaoMaxMca; })), 0) : '—',
        'mca c/ transitório', av.pressao),
      PDA.F.chip('Bombas', ctx.nOp + ' de ' + ctx.nInst, 'em operação'));
  };

  /* Sinais de atenção para os resultados que costumam passar batido */
  Res.alertas = function (st, ctx, res) {
    var c = res.projeto, av = {};

    if (c.Hg <= 0) {
      av.hg = { grave: true, txt: 'Altura geométrica nula ou negativa: a cota de chegada não é superior ao nível de sucção. Confira se as duas cotas estão na mesma referência de nível.' };
    } else if ((res.avisosDados || []).some(function (a) { return a.grave; })) {
      av.hg = { grave: true, txt: 'Há incoerência entre a cota de chegada e a cota final do último trecho da adutora. Veja a aba Resumo.' };
    }

    var perdas = c.hSuccao + c.hRecalque;
    if (c.Hm > 0) {
      var fracao = perdas / c.Hm;
      if (fracao > 0.6) {
        av.perdas = { grave: fracao > 0.8,
          txt: 'As perdas de carga respondem por ' + UI.num(fracao * 100, 0) + ' % da altura manométrica. ' +
               'Acima de 50 a 60 % é sinal de diâmetro apertado: normalmente compensa aumentar o diâmetro, ' +
               'porque o custo de energia domina o custo do tubo.' };
      }
    }
    if (perdas > 0 && (c.hlSuccao + c.hlRecalque) / perdas > 0.5) {
      av.perdas = av.perdas || {};
      av.perdas.txt = (av.perdas.txt ? av.perdas.txt + ' ' : '') +
        'As perdas localizadas são mais da metade do total (' +
        UI.num((c.hlSuccao + c.hlRecalque) / perdas * 100, 0) + ' %). Em adutoras longas isso é atípico — ' +
        'confira as quantidades de peças e os diâmetros lançados nelas.';
    }

    if (c.Hm > 0 && c.Hg > 0 && c.Hm / c.Hg > 3) {
      av.hm = { grave: false,
        txt: 'A altura manométrica é ' + UI.num(c.Hm / c.Hg, 1) + ' vezes a altura geométrica. ' +
             'Reveja o diâmetro da adutora — a energia gasta em perda de carga é maior que a gasta em elevar a água.' };
    }
    if (c.Hm <= 0) av.hm = { grave: true, txt: 'Altura manométrica não positiva. Revise cotas e perdas.' };

    if (c.motorCv && c.bhpCv > 0 && c.motorCv / c.bhpCv > 1.6) {
      av.motor = { grave: false,
        txt: 'O motor comercial escolhido tem ' + UI.num((c.motorCv / c.bhpCv - 1) * 100, 0) +
             ' % de folga sobre a potência de eixo, porque a potência calculada caiu logo acima de uma faixa ' +
             'comercial. Vale conferir se um ajuste de diâmetro traz o BHP para a faixa de baixo.' };
    }

    if (c.npshd !== null) {
      if (c.npshd < 0) av.npsh = { grave: true, txt: 'NPSH disponível negativo: a bomba não consegue aspirar nessa configuração.' };
      else if (c.npshd < 3) av.npsh = { grave: true, txt: 'NPSH disponível de apenas ' + UI.num(c.npshd, 2) + ' mca. Confira o NPSH requerido da bomba — a margem usual mínima é de 0,5 a 1,0 mca.' };
      else if (st.curvaBomba.npshr && c.npshd - Number(st.curvaBomba.npshr) < 0.5) {
        av.npsh = { grave: c.npshd - Number(st.curvaBomba.npshr) < 0,
          txt: 'Margem de apenas ' + UI.num(c.npshd - Number(st.curvaBomba.npshr), 2) + ' mca sobre o NPSH requerido.' };
      }
    }

    var pior = null;
    (res.golpe || []).forEach(function (g) {
      if (g.atende === false) pior = { grave: true, txt: g.rot + ': pressão máxima de ' + UI.num(g.pressaoMaxMca, 1) +
        ' mca com o transitório, acima da admissível do tubo (' + UI.num(g.pnMca, 0) + ' mca).' };
      else if (!pior && g.subpressao) pior = { grave: false, txt: g.rot + ': o transitório leva a pressão a ' +
        UI.num(g.pressaoMinMca, 1) + ' mca. Subpressão pede avaliação de ventosas e de proteção contra o golpe.' };
    });
    if (res.envoltoria) {
      if (res.envoltoria.criticoMin.pMin <= -10) {
        pior = { grave: true, txt: 'Separação de coluna prevista em ' + UI.num(res.envoltoria.criticoMin.x, 0) +
          ' m (pressão mínima de ' + UI.num(res.envoltoria.criticoMin.pMin, 1) + ' mca). Veja a aba Perfil.' };
      } else if (!pior && res.envoltoria.criticoMin.pMin < 0) {
        pior = { grave: false, txt: 'Subpressão de ' + UI.num(res.envoltoria.criticoMin.pMin, 1) + ' mca em ' +
          UI.num(res.envoltoria.criticoMin.x, 0) + ' m. Veja a aba Perfil.' };
      }
    }
    av.pressao = pior;

    return av;
  };

  /* ---------------- aba completa ---------------- */

  Res.aba = function (st, ctx, res) {
    var out = [];
    if (Res.naoIniciado(st, ctx, res)) {
      out.push(h('div', { class: 'aviso info' },
        h('b', {}, 'O projeto ainda não tem dados suficientes'),
        'Informe a vazão, as cotas de partida e de chegada na aba Resumo, e escolha o diâmetro de ao menos ' +
        'um trecho de adutora. Os resultados aparecem aqui assim que houver o que calcular.',
        h('div', { class: 'linha naoimprime', style: 'margin-top:9px' },
          h('button', { class: 'btn primario', type: 'button', 'data-acao': 'irAba', 'data-aba': 'resumo' },
            'Ir para o Resumo'),
          h('button', { class: 'btn', type: 'button', 'data-acao': 'exemplo' }, 'Abrir um exemplo'))));
    }
    (res.avisosDados || []).forEach(function (a) { out.push(PDA.F.blocoAviso(a)); });
    var avisos = Res.coletarAvisos(st, ctx, res);
    if (avisos.length) {
      out.push(h('div', { class: 'aviso' },
        h('b', {}, 'Pontos a verificar (' + avisos.length + ')'),
        h('ul', {}, avisos.map(function (a) { return h('li', {}, a); }))));
    }

    out.push(Res.cartaoTrechos(st, ctx, res));
    out.push(Res.cartaoCenarios(st, ctx, res));
    out.push(Res.cartaoPerfil(st, ctx, res));
    if (res.golpe && res.golpe.length) out.push(Res.cartaoGolpe(st, ctx, res));
    if (st.calculo.comparar) out.push(Res.cartaoComparacao(st, ctx, res));
    out.push(Res.cartaoMemorial(st, ctx, res));
    return out;
  };

  /* Um projeto recém-aberto ainda não tem o que verificar: cobrar altura
     manométrica e diâmetro nesse momento é ruído, não ajuda. */
  Res.naoIniciado = function (st, ctx, res) {
    if (!(ctx.qTotal > 0)) return true;
    var temDiametro = res.projeto.adutoras.some(function (r) { return r.tubo && r.tubo.item; });
    return !temDiametro && Math.abs(res.projeto.Hg) < 1e-9;
  };

  Res.coletarAvisos = function (st, ctx, res) {
    var av = [], c = res.projeto, vistos = {};
    function push(t) { if (!vistos[t]) { vistos[t] = 1; av.push(t); } }

    if (Res.naoIniciado(st, ctx, res)) return av;

    c.avisos.forEach(push);

    /* velocidades e perdas fora de faixa em cada trecho */
    var todos = c.succao.map(function (r) { return { r: r, tipo: 'succao' }; })
      .concat(c.recalque.map(function (r) { return { r: r, tipo: 'barrilete' }; }))
      .concat(c.adutoras.map(function (r) { return { r: r, tipo: 'adutora' }; }));

    todos.forEach(function (x) {
      if (!x.r.tubo || !(x.r.v > 0)) {
        if (!x.r.tubo || !x.r.tubo.item || !x.r.conj.itemRot) push(x.r.rot + ': diâmetro ainda não escolhido.');
        return;
      }
      var crit = PDA.C.criterioDe(st, ctx, x.tipo);
      var cl = PDA.C.classificar(x.r.v, x.r.J, crit);
      if (cl.classe === 'ruim') push(x.r.rot + ': ' + cl.motivos.join('; ') + '.');
    });

    /* autolimpeza com uma bomba */
    if (ctx.familiaCriterio === 'esgoto' && res.cenarios.length) {
      var c1 = res.cenarios[0];
      c1.adutoras.concat(c1.recalque).forEach(function (r) {
        if (!r.tubo || !(r.v > 0)) return;
        var crit = PDA.C.criterioDe(st, ctx, r.conj.tipo || 'adutora');
        if (r.v < crit.vMin) {
          push(r.rot + ': com apenas 1 bomba em operação a velocidade cai a ' + UI.num(r.v, 2) +
               ' m/s, abaixo da mínima de autolimpeza de ' + UI.numEdit(crit.vMin) + ' m/s.');
        }
      });
    }

    /* NPSH */
    if (c.npshd !== null && c.npshd < 3) {
      push('NPSH disponível de apenas ' + UI.num(c.npshd, 2) + ' mca. Verifique o NPSH requerido pela bomba ' +
           'na curva do fabricante — a margem usual mínima é de 0,5 a 1,0 mca acima do requerido.');
    }

    /* pressão x PN */
    (res.piezometrica || []).forEach(function (p) {
      if (p.pnMca && p.pressao > p.pnMca) {
        push(p.rot + ': pressão de ' + UI.num(p.pressao, 1) + ' mca em regime permanente acima do PN do tubo (' +
             UI.num(p.pnMca, 0) + ' mca).');
      }
    });
    (res.golpe || []).forEach(function (g) {
      if (g.atende === false) {
        push(g.rot + ': com a sobrepressão do transitório a pressão máxima chega a ' + UI.num(g.pressaoMaxMca, 1) +
             ' mca, acima do PN do tubo (' + UI.num(g.pnMca, 0) + ' mca). Reveja a classe de pressão ou preveja proteção contra o golpe.');
      }
    });

    /* itens de catálogo a conferir */
    var conf = {};
    todos.forEach(function (x) {
      if (x.r.tubo && x.r.tubo.item && x.r.tubo.item.verificar) conf[x.r.tubo.cat.nome] = 1;
    });
    Object.keys(conf).forEach(function (k) {
      push('Catálogo "' + k + '": as dimensões deste catálogo foram estimadas por fórmula normativa. Confirme no catálogo do fabricante antes de fechar o projeto.');
    });

    return av;
  };

  /* ---------------- composição de perdas por trecho ---------------- */

  Res.cartaoTrechos = function (st, ctx, res) {
    var c = res.projeto;
    var usaHW = st.calculo.metodo === 'hw';

    function grupo(rot, arr) {
      if (!arr.length) return [];
      return [h('tr', { style: 'background:var(--surface-2)' },
        h('td', { class: 'esq', colspan: usaHW ? 11 : 12 }, h('b', {}, rot)))]
        .concat(arr.map(function (r) {
          return h('tr', {},
            h('td', { class: 'esq' }, r.rot),
            h('td', { class: 'esq' }, r.tubo && r.tubo.item
              ? r.tubo.cat.nome.split('—')[0].trim() + ' ' + r.tubo.item.rot
              : h('span', { class: 'sinal', title: 'Trecho ativo sem diâmetro escolhido: está fora do cálculo.' }, 'sem diâmetro !')),
            h('td', {}, r.tubo ? UI.num(r.tubo.diMm, 1) : '—'),
            h('td', {}, UI.num(r.Q * 1000, 1)),
            h('td', {}, UI.num(r.L, 1)),
            h('td', {}, UI.num(r.v, 2)),
            usaHW ? h('td', {}, r.tubo ? UI.num(r.tubo.C, 0) : '—')
                  : h('td', {}, r.f ? UI.num(r.f, 4) : '—'),
            usaHW ? null : h('td', {}, r.Re ? UI.num(r.Re / 1000, 0) + 'k' : '—'),
            h('td', {}, UI.tab(r.J * 1000)),
            h('td', {}, UI.tab(r.hf)),
            h('td', {}, UI.tab(r.hl)),
            h('td', {}, h('b', {}, UI.tab(r.htotal))));
        }));
    }

    var cabs = [{ rot: 'Trecho', esq: true }, { rot: 'Tubo', esq: true }, 'DI (mm)', 'Q (L/s)', 'L (m)', 'v (m/s)']
      .concat(usaHW ? ['C'] : ['f', 'Re'])
      .concat(['J (m/km)', 'hf (m)', 'Σhₗ (m)', 'Total (m)']);

    var linhas = grupo('Sucção', c.succao)
      .concat(grupo('Barriletes de recalque', c.recalque))
      .concat(grupo('Adutora / linha de recalque', c.adutoras));

    var rodape = h('tr', {},
      h('td', { class: 'esq', colspan: usaHW ? 9 : 10 }, 'Perda de carga total do sistema'),
      h('td', {}, UI.tab(c.hfSuccao + c.hfRecalque)),
      h('td', {}, UI.tab(c.hlSuccao + c.hlRecalque)),
      h('td', {}, UI.tab(c.hSuccao + c.hRecalque)));

    var hTot = c.hSuccao + c.hRecalque;
    var comp = h('div', { class: 'faixa-resumo', style: 'margin:11px 0 0' },
      PDA.F.chip('Altura geométrica', UI.num(c.Hg, 2), 'm  (' + UI.num(c.Hm > 0 ? c.Hg / c.Hm * 100 : 0, 0) + ' % da Hm)'),
      PDA.F.chip('Perda distribuída', UI.num(c.hfSuccao + c.hfRecalque, 2), 'm  (' + UI.num(hTot > 0 ? (c.hfSuccao + c.hfRecalque) / hTot * 100 : 0, 0) + ' % das perdas)'),
      PDA.F.chip('Perda localizada', UI.num(c.hlSuccao + c.hlRecalque, 2), 'm  (' + UI.num(hTot > 0 ? (c.hlSuccao + c.hlRecalque) / hTot * 100 : 0, 0) + ' % das perdas)'),
      PDA.F.chip('Altura manométrica', UI.num(c.Hm, 2), 'mca'),
      PDA.F.chip('Hm com nível máximo', UI.num(c.HmMin, 2), 'mca'));

    return UI.cartao('Composição das perdas — cenário de projeto (' + ctx.nOp + ' bomba' + (ctx.nOp > 1 ? 's' : '') + ')',
      PDA.C.rotMetodo[st.calculo.metodo],
      [UI.tabela(cabs, linhas, rodape), comp]);
  };

  /* ---------------- cenários de operação ---------------- */

  Res.cartaoCenarios = function (st, ctx, res) {
    var linhas = res.cenarios.map(function (c) {
      var proj = c.n === ctx.nOp;
      return h('tr', { class: proj ? 'selecionada' : null },
        h('td', { class: 'esq' }, c.n + (proj ? ' (projeto)' : '')),
        h('td', {}, UI.num(c.qTotal * 1000, 1)),
        h('td', {}, UI.num(c.qTotal * 3600, 1)),
        h('td', {}, UI.num(c.qBomba * 1000, 1)),
        h('td', {}, UI.tab(c.Hg)),
        h('td', {}, UI.tab(c.hSuccao + c.hRecalque)),
        h('td', {}, h('b', {}, UI.tab(c.Hm))),
        h('td', {}, UI.num(c.potUtilCv, 1)),
        h('td', {}, h('b', {}, UI.num(c.bhpCv, 1))),
        h('td', {}, UI.num(c.bhpKw, 1)),
        h('td', {}, UI.numEdit(c.motorCv)),
        h('td', {}, UI.num(c.motorKw, 1)),
        h('td', {}, UI.num(c.potTotalKw, 1)),
        h('td', {}, c.npshd === null ? '—' : UI.num(c.npshd, 2)));
    });

    return UI.cartao('Cenários de operação',
      'Uma linha para cada quantidade de bombas em operação simultânea', [
      UI.tabela([
        { rot: 'Bombas', esq: true }, 'Q total (L/s)', 'Q total (m³/h)', 'Q/bomba (L/s)',
        'Hg (m)', 'Perdas (m)', 'Hm (mca)', 'Pot. útil (cv)',
        { rot: 'BHP/bomba (cv)', title: 'Potência no eixo de cada bomba' }, 'BHP (kW)',
        { rot: 'Motor (cv)', title: 'Motor comercial com a folga aplicada' }, 'Motor (kW)',
        { rot: 'Total (kW)', title: 'Potência de todos os conjuntos em operação' },
        'NPSHd (mca)'
      ], linhas),
      h('p', { class: 'nota', style: 'margin-top:8px' },
        'A altura manométrica cresce com a vazão porque as perdas crescem com o quadrado dela — ' +
        'por isso o motor precisa ser verificado no cenário de maior vazão, e a velocidade mínima ' +
        'no cenário de menor vazão. O motor indicado é o menor da linha comercial que atende à ' +
        'potência de eixo com a folga adotada.')
    ]);
  };

  /* ---------------- perfil piezométrico ---------------- */

  Res.cartaoPerfil = function (st, ctx, res) {
    var pts = res.piezometrica;
    var temCotas = st.adutoras.some(function (a) { return a.usarCotas; });

    var linhas = pts.map(function (p) {
      return h('tr', { class: p.classe === 'na' ? null : p.classe, title: p.motivos.join(' · ') },
        h('td', { class: 'esq' }, p.rot),
        h('td', {}, UI.num(p.cota, 2)),
        h('td', {}, UI.num(p.hgl, 2)),
        h('td', {}, h('b', {}, UI.num(p.pressao, 2)),
          p.pressao < 0 ? h('span', { class: 'sinal', title: p.motivos.join('; ') }, ' !') : null),
        h('td', {}, p.pnMca ? UI.num(p.pnMca, 0) : '—'),
        h('td', {}, p.classe === 'na'
          ? h('span', { class: 'nota', title: p.motivos.join('; ') }, 'PN não informado')
          : UI.tagClasse(p.classe)));
    });

    var corpo = [
      temCotas ? Res.svgPerfil(st, ctx, res) : h('div', { class: 'aviso info' },
        'Marque "Informar cotas deste trecho" nos trechos da adutora para que o programa desenhe o perfil ' +
        'do terreno e a linha piezométrica. Sem as cotas, a tabela abaixo usa apenas o nível de sucção e a cota de chegada.'),
      UI.tabela([{ rot: 'Ponto', esq: true }, 'Cota (m)', 'Linha piezométrica (m)',
                 { rot: 'Pressão (mca)', title: 'Carga de pressão disponível no ponto, em regime permanente' },
                 { rot: 'PN do tubo (mca)', title: 'Pressão nominal do tubo escolhido, quando cadastrada no catálogo' },
                 'Situação'], linhas),
      h('p', { class: 'nota', style: 'margin-top:8px' },
        'A verificação acima é de regime permanente. A pressão máxima de projeto tem de considerar ainda a ' +
        'sobrepressão do transitório e a pressão estática com a linha cheia e a bomba parada.')
    ];

    return UI.cartao('Linha piezométrica e verificação de pressão', null, corpo,
      UI.botaoFonte(['nbr12215']));
  };

  Res.svgPerfil = function (st, ctx, res) {
    var L = 0, pontos = [], cotaMin = Infinity, cotaMax = -Infinity;
    var nsMin = Number(st.cotas.nivelSuccaoMin) || 0;
    var hglAtual = nsMin + res.projeto.Hm;
    var hInterno = 0;
    res.projeto.recalque.forEach(function (r) { hInterno += r.htotal; });
    hglAtual -= hInterno;

    pontos.push({ x: 0, cota: nsMin, hgl: hglAtual });
    cotaMin = Math.min(cotaMin, nsMin); cotaMax = Math.max(cotaMax, hglAtual);

    res.projeto.adutoras.forEach(function (r, i) {
      var a = st.adutoras[i] || {};
      L += r.L;
      hglAtual -= r.htotal;
      var cota = a.usarCotas ? (Number(a.cotaFim) || 0) : nsMin;
      pontos.push({ x: L, cota: cota, hgl: hglAtual });
      cotaMin = Math.min(cotaMin, cota); cotaMax = Math.max(cotaMax, hglAtual, cota);
    });

    if (!(L > 0)) return h('p', { class: 'vazio' }, 'Informe a extensão dos trechos para desenhar o perfil.');

    var W = 900, Hh = 300, mE = 54, mD = 16, mT = 14, mB = 34;
    var faixa = Math.max(1, cotaMax - cotaMin);
    var pad = faixa * 0.1;
    var yMin = cotaMin - pad, yMax = cotaMax + pad;
    function px(x) { return mE + x / L * (W - mE - mD); }
    function py(c) { return mT + (yMax - c) / (yMax - yMin) * (Hh - mT - mB); }

    var terreno = pontos.map(function (p) { return px(p.x) + ',' + py(p.cota); }).join(' ');
    var lp = pontos.map(function (p) { return px(p.x) + ',' + py(p.hgl); }).join(' ');

    var i, nDiv = 5;

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    svg.setAttribute('class', 'perfil');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    function sv(tag, attrs, txt) {
      var e = document.createElementNS('http://www.w3.org/2000/svg', tag), k;
      for (k in attrs) if (attrs[k] !== null) e.setAttribute(k, attrs[k]);
      if (txt !== undefined) e.textContent = txt;
      return e;
    }
    for (i = 0; i <= nDiv; i++) {
      var cc = yMin + (yMax - yMin) * i / nDiv;
      svg.appendChild(sv('line', { class: 'grade-l', x1: mE, x2: W - mD, y1: py(cc), y2: py(cc) }));
      svg.appendChild(sv('text', { x: mE - 5, y: py(cc) + 3, 'text-anchor': 'end' }, UI.num(cc, 1)));
    }
    pontos.forEach(function (p, k) {
      svg.appendChild(sv('line', { class: 'grade-l', x1: px(p.x), x2: px(p.x), y1: mT, y2: Hh - mB }));
      svg.appendChild(sv('text', {
        x: px(p.x), y: Hh - mB + 14,
        'text-anchor': k === 0 ? 'start' : (k === pontos.length - 1 ? 'end' : 'middle')
      }, UI.num(p.x, 0)));
    });
    svg.appendChild(sv('polyline', { class: 'terreno', points: terreno }));
    svg.appendChild(sv('polyline', { class: 'lp', points: lp }));
    svg.appendChild(sv('text', { x: mE + 4, y: mT + 11 }, 'Linha piezométrica'));
    svg.appendChild(sv('text', { x: W - mD, y: Hh - 4, 'text-anchor': 'end' }, 'distância (m)'));
    svg.appendChild(sv('text', { x: 4, y: mT + 9 }, 'cota (m)'));

    return h('div', {},
      svg,
      h('p', { class: 'nota', style: 'margin-top:5px' },
        'Linha cheia fina: perfil do terreno pelas cotas informadas. Linha azul: linha piezométrica ' +
        'a partir da saída da elevatória, descontando as perdas de cada trecho. ' +
        'A distância vertical entre as duas é a pressão disponível.'));
  };

  /* ---------------- transitório ---------------- */

  Res.cartaoGolpe = function (st, ctx, res) {
    var linhas = res.golpe.map(function (g) {
      var cl = g.atende === null ? null : (g.atende ? 'bom' : 'ruim');
      return h('tr', { class: cl },
        h('td', { class: 'esq' }, g.rot),
        h('td', { class: 'esq' }, g.materialRot || '—'),
        h('td', {}, UI.num(g.E_GPa, 0)),
        h('td', {}, UI.num(g.psi, 3)),
        h('td', {}, g.eMm ? UI.num(g.eMm, 1) : '—'),
        h('td', {}, UI.num(g.v, 2)),
        h('td', {}, g.celeridade ? UI.num(g.celeridade, 0) : '—'),
        h('td', {}, g.tempoCritico ? UI.num(g.tempoCritico, 2) : '—'),
        h('td', {}, g.manobraRapida ? 'rápida' : 'lenta'),
        h('td', {}, g.dhJoukowsky ? UI.num(g.dhJoukowsky, 1) : '—'),
        h('td', {}, isFinite(g.dhMichaud) ? UI.num(g.dhMichaud, 1) : '—'),
        h('td', {}, h('b', {}, isFinite(g.dh) ? UI.num(g.dh, 1) : '—')),
        h('td', {}, UI.num(g.pressaoMaxMca, 1)),
        h('td', {}, UI.num(g.pressaoMinMca, 1),
          g.subpressao ? h('span', { class: 'sinal', title: 'A pressão mínima fica negativa: subpressão. Avalie ventosas de duplo efeito e proteção contra o golpe.' }, ' !') : null),
        h('td', {}, g.pnMca ? UI.num(g.pnMca, 0) : '—'),
        h('td', {}, g.atende === null ? h('span', { class: 'nota' }, 'PN não informado') : UI.tagClasse(cl)));
    });

    return UI.cartao('Transitório hidráulico — pré-avaliação',
      'Sobrepressão estimada e conferência da classe de pressão', [
      UI.tabela([{ rot: 'Trecho', esq: true }, { rot: 'Material', esq: true }, 'E (GPa)',
                 { rot: 'ψ', dica: 'Coeficiente de ancoragem longitudinal, do caso escolhido na aba Adutora. ψ = 1 para tubo com juntas de dilatação; 1 − ν/2 ancorado só a montante; 1 − ν² ancorado em todo o comprimento (o caso mais desfavorável).' },
                 'e (mm)', 'v (m/s)',
                 { rot: 'Celeridade (m/s)', dica: 'a = 1/√[ρ(1/K + ψD/(eE))], com K = 2,19 GPa para a água. Quanto mais rígido o tubo, maior a celeridade e maior a sobrepressão.' },
                 { rot: 'tc = 2L/a (s)', dica: 'Tempo crítico: o tempo que a onda leva para ir até a extremidade e voltar. Se a manobra for mais rápida que isso, vale a sobrepressão integral de Joukowsky.' },
                 'Manobra', 'Δh Joukowsky', 'Δh Michaud', 'Δh adotado (mca)',
                 { rot: 'p máx. (mca)', dica: 'Hm + Δh — o que a classe de pressão do tubo tem de suportar.' },
                 { rot: 'p mín. (mca)', dica: 'Hm − Δh. Valor negativo indica subpressão na elevatória, com risco de cavitação e de entrada de ar.' },
                 'PN (mca)', 'Situação'], linhas),
      h('div', { class: 'aviso' },
        h('b', {}, 'Como este resultado é obtido, e até onde ele vale'),
        h('p', { style: 'margin:0 0 5px' },
          'Passo 1 — celeridade da onda no tubo escolhido: a = 1/√[ρ(1/K + ψ·D/(e·E))], com K = 2,19 GPa da água, ' +
          'E e ν do material, e ψ do caso de ancoragem selecionado. Passo 2 — tempo crítico tc = 2L/a. ' +
          'Passo 3 — se o tempo de manobra informado é menor que tc, a manobra é rápida e a sobrepressão é a de ' +
          'Joukowsky, Δh = a·Δv/g, com Δv igual à velocidade de regime (parada total do escoamento). ' +
          'Se é maior, aplica-se a fórmula de manobra lenta de Michaud/Allievi, Δh = 2·L·v/(g·t), e o programa ' +
          'adota o menor dos dois. Passo 4 — a pressão de conferência é Hm ± Δh.'),
        h('p', { style: 'margin:0' },
          'É a tubulação NUA: não há tanque de alívio, chaminé de equilíbrio, válvula antecipadora de onda, ' +
          'ventosa de duplo efeito nem volante de inércia. Também não há integração das equações do transitório ' +
          'pelo método das características, nem reflexão de ondas nas mudanças de diâmetro e material, nem ' +
          'modelagem da separação e do retorno da coluna líquida. Serve para saber se a classe de pressão tem ' +
          'folga e se o transitório é crítico o suficiente para exigir estudo específico — e, se estourar, o ' +
          'caminho usual não é engrossar a parede do tubo, é dimensionar a proteção. ' +
          'Com o perfil lançado na aba Perfil, o programa traça as envoltórias ponto a ponto.')),
      res.envoltoria ? h('div', { class: 'aviso info' },
        h('b', {}, 'Envoltórias ao longo da linha'),
        'O perfil está lançado: a pressão máxima é ' + UI.num(res.envoltoria.criticoMax.pMax, 1) + ' mca em ' +
        UI.num(res.envoltoria.criticoMax.x, 0) + ' m, e a mínima é ' + UI.num(res.envoltoria.criticoMin.pMin, 1) +
        ' mca em ' + UI.num(res.envoltoria.criticoMin.x, 0) + ' m. ',
        h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'irAba', 'data-aba': 'perfil',
                      style: 'margin-left:6px' }, 'Ver o perfil')) : null
    ]);
  };

  /* ---------------- comparação de métodos ---------------- */

  Res.cartaoComparacao = function (st, ctx, res) {
    var cmp = PDA.C.compararMetodos(st, ctx.cats);
    var base = cmp.filter(function (c) { return c.metodo === 'colebrook'; })[0];
    var linhas = cmp.map(function (c) {
      var dif = base && base.Hm ? (c.Hm - base.Hm) / base.Hm * 100 : 0;
      return h('tr', { class: c.metodo === st.calculo.metodo ? 'selecionada' : null },
        h('td', { class: 'esq' }, PDA.C.rotMetodo[c.metodo] + (c.metodo === st.calculo.metodo ? ' (em uso)' : '')),
        h('td', {}, UI.num(c.hf, 3)),
        h('td', {}, UI.num(c.hl, 3)),
        h('td', {}, h('b', {}, UI.num(c.Hm, 2))),
        h('td', {}, UI.num(dif, 1) + ' %'),
        h('td', {}, UI.num(c.bhp, 1)),
        h('td', {}, UI.numEdit(c.motor)));
    });

    return UI.cartao('Comparação entre as fórmulas de perda de carga',
      'Mesmos dados, mesmas peças, mesmos diâmetros', [
      UI.tabela([{ rot: 'Fórmula', esq: true }, 'Perda distribuída (m)', 'Perda localizada (m)',
                 'Hm (mca)', { rot: 'Δ vs Colebrook', title: 'Diferença percentual na altura manométrica' },
                 'BHP (cv)', 'Motor (cv)'], linhas),
      h('p', { class: 'nota', style: 'margin-top:8px' },
        'A diferença entre Hazen-Williams e Colebrook-White vem das premissas de cada uma: ' +
        'o C empírico embute a rugosidade e a viscosidade num único número calibrado para água em ' +
        'regime turbulento, enquanto a fórmula universal separa a rugosidade absoluta do número de ' +
        'Reynolds. Divergências de 10 a 20 % na perda distribuída são normais e refletem, sobretudo, ' +
        'a escolha dos coeficientes. Para esgoto, temperatura fora do usual ou fluido viscoso, ' +
        'a fórmula universal é a indicada.')
    ]);
  };

  /* ---------------- memorial ---------------- */

  Res.cartaoMemorial = function (st, ctx, res) {
    return UI.cartao('Memorial de cálculo', 'Texto pronto para conferência e para anexar ao projeto',
      Res.memorial(st, ctx, res),
      h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'imprimir' }, 'Imprimir / salvar em PDF'));
  };

  Res.memorial = function (st, ctx, res) {
    var c = res.projeto;
    var usaHW = st.calculo.metodo === 'hw';
    var fl = PDA.R.fluidos.filter(function (f) { return f.id === st.fluido.tipo; })[0];

    function it(rot, val) {
      return h('tr', {}, h('td', { class: 'esq', style: 'width:45%' }, rot), h('td', { class: 'esq' }, val));
    }

    var dados = [
      it('Projeto', st.projeto.nome || '—'),
      it('Local', st.projeto.local || '—'),
      it('Responsável técnico', st.projeto.responsavel || '—'),
      it('Data', st.projeto.data || '—'),
      it('Fluido', (fl ? fl.rot : '—') + ' a ' + UI.numEdit(st.fluido.temperatura) + ' °C, altitude ' + UI.numEdit(st.fluido.altitude) + ' m'),
      it('Fórmula de perda de carga distribuída', PDA.C.rotMetodo[st.calculo.metodo]),
      it('Perda de carga localizada', 'Método dos coeficientes: hₗ = K · v²/2g'),
      it('Vazão de projeto', UI.num(ctx.qTotal * 1000, 2) + ' L/s (' + UI.num(ctx.qTotal * 3600, 2) + ' m³/h) — ' +
                             UI.num(ctx.qBomba * 1000, 2) + ' L/s por bomba'),
      it('Conjuntos elevatórios', ctx.nInst + ' instalado(s), ' + ctx.nOp + ' em operação simultânea, arranjo ' +
         ({ afogada: 'afogado', succao: 'com sucção negativa', submersivel: 'submersível' })[st.bombas.tipo]),
      it('Rendimento adotado', 'bomba ' + UI.numEdit(st.bombas.rendBomba) + ' %' +
         (st.bombas.usarRendMotor ? ', motor ' + UI.numEdit(st.bombas.rendMotor) + ' %' : '')),
      it('Nível de sucção', UI.num(st.cotas.nivelSuccaoMin, 2) + ' m (mínimo) a ' + UI.num(st.cotas.nivelSuccaoMax, 2) + ' m (máximo)'),
      it('Cota de chegada', UI.num(st.cotas.nivelChegada, 2) + ' m'),
      it('Altura geométrica', UI.num(c.Hg, 2) + ' m (crítica, com nível de sucção mínimo)')
    ];

    var trechos = c.succao.concat(c.recalque, c.adutoras).map(function (r) {
      if (!r.tubo || !r.tubo.item) return null;
      return h('tr', {},
        h('td', { class: 'esq' }, r.rot),
        h('td', { class: 'esq' }, r.tubo.cat.nome + ' · ' + r.tubo.item.rot),
        h('td', {}, UI.num(r.tubo.diMm, 1)),
        h('td', {}, UI.num(r.L, 1)),
        h('td', {}, UI.num(r.Q * 1000, 1)),
        h('td', {}, UI.num(r.v, 2)),
        h('td', { class: 'esq' }, usaHW ? ('C = ' + UI.num(r.tubo.C, 0)) : ('ε = ' + UI.num(r.tubo.epsMm, 4) + ' mm')),
        h('td', {}, UI.num(r.J * 1000, 2)),
        h('td', {}, UI.num(r.somaK, 2)),
        h('td', {}, UI.num(r.htotal, 3)));
    }).filter(Boolean);

    var eq = usaHW
      ? 'J = ' + UI.numEdit(st.calculo.hwK) + ' · Q^' + UI.numEdit(st.calculo.hwExpQ) +
        ' · C^−' + UI.numEdit(st.calculo.hwExpQ) + ' · D^−' + UI.numEdit(st.calculo.hwExpD) + '   [J em m/m, Q em m³/s, D em m]'
      : '1/√f = −2 · log₁₀( ε/(3,7·D) + 2,51/(Re·√f) )   e   J = f · v²/(2·g·D)';

    return h('div', { class: 'memorial' },
      h('div', { class: 'cab-doc' },
        h('h3', {}, 'Memorial de pré-dimensionamento hidráulico'),
        h('p', { class: 'nota' }, st.projeto.nome || 'Adutora / linha de recalque')),

      h('h2', {}, '1. Dados de entrada e premissas'),
      h('div', { class: 'rolagem' }, h('table', {}, h('tbody', {}, dados))),

      h('h2', {}, '2. Formulação adotada'),
      h('p', {}, 'Perda de carga distribuída:'),
      h('p', { class: 'mono' }, eq),
      h('p', {}, 'Perda de carga localizada: hₗ = K · v²/(2·g), somada peça a peça com a velocidade do próprio trecho ' +
                 '(ou o diâmetro da peça, quando informado).'),
      h('p', {}, 'Altura manométrica: Hm = Hg + Σhf + Σhₗ, considerando o nível de sucção mínimo.'),
      h('p', {}, 'Potência no eixo: P = γ·Q·Hm/(75·η), com Q em L/s e P em cv.'),
      h('p', { class: 'nota-fonte' }, PDA.H.fontes.map(function (f) { return f.txt; }).join('  '),
        '  Coeficientes K: ' + PDA.P.fontePecas.az),

      h('h2', {}, '3. Trechos e perdas de carga'),
      h('div', { class: 'rolagem' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', { class: 'esq' }, 'Trecho'), h('th', { class: 'esq' }, 'Tubo'), h('th', {}, 'DI (mm)'),
          h('th', {}, 'L (m)'), h('th', {}, 'Q (L/s)'), h('th', {}, 'v (m/s)'),
          h('th', { class: 'esq' }, 'Rugosidade'), h('th', {}, 'J (m/km)'), h('th', {}, 'ΣK'), h('th', {}, 'Perda total (m)'))),
        h('tbody', {}, trechos),
        h('tfoot', {}, h('tr', {},
          h('td', { class: 'esq', colspan: 9 }, 'Perda de carga total'),
          h('td', {}, UI.num(c.hSuccao + c.hRecalque, 3)))))),

      h('h2', {}, '4. Resultado do dimensionamento'),
      h('div', { class: 'rolagem' }, h('table', {}, h('tbody', {},
        it('Altura geométrica (Hg)', UI.num(c.Hg, 2) + ' m'),
        it('Perda de carga distribuída', UI.num(c.hfSuccao + c.hfRecalque, 2) + ' m'),
        it('Perda de carga localizada', UI.num(c.hlSuccao + c.hlRecalque, 2) + ' m'),
        it('Altura manométrica total (Hm)', UI.num(c.Hm, 2) + ' mca'),
        it('Potência útil por bomba', UI.num(c.potUtilCv, 2) + ' cv'),
        it('Potência no eixo por bomba (BHP)', UI.num(c.bhpCv, 2) + ' cv (' + UI.num(c.bhpKw, 2) + ' kW)'),
        it('Folga aplicada', UI.num(c.folgaPct, 0) + ' %'),
        it('Motor comercial adotado por bomba', UI.numEdit(c.motorCv) + ' cv (' + UI.num(c.motorKw, 1) + ' kW)'),
        it('Potência instalada em operação', UI.num(c.potTotalKw, 1) + ' kW com ' + ctx.nOp + ' conjunto(s)'),
        c.npshd !== null ? it('NPSH disponível', UI.num(c.npshd, 2) + ' mca') : null,
        st.bombas.usarRendMotor ? it('Potência elétrica por bomba', UI.num(c.eletricaKw, 2) + ' kW') : null))),

      st.projeto.obs ? h('div', {}, h('h2', {}, '5. Observações do projeto'),
        h('p', { style: 'white-space:pre-wrap' }, st.projeto.obs)) : null,

      res.operacao && !res.operacao.erro ? h('div', {},
        h('h2', {}, (st.projeto.obs ? '6' : '5') + '. Ponto de operação com a curva da bomba'),
        h('div', { class: 'rolagem' }, h('table', {}, h('tbody', {},
          it('Curva ajustada', 'H = ' + UI.num(res.curvaBomba.a0, 3) + ' + (' + UI.num(res.curvaBomba.a1, 3) +
             ')·Q + (' + UI.num(res.curvaBomba.a2, 3) + ')·Q²  [H em mca, Q em m³/s]'),
          it('Pontos informados', res.curvaBomba.pontos.map(function (p) {
            return UI.num(p.q * 1000, 1) + ' L/s / ' + UI.num(p.H, 1) + ' mca';
          }).join('   ·   ')),
          it('Vazão de operação', UI.num(res.operacao.qTotal * 1000, 2) + ' L/s total, ' +
             UI.num(res.operacao.qBomba * 1000, 2) + ' L/s por bomba, com ' + res.operacao.n + ' bomba(s)'),
          it('Altura de operação', UI.num(res.operacao.H, 2) + ' mca'),
          it('Potência de eixo no ponto de operação', UI.num(res.operacao.bhpCv, 2) + ' cv'),
          it('Desvio da vazão de projeto', UI.num(res.operacao.desvioQ, 1) + ' %')))),
        h('p', { class: 'nota' },
          'A curva da bomba foi ajustada por mínimos quadrados na forma H = a₀ + a₁Q + a₂Q² e cruzada com a ' +
          'curva do sistema. Com mais de uma bomba em paralelo, a vazão de cada uma é a vazão total dividida ' +
          'pelo número de conjuntos, na mesma altura.')) : null,

      res.envoltoria ? h('div', {},
        h('h2', {}, (st.projeto.obs ? '7' : '6') + '. Envoltórias de pressão do transitório'),
        h('div', { class: 'rolagem' }, h('table', {}, h('tbody', {},
          it('Pontos de perfil lançados', String(res.envoltoria.pontos.length)),
          it('Sobrepressão adotada na elevatória', UI.num(res.envoltoria.dh, 2) + ' mca'),
          it('Maior pressão', UI.num(res.envoltoria.criticoMax.pMax, 2) + ' mca em ' +
             UI.num(res.envoltoria.criticoMax.x, 0) + ' m' +
             (res.envoltoria.criticoMax.pn ? '  (admissível do tubo: ' + UI.num(res.envoltoria.criticoMax.pn, 0) + ' mca)' : '')),
          it('Menor pressão', UI.num(res.envoltoria.criticoMin.pMin, 2) + ' mca em ' +
             UI.num(res.envoltoria.criticoMin.x, 0) + ' m'),
          it('Pontos reprovados', String(res.envoltoria.pontos.filter(function (p) { return p.classe === 'ruim'; }).length) +
             ' de ' + res.envoltoria.pontos.length)))),
        h('p', { class: 'nota' },
          'Traçado de anteprojeto: a sobrepressão vale integralmente na elevatória e decai linearmente até zero ' +
          'no ponto de chegada. Sem dispositivos de proteção e sem integração das equações do transitório.')) : null,

      h('h2', {}, 'Ressalvas'),
      h('ul', { class: 'nota', style: 'font-size:12.5px' },
        h('li', {}, 'Trata-se de PRÉ-dimensionamento: define ordem de grandeza de diâmetro, altura manométrica e potência. ' +
          'O projeto executivo exige a curva da bomba, o ponto de operação real, a verificação do NPSH requerido e a análise do transitório.'),
        h('li', {}, 'A operação em paralelo foi tratada mantendo a vazão por bomba constante. Em paralelo real, cada bomba entrega ' +
          'menos vazão do que operando isolada, e o ponto de operação sai da interseção da curva conjunta com a curva do sistema.'),
        h('li', {}, 'Os coeficientes de rugosidade são faixas de literatura para a idade/condição escolhida. Onde houver medição de campo, ' +
          'o coeficiente medido prevalece.'),
        h('li', {}, 'Dimensões de tubo marcadas como "conferir catálogo" foram estimadas por fórmula normativa e devem ser confirmadas ' +
          'com o fornecedor antes do detalhamento.'),
        st.golpe.avaliar ? h('li', {}, 'A avaliação do transitório é preliminar e considera a tubulação sem dispositivos de proteção. ' +
          'Não integra as equações do transitório pelo método das características, não representa reflexões em mudanças de ' +
          'diâmetro e de material e não modela separação de coluna. Se a sobrepressão exceder a classe do tubo, o passo ' +
          'seguinte é dimensionar a proteção com estudo específico.') : null,
        st.economia.ativo ? h('li', {}, 'A comparação de custo usa uma lei de potência para o preço do tubo e a parcela de energia ' +
          'associada à perda de carga de cada trecho. Serve para localizar o diâmetro econômico, não para orçar.') : null));
  };

  PDA.Res = Res;
})(window.PDA = window.PDA || {});
