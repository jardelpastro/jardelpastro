/* ------------------------------------------------------------------
 * Aplicação: montagem das abas, ligação dos campos ao estado,
 * ações, persistência e arquivos.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var App = {};
  var UI = PDA.UI, h;
  var timer = null, foco = null;

  App.abas = [
    { id: 'projeto', rot: 'Projeto' },
    { id: 'bombas', rot: 'Bombas e níveis' },
    { id: 'succao', rot: 'Sucção' },
    { id: 'barrilete', rot: 'Barriletes' },
    { id: 'adutoras', rot: 'Adutora / Recalque' },
    { id: 'resultados', rot: 'Resultados' },
    { id: 'catalogos', rot: 'Catálogos' },
    { id: 'fontes', rot: 'Fontes e critérios' }
  ];
  App.aba = 'projeto';

  /* ================================================================
     Início
     ================================================================ */

  App.iniciar = function () {
    h = UI.h;
    PDA.F.init(); PDA.Res.init(); PDA.K.init();

    App.cats = PDA.E.carregarCatalogos();
    App.st = PDA.E.carregarLocal() || PDA.E.padrao();

    var cfg = PDA.E.carregarConfig();
    if (cfg.tema) document.documentElement.setAttribute('data-tema', cfg.tema);
    if (cfg.aba) App.aba = cfg.aba;

    App.ligarEventos();
    App.render();
  };

  /* ================================================================
     Renderização
     ================================================================ */

  App.render = function () {
    App.salvarFoco();

    var st = App.st;
    var ctx, res, erro = null;
    try {
      ctx = PDA.C.contexto(st, App.cats);
      res = PDA.C.resumo(st, App.cats);
    } catch (e) {
      erro = e;
      ctx = null;
    }

    /* navegação */
    var nav = document.getElementById('abas');
    UI.limpar(nav);
    App.abas.forEach(function (a) {
      nav.appendChild(h('button', {
        type: 'button', 'aria-selected': App.aba === a.id ? 'true' : 'false',
        onclick: function () { App.aba = a.id; PDA.E.salvarConfig({ tema: document.documentElement.getAttribute('data-tema'), aba: a.id }); App.render(); }
      }, a.rot));
    });

    var main = document.getElementById('conteudo');
    UI.limpar(main);

    if (erro) {
      main.appendChild(h('div', { class: 'aviso erro' },
        h('b', {}, 'Não foi possível concluir o cálculo'),
        String(erro && erro.message ? erro.message : erro),
        h('p', { style: 'margin-top:8px' },
          h('button', { class: 'btn', type: 'button', onclick: function () { App.st = PDA.E.padrao(); App.render(); } },
            'Recomeçar com o projeto padrão'))));
      return;
    }

    if (App.aba !== 'catalogos' && App.aba !== 'fontes') {
      main.appendChild(PDA.Res.faixa(st, ctx, res));
    }

    var conteudo;
    switch (App.aba) {
      case 'projeto':    conteudo = PDA.F.abaProjeto(st, ctx); break;
      case 'bombas':     conteudo = PDA.F.abaBombas(st, ctx, res); break;
      case 'succao':     conteudo = PDA.F.abaSuccao(st, ctx); break;
      case 'barrilete':  conteudo = PDA.F.abaBarrilete(st, ctx); break;
      case 'adutoras':   conteudo = PDA.F.abaAdutoras(st, ctx); break;
      case 'resultados': conteudo = PDA.Res.aba(st, ctx, res); break;
      case 'catalogos':  conteudo = PDA.K.aba(st, ctx); break;
      case 'fontes':     conteudo = PDA.K.abaFontes(st, ctx); break;
    }
    UI.add(main, conteudo);

    PDA.E.salvarLocal(st);
    App.restaurarFoco();
  };

  App.agendar = function (ms) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; App.render(); }, ms);
  };

  App.salvarFoco = function () {
    var a = document.activeElement;
    foco = null;
    if (a && a.getAttribute && a.getAttribute('data-bind')) {
      foco = {
        bind: a.getAttribute('data-bind'),
        tag: a.tagName,
        valor: a.value,
        ini: a.selectionStart,
        fim: a.selectionEnd
      };
    }
  };

  App.restaurarFoco = function () {
    if (!foco) return;
    var el = document.querySelector('[data-bind="' + foco.bind + '"]');
    if (!el) { foco = null; return; }
    if (el.tagName === 'INPUT' && el.type === 'text' && foco.valor !== undefined) {
      el.value = foco.valor;
    }
    try {
      el.focus();
      if (el.setSelectionRange && foco.ini !== null && foco.ini !== undefined) {
        el.setSelectionRange(foco.ini, foco.fim);
      }
    } catch (e) { /* alguns tipos de campo não aceitam seleção */ }
    foco = null;
  };

  /* ================================================================
     Eventos
     ================================================================ */

  App.ligarEventos = function () {
    document.addEventListener('input', function (e) { App.aoDigitar(e, false); });
    document.addEventListener('change', function (e) { App.aoDigitar(e, true); });
    document.addEventListener('click', App.aoClicar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.fecharModal();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); App.baixarProjeto(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { /* deixa a impressão nativa */ }
    });
  };

  App.aoDigitar = function (e, ehChange) {
    var el = e.target;
    if (!el || !el.getAttribute) return;

    /* seletor de "adicionar peça" */
    var acaoCh = el.getAttribute('data-acao-change');
    if (acaoCh === 'addPeca' && el.value) {
      var base = el.getAttribute('data-base');
      var conj = UI.get(App.st, base);
      if (conj) {
        if (!conj.pecas) conj.pecas = [];
        conj.pecas.push(PDA.E.novaPeca(el.value));
      }
      App.render();
      return;
    }

    var bind = el.getAttribute('data-bind');
    if (!bind) return;
    var tipo = el.getAttribute('data-tipo') || 'num';
    var valor;
    if (tipo === 'bool') valor = el.checked;
    else if (tipo === 'texto') valor = el.value;
    else valor = el.value.trim() === '' ? null : UI.parseNum(el.value);

    UI.set(App.st, bind, valor);

    /* troca de catálogo: o diâmetro anterior pode não existir no novo */
    if (/\.catalogoId$/.test(bind) || bind === 'catalogoId') {
      var basePai = bind.replace(/\.?catalogoId$/, '');
      var c = basePai ? UI.get(App.st, basePai) : App.st;
      if (c) c.itemRot = '';
    }

    /* nº de bombas coerente */
    if (bind === 'bombas.operando' || bind === 'bombas.instaladas') {
      var b = App.st.bombas;
      b.instaladas = Math.max(1, Math.min(50, Math.round(Number(b.instaladas) || 1)));
      b.operando = Math.max(1, Math.min(b.instaladas, Math.round(Number(b.operando) || 1)));
    }

    var estrutural = el.getAttribute('data-estrutural') || tipo === 'bool' ||
                     el.tagName === 'SELECT' || ehChange;
    App.agendar(estrutural ? 0 : 320);
  };

  App.aoClicar = function (e) {
    var el = e.target.closest ? e.target.closest('[data-acao]') : null;
    if (!el) return;
    var acao = el.getAttribute('data-acao');
    var base = el.getAttribute('data-base');
    var i = el.getAttribute('data-i');
    var st = App.st;

    if (acao.indexOf('addTrecho:') === 0) {
      var ch = acao.split(':')[1];
      st[ch].trechos.push(PDA.E.novoTrechoComum(st[ch].trechos.length + 1));
      App.render(); return;
    }
    if (acao.indexOf('delTrecho:') === 0) {
      var ch2 = acao.split(':')[1];
      st[ch2].trechos.splice(Number(i), 1);
      App.render(); return;
    }

    switch (acao) {
      case 'removerPeca':
        UI.get(st, base).pecas.splice(Number(i), 1);
        App.render(); return;

      case 'escolherDiametro':
        UI.get(st, base).itemRot = el.getAttribute('data-rot');
        App.render(); return;

      case 'addAdutora':
        st.adutoras.push(PDA.E.novaAdutora(st.adutoras.length + 1));
        App.render(); return;

      case 'duplicarAdutora':
        var ult = st.adutoras[st.adutoras.length - 1];
        var novo = PDA.E.clone(ult);
        novo.rot = (ult.rot || 'Trecho') + ' (cópia)';
        st.adutoras.push(novo);
        App.render(); return;

      case 'delAdutora':
        if (st.adutoras.length > 1) st.adutoras.splice(Number(i), 1);
        App.render(); return;

      case 'limparRugosidade':
        var cj = UI.get(st, el.getAttribute('data-base'));
        cj.cOverride = null; cj.epsOverride = null;
        App.render(); return;

      case 'restaurarCriterios':
        UI.confirmar('Restaurar critérios',
          'As faixas de velocidade e de perda unitária voltam aos valores recomendados pelas normas e pela literatura. As alterações que você fez serão perdidas.',
          function () { st.criterios = PDA.E.clone(PDA.P.criterios); App.render(); UI.toast('Critérios restaurados.'); });
        return;

      case 'editarMotores': App.modalMotores(); return;
      case 'imprimir': window.print(); return;

      case 'novoCatalogo': PDA.K.modalCatalogo(st, { cats: App.cats }, null, null); return;
      case 'duplicarCatalogo':
        PDA.K.modalCatalogo(st, { cats: App.cats }, null, PDA.CAT.buscar(App.cats.todos, el.getAttribute('data-id')));
        return;
      case 'editarCatalogo':
        PDA.K.modalCatalogo(st, { cats: App.cats }, PDA.CAT.buscar(App.cats.todos, el.getAttribute('data-id')), null);
        return;
      case 'excluirCatalogo':
        var idc = el.getAttribute('data-id');
        var cx = PDA.CAT.buscar(App.cats.todos, idc);
        UI.confirmar('Excluir catálogo', 'Excluir "' + (cx ? cx.nome : idc) + '"? Os trechos que usam este catálogo ficarão sem diâmetro.',
          function () {
            App.gravarCatalogos(App.cats.usuario.filter(function (c) { return c.id !== idc; }));
            PDA.K.selecionado = null;
            App.render(); UI.toast('Catálogo excluído.');
          });
        return;
      case 'exportarCatalogos': App.baixarCatalogos(); return;
      case 'importarCatalogos': App.abrirArquivo(App.carregarCatalogos); return;

      case 'novoProjeto':
        UI.confirmar('Novo projeto', 'Descartar os dados atuais e começar um projeto em branco?',
          function () { App.st = PDA.E.padrao(); App.aba = 'projeto'; App.render(); });
        return;
      case 'abrirProjeto': App.abrirArquivo(App.carregarProjeto); return;
      case 'salvarProjeto': App.baixarProjeto(); return;
      case 'exemplo': App.modalExemplos(); return;
      case 'ajuda': App.modalAjuda(); return;
      case 'tema':
        var atual = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
        document.documentElement.setAttribute('data-tema', atual);
        PDA.E.salvarConfig({ tema: atual, aba: App.aba });
        return;
    }
  };

  /* ================================================================
     Catálogos do usuário
     ================================================================ */

  App.gravarCatalogos = function (usuario) {
    App.cats.usuario = usuario;
    App.cats.todos = PDA.CAT.padrao.concat(usuario);
    if (!PDA.E.salvarCatalogos(usuario)) {
      UI.toast('Não foi possível gravar no navegador — exporte os catálogos em arquivo.');
    }
  };

  /* ================================================================
     Arquivos
     ================================================================ */

  App.baixar = function (nome, texto) {
    var blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  function nomeArquivo(st, sufixo) {
    var n = (st.projeto.nome || 'adutora').replace(/[^\wÀ-ÿ .-]+/g, '').trim().slice(0, 60) || 'adutora';
    return n + sufixo;
  }

  App.baixarProjeto = function () {
    App.baixar(nomeArquivo(App.st, '.adutora.json'),
      JSON.stringify({ tipo: 'pda-projeto', versao: PDA.E.VERSAO, projeto: App.st, catalogosUsuario: App.cats.usuario }, null, 1));
    UI.toast('Projeto salvo em arquivo.');
  };

  App.baixarCatalogos = function () {
    if (!App.cats.usuario.length) { UI.toast('Você ainda não cadastrou catálogos próprios.'); return; }
    App.baixar('catalogos-tubos.json',
      JSON.stringify({ tipo: 'pda-catalogos', versao: PDA.E.VERSAO, catalogos: App.cats.usuario }, null, 1));
    UI.toast(App.cats.usuario.length + ' catálogo(s) exportado(s).');
  };

  App.abrirArquivo = function (cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try { cb(JSON.parse(String(fr.result))); }
        catch (e) { UI.toast('Arquivo inválido: ' + e.message); }
      };
      fr.readAsText(f);
    };
    inp.click();
  };

  App.carregarProjeto = function (dados) {
    var proj = dados.projeto || (dados.versao !== undefined && dados.vazao ? dados : null);
    if (!proj) { UI.toast('Este arquivo não contém um projeto.'); return; }
    App.st = PDA.E.migrar(proj);
    if (dados.catalogosUsuario && dados.catalogosUsuario.length) {
      var atuais = App.cats.usuario.slice();
      dados.catalogosUsuario.forEach(function (c) {
        if (!atuais.some(function (x) { return x.id === c.id; })) atuais.push(c);
      });
      App.gravarCatalogos(atuais);
    }
    App.aba = 'resultados';
    App.render();
    UI.toast('Projeto carregado.');
  };

  App.carregarCatalogos = function (dados) {
    var lista = dados.catalogos || (Array.isArray(dados) ? dados : null);
    if (!lista) { UI.toast('Este arquivo não contém catálogos.'); return; }
    var atuais = App.cats.usuario.slice(), n = 0;
    lista.forEach(function (c) {
      if (!c.id) c.id = 'usr_' + Math.random().toString(36).slice(2, 9);
      if (!c.itens || !c.itens.length) return;
      atuais = atuais.filter(function (x) { return x.id !== c.id; });
      atuais.push(c); n++;
    });
    App.gravarCatalogos(atuais);
    App.render();
    UI.toast(n + ' catálogo(s) importado(s).');
  };

  /* ================================================================
     Modais
     ================================================================ */

  App.modalMotores = function () {
    var ta = h('textarea', { rows: 6, style: 'font-family:var(--mono)' },
      App.st.bombas.motores.map(function (m) { return UI.numEdit(m); }).join(' '));
    UI.modal('Linha de motores comerciais (cv)', [
      h('p', { class: 'nota' },
        'Potências nominais consideradas na escolha do motor, em cv. Separe por espaço, vírgula ou quebra de linha. ' +
        'Ajuste conforme a linha do fabricante que você especifica.'),
      ta,
      h('p', { class: 'nota', style: 'margin-top:8px' }, PDA.P.fonteMotores)
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button', onclick: function () {
          var v = ta.value.split(/[\s,;]+/).map(UI.parseNum)
            .filter(function (x) { return x !== null && x > 0; })
            .sort(function (a, b) { return a - b; });
          if (!v.length) { UI.toast('Informe ao menos uma potência.'); return; }
          App.st.bombas.motores = v;
          UI.fecharModal(); App.render(); UI.toast(v.length + ' potências gravadas.');
        }
      }, 'Salvar')
    ]);
  };

  App.modalExemplos = function () {
    UI.modal('Exemplos prontos', [
      h('p', { class: 'nota' },
        'Os dois exemplos reproduzem os casos que estavam nas planilhas de origem, já com a estrutura completa ' +
        'de barrilete e adutora. Servem para conferir os resultados e para usar como ponto de partida.'),
      h('div', { style: 'display:flex;flex-direction:column;gap:9px;margin-top:11px' },
        h('button', {
          class: 'btn', type: 'button', style: 'text-align:left;padding:11px',
          onclick: function () { UI.fecharModal(); App.st = App.exemploAgua(); App.aba = 'resultados'; App.render(); }
        }, h('b', {}, 'Adutora de água tratada — 400 L/s, 214 m'),
           h('div', { class: 'nota' }, 'PEAD PE 100, cotas 620 → 642 m, 3 bombas instaladas e 2 em operação, Hazen-Williams com C = 130.')),
        h('button', {
          class: 'btn', type: 'button', style: 'text-align:left;padding:11px',
          onclick: function () { UI.fecharModal(); App.st = App.exemploEsgoto(); App.aba = 'resultados'; App.render(); }
        }, h('b', {}, 'Linha de recalque de esgoto bruto — 685 L/s, 6,67 km'),
           h('div', { class: 'nota' }, 'Ferro fundido dúctil K7, cotas 126 → 149 m, 5 bombas instaladas e 4 em operação, Colebrook-White. Barrilete comum somando as bombas em sequência.')))
    ]);
  };

  App.exemploAgua = function () {
    var st = PDA.E.padrao();
    st.projeto = { nome: 'Adutora de água tratada — exemplo', local: '', responsavel: '', data: '', obs: '' };
    st.fluido = { tipo: 'agua_tratada', temperatura: 20, altitude: 620 };
    st.calculo.metodo = 'hw';
    st.vazao = { valor: 400, unidade: 'L/s', base: 'total' };
    st.bombas.instaladas = 3; st.bombas.operando = 2; st.bombas.rendBomba = 60;
    st.cotas = { nivelSuccaoMin: 620, nivelSuccaoMax: 621.5, eixoBomba: 619, nivelChegada: 642, unid: 'm' };

    st.succaoIndividual.ativo = true;
    st.succaoIndividual.catalogoId = 'fd_flg_agua';
    st.succaoIndividual.itemRot = 'DN 400';
    st.succaoIndividual.extensao = 6;
    st.succaoIndividual.pecas = [
      PDA.E.novaPeca('sino_succao'), PDA.E.novaPeca('curva90'),
      PDA.E.novaPeca('vg'), PDA.E.novaPeca('reducao_exc')
    ];

    st.barrileteIndividual.ativo = true;
    st.barrileteIndividual.catalogoId = 'fd_flg_agua';
    st.barrileteIndividual.itemRot = 'DN 350';
    st.barrileteIndividual.extensao = 8;
    st.barrileteIndividual.pecas = [
      PDA.E.novaPeca('reducao_conc'), PDA.E.novaPeca('vr'), PDA.E.novaPeca('vg_volante'),
      PDA.E.novaPeca('curva90'), PDA.E.novaPeca('junta_montagem')
    ];
    st.barrileteIndividual.pecas[3].qtd = 2;
    st.barrileteIndividual.pecas[4].qtd = 2;

    st.barrileteComum.ativo = true;
    st.barrileteComum.trechos = [1, 2].map(function (n) {
      var t = PDA.E.novoTrechoComum(n);
      t.rot = 'Barrilete comum — após a ' + n + 'ª bomba';
      t.catalogoId = 'fd_flg_agua';
      t.itemRot = 'DN 500';
      t.extensao = 6;
      t.pecas = [PDA.E.novaPeca('te_direta'), PDA.E.novaPeca('medidor_vazao')];
      return t;
    });
    st.barrileteComum.trechos[1].pecas.push(PDA.E.novaPeca('curva90'));

    st.adutoras = [PDA.E.novaAdutora(1)];
    var a = st.adutoras[0];
    a.rot = 'Adutora — recalque até o reservatório';
    a.catalogoId = 'pead_pe100_sdr21';
    a.itemRot = 'DE 500';
    a.extensao = 214; a.unidExt = 'm';
    a.cOverride = 130;
    a.usarCotas = true; a.cotaIni = 620; a.cotaFim = 642;
    a.pecas = [PDA.E.novaPeca('curva90'), PDA.E.novaPeca('curva45'),
               PDA.E.novaPeca('ventosa'), PDA.E.novaPeca('descarga'), PDA.E.novaPeca('saida')];
    a.pecas[0].qtd = 2;
    return st;
  };

  App.exemploEsgoto = function () {
    var st = PDA.E.padrao();
    st.projeto = { nome: 'Linha de recalque de esgoto bruto — exemplo', local: '', responsavel: '', data: '', obs: '' };
    st.fluido = { tipo: 'esgoto_bruto', temperatura: 25, altitude: 126 };
    st.calculo.metodo = 'colebrook';
    st.vazao = { valor: 685, unidade: 'L/s', base: 'total' };
    st.bombas.instaladas = 5; st.bombas.operando = 4; st.bombas.rendBomba = 80;
    st.cotas = { nivelSuccaoMin: 126, nivelSuccaoMax: 128, eixoBomba: 124, nivelChegada: 149, unid: 'm' };

    st.succaoIndividual.ativo = true;
    st.succaoIndividual.catalogoId = 'fd_esgoto_je';
    st.succaoIndividual.itemRot = 'DN 400';
    st.succaoIndividual.extensao = 7;
    st.succaoIndividual.pecas = [PDA.E.novaPeca('sino_succao'), PDA.E.novaPeca('curva90'), PDA.E.novaPeca('vg')];

    st.succaoComum.ativo = false;

    st.barrileteIndividual.ativo = true;
    st.barrileteIndividual.catalogoId = 'fd_esgoto_je';
    st.barrileteIndividual.itemRot = 'DN 400';
    st.barrileteIndividual.extensao = 10;
    st.barrileteIndividual.pecas = [
      PDA.E.novaPeca('vr'), PDA.E.novaPeca('vg_volante'), PDA.E.novaPeca('curva90'),
      PDA.E.novaPeca('junta_montagem'), PDA.E.novaPeca('medidor_vazao')
    ];
    st.barrileteIndividual.pecas[2].qtd = 2;
    st.barrileteIndividual.pecas[3].qtd = 2;

    st.barrileteComum.ativo = true;
    st.barrileteComum.trechos = [1, 2, 3, 4].map(function (n) {
      var t = PDA.E.novoTrechoComum(n);
      t.rot = 'Barrilete comum — reunindo ' + n + ' bomba' + (n > 1 ? 's' : '');
      t.catalogoId = 'fd_esgoto_je';
      t.itemRot = n <= 2 ? 'DN 600' : 'DN 800';
      t.extensao = 5;
      t.pecas = [PDA.E.novaPeca('te_direta')];
      return t;
    });

    st.adutoras = [PDA.E.novaAdutora(1)];
    var a = st.adutoras[0];
    a.rot = 'Linha de recalque — travessia até a ETE';
    a.catalogoId = 'fd_k7';
    a.itemRot = 'DN 800';
    a.extensao = 6.67; a.unidExt = 'km';
    a.usarCotas = true; a.cotaIni = 126; a.cotaFim = 149;
    a.pecas = [PDA.E.novaPeca('curva90'), PDA.E.novaPeca('curva45'), PDA.E.novaPeca('curva22'),
               PDA.E.novaPeca('ventosa'), PDA.E.novaPeca('descarga'), PDA.E.novaPeca('saida')];
    a.pecas[0].qtd = 6; a.pecas[1].qtd = 8; a.pecas[2].qtd = 4;
    a.pecas[3].qtd = 5; a.pecas[4].qtd = 4;

    st.golpe = { avaliar: true, tipoManobra: 'rapida', tempoManobra: 8, psi: 1.0 };
    return st;
  };

  App.modalAjuda = function () {
    UI.modal('Como usar', [
      h('div', { class: 'nota', style: 'font-size:13px;line-height:1.65' },
        h('p', {}, h('b', {}, 'O programa é um único arquivo.'), ' Não instala nada, não pede permissão de administrador ' +
          'e não envia dados para lugar nenhum: tudo roda no seu navegador. Copie o arquivo para um pen drive, ' +
          'uma pasta de rede ou o desktop e dê dois cliques.'),
        UI.sub('Sequência de trabalho'),
        h('ol', {},
          h('li', {}, h('b', {}, 'Projeto'), ' — fluido, temperatura, fórmula de perda de carga, vazão e as faixas de velocidade e perda unitária que vão colorir as tabelas.'),
          h('li', {}, h('b', {}, 'Bombas e níveis'), ' — quantos conjuntos, quantos operam, rendimentos, níveis de sucção e cota de chegada.'),
          h('li', {}, h('b', {}, 'Sucção e Barriletes'), ' — as peças de cada trecho. O barrilete comum aceita um trecho por etapa de reunião das bombas, e a vazão de cada um acompanha quantas bombas ele coleta.'),
          h('li', {}, h('b', {}, 'Adutora / Recalque'), ' — um ou mais trechos em série. Quando a linha se ramifica, reduza a fração de vazão do trecho e escolha um diâmetro menor.'),
          h('li', {}, h('b', {}, 'Resultados'), ' — composição das perdas, cenários por número de bombas, perfil, transitório e memorial pronto para imprimir.')),
        UI.sub('Escolha do diâmetro'),
        h('p', {}, 'Cada trecho traz uma tabela com todos os diâmetros do catálogo. As cores seguem os critérios da aba Projeto: ' +
          'verde dentro da faixa recomendada, âmbar fora dela mas dentro do limite, vermelho reprovado. ' +
          'A estrela marca a sugestão do programa — o menor diâmetro que atende integralmente. ' +
          'Clique em qualquer linha para adotar aquele diâmetro.'),
        UI.sub('Coeficientes de rugosidade'),
        h('p', {}, 'Escolha o material pelo catálogo do tubo e a faixa de idade. O coeficiente sugerido aparece como ' +
          'texto de fundo no campo — digite outro valor para sobrepor apenas naquele trecho, e o campo fica destacado. ' +
          'O botão "Fonte" mostra de onde vem cada número.'),
        UI.sub('Catálogos'),
        h('p', {}, 'A aba Catálogos permite consultar as dimensões de todos os tubos da base, cadastrar catálogos novos ' +
          '(colando a tabela do fabricante), duplicar um catálogo da base para ajustar, e exportar/importar em arquivo ' +
          'para levar de um computador a outro.'),
        UI.sub('Salvar o trabalho'),
        h('p', {}, 'O projeto é guardado automaticamente no navegador deste computador. Para levar para outra máquina ' +
          'ou anexar ao processo, use ', h('b', {}, 'Salvar'), ' (gera um arquivo .json) e ', h('b', {}, 'Abrir'), '. ' +
          'Atalho: Ctrl+S salva o arquivo.'),
        h('div', { class: 'aviso' },
          h('b', {}, 'Alcance do programa'),
          'Trata-se de pré-dimensionamento. Define ordem de grandeza de diâmetro, altura manométrica e potência, ' +
          'e sinaliza o que precisa de atenção. O projeto executivo continua exigindo a curva da bomba, ' +
          'o ponto de operação real, a verificação do NPSH requerido e a análise do transitório com dispositivos de proteção.'))
    ]);
  };

  PDA.App = App;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.iniciar);
    else App.iniciar();
  }
})(window.PDA = window.PDA || {});
