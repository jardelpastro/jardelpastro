/* ------------------------------------------------------------------
 * Painéis de entrada de dados
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var F = {};
  var UI = PDA.UI, h = null, R = PDA.R;

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
     Bloco de rugosidade
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
    if (t.semDiametro) {
      return h('div', { class: 'aviso erro', style: 'margin:0 0 4px' },
        h('b', {}, 'Diâmetro não escolhido — este trecho está fora do cálculo'),
        'Enquanto não houver um diâmetro, as perdas de carga deste trecho não entram na altura manométrica ' +
        'nem no NPSH. Escolha na lista acima ou clique numa linha da tabela de comparação, no fim do cartão. ' +
        'Se o trecho não existe, desmarque a caixa no título.');
    }
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

  function chip(rot, val, sub, classe) {
    return h('div', { class: 'chip' + (classe ? ' ' + classe : '') },
      h('span', { class: 'rot' }, rot),
      h('span', { class: 'val' }, val, sub ? h('small', {}, ' ' + sub) : null));
  }
  F.chip = chip;

  /* chip com sinal de atenção quando o resultado merece um segundo olhar */
  F.chipAlerta = function (rot, val, sub, alerta, classe) {
    var c = chip(rot, val, sub, alerta ? (alerta.grave ? 'alerta' : classe) : classe);
    if (alerta) {
      c.querySelector('.val').appendChild(
        h('span', { class: 'sinal' + (alerta.grave ? '' : ' atencao'), title: alerta.txt }, '!'));
    }
    return c;
  };

  /* ================================================================
     Tabela de peças
     ================================================================ */

  F.tabelaPecas = function (st, ctx, conj, base) {
    var cats = {}, ordem = [];
    PDA.P.pecas.forEach(function (p) {
      if (!cats[p.cat]) { cats[p.cat] = []; ordem.push(p.cat); }
      cats[p.cat].push(p);
    });

    var Q = 0;
    try { Q = PDA.C.vazaoConjunto(F.raizChave(base), conj, ctx.nOp, ctx); } catch (e) { Q = 0; }
    var tubo = PDA.C.resolverTubo(conj, ctx);
    var somaK = 0, somaH = 0;

    /* DN da peça: escolhido entre os itens do catálogo do trecho, e o
       programa busca o DI correspondente */
    function selectDN(p, i) {
      if (!tubo || !tubo.cat) return h('span', { class: 'nota' }, '—');
      return h('select', {
        'data-bind': base + '.pecas.' + i + '.dnLocal', 'data-tipo': 'texto', 'data-estrutural': '1',
        class: p.dnLocal ? 'editado' : '',
        title: 'DN da peça, quando diferente do tubo do trecho. O DI correspondente é buscado no catálogo.'
      }, [h('option', { value: '', selected: !p.dnLocal },
            'igual ao trecho' + (tubo.item && !tubo.semDiametro ? ' — ' + tubo.item.rot : ''))].concat(
        tubo.cat.itens.map(function (it) {
          return h('option', { value: it.rot, selected: it.rot === p.dnLocal },
            it.rot + ' — DI ' + UI.num(PDA.CAT.diInterno(tubo.cat, it), 0) + ' mm');
        })));
    }

    var caminhoArr = base + '.pecas';
    var total = (conj.pecas || []).length;

    var linhas = (conj.pecas || []).map(function (p, i) {
      var def = PDA.P.buscarPeca(PDA.P.pecas, p.pecaId);
      var K = (p.kOverride !== null && p.kOverride !== undefined && p.kOverride !== '') ? Number(p.kOverride) : (def ? def.K : 0);
      var qtd = Number(p.qtd) || 0;
      var diMm = PDA.C.diPeca(p, tubo);
      var v = diMm > 0 ? PDA.H.velocidade(Q, diMm / 1000) : 0;
      var perda = K * qtd * v * v / (2 * PDA.H.g);
      somaK += K * qtd; somaH += perda;

      return UI.linhaArrastavel(h('tr', {},
        UI.celulaMover(caminhoArr, i, total),
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
        h('td', { class: 'col-dn' }, selectDN(p, i)),
        h('td', {}, UI.num(diMm, 0)),
        h('td', {}, UI.num(K * qtd, 2)),
        h('td', {}, UI.num(v, 2)),
        h('td', {}, UI.num(perda, 3)),
        h('td', { class: 'col-x naoimprime' },
          h('button', { class: 'btn mini icone perigo', type: 'button',
                        'data-acao': 'removerPeca', 'data-base': base, 'data-i': i, title: 'Remover' }, '×'))),
        caminhoArr, i);
    });

    var seletorNovo = h('select', { style: 'max-width:250px', 'data-acao-change': 'addPeca', 'data-base': base },
      [h('option', { value: '' }, '+ adicionar peça…')].concat(
        ordem.map(function (c) {
          return h('optgroup', { label: c }, cats[c].map(function (d) {
            return h('option', { value: d.id }, d.rot + '  (K = ' + UI.numEdit(d.K) + ')');
          }));
        })));

    return h('div', {},
      h('div', { class: 'linha naoimprime', style: 'margin-bottom:8px' }, seletorNovo,
        h('span', { class: 'nota' }, 'A peça entra no fim da lista.')),
      linhas.length ? h('div', { class: 'rolagem' }, h('table', { class: 'pecas-tab enxuta' },
        h('thead', {}, h('tr', {},
          h('th', { class: 'naoimprime' }, 'Ordem',
            UI.dica('Arraste a linha pela alça ⠿ para reordenar, ou use as setas. A ordem não altera o cálculo — a perda localizada é a soma das peças — mas deixa a lista na sequência física do barrilete, o que ajuda a conferir e a montar a lista de materiais.')),
          h('th', { class: 'esq' }, 'Peça'),
          h('th', {}, 'Qtd.'),
          h('th', {}, 'K', UI.dica('Coeficiente de perda localizada. O campo mostra o valor padrão como sugestão; digite outro para sobrepor apenas nesta peça.\n\n' + PDA.P.fontePecas.az)),
          h('th', {}, 'DN da peça', UI.dica('Use quando a peça tem diâmetro diferente do tubo do trecho — uma redução de DN 400 para DN 300, uma válvula menor que a linha, um medidor estrangulado.\n\nEscolha o DN comercial: o programa busca o diâmetro interno correspondente no catálogo do trecho e calcula a perda com a velocidade nesse diâmetro. Você não precisa saber o DI de cabeça.')),
          h('th', {}, 'DI (mm)'),
          h('th', {}, 'ΣK'),
          h('th', {}, 'v (m/s)'),
          h('th', {}, 'Perda (m)'),
          h('th', {}, ''))),
        h('tbody', {}, linhas),
        h('tfoot', {}, h('tr', {},
          h('td', { class: 'naoimprime' }, ''),
          h('td', { class: 'esq', colspan: 5 }, 'Total'),
          h('td', {}, UI.num(somaK, 2)),
          h('td', {}, ''),
          h('td', {}, UI.num(somaH, 3)),
          h('td', {}, ''))))) : h('p', { class: 'vazio' }, 'Nenhuma peça lançada neste trecho.'));
  };

  F.raizChave = function (base) {
    if (base.indexOf('adutoras') === 0) return 'adutora';
    if (base.indexOf('succaoComum') === 0) return 'succaoComum';
    if (base.indexOf('barrileteComum') === 0) return 'barrileteComum';
    if (base.indexOf('succaoIndividual') === 0) return 'succaoIndividual';
    return 'barrileteIndividual';
  };

  /* ================================================================
     Tabela de varredura de diâmetros
     ================================================================ */

  F.varredura = function (st, ctx, conj, chave, base) {
    var v = PDA.C.varrer(st, ctx, conj, chave, ctx.nOp);
    if (!v.linhas.length) return h('p', { class: 'vazio' }, 'Catálogo sem itens.');
    var usaHW = st.calculo.metodo === 'hw';
    var eco = v.ecoAtiva;

    var linhas = v.linhas.map(function (l) {
      var sel = l.rot === conj.itemRot;
      return h('tr', {
        class: l.classe + (sel ? ' selecionada' : ''),
        style: 'cursor:pointer',
        title: l.motivos.join(' · '),
        'data-acao': 'escolherDiametro', 'data-base': base, 'data-rot': l.rot
      },
        h('td', { class: 'esq' },
          l.recomendado ? h('span', { title: 'Sugestão do programa: menor diâmetro que atende aos critérios', style: 'color:var(--teal-vivo)' }, '★ ') : null,
          l.otimoEconomico ? h('span', { title: 'Menor custo anual total (tubo + energia)', style: 'color:var(--verde);font-weight:700' }, '$ ') : null,
          l.rot,
          l.verificar ? h('span', { class: 'tag atencao', style: 'margin-left:5px', title: 'Dimensão a confirmar no catálogo do fabricante' }, '!') : null),
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
        eco ? h('td', {}, UI.tab(l.eco.custoTubo / 1000)) : null,
        eco ? h('td', {}, UI.tab(l.eco.anualEnergia / 1000)) : null,
        eco ? h('td', {}, h('b', {}, UI.tab(l.eco.anualTotal / 1000))) : null,
        h('td', {}, UI.tagClasse(l.classe)));
    });

    var crit = v.crit;
    var cabs = [
      { rot: 'Diâmetro', esq: true }, 'DI (mm)', 'e (mm)', 'PN',
      'v (m/s)', 'J (m/km)', 'hf (m)', 'Σhₗ (m)', 'Total (m)',
      usaHW ? 'C' : 'f', 'Re',
      { rot: 'v c/ 1 bomba', dica: 'Velocidade no trecho quando apenas uma bomba opera. É a condição crítica para a velocidade mínima de autolimpeza, especialmente em linhas de recalque de esgoto (0,6 m/s pela NBR 12208).' }
    ];
    if (eco) {
      cabs.push({ rot: 'Tubo (mil R$)', dica: 'Custo estimado de fornecimento e assentamento do trecho, por lei de potência sobre o DN. Serve para comparar diâmetros entre si, não para orçar.' });
      cabs.push({ rot: 'Energia (mil R$/ano)', dica: 'Custo anual da energia associada à perda de carga deste trecho, com a tarifa e as horas de operação da aba Parâmetros de cálculo.' });
      cabs.push({ rot: 'Total (mil R$/ano)', dica: 'Custo do tubo anualizado pelo fator de recuperação de capital, somado ao custo anual de energia. O menor valor é marcado com $.' });
    }
    cabs.push('Situação');

    return h('div', {},
      h('div', { class: 'nota', style: 'margin-bottom:6px;display:flex;gap:14px;flex-wrap:wrap' },
        h('span', {}, 'Vazão do trecho: ', h('b', {}, UI.num(v.Q * 1000, 1) + ' L/s'),
          ' (', UI.num(v.Q * 3600, 1), ' m³/h)'),
        h('span', {}, 'Critério: v de ', UI.numEdit(crit.vBom[0]), ' a ', UI.numEdit(crit.vBom[1]),
          ' m/s (máx. ', UI.numEdit(crit.vMax), ', mín. ', UI.numEdit(crit.vMin), ') · J de ',
          UI.numEdit(crit.jBom[0]), ' a ', UI.numEdit(crit.jBom[1]), ' m/km (máx. ', UI.numEdit(crit.jMax), ')',
          UI.dica(crit.nota + '\n\nAs faixas são editáveis na aba Parâmetros de cálculo.')),
        h('span', {}, 'Bresse: ', UI.num(v.bresse.k07, 0), ' a ', UI.num(v.bresse.k13, 0), ' mm',
          ' (K = 1,0 → ', UI.num(v.bresse.k10, 0), ' mm)',
          UI.dica('Diâmetro econômico de Bresse D = K·√Q, com K entre 0,7 e 1,3. É apenas uma referência de ordem de grandeza.\n\n' +
                  PDA.H.fontes.filter(function (f) { return f.id === 'bresse'; })[0].txt))),
      UI.tabela(cabs, linhas),
      h('p', { class: 'nota', style: 'margin-top:6px' },
        'Clique em uma linha para adotar o diâmetro. ★ é a sugestão do programa: o menor diâmetro que atende integralmente aos critérios.' +
        (eco ? '  $ marca o de menor custo anual total.' : '')));
  };

  /* ================================================================
     Editor de um conjunto
     ================================================================ */

  F.conjunto = function (st, ctx, conj, op) {
    var base = op.base;
    var caixa = h('div', { class: 'conjunto' });
    var cabecalho = [
      op.arr ? UI.alcaBloco(caixa, op.arr, op.i, op.total) : null,
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
      caixa.className = 'conjunto desativado';
      caixa.appendChild(h('div', { class: 'cab-conj' }, cabecalho));
      return op.arr ? UI.blocoArrastavel(caixa, op.arr, op.i) : caixa;
    }

    var catAtualJ = PDA.CAT.buscar(ctx.cats.todos, conj.catalogoId);
    var juntasFam = catAtualJ ? PDA.CAT.juntas[catAtualJ.familia] : null;
    if (juntasFam && !conj.junta) conj.junta = PDA.CAT.juntaPadrao(catAtualJ);

    var campos = [
      h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Catálogo / material do tubo'),
        F.selectCatalogo(st, ctx.cats, base + '.catalogoId')),
      juntasFam ? UI.select(st, 'Tipo de junta', base + '.junta',
        juntasFam.map(function (j) { return { v: j.id, rot: j.rot }; }),
        { dica: juntasFam.map(function (j) { return j.rot + ' — ' + j.nota; }).join('\n\n') +
          '\n\nA junta define a pressão admissível do CONJUNTO (a PFA da junta travada difere da elástica e varia com o DN — conferir no catálogo do fabricante) e a necessidade de blocos de ancoragem: junta travada transmite o esforço axial e dispensa bloco no trecho travado.' }) : null,
      h('label', { class: 'campo' + (op.adutora ? ' chave' : '') },
        h('span', { class: 'rot' }, 'Diâmetro adotado'),
        F.selectDiametro(st, ctx.cats, conj, base + '.itemRot')),
      UI.campo(st, 'Extensão', base + '.extensao',
        { unid: { grandeza: 'extensao', caminho: base + '.unidExt' }, chave: !!op.adutora })
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
      var pnInfo = PDA.C.pnInfo(conj, tuboAtual);
      var pfaCorpo = PDA.C.pfaCorpoBar(tuboAtual);
      var pnAutoInfo = (function () {                     /* o que o programa adotaria sozinho */
        if (tuboAtual && !tuboAtual.semDiametro && tuboAtual.item && tuboAtual.item.pn) {
          return { mca: Number(tuboAtual.item.pn) * 10, origem: 'catalogo' };
        }
        var aj = PDA.C.pnAutoJunta(conj, tuboAtual);
        return aj ? { mca: aj.mca, origem: 'junta' } : null;
      })();
      corpo.push(UI.sub('Pressão admissível e cotas do trecho'));
      corpo.push(h('div', { class: 'grade' },
        UI.campo(st, 'PN / PFA do tubo (mca)', base + '.pnMcaOverride', {
          chave: pnInfo.mca === null,
          editado: pnInfo.origem === 'informado',
          placeholder: pnAutoInfo ? UI.num(pnAutoInfo.mca, 0) : 'informar',
          dica: 'Pressão de serviço admissível do tubo, em mca, usada para conferir a pressão em regime permanente e a sobrepressão do transitório.\n\n' +
                pnInfo.nota +
                (pnAutoInfo ? '\n\nO campo é preenchido AUTOMATICAMENTE pelo material e pela junta escolhidos — troque o valor se o catálogo do seu fornecedor indicar outro.' : '') +
                (pfaCorpo && pnInfo.origem !== 'junta' ? '\n\nReferência: a resistência do CORPO deste tubo pela EN 545 (PFA = 20·e·σ/(DE−e), σ = ' +
                  PDA.C.SIGMA_ADM[tuboAtual.material] + ' MPa) é de ' + UI.num(pfaCorpo, 0) + ' bar — limite superior; a junta costuma governar.' : '')
        }),
        F.seletorPFA(st, conj, base, tuboAtual, pfaCorpo, pnInfo),
        UI.check(st, 'Informar cotas deste trecho', base + '.usarCotas',
          { dica: 'Serve para traçar o perfil e verificar a pressão em cada nó. A cota final do ÚLTIMO trecho é a mesma "cota de chegada" da aba Bombas e níveis — o programa mantém as duas iguais automaticamente.' }),
        conj.usarCotas ? UI.campo(st, 'Cota inicial (m)', base + '.cotaIni',
          { title: 'Altitude absoluta do início do trecho' }) : null,
        conj.usarCotas ? UI.campo(st, 'Cota final (m)', base + '.cotaFim',
          { title: 'Altitude absoluta do fim do trecho' }) : null));
      if (pnInfo.origem !== 'informado') {
        corpo.push(h('p', { class: 'nota', style: 'margin-top:6px' }, pnInfo.nota));
      }
    }

    corpo.push(UI.sub('Peças e conexões do trecho'));
    corpo.push(F.tabelaPecas(st, ctx, conj, base));
    corpo.push(UI.sub('Comparação de diâmetros'));
    corpo.push(F.varredura(st, ctx, conj, op.chave, base));

    caixa.appendChild(h('div', { class: 'cab-conj' }, cabecalho));
    caixa.appendChild(h('div', { class: 'corpo-conj' }, corpo));
    return op.arr ? UI.blocoArrastavel(caixa, op.arr, op.i) : caixa;
  };

  /* Escolha rápida da pressão admissível — só quando o programa não tem
     como adotar um valor sozinho (junta travada, acoplamento ranhurado,
     catálogo sem PN): serve para informar outro PN em um clique. */
  F.seletorPFA = function (st, conj, base, tubo, pfaCorpo, pnInfo) {
    var temAuto = !!(tubo && !tubo.semDiametro && tubo.item && tubo.item.pn) ||
                  !!PDA.C.pnAutoJunta(conj, tubo);
    if (temAuto) return null;    /* o programa já adota a classe sozinho */
    var opcoes = [{ v: '', rot: '— escolher um degrau —' }].concat(
      PDA.C.DEGRAUS_PFA_BAR.map(function (b) {
        return { v: String(b * 10), rot: 'PN ' + b + ' bar   (' + (b * 10) + ' mca)' };
      }));
    var atual = conj.pnMcaOverride === null || conj.pnMcaOverride === undefined ? '' : String(conj.pnMcaOverride);
    return h('label', { class: 'campo' },
      h('span', { class: 'rot' }, 'Informar um PN usual',
        UI.dica('Para esta combinação de material e junta o programa não adota uma PFA sozinho: em junta travada (JTI/JTE) e em acoplamento ranhurado o valor depende do DN e do fabricante.\n\n' +
                'Esta lista traz os degraus usuais de pressão da EN 545 para escolha rápida — ela NÃO diz qual deles se aplica ao seu DN. Confirme no catálogo do fabricante.' +
                (pfaCorpo ? '\n\nReferência: a resistência do corpo deste tubo pela EN 545 é de ' + UI.num(pfaCorpo, 0) + ' bar — um limite superior, não a PFA do conjunto.' : ''))),
      h('select', { 'data-bind': base + '.pnMcaOverride', 'data-tipo': 'num', 'data-estrutural': '1' },
        opcoes.map(function (o) {
          return h('option', { value: o.v, selected: o.v === atual }, o.rot);
        })));
  };

  /* ================================================================
     ABA: Resumo — entrada rápida do essencial + panorama
     ================================================================ */

  F.abaResumo = function (st, ctx, res) {
    var cen = res.projeto;
    var deCota = ['cotaChegada', 'cotaPartida', 'niveis', 'eixoDistante'];
    var alertaCota = null;
    (res.avisosDados || []).forEach(function (a) {
      if (!alertaCota && deCota.indexOf(a.id) >= 0) alertaCota = a;
    });
    /* o Resumo mostra TODAS as pendências de dados, não só as de cota */
    var outrosAvisos = (res.avisosDados || []).filter(function (a) {
      return a !== alertaCota;
    });

    var entrada = UI.cartao('Dados essenciais',
      'O necessário para o pré-dimensionamento ficar de pé — o resto tem valor padrão',
      [
        h('div', { class: 'grade' },
          UI.campo(st, 'Vazão de projeto', 'vazao.valor',
            { unid: { grandeza: 'vazao', caminho: 'vazao.unidade' }, chave: true }),
          UI.select(st, 'A vazão informada é', 'vazao.base', [
            { v: 'total', rot: 'a vazão total do sistema' },
            { v: 'porBomba', rot: 'a vazão de cada bomba' }
          ], { dica: 'Informando a vazão total, o programa a divide pelo número de bombas em operação. Informando a vazão por bomba, multiplica pelo número em operação.' }),
          UI.select(st, 'Fluido bombeado', 'fluido.tipo',
            R.fluidos.map(function (f) { return { v: f.id, rot: f.rot }; }),
            { chave: true,
              dica: 'Define as faixas de velocidade recomendadas (água ou esgoto) e um agravo na rugosidade por biofilme/sólidos.\n\n' +
                    R.fluidos.map(function (f) { return f.rot + ': ΔC = ' + UI.numEdit(f.dC) + ', Δε = ' + UI.numEdit(f.dEps) + ' mm — ' + f.nota; }).join('\n\n') })),
        h('div', { class: 'grade', style: 'margin-top:11px' },
          UI.campo(st, 'Cota de partida (m)', 'cotas.cotaPartida', {
            chave: true,
            placeholder: UI.numEdit(Number(st.cotas.nivelSuccaoMin) || 0),
            dica: 'ALTITUDE ABSOLUTA da saída da elevatória, onde começa a adutora.\n\nEm branco, o programa usa o nível de sucção mínimo — que é o correto quando a linha piezométrica parte do próprio nível d\'água do poço.\n\nNão é profundidade nem altura em relação ao fundo.'
          }),
          UI.campo(st, 'Cota de chegada (m)', 'cotas.nivelChegada', {
            chave: true,
            dica: 'ALTITUDE ABSOLUTA do FIM da adutora: nível d\'água do reservatório de chegada ou ponto de descarga. Não é a cota da bomba.\n\nA altura geométrica é a diferença entre esta cota e o nível de sucção mínimo.\n\nEste campo e a "cota final" do último trecho da adutora são o mesmo número — o programa mantém os dois iguais.'
          }),
          UI.campo(st, 'Bombas instaladas', 'bombas.instaladas', { sufixo: 'ud' }),
          UI.campo(st, 'Bombas em operação', 'bombas.operando', { sufixo: 'ud', chave: true })),

        h('div', { class: 'faixa-resumo', style: 'margin:13px 0 0' },
          F.chip('Vazão total', UI.num(ctx.qTotal * 1000, 1), 'L/s  ·  ' + UI.num(ctx.qTotal * 3600, 1) + ' m³/h'),
          F.chip('Por bomba', UI.num(ctx.qBomba * 1000, 1), 'L/s'),
          F.chipAlerta('Altura geométrica', UI.num(cen.Hg, 2),
            'm  =  ' + UI.num(st.cotas.nivelChegada, 2) + ' − ' + UI.num(st.cotas.nivelSuccaoMin, 2),
            alertaCota, 'forte'),
          F.chip('Perdas totais', UI.num(cen.hSuccao + cen.hRecalque, 2), 'm'),
          chip('Altura manométrica', UI.num(cen.Hm, 2), 'mca', 'forte')),

        alertaCota ? F.blocoAviso(alertaCota) : null,
        outrosAvisos.map(function (a) { return F.blocoAviso(a); }),

        (st.perfil && st.perfil.ativo && (st.perfil.pontos || []).length > 1 && res.envoltoria)
          ? PDA.Q.caixa('Perfil da linha e envoltória de pressões',
              PDA.Pf.grafico(st, ctx, res),
              'Perfil lançado na aba Perfil da linha, com a linha piezométrica' +
              (res.envoltoria.dh > 0 ? ' e as envoltórias do transitório SEM proteção' : '') +
              '. O esquema simplificado de cotas continua na aba Bombas e níveis.')
          : PDA.Q.caixa('Como o programa entende as cotas',
              PDA.Q.niveisCotas(st, ctx, cen),
              'Os campos de cota pedem ALTITUDE ABSOLUTA, na mesma referência de nível do levantamento — ' +
              'não profundidade nem altura em relação ao fundo do poço.')
      ]);
    entrada.classList.add('destaque');

    return [entrada, F.cartaoPanorama(st, ctx, res)];
  };

  F.blocoAviso = function (a) {
    return h('div', { class: 'aviso' + (a.grave ? ' erro' : ''), style: 'margin-top:11px' },
      h('b', {}, a.grave ? 'Dados incoerentes' : 'Conferir'),
      a.txt,
      (a.acoes && a.acoes.length)
        ? h('div', { class: 'linha naoimprime', style: 'margin-top:8px' },
            a.acoes.map(function (ac) {
              return h('button', { class: 'btn mini', type: 'button', 'data-acao': ac.acao }, ac.rot);
            }))
        : null);
  };

  F.cartaoPanorama = function (st, ctx, res) {
    var cen = res.projeto;
    var todos = cen.succao.map(function (r) { return { r: r, g: 'Sucção' }; })
      .concat(cen.recalque.map(function (r) { return { r: r, g: 'Barrilete' }; }))
      .concat(cen.adutoras.map(function (r) { return { r: r, g: 'Adutora' }; }));

    var somaL = 0, somaHf = 0, somaHl = 0;
    var linhas = todos.map(function (x) {
      var r = x.r;
      somaL += r.L; somaHf += r.hf; somaHl += r.hl;
      var crit = PDA.C.criterioDe(st, ctx, r.conj.tipo || 'adutora');
      var cl = PDA.C.classificar(r.v, r.J, crit);
      return h('tr', { class: cl.classe === 'ruim' ? 'ruim' : null },
        h('td', { class: 'esq' }, x.g),
        h('td', { class: 'esq' }, r.rot),
        h('td', { class: 'esq' }, r.tubo ? r.tubo.cat.nome.split('—')[0].trim() : '—'),
        h('td', { class: 'esq' }, r.tubo && r.tubo.item ? r.tubo.item.rot : '—'),
        h('td', {}, r.tubo ? UI.num(r.tubo.diMm, 1) : '—'),
        h('td', {}, UI.num(r.L, 1)),
        h('td', {}, UI.num(r.Q * 1000, 1)),
        h('td', {}, UI.num(r.v, 2),
          cl.classe === 'ruim' ? h('span', { class: 'sinal', title: cl.motivos.join('; ') }, ' !') : null),
        h('td', {}, UI.tab(r.J * 1000)),
        h('td', {}, UI.tab(r.hf)),
        h('td', {}, UI.tab(r.hl)),
        h('td', {}, h('b', {}, UI.tab(r.htotal))));
    });

    var rodape = h('tr', {},
      h('td', { class: 'esq', colspan: 5 }, 'Total'),
      h('td', {}, UI.num(somaL, 1)),
      h('td', {}, ''), h('td', {}, ''), h('td', {}, ''),
      h('td', {}, UI.tab(somaHf)),
      h('td', {}, UI.tab(somaHl)),
      h('td', {}, UI.tab(somaHf + somaHl)));

    return UI.cartao('Panorama do sistema',
      'Cenário de projeto: ' + ctx.nOp + ' de ' + ctx.nInst + ' bombas em operação', [
      UI.tabela([{ rot: 'Grupo', esq: true }, { rot: 'Trecho', esq: true }, { rot: 'Material', esq: true },
                 { rot: 'Diâmetro', esq: true }, 'DI (mm)', 'L (m)', 'Q (L/s)', 'v (m/s)',
                 'J (m/km)', 'hf (m)', 'Σhₗ (m)', 'Total (m)'], linhas, rodape),
      h('div', { class: 'faixa-resumo', style: 'margin:12px 0 0' },
        F.chip('Extensão total', UI.num(somaL, 1), 'm'),
        F.chip('Altura geométrica', UI.num(cen.Hg, 2), 'm'),
        F.chip('Perda distribuída', UI.num(somaHf, 2), 'm'),
        F.chip('Perda localizada', UI.num(somaHl, 2), 'm'),
        chip('Altura manométrica', UI.num(cen.Hm, 2), 'mca', 'forte'),
        F.chip('BHP por bomba', UI.num(cen.bhpCv, 1), 'cv  (' + UI.num(cen.bhpKw, 1) + ' kW)'),
        chip('Motor por bomba', UI.numEdit(cen.motorCv), 'cv  (' + UI.num(cen.motorKw, 1) + ' kW)', 'forte'),
        F.chip('Potência em operação', UI.num(cen.potTotalKw, 1), 'kW com ' + ctx.nOp + ' conjunto(s)'),
        cen.npshd !== null ? F.chip('NPSH disponível', UI.num(cen.npshd, 2), 'mca') : null)
    ], h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'irAba', 'data-aba': 'resultados' },
      'Ver resultados completos'));
  };

  /* ================================================================
     ABA: Projeto — identificação
     ================================================================ */

  F.abaProjeto = function (st, ctx, res) {
    var fl = R.fluidos.filter(function (f) { return f.id === st.fluido.tipo; })[0];

    return [
      UI.cartao('Identificação do projeto', null, [
        h('div', { class: 'grade g2' },
          UI.campo(st, 'Projeto / obra', 'projeto.nome', { tipo: 'texto' }),
          UI.campo(st, 'Local', 'projeto.local', { tipo: 'texto' }),
          UI.campo(st, 'Responsável técnico', 'projeto.responsavel', { tipo: 'texto' }),
          UI.campo(st, 'Data', 'projeto.data', { tipo: 'texto', placeholder: 'dd/mm/aaaa' })),
        h('div', { style: 'margin-top:11px' },
          h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Observações (entram no memorial)'),
            h('textarea', { rows: 3, 'data-bind': 'projeto.obs', 'data-tipo': 'texto' }, st.projeto.obs || '')))
      ]),

      UI.cartao('Condições do fluido', 'Propriedades físicas que entram no cálculo', [
        h('div', { class: 'grade' },
          UI.select(st, 'Fluido bombeado', 'fluido.tipo',
            R.fluidos.map(function (f) { return { v: f.id, rot: f.rot }; }),
            { dica: 'Define as faixas de velocidade recomendadas e um agravo na rugosidade.' }),
          UI.campo(st, 'Temperatura do fluido', 'fluido.temperatura', { sufixo: '°C',
            dica: 'Afeta a viscosidade cinemática (usada no número de Reynolds e portanto na fórmula universal) e a pressão de vapor (usada no NPSH disponível).' }),
          UI.campo(st, 'Altitude do local', 'fluido.altitude', { sufixo: 'm',
            dica: 'Usada para a pressão atmosférica local no NPSH disponível. Ao nível do mar são 10,33 mca; a cada 1000 m perde-se cerca de 1,2 mca.' })),
        fl ? h('div', { class: 'aviso info' }, h('b', {}, fl.rot), fl.nota) : null,
        h('div', { class: 'faixa-resumo', style: 'margin-top:11px' },
          F.chip('Viscosidade cinemática', UI.num(ctx.ni * 1e6, 3), '×10⁻⁶ m²/s'),
          F.chip('Massa específica', UI.num(ctx.rho, 1), 'kg/m³'),
          F.chip('Peso específico', UI.num(ctx.gama, 0), 'N/m³'),
          F.chip('Pressão atmosférica', UI.num(ctx.patm, 2), 'mca'),
          F.chip('Pressão de vapor', UI.num(ctx.pvapor, 3), 'mca'))
      ], UI.botaoFonte(['tsutiya', 'tsutiya_esgoto'])),

      F.cartaoConferencia(st, ctx, res)
    ];
  };

  F.cartaoConferencia = function (st, ctx, res) {
    var itens = [];
    function item(ok, txt, aba) {
      itens.push(h('li', { style: 'margin-bottom:5px;display:flex;align-items:baseline;gap:6px' },
        h('span', { style: 'color:' + (ok ? 'var(--verde)' : 'var(--ambar)') + ';font-weight:700;flex:none' },
          ok ? '✓' : '!'),
        h('span', {}, txt),
        (!ok && aba) ? h('button', { class: 'btn mini naoimprime', type: 'button', style: 'flex:none',
                                     'data-acao': 'irAba', 'data-aba': aba }, 'abrir') : null));
    }
    item(!!st.projeto.nome, 'Identificação do projeto preenchida');
    item(Number(st.vazao.valor) > 0, 'Vazão de projeto informada', 'resumo');
    item(res.projeto.Hg > 0, 'Cotas de partida e de chegada coerentes (Hg = ' + UI.num(res.projeto.Hg, 2) + ' m)', 'resumo');
    item(st.adutoras.some(function (a) { return a.ativo !== false && a.itemRot && Number(a.extensao) > 0; }),
      'Ao menos um trecho de adutora com diâmetro e extensão', 'adutoras');
    item(!(res.avisosDados || []).some(function (a) { return a.grave; }), 'Sem incoerências graves de dados', 'resumo');
    item(st.adutoras.some(function (a) { return PDA.C.pnMca(a, PDA.C.resolverTubo(a, ctx)) !== null; }),
      'Pressão admissível do tubo conhecida — habilita a verificação de pressão', 'adutoras');
    item(st.perfil.ativo && st.perfil.pontos.length > 1,
      'Perfil da linha lançado — habilita a envoltória de pressões do transitório', 'perfil');
    item(st.curvaBomba.ativo && (st.curvaBomba.pontos || []).length >= 3,
      'Curva da bomba lançada — habilita o ponto de operação real', 'bombas');

    return UI.cartao('Conferência do preenchimento', 'Os três últimos itens são opcionais',
      h('ul', { style: 'margin:0;padding:0;list-style:none' }, itens));
  };

  /* ================================================================
     ABA: Bombas e níveis
     ================================================================ */

  F.abaBombas = function (st, ctx, res) {
    var submersivel = st.bombas.tipo === 'submersivel';
    var cen = res.projeto;
    var avisos = (res.avisosDados || []).filter(function (a) {
      return ['cotaChegada', 'cotaPartida', 'niveis', 'eixoDistante',
              'pontoAlto', 'pontoAltoFolga', 'pontoAltoSemDist', 'pontoAltoDiverge'].indexOf(a.id) >= 0;
    });

    var cartaoCotas = UI.cartao('Níveis e cotas',
      'Todas as cotas são altitudes absolutas, na mesma referência de nível do projeto', [
      PDA.Q.caixa('Onde cada cota entra no desenho', PDA.Q.niveisCotas(st, ctx, cen),
        'Nível de sucção: cota da SUPERFÍCIE DA ÁGUA no poço, no nível mais baixo e no mais alto de operação. ' +
        'Cota do eixo da bomba: altitude do eixo do rotor — abaixo do nível da água, a bomba está afogada. ' +
        'Cota de partida: onde a adutora começa, na saída da elevatória. ' +
        'Cota de chegada: onde a adutora termina — nível d\'água do reservatório de chegada ou ponto de descarga.'),
      h('div', { class: 'grade' },
        UI.campo(st, 'Cota do N.A. de sucção — mínimo', 'cotas.nivelSuccaoMin', {
          chave: true,
          dica: 'ALTITUDE da superfície da água no poço de sucção, no nível mais BAIXO de operação. Gera a maior altura geométrica: é a condição crítica de altura manométrica e de NPSH.\n\nNão é profundidade nem altura em relação ao fundo.' }),
        UI.campo(st, 'Cota do N.A. de sucção — máximo', 'cotas.nivelSuccaoMax', {
          dica: 'ALTITUDE da superfície da água no nível mais ALTO de operação. Gera a menor altura manométrica — o outro extremo da curva do sistema.' }),
        submersivel ? null : UI.campo(st, 'Cota do eixo da bomba', 'cotas.eixoBomba', {
          dica: 'ALTITUDE do eixo do rotor. Usada só no NPSH disponível. Se o eixo está abaixo do nível de sucção, a bomba está afogada e a parcela geométrica ajuda o NPSH.' }),
        UI.campo(st, 'Cota de partida da adutora', 'cotas.cotaPartida', {
          placeholder: UI.numEdit(Number(st.cotas.nivelSuccaoMin) || 0),
          dica: 'ALTITUDE da saída da elevatória, onde a adutora começa. Em branco, usa o nível de sucção mínimo.' }),
        UI.campo(st, 'Cota de chegada', 'cotas.nivelChegada', {
          chave: true,
          dica: 'ALTITUDE do fim da adutora: nível d\'água do reservatório de chegada ou ponto de descarga. NÃO é a cota da bomba.\n\nEste campo e a cota final do último trecho da adutora são o mesmo número — o programa mantém os dois iguais.' }),
        st.perfil.ativo ? null : UI.campo(st, 'Cota do ponto mais alto (m)', 'cotas.cotaPontoAlto', {
          placeholder: 'se for a chegada, deixe em branco',
          dica: 'Preencha quando o ponto mais alto da linha NÃO é a chegada — um morro no meio do traçado, por exemplo. O programa verifica se a linha piezométrica passa acima dele; se não passar, é ele que governa a altura manométrica, não a cota de chegada.\n\nCom o perfil da linha lançado, este campo é dispensado: o ponto alto sai do próprio perfil.' }),
        st.perfil.ativo ? null : UI.campo(st, 'Distância até ele (m)', 'cotas.distPontoAlto', {
          placeholder: 'da elevatória',
          dica: 'Distância da elevatória até o ponto mais alto, medida ao longo da linha. Com ela o programa interpola a linha piezométrica no ponto e calcula a pressão disponível ali. Sem ela, só dá para verificar quando o ponto alto é mais baixo que a chegada.' })),

      (function () {
        var pa = res.pontoAlto;
        if (!pa || pa.fonte !== 'perfil') return null;
        var okP = pa.pPerm !== null && pa.pPerm >= 0;
        return h('div', { class: 'aviso' + (okP ? ' info' : ' erro'), style: 'margin-top:9px' },
          h('b', {}, 'Ponto alto (do perfil da linha): '),
          'cota ' + UI.num(pa.cotaMaxPerfil, 2) + ' m na distância ' + UI.num(pa.xMax, 0) + ' m. ' +
          'Pressão mínima em regime permanente: ' + UI.num(pa.pPerm, 2) + ' mca (cota ' +
          UI.num(pa.cota, 2) + ' m, a ' + UI.num(pa.x, 0) + ' m). ' +
          (okP ? 'A linha piezométrica passa acima de toda a tubulação.'
               : 'A piezométrica passa ABAIXO da tubulação — veja o aviso no Resumo.'));
      })(),

      h('div', { class: 'faixa-resumo', style: 'margin:11px 0 0' },
        chip('Hg máxima', UI.num(cen.HgMax, 2), 'm  (N.A. de sucção mínimo)', 'forte'),
        F.chip('Hg mínima', UI.num(cen.HgMin, 2), 'm  (N.A. de sucção máximo)'),
        submersivel ? null : F.chip('Carga na sucção',
          (cen.zSuccao >= 0 ? '+' : '') + UI.num(cen.zSuccao, 2),
          'm  —  ' + (cen.zSuccao >= 0 ? 'bomba afogada' : 'bomba aspirando')),
        F.chip('Pressão atmosférica', UI.num(ctx.patm, 2), 'mca a ' + UI.num(st.fluido.altitude, 0) + ' m'),
        F.chip('Pressão de vapor', UI.num(ctx.pvapor, 3), 'mca a ' + UI.num(st.fluido.temperatura, 0) + ' °C')),

      avisos.map(function (a) { return F.blocoAviso(a); }),

      cen.HgMax <= 0 ? h('div', { class: 'aviso erro' },
        h('b', {}, 'Altura geométrica nula ou negativa'),
        'A cota de chegada não é superior ao nível de sucção. Em recalque a cota de chegada é a mais alta — ' +
        'confira se os dois campos estão na mesma referência de nível.') : null
    ], UI.botaoFonte(['nbr12214', 'nbr12208']));
    cartaoCotas.classList.add('destaque');

    var out = [
      cartaoCotas,
      UI.cartao('Conjuntos elevatórios', null, [
        h('div', { class: 'grade' },
          UI.campo(st, 'Bombas instaladas', 'bombas.instaladas', { sufixo: 'ud',
            dica: 'Total de conjuntos instalados, incluindo reserva. O programa gera um cenário de cálculo para cada quantidade de 1 até este número.' }),
          UI.campo(st, 'Bombas em operação simultânea', 'bombas.operando', { sufixo: 'ud', chave: true,
            dica: 'Quantidade que opera na condição de projeto. Define o cenário destacado nos resultados e a vazão por bomba.' }),
          UI.select(st, 'Arranjo da bomba', 'bombas.tipo', [
            { v: 'afogada', rot: 'Bomba afogada (nível acima do eixo)' },
            { v: 'succao', rot: 'Bomba com sucção negativa (aspirando)' },
            { v: 'submersivel', rot: 'Bomba submersível (sem barrilete de sucção)' }
          ], { dica: 'No arranjo submersível não existem barriletes de sucção — o programa desativa esses trechos e não calcula NPSH disponível.' }),
          UI.campo(st, 'Rendimento da bomba', 'bombas.rendBomba', { sufixo: '%',
            dica: 'Rendimento hidráulico esperado no ponto de operação. Em pré-dimensionamento usa-se 60 a 75 % para bombas de médio porte e 75 a 85 % para grandes conjuntos. Confirmar na curva do fabricante.' }),
          UI.campo(st, 'Rendimento do motor', 'bombas.rendMotor', { sufixo: '%',
            dica: 'Usado apenas para estimar a potência elétrica consumida (kW na rede). Não altera a potência de eixo nem a escolha do motor.' })),
        h('div', { style: 'margin-top:9px' },
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
        h('div', { class: 'faixa-resumo', style: 'margin:11px 0 0' },
          F.chip('Potência útil', UI.num(cen.potUtilCv, 1), 'cv por bomba'),
          chip('BHP por bomba', UI.num(cen.bhpCv, 1), 'cv  (' + UI.num(cen.bhpKw, 1) + ' kW)', 'forte'),
          chip('Motor comercial', UI.numEdit(cen.motorCv), 'cv  (' + UI.num(cen.motorKw, 1) + ' kW)', 'forte'),
          F.chip('Potência em operação', UI.num(cen.potTotalKw, 1), 'kW com ' + ctx.nOp + ' conjunto(s)')),
        h('p', { class: 'nota', style: 'margin-top:10px' },
          'A operação em paralelo é tratada de forma simplificada: a vazão por bomba é mantida constante e a ' +
          'vazão total cresce proporcionalmente ao número de conjuntos. Para obter o ponto de operação real, ' +
          'lance a curva da bomba no cartão abaixo.')
      ])
    ];

    if (!submersivel) {
      out.push(UI.cartao('NPSH disponível', 'Como o programa chega ao valor', [
        PDA.Q.caixa('Composição do NPSH disponível', PDA.Q.npsh(st, ctx, cen),
          'O NPSH disponível é uma propriedade da INSTALAÇÃO. O NPSH requerido é uma propriedade da BOMBA e vem ' +
          'da curva do fabricante. A instalação é viável quando NPSHd > NPSHr, com folga usual de 0,5 a 1,0 mca.'),
        h('div', { class: 'faixa-resumo', style: 'margin:0' },
          chip('NPSH disponível', UI.num(cen.npshd, 2), 'mca', (cen.npshd !== null && cen.npshd < 3) ? 'alerta' : 'forte'),
          F.chip('Perda na sucção', UI.num(cen.hSuccao, 3), 'm'),
          st.curvaBomba.npshr ? F.chipAlerta('Margem sobre o requerido',
            UI.num((cen.npshd || 0) - Number(st.curvaBomba.npshr), 2), 'mca',
            ((cen.npshd || 0) - Number(st.curvaBomba.npshr)) < 0.5
              ? { grave: ((cen.npshd || 0) - Number(st.curvaBomba.npshr)) < 0,
                  txt: 'Margem insuficiente sobre o NPSH requerido: risco de cavitação. Reduza a perda na sucção ou baixe a cota do eixo da bomba.' }
              : null) : null),
        h('div', { class: 'grade', style: 'margin-top:11px' },
          UI.campo(st, 'NPSH requerido pela bomba (mca)', 'curvaBomba.npshr', {
            placeholder: 'da curva do fabricante',
            dica: 'Se você já tem a curva da bomba, informe o NPSH requerido no ponto de operação para o programa conferir a margem.' })),
        (cen.npshd !== null && cen.npshd < 3) ? h('div', { class: 'aviso' },
          'NPSH disponível de apenas ' + UI.num(cen.npshd, 2) + ' mca. Reduza a perda na sucção (diâmetro maior, ' +
          'menos peças, tubo mais curto) ou baixe a cota do eixo da bomba.') : null
      ], UI.botaoFonte(['nbr12214'])));
    }

    out.push(F.cartaoCurvaBomba(st, ctx, res));
    return out;
  };

  F.cartaoCurvaBomba = function (st, ctx, res) {
    var corpo = [
      UI.check(st, 'Informar a curva da bomba e calcular o ponto de operação real', 'curvaBomba.ativo', {
        dica: 'Com três ou mais pontos (vazão, altura) da curva do fabricante, o programa ajusta H = a₀ + a₁Q + a₂Q² por mínimos quadrados e cruza com a curva do sistema. É assim que se obtém o ponto de operação real — inclusive em paralelo, onde cada bomba entrega menos vazão do que operando isolada.'
      })
    ];

    if (st.curvaBomba.ativo) {
      var pts = st.curvaBomba.pontos || [];
      var linhas = pts.map(function (p, i) {
        return h('tr', {},
          h('td', {}, h('input', { type: 'text', class: 'num', value: UI.numEdit(p.q),
                                   'data-bind': 'curvaBomba.pontos.' + i + '.q', 'data-tipo': 'num', inputmode: 'decimal' })),
          h('td', {}, h('input', { type: 'text', class: 'num', value: UI.numEdit(p.H),
                                   'data-bind': 'curvaBomba.pontos.' + i + '.H', 'data-tipo': 'num', inputmode: 'decimal' })),
          h('td', { class: 'col-x' },
            h('button', { class: 'btn mini icone perigo naoimprime', type: 'button',
                          'data-acao': 'delPontoCurva', 'data-i': i }, '×')));
      });

      corpo.push(h('div', { class: 'grade', style: 'margin-top:11px' },
        UI.select(st, 'Unidade da vazão da curva', 'curvaBomba.unidQ',
          PDA.U.lista('vazao').map(function (u) { return { v: u, rot: u }; }))));
      corpo.push(UI.sub('Pontos da curva (de UMA bomba)'));
      corpo.push(h('div', { class: 'linha naoimprime', style: 'margin-bottom:8px' },
        h('button', { class: 'btn mini', type: 'button', 'data-acao': 'addPontoCurva' }, '+ ponto'),
        h('button', { class: 'btn mini', type: 'button', 'data-acao': 'colarCurva' }, 'Colar da planilha'),
        h('span', { class: 'nota' }, 'Mínimo de 3 pontos. Inclua a altura com vazão nula (shut-off) se tiver.')));
      corpo.push(linhas.length
        ? h('div', { class: 'rolagem', style: 'max-width:430px' }, h('table', { class: 'enxuta' },
            h('thead', {}, h('tr', {},
              h('th', {}, 'Q (' + st.curvaBomba.unidQ + ')'), h('th', {}, 'H (mca)'), h('th', {}, ''))),
            h('tbody', {}, linhas)))
        : h('p', { class: 'vazio' }, 'Sem pontos lançados.'));

      if (res.curvaBomba && res.operacao) {
        if (res.operacao.erro) {
          corpo.push(h('div', { class: 'aviso' }, h('b', {}, 'Não foi possível achar o ponto de operação'), res.operacao.erro));
        } else {
          var op = res.operacao;
          var desvio = Math.abs(op.desvioQ);
          corpo.push(h('div', { class: 'faixa-resumo', style: 'margin-top:11px' },
            chip('Vazão de operação', UI.num(op.qTotal * 1000, 1), 'L/s total', 'forte'),
            F.chip('Por bomba', UI.num(op.qBomba * 1000, 1), 'L/s'),
            chip('Altura de operação', UI.num(op.H, 2), 'mca', 'forte'),
            F.chip('BHP no ponto', UI.num(op.bhpCv, 1), 'cv'),
            F.chipAlerta('Desvio da vazão de projeto',
              (op.desvioQ >= 0 ? '+' : '') + UI.num(op.desvioQ, 1), '%',
              desvio > 10 ? { grave: desvio > 20,
                              txt: 'A vazão de operação difere ' + UI.num(desvio, 0) + ' % da vazão de projeto. ' +
                                   'Reveja a bomba escolhida ou o diâmetro da adutora.' } : null)));
          corpo.push(F.graficoCurvas(st, ctx, res));

          if (res.operacaoPorN && res.operacaoPorN.length > 1) {
            corpo.push(UI.sub('Operação em paralelo'));
            corpo.push(UI.tabela([{ rot: 'Bombas', esq: true }, 'Q total (L/s)', 'Q por bomba (L/s)',
                                  'H (mca)', 'BHP por bomba (cv)',
                                  { rot: 'Ganho de vazão', dica: 'Acréscimo de vazão total ao ligar uma bomba a mais. Em paralelo o ganho é sempre menor que a vazão de uma bomba isolada, porque a altura do sistema sobe com a vazão.' }],
              res.operacaoPorN.map(function (x, i) {
                if (!x.op || x.op.erro) {
                  return h('tr', {}, h('td', { class: 'esq' }, x.n),
                    h('td', { class: 'esq nota', colspan: 5 }, x.op ? x.op.erro : '—'));
                }
                var ant = i > 0 && res.operacaoPorN[i - 1].op && !res.operacaoPorN[i - 1].op.erro
                  ? res.operacaoPorN[i - 1].op.qTotal : 0;
                return h('tr', { class: x.n === ctx.nOp ? 'selecionada' : null },
                  h('td', { class: 'esq' }, x.n + (x.n === ctx.nOp ? ' (projeto)' : '')),
                  h('td', {}, UI.num(x.op.qTotal * 1000, 1)),
                  h('td', {}, UI.num(x.op.qBomba * 1000, 1)),
                  h('td', {}, UI.num(x.op.H, 2)),
                  h('td', {}, UI.num(x.op.bhpCv, 1)),
                  h('td', {}, i === 0 ? '—' : '+' + UI.num((x.op.qTotal - ant) * 1000, 1) + ' L/s'));
              })));
          }
        }
      } else {
        corpo.push(h('p', { class: 'nota', style: 'margin-top:9px' },
          'Lance ao menos 3 pontos para o programa ajustar a curva.'));
      }
    }

    return UI.cartao('Curva da bomba e ponto de operação', 'Opcional', corpo);
  };

  /* gráfico: curva do sistema x curva da bomba */
  F.graficoCurvas = function (st, ctx, res) {
    var SVG = 'http://www.w3.org/2000/svg';
    function sv(t, a, txt) {
      var e = document.createElementNS(SVG, t), k;
      for (k in a) if (a[k] !== null && a[k] !== undefined) e.setAttribute(k, a[k]);
      if (txt !== undefined) e.textContent = txt;
      return e;
    }
    var op = res.operacao, curva = res.curvaBomba;
    var n = ctx.nOp;
    var qMax = Math.max(op.qTotal, ctx.qTotal, curva.qMax * n) * 1.15;
    if (!(qMax > 0)) return h('div');
    var fator = ctx.qTotal > 0 ? qMax / ctx.qTotal : 1;
    var sis = PDA.C.curvaSistema(st, ctx, n, 24, fator);
    var hMax = Math.max(curva.H(0), op.H, res.projeto.Hm) * 1.2;
    if (!(hMax > 0)) return h('div');

    var W = 640, HH = 300, mE = 52, mD = 14, mT = 16, mB = 34;
    var s = sv('svg', { viewBox: '0 0 ' + W + ' ' + HH, class: 'perfil' });
    function px(q) { return mE + q / qMax * (W - mE - mD); }
    function py(hh) { return mT + (1 - hh / hMax) * (HH - mT - mB); }

    var i, nd = 5, hv, qv;
    for (i = 0; i <= nd; i++) {
      hv = hMax * i / nd;
      s.appendChild(sv('line', { class: 'grade-l', x1: mE, x2: W - mD, y1: py(hv), y2: py(hv) }));
      s.appendChild(sv('text', { x: mE - 5, y: py(hv) + 3, 'text-anchor': 'end' }, UI.num(hv, 0)));
    }
    for (i = 0; i <= nd; i++) {
      qv = qMax * i / nd;
      s.appendChild(sv('line', { class: 'grade-l', x1: px(qv), x2: px(qv), y1: mT, y2: HH - mB }));
      s.appendChild(sv('text', { x: px(qv), y: HH - mB + 13, 'text-anchor': 'middle' }, UI.num(qv * 1000, 0)));
    }

    s.appendChild(sv('polyline', { class: 'lp',
      points: sis.map(function (p) { return px(p.q) + ',' + py(p.H); }).join(' ') }));

    var ptsB = [], k, qb;
    for (k = 0; k <= 30; k++) {
      qb = curva.qMax * k / 30;
      ptsB.push(px(qb * n) + ',' + py(curva.H(qb)));
    }
    s.appendChild(sv('polyline', { points: ptsB.join(' '), fill: 'none',
                                   stroke: 'var(--vermelho)', 'stroke-width': 2 }));
    curva.pontos.forEach(function (p) {
      s.appendChild(sv('circle', { cx: px(p.q * n), cy: py(p.H), r: 2.6, fill: 'var(--vermelho)' }));
    });

    s.appendChild(sv('circle', { cx: px(op.qTotal), cy: py(op.H), r: 5, fill: 'none',
                                 stroke: 'var(--teal-vivo)', 'stroke-width': 2.5 }));
    s.appendChild(sv('text', { x: px(op.qTotal) + 8, y: py(op.H) - 5, fill: 'var(--teal)' },
      UI.num(op.qTotal * 1000, 0) + ' L/s · ' + UI.num(op.H, 1) + ' mca'));

    s.appendChild(sv('line', { x1: px(ctx.qTotal), x2: px(ctx.qTotal), y1: mT, y2: HH - mB,
                               stroke: 'var(--texto-3)', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
    s.appendChild(sv('text', { x: px(ctx.qTotal) + 4, y: mT + 11 }, 'vazão de projeto'));

    s.appendChild(sv('text', { x: mE + 6, y: py(res.projeto.Hm) - 5, fill: 'var(--azul)' }, 'curva do sistema'));
    s.appendChild(sv('text', { x: mE + 6, y: py(curva.H(0)) + 13, fill: 'var(--vermelho)' },
      'curva da bomba' + (n > 1 ? ' — ' + n + ' em paralelo' : '')));
    s.appendChild(sv('text', { x: W - mD, y: HH - 4, 'text-anchor': 'end' }, 'vazão total (L/s)'));
    s.appendChild(sv('text', { x: 4, y: mT + 9 }, 'H (mca)'));

    return h('div', { style: 'margin-top:11px' }, s,
      h('p', { class: 'nota' },
        'A curva do sistema é a altura manométrica em função da vazão, com os diâmetros e as peças lançados. ' +
        'A curva da bomba está plotada na escala de vazão TOTAL' +
        (n > 1 ? ': com ' + n + ' bombas em paralelo, cada vazão da curva individual foi multiplicada por ' + n : '') + '. ' +
        'O cruzamento é o ponto de operação real.'));
  };

  /* ================================================================
     ABA: Sucção
     ================================================================ */

  F.abaSuccao = function (st, ctx) {
    if (st.bombas.tipo === 'submersivel') {
      return [UI.cartao('Sucção', null, h('div', { class: 'aviso info' },
        h('b', {}, 'Arranjo submersível'),
        'Bombas submersíveis não têm barrilete de sucção individual nem comum — a entrada é o próprio corpo da bomba. ' +
        'Troque o arranjo na aba Bombas e níveis se precisar lançar trechos de sucção.'))];
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
              'Sem sucção individual, as perdas de sucção só vêm do barrilete comum (se houver). ' +
              'A perda na sucção entra no NPSH disponível.')
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
        PDA.Q.caixa('Como os trechos se dividem', PDA.Q.barrilete(st, ctx),
          'Cada trecho do barrilete comum conduz a vazão das bombas que ele já reuniu: informe 1, 2, 3… ' +
          'no campo "bombas que o trecho coleta" de cada um.'),
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
      bloco.ativo ? h('div', { class: 'linha naoimprime', style: 'margin-bottom:9px' },
        h('button', { class: 'btn primario', type: 'button', 'data-acao': acaoAdd },
          '+ Adicionar trecho')) : null,
      bloco.ativo ? bloco.trechos.map(function (t, i) {
        return F.conjunto(st, ctx, t, {
          base: chave + '.trechos.' + i, chave: chave + '.' + i,
          tituloEditavel: true, removivel: true, ativavel: true,
          acaoRemover: acaoDel, i: i, nBombas: true,
          arr: chave + '.trechos', total: bloco.trechos.length
        });
      }) : null
    ];
    return UI.cartao(titulo, sub, corpo);
  };

  /* ================================================================
     ABA: Adutoras / linhas de recalque
     ================================================================ */

  F.abaAdutoras = function (st, ctx, res) {
    var avisos = (res.avisosDados || []).filter(function (a) {
      return a.id === 'cotaChegada' || a.id === 'cotaPartida';
    });

    return [
      UI.cartao('Adutora / linha de recalque',
        st.adutoras.length + (st.adutoras.length === 1 ? ' trecho' : ' trechos'), [
        PDA.Q.caixa('Trechos em série e ramificação', PDA.Q.ramificacao(st, ctx),
          'Os trechos são calculados em série, na ordem da lista, e as perdas de todos somam-se na altura manométrica. ' +
          'Quando a linha se ramifica, reduza a fração de vazão do trecho a jusante da derivação e escolha um diâmetro menor.'),
        avisos.map(function (a) { return F.blocoAviso(a); }),
        h('div', { class: 'linha naoimprime', style: 'margin-bottom:11px' },
          h('button', { class: 'btn primario', type: 'button', 'data-acao': 'addAdutora' },
            '+ Adicionar trecho'),
          h('button', { class: 'btn', type: 'button', 'data-acao': 'duplicarAdutora' },
            'Duplicar o último')),
        st.adutoras.map(function (a, i) {
          return F.conjunto(st, ctx, a, {
            base: 'adutoras.' + i, chave: 'adutoras.' + i,
            tituloEditavel: true, removivel: st.adutoras.length > 1, ativavel: true,
            acaoRemover: 'delAdutora', i: i, adutora: true,
            arr: 'adutoras', total: st.adutoras.length
          });
        })
      ])
    ];
  };

  /* Dados de entrada da pré-avaliação do golpe. É mostrado na aba
     Transitório e proteção (era a parte de baixo da aba Adutora). */
  F.cartaoGolpeEntrada = function (st, ctx, res) {
    var anc = PDA.H.ancoragem.filter(function (a) { return a.id === (st.golpe.ancoragem || 'juntas'); })[0];
    return UI.cartao('Transitório hidráulico — dados de entrada',
      'Pré-avaliação para conferir a classe de pressão do tubo', [
      UI.check(st, 'Avaliar golpe de aríete', 'golpe.avaliar', {
        dica: 'Cálculo preliminar por Joukowsky (manobra rápida) e Michaud/Allievi (manobra lenta), para verificar se a classe de pressão do tubo tem folga.'
      }),
      st.golpe.avaliar ? h('div', {},
        PDA.Q.caixa('O que a pré-avaliação calcula', PDA.Q.golpe(),
          'O programa calcula a celeridade da onda no tubo escolhido, compara o tempo de manobra informado com o ' +
          'tempo crítico 2L/a para saber se a manobra é rápida ou lenta, e obtém a sobrepressão Δh. ' +
          'A pressão de conferência é a altura manométrica somada a Δh. Com o perfil da linha lançado na aba ' +
          'Perfil, o programa traça as duas envoltórias ponto a ponto e acusa também a subpressão.'),
        h('div', { class: 'grade' },
          UI.campo(st, 'Tempo de manobra / parada', 'golpe.tempoManobra', { sufixo: 's',
            dica: 'Tempo de fechamento da válvula ou de parada do conjunto. Se for menor que o tempo crítico 2L/a, a manobra é rápida e vale a sobrepressão integral de Joukowsky. Se for maior, aplica-se a fórmula de manobra lenta (Michaud/Allievi), que dá um valor menor.' }),
          UI.select(st, 'Ancoragem longitudinal do tubo', 'golpe.ancoragem',
            PDA.H.ancoragem.map(function (a) { return { v: a.id, rot: a.rot }; }),
            { dica: PDA.H.ancoragem.map(function (a) { return a.rot + '\n' + a.nota; }).join('\n\n') + '\n\n' +
                    PDA.H.fontes.filter(function (f) { return f.id === 'ancoragem'; })[0].txt }),
          st.golpe.ancoragem === 'manual'
            ? UI.campo(st, 'Coeficiente ψ', 'golpe.psi',
                { dica: 'ψ multiplica o termo D/(eE) na celeridade. Valores maiores reduzem a celeridade.' })
            : h('div', { class: 'chip' }, h('span', { class: 'rot' }, 'ψ resultante'),
                h('span', { class: 'val' },
                  res.golpe && res.golpe.length ? UI.num(res.golpe[0].psi, 3) : '—'),
                h('span', { class: 'nota' }, anc ? anc.rot : ''))),
        h('div', { class: 'aviso' },
          h('b', {}, 'Tubulação sem dispositivos de proteção'),
          'A pré-avaliação calcula o transitório da tubulação NUA: não considera tanque de alívio (TAU), chaminé ' +
          'de equilíbrio, válvula antecipadora de onda, ventosa de duplo efeito nem volante de inércia. ' +
          'Se a sobrepressão estourar a classe do tubo, o caminho usual não é engrossar a parede — é dimensionar ' +
          'a proteção, logo abaixo nesta aba; o dimensionamento final exige a modelagem do transitório pelo ' +
          'método das características.')) : null
    ], UI.botaoFonte(['nbr12215']));
  };

  /* ================================================================
     ABA: Parâmetros de cálculo
     ================================================================ */

  F.abaParametros = function (st, ctx) {
    return [
      h('div', { class: 'aviso info' },
        h('b', {}, 'Estes campos já vêm com valor padrão'),
        'Nada aqui precisa ser preenchido para o pré-dimensionamento funcionar. São os parâmetros de cálculo: ' +
        'fórmula de perda de carga, faixas que definem as cores, custos para a análise econômica e a linha de ' +
        'motores. Mexa quando precisar reproduzir outra referência ou ajustar um critério.'),

      UI.cartao('Fórmula de perda de carga', null, [
        h('div', { class: 'grade' },
          UI.select(st, 'Fórmula adotada', 'calculo.metodo', [
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
        UI.sub('Constantes de Hazen-Williams'),
        h('p', { class: 'nota', style: 'margin-bottom:8px' },
          'J = k · Q^a · C^−a · D^−b, com J em m/m, Q em m³/s e D em m. Só afetam o cálculo quando a fórmula ' +
          'selecionada é Hazen-Williams. Os valores padrão reproduzem o Manual de Hidráulica; as planilhas de ' +
          'origem usavam 10,646 e 4,87, com diferença inferior a 0,1 %.'),
        h('div', { class: 'grade g4' },
          UI.campo(st, 'Constante k', 'calculo.hwK'),
          UI.campo(st, 'Expoente da vazão a', 'calculo.hwExpQ'),
          UI.campo(st, 'Expoente do diâmetro b', 'calculo.hwExpD'))
      ], UI.botaoFonte(['tsutiya'])),

      F.cartaoCriterios(st, ctx),
      F.cartaoEconomia(st, ctx),

      UI.cartao('Motores comerciais', null, [
        h('p', { class: 'nota' }, PDA.P.fonteMotores),
        h('p', { class: 'mono', style: 'margin-top:8px' },
          st.bombas.motores.map(function (m) { return UI.numEdit(m); }).join('  ·  ') + '   cv'),
        h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'editarMotores', style: 'margin-top:8px' },
          'Editar linha de motores')
      ])
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

  F.cartaoEconomia = function (st, ctx) {
    var corpo = [
      UI.check(st, 'Comparar diâmetros também pelo custo (tubo + energia)', 'economia.ativo', {
        dica: 'Acrescenta três colunas à tabela de comparação de diâmetros dos trechos de adutora: custo do tubo, custo anual da energia associada à perda de carga daquele trecho, e custo anual total. O diâmetro de menor custo total é marcado com $.'
      })
    ];
    if (st.economia.ativo) {
      corpo.push(h('div', { class: 'grade', style: 'margin-top:11px' },
        UI.campo(st, 'Tarifa de energia', 'economia.tarifa', { sufixo: 'R$/kWh',
          dica: 'Entra só na coluna "Energia (mil R$/ano)" da comparação de diâmetros — o custo anual da perda de carga. Se a coluna do tubo estiver muito maior que a de energia, mudar a tarifa quase não move o total: confira os coeficientes de custo do tubo logo abaixo, com a tabela de conferência em R$/m.' }),
        UI.campo(st, 'Horas de operação por dia', 'economia.horasDia', { sufixo: 'h/dia' }),
        UI.campo(st, 'Horizonte de análise', 'economia.anos', { sufixo: 'anos' }),
        UI.campo(st, 'Taxa de desconto', 'economia.taxa', { sufixo: '% a.a.',
          dica: 'Usada no fator de recuperação de capital, que anualiza o custo do tubo: CRF = i(1+i)ⁿ/[(1+i)ⁿ−1].' })));
      corpo.push(UI.sub('Custo do tubo'));
      corpo.push(h('div', { class: 'grade' },
        UI.campo(st, 'Coeficiente A', 'economia.custoA', {
          dica: 'O custo por metro é estimado por custo = A · DN^B, com DN em mm. Ajuste A e B para que o custo caia na ordem de grandeza dos seus preços — o que define o ponto de mínimo é a forma da curva, não o valor absoluto.' }),
        UI.campo(st, 'Expoente B', 'economia.custoB', {
          dica: 'Expoente da lei de potência. Entre 1,1 e 1,3 o custo cresce quase linearmente com o DN (usual para fornecimento + assentamento); acima de 1,4 o tubo domina a comparação e o ótimo econômico desce de diâmetro.' }),
        UI.campo(st, 'Acréscimo de assentamento', 'economia.custoInstalacao', { sufixo: '%',
          dica: 'Percentual sobre o custo do tubo para cobrir escavação, assentamento, reaterro e conexões.' })));

      var ex = [200, 300, 400, 500, 600, 800].map(function (dn) {
        var base = (Number(st.economia.custoA) || 0) * Math.pow(dn, Number(st.economia.custoB) || 1.2);
        return h('tr', {}, h('td', { class: 'esq' }, 'DN ' + dn),
          h('td', {}, UI.num(base, 2)),
          h('td', {}, UI.num(base * (1 + (Number(st.economia.custoInstalacao) || 0) / 100), 2)));
      });
      corpo.push(h('div', { style: 'margin-top:9px;max-width:430px' },
        UI.tabela([{ rot: 'Diâmetro', esq: true }, 'Tubo (R$/m)', 'Com assentamento (R$/m)'], ex)));
      corpo.push(h('div', { class: 'aviso' },
        h('b', {}, 'Serve para comparar, não para orçar'),
        'A lei de potência dá a tendência de crescimento do custo com o diâmetro, que é o que define o ponto de ' +
        'mínimo. Para orçamento, use os preços do seu banco de dados (SINAPI, SICRO, tabela da concessionária) ' +
        'ou cotação. A energia considerada é apenas a parcela associada à perda de carga do trecho — a energia da ' +
        'altura geométrica é a mesma para qualquer diâmetro e não influencia a escolha.'));
    }
    return UI.cartao('Análise econômica de diâmetro', 'Opcional', corpo, UI.botaoFonte(['tsutiya']));
  };

  PDA.F = F;
  PDA.F.init = init;
})(window.PDA = window.PDA || {});
