/* ------------------------------------------------------------------
 * Modelo de dados do projeto, persistência e catálogos do usuário
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var E = {};
  var LS_PROJ = 'pda.projeto.v1';
  var LS_CAT  = 'pda.catalogos.v1';
  var LS_CFG  = 'pda.config.v1';

  E.VERSAO = 1;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  E.clone = clone;

  function novoConjunto(rot, catId, itemRot, tipo) {
    return {
      ativo: true,
      rot: rot,
      tipo: tipo || 'barrilete',
      catalogoId: catId || 'fd_flg_agua',
      itemRot: itemRot || '',
      idade: 'novo',
      materialOverride: '',
      cOverride: null,
      epsOverride: null,
      extensao: 0,
      unidExt: 'm',
      pnMcaOverride: null,
      pnAuto: true,          /* enquanto verdadeiro, o PN acompanha o catálogo */
      pecas: []
    };
  }
  E.novoConjunto = novoConjunto;

  /* dnLocal: DN comercial da peça, quando diferente do tubo do trecho.
     O DI é buscado no catálogo do trecho — assim não é preciso lembrar o DI. */
  E.novaPeca = function (pecaId) {
    return { pecaId: pecaId || 'curva90', qtd: 1, kOverride: null,
             dnLocal: '', diLocalMm: null };
  };

  /* modelo: trecho anterior de onde herdar catálogo, diâmetro e material —
     evita que um trecho novo nasça sem diâmetro e fique fora do cálculo */
  E.novoTrechoComum = function (n, tipo, modelo) {
    var c = novoConjunto('Trecho ' + n, 'fd_flg_agua', '', tipo || 'barrilete');
    c.nBombas = n;               /* nº de bombas que o trecho coleta */
    if (modelo) E.herdarTubo(c, modelo);
    return c;
  };

  /* copia do modelo o que define o tubo, mantendo o que é próprio do trecho */
  E.herdarTubo = function (alvo, modelo) {
    alvo.catalogoId = modelo.catalogoId;
    alvo.itemRot = modelo.itemRot;
    alvo.idade = modelo.idade;
    alvo.materialOverride = modelo.materialOverride;
    alvo.cOverride = modelo.cOverride;
    alvo.epsOverride = modelo.epsOverride;
    alvo.unidExt = modelo.unidExt;
    alvo.pnMcaOverride = modelo.pnMcaOverride;
    alvo.pnAuto = modelo.pnAuto;
    return alvo;
  };

  E.novaAdutora = function (i, modelo) {
    var a = novoConjunto('Trecho ' + i, 'fd_k7', '', 'adutora');
    if (modelo) E.herdarTubo(a, modelo);
    a.extensao = 0;
    a.cotaIni = 0;
    a.cotaFim = 0;
    a.usarCotas = false;         /* quando falso, o Hg vem das cotas globais */
    a.vazaoModo = 'pct';         /* 'pct' = fração da vazão total | 'abs' */
    a.vazaoPct = 100;
    a.vazaoAbs = 0;
    a.unidVazaoAbs = 'L/s';
    return a;
  };

  /* ---------------- projeto padrão ---------------- */
  E.padrao = function () {
    var st = {
      versao: E.VERSAO,
      projeto: {
        nome: 'Pré-dimensionamento de adutora / linha de recalque',
        local: '', responsavel: '', data: '', obs: ''
      },
      fluido: { tipo: 'agua_tratada', temperatura: 20, altitude: 0 },
      calculo: {
        metodo: 'colebrook',
        comparar: true,
        hwK: PDA.H.HW.k, hwExpQ: PDA.H.HW.expQ, hwExpD: PDA.H.HW.expD
      },
      vazao: { valor: 100, unidade: 'L/s', base: 'total' },
      bombas: {
        instaladas: 3, operando: 2,
        tipo: 'afogada',
        rendBomba: 70, rendMotor: 92, usarRendMotor: false,
        folgaModo: 'auto', folgaPct: 10,
        motores: PDA.P.motores.slice()
      },
      cotas: {
        nivelSuccaoMin: 0, nivelSuccaoMax: 0, eixoBomba: 0,
        cotaPartida: null,        /* em branco = igual ao nível de sucção mínimo */
        nivelChegada: 0,
        unid: 'm'
      },
      criterios: clone(PDA.P.criterios),
      succaoIndividual: novoConjunto('Sucção individual (por bomba)', 'fd_flg_agua', '', 'succao'),
      succaoComum: { ativo: false, trechos: [] },
      barrileteIndividual: novoConjunto('Barrilete de recalque individual (por bomba)', 'fd_flg_agua', '', 'barrilete'),
      barrileteComum: { ativo: true, trechos: [] },
      adutoras: [E.novaAdutora(1)],
      golpe: {
        avaliar: true, tempoManobra: 5,
        ancoragem: 'juntas',      /* ver PDA.H.ancoragem */
        psi: 1.0                  /* usado apenas quando ancoragem = 'manual' */
      },
      /* perfil da linha colado de planilha, para a envoltória de pressões */
      perfil: {
        ativo: false, modo: 'acumulada', unidExt: 'm', pontos: []
      },
      /* curva da bomba informada por pontos (Q, H) */
      curvaBomba: {
        ativo: false, unidQ: 'L/s', pontos: [], npshr: null
      },
      /* análise econômica de diâmetro */
      economia: {
        ativo: false, tarifa: 0.65, horasDia: 20, anos: 20, taxa: 8,
        custoA: 0.9, custoB: 1.45, custoInstalacao: 40
      },
      selecao: {}   /* { conjuntoKey: itemRot } escolhas manuais de diâmetro */
    };

    /* Um projeto em branco começa sem trechos de barrilete lançados: o
       usuário liga o que existir na instalação. Assim nada é presumido e a
       tela não abre com pendências. */
    st.succaoIndividual.ativo = false;
    st.barrileteIndividual.ativo = false;
    st.barrileteIndividual.pecas = [
      E.novaPeca('vr'), E.novaPeca('vg'), E.novaPeca('curva90'), E.novaPeca('junta_montagem')
    ];
    st.barrileteIndividual.pecas[2].qtd = 2;
    st.barrileteIndividual.pecas[3].qtd = 2;

    st.barrileteComum.ativo = false;
    st.barrileteComum.trechos = [E.novoTrechoComum(1, 'barrilete')];
    st.barrileteComum.trechos[0].pecas = [E.novaPeca('te_direta'), E.novaPeca('medidor_vazao')];

    return st;
  };

  /* ---------------- catálogos do usuário ---------------- */

  E.carregarCatalogos = function () {
    var extras = [];
    try {
      var raw = localStorage.getItem(LS_CAT);
      if (raw) extras = JSON.parse(raw) || [];
    } catch (e) { extras = []; }
    return { padrao: PDA.CAT.padrao, usuario: extras, todos: PDA.CAT.padrao.concat(extras) };
  };

  E.salvarCatalogos = function (usuario) {
    try { localStorage.setItem(LS_CAT, JSON.stringify(usuario)); return true; }
    catch (e) { return false; }
  };

  /* ---------------- biblioteca de projetos ----------------
     Guardada no navegador. Cada registro traz os campos de identificação
     soltos, para a lista poder ser ordenada sem abrir o projeto. */

  var LS_BIB = 'pda.biblioteca.v1';

  E.biblioteca = function () {
    try { return JSON.parse(localStorage.getItem(LS_BIB) || '[]') || []; }
    catch (e) { return []; }
  };

  E.gravarBiblioteca = function (lista) {
    try { localStorage.setItem(LS_BIB, JSON.stringify(lista)); return true; }
    catch (e) { return false; }
  };

  /* Guarda o projeto. Atualiza o registro de mesmo id, ou cria um novo. */
  E.guardar = function (st, quandoISO) {
    var lista = E.biblioteca();
    if (!st.id) st.id = 'prj_' + Math.random().toString(36).slice(2, 10);
    var reg = {
      id: st.id,
      nome: st.projeto.nome || '(sem nome)',
      local: st.projeto.local || '',
      responsavel: st.projeto.responsavel || '',
      data: st.projeto.data || '',
      salvoEm: quandoISO,
      resumo: E.resumoCurto(st),
      st: clone(st)
    };
    var i = -1, k;
    for (k = 0; k < lista.length; k++) if (lista[k].id === reg.id) i = k;
    if (i >= 0) lista[i] = reg; else lista.unshift(reg);
    if (!E.gravarBiblioteca(lista)) return { ok: false, erro: 'sem espaço' };
    return { ok: true, novo: i < 0, total: lista.length };
  };

  E.excluirDaBiblioteca = function (id) {
    E.gravarBiblioteca(E.biblioteca().filter(function (r) { return r.id !== id; }));
  };

  E.doBiblioteca = function (id) {
    var lista = E.biblioteca(), i;
    for (i = 0; i < lista.length; i++) if (lista[i].id === id) return lista[i];
    return null;
  };

  /* linha de resumo mostrada na lista */
  E.resumoCurto = function (st) {
    var q = Number(st.vazao.valor) || 0;
    var trechos = (st.adutoras || []).filter(function (a) { return a.ativo !== false; });
    var ext = 0;
    trechos.forEach(function (a) {
      ext += (Number(a.extensao) || 0) * (a.unidExt === 'km' ? 1000 : (a.unidExt === 'm' ? 1 : 1));
    });
    return {
      vazao: q, unidade: st.vazao.unidade,
      bombas: st.bombas.operando + '/' + st.bombas.instaladas,
      trechos: trechos.length,
      extensao: ext,
      fluido: st.fluido.tipo
    };
  };

  /* ---------------- persistência do projeto ---------------- */

  E.salvarLocal = function (st) {
    try { localStorage.setItem(LS_PROJ, JSON.stringify(st)); return true; }
    catch (e) { return false; }
  };

  E.carregarLocal = function () {
    try {
      var raw = localStorage.getItem(LS_PROJ);
      if (!raw) return null;
      return E.migrar(JSON.parse(raw));
    } catch (e) { return null; }
  };

  E.limparLocal = function () {
    try { localStorage.removeItem(LS_PROJ); } catch (e) {}
  };

  E.salvarConfig = function (cfg) {
    try { localStorage.setItem(LS_CFG, JSON.stringify(cfg)); } catch (e) {}
  };
  E.carregarConfig = function () {
    try { return JSON.parse(localStorage.getItem(LS_CFG) || '{}'); } catch (e) { return {}; }
  };

  /* Preenche campos ausentes em projetos gravados por versões anteriores */
  E.migrar = function (st) {
    var p = E.padrao();
    function fundir(alvo, base) {
      Object.keys(base).forEach(function (k) {
        if (alvo[k] === undefined || alvo[k] === null) {
          alvo[k] = clone(base[k]);
        } else if (typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof alvo[k] === 'object') {
          fundir(alvo[k], base[k]);
        }
      });
      return alvo;
    }
    st = fundir(st || {}, p);
    st.versao = E.VERSAO;
    return st;
  };

  PDA.E = E;
})(window.PDA = window.PDA || {});
