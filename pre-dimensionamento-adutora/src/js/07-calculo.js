/* ------------------------------------------------------------------
 * Motor de cálculo: monta o contexto, resolve cada conjunto de peças e
 * trechos, varre diâmetros e consolida os cenários de bombeamento.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var C = {};
  var H = PDA.H, U = PDA.U, R = PDA.R;

  /* ---------------- contexto ---------------- */

  C.contexto = function (st, catalogos) {
    var T = Number(st.fluido.temperatura);
    var ni = H.viscosidadeAgua(T);
    var rho = H.massaEspecificaAgua(T);
    H.HW.k = Number(st.calculo.hwK) || 10.643;
    H.HW.expQ = Number(st.calculo.hwExpQ) || 1.852;
    H.HW.expD = Number(st.calculo.hwExpD) || 4.871;

    var qtot = U.para('vazao', st.vazao.valor, st.vazao.unidade);
    var nOp = Math.max(1, Number(st.bombas.operando) || 1);
    var qBomba = st.vazao.base === 'porBomba' ? qtot : qtot / nOp;

    return {
      st: st,
      cats: catalogos,
      T: T, ni: ni, rho: rho,
      gama: rho * H.g,
      patm: H.pressaoAtmosferica(Number(st.fluido.altitude) || 0),
      pvapor: H.pressaoVaporAgua(T),
      metodo: st.calculo.metodo,
      fluido: st.fluido.tipo,
      qBomba: qBomba,
      nOp: nOp,
      nInst: Math.max(nOp, Number(st.bombas.instaladas) || nOp),
      qTotal: qBomba * nOp,
      familiaCriterio: (st.fluido.tipo.indexOf('esgoto') === 0 || st.fluido.tipo === 'lodo') ? 'esgoto' : 'agua'
    };
  };

  /* ---------------- resolução do tubo de um conjunto ---------------- */

  /* Retorna dados do tubo: catálogo, item, DI [m], espessura, C, eps [m] */
  C.resolverTubo = function (conj, ctx, itemRotForcado) {
    var cat = PDA.CAT.buscar(ctx.cats.todos, conj.catalogoId);
    if (!cat) return null;
    var rot = itemRotForcado || conj.itemRot;
    var item = null, i;
    for (i = 0; i < cat.itens.length; i++) if (cat.itens[i].rot === rot) item = cat.itens[i];
    if (!item) item = cat.itens[0];

    var diMm = PDA.CAT.diInterno(cat, item);
    var matId = conj.materialOverride || cat.material;
    var cons = R.consultar(matId, conj.idade, ctx.fluido) || { C: 130, eps: 0.1, fontes: [] };

    var Cval = (conj.cOverride !== null && conj.cOverride !== undefined && conj.cOverride !== '')
      ? Number(conj.cOverride) : cons.C;
    var epsMm = (conj.epsOverride !== null && conj.epsOverride !== undefined && conj.epsOverride !== '')
      ? Number(conj.epsOverride) : cons.eps;

    return {
      cat: cat, item: item,
      diMm: diMm, diM: diMm / 1000,
      eMm: item.e || null,
      material: matId,
      C: Cval, epsMm: epsMm, epsM: epsMm / 1000,
      cOverride: Cval !== cons.C, epsOverride: epsMm !== cons.eps,
      consulta: cons
    };
  };

  /* Pressão nominal do tubo em mca: o valor informado pelo usuário tem
     precedência sobre o PN do catálogo (que pode não estar cadastrado). */
  C.pnMca = function (conj, tubo) {
    if (conj && conj.pnMcaOverride !== null && conj.pnMcaOverride !== undefined && conj.pnMcaOverride !== '') {
      return Number(conj.pnMcaOverride);
    }
    if (tubo && tubo.item && tubo.item.pn) return Number(tubo.item.pn) * 10;
    return null;
  };

  /* ---------------- perdas de um conjunto ---------------- */

  /* conj: conjunto de peças + tubo ; Q [m³/s] */
  C.calcConjunto = function (conj, Q, ctx, itemRotForcado) {
    var tubo = C.resolverTubo(conj, ctx, itemRotForcado);
    var out = {
      conj: conj, tubo: tubo, Q: Q, v: 0, J: 0, hf: 0, hl: 0, htotal: 0,
      L: 0, somaK: 0, pecas: [], Re: 0, f: null, regime: null, erro: null
    };
    if (!tubo || !(tubo.diM > 0)) { out.erro = 'Diâmetro não definido'; return out; }

    out.L = U.para('extensao', conj.extensao || 0, conj.unidExt || 'm');

    var op = { metodo: ctx.metodo, C: tubo.C, eps: tubo.epsM, ni: ctx.ni };
    var d = H.perdaDistribuida(Q, tubo.diM, out.L, op);
    out.v = d.v; out.J = d.J; out.hf = d.hf; out.Re = d.Re; out.f = d.f; out.regime = d.regime;

    /* perdas localizadas */
    var todas = PDA.P.pecas;
    (conj.pecas || []).forEach(function (p) {
      var def = PDA.P.buscarPeca(todas, p.pecaId);
      if (!def) return;
      var K = (p.kOverride !== null && p.kOverride !== undefined && p.kOverride !== '')
        ? Number(p.kOverride) : def.K;
      var qtd = Number(p.qtd) || 0;
      var diLoc = (p.diLocalMm !== null && p.diLocalMm !== undefined && p.diLocalMm !== '' && Number(p.diLocalMm) > 0)
        ? Number(p.diLocalMm) / 1000 : tubo.diM;
      var vLoc = H.velocidade(Q, diLoc);
      var h = K * qtd * vLoc * vLoc / (2 * H.g);
      out.somaK += K * qtd;
      out.hl += h;
      out.pecas.push({ id: p.pecaId, rot: def.rot, K: K, kPadrao: def.K, qtd: qtd,
                       diMm: diLoc * 1000, v: vLoc, h: h, origem: def.origem });
    });

    out.htotal = out.hf + out.hl;
    return out;
  };

  /* ---------------- vazão de cada conjunto em um cenário ---------------- */

  /* n = nº de bombas operando no cenário */
  C.vazaoConjunto = function (chave, conj, n, ctx) {
    var q = ctx.qBomba;
    switch (chave) {
      case 'succaoIndividual':
      case 'barrileteIndividual':
        return q;
      case 'succaoComum':
      case 'barrileteComum':
        return Math.min(Number(conj.nBombas) || 1, n) * q;
      case 'adutora':
        var Qt = n * q;
        if (conj.vazaoModo === 'abs') return U.para('vazao', conj.vazaoAbs || 0, conj.unidVazaoAbs || 'L/s');
        return Qt * (Number(conj.vazaoPct) || 0) / 100;
    }
    return q;
  };

  /* ---------------- cenário completo ---------------- */

  C.cenario = function (st, ctx, n) {
    var res = {
      n: n, qBomba: ctx.qBomba, qTotal: n * ctx.qBomba,
      succao: [], recalque: [], adutoras: [],
      hfSuccao: 0, hlSuccao: 0, hSuccao: 0,
      hfRecalque: 0, hlRecalque: 0, hRecalque: 0,
      Hg: 0, Hm: 0, avisos: []
    };

    var submersivel = st.bombas.tipo === 'submersivel';

    /* --- sucção --- */
    if (!submersivel) {
      if (st.succaoIndividual.ativo) {
        var si = C.calcConjunto(st.succaoIndividual, C.vazaoConjunto('succaoIndividual', st.succaoIndividual, n, ctx), ctx);
        si.chave = 'succaoIndividual'; si.rot = st.succaoIndividual.rot;
        res.succao.push(si);
      }
      if (st.succaoComum.ativo) {
        st.succaoComum.trechos.forEach(function (t, i) {
          var r = C.calcConjunto(t, C.vazaoConjunto('succaoComum', t, n, ctx), ctx);
          r.chave = 'succaoComum.' + i; r.rot = t.rot || ('Sucção comum — trecho ' + (i + 1));
          res.succao.push(r);
        });
      }
    }

    /* --- recalque interno (barriletes) --- */
    if (st.barrileteIndividual.ativo) {
      var bi = C.calcConjunto(st.barrileteIndividual, C.vazaoConjunto('barrileteIndividual', st.barrileteIndividual, n, ctx), ctx);
      bi.chave = 'barrileteIndividual'; bi.rot = st.barrileteIndividual.rot;
      res.recalque.push(bi);
    }
    if (st.barrileteComum.ativo) {
      st.barrileteComum.trechos.forEach(function (t, i) {
        if (t.ativo === false) return;
        var r = C.calcConjunto(t, C.vazaoConjunto('barrileteComum', t, n, ctx), ctx);
        r.chave = 'barrileteComum.' + i;
        r.rot = t.rot || ('Barrilete comum — trecho ' + (i + 1));
        r.nBombas = Math.min(Number(t.nBombas) || 1, n);
        res.recalque.push(r);
      });
    }

    /* --- adutoras / linhas de recalque --- */
    st.adutoras.forEach(function (a, i) {
      if (a.ativo === false) return;
      var r = C.calcConjunto(a, C.vazaoConjunto('adutora', a, n, ctx), ctx);
      r.chave = 'adutoras.' + i; r.rot = a.rot || ('Adutora — trecho ' + (i + 1));
      res.adutoras.push(r);
    });

    res.succao.forEach(function (r) { res.hfSuccao += r.hf; res.hlSuccao += r.hl; });
    res.hSuccao = res.hfSuccao + res.hlSuccao;

    res.recalque.concat(res.adutoras).forEach(function (r) {
      res.hfRecalque += r.hf; res.hlRecalque += r.hl;
    });
    res.hRecalque = res.hfRecalque + res.hlRecalque;

    /* --- altura geométrica --- */
    var cot = st.cotas;
    var nsMin = Number(cot.nivelSuccaoMin) || 0;
    var nsMax = Number(cot.nivelSuccaoMax) || nsMin;
    var nch = Number(cot.nivelChegada) || 0;
    res.HgMax = nch - nsMin;      /* pior caso: nível de sucção mínimo */
    res.HgMin = nch - nsMax;
    res.Hg = res.HgMax;
    res.Hm = res.Hg + res.hSuccao + res.hRecalque;
    res.HmMin = res.HgMin + res.hSuccao + res.hRecalque;

    /* --- potências --- */
    var etaB = (Number(st.bombas.rendBomba) || 70) / 100;
    var etaM = (Number(st.bombas.rendMotor) || 92) / 100;
    res.potUtilCv = H.potenciaUtilCV(ctx.qBomba, res.Hm, ctx.gama);
    res.bhpCv = etaB > 0 ? res.potUtilCv / etaB : 0;
    res.bhpKw = H.cvParaKW(res.bhpCv);
    res.eletricaKw = st.bombas.usarRendMotor && etaM > 0 ? res.bhpKw / etaM : res.bhpKw;
    var folga = st.bombas.folgaModo === 'auto'
      ? PDA.P.folgaRecomendada(res.bhpCv) : (Number(st.bombas.folgaPct) || 0);
    res.folgaPct = folga;
    res.motorCv = PDA.P.motorComercial(res.bhpCv, folga, st.bombas.motores);
    res.motorKw = H.cvParaKW(res.motorCv);
    res.potTotalCv = res.bhpCv * n;
    res.potTotalKw = res.eletricaKw * n;

    /* --- NPSH disponível --- */
    var eixo = Number(cot.eixoBomba) || 0;
    res.zSuccao = nsMin - eixo;
    res.npshd = H.npshDisponivel(ctx.patm, ctx.pvapor, res.zSuccao, res.hfSuccao + res.hlSuccao);
    if (submersivel) res.npshd = null;

    /* --- avisos --- */
    if (res.Hm <= 0) res.avisos.push('Altura manométrica não positiva — revise cotas e perdas.');
    res.adutoras.concat(res.recalque).forEach(function (r) {
      if (r.regime === 'transicao') {
        res.avisos.push(r.rot + ': escoamento na zona de transição (2000 < Re < 4000) — o fator de atrito é indeterminado nessa faixa.');
      }
      if (r.regime === 'laminar') {
        res.avisos.push(r.rot + ': escoamento laminar (Re < 2000) — Hazen-Williams não é aplicável; usar a fórmula universal.');
      }
    });

    return res;
  };

  /* ---------------- classificação (cores) ---------------- */

  /* v [m/s], J [m/m] -> {classe:'bom'|'atencao'|'ruim', motivos:[]} */
  C.classificar = function (v, J, crit) {
    var jKm = J * 1000;
    var motivos = [], classe = 'bom';

    if (!(v > 0)) return { classe: 'na', motivos: ['sem vazão'] };

    if (v < crit.vMin) { classe = 'ruim'; motivos.push('v = ' + v.toFixed(2) + ' m/s abaixo da mínima de ' + crit.vMin.toFixed(2) + ' m/s'); }
    else if (v > crit.vMax) { classe = 'ruim'; motivos.push('v = ' + v.toFixed(2) + ' m/s acima da máxima de ' + crit.vMax.toFixed(2) + ' m/s'); }

    if (jKm > crit.jMax) { classe = 'ruim'; motivos.push('J = ' + jKm.toFixed(2) + ' m/km acima do limite de ' + crit.jMax.toFixed(2) + ' m/km'); }

    if (classe !== 'ruim') {
      var vOk = v >= crit.vBom[0] && v <= crit.vBom[1];
      var jOk = jKm >= crit.jBom[0] && jKm <= crit.jBom[1];
      if (vOk && jOk) { classe = 'bom'; motivos.push('velocidade e perda unitária na faixa recomendada'); }
      else {
        classe = 'atencao';
        if (!vOk) motivos.push('v = ' + v.toFixed(2) + ' m/s fora da faixa recomendada (' + crit.vBom[0].toFixed(2) + ' a ' + crit.vBom[1].toFixed(2) + ' m/s)');
        if (!jOk) motivos.push('J = ' + jKm.toFixed(2) + ' m/km fora da faixa recomendada (' + crit.jBom[0].toFixed(2) + ' a ' + crit.jBom[1].toFixed(2) + ' m/km)');
      }
    }
    return { classe: classe, motivos: motivos };
  };

  C.criterioDe = function (st, ctx, tipo) {
    var fam = ctx.familiaCriterio;
    var c = (st.criterios[fam] && st.criterios[fam][tipo]) || PDA.P.criterios[fam][tipo];
    return c;
  };

  /* ---------------- varredura de diâmetros ---------------- */

  /* Percorre todos os itens do catálogo do conjunto e devolve a tabela
     comparativa, já classificada, com o item recomendado. */
  C.varrer = function (st, ctx, conj, chave, n) {
    var cat = PDA.CAT.buscar(ctx.cats.todos, conj.catalogoId);
    if (!cat) return { linhas: [], cat: null };
    var tipo = conj.tipo || 'adutora';
    var crit = C.criterioDe(st, ctx, tipo);
    var Q = C.vazaoConjunto(chave.split('.')[0] === 'adutoras' ? 'adutora' : chave.split('.')[0], conj, n, ctx);

    /* vazões extremas para verificar autolimpeza e velocidade máxima */
    var raiz = chave.split('.')[0] === 'adutoras' ? 'adutora' : chave.split('.')[0];
    var Qmin = C.vazaoConjunto(raiz, conj, 1, ctx);
    var Qmax = C.vazaoConjunto(raiz, conj, ctx.nInst, ctx);

    var linhas = cat.itens.map(function (it) {
      var r = C.calcConjunto(conj, Q, ctx, it.rot);
      var cl = C.classificar(r.v, r.J, crit);
      var vMin1 = r.tubo.diM > 0 ? H.velocidade(Qmin, r.tubo.diM) : 0;
      var vMaxN = r.tubo.diM > 0 ? H.velocidade(Qmax, r.tubo.diM) : 0;
      return {
        item: it, rot: it.rot, diMm: r.tubo.diMm, eMm: r.tubo.eMm, pn: it.pn,
        v: r.v, J: r.J, jKm: r.J * 1000, hf: r.hf, hl: r.hl, htotal: r.htotal,
        Re: r.Re, f: r.f, regime: r.regime, C: r.tubo.C, epsMm: r.tubo.epsMm,
        classe: cl.classe, motivos: cl.motivos,
        vMin1: vMin1, vMaxN: vMaxN,
        autolimpeza: vMin1 >= crit.vMin,
        calc: !!it.calc, verificar: !!it.verificar
      };
    }).filter(function (l) { return l.diMm > 0; });

    /* recomendação: entre os "bons", o de menor diâmetro; se não houver,
       entre os "atenção", o de J mais próximo do centro da faixa boa */
    var alvoJ = (crit.jBom[0] + crit.jBom[1]) / 2;
    var bons = linhas.filter(function (l) { return l.classe === 'bom'; });
    var rec = null;
    if (bons.length) {
      rec = bons.reduce(function (a, b) { return a.diMm <= b.diMm ? a : b; });
    } else {
      var at = linhas.filter(function (l) { return l.classe === 'atencao'; });
      var pool = at.length ? at : linhas;
      if (pool.length) {
        rec = pool.reduce(function (a, b) {
          return Math.abs(a.jKm - alvoJ) <= Math.abs(b.jKm - alvoJ) ? a : b;
        });
      }
    }
    linhas.forEach(function (l) { l.recomendado = !!(rec && l.rot === rec.rot); });

    /* diâmetro de Bresse como referência */
    var bresse = { k07: H.bresse(Q, 0.7) * 1000, k10: H.bresse(Q, 1.0) * 1000, k13: H.bresse(Q, 1.3) * 1000 };

    return { linhas: linhas, cat: cat, crit: crit, Q: Q, Qmin: Qmin, Qmax: Qmax,
             recomendado: rec, bresse: bresse, tipo: tipo };
  };

  /* ---------------- linha piezométrica e verificação de pressão ---------------- */

  C.piezometrica = function (st, ctx, cen) {
    var nsMin = Number(st.cotas.nivelSuccaoMin) || 0;
    var pontos = [];
    var cotaAtual = nsMin;
    var hgl = nsMin + cen.Hm;   /* carga total logo após a bomba */

    pontos.push({ rot: 'Saída da elevatória', cota: cotaAtual, hgl: hgl, pressao: hgl - cotaAtual, trecho: null });

    /* perdas internas (barriletes) consumidas antes da adutora */
    var hInterno = 0;
    cen.recalque.forEach(function (r) { hInterno += r.htotal; });
    hgl -= hInterno;

    cen.adutoras.forEach(function (r, i) {
      var a = st.adutoras[i] || {};
      var ci = a.usarCotas ? Number(a.cotaIni) || 0 : cotaAtual;
      var cf = a.usarCotas ? Number(a.cotaFim) || 0 : cotaAtual;
      hgl -= r.htotal;
      cotaAtual = cf;
      pontos.push({
        rot: 'Fim de ' + r.rot, cota: cf, hgl: hgl, pressao: hgl - cf,
        trecho: r, cotaIni: ci, usarCotas: !!a.usarCotas,
        pnMca: C.pnMca(a, r.tubo)
      });
    });
    return pontos;
  };

  /* ---------------- transitório ---------------- */

  var MAP_ELAST = {
    pead: 'pead', pvc: 'pvc', pvc_m: 'pvc', pvc_o: 'pvc_o', prfv: 'prfv',
    fd_cimento: 'fd', fd_asfalto: 'fd', fd_sem_rev: 'fd',
    aco_sold_novo: 'aco', aco_rev_esp: 'aco', aco_galv: 'aco', aco_rebitado: 'aco',
    aco_inox: 'inox', concreto_liso: 'concreto', concreto_comum: 'concreto',
    cimento_amianto: 'fibrocim', cobre_latao: 'cobre', manilha_ceramica: 'concreto'
  };

  C.golpe = function (st, ctx, cen) {
    if (!st.golpe.avaliar || !cen.adutoras.length) return null;
    return cen.adutoras.map(function (r, i) {
      var a = st.adutoras[i] || {};
      var tubo = r.tubo;
      if (!tubo) return null;
      var ekey = MAP_ELAST[tubo.material] || 'aco';
      var E = (R.elasticidade[ekey] || { E: 210 }).E * 1e9;
      var eM = (tubo.eMm || 0) / 1000;
      var a_cel = eM > 0 ? H.celeridade(tubo.diM, eM, E, ctx.rho, 2.19e9, Number(st.golpe.psi) || 1) : null;
      var tc = a_cel ? H.tempoCritico(r.L, a_cel) : null;
      var t = Number(st.golpe.tempoManobra) || 0;
      var rapida = !tc || t <= tc;
      var dhJ = a_cel ? H.joukowsky(a_cel, r.v) : null;
      var dhM = t > 0 ? H.michaud(r.L, r.v, t) : null;
      var dh = rapida ? dhJ : Math.min(dhJ === null ? Infinity : dhJ, dhM === null ? Infinity : dhM);
      var pnMca = C.pnMca(a, tubo);

      return {
        rot: r.rot, material: tubo.material, materialRot: (R.elasticidade[ekey] || {}).rot,
        E_GPa: E / 1e9, eMm: tubo.eMm, diMm: tubo.diMm, L: r.L, v: r.v,
        celeridade: a_cel, tempoCritico: tc, tempoManobra: t, manobraRapida: rapida,
        dhJoukowsky: dhJ, dhMichaud: dhM, dh: dh,
        pressaoMaxMca: cen.Hm + (dh || 0),
        pnMca: pnMca,
        atende: pnMca === null ? null : (cen.Hm + (dh || 0)) <= pnMca
      };
    }).filter(Boolean);
  };

  /* ---------------- consolidação ---------------- */

  C.resumo = function (st, catalogos) {
    var ctx = C.contexto(st, catalogos);
    var cenarios = [], i;
    for (i = 1; i <= ctx.nInst; i++) cenarios.push(C.cenario(st, ctx, i));
    var proj = cenarios[ctx.nOp - 1] || cenarios[cenarios.length - 1];

    return {
      ctx: ctx,
      cenarios: cenarios,
      projeto: proj,
      piezometrica: C.piezometrica(st, ctx, proj),
      golpe: C.golpe(st, ctx, proj)
    };
  };

  /* Comparação entre métodos para o cenário de projeto */
  C.compararMetodos = function (st, catalogos) {
    var metodos = ['hw', 'colebrook', 'swamee', 'zigrang'];
    var orig = st.calculo.metodo;
    var out = metodos.map(function (m) {
      st.calculo.metodo = m;
      var res = C.resumo(st, catalogos);
      var p = res.projeto;
      return {
        metodo: m,
        hf: p.hfRecalque + p.hfSuccao,
        hl: p.hlRecalque + p.hlSuccao,
        Hm: p.Hm, bhp: p.bhpCv, motor: p.motorCv
      };
    });
    st.calculo.metodo = orig;
    return out;
  };

  C.rotMetodo = {
    hw: 'Hazen-Williams (C)',
    colebrook: 'Colebrook-White (iterativo)',
    swamee: 'Swamee-Jain',
    zigrang: 'Zigrang-Sylvester'
  };

  PDA.C = C;
})(window.PDA = window.PDA || {});
