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
    { id: 'resumo', rot: 'Resumo' },
    { id: 'projeto', rot: 'Projeto' },
    { id: 'bombas', rot: 'Bombas e níveis' },
    { id: 'succao', rot: 'Sucção' },
    { id: 'barrilete', rot: 'Barriletes' },
    { id: 'adutoras', rot: 'Adutora / Recalque' },
    { id: 'perfil', rot: 'Perfil da linha' },
    { sep: true },
    { id: 'resultados', rot: 'Resultados' },
    { sep: true },
    { id: 'catalogos', rot: 'Catálogos' },
    { id: 'parametros', rot: 'Parâmetros de cálculo' },
    { id: 'fontes', rot: 'Fontes' }
  ];
  App.aba = 'resumo';

  /* ================================================================
     Início
     ================================================================ */

  App.iniciar = function () {
    h = UI.h;
    PDA.F.init(); PDA.Res.init(); PDA.K.init(); PDA.Q.init(); PDA.Pf.init(); PDA.B.init();
    App.montarMarca();

    App.cats = PDA.E.carregarCatalogos();
    App.st = PDA.E.carregarLocal() || PDA.E.padrao();

    var cfg = PDA.E.carregarConfig();
    if (cfg.tema) document.documentElement.setAttribute('data-tema', cfg.tema);
    if (cfg.aba) App.aba = cfg.aba;

    App.ligarEventos();
    App.render();
  };

  App.montarMarca = function () {
    var alvo = document.getElementById('marca');
    if (!alvo) return;
    UI.limpar(alvo);
    alvo.appendChild(PDA.M.marca(38));
  };

  /* ================================================================
     Renderização
     ================================================================ */

  App.render = function () {
    App.salvarFoco();
    var rolagem = window.pageYOffset || document.documentElement.scrollTop || 0;

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
    var nAvisos = 0;
    try { nAvisos = PDA.Res.coletarAvisos(st, ctx, res).length; } catch (e) { nAvisos = 0; }
    var nDados = (res.avisosDados || []).length;
    UI.limpar(nav);
    App.abas.forEach(function (a) {
      if (a.sep) { nav.appendChild(h('div', { class: 'sep' })); return; }
      var marcador = null;
      if (a.id === 'resultados' && nAvisos) {
        marcador = h('span', { class: 'marcador', title: nAvisos + ' ponto(s) a verificar' }, String(nAvisos));
      }
      if (a.id === 'resumo' && nDados) {
        marcador = h('span', { class: 'marcador', title: nDados + ' incoerência(s) de dados' }, '!');
      }
      nav.appendChild(h('button', {
        type: 'button', 'aria-selected': App.aba === a.id ? 'true' : 'false',
        onclick: function () { App.irPara(a.id); }
      }, a.rot, marcador));
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

    /* faixa de resumo fixa abaixo das abas, nas telas de lançamento */
    var fixo = document.getElementById('fixo');
    var interno = fixo.firstChild;
    UI.limpar(interno);
    var comFaixa = ['bombas', 'succao', 'barrilete', 'adutoras', 'perfil', 'resultados'].indexOf(App.aba) >= 0;
    fixo.classList.toggle('ativa', comFaixa);
    if (comFaixa) {
      interno.appendChild(PDA.Res.faixa(st, ctx, res));
      /* a versão fixa não sai no papel (é sticky); uma cópia entra no fluxo */
      main.appendChild(h('div', { class: 'somenteimprime' }, PDA.Res.faixa(st, ctx, res)));
    }

    var conteudo;
    switch (App.aba) {
      case 'resumo':     conteudo = PDA.F.abaResumo(st, ctx, res); break;
      case 'projeto':    conteudo = PDA.F.abaProjeto(st, ctx, res); break;
      case 'bombas':     conteudo = PDA.F.abaBombas(st, ctx, res); break;
      case 'succao':     conteudo = PDA.F.abaSuccao(st, ctx); break;
      case 'barrilete':  conteudo = PDA.F.abaBarrilete(st, ctx); break;
      case 'adutoras':   conteudo = PDA.F.abaAdutoras(st, ctx, res); break;
      case 'perfil':     conteudo = PDA.Pf.aba(st, ctx, res); break;
      case 'resultados': conteudo = PDA.Res.aba(st, ctx, res); break;
      case 'catalogos':  conteudo = PDA.K.aba(st, ctx); break;
      case 'parametros': conteudo = PDA.F.abaParametros(st, ctx); break;
      case 'fontes':     conteudo = PDA.K.abaFontes(st, ctx); break;
    }
    UI.add(main, conteudo);
    App.marcarSelects();
    App.montarCabecalhoImpressao(st, ctx, res);
    App.medirTopo();

    PDA.E.salvarLocal(st);
    App.restaurarFoco();

    /* devolve a rolagem: sem isso, esvaziar o conteúdo colapsa a página e o
       navegador joga a tela para o topo a cada tecla digitada */
    if (App.rolarTopo) { App.rolarTopo = false; window.scrollTo(0, 0); }
    else if (rolagem > 0) { window.scrollTo(0, rolagem); }
  };

  /* No papel um <select> aparece cortado na largura da caixa. Ao lado de cada
     um fica um texto com a opção escolhida, escondido na tela e impresso no
     lugar do campo. */
  App.marcarSelects = function () {
    var sels = document.querySelectorAll('#conteudo select, #fixo select');
    var i, s2, txt, prox, sp;
    for (i = 0; i < sels.length; i++) {
      s2 = sels[i];
      txt = s2.options && s2.options[s2.selectedIndex] ? s2.options[s2.selectedIndex].text : '';
      prox = s2.nextSibling;
      if (prox && prox.nodeType === 1 && prox.className === 'valor-impresso') {
        prox.textContent = txt;
      } else {
        sp = document.createElement('span');
        sp.className = 'valor-impresso';
        sp.textContent = txt;
        if (s2.parentNode) s2.parentNode.insertBefore(sp, s2.nextSibling);
      }
    }
  };

  /* Cabeçalho que só aparece no papel: marca, identificação e a aba impressa */
  App.montarCabecalhoImpressao = function (st, ctx, res) {
    var alvo = document.getElementById('cabecalho-impressao');
    if (!alvo) return;
    UI.limpar(alvo);

    var aba = App.abas.filter(function (a) { return a.id === App.aba; })[0];
    var dados = [];
    function d(rot, val) {
      if (!val) return;
      dados.push(h('span', {}, rot + ': ', h('b', {}, val)));
    }
    d('Local', st.projeto.local);
    d('Responsável', st.projeto.responsavel);
    d('Data', st.projeto.data);
    d('Folha', aba ? aba.rot : '');
    d('Impresso em', App.dataHoraBR());

    alvo.appendChild(PDA.M.marca(46));
    alvo.appendChild(h('div', { class: 'dados' },
      h('h1', {}, st.projeto.nome || 'Pré-dimensionamento de adutora / linha de recalque'),
      h('div', { class: 'linha-dados' }, dados)));
  };

  App.dataHoraBR = function () {
    var dt = new Date();
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return z(dt.getDate()) + '/' + z(dt.getMonth() + 1) + '/' + dt.getFullYear() +
           ' ' + z(dt.getHours()) + ':' + z(dt.getMinutes());
  };

  /* altura de cabeçalho + abas, para a faixa fixa grudar no lugar certo */
  App.medirTopo = function () {
    var topo = document.querySelector('header.topo');
    var nav = document.getElementById('abas');
    if (!topo || !nav) return;
    var alt = topo.offsetHeight + nav.offsetHeight;
    document.documentElement.style.setProperty('--topo-h', alt + 'px');
  };

  App.irPara = function (aba) {
    App.aba = aba;
    App.rolarTopo = true;
    PDA.E.salvarConfig({ tema: document.documentElement.getAttribute('data-tema'), aba: aba });
    App.render();
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
    window.addEventListener('resize', App.medirTopo);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') UI.fecharModal();
      /* Enter num campo apenas confirma o valor; não recarrega a tela */
      if (e.key === 'Enter' && e.target && e.target.getAttribute &&
          e.target.getAttribute('data-bind') && e.target.tagName === 'INPUT') {
        e.preventDefault();
        e.target.blur();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); App.guardarNaBiblioteca(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); PDA.B.abrir(); }
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

    /* pressão admissível: acompanha o catálogo enquanto o usuário não digitar
       um valor próprio */
    if (/\.pnMcaOverride$/.test(bind)) {
      var conjPN = UI.get(App.st, bind.replace('.pnMcaOverride', ''));
      if (conjPN) conjPN.pnAuto = false;
    } else if (/\.(catalogoId|itemRot)$/.test(bind)) {
      App.autoPreencherPN(bind.replace(/\.(catalogoId|itemRot)$/, ''));
    }

    /* cota de chegada e cota final do último trecho são o mesmo número:
       editar um mantém o outro em dia */
    App.sincronizarCotas(bind);

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

  /* Mantém uma única verdade para as cotas de partida e de chegada.
     Chamado depois de cada edição de campo. */
  App.sincronizarCotas = function (bind) {
    var st = App.st;
    var ativas = st.adutoras.filter(function (a) { return a.ativo !== false; });
    var ultima = ativas[ativas.length - 1];
    var primeira = ativas[0];

    if (bind === 'cotas.nivelChegada' && ultima && ultima.usarCotas) {
      ultima.cotaFim = st.cotas.nivelChegada;
      return;
    }
    if (/^adutoras\.\d+\.cotaFim$/.test(bind) && ultima &&
        UI.get(st, bind.replace('.cotaFim', '')) === ultima) {
      st.cotas.nivelChegada = ultima.cotaFim;
      return;
    }
    if ((bind === 'cotas.cotaPartida' || bind === 'cotas.nivelSuccaoMin') && primeira && primeira.usarCotas) {
      primeira.cotaIni = PDA.C.cotaPartida(st);
      return;
    }
    if (/^adutoras\.\d+\.cotaIni$/.test(bind) && primeira &&
        UI.get(st, bind.replace('.cotaIni', '')) === primeira) {
      st.cotas.cotaPartida = primeira.cotaIni;
      return;
    }
    /* ao ligar as cotas de um trecho, já nasce coerente */
    if (/^adutoras\.\d+\.usarCotas$/.test(bind)) {
      if (ultima && ultima.usarCotas &&
          (ultima.cotaFim === null || ultima.cotaFim === undefined || Number(ultima.cotaFim) === 0)) {
        ultima.cotaFim = st.cotas.nivelChegada;
      }
      if (primeira && primeira.usarCotas &&
          (primeira.cotaIni === null || primeira.cotaIni === undefined || Number(primeira.cotaIni) === 0)) {
        primeira.cotaIni = PDA.C.cotaPartida(st);
      }
    }
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
      case 'mover': {
        App.moverItem(el.getAttribute('data-arr'), Number(el.getAttribute('data-i')),
                      Number(el.getAttribute('data-para')));
        return;
      }

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
      case 'imprimir': App.imprimir(); return;

      case 'irAba': App.irPara(el.getAttribute('data-aba')); return;

      /* coerência de cotas */
      case 'sincCotaChegada': {
        var at = st.adutoras.filter(function (a) { return a.ativo !== false; });
        var ul = at[at.length - 1];
        if (ul) st.cotas.nivelChegada = Number(ul.cotaFim) || 0;
        App.render(); UI.toast('Cota de chegada ajustada.'); return;
      }
      case 'sincCotaTrecho': {
        var at2 = st.adutoras.filter(function (a) { return a.ativo !== false; });
        var ul2 = at2[at2.length - 1];
        if (ul2) ul2.cotaFim = Number(st.cotas.nivelChegada) || 0;
        App.render(); UI.toast('Cota final do trecho ajustada.'); return;
      }
      case 'sincCotaPartida': {
        var at3 = st.adutoras.filter(function (a) { return a.ativo !== false; });
        if (at3[0]) at3[0].cotaIni = PDA.C.cotaPartida(st);
        App.render(); UI.toast('Cota inicial do trecho ajustada.'); return;
      }
      case 'trocarNiveis': {
        var t = st.cotas.nivelSuccaoMin;
        st.cotas.nivelSuccaoMin = st.cotas.nivelSuccaoMax;
        st.cotas.nivelSuccaoMax = t;
        App.render(); UI.toast('Níveis trocados.'); return;
      }

      /* perfil da linha */
      case 'colarPerfil': PDA.Pf.modalColar(st); return;
      case 'addPontoPerfil': {
        var pp = st.perfil.pontos;
        var ultX = pp.length ? Number(pp[pp.length - 1].est) || 0 : 0;
        var ultC = pp.length ? Number(pp[pp.length - 1].cota) || 0 : 0;
        pp.push({ est: st.perfil.modo === 'individual' ? 0 : ultX, cota: ultC, rot: '' });
        App.render(); return;
      }
      case 'delPontoPerfil': st.perfil.pontos.splice(Number(i), 1); App.render(); return;
      case 'limparPerfil':
        UI.confirmar('Limpar perfil', 'Remover todos os pontos do perfil da linha?',
          function () { st.perfil.pontos = []; App.render(); });
        return;

      /* curva da bomba */
      case 'colarCurva': PDA.Pf.modalColarCurva(st); return;
      case 'addPontoCurva': {
        if (!st.curvaBomba.pontos) st.curvaBomba.pontos = [];
        st.curvaBomba.pontos.push({ q: 0, H: 0 });
        App.render(); return;
      }
      case 'delPontoCurva': st.curvaBomba.pontos.splice(Number(i), 1); App.render(); return;

      /* marca */
      case 'logo': App.modalLogo(); return;

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
      case 'abrirProjeto': PDA.B.abrir(); return;
      case 'importarProjeto': UI.fecharModal(); App.abrirArquivo(App.carregarProjeto); return;
      case 'salvarProjeto': App.guardarNaBiblioteca(); return;
      case 'exportarProjeto': App.baixarProjeto(); return;
      case 'exemplo': PDA.B.abrir(); return;
      case 'exemploAgua':
        UI.fecharModal(); App.st = App.exemploAgua(); App.autoPreencherPNTodos();
        App.irPara('resumo'); return;
      case 'exemploEsgoto':
        UI.fecharModal(); App.st = App.exemploEsgoto(); App.autoPreencherPNTodos();
        App.irPara('resumo'); return;
      case 'abrirDaBiblioteca': {
        var reg = PDA.E.doBiblioteca(el.getAttribute('data-id'));
        if (!reg) { UI.toast('Projeto não encontrado.'); return; }
        App.st = PDA.E.migrar(PDA.E.clone(reg.st));
        App.st.id = reg.id;
        UI.fecharModal();
        App.irPara('resumo');
        UI.toast('Projeto "' + reg.nome + '" aberto.');
        return;
      }
      case 'duplicarDaBiblioteca': {
        var reg2 = PDA.E.doBiblioteca(el.getAttribute('data-id'));
        if (!reg2) return;
        App.st = PDA.E.migrar(PDA.E.clone(reg2.st));
        App.st.id = null;
        App.st.projeto.nome = (App.st.projeto.nome || 'Projeto') + ' (cópia)';
        UI.fecharModal();
        App.irPara('resumo');
        UI.toast('Cópia aberta. Use Salvar para guardá-la como um projeto novo.');
        return;
      }
      case 'excluirDaBiblioteca': {
        var id3 = el.getAttribute('data-id');
        var reg3 = PDA.E.doBiblioteca(id3);
        UI.confirmar('Excluir da biblioteca',
          'Excluir "' + (reg3 ? reg3.nome : id3) + '" da biblioteca deste navegador? ' +
          'O arquivo exportado, se houver, não é afetado.',
          function () {
            PDA.E.excluirDaBiblioteca(id3);
            UI.toast('Projeto excluído.');
            PDA.B.abrir();
          });
        return;
      }
      case 'ajuda': App.modalAjuda(); return;
      case 'tema':
        var atual = document.documentElement.getAttribute('data-tema') === 'escuro' ? 'claro' : 'escuro';
        document.documentElement.setAttribute('data-tema', atual);
        PDA.E.salvarConfig({ tema: atual, aba: App.aba });
        return;
    }
  };

  /* Preenche o PN do trecho com o do catálogo, quando houver. Só age
     enquanto o usuário não tiver informado um valor próprio. */
  App.autoPreencherPN = function (caminhoConj) {
    var conj = UI.get(App.st, caminhoConj);
    if (!conj || conj.pnAuto === false) return;
    var ctx;
    try { ctx = PDA.C.contexto(App.st, App.cats); } catch (e) { return; }
    var tubo = PDA.C.resolverTubo(conj, ctx);
    if (tubo && tubo.item && tubo.item.pn && conj.itemRot) {
      conj.pnMcaOverride = Number(tubo.item.pn) * 10;
    } else {
      conj.pnMcaOverride = null;
    }
  };

  /* Aplica o preenchimento automático a todos os trechos de adutora */
  App.autoPreencherPNTodos = function () {
    App.st.adutoras.forEach(function (a, i) { App.autoPreencherPN('adutoras.' + i); });
  };

  /* Move um item de posição dentro de um array do estado */
  App.moverItem = function (caminho, de, para) {
    var arr = UI.get(App.st, caminho);
    if (!Array.isArray(arr)) return;
    if (de < 0 || de >= arr.length) return;
    para = Math.max(0, Math.min(arr.length - 1, para));
    if (de === para) return;
    var item = arr.splice(de, 1)[0];
    arr.splice(para, 0, item);
    App.render();
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

  /* Guarda o projeto atual na biblioteca do navegador */
  App.guardarNaBiblioteca = function () {
    var st = App.st;
    if (!st.projeto.nome || st.projeto.nome === PDA.E.padrao().projeto.nome) {
      App.pedirNome();
      return;
    }
    var r = PDA.E.guardar(st, App.agora());
    if (!r.ok) {
      UI.modal('Não foi possível guardar', [
        h('p', {}, 'O armazenamento do navegador está cheio. Exclua projetos antigos na biblioteca ' +
                   'ou exporte este projeto em arquivo.'),
        h('div', { class: 'linha', style: 'margin-top:10px' },
          h('button', { class: 'btn primario', type: 'button', onclick: function () { UI.fecharModal(); App.baixarProjeto(); } }, 'Exportar em arquivo'),
          h('button', { class: 'btn', type: 'button', onclick: function () { UI.fecharModal(); PDA.B.abrir(); } }, 'Abrir a biblioteca'))
      ]);
      return;
    }
    App.render();
    UI.toast(r.novo ? 'Projeto guardado na biblioteca.' : 'Projeto atualizado na biblioteca.');
  };

  App.pedirNome = function () {
    var inp = h('input', { type: 'text', value: App.st.projeto.nome || '', placeholder: 'Ex.: EEE Jardim Aeroporto — LR até a ETE' });
    var loc = h('input', { type: 'text', value: App.st.projeto.local || '', placeholder: 'Cidade / obra' });
    var resp = h('input', { type: 'text', value: App.st.projeto.responsavel || '', placeholder: 'Responsável técnico' });
    UI.modal('Nome do projeto', [
      h('p', { class: 'nota' },
        'A biblioteca organiza os projetos por estes campos. Dê um nome antes de guardar — ' +
        'os outros dois são opcionais e ajudam a achar depois.'),
      h('div', { class: 'grade', style: 'margin-top:10px' },
        h('label', { class: 'campo chave' }, h('span', { class: 'rot' }, 'Projeto / obra'), inp),
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Local'), loc),
        h('label', { class: 'campo' }, h('span', { class: 'rot' }, 'Responsável técnico'), resp))
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button', onclick: function () {
          if (!inp.value.trim()) { UI.toast('Informe o nome do projeto.'); return; }
          App.st.projeto.nome = inp.value.trim();
          App.st.projeto.local = loc.value.trim();
          App.st.projeto.responsavel = resp.value.trim();
          UI.fecharModal();
          App.guardarNaBiblioteca();
        }
      }, 'Guardar')
    ]);
    setTimeout(function () { inp.focus(); inp.select(); }, 30);
  };

  /* data/hora atual em ISO — isolada para poder ser fixada nos testes */
  App.agora = function () { return new Date().toISOString(); };

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
    App.autoPreencherPNTodos();
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

  App.imprimir = function () {
    App.montarCabecalhoImpressao(App.st, null, null);
    UI.fecharModal();
    window.print();
  };

  App.modalLogo = function () {
    var atual = PDA.M.logoGravada();
    var previa = h('div', { style: 'margin:11px 0;min-height:52px;display:flex;align-items:center;gap:11px' });
    function mostrar() {
      UI.limpar(previa);
      previa.appendChild(PDA.M.marca(42));
    }
    mostrar();

    var entrada = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/svg+xml,image/webp' });
    entrada.addEventListener('change', function () {
      var f = entrada.files && entrada.files[0];
      if (!f) return;
      if (f.size > 900 * 1024) {
        UI.toast('Arquivo muito grande (máx. 900 kB). Reduza a imagem e tente de novo.');
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        if (!PDA.M.gravarLogo(String(fr.result))) {
          UI.toast('Não foi possível gravar a logo neste navegador.');
          return;
        }
        App.montarMarca();
        mostrar();
        UI.toast('Logo carregada.');
      };
      fr.readAsDataURL(f);
    });

    UI.modal('Logo do cabeçalho', [
      h('p', { class: 'nota' },
        'O símbolo que aparece hoje é um desenho vetorial feito para acompanhar as cores da marca. ' +
        'Carregue aqui o arquivo oficial (PNG com fundo transparente, JPG ou SVG) e ele substitui o desenho — ' +
        'no cabeçalho e na impressão do memorial. Fica gravado neste navegador; em outro computador, ' +
        'é preciso carregar de novo.'),
      previa,
      entrada,
      h('p', { class: 'nota', style: 'margin-top:9px' },
        'Prefira uma imagem com cerca de 400 px de largura e fundo transparente. Limite de 900 kB.'),
      atual ? h('div', { style: 'margin-top:11px' },
        h('button', {
          class: 'btn perigo', type: 'button', onclick: function () {
            PDA.M.removerLogo(); App.montarMarca(); mostrar(); UI.toast('Logo removida.');
          }
        }, 'Remover a logo carregada e voltar ao desenho')) : null
    ]);
  };

  App.modalAjuda = function () {
    UI.modal('Como usar', [
      h('div', { class: 'nota', style: 'font-size:13px;line-height:1.65' },
        h('p', {}, h('b', {}, 'O programa é um único arquivo.'), ' Não instala nada, não pede permissão de administrador ' +
          'e não envia dados para lugar nenhum: tudo roda no seu navegador. Copie o arquivo para um pen drive, ' +
          'uma pasta de rede ou o desktop e dê dois cliques.'),
        UI.sub('Sequência de trabalho'),
        h('ol', {},
          h('li', {}, h('b', {}, 'Resumo'), ' — comece aqui. Os campos com borda destacada são o essencial: vazão, fluido, cota de partida, cota de chegada e número de bombas. Logo abaixo já aparecem a altura geométrica, a altura manométrica e o panorama do sistema.'),
          h('li', {}, h('b', {}, 'Projeto'), ' — identificação da obra e condições do fluido (temperatura, altitude). Traz também a lista de conferência do preenchimento.'),
          h('li', {}, h('b', {}, 'Bombas e níveis'), ' — quantos conjuntos, quantos operam, rendimentos, o desenho das cotas, o NPSH disponível e, se quiser, a curva da bomba para achar o ponto de operação real.'),
          h('li', {}, h('b', {}, 'Sucção e Barriletes'), ' — as peças de cada trecho. O barrilete comum aceita um trecho por etapa de reunião das bombas, e a vazão de cada um acompanha quantas bombas ele coleta.'),
          h('li', {}, h('b', {}, 'Adutora / Recalque'), ' — um ou mais trechos em série. Quando a linha se ramifica, reduza a fração de vazão do trecho e escolha um diâmetro menor. É aqui também que entram os dados do transitório.'),
          h('li', {}, h('b', {}, 'Perfil da linha'), ' — cole as estacas e as cotas da sua planilha para ver as envoltórias de pressão máxima e mínima ao longo de toda a linha.'),
          h('li', {}, h('b', {}, 'Resultados'), ' — composição das perdas, cenários por número de bombas, linha piezométrica, transitório e memorial pronto para imprimir.'),
          h('li', {}, h('b', {}, 'Parâmetros de cálculo'), ' — fórmula de perda de carga, faixas que definem as cores, custos da análise econômica e linha de motores. Tudo já vem com valor padrão; só entre aqui quando precisar mudar um critério.')),
        UI.sub('As cotas'),
        h('p', {}, 'Todos os campos de cota pedem ', h('b', {}, 'altitude absoluta'), ', na mesma referência de nível ' +
          'do seu levantamento — não profundidade nem altura em relação ao fundo do poço. ' +
          'O desenho esquemático em Resumo e em Bombas e níveis mostra onde cada uma entra. ' +
          'A cota de chegada e a cota final do último trecho da adutora são o mesmo número: ao editar uma, ' +
          'o programa ajusta a outra.'),
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
        UI.sub('Sinais de atenção'),
        h('p', {}, 'Um ', h('b', {}, '!'), ' ao lado de um resultado marca algo que costuma passar batido: ' +
          'perdas de carga acima de 60 % da altura manométrica, altura manométrica muito maior que a geométrica, ' +
          'motor com folga excessiva, NPSH apertado, pressão negativa ou acima da classe do tubo. ' +
          'Passe o mouse para ver o motivo. O número em âmbar sobre a aba Resultados conta quantos pontos ' +
          'estão fora de faixa; sobre a aba Resumo, avisa que há incoerência nos dados de entrada.'),
        UI.sub('Guardar e reabrir projetos'),
        h('p', {}, h('b', {}, 'Salvar'), ' guarda o projeto na biblioteca deste navegador, identificado pelo nome, ' +
          'local, responsável e data. ', h('b', {}, 'Abrir'), ' mostra a biblioteca: dá para filtrar e ordenar por ' +
          'qualquer coluna clicando no título, abrir, duplicar ou excluir. Os exemplos ficam na mesma tela. ' +
          'Atalhos: Ctrl+S guarda, Ctrl+O abre.'),
        h('p', {}, h('b', {}, 'Exportar'), ' gera um arquivo .json para levar o projeto a outro computador ou anexar ' +
          'ao processo; na biblioteca, "Abrir de arquivo" faz o caminho de volta. Além disso, o projeto em andamento ' +
          'é guardado sozinho a cada alteração, então fechar o navegador não perde nada.'),
        UI.sub('Ordem das peças e dos trechos'),
        h('p', {}, 'Arraste pela alça ⠿ ou use as setas ↑ ↓ para reordenar peças, trechos de barrilete, trechos de ' +
          'adutora e pontos de perfil. A ordem não muda o resultado do cálculo — a perda é a soma das parcelas — ' +
          'mas deixa a lista na sequência física da instalação, o que ajuda na conferência e na lista de materiais.'),
        UI.sub('Impressão'),
        h('p', {}, 'O que sai no papel é a mesma tela que você está vendo, com as cores das tabelas e os desenhos, ' +
          'mais um cabeçalho com a logo e a identificação do projeto. Os comandos somem e os campos viram texto. ' +
          'Imprima a aba que interessa: a aba Resultados traz o memorial completo. Para as tabelas largas, ' +
          'escolha orientação paisagem na janela de impressão.'),
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
