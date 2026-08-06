/* ------------------------------------------------------------------
 * Catálogos de tubos
 *
 * Cada catálogo:
 *   id, nome, familia, material (chave de PDA.R.materiais),
 *   designacao : 'DN' | 'DE' | 'NPS'  (rótulo comercial)
 *   revMm      : espessura de revestimento interno que reduz o DI (mm)
 *   fonteIds   : chaves de PDA.R.fontes
 *   itens      : [{ rot, dn, de, e, di, pn, calc, verificar }]
 *
 * DI (mm) = de − 2·e − 2·revMm, ou o valor de "di" quando informado
 * diretamente (concreto, PRFV — em que o DN é o próprio diâmetro interno).
 *
 * Flags de transparência:
 *   calc      : espessura obtida por fórmula normativa, não transcrita
 *               de tabela de fabricante
 *   verificar : valor a confirmar no catálogo do fornecedor
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var CAT = {};
  var lista = [];

  function r1(x) { return Math.round(x * 10) / 10; }

  /* ================= Ferro fundido dúctil ================= */

  /* DE padronizados — ISO 2531 / EN 545 / ABNT NBR 7675 */
  var FD_DE = {
    80: 98, 100: 118, 125: 144, 150: 170, 200: 222, 250: 274, 300: 326,
    350: 378, 400: 429, 450: 480, 500: 532, 600: 635, 700: 738, 800: 842,
    900: 945, 1000: 1048, 1100: 1152, 1200: 1255, 1400: 1462, 1500: 1565,
    1600: 1668, 1800: 1875, 2000: 2082
  };

  /* Espessuras K7 e K9 transcritas do catálogo do fabricante (as mesmas
     empregadas nas planilhas de origem). Para DN pequenos prevalece a
     espessura mínima normativa sobre a fórmula e = K(0,5 + 0,001·DN). */
  var FD_K7 = { 150: 5.2, 200: 5.4, 250: 5.5, 300: 5.7, 350: 5.9, 400: 6.3,
                450: 6.7, 500: 7.0, 600: 7.7, 700: 8.4, 800: 9.1, 900: 9.8,
                1000: 10.5, 1200: 11.9 };

  var FD_K9 = { 80: 6.0, 100: 6.0, 150: 6.0, 200: 6.3, 250: 6.8, 300: 7.2,
                350: 7.7, 400: 8.1, 450: 8.6, 500: 9.0, 600: 9.9, 700: 10.8,
                800: 11.7, 900: 12.6, 1000: 13.5, 1200: 15.3, 1400: 17.1,
                1500: 18.0, 1600: 18.9, 1800: 20.7, 2000: 22.5 };

  /* K12 pela fórmula normativa e = 12·(0,5 + 0,001·DN), mínimo 6,0 mm.
     Confere com as espessuras de tubos flangeados de DN 700 a 1200
     (14,4 / 15,6 / 16,8 / 18,0 / 20,4 mm). */
  function fdK12(dn) { return Math.max(6.0, r1(12 * (0.5 + 0.001 * dn))); }

  function catFD(id, nome, esp, fam, matKey, fonte, nota, revMm, calc) {
    var itens = Object.keys(esp).map(function (k) {
      var dn = Number(k);
      return { rot: 'DN ' + dn, dn: dn, de: FD_DE[dn], e: esp[k], calc: !!calc };
    }).sort(function (a, b) { return a.dn - b.dn; });
    return {
      id: id, nome: nome, familia: fam || 'Ferro fundido dúctil',
      material: matKey || 'fd_cimento', designacao: 'DN',
      revMm: revMm || 0, fonteIds: fonte || ['nbr7675', 'nbr8682'],
      nota: nota || '', itens: itens
    };
  }

  var espK12 = {};
  Object.keys(FD_DE).forEach(function (k) { espK12[k] = fdK12(Number(k)); });

  lista.push(catFD('fd_k7', 'Ferro Fundido Dúctil — Classe K7 (junta elástica)', FD_K7,
    null, 'fd_cimento', ['nbr7675', 'nbr8682'],
    'Classe de espessura K7 — usual em adutoras de água de DN 150 a 1200. Verificar a PFA (pressão de serviço admissível) por DN no catálogo do fabricante.'));

  lista.push(catFD('fd_k9', 'Ferro Fundido Dúctil — Classe K9 (junta elástica)', FD_K9,
    null, 'fd_cimento', ['nbr7675', 'nbr8682'],
    'Classe K9 — padrão histórico de fornecimento no Brasil, e = 9·(0,5 + 0,001·DN) com mínimo de 6,0 mm.'));

  lista.push(catFD('fd_k12', 'Ferro Fundido Dúctil — Classe K12', espK12,
    null, 'fd_cimento', ['nbr7675', 'nbr8682'],
    'Classe K12 — usual em tubos flangeados e em trechos de alta pressão. Espessuras calculadas por e = 12·(0,5 + 0,001·DN), mínimo 6,0 mm.',
    0, true));

  /* Flangeados — água (K9 até DN 600, K12 de DN 700 a 1200) */
  lista.push({
    id: 'fd_flg_agua', nome: 'Ferro Fundido Dúctil — Flangeado, água',
    familia: 'Ferro fundido dúctil', material: 'fd_cimento', designacao: 'DN',
    revMm: 0, fonteIds: ['nbr7675', 'nbr8682'],
    nota: 'Tubos flangeados para barrilete/casa de bombas: K9 até DN 600 e K12 de DN 700 a 1200.',
    itens: [80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200].map(function (dn) {
      return { rot: 'DN ' + dn, dn: dn, de: FD_DE[dn], e: dn <= 600 ? FD_K9[dn] : fdK12(dn) };
    })
  });

  /* Séries de esgoto (catálogo do fabricante — mesmas planilhas de origem) */
  lista.push({
    id: 'fd_esgoto_je', nome: 'Ferro Fundido Dúctil — Esgoto, junta elástica',
    familia: 'Ferro fundido dúctil', material: 'fd_cimento', designacao: 'DN',
    revMm: 0, fonteIds: ['nbr7675'],
    nota: 'Série para esgoto. Revestimento interno usual: argamassa de cimento de alto-forno ou epóxi — confirmar com o fabricante, pois altera a rugosidade adotada.',
    itens: [[80, 6.0], [100, 6.0], [150, 5.2], [200, 5.4], [250, 5.5], [300, 5.7], [350, 5.9],
            [400, 6.3], [450, 6.7], [500, 7.0], [600, 7.7], [700, 9.6], [800, 10.4],
            [900, 11.2], [1000, 12.0], [1200, 15.3]].map(function (p) {
      return { rot: 'DN ' + p[0], dn: p[0], de: FD_DE[p[0]], e: p[1] };
    })
  });

  lista.push({
    id: 'fd_esgoto_ph', nome: 'Ferro Fundido Dúctil — Esgoto, série PH (DE reduzido)',
    familia: 'Ferro fundido dúctil', material: 'fd_cimento', designacao: 'DN',
    revMm: 0, fonteIds: ['nbr7675'],
    nota: 'Série com diâmetros externos próprios (levemente inferiores à série ISO 2531). Dados transcritos do catálogo do fabricante.',
    itens: [[150, 169.7, 5.0], [200, 221.6, 5.0], [250, 273.0, 5.3], [300, 324.9, 5.6],
            [350, 376.8, 6.0], [400, 427.7, 6.3], [450, 478.6, 6.7], [500, 530.5, 7.0],
            [600, 633.3, 7.7], [700, 736.6, 9.6], [800, 840.4, 10.4], [900, 943.2, 11.2],
            [1000, 1046.0, 12.0], [1100, 1148.8, 14.4], [1200, 1252.3, 15.3]].map(function (p) {
      return { rot: 'DN ' + p[0], dn: p[0], de: p[1], e: p[2] };
    })
  });

  /* Flangeados por classe de pressão (PN 10, 16, 25 e 40).
     A espessura de parede segue a classe K do tubo; a classe de pressão do
     conjunto é limitada pelo flange, conforme EN 1092-2 / ABNT NBR 7675.
     PFA por DN e PN conforme a faixa de fornecimento do fabricante. */
  var FD_FLG_PN = {
    /* PN : { dnMax, classeK, obs } */
    10: { dns: [80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200],
          k: function (dn) { return dn <= 600 ? FD_K9[dn] : fdK12(dn); } },
    16: { dns: [80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200],
          k: function (dn) { return dn <= 600 ? FD_K9[dn] : fdK12(dn); } },
    25: { dns: [80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000, 1200],
          k: function (dn) { return fdK12(dn); } },
    40: { dns: [80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600],
          k: function (dn) { return fdK12(dn); } }
  };

  Object.keys(FD_FLG_PN).forEach(function (pn) {
    var cfg = FD_FLG_PN[pn];
    lista.push({
      id: 'fd_flg_pn' + pn,
      nome: 'Ferro Fundido Dúctil — Flangeado PN ' + pn + ' (Saint-Gobain)',
      familia: 'Ferro fundido dúctil', material: 'fd_cimento', designacao: 'DN',
      revMm: 0, fonteIds: ['nbr7675', 'nbr8682', 'en1092'],
      nota: 'Tubo flangeado de ferro fundido dúctil, classe de pressão PN ' + pn +
            ' (= ' + (Number(pn) * 10) + ' mca). Espessura de parede da classe ' +
            (Number(pn) >= 25 ? 'K12' : 'K9 até DN 600 e K12 acima') +
            '. O PN do conjunto é limitado pelo flange (EN 1092-2). ' +
            'Confirmar a PFA e a disponibilidade do DN no catálogo do fabricante.',
      itens: cfg.dns.map(function (dn) {
        return { rot: 'DN ' + dn, dn: dn, de: FD_DE[dn], e: cfg.k(dn), pn: Number(pn), verificar: true };
      })
    });
  });

  /* ================= PEAD ================= */

  /* Espessuras mínimas por SDR (mm), transcritas das tabelas de fabricante
     / NBR 15561. A espessura depende apenas do SDR; o PN depende do PE. */
  var PEAD_E = {
    '33': { 315: 9.7, 355: 10.9, 400: 12.3, 450: 13.8, 500: 15.3, 560: 17.2, 630: 19.3,
            710: 21.8, 800: 24.5, 900: 27.6, 1000: 30.6, 1200: 36.7, 1400: 42.9, 1600: 49.0 },
    '26': { 50: 2.0, 63: 2.5, 75: 2.9, 90: 3.5, 110: 4.2, 125: 4.8, 140: 5.4, 160: 6.2,
            180: 6.9, 200: 7.7, 225: 8.6, 250: 9.6, 280: 10.7, 315: 12.1, 355: 13.6,
            400: 15.3, 450: 17.2, 500: 19.1, 560: 21.4, 630: 24.1, 710: 27.2, 800: 30.6,
            900: 34.4, 1000: 38.2, 1200: 45.9, 1400: 53.5, 1600: 61.2 },
    '21': { 40: 2.0, 50: 2.4, 63: 3.0, 75: 3.6, 90: 4.3, 110: 5.3, 125: 6.0, 140: 6.7,
            160: 7.7, 180: 8.6, 200: 9.6, 225: 10.8, 250: 11.9, 280: 13.4, 315: 15.0,
            355: 16.9, 400: 19.1, 450: 21.5, 500: 23.9, 560: 26.7, 630: 30.0, 710: 33.9,
            800: 38.1, 900: 42.9, 1000: 47.7, 1200: 57.2, 1400: 66.7, 1600: 76.2 },
    '17': { 32: 2.0, 40: 2.4, 50: 3.0, 63: 3.8, 75: 4.5, 90: 5.4, 110: 6.6, 125: 7.4,
            140: 8.3, 160: 9.5, 180: 10.7, 200: 11.9, 225: 13.4, 250: 14.8, 280: 16.6,
            315: 18.7, 355: 21.1, 400: 23.7, 450: 26.7, 500: 29.7, 560: 33.2, 630: 37.4,
            710: 42.1, 800: 47.4, 900: 53.3, 1000: 59.3, 1200: 70.6 },
    '13.6': { 25: 2.0, 32: 2.4, 40: 3.0, 50: 3.7, 63: 4.7, 75: 5.6, 90: 6.7, 110: 8.1,
              125: 9.2, 140: 10.3, 160: 11.8, 180: 13.3, 200: 14.7, 225: 16.6, 250: 18.4,
              280: 20.6, 315: 23.2, 355: 26.1, 400: 29.4, 450: 33.1, 500: 36.8, 560: 41.2,
              630: 46.3, 710: 52.2, 800: 58.8, 900: 66.2, 1000: 73.5, 1200: 88.2,
              1400: 102.9, 1600: 117.6 },
    '11': { 20: 2.0, 25: 2.3, 32: 3.0, 40: 3.7, 50: 4.6, 63: 5.8, 75: 6.8, 90: 8.2,
            110: 10.0, 125: 11.4, 140: 12.7, 160: 14.6, 180: 16.4, 200: 18.2, 225: 20.5,
            250: 22.7, 280: 25.4, 315: 28.6, 355: 32.2, 400: 36.3, 450: 40.9, 500: 45.4,
            560: 50.8, 630: 57.2, 710: 64.5, 800: 72.6, 900: 81.7, 1000: 90.2 },
    '9': { 20: 2.3, 25: 3.0, 32: 3.6, 40: 4.5, 50: 5.6, 63: 7.1, 75: 8.4, 90: 10.1,
           110: 12.3, 125: 14.0, 140: 15.7, 160: 17.9, 180: 20.1, 200: 22.4, 225: 25.2,
           250: 27.9, 280: 31.3, 315: 35.2, 355: 39.7, 400: 44.7, 450: 50.3, 500: 55.8 },
    '7.4': { 20: 3.0, 25: 3.5, 32: 4.4, 40: 5.5, 50: 6.9, 63: 8.6, 75: 10.3, 90: 12.3,
             110: 15.1, 125: 17.1, 140: 19.2, 160: 21.9, 180: 24.6, 200: 27.4, 225: 30.8,
             250: 34.2, 280: 38.3, 315: 43.1, 355: 48.5, 400: 54.7, 450: 61.5 },
    '6': { 20: 3.4, 25: 4.2, 32: 5.4, 40: 6.7, 50: 8.3, 63: 10.5, 75: 12.5, 90: 15.0,
           110: 18.3, 125: 20.8, 140: 23.3, 160: 26.6, 180: 29.9, 200: 33.2, 225: 37.4,
           250: 41.5, 280: 46.5, 315: 52.3, 355: 59.0 }
  };

  /* Divergências corrigidas em relação às planilhas de origem (ver docs) */
  CAT.correcoes = [
    { onde: 'PEAD SDR 17 — DE 1200', era: '67,9 mm', agora: '70,6 mm',
      motivo: 'e = DE/SDR = 1200/17 = 70,6 mm. O valor da planilha não fecha com a série SDR.' },
    { onde: 'PEAD SDR 13,6 — DE 1000', era: '72,5 mm', agora: '73,5 mm',
      motivo: 'e = DE/SDR = 1000/13,6 = 73,5 mm.' },
    { onde: 'PVC DEFoFo (aba "PVC DEFoFo Amanco")', era: 'e = 4,8 / 10,9 / 12,3 / 13,8 / 15,3 mm para DN 100 a 300',
      agora: 'e = 4,8 / 6,8 / 8,9 / 11,0 / 13,1 mm (série SDR 25)',
      motivo: 'As espessuras da aba Amanco de DN 150 a 300 repetiam as do PEAD PN 5 (DE 355 a 500). Isso reduzia muito o DI e superestimava a perda de carga — o DN 150 saía com DI de 148 mm em vez de 156 mm.' },
    { onde: 'Coeficiente ψ de ancoragem do transitório (1ª versão deste programa)',
      era: 'ψ fixo em 1,0, apresentado como o caso mais conservador',
      agora: 'quatro casos: juntas de dilatação (ψ = 1), ancorado a montante (1 − ν/2), ancorado em todo o comprimento (1 − ν²) e manual',
      motivo: 'ψ multiplica D/(eE) no denominador da celeridade: quanto maior o ψ, MENOR a celeridade. O caso desfavorável é o tubo ancorado em todo o comprimento, não o com juntas de dilatação.' },
    { onde: 'Verificação de pressão (1ª versão deste programa)',
      era: 'pressão comparada apenas com o PN do tubo — um ponto com −21,95 mca saía como "Adequado"',
      agora: 'a classificação testa também os limites físicos: pressão negativa nunca é adequada, e abaixo de −10 mca há vaporização',
      motivo: 'Pressão negativa significa que a linha piezométrica passa abaixo da tubulação. A causa raiz do caso relatado era a cota de chegada divergindo da cota final do último trecho — hoje os dois campos são um único número, e um verificador acusa qualquer divergência.' },
    { onde: 'Trecho ativo sem diâmetro escolhido (3ª versão deste programa)',
      era: 'o cálculo caía no primeiro item do catálogo — o menor DN',
      agora: 'o trecho fica fora do cálculo, com aviso em vermelho no cartão e no Resumo',
      motivo: 'Num barrilete de sucção com 685 L/s isso significava DN 80, velocidade de 118 m/s e NPSH de −1334 mca. O NPSH em si estava correto — usa só as perdas de sucção —, o número absurdo vinha do diâmetro fantasma. Agora um trecho novo também herda o tubo do anterior.' },
    { onde: 'Trechos do barrilete de sucção comum (3ª versão deste programa)',
      era: 'criados com o tipo "barrilete"',
      agora: 'criados com o tipo "sucção"',
      motivo: 'Eram coloridos pela faixa de velocidade do barrilete (até 3,5 m/s em água) em vez da faixa de sucção (até 2,0 m/s), que é a que preserva o NPSH.' },
    { onde: 'Curva do sistema com mais de uma bomba (2ª versão deste programa)',
      era: 'vazão por bomba escalada e depois multiplicada por n, dobrando a vazão total',
      agora: 'vazão por bomba = vazão total / n',
      motivo: 'Encontrado pelos testes: para a mesma vazão total, a altura do sistema tem de ser a mesma com uma ou com duas bombas, porque as perdas são da tubulação.' },
    { onde: 'Célula F15 da aba "Pré-dimensionamento" (planilha Hazen-Williams)',
      era: '=IF(A14="", "", ...B14...D14...A14)', agora: 'referências da própria linha 15',
      motivo: 'A 5ª linha da tabela de diâmetros calculava a perda unitária com os dados da 4ª linha, repetindo o resultado do diâmetro anterior.' },
    { onde: 'Célula D15 da aba "Pré-dimensionamento" (planilha Colebrook)',
      era: '=IF(A14="", ...)', agora: 'testa a própria linha 15',
      motivo: 'Mesmo deslocamento de referência na 5ª linha.' },
    { onde: 'Fator de atrito (planilha Colebrook), termo interno',
      era: 'LOG((K/3,71*D) + 14,5/Re)', agora: 'log₁₀(ε/(3,7·D) + 14,5/Re)',
      motivo: 'Faltava o parêntese no denominador: escrito como K/3,71*D o Excel multiplica por D em vez de dividir. Além disso a constante consagrada é 3,7 (Colebrook), não 3,71.' }
  ];

  /* PN = 2·MRS/(C·(SDR−1)); PE 100 → 16/(SDR−1) MPa, PE 80 → 12,8/(SDR−1) MPa */
  var PN_PE100 = { '41': 4, '33': 5, '26': 6.3, '21': 8, '17': 10, '13.6': 12.5, '11': 16, '9': 20, '7.4': 25, '6': 32 };
  var PN_PE80  = { '41': 3.2, '33': 4, '26': 5, '21': 6.3, '17': 8, '13.6': 10, '11': 12.5, '9': 16, '7.4': 20, '6': 25 };

  ['100', '80'].forEach(function (pe) {
    Object.keys(PEAD_E).forEach(function (sdr) {
      var pn = (pe === '100' ? PN_PE100 : PN_PE80)[sdr];
      var tab = PEAD_E[sdr];
      var itens = Object.keys(tab).map(function (de) {
        return { rot: 'DE ' + de, dn: Number(de), de: Number(de), e: tab[de], pn: pn };
      }).sort(function (a, b) { return a.de - b.de; });
      lista.push({
        id: 'pead_pe' + pe + '_sdr' + sdr.replace('.', '_'),
        nome: 'PEAD PE ' + pe + ' — SDR ' + sdr.replace('.', ',') + ' (PN ' + String(pn).replace('.', ',') + ')',
        familia: 'PEAD', material: 'pead', designacao: 'DE', revMm: 0,
        fonteIds: ['iso4427'],
        nota: 'PN válido para água a 20 °C, 50 anos. PN = 2·MRS/[C·(SDR−1)] com MRS = ' +
              (pe === '100' ? '10' : '8') + ' MPa e C = 1,25. Para esgoto/efluente e para temperaturas acima de 20 °C aplicar os fatores de redução da NBR 15561.',
        itens: itens
      });
    });
  });

  /* ================= PVC ================= */

  /* DEFoFo — NBR 7665, série SDR 25 (PN 1,0 MPa) */
  var DEFOFO = { 100: 118, 150: 170, 200: 222, 250: 274, 300: 326, 350: 378, 400: 429, 500: 532 };

  lista.push({
    id: 'pvc_defofo', nome: 'PVC-U DEFoFo — JEI (NBR 7665)',
    familia: 'PVC', material: 'pvc', designacao: 'DN', revMm: 0,
    fonteIds: ['nbr7665', 'nbr5647'],
    nota: 'Série DEFoFo (diâmetro externo compatível com ferro fundido), SDR 25 → PN 1,0 MPa (100 mca).',
    itens: [[100, 4.8], [150, 6.8], [200, 8.9], [250, 11.0], [300, 13.1], [350, 15.2],
            [400, 17.2], [500, 21.3]].map(function (p) {
      return { rot: 'DN ' + p[0], dn: p[0], de: DEFOFO[p[0]], e: p[1], pn: 10 };
    })
  });

  lista.push({
    id: 'pvc_m_defofo', nome: 'PVC-M (modificado) DEFoFo',
    familia: 'PVC', material: 'pvc_m', designacao: 'DN', revMm: 0,
    fonteIds: ['nbr7665'],
    nota: 'PVC modificado com maior tenacidade; mesmas dimensões externas da série DEFoFo. Dados transcritos de catálogo de fabricante.',
    itens: [[100, 4.8], [150, 6.8], [200, 8.9], [250, 11.0], [300, 13.1], [350, 15.2],
            [400, 17.2], [500, 21.3]].map(function (p) {
      return { rot: 'DN ' + p[0], dn: p[0], de: DEFOFO[p[0]], e: p[1], pn: 10 };
    })
  });

  /* PBA — NBR 5647, classes 12 / 15 / 20 (pressão de serviço 60 / 75 / 100 mca) */
  var PBA_DE = { 50: 60, 75: 85, 100: 110 };
  [[12, 0.6], [15, 0.75], [20, 1.0]].forEach(function (cl) {
    var sdr = 2 * 10 / cl[1] + 1;   /* σ de projeto 10 MPa para PVC-U */
    lista.push({
      id: 'pvc_pba_' + cl[0], nome: 'PVC-U PBA classe ' + cl[0] + ' (' + (cl[1] * 100) + ' mca)',
      familia: 'PVC', material: 'pvc', designacao: 'DN', revMm: 0,
      fonteIds: ['nbr5647'],
      nota: 'Série PBA (bolsa e anel). Espessuras estimadas por e = DE/SDR com SDR = 2σ/p + 1 e σ = 10 MPa — confirmar na tabela do fabricante.',
      itens: Object.keys(PBA_DE).map(function (dn) {
        return { rot: 'DN ' + dn, dn: Number(dn), de: PBA_DE[dn],
                 e: Math.max(1.8, r1(PBA_DE[dn] / sdr)), pn: cl[1] * 10, calc: true, verificar: true };
      })
    });
  });

  /* PVC-O — NBR 16631 / ISO 16422, classe 450 (σ = 32 MPa com C = 1,4) */
  [[12.5, 12.5], [16, 16], [20, 20], [25, 25]].forEach(function (p) {
    var pnMPa = p[1] / 10;
    var sdr = 2 * 32 / pnMPa + 1;
    lista.push({
      id: 'pvc_o_pn' + String(p[0]).replace('.', '_'),
      nome: 'PVC-O classe 450 — PN ' + String(p[0]).replace('.', ',') + ' (DE série DEFoFo)',
      familia: 'PVC-O', material: 'pvc_o', designacao: 'DN', revMm: 0,
      fonteIds: ['iso16422'],
      nota: 'Espessuras estimadas por e = DE/SDR, SDR = 2σ/PN + 1, com σ = MRS/C = 45/1,4 = 32 MPa (PVC-O classe 450). ' +
            'A parede fina do PVC-O amplia o diâmetro interno útil — sempre conferir a tabela do fabricante antes de fechar o projeto.',
      itens: Object.keys(DEFOFO).map(function (dn) {
        return { rot: 'DN ' + dn, dn: Number(dn), de: DEFOFO[dn],
                 e: Math.max(2.0, r1(DEFOFO[dn] / sdr)), pn: p[0], calc: true, verificar: true };
      })
    });
  });

  /* ================= Aço ================= */

  /* ASME B36.10M — DE por NPS e espessuras SCH 40 / SCH 80 / STD / XS */
  var ACO = [
    /* NPS, DE, SCH40, SCH80, STD,  XS */
    ['1/2"',   21.3,  2.77,  3.73, 2.77,  3.73],
    ['3/4"',   26.7,  2.87,  3.91, 2.87,  3.91],
    ['1"',     33.4,  3.38,  4.55, 3.38,  4.55],
    ['1.1/4"', 42.2,  3.56,  4.85, 3.56,  4.85],
    ['1.1/2"', 48.3,  3.68,  5.08, 3.68,  5.08],
    ['2"',     60.3,  3.91,  5.54, 3.91,  5.54],
    ['2.1/2"', 73.0,  5.16,  7.01, 5.16,  7.01],
    ['3"',     88.9,  5.49,  7.62, 5.49,  7.62],
    ['4"',    114.3,  6.02,  8.56, 6.02,  8.56],
    ['5"',    141.3,  6.55,  9.53, 6.55,  9.53],
    ['6"',    168.3,  7.11, 10.97, 7.11, 10.97],
    ['8"',    219.1,  8.18, 12.70, 8.18, 12.70],
    ['10"',   273.0,  9.27, 15.09, 9.27, 12.70],
    ['12"',   323.8, 10.31, 17.48, 9.53, 12.70],
    ['14"',   355.6, 11.13, 19.05, 9.53, 12.70],
    ['16"',   406.4, 12.70, 21.44, 9.53, 12.70],
    ['18"',   457.0, 14.27, 23.83, 9.53, 12.70],
    ['20"',   508.0, 15.09, 26.19, 9.53, 12.70],
    ['24"',   610.0, 17.48, 30.96, 9.53, 12.70],
    ['26"',   660.0,  null,  null, 9.53, 12.70],
    ['28"',   711.0,  null,  null, 9.53, 12.70],
    ['30"',   762.0,  null,  null, 9.53, 12.70],
    ['32"',   813.0,  null,  null, 9.53, 12.70],
    ['36"',   914.0,  null,  null, 9.53, 12.70],
    ['40"',  1016.0,  null,  null, 9.53, 12.70],
    ['42"',  1067.0,  null,  null, 9.53, 12.70],
    ['48"',  1219.0,  null,  null, 9.53, 12.70]
  ];

  [[2, 'SCH 40', 'aco_sold_novo'], [3, 'SCH 80', 'aco_sold_novo'],
   [4, 'STD (parede padrão)', 'aco_sold_novo'], [5, 'XS (extra-forte)', 'aco_sold_novo']].forEach(function (cfg) {
    var idx = cfg[0];
    lista.push({
      id: 'aco_' + cfg[1].toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      nome: 'Aço-carbono — ' + cfg[1] + ' (ASME B36.10M)',
      familia: 'Aço', material: cfg[2], designacao: 'NPS', revMm: 0,
      fonteIds: ['asme_b3610', 'nbr5590'],
      nota: 'Diâmetros externos e espessuras conforme ASME B36.10M. Para adutoras revestidas internamente com argamassa de cimento, informar a espessura de revestimento no campo correspondente do catálogo (reduz o DI).',
      itens: ACO.filter(function (l) { return l[idx] !== null; }).map(function (l) {
        return { rot: l[0], dn: l[1], de: l[1], e: l[idx] };
      })
    });
  });

  /* Aço inoxidável — ASME B36.19M, SCH 10S e 40S */
  lista.push({
    id: 'inox_10s', nome: 'Aço inoxidável — SCH 10S (ASME B36.19M)',
    familia: 'Aço inoxidável', material: 'aco_inox', designacao: 'NPS', revMm: 0,
    fonteIds: ['asme_b3610'],
    nota: 'Série de parede fina, usual em barriletes e tubulações internas de estações. Confirmar espessuras no catálogo do fornecedor.',
    itens: [['1"', 33.4, 2.77], ['1.1/2"', 48.3, 2.77], ['2"', 60.3, 2.77], ['2.1/2"', 73.0, 3.05],
            ['3"', 88.9, 3.05], ['4"', 114.3, 3.05], ['6"', 168.3, 3.40], ['8"', 219.1, 3.76],
            ['10"', 273.0, 4.19], ['12"', 323.8, 4.57], ['14"', 355.6, 4.78], ['16"', 406.4, 4.78],
            ['18"', 457.0, 4.78], ['20"', 508.0, 5.54], ['24"', 610.0, 6.35]].map(function (l) {
      return { rot: l[0], dn: l[1], de: l[1], e: l[2], verificar: true };
    })
  });

  /* Ferro galvanizado — NBR 5580 (equivalente a BS 1387 / ISO 65) */
  var GALV = [
    /* rótulo, DN, DE, e média, e pesada */
    ['1/2" (DN 15)',   15,  21.3, 2.65, 3.25],
    ['3/4" (DN 20)',   20,  26.9, 2.65, 3.25],
    ['1" (DN 25)',     25,  33.7, 3.25, 4.05],
    ['1.1/4" (DN 32)', 32,  42.4, 3.25, 4.05],
    ['1.1/2" (DN 40)', 40,  48.3, 3.25, 4.05],
    ['2" (DN 50)',     50,  60.3, 3.65, 4.50],
    ['2.1/2" (DN 65)', 65,  76.1, 3.65, 4.85],
    ['3" (DN 80)',     80,  88.9, 4.05, 5.40],
    ['4" (DN 100)',   100, 114.3, 4.50, 5.40],
    ['5" (DN 125)',   125, 139.7, 4.85, 5.40],
    ['6" (DN 150)',   150, 165.1, 4.85, 5.40]
  ];
  [[3, 'classe média (M)'], [4, 'classe pesada (P)']].forEach(function (cfg) {
    lista.push({
      id: 'galv_' + (cfg[0] === 3 ? 'media' : 'pesada'),
      nome: 'Aço galvanizado — ' + cfg[1] + ' (NBR 5580)',
      familia: 'Aço galvanizado', material: 'aco_galv', designacao: 'DN', revMm: 0,
      fonteIds: ['nbr5580'],
      nota: 'Tubos com rosca Whitworth gás. Faixa de DN limitada (15 a 150 mm) — uso típico em instalações internas, sucção de bombas de pequeno porte e ramais, não em adutoras.',
      itens: GALV.map(function (l) {
        return { rot: l[0], dn: l[1], de: l[2], e: l[cfg[0]], verificar: true };
      })
    });
  });

  /* ================= Concreto e PRFV (DN = diâmetro interno) ================= */

  lista.push({
    id: 'concreto', nome: 'Concreto armado (NBR 8890) — DN = diâmetro interno',
    familia: 'Concreto', material: 'concreto_liso', designacao: 'DN', revMm: 0,
    fonteIds: ['nbr8890'],
    nota: 'Nos tubos de concreto o diâmetro nominal corresponde ao diâmetro interno. Uso em adutoras por gravidade e emissários; em linhas de recalque verificar a classe de pressão.',
    itens: [300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1500, 1750, 2000].map(function (dn) {
      return { rot: 'DN ' + dn, dn: dn, di: dn };
    })
  });

  lista.push({
    id: 'prfv', nome: 'PRFV / GRP (NBR 15536) — DN = diâmetro interno',
    familia: 'PRFV', material: 'prfv', designacao: 'DN', revMm: 0,
    fonteIds: ['nbr15536'],
    nota: 'O DN dos tubos de PRFV corresponde ao diâmetro interno nominal. Classes de pressão PN 6 a PN 32 e classes de rigidez SN 2500 a SN 10000 — o DI varia pouco com a classe.',
    itens: [100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000,
            1200, 1400, 1500, 1600, 1800, 2000, 2200, 2400, 2600, 3000].map(function (dn) {
      return { rot: 'DN ' + dn, dn: dn, di: dn };
    })
  });

  /* ================= API ================= */

  CAT.padrao = lista;

  CAT.diInterno = function (cat, item) {
    if (item.di !== undefined && item.di !== null) return item.di;
    var rev = (cat.revMm || 0);
    return item.de - 2 * item.e - 2 * rev;
  };

  /* devolve os catálogos agrupados por família */
  CAT.porFamilia = function (todos) {
    var g = {}, i, c;
    for (i = 0; i < todos.length; i++) {
      c = todos[i];
      if (!g[c.familia]) g[c.familia] = [];
      g[c.familia].push(c);
    }
    return g;
  };

  CAT.buscar = function (todos, id) {
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  };

  PDA.CAT = CAT;
})(window.PDA = window.PDA || {});
