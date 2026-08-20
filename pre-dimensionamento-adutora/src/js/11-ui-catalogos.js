/* ------------------------------------------------------------------
 * Aba de catálogos (consulta, cadastro, importação/exportação)
 * e aba de fontes.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var K = {};
  var UI = PDA.UI, h;

  K.init = function () { h = UI.h; };
  K.selecionado = null;

  /* ================================================================
     Consulta
     ================================================================ */

  K.aba = function (st, ctx) {
    var cats = ctx.cats;
    var id = K.selecionado || (cats.todos[0] && cats.todos[0].id);
    var cat = PDA.CAT.buscar(cats.todos, id);
    var grupos = PDA.CAT.porFamilia(cats.todos);
    var doUsuario = cats.usuario.some(function (c) { return c.id === id; });

    var seletor = h('select', {
      style: 'max-width:420px',
      onchange: function (e) { K.selecionado = e.target.value; PDA.App.render(); }
    }, Object.keys(grupos).map(function (fam) {
      return h('optgroup', { label: fam }, grupos[fam].map(function (c) {
        return h('option', { value: c.id, selected: c.id === id },
          c.nome + (cats.usuario.indexOf(c) >= 0 ? '  ★' : ''));
      }));
    }));

    var corpo = [
      h('div', { class: 'linha', style: 'margin-bottom:11px' },
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Catálogo'), seletor),
        h('button', { class: 'btn primario naoimprime', type: 'button', 'data-acao': 'novoCatalogo' }, '+ Novo catálogo'),
        h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'duplicarCatalogo', 'data-id': id }, 'Duplicar para editar'),
        doUsuario ? h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'editarCatalogo', 'data-id': id }, 'Editar') : null,
        doUsuario ? h('button', { class: 'btn perigo naoimprime', type: 'button', 'data-acao': 'excluirCatalogo', 'data-id': id }, 'Excluir') : null,
        h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'exportarCatalogos' }, 'Exportar meus catálogos'),
        h('button', { class: 'btn naoimprime', type: 'button', 'data-acao': 'importarCatalogos' }, 'Importar catálogos'))
    ];

    if (cat) corpo.push(K.detalhe(cat, doUsuario));

    return [
      UI.cartao('Catálogos de tubos',
        cats.todos.length + ' catálogos (' + cats.usuario.length + ' cadastrados por você)', corpo),
      K.cartaoResumoFamilias(cats)
    ];
  };

  K.detalhe = function (cat, doUsuario) {
    var linhas = cat.itens.map(function (it) {
      var di = PDA.CAT.diInterno(cat, it);
      return h('tr', {},
        h('td', { class: 'esq' }, it.rot,
          it.calc ? h('span', { class: 'tag cinza', style: 'margin-left:5px', title: 'Espessura calculada por fórmula normativa' }, 'calc') : null,
          it.verificar ? h('span', { class: 'tag atencao', style: 'margin-left:5px', title: 'Confirmar no catálogo do fabricante' }, 'conferir') : null),
        h('td', {}, it.dn ? UI.num(it.dn, it.dn % 1 ? 1 : 0) : '—'),
        h('td', {}, it.de ? UI.num(it.de, 1) : '—'),
        h('td', {}, it.e ? UI.num(it.e, 1) : '—'),
        h('td', {}, h('b', {}, UI.num(di, 1))),
        h('td', {}, it.pn ? UI.numEdit(it.pn) : '—'),
        h('td', {}, UI.num(Math.PI * Math.pow(di / 1000, 2) / 4 * 1e4, 2)));
    });

    return h('div', {},
      h('div', { class: 'grade', style: 'margin-bottom:10px' },
        PDA.F.chip('Família', cat.familia, ''),
        PDA.F.chip('Material (rugosidade)', (PDA.R.materiais[cat.material] || {}).rot || cat.material, ''),
        PDA.F.chip('Designação comercial', cat.designacao, ''),
        PDA.F.chip('Itens', String(cat.itens.length), 'diâmetros'),
        cat.revMm ? PDA.F.chip('Revestimento interno', UI.num(cat.revMm, 1), 'mm (desconta do DI)') : null,
        doUsuario ? PDA.F.chip('Origem', 'Cadastrado por você', '') : PDA.F.chip('Origem', 'Base do programa', '')),
      cat.nota ? h('div', { class: 'aviso info' }, cat.nota) : null,
      cat.fonteIds && cat.fonteIds.length
        ? h('div', { style: 'margin-bottom:9px' }, UI.botaoFonte(cat.fonteIds))
        : (cat.fonteTexto ? h('div', { class: 'nota-fonte', style: 'margin-bottom:9px' }, 'Fonte informada: ' + cat.fonteTexto) : null),
      UI.tabela([{ rot: 'Designação', esq: true }, 'DN', 'DE (mm)', 'e (mm)',
                 { rot: 'DI (mm)', title: 'DI = DE − 2e − 2×revestimento, ou o valor informado diretamente' },
                 'PN (bar)', 'Área (cm²)'], linhas),
      h('p', { class: 'nota', style: 'margin-top:7px' },
        'O DI é o diâmetro que entra no cálculo hidráulico. Para tubos de concreto e PRFV o DN já é o diâmetro interno.'));
  };

  K.cartaoResumoFamilias = function (cats) {
    var g = PDA.CAT.porFamilia(cats.todos);
    var linhas = Object.keys(g).map(function (fam) {
      var itens = 0, dnMin = Infinity, dnMax = -Infinity;
      g[fam].forEach(function (c) {
        itens += c.itens.length;
        c.itens.forEach(function (i) {
          var d = PDA.CAT.diInterno(c, i);
          dnMin = Math.min(dnMin, d); dnMax = Math.max(dnMax, d);
        });
      });
      return h('tr', {},
        h('td', { class: 'esq' }, fam),
        h('td', {}, g[fam].length),
        h('td', {}, itens),
        h('td', {}, UI.num(dnMin, 1)),
        h('td', {}, UI.num(dnMax, 1)),
        h('td', { class: 'esq' }, (PDA.R.materiais[g[fam][0].material] || {}).rot || '—'));
    });
    return UI.cartao('Cobertura da base de catálogos', null,
      UI.tabela([{ rot: 'Família', esq: true }, 'Catálogos', 'Diâmetros', 'DI mínimo (mm)', 'DI máximo (mm)',
                 { rot: 'Material de rugosidade', esq: true }], linhas));
  };

  /* ================================================================
     Cadastro / edição
     ================================================================ */

  K.modalCatalogo = function (st, ctx, existente, baseParaDuplicar) {
    var cat = existente ? PDA.E.clone(existente) : (baseParaDuplicar ? PDA.E.clone(baseParaDuplicar) : {
      id: '', nome: '', familia: 'Outros', material: 'pvc', designacao: 'DN',
      revMm: 0, nota: '', fonteTexto: '', itens: []
    });
    if (!existente) {
      cat.id = 'usr_' + Math.random().toString(36).slice(2, 9);
      if (baseParaDuplicar) cat.nome = baseParaDuplicar.nome + ' (cópia)';
      cat.fonteIds = null;
      if (baseParaDuplicar && baseParaDuplicar.fonteIds) {
        cat.fonteTexto = 'Derivado do catálogo "' + baseParaDuplicar.nome + '" da base do programa.';
      }
    }

    var campos = {};
    function inp(rot, prop, tipo, dica, placeholder) {
      var i = h('input', { type: 'text', value: cat[prop] === null || cat[prop] === undefined ? '' : cat[prop],
                           class: tipo === 'num' ? 'num' : '', placeholder: placeholder || null });
      campos[prop] = { el: i, tipo: tipo };
      return h('label', { class: 'campo' }, h('span', { class: 'rot' }, rot, dica ? UI.dica(dica) : null), i);
    }
    function sel(rot, prop, opcoes, dica) {
      var s = h('select', {}, opcoes.map(function (o) {
        return h('option', { value: o.v, selected: String(o.v) === String(cat[prop]) }, o.rot);
      }));
      campos[prop] = { el: s, tipo: 'texto' };
      return h('label', { class: 'campo' }, h('span', { class: 'rot' }, rot, dica ? UI.dica(dica) : null), s);
    }

    var modo = h('select', {}, [
      h('option', { value: 'de_e' }, 'DN, DE e espessura (o programa calcula o DI)'),
      h('option', { value: 'di' }, 'DN e DI direto (concreto, PRFV, tubo já com DI conhecido)')
    ]);

    var area = h('textarea', {
      rows: 9, style: 'font-family:var(--mono);font-size:12px',
      placeholder: '100\t118\t4,8\t10\n150\t170\t6,8\t10\n200\t222\t8,9\t10'
    }, cat.itens.length ? cat.itens.map(function (i) {
      return [i.dn, i.de || '', i.e || '', i.pn || ''].join('\t');
    }).join('\n') : '');

    var preview = h('div', { class: 'nota' }, cat.itens.length ? cat.itens.length + ' itens carregados.' : 'Cole a tabela e clique em Interpretar.');

    function interpretar() {
      var linhas = area.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      var itens = [], erros = [];
      var m = modo.value;
      linhas.forEach(function (l, k) {
        /* separadores de coluna: tabulação, ponto e vírgula, barra vertical ou
           espaços. A vírgula NÃO separa colunas — é o separador decimal. */
        var p = l.split(/[\t;|]+|\s+/).map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
        var n = p.map(UI.parseNum);
        if (m === 'di') {
          if (n[0] === null || n[1] === null) { erros.push('linha ' + (k + 1)); return; }
          itens.push({ rot: 'DN ' + p[0], dn: n[0], di: n[1], pn: n[2] || null });
        } else {
          if (n[0] === null || n[1] === null || n[2] === null) { erros.push('linha ' + (k + 1)); return; }
          if (n[1] - 2 * n[2] <= 0) { erros.push('linha ' + (k + 1) + ' (DI não positivo)'); return; }
          itens.push({ rot: (cat.designacao === 'DE' ? 'DE ' : (cat.designacao === 'NPS' ? '' : 'DN ')) + p[0],
                       dn: n[0], de: n[1], e: n[2], pn: n[3] || null });
        }
      });
      cat.itens = itens;
      UI.limpar(preview);
      UI.add(preview, itens.length + ' itens interpretados.' + (erros.length ? '  Não foi possível ler: ' + erros.join(', ') + '.' : ''));
      if (erros.length) preview.className = 'aviso'; else preview.className = 'aviso ok';
    }

    var conteudo = [
      h('div', { class: 'grade g2' },
        inp('Nome do catálogo', 'nome', 'texto', null, 'Ex.: PVC-O classe 500 — Fabricante X'),
        inp('Família (agrupa no seletor)', 'familia', 'texto', 'Catálogos da mesma família aparecem juntos no seletor de tubos.', 'Ex.: PVC-O'),
        sel('Material para rugosidade', 'material',
          PDA.R.listaMateriais().map(function (m) { return { v: m.id, rot: m.rot }; }),
          'Define os coeficientes C e ε sugeridos por faixa de idade para os tubos deste catálogo.'),
        sel('Designação comercial', 'designacao', [
          { v: 'DN', rot: 'DN (diâmetro nominal)' },
          { v: 'DE', rot: 'DE (diâmetro externo, caso do PEAD)' },
          { v: 'NPS', rot: 'NPS (polegadas, caso do aço)' }
        ]),
        inp('Revestimento interno (mm)', 'revMm', 'num',
          'Espessura do revestimento interno que reduz o diâmetro hidráulico (argamassa de cimento, epóxi espesso). Deixe 0 quando a espessura de parede informada já resultar no DI útil.')),
      h('div', { class: 'grade g2', style: 'margin-top:11px' },
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Observação (aparece junto ao catálogo)'),
          (function () { var t = h('textarea', { rows: 2 }, cat.nota || ''); campos.nota = { el: t, tipo: 'texto' }; return t; })()),
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Fonte da informação'),
          (function () {
            var t = h('textarea', { rows: 2, placeholder: 'Ex.: Catálogo técnico Fabricante X, rev. 03/2025, pág. 12' }, cat.fonteTexto || '');
            campos.fonteTexto = { el: t, tipo: 'texto' }; return t;
          })())),

      UI.sub('Tabela de diâmetros'),
      h('div', { class: 'linha', style: 'margin-bottom:8px' },
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Formato das colunas'), modo),
        h('button', { class: 'btn', type: 'button', onclick: interpretar }, 'Interpretar')),
      h('p', { class: 'nota' },
        'Cole direto de uma planilha ou digite uma linha por diâmetro. As colunas podem estar separadas por ' +
        'tabulação, ponto e vírgula ou espaços. Aceita vírgula ou ponto como separador decimal. ' +
        'A quarta coluna (PN, em bar) é opcional e habilita a verificação de pressão.'),
      area,
      preview
    ];

    var botoes = [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button',
        onclick: function () {
          Object.keys(campos).forEach(function (k) {
            var c = campos[k];
            cat[k] = c.tipo === 'num' ? (UI.parseNum(c.el.value) || 0) : c.el.value;
          });
          if (!cat.nome) { UI.toast('Informe o nome do catálogo.'); return; }
          if (area.value.trim() && !cat.itens.length) interpretar();
          if (!cat.itens.length) { UI.toast('Nenhum diâmetro interpretado — clique em Interpretar.'); return; }
          cat.itens.forEach(function (i) { i.verificar = true; });
          var lista = ctx.cats.usuario.filter(function (c) { return c.id !== cat.id; });
          lista.push(cat);
          PDA.App.gravarCatalogos(lista);
          K.selecionado = cat.id;
          UI.fecharModal();
          UI.toast('Catálogo "' + cat.nome + '" salvo com ' + cat.itens.length + ' diâmetros.');
          PDA.App.render();
        }
      }, existente ? 'Salvar alterações' : 'Salvar catálogo')
    ];

    UI.modal(existente ? 'Editar catálogo' : 'Novo catálogo de tubos', conteudo, botoes);
  };

  /* ================================================================
     Aba de fontes
     ================================================================ */

  K.abaFontes = function (st, ctx) {
    var R = PDA.R;

    var normas = Object.keys(R.fontes).map(function (id) {
      var f = R.fontes[id];
      return { id: id, f: f };
    }).sort(function (a, b) {
      if (a.f.tipo === b.f.tipo) return a.f.titulo.localeCompare(b.f.titulo);
      return a.f.tipo.localeCompare(b.f.tipo);
    });

    var porTipo = {};
    normas.forEach(function (n) {
      if (!porTipo[n.f.tipo]) porTipo[n.f.tipo] = [];
      porTipo[n.f.tipo].push(n);
    });

    var blocosNormas = Object.keys(porTipo).map(function (tipo) {
      return h('div', {}, UI.sub(tipo), porTipo[tipo].map(function (n) {
        return h('div', { class: 'fonte-item' },
          h('h4', {}, n.f.titulo),
          h('p', {}, n.f.detalhe));
      }));
    });

    var tabRug = [];
    Object.keys(R.materiais).forEach(function (mid) {
      var m = R.materiais[mid];
      R.faixasIdade.forEach(function (fx, k) {
        tabRug.push(h('tr', {},
          k === 0 ? h('td', { class: 'esq', rowspan: R.faixasIdade.length }, m.rot) : null,
          h('td', { class: 'esq' }, fx.rot),
          h('td', {}, UI.numEdit(m.hw[fx.id][0]) + ' – ' + UI.numEdit(m.hw[fx.id][1])),
          h('td', {}, h('b', {}, UI.numEdit(m.hw[fx.id][2]))),
          h('td', {}, UI.numEdit(m.eps[fx.id][0]) + ' – ' + UI.numEdit(m.eps[fx.id][1])),
          h('td', {}, h('b', {}, UI.numEdit(m.eps[fx.id][2]))),
          k === 0 ? h('td', { class: 'esq', rowspan: R.faixasIdade.length },
            (m.fontes || []).map(function (fid) {
              return h('div', {}, h('button', {
                class: 'btn mini naoimprime', type: 'button',
                onclick: function () { UI.modalFontes([fid], m.nota); }
              }, (R.fontes[fid] || {}).titulo ? R.fontes[fid].titulo.split('—')[0].trim() : fid));
            })) : null));
      });
    });

    var tabPecas = PDA.P.pecas.map(function (p) {
      return h('tr', {},
        h('td', { class: 'esq' }, p.rot),
        h('td', { class: 'esq' }, p.cat),
        h('td', {}, UI.numEdit(p.K)),
        h('td', { class: 'esq nota' }, PDA.P.fontePecas[p.origem]));
    });

    return [
      UI.cartao('Como ler esta aba', null, h('div', {}, [
        h('p', {}, 'Todos os coeficientes, dimensões e critérios usados pelo programa estão listados aqui com a ' +
          'respectiva origem. Onde um valor vem de fórmula normativa, isso está indicado; onde vem de tabela de ' +
          'fabricante, o catálogo está identificado.'),
        h('div', { class: 'aviso' },
          h('b', {}, 'Responsabilidade técnica'),
          'As faixas de coeficientes são as consagradas na literatura e nas normas citadas, mas a escolha do valor ' +
          'de projeto é do engenheiro responsável. Onde houver medição em campo, norma da concessionária ou ' +
          'especificação de fabricante, esses prevalecem sobre os valores sugeridos — e todos os campos são editáveis para isso.')
      ])),

      UI.cartao('Fórmulas', null,
        h('div', {}, PDA.H.fontes.map(function (f) {
          return h('div', { class: 'fonte-item' }, h('p', { style: 'margin:0' }, f.txt));
        }))),

      UI.cartao('Coeficientes de rugosidade por material e idade',
        'C de Hazen-Williams e rugosidade absoluta ε (mm) — em negrito o valor sugerido', [
        UI.tabela([{ rot: 'Material', esq: true }, { rot: 'Idade / condição', esq: true },
                   'Faixa de C', 'C sugerido', 'Faixa de ε (mm)', 'ε sugerido',
                   { rot: 'Fonte', esq: true }], tabRug),
        h('p', { class: 'nota', style: 'margin-top:8px' },
          'Os valores sugeridos ainda recebem o ajuste do fluido selecionado (biofilme em esgoto, sólidos em água bruta). ' +
          'Consulte a dica do campo "Fluido bombeado" na aba Projeto para ver os ajustes aplicados.')
      ]),

      UI.cartao('Coeficientes K das peças', null, [
        UI.tabela([{ rot: 'Peça', esq: true }, { rot: 'Grupo', esq: true }, 'K',
                   { rot: 'Origem', esq: true }], tabPecas)
      ]),

      UI.cartao('Normas e literatura citadas', null, blocosNormas),

      UI.cartao('Divergências corrigidas em relação às planilhas de origem',
        'Registro de auditoria dos dados importados', [
        h('p', { class: 'nota', style: 'margin-bottom:9px' },
          'Ao transportar os dados das duas planilhas, os pontos abaixo não fechavam com as séries normativas ' +
          'ou com a própria formulação. Foram corrigidos e ficam registrados aqui para conferência.'),
        UI.tabela([{ rot: 'Onde', esq: true }, { rot: 'Estava', esq: true }, { rot: 'Passou a ser', esq: true },
                   { rot: 'Motivo', esq: true }],
          PDA.CAT.correcoes.map(function (c) {
            return h('tr', {},
              h('td', { class: 'esq' }, c.onde),
              h('td', { class: 'esq' }, c.era),
              h('td', { class: 'esq' }, c.agora),
              h('td', { class: 'esq nota' }, c.motivo));
          }))
      ]),

      UI.cartao('Motores comerciais considerados', null, [
        h('p', { class: 'nota' }, PDA.P.fonteMotores),
        h('p', { class: 'mono', style: 'margin-top:8px' },
          st.bombas.motores.map(function (m) { return UI.numEdit(m); }).join('  ·  ') + '   cv'),
        h('button', { class: 'btn mini naoimprime', type: 'button', 'data-acao': 'editarMotores', style: 'margin-top:8px' },
          'Editar linha de motores')
      ])
    ];
  };

  PDA.K = K;
})(window.PDA = window.PDA || {});
