/* ------------------------------------------------------------------
 * Coeficientes de rugosidade por material e faixa de idade / condição
 *
 * hw  : coeficiente C de Hazen-Williams  [min, max, sugerido]
 * eps : rugosidade absoluta equivalente ε em MILÍMETROS [min, max, sugerido]
 *
 * As faixas de idade seguem a prática consagrada na literatura: a
 * degradação do coeficiente decorre de incrustação, tuberculização e
 * formação de biofilme, e não do tempo em si — por isso as faixas são
 * indicativas e sempre editáveis pelo usuário.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var R = {};

  R.faixasIdade = [
    { id: 'novo',   rot: 'Novo (0 a 5 anos)',        desc: 'Tubo novo ou recém-assentado, sem incrustação.' },
    { id: 'a5_15',  rot: 'Usado (5 a 15 anos)',      desc: 'Início de incrustação/biofilme; condição típica de rede em operação.' },
    { id: 'a15_30', rot: 'Usado (15 a 30 anos)',     desc: 'Incrustação estabelecida; redução perceptível de seção útil.' },
    { id: 'a30',    rot: 'Antigo (acima de 30 anos)',desc: 'Incrustação/tuberculização avançada. Recomenda-se aferição em campo.' }
  ];

  /* Fatores de conversão de fluido — PRÁTICA DE PROJETO, não norma.
     Para esgoto, a formação de biofilme (limo) na parede aumenta a
     rugosidade efetiva mesmo em tubos plásticos novos. */
  R.fluidos = [
    { id: 'agua_tratada', rot: 'Água tratada',   dC:   0, dEps: 0.00, nota: 'Condição de referência das tabelas.' },
    { id: 'agua_bruta',   rot: 'Água bruta',     dC:  -5, dEps: 0.02, nota: 'Sólidos em suspensão e possível deposição. Prática usual de projeto.' },
    { id: 'esgoto_trat',  rot: 'Efluente tratado', dC: -5, dEps: 0.03, nota: 'Biofilme leve. Prática usual de projeto.' },
    { id: 'esgoto_bruto', rot: 'Esgoto bruto',   dC: -15, dEps: 0.10, nota: 'Biofilme/limo aderido. TSUTIYA & ALEM SOBRINHO recomendam adotar C reduzido em linhas de recalque de esgoto; verificar experiência local.' },
    { id: 'lodo',         rot: 'Lodo / adensado', dC: -25, dEps: 0.20, nota: 'Fluido não newtoniano — o pré-dimensionamento por água é apenas indicativo; exige verificação reológica específica.' }
  ];

  /* ---------------- tabela principal ---------------- */
  R.materiais = {
    pead: {
      rot: 'PEAD / PE (polietileno)',
      hw:  { novo: [140, 150, 145], a5_15: [135, 145, 140], a15_30: [130, 140, 135], a30: [125, 135, 130] },
      eps: { novo: [0.0015, 0.01, 0.01], a5_15: [0.01, 0.05, 0.03], a15_30: [0.03, 0.10, 0.06], a30: [0.05, 0.15, 0.10] },
      fontes: ['az_plastico', 'porto_eps', 'iso4427']
    },
    pvc: {
      rot: 'PVC rígido (PBA / DEFoFo / soldável)',
      hw:  { novo: [140, 150, 145], a5_15: [135, 145, 140], a15_30: [130, 140, 135], a30: [125, 135, 130] },
      eps: { novo: [0.0015, 0.01, 0.01], a5_15: [0.01, 0.05, 0.03], a15_30: [0.03, 0.10, 0.06], a30: [0.05, 0.15, 0.10] },
      fontes: ['az_plastico', 'porto_eps', 'nbr5647']
    },
    pvc_o: {
      rot: 'PVC-O (orientado biaxialmente)',
      hw:  { novo: [145, 155, 150], a5_15: [140, 150, 145], a15_30: [135, 145, 140], a30: [130, 140, 135] },
      eps: { novo: [0.0015, 0.007, 0.005], a5_15: [0.005, 0.03, 0.02], a15_30: [0.02, 0.06, 0.04], a30: [0.04, 0.10, 0.07] },
      fontes: ['az_plastico', 'iso16422'],
      nota: 'Parede mais lisa que o PVC-U convencional; fabricantes indicam C ≈ 150. Confirmar no catálogo do fornecedor.'
    },
    pvc_m: {
      rot: 'PVC-M (modificado / MPVC)',
      hw:  { novo: [140, 150, 145], a5_15: [135, 145, 140], a15_30: [130, 140, 135], a30: [125, 135, 130] },
      eps: { novo: [0.0015, 0.01, 0.01], a5_15: [0.01, 0.05, 0.03], a15_30: [0.03, 0.10, 0.06], a30: [0.05, 0.15, 0.10] },
      fontes: ['az_plastico', 'porto_eps']
    },
    prfv: {
      rot: 'PRFV / GRP (poliéster com fibra de vidro)',
      hw:  { novo: [145, 155, 150], a5_15: [140, 150, 145], a15_30: [135, 145, 140], a30: [130, 140, 135] },
      eps: { novo: [0.005, 0.03, 0.02], a5_15: [0.02, 0.06, 0.04], a15_30: [0.04, 0.10, 0.07], a30: [0.07, 0.15, 0.10] },
      fontes: ['az_plastico', 'nbr15536']
    },
    fd_cimento: {
      rot: 'Ferro fundido dúctil c/ revestimento de cimento',
      hw:  { novo: [130, 140, 130], a5_15: [120, 130, 125], a15_30: [110, 125, 115], a30: [100, 115, 105] },
      eps: { novo: [0.05, 0.15, 0.10], a5_15: [0.15, 0.40, 0.25], a15_30: [0.40, 1.00, 0.60], a30: [1.00, 3.00, 1.50] },
      fontes: ['az_c', 'az_eps', 'nbr7675'],
      nota: 'Revestimento interno de argamassa de cimento centrifugada (NBR 8682) — condição normal de fornecimento no Brasil.'
    },
    fd_asfalto: {
      rot: 'Ferro fundido c/ revestimento asfáltico (betuminoso)',
      hw:  { novo: [125, 135, 130], a5_15: [110, 125, 118], a15_30: [95, 115, 105], a30: [85, 105, 95] },
      eps: { novo: [0.12, 0.20, 0.15], a5_15: [0.20, 0.50, 0.35], a15_30: [0.50, 1.20, 0.80], a30: [1.20, 3.00, 2.00] },
      fontes: ['az_c', 'az_eps']
    },
    fd_sem_rev: {
      rot: 'Ferro fundido sem revestimento',
      hw:  { novo: [125, 130, 128], a5_15: [100, 115, 110], a15_30: [90, 100, 95], a30: [75, 90, 85] },
      eps: { novo: [0.25, 0.50, 0.30], a5_15: [0.50, 1.20, 0.80], a15_30: [1.20, 2.50, 1.50], a30: [2.50, 5.00, 3.00] },
      fontes: ['az_c', 'az_eps'],
      nota: 'AZEVEDO NETTO: ferro fundido novo C = 130; em uso C = 90.'
    },
    aco_sold_novo: {
      rot: 'Aço soldado / com costura (revestimento comum)',
      hw:  { novo: [125, 135, 130], a5_15: [110, 125, 115], a15_30: [95, 110, 100], a30: [85, 100, 90] },
      eps: { novo: [0.04, 0.10, 0.05], a5_15: [0.10, 0.40, 0.20], a15_30: [0.40, 1.00, 0.60], a30: [1.00, 3.00, 1.50] },
      fontes: ['az_c', 'az_eps', 'nbr5590'],
      nota: 'AZEVEDO NETTO: aço soldado novo C = 130; em uso C = 90; com revestimento especial C = 130.'
    },
    aco_rev_esp: {
      rot: 'Aço com revestimento interno especial (epóxi / cimento)',
      hw:  { novo: [130, 140, 135], a5_15: [125, 135, 130], a15_30: [118, 130, 122], a30: [110, 125, 115] },
      eps: { novo: [0.03, 0.10, 0.05], a5_15: [0.05, 0.20, 0.12], a15_30: [0.12, 0.40, 0.25], a30: [0.25, 0.80, 0.45] },
      fontes: ['az_c', 'az_eps']
    },
    aco_galv: {
      rot: 'Aço galvanizado (ferro galvanizado)',
      hw:  { novo: [120, 130, 125], a5_15: [110, 125, 120], a15_30: [100, 115, 108], a30: [90, 105, 95] },
      eps: { novo: [0.10, 0.20, 0.15], a5_15: [0.20, 0.50, 0.30], a15_30: [0.50, 1.20, 0.80], a30: [1.20, 3.00, 1.80] },
      fontes: ['az_c', 'az_eps', 'nbr5580'],
      nota: 'AZEVEDO NETTO tabula C = 125 para aço galvanizado "novo e em uso".'
    },
    aco_inox: {
      rot: 'Aço inoxidável',
      hw:  { novo: [140, 150, 145], a5_15: [135, 148, 140], a15_30: [130, 145, 138], a30: [128, 142, 135] },
      eps: { novo: [0.015, 0.05, 0.03], a5_15: [0.03, 0.08, 0.05], a15_30: [0.05, 0.12, 0.08], a30: [0.08, 0.20, 0.12] },
      fontes: ['porto_eps']
    },
    aco_rebitado: {
      rot: 'Aço rebitado',
      hw:  { novo: [105, 115, 110], a5_15: [90, 105, 95], a15_30: [80, 95, 88], a30: [70, 88, 80] },
      eps: { novo: [0.90, 3.00, 1.50], a5_15: [1.50, 5.00, 3.00], a15_30: [3.00, 7.00, 5.00], a30: [5.00, 9.00, 7.00] },
      fontes: ['az_c', 'az_eps']
    },
    concreto_liso: {
      rot: 'Concreto — acabamento liso (forma metálica / centrifugado)',
      hw:  { novo: [130, 140, 130], a5_15: [125, 135, 128], a15_30: [118, 130, 122], a30: [110, 125, 115] },
      eps: { novo: [0.30, 0.80, 0.50], a5_15: [0.50, 1.20, 0.80], a15_30: [0.80, 2.00, 1.20], a30: [1.20, 3.00, 2.00] },
      fontes: ['az_c', 'az_eps', 'nbr8890'],
      nota: 'AZEVEDO NETTO: concreto bem acabado C = 130; acabamento comum C = 120.'
    },
    concreto_comum: {
      rot: 'Concreto — acabamento comum',
      hw:  { novo: [118, 125, 120], a5_15: [112, 122, 118], a15_30: [105, 118, 110], a30: [95, 110, 102] },
      eps: { novo: [1.00, 3.00, 2.00], a5_15: [2.00, 4.00, 3.00], a15_30: [3.00, 6.00, 4.00], a30: [4.00, 10.00, 6.00] },
      fontes: ['az_c', 'az_eps', 'nbr8890']
    },
    cimento_amianto: {
      rot: 'Cimento-amianto (fibrocimento)',
      hw:  { novo: [135, 145, 140], a5_15: [125, 138, 130], a15_30: [115, 130, 122], a30: [105, 122, 112] },
      eps: { novo: [0.05, 0.10, 0.08], a5_15: [0.10, 0.30, 0.20], a15_30: [0.30, 0.80, 0.50], a30: [0.80, 2.00, 1.20] },
      fontes: ['az_c', 'az_eps'],
      nota: 'Material sem fabricação no Brasil (Lei 12.687/2012 e ADI 3937/STF); mantido para avaliação de redes existentes.'
    },
    cobre_latao: {
      rot: 'Cobre / latão',
      hw:  { novo: [130, 140, 135], a5_15: [128, 138, 132], a15_30: [125, 135, 130], a30: [120, 132, 126] },
      eps: { novo: [0.0015, 0.01, 0.005], a5_15: [0.01, 0.05, 0.02], a15_30: [0.02, 0.10, 0.05], a30: [0.05, 0.20, 0.10] },
      fontes: ['az_c', 'porto_eps']
    },
    manilha_ceramica: {
      rot: 'Grés cerâmico vidrado (manilha)',
      hw:  { novo: [108, 115, 110], a5_15: [100, 112, 105], a15_30: [95, 108, 100], a30: [88, 100, 94] },
      eps: { novo: [0.30, 1.00, 0.60], a5_15: [0.60, 1.50, 1.00], a15_30: [1.00, 3.00, 1.80], a30: [1.80, 5.00, 3.00] },
      fontes: ['az_c', 'az_eps']
    }
  };

  /* ---------------- elasticidade e Poisson (para a celeridade) ----------------
     E em GPa e coeficiente de Poisson ν, valores usuais de projeto.
     Fonte: STREETER & WYLIE, "Fluid Transients"; PORTO, "Hidráulica Básica",
     cap. 9; catálogos de fabricantes. */
  R.elasticidade = {
    aco:      { E: 210, nu: 0.30, rot: 'Aço' },
    fd:       { E: 170, nu: 0.28, rot: 'Ferro fundido dúctil' },
    fofo:     { E: 100, nu: 0.26, rot: 'Ferro fundido cinzento' },
    pvc:      { E: 3.0, nu: 0.40, rot: 'PVC rígido' },
    pvc_o:    { E: 4.0, nu: 0.40, rot: 'PVC-O' },
    pead:     { E: 1.0, nu: 0.45, rot: 'PEAD (curto prazo ≈ 1,0 GPa)' },
    prfv:     { E: 30,  nu: 0.30, rot: 'PRFV / GRP' },
    concreto: { E: 30,  nu: 0.18, rot: 'Concreto' },
    fibrocim: { E: 24,  nu: 0.25, rot: 'Fibrocimento' },
    inox:     { E: 200, nu: 0.30, rot: 'Aço inoxidável' },
    cobre:    { E: 120, nu: 0.34, rot: 'Cobre' }
  };

  /* ---------------- fontes ---------------- */
  R.fontes = {
    az_c: {
      titulo: 'AZEVEDO NETTO, J. M.; FERNÁNDEZ, M. F. — Manual de Hidráulica',
      detalhe: '9ª ed., Blucher, 2015. Tabela de valores do coeficiente C de Hazen-Williams (cap. 8): aço galvanizado 125; aço soldado novo 130 / em uso 90; ferro fundido novo 130 / em uso 90 / revestido de cimento 130; concreto bem acabado 130 / comum 120; plástico 140; grés cerâmico 110; aço rebitado novo 110 / em uso 85.',
      tipo: 'Literatura consagrada'
    },
    az_eps: {
      titulo: 'AZEVEDO NETTO — Manual de Hidráulica (rugosidade absoluta)',
      detalhe: 'Tabela de rugosidade equivalente ε (cap. 8): aço laminado novo 0,04–0,10 mm; aço soldado novo 0,05–0,10 mm; aço soldado usado 0,4 mm e muito usado 0,5–1,2 mm; aço galvanizado 0,15–0,20 mm; ferro fundido novo 0,25–0,50 mm; ferro fundido com revestimento asfáltico 0,12–0,20 mm; ferro fundido incrustado 1,0–3,0 mm; concreto liso 0,3–0,8 mm; concreto rugoso 1–3 mm.',
      tipo: 'Literatura consagrada'
    },
    az_plastico: {
      titulo: 'AZEVEDO NETTO — tubos de material plástico',
      detalhe: 'C = 140 para plástico (valor de tabela). Fabricantes e a prática de projeto brasileira adotam C entre 140 e 150 para PVC e PEAD novos, com redução ao longo da vida útil.',
      tipo: 'Literatura consagrada'
    },
    porto_eps: {
      titulo: 'PORTO, R. M. — Hidráulica Básica',
      detalhe: '4ª ed., EESC-USP/Projeto REENGE. Tabela de rugosidade equivalente: tubos de plástico (PVC, PEAD) ε = 0,0015 a 0,010 mm; aço inoxidável 0,015–0,05 mm; cobre/latão estirado 0,0015–0,010 mm.',
      tipo: 'Literatura consagrada'
    },
    nbr7675: {
      titulo: 'ABNT NBR 7675 — Tubos e conexões de ferro fundido dúctil',
      detalhe: 'Define classes de espessura (K) pela expressão e = K·(0,5 + 0,001·DN) mm, com espessuras mínimas por DN, e os diâmetros externos padronizados (compatíveis com ISO 2531 / EN 545).',
      tipo: 'Norma ABNT'
    },
    en1092: {
      titulo: 'EN 1092-2 / ABNT NBR 7675 — Flanges de ferro fundido dúctil',
      detalhe: 'Classes de pressão PN 10, 16, 25 e 40 para flanges de ferro fundido dúctil. A classe de pressão do conjunto flangeado é limitada pelo flange, e não apenas pela espessura de parede do tubo. A PFA (pressão de serviço admissível) por DN deve ser confirmada no catálogo do fabricante.',
      tipo: 'Norma internacional / ABNT'
    },
    nbr8682: {
      titulo: 'ABNT NBR 8682 — Revestimento interno de argamassa de cimento em tubos de ferro fundido dúctil',
      detalhe: 'Estabelece espessuras nominais do revestimento de argamassa centrifugada, que reduz o diâmetro hidráulico útil em relação ao cálculo DE − 2e.',
      tipo: 'Norma ABNT'
    },
    iso4427: {
      titulo: 'ABNT NBR 15561 / ISO 4427-2 — Tubos de PE para água sob pressão',
      detalhe: 'Séries SDR e espessuras mínimas de parede. PN = 2·MRS/(C·(SDR−1)); para PE 100 (MRS 10 MPa, C = 1,25): SDR 11 → PN 16; SDR 17 → PN 10; SDR 21 → PN 8; SDR 26 → PN 6,3; SDR 33 → PN 5.',
      tipo: 'Norma ABNT / ISO'
    },
    iso16422: {
      titulo: 'ABNT NBR 16631 / ISO 16422 — Tubos de PVC-O',
      detalhe: 'Tubos de PVC orientado molecularmente. Classe 450 (MRS 45 MPa) com coeficiente de projeto C = 1,4 resulta σ = 32 MPa; a espessura é obtida de PN = 2σ/(SDR−1).',
      tipo: 'Norma ABNT / ISO'
    },
    nbr5647: { titulo: 'ABNT NBR 5647 — Tubos e conexões de PVC-U com junta elástica (rede de água)', detalhe: 'Séries PBA (classes 12, 15 e 20) e DEFoFo.', tipo: 'Norma ABNT' },
    nbr7665: { titulo: 'ABNT NBR 7665 — Tubos de PVC-U com junta elástica, série DEFoFo', detalhe: 'Diâmetros externos compatíveis com o ferro fundido (DEFoFo): DN 100 → DE 118; 150 → 170; 200 → 222; 250 → 274; 300 → 326; 350 → 378; 400 → 429; 500 → 532 mm.', tipo: 'Norma ABNT' },
    nbr5580: { titulo: 'ABNT NBR 5580 — Tubos de aço-carbono para rosca Whitworth gás', detalhe: 'Classes leve, média e pesada; base dos tubos de aço galvanizado comercializados no Brasil (equivalente a BS 1387 / ISO 65).', tipo: 'Norma ABNT' },
    nbr5590: { titulo: 'ABNT NBR 5590 — Tubos de aço-carbono com costura, com ou sem revestimento', detalhe: 'Dimensões e espessuras para condução de fluidos.', tipo: 'Norma ABNT' },
    asme_b3610: { titulo: 'ASME B36.10M — Welded and Seamless Wrought Steel Pipe', detalhe: 'Define diâmetros externos por NPS e espessuras por Schedule (SCH 10, 20, 30, 40, STD, 60, 80, XS…).', tipo: 'Norma internacional' },
    nbr8890: { titulo: 'ABNT NBR 8890 — Tubo de concreto de seção circular para água pluvial e esgoto sanitário', detalhe: 'Diâmetros nominais e classes de resistência; o diâmetro nominal corresponde ao diâmetro interno.', tipo: 'Norma ABNT' },
    nbr15536: { titulo: 'ABNT NBR 15536 — Sistemas para adução e distribuição de água e coletores de esgoto — Tubos de PRFV', detalhe: 'Diâmetros nominais correspondem ao diâmetro interno; classes de pressão e rigidez.', tipo: 'Norma ABNT' },
    nbr12214: { titulo: 'ABNT NBR 12214 — Projeto de sistema de bombeamento de água para abastecimento público', detalhe: 'Critérios de velocidade, barrilete, NPSH e reserva de conjuntos.', tipo: 'Norma ABNT' },
    nbr12215: { titulo: 'ABNT NBR 12215 — Projeto de adutora de água para abastecimento público', detalhe: 'Critérios de traçado, pressões admissíveis e verificação de transitórios.', tipo: 'Norma ABNT' },
    nbr12208: { titulo: 'ABNT NBR 12208 — Projeto de estações elevatórias de esgoto sanitário', detalhe: 'Velocidade mínima de autolimpeza na linha de recalque de esgoto (0,6 m/s) e critérios de barrilete.', tipo: 'Norma ABNT' },
    tsutiya: { titulo: 'TSUTIYA, M. T. — Abastecimento de Água', detalhe: '4ª ed., Depto. de Eng. Hidráulica e Sanitária da EPUSP. Diâmetro econômico, velocidades recomendadas e dimensionamento de elevatórias.', tipo: 'Literatura consagrada' },
    tsutiya_esgoto: { titulo: 'TSUTIYA, M. T.; ALEM SOBRINHO, P. — Coleta e Transporte de Esgoto Sanitário', detalhe: '3ª ed., EPUSP. Linhas de recalque de esgoto: velocidade mínima de autolimpeza, velocidades máximas e coeficientes de rugosidade afetados por biofilme.', tipo: 'Literatura consagrada' }
  };

  /* ---------------- consulta ---------------- */

  /* Retorna {C, eps, faixaC, faixaEps, fontes, nota} já com ajuste de fluido */
  R.consultar = function (materialId, idadeId, fluidoId) {
    var m = R.materiais[materialId];
    if (!m) return null;
    var idade = idadeId || 'novo';
    var hw = m.hw[idade] || m.hw.novo;
    var ep = m.eps[idade] || m.eps.novo;
    var fl = null, i;
    for (i = 0; i < R.fluidos.length; i++) if (R.fluidos[i].id === fluidoId) fl = R.fluidos[i];

    var dC = fl ? fl.dC : 0;
    var dE = fl ? fl.dEps : 0;

    return {
      material: materialId,
      rot: m.rot,
      idade: idade,
      C: Math.max(40, hw[2] + dC),
      eps: Math.max(0.0015, ep[2] + dE),
      faixaC: [Math.max(40, hw[0] + dC), Math.max(40, hw[1] + dC)],
      faixaEps: [Math.max(0.0015, ep[0] + dE), Math.max(0.0015, ep[1] + dE)],
      ajusteFluido: fl ? { rot: fl.rot, dC: dC, dEps: dE, nota: fl.nota } : null,
      fontes: (m.fontes || []).slice(),
      nota: m.nota || ''
    };
  };

  R.listaMateriais = function () {
    return Object.keys(R.materiais).map(function (k) {
      return { id: k, rot: R.materiais[k].rot };
    });
  };

  PDA.R = R;
})(window.PDA = window.PDA || {});
