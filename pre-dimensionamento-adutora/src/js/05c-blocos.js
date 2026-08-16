/* ------------------------------------------------------------------
 * Blocos de ancoragem.
 *
 * Duas vias, lado a lado:
 *
 * 1) SELEÇÃO ENTRE BLOCOS PADRONIZADOS — reproduz a sistemática da
 *    planilha de origem (blocos-padrão de concessionária, tipos 1 a 26,
 *    com capacidade tabelada por DN e recobrimento). Dois erros de
 *    digitação da planilha foram corrigidos na transcrição (ver
 *    BA.correcoes).
 *
 * 2) BLOCO CALCULADO PELO APOIO NO SOLO — método clássico de
 *    anteprojeto: o empuxo é transmitido ao terreno por uma área de
 *    encosto A ≥ FS·E/σ, com σ a tensão admissível do solo
 *    (AZEVEDO NETTO; FERNÁNDEZ, 2015; AWWA M41). Vale também para
 *    curvas verticais, que os blocos-padrão não cobrem.
 *
 * O empuxo usa o DE (diâmetro externo) do tubo — a pressão atua na
 * seção externa da junta —, diferentemente da planilha de origem, que
 * usava o DN nominal (até 23 % contra a segurança em FD).
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var BA = {};

  /* ================================================================
     Peças e geometria do empuxo
     ================================================================ */

  BA.pecas = [
    { id: 'c90', rot: 'Curva 90°', ang: 90 },
    { id: 'c45', rot: 'Curva 45°', ang: 45 },
    { id: 'c22', rot: 'Curva 22°30′', ang: 22.5 },
    { id: 'c11', rot: 'Curva 11°15′', ang: 11.25 },
    { id: 'te', rot: 'Tê / derivação', axial: true },
    { id: 'cap', rot: 'CAP / flange cego / extremidade', axial: true },
    { id: 'registro', rot: 'Registro / válvula fechada', axial: true },
    { id: 'reducao', rot: 'Redução', reducao: true }
  ];

  BA.peca = function (id) {
    return BA.pecas.filter(function (p) { return p.id === id; })[0] || BA.pecas[0];
  };

  /* Empuxo por 1 mca (kgf), com o DE em metros.
     Axial (tê, cap, registro):  E = p·A
     Curva de ângulo θ:          E = 2·p·A·sen(θ/2)
     Redução DE1 → DE2:          E = p·(A1 − A2)                       */
  BA.empuxoUnit = function (pecaId, deM, de2M) {
    var p = BA.peca(pecaId);
    var A = Math.PI * deM * deM / 4;
    if (p.reducao) {
      var A2 = Math.PI * (de2M || 0) * (de2M || 0) / 4;
      return 1000 * Math.max(0, A - A2);
    }
    if (p.axial) return 1000 * A;
    return 1000 * 2 * A * Math.sin((p.ang / 2) * Math.PI / 180);
  };

  /* ================================================================
     Solos — tensão admissível de apoio (kgf/m²)
     ================================================================ */

  BA.solos = [
    { id: 'lodo', rot: 'Lodo / turfa / aterro não compactado', sigma: 0,
      nota: 'Sem capacidade de apoio confiável: não ancorar por encosto — exigir estaca, tirante ou projeto específico.' },
    { id: 'argila_mole', rot: 'Argila mole', sigma: 5000 },
    { id: 'areia', rot: 'Areia / silte arenoso', sigma: 10000 },
    { id: 'areia_pedregulho', rot: 'Areia e pedregulho', sigma: 15000 },
    { id: 'areia_ped_argila', rot: 'Areia e pedregulho com argila', sigma: 20000 },
    { id: 'areia_ped_cimentado', rot: 'Areia e pedregulho cimentados', sigma: 29000 },
    { id: 'rocha', rot: 'Rocha alterada / folhelho duro', sigma: 49000 }
  ];

  BA.solo = function (id) {
    return BA.solos.filter(function (s) { return s.id === id; })[0] || BA.solos[2];
  };

  /* ================================================================
     Blocos padronizados (planilha de origem)
     ================================================================ */

  /* tipo → [concreto m³, forma m², aço kg, altura H m, largura A m] */
  BA.tipos = {
    1: [0.12, 1.12, 9, 0.6, 0.6], 2: [0.17, 1.46, 12, 0.7, 0.7],
    3: [0.23, 1.80, 15, 0.8, 0.8], 4: [0.29, 2.26, 19, 0.9, 0.9],
    5: [0.44, 2.89, 32, 1.0, 1.0], 6: [0.54, 3.40, 41, 1.1, 1.1],
    7: [0.65, 3.96, 46, 1.2, 1.2], 8: [0.90, 4.76, 61, 1.3, 1.3],
    9: [1.05, 5.42, 73, 1.4, 1.4], 10: [1.22, 6.12, 87, 1.5, 1.5],
    11: [1.35, 6.48, 90, 1.5, 1.6], 12: [1.48, 6.84, 98, 1.5, 1.7],
    13: [1.62, 7.20, 105, 1.5, 1.8], 14: [1.77, 7.56, 113, 1.5, 1.9],
    15: [1.92, 7.92, 130, 1.5, 2.0], 16: [1.40, 6.86, 91, 1.6, 1.6],
    17: [1.58, 7.64, 101, 1.7, 1.7], 18: [1.79, 8.46, 111, 1.8, 1.8],
    19: [1.94, 8.88, 134, 1.8, 1.9], 20: [2.10, 9.30, 144, 1.8, 2.0],
    21: [2.00, 9.32, 139, 1.9, 1.9], 22: [2.16, 9.76, 185, 2.0, 2.0],
    23: [2.46, 11.16, 205, 2.1, 2.1], 24: [2.64, 11.64, 221, 2.1, 2.2],
    25: [2.83, 12.12, 294, 2.1, 2.3], 26: [3.05, 12.60, 318, 2.1, 2.3]
  };

  /* Capacidade (empuxo máximo, kgf) por recobrimento, DN e tipo.
     Transcrição fiel da planilha; 0/ausente = tipo não previsto para o
     DN naquele recobrimento. */
  var DNS9 = [150, 200, 250, 300, 400, 500, 600, 700, 800];
  var DNS11 = [150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];
  var N = null;

  BA.capacidades = [
    { rec: 0.65, dns: DNS9, tipos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], cap: [
      [1800, 1800, 1800, N, N, N, N, N, N],
      [2100, 2100, 2100, 2100, N, N, N, N, N],
      [2900, 2900, 2900, 2900, 2900, N, N, N, N],
      [N, N, 3400, 3400, 3400, 3400, N, N, N],
      [N, N, N, 3800, 3800, 3800, 3800, N, N],
      [N, N, N, N, 4500, 4500, 4500, 4500, N],
      [N, N, N, N, N, 5100, 5100, 5100, 5100],
      [N, N, N, N, N, N, 6000, 6000, 6000],
      [N, N, N, N, N, N, N, 7000, 7000],
      [N, N, N, N, N, N, N, N, 8100],
      [N, N, N, N, N, N, N, N, 9500],
      [N, N, N, N, N, N, N, N, 10700],
      [N, N, N, N, N, N, N, N, 12100],
      [N, N, N, N, N, N, N, N, 13700],
      [N, N, N, N, N, N, N, N, 15200]] },
    { rec: 0.90, dns: DNS9, tipos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], cap: [
      [2500, 2500, 2100, 3000, 3800, 4500, 5000, 6000, 7000],
      [3100, 3100, 3000, 3000, 3800, 4500, 5000, 6000, 7000],
      [4000, 4000, 4000, 3900, 3800, 4500, 5000, 6000, 7000],
      [5000, 5000, 4900, 4800, 4700, 4500, 5000, 6000, 7000],
      [5100, 5100, 5100, 5100, 5100, 5000, 5000, 6000, 7000],
      [6000, 6000, 6000, 6000, 6000, 6000, 6000, 6000, 7000],
      [7000, 7000, 7000, 7000, 7000, 7000, 7000, 7000, 7000],
      [7500, 7500, 7500, 7500, 7800, 7900, 8000, 8000, 8000],
      [9000, 9000, 9000, 9000, 8800, 9000, 9000, 9000, 9000],
      [10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
      [12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500],
      [13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000],
      [14800, 14800, 14800, 14800, 14800, 14800, 14800, 14800, 14800],
      [16800, 16800, 16800, 16800, 16800, 16800, 16800, 16800, 16800],
      [19800, 19800, 19800, 19800, 19800, 19800, 19800, 19800, 19800]] },
    { rec: 1.50, dns: DNS11, tipos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], cap: [
      [3500, 3500, 3000, N, N, N, N, N, N, N, N],
      [4800, 4800, 4100, 4000, N, N, N, N, N, N, N],
      [6000, 6000, 5500, 5000, 4700, N, N, N, N, N, N],
      [7500, 7500, 7000, 6500, 5700, 5000, N, N, N, N, N],
      [8000, 8000, 7500, 7000, 6100, 5700, 5000, N, N, N, N],
      [9700, 9700, 9000, 8500, 7500, 6800, 6000, 5700, N, N, N],
      [N, N, 10500, 10000, 9000, 8000, 7000, 6700, 6000, N, N],
      [N, N, 11000, 10700, 9700, 8700, 8000, 7200, 6800, N, N],
      [N, N, 12800, 12000, 11000, 10000, 9000, 8100, 7800, 7100, N],
      [N, N, 14500, 13800, 13100, 12000, 11100, 10500, 9800, 8100, 7800],
      [N, N, N, 15500, 14000, 12800, 11800, 11000, 10000, 9100, 8800],
      [N, N, N, 17500, 16000, 14500, 13100, 12000, 11100, 10800, 10000],
      [N, N, N, 20000, 18000, 16100, 15000, 14800, 12800, 12000, 11000],
      [N, N, N, N, 20100, 18100, 17000, 15700, 14500, 13500, 12700],
      [N, N, N, N, 22800, 20800, 19000, 17500, 16000, 15000, 14100]] },
    { rec: 1.75, dns: DNS11, tipos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 16, 17, 18, 19, 20], cap: [
      [4000, 4000, 3800, N, N, N, N, N, N, N, N],
      [5200, 5200, 5000, 4800, N, N, N, N, N, N, N],
      [7000, 7000, 6700, 6000, 5100, N, N, N, N, N, N],
      [8900, 8900, 8100, 7700, 6800, 6000, N, N, N, N, N],
      [9800, 9800, 9000, 8400, 7500, 6900, 6000, N, N, N, N],
      /* 7000 corrigido: a planilha trazia 70000 (um zero a mais) */
      [11700, 11700, 11000, 10100, 9000, 8000, 7500, 7000, N, N, N],
      [N, N, 13000, 12000, 10800, 9800, 8900, 8000, 7500, N, N],
      [N, N, 13800, 13000, 11700, 10700, 9800, 9000, 8100, N, N],
      [N, N, 15800, 14900, 13100, 12000, 11000, 10100, 9700, N, N],
      [N, N, N, 17000, 15100, 14000, 12900, 12800, 11000, N, N],
      [N, N, N, 19000, 17100, 15800, 14500, 14100, 12100, N, N],
      /* 14000 corrigido: a planilha trazia 140000 (um zero a mais) */
      [N, N, N, 21700, 19100, 17700, 16000, 15000, 14000, N, N],
      [N, N, N, N, 21500, 19700, 18000, 16700, 15100, N, N],
      [N, N, N, N, 24000, 22000, 20000, 18800, 17100, N, N],
      [N, N, N, N, 27000, 24800, 22800, 21000, 18100, N, N]] }
  ];

  BA.RECOBRIMENTOS = [0.65, 0.90, 1.50, 1.75];

  BA.correcoes = [
    'Recobrimento 1,75 m, DN 700, tipo 6: a planilha de origem trazia 70000 kgf; corrigido para 7000 kgf (um zero a mais deixaria o bloco dez vezes mais "capaz" do que é).',
    'Recobrimento 1,75 m, DN 800, tipo 17: a planilha trazia 140000 kgf; corrigido para 14000 kgf.',
    'Na tabela de 1,75 m as colunas DN 900 e DN 1000 da planilha traziam valores incoerentes (menores que os de DN 800 no mesmo tipo, aparentemente arrastados de outra tabela); foram omitidas — nesses DN o bloco sai pelo cálculo de apoio.'
  ];

  /* DN de tabela mais próximo (por cima) para um DN qualquer */
  function idxDn(dns, dn) {
    var i;
    for (i = 0; i < dns.length; i++) if (dn <= dns[i]) return i;
    return -1;
  }

  /* Todas as linhas tipo × capacidade para um DN e recobrimento. */
  BA.tabelaPadrao = function (dn, rec) {
    var t = BA.capacidades.filter(function (c) { return Math.abs(c.rec - rec) < 0.01; })[0];
    if (!t) return null;
    var col = idxDn(t.dns, dn);
    if (col < 0) return null;
    return {
      rec: t.rec, dnTabela: t.dns[col],
      linhas: t.tipos.map(function (tipo, i) {
        var cap = t.cap[i][col];
        var q = BA.tipos[tipo];
        return { tipo: tipo, cap: cap, concreto: q[0], forma: q[1], aco: q[2], H: q[3], A: q[4] };
      })
    };
  };

  /* Menor bloco-padrão que resiste ao empuxo E, no recobrimento pedido.
     Se nenhum atende, tenta os recobrimentos maiores (mais solo sobre o
     bloco = mais capacidade), como faz a planilha de origem. */
  BA.selecionarPadrao = function (dn, rec, E) {
    var ordem = BA.RECOBRIMENTOS.filter(function (r) { return r >= rec - 0.01; });
    var i, j, tab;
    for (i = 0; i < ordem.length; i++) {
      tab = BA.tabelaPadrao(dn, ordem[i]);
      if (!tab) continue;
      for (j = 0; j < tab.linhas.length; j++) {
        if (tab.linhas[j].cap !== null && tab.linhas[j].cap >= E) {
          return { achou: true, rec: tab.rec, dnTabela: tab.dnTabela,
                   linha: tab.linhas[j], recPedido: Math.abs(tab.rec - rec) < 0.01 };
        }
      }
    }
    return { achou: false };
  };

  /* ================================================================
     Bloco calculado pelo apoio no solo
     ================================================================ */

  /* E em kgf; sigma em kgf/m²; fs adimensional; deM em m.
     Devolve a área de encosto necessária e uma sugestão de dimensões:
     altura do encosto b (≥ DE + 0,30 m, mínimo 0,50 m) e largura L. */
  BA.dimensionarApoio = function (E, sigma, fs, deM) {
    if (!(sigma > 0)) return { ok: false, motivo: 'solo sem capacidade de apoio' };
    var Anec = fs * E / sigma;
    /* encosto sem proporção absurda: a largura não passa de ~2,2 vezes a
       altura — empuxo grande cresce nas duas direções */
    var b = Math.max(0.5, Math.ceil((deM + 0.30) * 20) / 20);
    if (Anec / b > 2.2 * b) b = Math.ceil(Math.sqrt(Anec / 2.2) * 20) / 20;
    var L = Math.max(b, Math.ceil(Anec / b * 20) / 20);
    /* espessura no sentido do empuxo: envolve o tubo e dá massa ao bloco */
    var esp = Math.max(0.4, Math.ceil((deM + 0.30) * 20) / 20);
    return {
      ok: true, Anec: Anec, b: b, L: L, esp: esp,
      Aefetiva: b * L,
      concreto: b * L * esp,
      sigmaAtuante: E / (b * L),
      fsEfetivo: sigma > 0 ? (b * L) * sigma / E : 0
    };
  };

  /* Curva vertical convexa (empuxo para cima): o que segura é o peso.
     G ≥ FS·E  →  volume de concreto. */
  BA.dimensionarPeso = function (E, fs, gamaConcreto, deM) {
    var G = fs * E;
    var V = G / (gamaConcreto || 2400);
    var lado = Math.ceil(Math.pow(V, 1 / 3) * 20) / 20;
    var b = Math.max(0.5, Math.ceil((deM + 0.30) * 20) / 20);
    var L = Math.max(b, Math.ceil(V / (b * b) * 20) / 20);
    return { G: G, concreto: V, lado: lado, b: b, L: L };
  };

  /* ================================================================
     Cálculo completo de um bloco
     ================================================================ */

  /* entrada: { pecaId, deMm, de2Mm, pMca, orientacao, dn, rec, soloId,
                sigmaOverride, fs, gamaConcreto, tipoEscolhido }        */
  BA.calcular = function (b) {
    var deM = (b.deMm || 0) / 1000;
    var de2M = (b.de2Mm || 0) / 1000;
    var unit = BA.empuxoUnit(b.pecaId, deM, de2M);
    var E = unit * (b.pMca || 0);
    var solo = BA.solo(b.soloId);
    var sigma = (b.sigmaOverride !== null && b.sigmaOverride !== undefined && b.sigmaOverride !== '')
      ? Number(b.sigmaOverride) : solo.sigma;
    var fs = b.fs || 1.5;

    var r = {
      unit: unit, E: E, sigma: sigma, solo: solo, fs: fs,
      orientacao: b.orientacao || 'horizontal',
      padrao: null, tabela: null, apoio: null, peso: null, escolhido: null
    };
    if (!(E > 0)) return r;

    if (r.orientacao === 'horizontal') {
      r.tabela = BA.tabelaPadrao(b.dn, b.rec);
      r.padrao = BA.selecionarPadrao(b.dn, b.rec, E);
      r.apoio = BA.dimensionarApoio(E, sigma, fs, deM);
      if (b.tipoEscolhido && BA.tipos[b.tipoEscolhido]) {
        var q = BA.tipos[b.tipoEscolhido];
        var cap = null;
        if (r.tabela) {
          r.tabela.linhas.forEach(function (l) { if (l.tipo === b.tipoEscolhido) cap = l.cap; });
        }
        r.escolhido = { tipo: b.tipoEscolhido, cap: cap,
                        concreto: q[0], forma: q[1], aco: q[2], H: q[3], A: q[4],
                        atende: cap !== null && cap >= E };
      }
    } else if (r.orientacao === 'vert_baixo') {
      r.apoio = BA.dimensionarApoio(E, sigma, fs, deM);
    } else {
      r.peso = BA.dimensionarPeso(E, fs, b.gamaConcreto, deM);
    }
    return r;
  };

  /* ================================================================
     Fontes
     ================================================================ */

  BA.fontes = [
    { id: 'ba_empuxo', txt: 'Empuxo hidrostático em singularidades: E = p·A nas extremidades, tês e válvulas; E = 2·p·A·sen(θ/2) nas curvas; E = p·(A₁ − A₂) nas reduções — com A na seção EXTERNA do tubo (a pressão atua na junta). AZEVEDO NETTO; FERNÁNDEZ, Manual de Hidráulica, 9ª ed.; AWWA Manual M41.' },
    { id: 'ba_solo', txt: 'Tensão admissível de apoio do solo para anteprojeto de ancoragem: valores usuais de 5000 kgf/m² (argila mole) a 49000 kgf/m² (rocha alterada), conforme AWWA M41 / DIPRA (Thrust Restraint Design for Ductile Iron Pipe). Confirmar com sondagem quando o bloco for grande ou o solo, duvidoso.' },
    { id: 'ba_padrao', txt: 'Blocos padronizados tipos 1 a 26, com capacidades por DN e recobrimento: tabela de concessionária transcrita da planilha do usuário (Blocos_de_Ancoragem.xlsx), com dois valores corrigidos e as colunas DN 900/1000 de 1,75 m omitidas por incoerência — ver as correções registradas.' }
  ];

  PDA.BA = BA;
})(window.PDA = window.PDA || {});
