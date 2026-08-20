/* ------------------------------------------------------------------
 * Proteção contra o transitório hidráulico — breve estudo de anteprojeto.
 *
 * A pré-avaliação do programa calcula a linha SEM proteção (Joukowsky /
 * Michaud). Este módulo dá o passo seguinte do anteprojeto:
 *
 *  1. REQUISITO: a partir da envoltória sem proteção, calcula quanto a
 *     proteção precisa limitar a sobrepressão e a depressão para a linha
 *     caber na classe de pressão do tubo (com folga) e não entrar em
 *     pressão negativa.
 *
 *  2. PRÉ-DIMENSIONAMENTO dos dispositivos usuais:
 *     - RHO (reservatório hidropneumático) pelo método da coluna rígida
 *       com ar isotérmico — a energia cinética da coluna é absorvida
 *       pelo trabalho de compressão/expansão do ar (TSUTIYA;
 *       STEPHENSON, Water Hammer);
 *     - TAU (tanque alimentador unidirecional) pelo volume da zona de
 *       depressão a preencher;
 *     - chaminé de equilíbrio pela altura necessária acima da
 *       piezométrica máxima;
 *     - ventosas por função (simples, dupla, tríplice, quádrupla
 *       non-slam) e pela regra usual de diâmetro DN/12 a DN/8, com
 *       sugestão dos pontos de instalação lidos do perfil.
 *
 *  3. ENVOLTÓRIA COM PROTEÇÃO (estimada): o Δh que o RHO escolhido
 *     consegue segurar, aplicado à mesma envoltória — para VER a linha
 *     caber no tubo.
 *
 * NADA disto substitui o estudo de transiente pelo método das
 * características (Allievi, Hammer): é anteprojeto, para chegar ao
 * estudo com os dispositivos certos e da ordem de grandeza certa.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var PR = {};
  var G = 9.80665;
  var GAMA = 9810;                 /* N/m³ ~ água */

  /* ================================================================
     Requisito de desempenho da proteção
     ================================================================ */

  /* Da envoltória SEM proteção, o Δh máximo que a linha tolera na
     elevatória (decaindo linearmente até a chegada, como na envoltória):
       sobrepressão:  hgl + Δh·frac − cota ≤ PN − folga
       depressão:     hgl − Δh·frac − cota ≥ pMinAlvo
     O menor Δh admissível entre todos os pontos governa. */
  PR.requisito = function (st, ctx, res) {
    var env = res.envoltoria;
    var pr = st.protecao || {};
    var folga = Number(pr.folgaPN);
    if (!(folga >= 0)) folga = 5;
    var pMinAlvo = Number(pr.pMinAlvo);
    if (!isFinite(pMinAlvo)) pMinAlvo = 0;

    if (!env || !env.pontos.length) {
      /* sem perfil: requisito só na elevatória, contra o PN do 1º trecho */
      var g0 = (res.golpe || [])[0];
      if (!g0) return null;
      var dhSem = res.golpe.reduce(function (a, g) { return Math.max(a, g.dh || 0); }, 0);
      var pn = g0.pnMca || null;
      var dhSobre = pn ? Math.max(0, pn - folga - res.projeto.Hm) : null;
      var dhSub = Math.max(0, res.projeto.Hm - pMinAlvo);
      return {
        temPerfil: false, dhSemProtecao: dhSem, folga: folga, pMinAlvo: pMinAlvo,
        dhAdmSobre: dhSobre, dhAdmSub: dhSub,
        dhAlvo: dhSobre === null ? dhSub : Math.min(dhSobre, dhSub),
        precisa: dhSobre !== null ? dhSem > Math.min(dhSobre, dhSub) : dhSem > dhSub,
        governante: null
      };
    }

    /* pontos já inviáveis em REGIME PERMANENTE não são problema de
       transitório: proteção nenhuma os resolve (é diâmetro, traçado ou
       altura manométrica). Eles saem do requisito e viram alerta próprio. */
    var zonas = PR.zonasAlivio(st, ctx, res);           /* ventosas/TAU/chaminé lançados */
    var permInviavel = [];
    var dhSobreMin = Infinity, dhSubMin = Infinity, govSobre = null, govSub = null;
    var dhSubBrutoMin = Infinity, aliviadosSub = 0;
    env.pontos.forEach(function (p) {
      var frac = 1 - Math.min(1, Math.max(0, p.xEscalado / env.lTrechos));
      if (frac < 0.02) return;              /* na chegada o Δh é nulo por hipótese */
      var foraPerm = (p.pn && p.pPerm > p.pn - folga) || p.pPerm <= pMinAlvo;
      if (foraPerm) { permInviavel.push(p); return; }
      if (p.pn) {
        var s = (p.pn - folga - p.pPerm) / frac;
        if (s < dhSobreMin) { dhSobreMin = s; govSobre = p; }
      }
      var d = (p.pPerm - pMinAlvo) / frac;
      if (d < dhSubBrutoMin) dhSubBrutoMin = d;
      /* ponto coberto por ventosa de admissão / TAU / chaminé: a depressão
         ali é tratada localmente e deixa de exigir Δh do RHO */
      var coberto = zonas.some(function (z) {
        return (z.efeito === 'depressao' || z.efeito === 'ambos') &&
               p.xEscalado >= z.x0 - 1e-9 && p.xEscalado <= z.x1 + 1e-9;
      });
      if (coberto) { aliviadosSub++; return; }
      if (d < dhSubMin) { dhSubMin = d; govSub = p; }
    });
    if (!isFinite(dhSobreMin)) dhSobreMin = null;
    if (!isFinite(dhSubMin)) dhSubMin = null;
    if (!isFinite(dhSubBrutoMin)) dhSubBrutoMin = null;

    var candidatos = [dhSobreMin, dhSubMin].filter(function (v) { return v !== null; });
    var dhAlvo = candidatos.length ? Math.max(0, Math.min.apply(null, candidatos)) : null;
    return {
      temPerfil: true,
      dhSemProtecao: env.dh, folga: folga, pMinAlvo: pMinAlvo,
      dhAdmSobre: dhSobreMin === null ? null : Math.max(0, dhSobreMin),
      dhAdmSub: dhSubMin === null ? null : Math.max(0, dhSubMin),
      dhAdmSubBruto: dhSubBrutoMin === null ? null : Math.max(0, dhSubBrutoMin),
      aliviadosSub: aliviadosSub,
      temAlivio: zonas.length > 0,
      dhAlvo: dhAlvo,
      precisa: dhAlvo !== null && env.dh > dhAlvo + 1e-9,
      governante: (dhSobreMin !== null && (dhSubMin === null || dhSobreMin <= dhSubMin)) ? 'sobrepressão' : 'depressão',
      pontoSobre: govSobre, pontoSub: govSub,
      permInviavel: permInviavel
    };
  };

  /* ================================================================
     Zonas de alívio de depressão dos dispositivos lançados
     ================================================================
     Cada dispositivo que trata a DEPRESSÃO localmente cobre uma zona da
     linha: dentro dela o requisito de subpressão do RHO é aliviado e a
     envoltória mínima protegida não desce abaixo de zero. Raios de
     anteprojeto: ventosa de admissão ±300 m (metade do espaçamento usual
     de 600 m); TAU do ponto de instalação até o fim da zona de depressão
     que ele preenche; chaminé ±150 m, limitando também a envoltória
     máxima ao nível d'água da própria chaminé. */

  var RAIO_VENTOSA = 300, RAIO_CHAMINE = 150;

  PR.zonasAlivio = function (st, ctx, res) {
    var out = [];
    var pr = st.protecao;
    if (!pr || !pr.ativo || !res.envoltoria) return out;
    (pr.dispositivos || []).forEach(function (d) {
      var x = Number(d.x) || 0;
      if (d.tipo === 'ventosa') {
        if (d.funcao === 'simples') return;      /* não admite ar: não alivia depressão */
        out.push({ x0: Math.max(0, x - RAIO_VENTOSA), x1: x + RAIO_VENTOSA,
                   efeito: 'depressao', tipo: 'ventosa',
                   rot: 'ventosa ' + (d.funcao || 'tripla') + ' em ' + Math.round(x) + ' m' });
      } else if (d.tipo === 'tau') {
        var t = PR.tau(st, ctx, res, x);
        var fim = (t && t.alcance) ? t.alcance : x + 600;
        out.push({ x0: x, x1: Math.max(fim, x + 50), efeito: 'depressao', tipo: 'tau',
                   rot: 'TAU em ' + Math.round(x) + ' m' });
      } else if (d.tipo === 'chamine') {
        var ch = PR.chamine(st, ctx, res, x);
        var alt = Number(d.altura) > 0 ? Number(d.altura) : (ch && !ch.erro ? ch.altura : null);
        /* junto à chaminé, a carga fica presa ao nível d'água dela */
        var z = { x0: Math.max(0, x - RAIO_CHAMINE), x1: x + RAIO_CHAMINE,
                  efeito: 'ambos', tipo: 'chamine',
                  rot: 'chaminé em ' + Math.round(x) + ' m' };
        if (alt !== null && ch && !ch.erro) z.headMax = ch.cota + alt;
        out.push(z);
        /* como tanque aberto, ela alimenta a zona de depressão de jusante
           igual a um TAU de volume ilimitado */
        var zd = zonaDepressao(res, x);
        if (zd.vol > 0 && zd.alcance > x + RAIO_CHAMINE) {
          out.push({ x0: x, x1: zd.alcance, efeito: 'depressao', tipo: 'chamine',
                     rot: 'chaminé em ' + Math.round(x) + ' m (alimentação de jusante)' });
        }
      }
    });
    return out;
  };

  /* ================================================================
     RHO — reservatório hidropneumático (coluna rígida, ar isotérmico)
     ================================================================ */

  PR.VOLUMES_RHO = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50];

  /* Energia cinética da coluna d'água da adutora, somada trecho a trecho
     com a velocidade de CADA trecho (usar a velocidade do primeiro para a
     linha toda superestimava a energia quando o diâmetro muda). */
  function energiaColuna(res, rho) {
    var m = 0, v0 = 0, L = 0, KE = 0;
    (res.projeto.adutoras || []).forEach(function (r) {
      if (!r.tubo || !(r.tubo.diM > 0) || !(r.L > 0)) return;
      var A = Math.PI * r.tubo.diM * r.tubo.diM / 4;
      var mi = rho * A * r.L;
      m += mi;
      KE += 0.5 * mi * r.v * r.v;
      L += r.L;
      if (!v0) v0 = r.v;
    });
    return { KE: KE, massa: m, v0: v0, L: L };
  }

  /* Volume de ar inicial para segurar a oscilação dentro de [p2, p1]
     (pressões ABSOLUTAS em mca):
        KE = γ·p0·V0·ln(p1/p0)      (compressão — sobrepressão)
        KE = γ·p0·V0·ln(p0/p2)      (expansão — depressão)              */
  PR.rho = function (st, ctx, res, req) {
    var e = energiaColuna(res, ctx.rho || 998);
    if (!(e.KE > 0)) return { erro: 'A adutora ainda não tem diâmetro e extensão para dimensionar o RHO.' };

    var patm = ctx.patm || 10.33;
    var p0 = res.projeto.Hm + patm;                       /* absoluta no RHO em regime */
    var dhAlvo = req && req.dhAlvo !== null ? req.dhAlvo : 0;
    var p1 = p0 + Math.max(2, dhAlvo);                    /* sobe até o admissível */
    /* depressão inteiramente coberta por ventosas/TAU/chaminé lançados:
       o lado da expansão deixa de governar o RHO */
    var subCoberta = !!(req && req.dhAdmSub === null && req.temAlivio);
    var pminLinha = (req && req.dhAdmSub !== null) ? req.dhAdmSub : res.projeto.Hm;
    var p2 = Math.max(2, p0 - Math.max(2, pminLinha));    /* nunca abaixo de 2 mca abs */

    var v0Sobre = e.KE / (GAMA * p0 * Math.log(p1 / p0));
    var v0Sub = subCoberta ? 0 : e.KE / (GAMA * p0 * Math.log(p0 / p2));
    var v0Ar = Math.max(v0Sobre, v0Sub) * 1.2;            /* 20 % de folga de anteprojeto */
    var vTanque = v0Ar * 2;                               /* ar ~50 % do tanque em regime */

    var comercial = null;
    for (var i = 0; i < PR.VOLUMES_RHO.length; i++) {
      if (PR.VOLUMES_RHO[i] >= vTanque - 1e-9) { comercial = PR.VOLUMES_RHO[i]; break; }
    }

    return {
      KE: e.KE, massa: e.massa, v0: e.v0, L: e.L,
      p0: p0, p1: p1, p2: p2, patm: patm,
      v0Sobre: v0Sobre, v0Sub: v0Sub, v0Ar: v0Ar,
      vTanque: vTanque, comercial: comercial,
      subCoberta: subCoberta,
      governa: v0Sub > v0Sobre ? 'depressão' : 'sobrepressão'
    };
  };

  /* Δh que um RHO de volume escolhido consegue segurar (inverte a energia):
       p1 = p0·exp( KE / (γ·p0·V0) )  →  Δh = p1 − p0                    */
  PR.dhComRho = function (st, ctx, res, volumeTanque) {
    var e = energiaColuna(res, ctx.rho || 998);
    if (!(e.KE > 0) || !(volumeTanque > 0)) return null;
    var patm = ctx.patm || 10.33;
    var p0 = res.projeto.Hm + patm;
    var v0Ar = (volumeTanque / 2) / 1.2;                  /* desfaz a folga, ar = metade */
    var expo = Math.min(12, e.KE / (GAMA * p0 * v0Ar));   /* trava contra estouro numérico */
    var p1 = p0 * Math.exp(expo);
    var p2 = p0 * Math.exp(-expo);
    return { dhSobre: p1 - p0, dhSub: p0 - p2, dh: Math.max(p1 - p0, p0 - p2) };
  };

  /* ================================================================
     TAU — tanque alimentador unidirecional
     ================================================================ */

  /* Zona de depressão a jusante de um ponto: onde a envoltória mínima
     fica negativa (volume de tubo da zona serve só de referência). */
  function zonaDepressao(res, xInstal) {
    var env = res.envoltoria;
    var vol = 0, alcance = 0, dentro = false;
    for (var i = 1; i < env.pontos.length; i++) {
      var a = env.pontos[i - 1], b = env.pontos[i];
      if (b.xEscalado < xInstal) continue;
      var pMed = (a.pMin + b.pMin) / 2;
      if (pMed < 0) {
        var dx = b.xEscalado - Math.max(a.xEscalado, xInstal);
        var A = areaEm(res, (a.xEscalado + b.xEscalado) / 2);
        vol += A * dx;
        alcance = b.xEscalado;
        dentro = true;
      } else if (dentro) break;               /* fim da primeira zona de depressão */
    }
    return { vol: vol, alcance: alcance };
  }

  /* O TAU precisa encher a CAVIDADE de separação que se forma no ponto,
     não o tubo inteiro da zona de depressão. Estimativa por coluna rígida
     (STEPHENSON, discharge tanks): rompida a coluna, o trecho de jusante
     segue com a velocidade de regime e desacelera sob a carga que o retém
     — com a cavidade à pressão atmosférica, essa carga é a própria pressão
     disponível no ponto em regime (hgl − cota = desnível até a chegada +
     atrito de jusante):
        s = v²·Lj / (2·g·ΔH)      Vcav = A·s   (limitado ao tubo de jusante)
     Volume do TAU = 1,5 × cavidade. */
  PR.tau = function (st, ctx, res, xInstal) {
    var env = res.envoltoria;
    if (!env) return { erro: 'O TAU é dimensionado sobre o perfil — lance o perfil da linha.' };
    var zona = zonaDepressao(res, xInstal);
    if (!(zona.vol > 0)) return { volume: 0, nota: 'Não há zona de depressão a jusante deste ponto — o TAU não é necessário aqui.' };

    var p = pontoEm(env, xInstal);
    var Lj = Math.max(1, env.lTrechos - p.xEscalado);
    var A = areaEm(res, Math.min(env.lTrechos, p.xEscalado + 1));
    var vJus = velocidadeEm(res, Math.min(env.lTrechos, p.xEscalado + 1));
    var dH = Math.max(2, p.hgl - p.cota);     /* nunca menos de 2 mca de carga retentora */
    var s = vJus * vJus * Lj / (2 * G * dH);
    var cav = A * Math.min(s, Lj);            /* a cavidade não passa do tubo de jusante */
    var desce = p.cota > (Number(st.cotas.nivelChegada) || 0);
    return {
      volume: cav * 1.5, cavidade: cav, curso: Math.min(s, Lj),
      LJus: Lj, vJus: vJus, dH: dH,
      volumeZona: zona.vol, alcance: zona.alcance, desce: desce
    };
  };

  function velocidadeEm(res, xx) {
    var acc = 0;
    for (var i = 0; i < res.projeto.adutoras.length; i++) {
      var r = res.projeto.adutoras[i];
      acc += r.L;
      if (xx <= acc + 1e-9 && r.v > 0) return r.v;
    }
    var u = res.projeto.adutoras[res.projeto.adutoras.length - 1];
    return u && u.v > 0 ? u.v : 0;
  }

  function areaEm(res, xx) {
    var acc = 0;
    for (var i = 0; i < res.projeto.adutoras.length; i++) {
      var r = res.projeto.adutoras[i];
      acc += r.L;
      if (xx <= acc + 1e-9 && r.tubo && r.tubo.diM > 0) {
        return Math.PI * r.tubo.diM * r.tubo.diM / 4;
      }
    }
    var u = res.projeto.adutoras[res.projeto.adutoras.length - 1];
    return u && u.tubo && u.tubo.diM > 0 ? Math.PI * u.tubo.diM * u.tubo.diM / 4 : 0;
  }

  /* ================================================================
     Chaminé de equilíbrio
     ================================================================ */

  PR.chamine = function (st, ctx, res, xInstal) {
    var env = res.envoltoria;
    if (!env) return { erro: 'A chaminé é avaliada sobre o perfil — lance o perfil da linha.' };
    var p = pontoEm(env, xInstal);
    if (!p) return { erro: 'Ponto fora do perfil.' };
    /* a chaminé precisa conter a piezométrica máxima com borda livre */
    var altura = Math.max(0, p.envMax - p.cota) + 1.0;
    var alturaPerm = Math.max(0, p.hgl - p.cota) + 1.0;
    return {
      cota: p.cota, hglPerm: p.hgl, envMax: p.envMax,
      altura: altura, alturaPerm: alturaPerm,
      viavel: altura <= 12,
      nota: altura <= 12
        ? 'Altura contando 1,0 m de borda livre sobre a envoltória máxima.'
        : 'Acima de ~12 m a chaminé costuma ser antieconômica — RHO ou TAU tendem a sair melhores neste ponto.'
    };
  };

  function pontoEm(env, xx) {
    var melhor = null, d = Infinity;
    env.pontos.forEach(function (p) {
      var dd = Math.abs(p.xEscalado - xx);
      if (dd < d) { d = dd; melhor = p; }
    });
    return melhor;
  }

  /* ================================================================
     Ventosas
     ================================================================ */

  PR.FUNCOES_VENTOSA = [
    { id: 'simples', rot: 'Simples (automática)', desc: 'Expulsa o ar acumulado em operação, por orifício pequeno. Não admite ar em esvaziamento nem em depressão.' },
    { id: 'dupla', rot: 'Dupla (cinética)', desc: 'Orifício grande: expulsa grandes vazões de ar no enchimento e admite ar no esvaziamento. Não trata o ar residual de operação.' },
    { id: 'tripla', rot: 'Tríplice (combinada)', desc: 'Reúne as duas: orifício grande para enchimento/esvaziamento e orifício pequeno para o ar de operação. É o padrão de adutora.' },
    { id: 'quadrupla', rot: 'Quádrupla (non-slam)', desc: 'Combinada com fechamento amortecido: admite ar livremente na depressão e o expulsa de forma controlada, evitando o golpe do fechamento brusco da própria ventosa. Indicada onde a envoltória mínima é severa.' }
  ];

  /* DN comerciais usuais de ventosa (ARI, BERMAD, Saint-Gobain trabalham
     nesta série; o modelo específico se cadastra no catálogo do usuário) */
  PR.DNS_VENTOSA = [25, 50, 80, 100, 150, 200];

  /* regra usual de anteprojeto: DN da ventosa entre 1/12 e 1/8 do DN da linha */
  PR.dnVentosa = function (dnLinha) {
    var min = Math.max(25, dnLinha / 12);
    var rec = Math.max(25, dnLinha / 8);
    var dnMin = null, dnRec = null;
    PR.DNS_VENTOSA.forEach(function (d) {
      if (dnMin === null && d >= min - 1e-9) dnMin = d;
      if (dnRec === null && d >= rec - 1e-9) dnRec = d;
    });
    return { min: min, rec: rec, dnMin: dnMin || 200, dnRec: dnRec || 200 };
  };

  /* Sugere pontos de instalação a partir do perfil:
     - todo máximo local de cota (ponto alto) — tríplice/quádrupla;
     - espaçamento máximo de ~600 m em trechos longos — simples/tríplice. */
  PR.pontosSugeridos = function (st, ctx, res) {
    var env = res.envoltoria;
    if (!env || env.pontos.length < 3) return [];
    var out = [];
    var pts = env.pontos;
    for (var i = 1; i < pts.length - 1; i++) {
      if (pts[i].cota > pts[i - 1].cota && pts[i].cota >= pts[i + 1].cota) {
        out.push({
          x: pts[i].xEscalado, cota: pts[i].cota, motivo: 'ponto alto do perfil',
          funcao: pts[i].pMin < 0 ? 'quadrupla' : 'tripla',
          critico: pts[i].pMin < 0
        });
      }
    }
    /* espaçamento: um marco a cada ~600 m sem ventosa sugerida */
    var ESP = 600, ultimo = 0;
    var marcos = out.map(function (o) { return o.x; }).sort(function (a, b) { return a - b; });
    for (var x = ESP; x < env.lTrechos - ESP / 2; x += ESP) {
      var perto = marcos.some(function (m) { return Math.abs(m - x) < ESP / 2; });
      if (!perto) {
        out.push({ x: x, cota: pontoEm(env, x).cota, motivo: 'espaçamento máximo (~600 m) para expulsão de ar', funcao: 'tripla', critico: false });
      }
    }
    out.sort(function (a, b) { return a.x - b.x; });
    return out;
  };

  /* ================================================================
     Avaliação de um dispositivo lançado (alertas de sub/super)
     ================================================================ */

  PR.avaliar = function (st, ctx, res, req, d) {
    var av = [];
    var dnLinha = dnDaLinha(res);

    if (d.tipo === 'rho') {
      var rho = PR.rho(st, ctx, res, req);
      if (rho.erro) return { avisos: [rho.erro], classe: 'na' };
      var vol = Number(d.volumeM3) || 0;
      var eff = vol > 0 ? PR.dhComRho(st, ctx, res, vol) : null;
      var classe = 'bom';
      if (!(vol > 0)) { av.push('Escolha o volume do RHO — o necessário é da ordem de ' + rho.vTanque.toFixed(1).replace('.', ',') + ' m³.'); classe = 'na'; }
      else if (vol + 1e-9 < rho.vTanque) {
        av.push('SUBDIMENSIONADO: com ' + vol.toLocaleString('pt-BR') + ' m³ o RHO segura Δh ≈ ' +
          (eff ? eff.dh.toFixed(1).replace('.', ',') : '—') + ' mca, e o requisito é ≤ ' +
          (req && req.dhAlvo !== null ? req.dhAlvo.toFixed(1).replace('.', ',') : '—') + ' mca. Necessário ≈ ' +
          rho.vTanque.toFixed(1).replace('.', ',') + ' m³.');
        classe = 'ruim';
      } else if (vol > 3 * rho.vTanque) {
        av.push('SUPERDIMENSIONADO: ' + vol.toLocaleString('pt-BR') + ' m³ é mais de 3× o necessário (≈ ' +
          rho.vTanque.toFixed(1).replace('.', ',') + ' m³) — custo de vaso, compressor e obra sem ganho.');
        classe = 'atencao';
      }
      return { avisos: av, classe: classe, rho: rho, efetivo: eff };
    }

    if (d.tipo === 'tau') {
      var tau = PR.tau(st, ctx, res, Number(d.x) || 0);
      if (tau.erro) return { avisos: [tau.erro], classe: 'na' };
      if (!(tau.volume > 0)) return { avisos: [tau.nota], classe: 'atencao', tau: tau };
      var volT = Number(d.volumeM3) || 0;
      var clT = 'bom', avT = [];
      if (!(volT > 0)) { avT.push('Escolha o volume do TAU — o necessário é da ordem de ' + tau.volume.toFixed(1).replace('.', ',') + ' m³.'); clT = 'na'; }
      else if (volT + 1e-9 < tau.volume) { avT.push('SUBDIMENSIONADO: a cavidade de separação estimada pede ≈ ' + tau.volume.toFixed(1).replace('.', ',') + ' m³ (já com 50 % de folga).'); clT = 'ruim'; }
      else if (volT > 3 * tau.volume) { avT.push('SUPERDIMENSIONADO: mais de 3× a cavidade de separação estimada.'); clT = 'atencao'; }
      return { avisos: avT, classe: clT, tau: tau };
    }

    if (d.tipo === 'chamine') {
      var ch = PR.chamine(st, ctx, res, Number(d.x) || 0);
      if (ch.erro) return { avisos: [ch.erro], classe: 'na' };
      var altD = Number(d.altura) || 0;
      var avC = [], clC = ch.viavel ? 'bom' : 'atencao';
      if (!ch.viavel) avC.push(ch.nota);
      if (altD > 0 && altD + 1e-9 < ch.altura) { avC.push('SUBDIMENSIONADA: a altura precisa cobrir a envoltória máxima — necessário ≈ ' + ch.altura.toFixed(1).replace('.', ',') + ' m.'); clC = 'ruim'; }
      return { avisos: avC, classe: clC, chamine: ch };
    }

    /* ventosa */
    var regra = PR.dnVentosa(dnLinha || 0);
    var avV = [], clV = 'bom';
    var dnV = Number(d.dn) || 0;
    if (dnLinha) {
      if (!(dnV > 0)) { avV.push('Escolha o DN da ventosa — a regra usual é DN da linha /8 a /12 (aqui: DN ' + regra.dnRec + ' a DN ' + regra.dnMin + ').'); clV = 'na'; }
      else if (dnV < regra.min) { avV.push('SUBDIMENSIONADA: DN ' + dnV + ' fica abaixo de 1/12 do DN da linha (mínimo usual: DN ' + regra.dnMin + ').'); clV = 'ruim'; }
      else if (dnV > dnLinha / 4) { avV.push('SUPERDIMENSIONADA: DN ' + dnV + ' passa de 1/4 do DN da linha — custo sem ganho e fechamento mais violento.'); clV = 'atencao'; }
    }
    if (d.funcao === 'simples' || d.funcao === 'dupla') {
      var pv = res.envoltoria ? pontoEm(res.envoltoria, Number(d.x) || 0) : null;
      if (pv && pv.pMin < 0) {
        avV.push('FUNÇÃO INSUFICIENTE para este ponto: a envoltória mínima fica negativa (' +
          pv.pMin.toFixed(1).replace('.', ',') + ' mca) — use tríplice ou quádrupla (non-slam) para admitir ar na depressão' +
          (pv.pMin < -5 ? ', preferindo a non-slam pela severidade' : '') + '.');
        clV = 'ruim';
      }
    }
    return { avisos: avV, classe: clV, regra: regra };
  };

  function dnDaLinha(res) {
    var r = (res.projeto.adutoras || [])[0];
    return r && r.tubo && r.tubo.item ? (r.tubo.item.dn || null) : null;
  }
  PR.dnDaLinha = dnDaLinha;

  /* ================================================================
     Envoltória com a proteção lançada
     ================================================================
     Considera TODOS os dispositivos:
       - RHO: reduz o Δh global (sobrepressão e depressão) pela coluna
         rígida — sem RHO, vale o Δh sem proteção;
       - ventosas de admissão, TAU e chaminé: dentro da sua zona de
         alívio a envoltória mínima não desce abaixo de zero;
       - chaminé: além disso, limita a envoltória máxima ao nível
         d'água da própria chaminé na sua zona.
     Estimativa de anteprojeto — o estudo de transiente confirma. */

  PR.envoltoriaProtegida = function (st, ctx, res) {
    var pr = st.protecao;
    if (!pr || !pr.ativo || !res.envoltoria) return null;
    var disp = pr.dispositivos || [];
    if (!disp.length) return null;

    var rhoD = disp.filter(function (d) { return d.tipo === 'rho' && Number(d.volumeM3) > 0; })[0];
    var eff = rhoD ? PR.dhComRho(st, ctx, res, Number(rhoD.volumeM3)) : null;
    var dhSobre = eff ? eff.dhSobre : res.envoltoria.dh;
    var dhSub = eff ? eff.dhSub : res.envoltoria.dh;

    var env = PDA.C.envoltoria(st, ctx, res.projeto, [{ dh: dhSobre }]);
    if (!env) return null;
    var zonas = PR.zonasAlivio(st, ctx, res);

    /* Os pontos da envoltória são os do perfil, que podem ser esparsos:
       uma zona de alívio curta (ventosa ±300 m, chaminé ±150 m) pode não
       conter nenhum deles e o efeito ficaria invisível no gráfico. Insere
       pontos interpolados nas bordas de cada zona e na posição de cada
       dispositivo, para o patamar aparecer. */
    var inserir = [];
    zonas.forEach(function (z) { inserir.push(z.x0, z.x1); });
    disp.forEach(function (d) {
      if (d.tipo !== 'rho' && Number(d.x) > 0) inserir.push(Number(d.x));
    });
    inserir.forEach(function (xi) {
      if (!(xi > 0) || !(xi < env.lTrechos)) return;
      var perto = env.pontos.some(function (p) { return Math.abs(p.xEscalado - xi) < 1; });
      if (perto) return;
      var dir = null, esq = null;
      env.pontos.forEach(function (p) {
        if (p.xEscalado <= xi && (!esq || p.xEscalado > esq.xEscalado)) esq = p;
        if (p.xEscalado >= xi && (!dir || p.xEscalado < dir.xEscalado)) dir = p;
      });
      if (!esq || !dir || dir.xEscalado <= esq.xEscalado) return;
      var t = (xi - esq.xEscalado) / (dir.xEscalado - esq.xEscalado);
      var cota = esq.cota + (dir.cota - esq.cota) * t;
      var hgl = esq.hgl + (dir.hgl - esq.hgl) * t;
      var frac = 1 - Math.min(1, Math.max(0, xi / env.lTrechos));
      env.pontos.push({
        x: xi / (env.escala || 1), xEscalado: xi, cota: cota, rot: '',
        hgl: hgl, envMax: hgl + dhSobre * frac, envMin: hgl - dhSub * frac,
        pPerm: hgl - cota, pMax: hgl + dhSobre * frac - cota,
        pMin: hgl - dhSub * frac - cota, pn: esq.pn,
        classe: 'bom', motivos: []
      });
    });
    env.pontos.sort(function (a, b) { return a.xEscalado - b.xEscalado; });

    env.pontos.forEach(function (p) {
      var frac = 1 - Math.min(1, Math.max(0, p.xEscalado / env.lTrechos));
      /* lado da depressão com o Δh próprio (pode diferir do da sobrepressão) */
      p.envMin = p.hgl - dhSub * frac;
      p.pMin = p.envMin - p.cota;
      zonas.forEach(function (z) {
        if (p.xEscalado < z.x0 - 1e-9 || p.xEscalado > z.x1 + 1e-9) return;
        if ((z.efeito === 'depressao' || z.efeito === 'ambos') && p.pMin < 0) {
          p.pMin = 0; p.envMin = p.cota;
        }
        if (z.efeito === 'ambos' && z.headMax !== undefined && p.envMax > z.headMax) {
          p.envMax = z.headMax; p.pMax = p.envMax - p.cota;
        }
      });
      /* reclassifica o ponto com as envoltórias ajustadas */
      var clPerm = PDA.C.classificarPressao(p.pPerm, p.pn);
      var clMax = PDA.C.classificarPressao(p.pMax, p.pn, { transitorio: true });
      var clMin = PDA.C.classificarPressao(p.pMin, p.pn, { transitorio: true });
      var pior = [clPerm, clMax, clMin].reduce(function (a, b) {
        var ordem = { ruim: 3, atencao: 2, bom: 1, na: 0 };
        return ordem[b.classe] > ordem[a.classe] ? b : a;
      });
      p.classe = pior.classe;
      p.motivos = clPerm.motivos.concat(clMax.motivos, clMin.motivos);
    });
    env.criticoMax = env.pontos.reduce(function (a, b) { return b.pMax > a.pMax ? b : a; }, env.pontos[0]);
    env.criticoMin = env.pontos.reduce(function (a, b) { return b.pMin < a.pMin ? b : a; }, env.pontos[0]);

    /* rótulo do que foi considerado */
    var nomes = [];
    if (rhoD) nomes.push('RHO ' + Number(rhoD.volumeM3).toLocaleString('pt-BR') + ' m³');
    var nV = disp.filter(function (d) { return d.tipo === 'ventosa' && d.funcao !== 'simples'; }).length;
    var nT = disp.filter(function (d) { return d.tipo === 'tau'; }).length;
    var nC = disp.filter(function (d) { return d.tipo === 'chamine'; }).length;
    if (nV) nomes.push(nV + (nV === 1 ? ' ventosa' : ' ventosas'));
    if (nT) nomes.push(nT + ' TAU');
    if (nC) nomes.push(nC + (nC === 1 ? ' chaminé' : ' chaminés'));
    if (!nomes.length) return null;          /* só ventosa simples lançada: nada a mostrar */

    return {
      env: env, dh: Math.max(dhSobre, dhSub), dhSobre: dhSobre, dhSub: dhSub,
      temRho: !!rhoD, zonas: zonas, rotulo: nomes.join(' + ')
    };
  };

  PR.fontes = [
    { id: 'pr_rho', txt: 'Pré-dimensionamento de RHO pelo método da coluna rígida com ar isotérmico: a energia cinética da coluna é igualada ao trabalho de compressão/expansão do ar, KE = γ·p₀·V₀·ln(p₁/p₀). TSUTIYA, Abastecimento de Água; STEPHENSON, Water Hammer: practical solutions. Anteprojeto — o volume final sai do estudo de transiente.' },
    { id: 'pr_ventosa', txt: 'Regra usual de anteprojeto para ventosas: DN da ventosa entre 1/12 e 1/8 do DN da linha; pontos altos e espaçamento máximo da ordem de 500 a 800 m. Funções: simples (expulsão em operação), dupla (cinética), tríplice (combinada), quádrupla non-slam (fechamento amortecido). TSUTIYA; AWWA M51 — Air Valves.' },
    { id: 'pr_tau', txt: 'Pré-dimensionamento de TAU pela cavidade de separação estimada por coluna rígida: rompida a coluna no ponto, o trecho de jusante desacelera sob a carga disponível em regime (s = v²·Lj/(2·g·ΔH); Vcav = A·s), e o tanque deve conter 1,5 × a cavidade. STEPHENSON, Water Hammer: practical solutions (discharge tanks). Anteprojeto — o volume final sai do estudo de transiente.' }
  ];

  PDA.PR = PR;
})(window.PDA = window.PDA || {});
