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

  E.novoTrechoComum = function (n) {
    var c = novoConjunto('Trecho ' + n, 'fd_flg_agua', '', 'barrilete');
    c.nBombas = n;               /* nº de bombas que o trecho coleta */
    return c;
  };

  E.novaAdutora = function (i) {
    var a = novoConjunto('Trecho ' + i, 'fd_k7', '', 'adutora');
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

    st.succaoIndividual.ativo = false;
    st.barrileteIndividual.pecas = [
      E.novaPeca('vr'), E.novaPeca('vg'), E.novaPeca('curva90'), E.novaPeca('junta_montagem')
    ];
    st.barrileteIndividual.pecas[2].qtd = 2;
    st.barrileteIndividual.pecas[3].qtd = 2;

    st.barrileteComum.trechos = [E.novoTrechoComum(1)];
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
