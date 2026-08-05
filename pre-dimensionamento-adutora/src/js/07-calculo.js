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

  /* DI da peça em mm. Ordem de precedência:
       1. DI informado diretamente (campo avançado)
       2. DN comercial informado -> DI buscado no catálogo do trecho
       3. DI do próprio trecho */
  C.diPeca = function (p, tubo) {
    if (p.diLocalMm !== null && p.diLocalMm !== undefined && p.diLocalMm !== '' && Number(p.diLocalMm) > 0) {
      return Number(p.diLocalMm);
    }
    if (p.dnLocal !== null && p.dnLocal !== undefined && p.dnLocal !== '' && tubo && tubo.cat) {
      var it = C.itemPorRot(tubo.cat, p.dnLocal);
      if (it) return PDA.CAT.diInterno(tubo.cat, it);
    }
    return tubo ? tubo.diMm : 0;
  };

  C.itemPorRot = function (cat, rot) {
    var i;
    for (i = 0; i < cat.itens.length; i++) if (cat.itens[i].rot === rot) return cat.itens[i];
    return null;
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
      var diLoc = C.diPeca(p, tubo) / 1000;
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
    res.cotaPartida = C.cotaPartida(st);
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

  /* Cota de partida da adutora: campo próprio ou, em branco, o nível de
     sucção mínimo (a linha piezométrica sai da elevatória) */
  C.cotaPartida = function (st) {
    var c = st.cotas;
    if (c.cotaPartida === null || c.cotaPartida === undefined || c.cotaPartida === '') {
      return Number(c.nivelSuccaoMin) || 0;
    }
    return Number(c.cotaPartida);
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

  /* Classificação de uma carga de pressão contra o PN do tubo E contra os
     limites físicos. Pressão negativa NUNCA é adequada: significa que a linha
     piezométrica passa abaixo da tubulação, o que em regime permanente indica
     que a bomba não entrega carga suficiente para o ponto (ou que as cotas
     estão incoerentes). */
  C.classificarPressao = function (pressao, pnMca, op) {
    op = op || {};
    if (pressao === null || pressao === undefined || isNaN(pressao)) {
      return { classe: 'na', motivos: [] };
    }
    var mot = [];
    /* limite inferior: abaixo de -10 mca a coluna d'água se rompe */
    if (pressao <= -10) {
      mot.push('pressão de ' + pressao.toFixed(2) + ' mca: abaixo do limite físico de vaporização (cerca de −10 mca) — ' +
               (op.transitorio ? 'há separação de coluna neste ponto' : 'a linha piezométrica passa muito abaixo da tubulação, o escoamento previsto é impossível'));
      return { classe: 'ruim', motivos: mot };
    }
    if (pressao < 0) {
      mot.push('pressão negativa de ' + pressao.toFixed(2) + ' mca: a linha piezométrica passa abaixo da tubulação' +
               (op.transitorio ? ' — risco de cavitação e, em tubo de parede fina, de colapso' : ' — reveja as cotas e a altura manométrica'));
      return { classe: 'ruim', motivos: mot };
    }
    var pMin = op.pressaoMinima === undefined ? 0 : op.pressaoMinima;
    if (pressao < pMin) {
      mot.push('pressão de ' + pressao.toFixed(2) + ' mca abaixo da mínima adotada de ' + pMin.toFixed(2) + ' mca');
      return { classe: 'atencao', motivos: mot };
    }
    if (pnMca === null || pnMca === undefined) {
      return { classe: 'na', motivos: ['pressão admissível do tubo não informada'] };
    }
    if (pressao > pnMca) {
      mot.push('pressão de ' + pressao.toFixed(2) + ' mca acima da admissível do tubo (' + pnMca.toFixed(0) + ' mca)');
      return { classe: 'ruim', motivos: mot };
    }
    if (pressao > 0.85 * pnMca) {
      mot.push('pressão de ' + pressao.toFixed(2) + ' mca usa mais de 85 % da admissível do tubo (' + pnMca.toFixed(0) + ' mca)');
      return { classe: 'atencao', motivos: mot };
    }
    mot.push('pressão de ' + pressao.toFixed(2) + ' mca, com folga sobre a admissível de ' + pnMca.toFixed(0) + ' mca');
    return { classe: 'bom', motivos: mot };
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

    var ecoAtiva = st.economia && st.economia.ativo && tipo === 'adutora';

    var linhas = cat.itens.map(function (it) {
      var r = C.calcConjunto(conj, Q, ctx, it.rot);
      var cl = C.classificar(r.v, r.J, crit);
      var vMin1 = r.tubo.diM > 0 ? H.velocidade(Qmin, r.tubo.diM) : 0;
      var vMaxN = r.tubo.diM > 0 ? H.velocidade(Qmax, r.tubo.diM) : 0;
      var eco = ecoAtiva ? C.custoAnual(st, ctx, cat, it, r.tubo.diMm, r.L, r.htotal, Q) : null;
      return {
        eco: eco,
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

    /* ótimo econômico: menor custo anual total entre os que não são reprovados */
    var eco = null;
    if (ecoAtiva) {
      var cand = linhas.filter(function (l) { return l.classe !== 'ruim' && l.eco; });
      if (!cand.length) cand = linhas.filter(function (l) { return l.eco; });
      if (cand.length) {
        eco = cand.reduce(function (a, b) { return a.eco.anualTotal <= b.eco.anualTotal ? a : b; });
        linhas.forEach(function (l) { l.otimoEconomico = (l.rot === eco.rot); });
      }
    }

    /* diâmetro de Bresse como referência */
    var bresse = { k07: H.bresse(Q, 0.7) * 1000, k10: H.bresse(Q, 1.0) * 1000, k13: H.bresse(Q, 1.3) * 1000 };

    return { linhas: linhas, cat: cat, crit: crit, Q: Q, Qmin: Qmin, Qmax: Qmax,
             recomendado: rec, otimoEconomico: eco, ecoAtiva: ecoAtiva,
             bresse: bresse, tipo: tipo };
  };

  /* ---------------- linha piezométrica e verificação de pressão ---------------- */

  C.piezometrica = function (st, ctx, cen) {
    var nsMin = Number(st.cotas.nivelSuccaoMin) || 0;
    var partida = C.cotaPartida(st);
    var pontos = [];
    var hgl = nsMin + cen.Hm;   /* carga total logo após a bomba */

    /* perdas internas (barriletes) consumidas antes da adutora */
    var hInterno = 0;
    cen.recalque.forEach(function (r) { hInterno += r.htotal; });

    pontos.push({ rot: 'Saída da elevatória', cota: partida, hgl: hgl - hInterno,
                  pressao: hgl - hInterno - partida, trecho: null, pnMca: null, x: 0 });
    hgl -= hInterno;

    var x = 0;
    cen.adutoras.forEach(function (r) {
      var a = r.conj;
      hgl -= r.htotal;
      x += r.L;
      var cf = a.usarCotas ? (Number(a.cotaFim) || 0) : Number(st.cotas.nivelChegada) || 0;
      pontos.push({
        rot: 'Fim de ' + r.rot, cota: cf, hgl: hgl, pressao: hgl - cf,
        trecho: r, usarCotas: !!a.usarCotas, x: x,
        pnMca: C.pnMca(a, r.tubo)
      });
    });

    pontos.forEach(function (p) {
      var cl = C.classificarPressao(p.pressao, p.pnMca);
      p.classe = cl.classe; p.motivos = cl.motivos;
    });
    return pontos;
  };

  /* ---------------- coerência dos dados ----------------
     Devolve a lista de incoerências que o programa não pode resolver sozinho.
     Cada item traz uma ação de correção, aplicável com um clique. */

  C.validar = function (st, ctx, res) {
    var av = [];
    var ativas = st.adutoras.filter(function (a) { return a.ativo !== false; });
    var ultima = ativas[ativas.length - 1];
    var nch = Number(st.cotas.nivelChegada) || 0;
    var partida = C.cotaPartida(st);

    if (ultima && ultima.usarCotas) {
      var cf = Number(ultima.cotaFim) || 0;
      if (Math.abs(cf - nch) > 0.01) {
        av.push({
          id: 'cotaChegada',
          grave: true,
          txt: 'A cota de chegada informada em "Bombas e níveis" é ' + nch.toFixed(2) +
               ' m, mas a cota final do último trecho da adutora ("' + (ultima.rot || 'trecho') +
               '") é ' + cf.toFixed(2) + ' m. A altura geométrica é calculada com a cota de chegada, ' +
               'e o perfil é desenhado com as cotas dos trechos — com valores diferentes, os dois se contradizem.',
          acoes: [
            { rot: 'Usar ' + cf.toFixed(2) + ' m como cota de chegada', acao: 'sincCotaChegada' },
            { rot: 'Ajustar o trecho para terminar em ' + nch.toFixed(2) + ' m', acao: 'sincCotaTrecho' }
          ]
        });
      }
    }

    var primeira = ativas[0];
    if (primeira && primeira.usarCotas && Math.abs((Number(primeira.cotaIni) || 0) - partida) > 0.01) {
      av.push({
        id: 'cotaPartida',
        txt: 'A cota de partida da adutora é ' + partida.toFixed(2) + ' m, mas o primeiro trecho começa em ' +
             (Number(primeira.cotaIni) || 0).toFixed(2) + ' m.',
        acoes: [{ rot: 'Ajustar o primeiro trecho para começar em ' + partida.toFixed(2) + ' m', acao: 'sincCotaPartida' }]
      });
    }

    if (Number(st.cotas.nivelSuccaoMax) < Number(st.cotas.nivelSuccaoMin)) {
      av.push({
        id: 'niveis', grave: true,
        txt: 'O nível de sucção máximo (' + Number(st.cotas.nivelSuccaoMax).toFixed(2) +
             ' m) está abaixo do mínimo (' + Number(st.cotas.nivelSuccaoMin).toFixed(2) + ' m).',
        acoes: [{ rot: 'Trocar os dois valores', acao: 'trocarNiveis' }]
      });
    }

    /* cota do eixo muito distante do nível de sucção sugere unidades diferentes */
    var eixo = Number(st.cotas.eixoBomba) || 0;
    if (Math.abs(eixo - Number(st.cotas.nivelSuccaoMin)) > 50) {
      av.push({
        id: 'eixoDistante',
        txt: 'A cota do eixo da bomba (' + eixo.toFixed(2) + ' m) está a mais de 50 m do nível de sucção mínimo (' +
             Number(st.cotas.nivelSuccaoMin).toFixed(2) + ' m). Confirme que os dois campos estão na mesma ' +
             'referência de nível — os quatro campos de cota pedem ALTITUDE ABSOLUTA, não profundidade.',
        acoes: []
      });
    }

    if (st.perfil.ativo && st.perfil.pontos.length > 1) {
      var lPerfil = C.perfilPontos(st).ultimoX;
      var lTrechos = 0;
      res.projeto.adutoras.forEach(function (r) { lTrechos += r.L; });
      if (lTrechos > 0 && Math.abs(lPerfil - lTrechos) / lTrechos > 0.02) {
        av.push({
          id: 'perfilExtensao',
          txt: 'A extensão do perfil colado é ' + lPerfil.toFixed(0) + ' m, e a soma das extensões dos trechos ' +
               'da adutora é ' + lTrechos.toFixed(0) + ' m. A envoltória de pressões usa a extensão dos trechos ' +
               'e interpola o perfil proporcionalmente.',
          acoes: []
        });
      }
    }

    return av;
  };

  /* ---------------- perfil da linha ---------------- */

  /* Converte os pontos colados (estaca/extensão + cota) em pontos com
     distância acumulada em metros, ordenados. */
  C.perfilPontos = function (st) {
    var p = st.perfil;
    var f = U[('extensao')][p.unidExt || 'm'].f;
    var acum = 0, saida = [];
    (p.pontos || []).forEach(function (pt) {
      var d = Number(pt.est) || 0;
      var x = p.modo === 'individual' ? (acum += d * f) : d * f;
      saida.push({ x: x, cota: Number(pt.cota) || 0, rot: pt.rot || '' });
    });
    saida.sort(function (a, b) { return a.x - b.x; });
    return { pontos: saida, ultimoX: saida.length ? saida[saida.length - 1].x : 0 };
  };

  /* ---------------- envoltória de pressões ----------------
     Traçado de anteprojeto: a partir da linha piezométrica em regime
     permanente (piecewise linear pelos trechos), soma e subtrai uma
     sobrepressão que vale Δh na elevatória e decai linearmente até zero no
     ponto de chegada (nível fixo do reservatório). */

  C.envoltoria = function (st, ctx, cen, golpe) {
    var perfil = C.perfilPontos(st);
    if (!perfil.pontos.length) return null;

    var nsMin = Number(st.cotas.nivelSuccaoMin) || 0;
    var hInterno = 0;
    cen.recalque.forEach(function (r) { hInterno += r.htotal; });

    /* linha piezométrica permanente em nós de trecho */
    var nos = [{ x: 0, hgl: nsMin + cen.Hm - hInterno }];
    var x = 0;
    cen.adutoras.forEach(function (r) {
      x += r.L;
      nos.push({ x: x, hgl: nos[nos.length - 1].hgl - r.htotal });
    });
    var lTrechos = x;
    if (!(lTrechos > 0)) return null;

    /* maior Δh entre os trechos, e escala do perfil */
    var dh = 0;
    (golpe || []).forEach(function (g) { if (isFinite(g.dh) && g.dh > dh) dh = g.dh; });
    var escala = perfil.ultimoX > 0 ? lTrechos / perfil.ultimoX : 1;

    function hglEm(xx) {
      var i;
      for (i = 1; i < nos.length; i++) {
        if (xx <= nos[i].x || i === nos.length - 1) {
          var a = nos[i - 1], b = nos[i];
          var t = b.x > a.x ? (xx - a.x) / (b.x - a.x) : 0;
          return a.hgl + (b.hgl - a.hgl) * Math.min(1, Math.max(0, t));
        }
      }
      return nos[nos.length - 1].hgl;
    }

    /* PN por posição: do trecho correspondente */
    function pnEm(xx) {
      var acc = 0, i;
      for (i = 0; i < cen.adutoras.length; i++) {
        acc += cen.adutoras[i].L;
        if (xx <= acc + 1e-9) return C.pnMca(cen.adutoras[i].conj, cen.adutoras[i].tubo);
      }
      var u = cen.adutoras[cen.adutoras.length - 1];
      return u ? C.pnMca(u.conj, u.tubo) : null;
    }

    var pontos = perfil.pontos.map(function (pt) {
      var xx = pt.x * escala;
      var frac = 1 - Math.min(1, Math.max(0, xx / lTrechos));   /* Δh cheio na bomba, zero na chegada */
      var hglP = hglEm(xx);
      var pn = pnEm(xx);
      var pPerm = hglP - pt.cota;
      var pMax = hglP + dh * frac - pt.cota;
      var pMin = hglP - dh * frac - pt.cota;
      var clPerm = C.classificarPressao(pPerm, pn);
      var clMax = C.classificarPressao(pMax, pn, { transitorio: true });
      var clMin = C.classificarPressao(pMin, pn, { transitorio: true });
      var pior = [clPerm, clMax, clMin].reduce(function (a, b) {
        var ordem = { ruim: 3, atencao: 2, bom: 1, na: 0 };
        return ordem[b.classe] > ordem[a.classe] ? b : a;
      });
      return {
        x: pt.x, xEscalado: xx, cota: pt.cota, rot: pt.rot,
        hgl: hglP, envMax: hglP + dh * frac, envMin: hglP - dh * frac,
        pPerm: pPerm, pMax: pMax, pMin: pMin, pn: pn,
        classe: pior.classe, motivos: clPerm.motivos.concat(clMax.motivos, clMin.motivos)
      };
    });

    return {
      pontos: pontos, dh: dh, lTrechos: lTrechos, escala: escala,
      criticoMax: pontos.reduce(function (a, b) { return b.pMax > a.pMax ? b : a; }, pontos[0]),
      criticoMin: pontos.reduce(function (a, b) { return b.pMin < a.pMin ? b : a; }, pontos[0])
    };
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
      var mat = R.elasticidade[ekey] || { E: 210, nu: 0.3 };
      var E = mat.E * 1e9;
      var nu = mat.nu === undefined ? 0.3 : mat.nu;
      var psi = H.psiDe(st.golpe.ancoragem || 'juntas', nu, Number(st.golpe.psi) || 1);
      var eM = (tubo.eMm || 0) / 1000;
      var a_cel = eM > 0 ? H.celeridade(tubo.diM, eM, E, ctx.rho, 2.19e9, psi) : null;
      var tc = a_cel ? H.tempoCritico(r.L, a_cel) : null;
      var t = Number(st.golpe.tempoManobra) || 0;
      var rapida = !tc || t <= tc;
      var dhJ = a_cel ? H.joukowsky(a_cel, r.v) : null;
      var dhM = t > 0 ? H.michaud(r.L, r.v, t) : null;
      var dh = rapida ? dhJ : Math.min(dhJ === null ? Infinity : dhJ, dhM === null ? Infinity : dhM);
      var pnMca = C.pnMca(a, tubo);

      return {
        rot: r.rot, material: tubo.material, materialRot: mat.rot,
        E_GPa: E / 1e9, nu: nu, psi: psi,
        eMm: tubo.eMm, diMm: tubo.diMm, L: r.L, v: r.v,
        celeridade: a_cel, tempoCritico: tc, tempoManobra: t, manobraRapida: rapida,
        dhJoukowsky: dhJ, dhMichaud: dhM, dh: dh,
        pressaoMaxMca: cen.Hm + (dh || 0),
        pressaoMinMca: cen.Hm - (dh || 0),
        pnMca: pnMca,
        atende: pnMca === null ? null : (cen.Hm + (dh || 0)) <= pnMca,
        subpressao: (cen.Hm - (dh || 0)) < 0
      };
    }).filter(Boolean);
  };

  /* ================================================================
     Curva do sistema e curva da bomba
     ================================================================ */

  /* Altura manométrica do sistema para uma vazão total qualquer, com n
     bombas em operação. C.cenario deduz as vazões de ctx.qBomba e de n, por
     isso a vazão por bomba tem de ser qTotal/n — e não a de projeto escalada. */
  C.hmDoSistema = function (st, ctx, qTotal, n) {
    n = n || ctx.nOp || 1;
    var ctx2 = {};
    Object.keys(ctx).forEach(function (k) { ctx2[k] = ctx[k]; });
    ctx2.qBomba = n > 0 ? qTotal / n : 0;
    ctx2.qTotal = qTotal;
    ctx2.nOp = n;
    var cen = C.cenario(st, ctx2, n);
    return { Hm: cen.Hm, hf: cen.hfSuccao + cen.hfRecalque, hl: cen.hlSuccao + cen.hlRecalque,
             Hg: cen.Hg, qTotal: qTotal, cen: cen };
  };

  /* Pontos da curva do sistema, de 0 até fatorMax x a vazão de projeto */
  C.curvaSistema = function (st, ctx, n, nPontos, fatorMax) {
    nPontos = nPontos || 22;
    fatorMax = fatorMax || 1.6;
    var pts = [], i, q;
    for (i = 0; i <= nPontos; i++) {
      q = ctx.qTotal * fatorMax * i / nPontos;
      pts.push({ q: q, H: C.hmDoSistema(st, ctx, q, n).Hm });
    }
    return pts;
  };

  /* Ajuste da curva da bomba H = a0 + a1·Q + a2·Q² por mínimos quadrados
     (Q em m³/s, H em mca). Precisa de pelo menos 3 pontos. */
  C.ajustarCurvaBomba = function (pontos) {
    var pts = (pontos || []).map(function (p) {
      return { q: Number(p.q), H: Number(p.H) };
    }).filter(function (p) { return isFinite(p.q) && isFinite(p.H) && p.q >= 0; });
    if (pts.length < 3) return null;

    /* matriz normal 3x3 */
    var S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0], i, j, k;
    pts.forEach(function (p) {
      var x = [1, p.q, p.q * p.q];
      for (i = 0; i < 3; i++) {
        for (j = 0; j < 3; j++) S[i][j] += x[i] * x[j];
        b[i] += x[i] * p.H;
      }
    });
    /* eliminação de Gauss */
    var M = [[S[0][0], S[0][1], S[0][2], b[0]],
             [S[1][0], S[1][1], S[1][2], b[1]],
             [S[2][0], S[2][1], S[2][2], b[2]]];
    for (i = 0; i < 3; i++) {
      var piv = i;
      for (k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
      if (Math.abs(M[piv][i]) < 1e-18) return null;
      var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
      for (k = i + 1; k < 3; k++) {
        var f = M[k][i] / M[i][i];
        for (j = i; j < 4; j++) M[k][j] -= f * M[i][j];
      }
    }
    var c = [0, 0, 0];
    for (i = 2; i >= 0; i--) {
      var sm = M[i][3];
      for (j = i + 1; j < 3; j++) sm -= M[i][j] * c[j];
      c[i] = sm / M[i][i];
    }
    return {
      a0: c[0], a1: c[1], a2: c[2],
      H: function (q) { return c[0] + c[1] * q + c[2] * q * q; },
      pontos: pts,
      qMax: Math.max.apply(null, pts.map(function (p) { return p.q; }))
    };
  };

  /* Ponto de operação: interseção da curva do sistema com a curva conjunta
     de n bombas em paralelo (mesma altura, vazões somadas). */
  C.pontoOperacao = function (st, ctx, curva, n) {
    if (!curva) return null;
    n = n || ctx.nOp;
    function dif(qTotal) {
      return curva.H(qTotal / n) - C.hmDoSistema(st, ctx, qTotal, n).Hm;
    }
    var qA = 1e-6, qB = curva.qMax * n;
    var dA = dif(qA), dB = dif(qB), i, qM, dM;
    if (dA < 0) return { erro: 'A altura da bomba com vazão nula é inferior à altura geométrica do sistema — a bomba não consegue iniciar o bombeamento.' };
    if (dB > 0) return { erro: 'A interseção fica acima da maior vazão informada na curva da bomba. Acrescente pontos com vazão maior.' };
    for (i = 0; i < 80; i++) {
      qM = (qA + qB) / 2; dM = dif(qM);
      if (dM > 0) { qA = qM; } else { qB = qM; }
      if (Math.abs(qB - qA) < 1e-9) break;
    }
    qM = (qA + qB) / 2;
    var sis = C.hmDoSistema(st, ctx, qM, n);
    var etaB = (Number(st.bombas.rendBomba) || 70) / 100;
    return {
      qTotal: qM, qBomba: qM / n, H: sis.Hm, n: n,
      bhpCv: etaB > 0 ? H.potenciaUtilCV(qM / n, sis.Hm, ctx.gama) / etaB : 0,
      desvioQ: ctx.qTotal > 0 ? (qM - ctx.qTotal) / ctx.qTotal * 100 : 0
    };
  };

  /* ================================================================
     Análise econômica de diâmetro
     ================================================================ */

  /* Custo do tubo por metro estimado por lei de potência:
       custo = A · DN^B  (R$/m, DN em mm)
     O par A/B é editável; serve para comparar diâmetros entre si, não para
     orçar. Um custo por metro informado no catálogo (campo "custoM") tem
     precedência. */
  C.custoMetro = function (st, cat, item, diMm) {
    if (item && item.custoM) return Number(item.custoM);
    var e = st.economia;
    var dn = item && item.dn ? Number(item.dn) : diMm;
    return (Number(e.custoA) || 0) * Math.pow(dn, Number(e.custoB) || 1.45);
  };

  /* Fator de recuperação de capital */
  C.crf = function (taxaPct, anos) {
    var i = (Number(taxaPct) || 0) / 100;
    var nn = Number(anos) || 1;
    if (i <= 0) return 1 / nn;
    return i * Math.pow(1 + i, nn) / (Math.pow(1 + i, nn) - 1);
  };

  /* Custo anual de um trecho com um determinado diâmetro */
  C.custoAnual = function (st, ctx, cat, item, diMm, L, hf, qTotal) {
    var e = st.economia;
    var etaB = (Number(st.bombas.rendBomba) || 70) / 100;
    var etaM = st.bombas.usarRendMotor ? (Number(st.bombas.rendMotor) || 92) / 100 : 1;
    var eta = etaB * etaM;

    var custoTubo = (C.custoMetro(st, cat, item, diMm) * (1 + (Number(e.custoInstalacao) || 0) / 100)) * L;
    var anualTubo = custoTubo * C.crf(e.taxa, e.anos);

    /* energia atribuída à perda de carga deste trecho */
    var potKw = eta > 0 ? ctx.gama * qTotal * hf / 1000 / eta : 0;
    var kwhAno = potKw * (Number(e.horasDia) || 0) * 365;
    var anualEnergia = kwhAno * (Number(e.tarifa) || 0);

    return {
      custoTubo: custoTubo, anualTubo: anualTubo,
      potKw: potKw, kwhAno: kwhAno, anualEnergia: anualEnergia,
      anualTotal: anualTubo + anualEnergia
    };
  };

  /* ---------------- consolidação ---------------- */

  C.resumo = function (st, catalogos) {
    var ctx = C.contexto(st, catalogos);
    var cenarios = [], i;
    for (i = 1; i <= ctx.nInst; i++) cenarios.push(C.cenario(st, ctx, i));
    var proj = cenarios[ctx.nOp - 1] || cenarios[cenarios.length - 1];

    var golpe = C.golpe(st, ctx, proj);
    var res = {
      ctx: ctx,
      cenarios: cenarios,
      projeto: proj,
      piezometrica: C.piezometrica(st, ctx, proj),
      golpe: golpe,
      envoltoria: (st.perfil && st.perfil.ativo) ? C.envoltoria(st, ctx, proj, golpe) : null
    };
    res.avisosDados = C.validar(st, ctx, res);

    if (st.curvaBomba && st.curvaBomba.ativo) {
      var pts = (st.curvaBomba.pontos || []).map(function (p) {
        return { q: U.para('vazao', p.q || 0, st.curvaBomba.unidQ || 'L/s'), H: p.H };
      });
      res.curvaBomba = C.ajustarCurvaBomba(pts);
      res.operacao = res.curvaBomba ? C.pontoOperacao(st, ctx, res.curvaBomba, ctx.nOp) : null;
      res.operacaoPorN = [];
      if (res.curvaBomba) {
        for (i = 1; i <= ctx.nInst; i++) {
          res.operacaoPorN.push({ n: i, op: C.pontoOperacao(st, ctx, res.curvaBomba, i) });
        }
      }
    }
    return res;
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
