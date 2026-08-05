/* ------------------------------------------------------------------
 * Painéis de entrada de dados
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var F = {};
  var UI = PDA.UI, h = null, R = PDA.R, U = PDA.U;

  function init() { h = UI.h; }

  /* ================================================================
     Seletores de catálogo / diâmetro
     ================================================================ */

  F.selectCatalogo = function (st, cats, caminho) {
    var atual = UI.get(st, caminho);
    var grupos = PDA.CAT.porFamilia(cats.todos);
    return h('select', { 'data-bind': caminho, 'data-tipo': 'texto', 'data-estrutural': '1' },
      Object.keys(grupos).map(function (fam) {
        return h('optgroup', { label: fam }, grupos[fam].map(function (c) {
          return h('option', { value: c.id, selected: c.id === atual }, c.nome);
        }));
      }));
  };

  F.selectDiametro = function (st, cats, conj, caminho) {
    var cat = PDA.CAT.buscar(cats.todos, conj.catalogoId);
    if (!cat) return h('select', { disabled: true }, h('option', {}, '—'));
    var atual = conj.itemRot;
    return h('select', { 'data-bind': caminho, 'data-tipo': 'texto', 'data-estrutural': '1' },
      [h('option', { value: '', selected: !atual }, '— escolher —')].concat(
        cat.itens.map(function (it) {
          var di = PDA.CAT.diInterno(cat, it);
          return h('option', { value: it.rot, selected: it.rot === atual },
            it.rot + '   (DI ' + UI.num(di, 1) + ' mm' + (it.pn ? ', PN ' + UI.numEdit(it.pn) : '') + ')');
        })));
  };

  /* ================================================================
     Bloco de rugosidade (idade + material + override + fonte)
     ================================================================ */

  F.blocoRugosidade = function (st, ctx, conj, base) {
    var cat = PDA.CAT.buscar(ctx.cats.todos, conj.catalogoId);
    var matId = conj.materialOverride || (cat ? cat.material : 'pead');
    var cons = R.consultar(matId, conj.idade, st.fluido.tipo);
    var usaHW = st.calculo.metodo === 'hw';

    var campos = [
      UI.select(st, 'Idade / condição do tubo', base + '.idade',
        R.faixasIdade.map(function (f) { return { v: f.id, rot: f.rot }; }),
        { dica: R.faixasIdade.map(function (f) { return f.rot + ' — ' + f.desc; }).join('\n\n') +
                '\n\nAs faixas são indicativas: o que degrada o coeficiente é a incrustação e o biofilme, não o tempo em si. Sempre que houver medição em campo, informe o coeficiente diretamente no campo ao lado.' }),
      UI.select(st, 'Material para rugosidade', base + '.materialOverride',
        [{ v: '', rot: '(do catálogo: ' + (cons ? cons.rot : '—') + ')' }].concat(
          R.listaMateriais().map(function (m) { return { v: m.id, rot: m.rot }; })),
        { editado: !!conj.materialOverride,
          dica: 'Por padrão o material vem do catálogo do tubo. Troque aqui quando o revestimento interno for diferente do usual (por exemplo, ferro fundido com epóxi em vez de argamassa de cimento).' })
    ];

    if (usaHW) {
      campos.push(UI.campo(st, 'C de Hazen-Williams', base + '.cOverride', {
        editado: conj.cOverride !== null && conj.cOverride !== '' && conj.cOverride !== undefined,
        placeholder: cons ? UI.numEdit(cons.C) : '',
        dica: cons ? ('Sugerido: C = ' + UI.numEdit(cons.C) + '\nFaixa da literatura para ' + cons.rot +
                      ' nesta idade: ' + UI.numEdit(cons.faixaC[0]) + ' a ' + UI.numEdit(cons.faixaC[1]) +
                      (cons.ajusteFluido && cons.ajusteFluido.dC ? '\n\nJá inclui o ajuste de ' + UI.numEdit(cons.ajusteFluido.dC) +
                       ' por se tratar de ' + cons.ajusteFluido.rot + ': ' + cons.ajusteFluido.nota : '') +
                      '\n\nDeixe em branco para usar o valor sugerido.') : ''
      }));
    } else {
      campos.push(UI.campo(st, 'Rugosidade ε (mm)', base + '.epsOverride', {
        editado: conj.epsOverride !== null && conj.epsOverride !== '' && conj.epsOverride !== undefined,
        placeholder: cons ? UI.numEdit(cons.eps) : '',
        dica: cons ? ('Sugerido: ε = ' + UI.numEdit(cons.eps) + ' mm\nFaixa da literatura para ' + cons.rot +
                      ' nesta idade: ' + UI.numEdit(cons.faixaEps[0]) + ' a ' + UI.numEdit(cons.faixaEps[1]) + ' mm' +
                      (cons.ajusteFluido && cons.ajusteFluido.dEps ? '\n\nJá inclui o acréscimo de ' + UI.numEdit(cons.ajusteFluido.dEps) +
                       ' mm por se tratar de ' + cons.ajusteFluido.rot + ': ' + cons.ajusteFluido.nota : '') +
                      '\n\nDeixe em branco para usar o valor sugerido.') : ''
      }));
    }

    var fontes = (cons ? cons.fontes : []).concat(cat ? (cat.fonteIds || []) : []);
    campos.push(h('div', { style: 'display:flex;align-items:flex-end;gap:6px;padding-bottom:1px' },
      UI.botaoFonte(fontes, (cons && cons.nota ? cons.nota : '') +
        (cat && cat.nota ? (cons && cons.nota ? '\n\n' : '') + cat.nota : '')),
      (conj.cOverride || conj.epsOverride) ? h('button', {
        class: 'btn mini naoimprime', type: 'button', 'data-acao': 'limparRugosidade', 'data-base': base
      }, 'Voltar ao sugerido') : null));

    return h('div', { class: 'grade' }, campos);
  };

  /* ================================================================
     Informações do tubo escolhido
     ================================================================ */

  F.infoTubo = function (st, ctx, conj) {
    var t = PDA.C.resolverTubo(conj, ctx);
    if (!t) return h('p', { class: 'nota' }, 'Selecione um catálogo.');
    var flags = [];
    if (t.item.calc) flags.push(h('span', { class: 'tag cinza', title: 'Espessura obtida por fórmula normativa, não transcrita de tabela de fabricante.' }, 'e calculada'));
    if (t.item.verificar) flags.push(h('span', { class: 'tag atencao', title: 'Confirme esta dimensão no catálogo do fornecedor antes de fechar o projeto.' }, 'conferir catálogo'));

    return h('div', { class: 'faixa-resumo', style: 'margin:0 0 4px' },
      chip('DI', UI.num(t.diMm, 1), 'mm'),
      t.item.de ? chip('DE', UI.num(t.item.de, 1), 'mm') : null,
      t.eMm ? chip('Espessura', UI.num(t.eMm, 1), 'mm') : null,
      t.item.pn ? chip('PN', UI.numEdit(t.item.pn), '≈ ' + UI.num(t.item.pn * 10, 0) + ' mca') : null,
      st.calculo.metodo === 'hw' ? chip('Coef. C adotado', UI.num(t.C, 0), t.cOverride ? 'editado' : 'sugerido')
                                 : chip('Rugosidade adotada', UI.num(t.epsMm, 4) + ' mm', t.epsOverride ? 'editado' : 'sugerido'),
      flags.length ? h('div', { class: 'chip' }, h('span', { class: 'rot' }, 'Observações'), h('div', { style: 'display:flex;gap:4px' }, flags)) : null);
  };

  function chip(rot, val, sub) {
    return h('div', { class: 'chip' },
      h('span', { class: 'rot' }, rot),
      h('span', { class: 'val' }, val, sub ? h('small', {}, ' ' + sub) : null));
  }
  F.chip = chip;

  /* ================================================================
     Tabela de peças
     ================================================================ */

  F.tabelaPecas = function (st, ctx, conj, base) {
    var cats = {}, ordem = [];
    PDA.P.pecas.forEach(function (p) {
      if (!cats[p.cat]) { cats[p.cat] = []; ordem.push(p.cat); }
      cats[p.cat].push(p);
    });

    var Q = null;
    try { Q = PDA.C.vazaoConjunto(F.raizChave(base), conj, ctx.nOp, ctx); } catch (e) { Q = 0; }
    var tubo = PDA.C.resolverTubo(conj, ctx);
    var somaK = 0, somaH = 0;

    var linhas = (conj.pecas || []).map(function (p, i) {
      var def = PDA.P.buscarPeca(PDA.P.pecas, p.pecaId);
      var K = (p.kOverride !== null && p.kOverride !== undefined && p.kOverride !== '') ? Number(p.kOverride) : (def ? def.K : 0);
      var qtd = Number(p.qtd) || 0;
      var diLoc = (p.diLocalMm && Number(p.diLocalMm) > 0) ? Number(p.diLocalMm) / 1000 : (tubo ? tubo.diM : 0);
      var v = diLoc > 0 ? PDA.H.velocidade(Q, diLoc) : 0;
      var perda = K * qtd * v * v / (2 * PDA.H.g);
      somaK += K * qtd; somaH += perda;

      return h('tr', {},
        h('td', { class: 'esq' },
          h('select', { 'data-bind': base + '.pecas.' + i + '.pecaId', 'data-tipo': 'texto', 'data-estrutural': '1' },
            ordem.map(function (c) {
              return h('optgroup', { label: c }, cats[c].map(function (d) {
                return h('option', { value: d.id, selected: d.id === p.pecaId }, d.rot);
              }));
            }))),
        h('td', { class: 'col-qtd' },
          h('input', { type: 'text', class: 'num', value: UI.numEdit(p.qtd),
                       'data-bind': base + '.pecas.' + i + '.qtd', 'data-tipo': 'num', inputmode: 'decimal' })),
        h('td', { class: 'col-k' },
          h('input', { type: 'text', class: 'num' + (p.kOverride ? ' editado' : ''),
                       value: p.kOverride === null || p.kOverride === undefined || p.kOverride === '' ? '' : UI.numEdit(p.kOverride),
                       placeholder: def ? UI.numEdit(def.K) : '', title: def ? ('Padrão: ' + UI.numEdit(def.K)) : '',
                       'data-bind': base + '.pecas.' + i + '.kOverride', 'data-tipo': 'num', inputmode: 'decimal' })),
        h('td', { class: 'col-di' },
          h('input', { type: 'text', class: 'num' + (p.diLocalMm ? ' editado' : ''),
                       value: p.diLocalMm === null || p.diLocalMm === undefined || p.diLocalMm === '' ? '' : UI.numEdit(p.diLocalMm),
                       placeholder: tubo ? UI.num(tubo.diMm, 0) : '',
                       title: 'Diâmetro interno da peça, quando diferente do tubo do trecho (mm)',
                       'data-bind': base + '.pecas.' + i + '.diLocalMm', 'data-tipo': 'num', inputmode: 'decimal' })),
        h('td', {}, UI.num(K * qtd, 2)),
        h('td', {}, UI.num(v, 2)),
        h('td', {}, UI.num(perda, 3)),
        h('td', { class: 'col-x' },
          h('button', { class: 'btn mini icone perigo naoimprime', type: 'button',
                        'data-acao': 'removerPeca', 'data-base': base, 'data-i': i, title: 'Remover' }, '×')));
    });

    var seletorNovo = h('select', { style: 'max-width:230px', 'data-acao-change': 'addPeca', 'data-base': base },
      [h('option', { value: '' }, '+ adicionar peça…')].concat(
        ordem.map(function (c) {
          return h('optgroup', { label: c }, cats[c].map(function (d) {
            return h('option', { value: d.id }, d.rot + '  (K = ' + UI.numEdit(d.K) + ')');
          }));
        })));

    return h('div', {},
      linhas.length ? h('div', { class: 'rolagem' }, h('table', { class: 'pecas-tab enxuta' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'esq' }, 'Peça'),
          h('th', {}, 'Qtd.'),
          h('th', {}, 'K', UI.dica('Coeficiente de perda localizada. O campo mostra o valor padrão como sugestão; digite outro para sobrepor apenas nesta peça.\n\n' + PDA.P.fontePecas.az)),
          h('th', {}, 'DI da peça', UI.dica('Use quando a peça tem diâmetro diferente do tubo do trecho — por exemplo uma válvula DN 300 em uma linha DN 400. Em branco, adota o DI do trecho.')),
          h('th', {}, 'ΣK'),
          h('th', {}, 'v (m/s)'),
          h('th', {}, 'Perda (m)'),
          h('th', {}, ''))),
        h('tbody', {}, linhas),
        h('tfoot', {}, h('tr', {},
          h('td', { class: 'esq', colspan: 4 }, 'Total'),
          h('td', {}, UI.num(somaK, 2)),
          h('td', {}, ''),
          h('td', {}, UI.num(somaH, 3)),
          h('td', {}, ''))))) : h('p', { class: 'vazio' }, 'Nenhuma peça lançada neste trecho.'),
      h('div', { style: 'margin-top:7px' }, seletorNovo));
  };

  F.raizChave = function (base) {
    if (base.indexOf('adutoras') === 0) return 'adutora';
    if (base.indexOf('succaoComum') === 0) return 'succaoComum';
    if (base.indexOf('barrileteComum') === 0) return 'barrileteComum';
    if (base.indexOf('succaoIndividual') === 0) return 'succaoIndividual';
    return 'barrileteIndividual';
  };

  /* ================================================================
     Tabela de varredura de diâmetros (cores)
     ================================================================ */

  F.varredura = function (st, ctx, conj, chave, base) {
    var v = PDA.C.varrer(st, ctx, conj, chave, ctx.nOp);
    if (!v.linhas.length) return h('p', { class: 'vazio' }, 'Catálogo sem itens.');
    var usaHW = st.calculo.metodo === 'hw';

    var linhas = v.linhas.map(function (l) {
      var sel = l.rot === conj.itemRot;
      return h('tr', {
        class: l.classe + (sel ? ' selecionada' : ''),
        style: 'cursor:pointer',
        title: l.motivos.join(' · '),
        'data-acao': 'escolherDiametro', 'data-base': base, 'data-rot': l.rot
      },
        h('td', { class: 'esq' },
          l.recomendado ? h('span', { title: 'Sugestão do programa', style: 'color:var(--azul)' }, '★ ') : null,
          l.rot,
          l.verificar ? h('span', { class: 'tag atencao', style: 'margin-left:5px' }, '!') : null),
        h('td', {}, UI.num(l.diMm, 1)),
        h('td', {}, l.eMm ? UI.num(l.eMm, 1) : '—'),
        h('td', {}, l.pn ? UI.numEdit(l.pn) : '—'),
        h('td', {}, UI.num(l.v, 2)),
        h('td', {}, UI.tab(l.jKm)),
        h('td', {}, UI.tab(l.hf)),
        h('td', {}, UI.tab(l.hl)),
        h('td', {}, UI.tab(l.htotal)),
        usaHW ? h('td', {}, UI.num(l.C, 0)) : h('td', {}, l.f ? UI.num(l.f, 4) : '—'),
        h('td', {}, l.Re ? UI.num(l.Re / 1000, 0) + 'k' : '—'),
        h('td', {}, UI.num(l.vMin1, 2)),
        h('td', {}, UI.tagClasse(l.classe)));
    });

    var crit = v.crit;
    return h('div', {},
      h('div', { class: 'nota', style: 'margin-bottom:6px;display:flex;gap:14px;flex-wrap:wrap' },
        h('span', {}, 'Vazão do trecho: ', h('b', {}, UI.num(v.Q * 1000, 1) + ' L/s'),
          ' (', UI.num(v.Q * 3600, 1), ' m³/h)'),
        h('span', {}, 'Critério: v de ', UI.numEdit(crit.vBom[0]), ' a ', UI.numEdit(crit.vBom[1]),
          ' m/s (máx. ', UI.numEdit(crit.vMax), ', mín. ', UI.numEdit(crit.vMin), ') · J de ',
          UI.numEdit(crit.jBom[0]), ' a ', UI.numEdit(crit.jBom[1]), ' m/km (máx. ', UI.numEdit(crit.jMax), ')',
          UI.dica(crit.nota + '\n\nAs faixas são editáveis na aba Projeto → Critérios de verificação.')),
        h('span', {}, 'Bresse: ', UI.num(v.bresse.k07, 0), ' a ', UI.num(v.bresse.k13, 0), ' mm',
          ' (K = 1,0 → ', UI.num(v.bresse.k10, 0), ' mm)',
          UI.dica('Diâmetro econômico de Bresse D = K·√Q, com K entre 0,7 e 1,3. É apenas uma referência de ordem de grandeza para o pré-dimensionamento.\n\n' +
                  PDA.H.fontes.filter(function (f) { return f.id === 'bresse'; })[0].txt))),
      h('div', { class: 'rolagem' }, h('table', { class: 'enxuta' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'esq' }, 'Diâmetro'),
          h('th', {}, 'DI (mm)'),
          h('th', {}, 'e (mm)'),
          h('th', {}, 'PN'),
          h('th', {}, 'v (m/s)'),
          h('th', {}, 'J (m/km)'),
          h('th', {}, 'hf (m)'),
          h('th', {}, 'Σhₗ (m)'),
          h('th', {}, 'Total (m)'),
          usaHW ? h('th', {}, 'C') : h('th', {}, 'f'),
          h('th', {}, 'Re'),
          h('th', {}, 'v c/ 1 bomba', UI.dica('Velocidade no trecho quando apenas uma bomba opera. É a condição crítica para a velocidade mínima de autolimpeza, especialmente em linhas de recalque de esgoto (0,6 m/s pela NBR 12208).')),
          h('th', {}, 'Situação'))),
        h('tbody', {}, linhas))),
      h('p', { class: 'nota', style: 'margin-top:6px' },
        'Clique em uma linha para adotar o diâmetro. ★ marca a sugestão do programa: o menor diâmetro que atende integralmente aos critérios.'));
  };

  /* ================================================================
     Editor de um conjunto (tubo + peças + varredura)
     ================================================================ */

  /* op: {titulo, base, chave, removivel, ativavel, adutora, tituloEditavel} */
  F.conjunto = function (st, ctx, conj, op) {
    var base = op.base;
    var cabecalho = [
      op.ativavel ? h('input', { type: 'checkbox', checked: conj.ativo !== false,
                                 'data-bind': base + '.ativo', 'data-tipo': 'bool', 'data-estrutural': '1',
                                 title: 'Considerar este trecho no cálculo' }) : null,
      op.tituloEditavel
        ? h('input', { class: 'titulo', type: 'text', value: conj.rot || '', 'data-bind': base + '.rot', 'data-tipo': 'texto' })
        : h('h3', { style: 'flex:1;font-size:13px' }, op.titulo || conj.rot),
      h('div', { class: 'dir', style: 'margin-left:auto' },
        op.removivel ? h('button', { class: 'btn mini perigo naoimprime', type: 'button',
                                     'data-acao': op.acaoRemover, 'data-i': op.i }, 'Remover') : null)
    ];

    if (conj.ativo === false) {
      return h('div', { class: 'conjunto desativado' }, h('div', { class: 'cab-conj' }, cabecalho));
    }

    var campos = [
      h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Catálogo / material do tubo'),
        F.selectCatalogo(st, ctx.cats, base + '.catalogoId')),
      h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Diâmetro adotado'),
        F.selectDiametro(st, ctx.cats, conj, base + '.itemRot')),
      UI.campo(st, 'Extensão', base + '.extensao', { unid: { grandeza: 'extensao', caminho: base + '.unidExt' } })
    ];

    if (op.adutora) {
      campos.push(UI.select(st, 'Vazão do trecho', base + '.vazaoModo', [
        { v: 'pct', rot: 'Fração da vazão total' },
        { v: 'abs', rot: 'Vazão informada' }
      ], { dica: 'Em adutoras que se ramificam, cada trecho a jusante da derivação conduz menos vazão. Informe a fração (%) da vazão total bombeada ou a vazão absoluta do trecho.' }));
      if (conj.vazaoModo === 'abs') {
        campos.push(UI.campo(st, 'Vazão do trecho', base + '.vazaoAbs',
          { unid: { grandeza: 'vazao', caminho: base + '.unidVazaoAbs' } }));
      } else {
        campos.push(UI.campo(st, 'Fração da vazão total', base + '.vazaoPct', { sufixo: '%' }));
      }
    }

    if (op.nBombas) {
      campos.push(UI.campo(st, 'Bombas que o trecho coleta', base + '.nBombas', {
        sufixo: 'ud',
        dica: 'Número de bombas cuja vazão passa por este trecho do barrilete comum. O primeiro trecho após a primeira derivação conduz 1 bomba, o seguinte 2, e assim por diante.\n\nQuando o cenário simulado tiver menos bombas em operação do que este número, o programa usa a quantidade em operação.'
      }));
    }

    var corpo = [
      h('div', { class: 'grade' }, campos),
      F.infoTubo(st, ctx, conj),
      UI.sub('Rugosidade'),
      F.blocoRugosidade(st, ctx, conj, base)
    ];

    if (op.adutora) {
      var tuboAtual = PDA.C.resolverTubo(conj, ctx);
      var pnCat = tuboAtual && tuboAtual.item && tuboAtual.item.pn ? Number(tuboAtual.item.pn) * 10 : null;
      corpo.push(UI.sub('Pressão admissível e cotas do trecho (para o perfil e a verificação de pressão)'));
      corpo.push(h('div', { class: 'grade' },
        UI.campo(st, 'PN / PFA do tubo (mca)', base + '.pnMcaOverride', {
          editado: conj.pnMcaOverride !== null && conj.pnMcaOverride !== '' && conj.pnMcaOverride !== undefined,
          placeholder: pnCat !== null ? UI.num(pnCat, 0) : 'informar',
          dica: 'Pressão de serviço admissível do tubo, em mca, usada para conferir a pressão em regime permanente e a sobrepressão do transitório.\n\n' +
                (pnCat !== null
                  ? 'O catálogo deste tubo informa PN ' + UI.numEdit(tuboAtual.item.pn) + ' bar (' + UI.num(pnCat, 0) + ' mca). Deixe em branco para usar esse valor.'
                  : 'O catálogo deste tubo não traz a pressão admissível — é o caso do ferro fundido dúctil, em que a PFA depende da classe, do DN e do tipo de junta. Consulte o catálogo do fabricante e informe aqui para habilitar a verificação.')
        }),
        UI.check(st, 'Informar cotas deste trecho', base + '.usarCotas',
          { dica: 'As cotas por trecho não alteram a altura geométrica total (que vem dos níveis de sucção e de chegada). Servem para traçar o perfil e verificar a pressão máxima em cada ponto contra o PN do tubo.' }),
        conj.usarCotas ? UI.campo(st, 'Cota inicial (m)', base + '.cotaIni') : null,
        conj.usarCotas ? UI.campo(st, 'Cota final (m)', base + '.cotaFim') : null));
    }

    corpo.push(UI.sub('Peças e conexões do trecho'));
    corpo.push(F.tabelaPecas(st, ctx, conj, base));
    corpo.push(UI.sub('Comparação de diâmetros'));
    corpo.push(F.varredura(st, ctx, conj, op.chave, base));

    return h('div', { class: 'conjunto' },
      h('div', { class: 'cab-conj' }, cabecalho),
      h('div', { class: 'corpo-conj' }, corpo));
  };

  /* ================================================================
     ABA: Projeto
     ================================================================ */

  F.abaProjeto = function (st, ctx) {
    var fluidos = R.fluidos.map(function (f) { return { v: f.id, rot: f.rot }; });
    var fl = R.fluidos.filter(function (f) { return f.id === st.fluido.tipo; })[0];

    return [
      UI.cartao('Identificação', null, h('div', { class: 'grade g2' },
        UI.campo(st, 'Projeto / obra', 'projeto.nome', { tipo: 'texto' }),
        UI.campo(st, 'Local', 'projeto.local', { tipo: 'texto' }),
        UI.campo(st, 'Responsável técnico', 'projeto.responsavel', { tipo: 'texto' }),
        UI.campo(st, 'Data', 'projeto.data', { tipo: 'texto', placeholder: 'dd/mm/aaaa' }))),

      UI.cartao('Fluido e método de cálculo', null, [
        h('div', { class: 'grade' },
          UI.select(st, 'Fluido bombeado', 'fluido.tipo', fluidos, {
            dica: 'O fluido define dois ajustes: as faixas de velocidade recomendadas (água ou esgoto) e um agravo na rugosidade por biofilme/sólidos.\n\n' +
                  R.fluidos.map(function (f) {
                    return f.rot + ': ΔC = ' + UI.numEdit(f.dC) + ', Δε = ' + UI.numEdit(f.dEps) + ' mm — ' + f.nota;
                  }).join('\n\n')
          }),
          UI.campo(st, 'Temperatura do fluido', 'fluido.temperatura', { sufixo: '°C',
            dica: 'Afeta a viscosidade cinemática (usada no número de Reynolds e portanto na fórmula universal) e a pressão de vapor (usada no NPSH disponível).' }),
          UI.campo(st, 'Altitude do local', 'fluido.altitude', { sufixo: 'm',
            dica: 'Usada para a pressão atmosférica local no cálculo do NPSH disponível. Ao nível do mar são 10,33 mca; a cada 1000 m de altitude perde-se cerca de 1,2 mca.' }),
          UI.select(st, 'Fórmula de perda de carga', 'calculo.metodo', [
            { v: 'colebrook', rot: 'Colebrook-White (iterativa) — recomendada' },
            { v: 'hw', rot: 'Hazen-Williams (coeficiente C)' },
            { v: 'swamee', rot: 'Swamee-Jain (explícita)' },
            { v: 'zigrang', rot: 'Zigrang-Sylvester (explícita)' }
          ], {
            dica: 'Colebrook-White resolvida por iteração é a referência: vale para qualquer regime turbulento e usa a rugosidade absoluta ε.\n\n' +
                  'Hazen-Williams é empírica, válida para água a temperatura ambiente, condutos de 50 a 3500 mm e velocidades até cerca de 3 m/s, e usa o coeficiente C.\n\n' +
                  'Swamee-Jain e Zigrang-Sylvester são aproximações explícitas da Colebrook — a segunda é a que estava embutida na planilha original.\n\n' +
                  PDA.H.fontes.slice(0, 4).map(function (f) { return f.txt; }).join('\n\n')
          })),
        h('div', { style: 'margin-top:10px' },
          UI.check(st, 'Mostrar comparação entre as quatro fórmulas nos resultados', 'calculo.comparar')),
        fl ? h('div', { class: 'aviso info' }, h('b', {}, fl.rot), fl.nota) : null
      ], UI.botaoFonte(['nbr12214', 'nbr12215', 'nbr12208', 'tsutiya', 'tsutiya_esgoto'])),

      UI.cartao('Vazão de projeto', null, h('div', { class: 'grade' },
        UI.campo(st, 'Vazão', 'vazao.valor', { unid: { grandeza: 'vazao', caminho: 'vazao.unidade' } }),
        UI.select(st, 'A vazão informada é', 'vazao.base', [
          { v: 'total', rot: 'a vazão total do sistema' },
          { v: 'porBomba', rot: 'a vazão de cada bomba' }
        ], { dica: 'Quando você informa a vazão total, o programa a divide pelo número de bombas em operação para obter a vazão por bomba. Quando informa a vazão por bomba, multiplica pelo número em operação.' }),
        h('div', { class: 'chip', style: 'justify-content:flex-end' },
          h('span', { class: 'rot' }, 'Resultado'),
          h('span', { class: 'val' }, UI.num(ctx.qTotal * 1000, 1), h('small', {}, ' L/s total')),
          h('span', { class: 'nota' }, UI.num(ctx.qBomba * 1000, 1) + ' L/s por bomba · ' +
            UI.num(ctx.qTotal * 3600, 1) + ' m³/h · ' + UI.num(ctx.qTotal * 86400, 0) + ' m³/dia')))),

      F.cartaoCriterios(st, ctx),

      UI.cartao('Constantes de Hazen-Williams (ajuste fino)',
        'Só afetam o cálculo quando a fórmula selecionada é Hazen-Williams',
        [h('div', { class: 'grade g4' },
          UI.campo(st, 'Constante', 'calculo.hwK', { dica: 'Valor consagrado: 10,643 (Azevedo Netto). As planilhas de origem usavam 10,646 — a diferença é inferior a 0,1 %.' }),
          UI.campo(st, 'Expoente da vazão', 'calculo.hwExpQ'),
          UI.campo(st, 'Expoente do diâmetro', 'calculo.hwExpD', { dica: 'Valor consagrado: 4,871. As planilhas de origem usavam 4,87.' })),
         h('p', { class: 'nota', style: 'margin-top:8px' },
           'J = k · Q^a · C^−a · D^−b, com J em m/m, Q em m³/s e D em m. ' +
           'Os valores padrão reproduzem a formulação do Manual de Hidráulica; ' +
           'altere apenas se precisar reproduzir exatamente outra referência.')])
    ];
  };

  F.cartaoCriterios = function (st, ctx) {
    var fam = ctx.familiaCriterio;
    var famRot = fam === 'esgoto' ? 'esgoto / efluente' : 'água';
    var linhas = PDA.P.tiposTrecho.map(function (t) {
      var b = 'criterios.' + fam + '.' + t.id;
      var c = st.criterios[fam][t.id];
      function inp(cam, val) {
        return h('input', { type: 'text', class: 'num', value: UI.numEdit(val),
                            'data-bind': b + '.' + cam, 'data-tipo': 'num', inputmode: 'decimal',
                            style: 'width:70px' });
      }
      return h('tr', {},
        h('td', { class: 'esq' }, t.rot, c.nota ? UI.dica(c.nota) : null),
        h('td', {}, inp('vMin', c.vMin)),
        h('td', {}, inp('vBom.0', c.vBom[0])),
        h('td', {}, inp('vBom.1', c.vBom[1])),
        h('td', {}, inp('vMax', c.vMax)),
        h('td', {}, inp('jBom.0', c.jBom[0])),
        h('td', {}, inp('jBom.1', c.jBom[1])),
        h('td', {}, inp('jMax', c.jMax)),
        h('td', {}, c.fonte ? UI.botaoFonte([c.fonte]) : null));
    });

    return UI.cartao('Critérios de verificação (as cores da tabela de diâmetros)',
      'Faixas aplicadas a ' + famRot + ' — trocar o fluido troca o conjunto de faixas',
      [
        h('p', { class: 'nota', style: 'margin-bottom:8px' },
          'Verde: velocidade e perda unitária dentro das faixas recomendadas. ' +
          'Âmbar: fora da faixa recomendada, mas dentro dos limites admissíveis. ' +
          'Vermelho: abaixo da velocidade mínima, acima da velocidade máxima ou acima da perda unitária máxima. ' +
          'Todos os valores abaixo são editáveis — inclusive para uma análise pontual.'),
        h('div', { class: 'rolagem' }, h('table', { class: 'enxuta' },
          h('thead', {},
            h('tr', {},
              h('th', { class: 'esq', rowspan: 2 }, 'Tipo de trecho'),
              h('th', { colspan: 4 }, 'Velocidade (m/s)'),
              h('th', { colspan: 3 }, 'Perda unitária J (m/km)'),
              h('th', { rowspan: 2 }, '')),
            h('tr', {},
              h('th', {}, 'mínima'), h('th', {}, 'boa de'), h('th', {}, 'boa até'), h('th', {}, 'máxima'),
              h('th', {}, 'boa de'), h('th', {}, 'boa até'), h('th', {}, 'máxima'))),
          h('tbody', {}, linhas))),
        h('div', { style: 'margin-top:9px' },
          h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'restaurarCriterios' },
            'Restaurar faixas recomendadas'))
      ]);
  };

  /* ================================================================
     ABA: Bombas e níveis
     ================================================================ */

  F.abaBombas = function (st, ctx, res) {
    var submersivel = st.bombas.tipo === 'submersivel';
    var cen = res.projeto;

    return [
      UI.cartao('Conjuntos elevatórios', null, [
        h('div', { class: 'grade' },
          UI.campo(st, 'Bombas instaladas', 'bombas.instaladas', { sufixo: 'ud',
            dica: 'Total de conjuntos instalados, incluindo reserva. O programa gera um cenário de cálculo para cada quantidade de 1 até este número.' }),
          UI.campo(st, 'Bombas em operação simultânea', 'bombas.operando', { sufixo: 'ud',
            dica: 'Quantidade que opera na condição de projeto. Define o cenário destacado nos resultados e a vazão por bomba.' }),
          UI.select(st, 'Arranjo da bomba', 'bombas.tipo', [
            { v: 'afogada', rot: 'Bomba afogada (nível acima do eixo)' },
            { v: 'succao', rot: 'Bomba com sucção negativa (aspirando)' },
            { v: 'submersivel', rot: 'Bomba submersível (sem barrilete de sucção)' }
          ], { dica: 'No arranjo submersível não existem barriletes de sucção — o programa desativa esses trechos e não calcula NPSH disponível.' }),
          UI.campo(st, 'Rendimento da bomba', 'bombas.rendBomba', { sufixo: '%',
            dica: 'Rendimento hidráulico esperado no ponto de operação. Em pré-dimensionamento usa-se de 60 a 75 % para bombas de médio porte e de 75 a 85 % para grandes conjuntos. Confirmar na curva do fabricante.' }),
          UI.campo(st, 'Rendimento do motor', 'bombas.rendMotor', { sufixo: '%',
            dica: 'Usado apenas para estimar a potência elétrica consumida (kW na rede). Não altera a potência de eixo nem a escolha do motor.' })),
        h('div', { style: 'margin-top:9px;display:flex;gap:18px;flex-wrap:wrap' },
          UI.check(st, 'Calcular também a potência elétrica consumida (kW)', 'bombas.usarRendMotor')),
        h('div', { class: 'grade', style: 'margin-top:11px' },
          UI.select(st, 'Folga sobre a potência de eixo', 'bombas.folgaModo', [
            { v: 'auto', rot: 'Automática, por faixa de potência' },
            { v: 'fixa', rot: 'Percentual fixo' }
          ], { dica: PDA.P.fonteMotores }),
          st.bombas.folgaModo === 'fixa' ? UI.campo(st, 'Folga adotada', 'bombas.folgaPct', { sufixo: '%' })
            : h('div', { class: 'chip' }, h('span', { class: 'rot' }, 'Folga aplicada'),
                h('span', { class: 'val' }, UI.num(cen.folgaPct, 0), h('small', {}, ' %')),
                h('span', { class: 'nota' }, 'faixa de ' + UI.num(cen.bhpCv, 1) + ' cv')),
          h('div', { style: 'display:flex;align-items:flex-end' },
            h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'editarMotores' },
              'Editar linha de motores'))),
        h('p', { class: 'nota', style: 'margin-top:10px' },
          'A operação em paralelo é tratada de forma simplificada: a vazão por bomba é mantida constante e a vazão total ' +
          'cresce proporcionalmente ao número de conjuntos em operação. É o suficiente para o pré-dimensionamento, mas ' +
          'no projeto executivo o ponto de operação real precisa sair da interseção entre a curva da bomba e a curva do sistema — ' +
          'em paralelo, cada bomba entrega menos que a sua vazão individual.')
      ]),

      UI.cartao('Níveis e cotas', null, [
        h('div', { class: 'grade' },
          UI.campo(st, 'Nível de sucção mínimo (m)', 'cotas.nivelSuccaoMin', {
            dica: 'Nível d\'água mínimo no poço / reservatório de sucção. Gera a maior altura geométrica, ou seja, a condição crítica de altura manométrica.' }),
          UI.campo(st, 'Nível de sucção máximo (m)', 'cotas.nivelSuccaoMax', {
            dica: 'Nível d\'água máximo. Gera a menor altura manométrica — útil para verificar o outro extremo da curva do sistema.' }),
          submersivel ? null : UI.campo(st, 'Cota do eixo da bomba (m)', 'cotas.eixoBomba', {
            dica: 'Usada no NPSH disponível. Se o eixo está abaixo do nível de sucção, a bomba está afogada e a parcela geométrica ajuda o NPSH.' }),
          UI.campo(st, 'Cota de chegada (m)', 'cotas.nivelChegada', {
            dica: 'Cota do nível d\'água de chegada (reservatório) ou do ponto de descarga. A altura geométrica é a diferença entre esta cota e o nível de sucção.' })),
        h('div', { class: 'faixa-resumo', style: 'margin:11px 0 0' },
          F.chip('Hg máxima', UI.num(cen.HgMax, 2), 'm — nível de sucção mínimo'),
          F.chip('Hg mínima', UI.num(cen.HgMin, 2), 'm — nível de sucção máximo'),
          submersivel ? null : F.chip('Carga na sucção', UI.num(cen.zSuccao, 2), 'm — ' + (cen.zSuccao >= 0 ? 'afogada' : 'aspirando')),
          F.chip('Pressão atmosférica', UI.num(ctx.patm, 2), 'mca a ' + UI.num(st.fluido.altitude, 0) + ' m'),
          F.chip('Pressão de vapor', UI.num(ctx.pvapor, 3), 'mca a ' + UI.num(st.fluido.temperatura, 0) + ' °C')),
        cen.HgMax <= 0 ? h('div', { class: 'aviso' },
          'A cota de chegada não é superior ao nível de sucção: a altura geométrica é nula ou negativa. ' +
          'Confira as cotas — em recalque a cota de chegada precisa ser a mais alta.') : null
      ], UI.botaoFonte(['nbr12214', 'nbr12208', 'npsh'].filter(function (i) { return PDA.R.fontes[i]; })))
    ];
  };

  /* ================================================================
     ABA: Sucção
     ================================================================ */

  F.abaSuccao = function (st, ctx) {
    if (st.bombas.tipo === 'submersivel') {
      return [UI.cartao('Sucção', null, h('div', { class: 'aviso info' },
        h('b', {}, 'Arranjo submersível'),
        'Bombas submersíveis não têm barrilete de sucção individual nem comum — a entrada é o próprio corpo da bomba. ' +
        'Troque o arranjo na aba Bombas se precisar lançar trechos de sucção.'))];
    }

    var out = [];
    out.push(UI.cartao('Barrilete de sucção individual (por bomba)',
      'Conduz a vazão de uma única bomba', [
        UI.check(st, 'Considerar sucção individual', 'succaoIndividual.ativo'),
        st.succaoIndividual.ativo
          ? F.conjunto(st, ctx, st.succaoIndividual, {
              base: 'succaoIndividual', chave: 'succaoIndividual',
              titulo: 'Trecho individual de sucção'
            })
          : h('p', { class: 'nota', style: 'margin-top:8px' },
              'Sem sucção individual, as perdas de sucção só vêm do barrilete comum (se houver).')
      ]));

    out.push(F.blocoTrechosComuns(st, ctx, 'succaoComum', 'Barrilete de sucção comum',
      'Trechos compartilhados; a vazão de cada trecho depende de quantas bombas ele coleta'));
    return out;
  };

  /* ================================================================
     ABA: Barriletes de recalque
     ================================================================ */

  F.abaBarrilete = function (st, ctx) {
    var out = [];
    out.push(UI.cartao('Barrilete de recalque individual (por bomba)',
      'Da saída da bomba até a derivação comum — conduz a vazão de uma bomba', [
        UI.check(st, 'Considerar barrilete individual', 'barrileteIndividual.ativo'),
        st.barrileteIndividual.ativo
          ? F.conjunto(st, ctx, st.barrileteIndividual, {
              base: 'barrileteIndividual', chave: 'barrileteIndividual',
              titulo: 'Trecho individual de recalque'
            })
          : null
      ]));

    out.push(F.blocoTrechosComuns(st, ctx, 'barrileteComum', 'Barrilete de recalque comum',
      'Um trecho por etapa de reunião: o 1º após juntar 1 bomba, o 2º após juntar 2, e assim por diante'));
    return out;
  };

  F.blocoTrechosComuns = function (st, ctx, chave, titulo, sub) {
    var bloco = st[chave];
    var acaoAdd = 'addTrecho:' + chave;
    var acaoDel = 'delTrecho:' + chave;

    var corpo = [
      UI.check(st, 'Considerar ' + titulo.toLowerCase(), chave + '.ativo'),
      bloco.ativo ? h('p', { class: 'nota', style: 'margin:8px 0' },
        'Cada trecho tem seu próprio diâmetro, extensão e peças. O campo "bombas que o trecho coleta" ' +
        'define a vazão: se o barrilete vai somando as bombas sequencialmente, use 1, 2, 3… ' +
        'Se toda a vazão se reúne de uma vez, use um único trecho com o número total de bombas.') : null,
      bloco.ativo ? bloco.trechos.map(function (t, i) {
        return F.conjunto(st, ctx, t, {
          base: chave + '.trechos.' + i, chave: chave + '.' + i,
          tituloEditavel: true, removivel: true, ativavel: true,
          acaoRemover: acaoDel, i: i, nBombas: true
        });
      }) : null,
      bloco.ativo ? h('div', { style: 'margin-top:9px' },
        h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': acaoAdd },
          '+ Adicionar trecho de barrilete comum')) : null
    ];
    return UI.cartao(titulo, sub, corpo);
  };

  /* ================================================================
     ABA: Adutoras / linhas de recalque
     ================================================================ */

  F.abaAdutoras = function (st, ctx) {
    var somaPct = 0;
    st.adutoras.forEach(function (a) { if (a.ativo !== false && a.vazaoModo === 'pct') somaPct = Math.max(somaPct, Number(a.vazaoPct) || 0); });

    return [
      UI.cartao('Adutora / linha de recalque',
        st.adutoras.length + (st.adutoras.length === 1 ? ' trecho' : ' trechos'), [
        h('p', { class: 'nota', style: 'margin-bottom:10px' },
          'Os trechos são percorridos em série, na ordem da lista. Quando a linha se ramifica, ' +
          'reduza a fração de vazão do trecho a jusante e escolha um diâmetro menor — as perdas de todos ' +
          'os trechos ativos somam-se na altura manométrica. Use a tabela de comparação de cada trecho ' +
          'para escolher o diâmetro.'),
        st.adutoras.map(function (a, i) {
          return F.conjunto(st, ctx, a, {
            base: 'adutoras.' + i, chave: 'adutoras.' + i,
            tituloEditavel: true, removivel: st.adutoras.length > 1, ativavel: true,
            acaoRemover: 'delAdutora', i: i, adutora: true
          });
        }),
        h('div', { style: 'margin-top:9px;display:flex;gap:8px' },
          h('button', { class: 'btn primario naoimprime', type: 'button', 'data-acao': 'addAdutora' },
            '+ Adicionar trecho de adutora'),
          h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'duplicarAdutora' },
            'Duplicar o último trecho'))
      ]),

      UI.cartao('Transitório hidráulico (pré-avaliação)',
        'Estimativa de sobrepressão para conferir a classe de pressão do tubo', [
        UI.check(st, 'Avaliar golpe de aríete', 'golpe.avaliar', {
          dica: 'Cálculo preliminar por Joukowsky (manobra rápida) e Michaud/Allievi (manobra lenta), apenas para verificar se a classe de pressão do tubo tem folga. Não substitui a modelagem do transitório com dispositivos de proteção.' }),
        st.golpe.avaliar ? h('div', { class: 'grade', style: 'margin-top:10px' },
          UI.campo(st, 'Tempo de manobra / parada', 'golpe.tempoManobra', { sufixo: 's',
            dica: 'Tempo de fechamento da válvula ou de parada do conjunto. Se for menor que o tempo crítico 2L/a, a manobra é rápida e vale a sobrepressão integral de Joukowsky.' }),
          UI.campo(st, 'Coeficiente de ancoragem ψ', 'golpe.psi', {
            dica: 'ψ = 1,0 para tubulação com juntas de dilatação (caso usual, e o mais conservador para a celeridade). Valores menores representam tubo ancorado longitudinalmente.' })) : null
      ], UI.botaoFonte(['nbr12215']))
    ];
  };

  PDA.F = F;
  PDA.F.init = init;
})(window.PDA = window.PDA || {});
