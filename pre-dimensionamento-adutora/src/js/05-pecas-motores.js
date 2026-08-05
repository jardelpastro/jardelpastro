/* ------------------------------------------------------------------
 * Peças e conexões (coeficientes K), motores comerciais e critérios
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var P = {};

  /* ---------------- peças e coeficientes K ----------------
     Fonte principal: AZEVEDO NETTO, "Manual de Hidráulica", tabela de
     coeficientes de perda localizada. Os itens marcados com origem
     'planilha' são os que já constavam das planilhas de origem, mantidos
     com o mesmo valor para garantir a continuidade dos cálculos. */
  P.pecas = [
    { id: 'sino_succao',      rot: 'Sino de sucção',                 K: 0.30, cat: 'Sucção',        origem: 'planilha' },
    { id: 'valvula_pe',       rot: 'Válvula de pé com crivo',        K: 1.75, cat: 'Sucção',        origem: 'az' },
    { id: 'crivo',            rot: 'Crivo',                          K: 0.75, cat: 'Sucção',        origem: 'az' },
    { id: 'entrada_normal',   rot: 'Entrada normal em canalização',  K: 0.50, cat: 'Sucção',        origem: 'az' },
    { id: 'entrada_borda',    rot: 'Entrada de borda',               K: 1.00, cat: 'Sucção',        origem: 'az' },

    { id: 'curva90',          rot: 'Curva 90°',                      K: 0.40, cat: 'Curvas',        origem: 'planilha' },
    { id: 'curva45',          rot: 'Curva 45°',                      K: 0.20, cat: 'Curvas',        origem: 'planilha' },
    { id: 'curva22',          rot: 'Curva 22,5°',                    K: 0.10, cat: 'Curvas',        origem: 'planilha' },
    { id: 'curva11',          rot: 'Curva 11,25°',                   K: 0.05, cat: 'Curvas',        origem: 'planilha' },
    { id: 'cotovelo90',       rot: 'Cotovelo 90° (raio curto)',      K: 0.90, cat: 'Curvas',        origem: 'az' },
    { id: 'cotovelo45',       rot: 'Cotovelo 45°',                   K: 0.40, cat: 'Curvas',        origem: 'az' },

    { id: 'reducao_exc',      rot: 'Redução excêntrica',             K: 0.13, cat: 'Transições',    origem: 'planilha' },
    { id: 'reducao_conc',     rot: 'Redução concêntrica',            K: 0.30, cat: 'Transições',    origem: 'planilha' },
    { id: 'reducao_gradual',  rot: 'Redução gradual',                K: 0.15, cat: 'Transições',    origem: 'az' },
    { id: 'ampliacao',        rot: 'Ampliação gradual',              K: 0.30, cat: 'Transições',    origem: 'az' },
    { id: 'junta_montagem',   rot: 'Junta de montagem / dilatação',  K: 0.10, cat: 'Transições',    origem: 'planilha' },

    { id: 'te_direta',        rot: 'Tê — passagem direta',           K: 0.60, cat: 'Derivações',    origem: 'planilha' },
    { id: 'te_lateral',       rot: 'Tê — saída de lado',             K: 1.30, cat: 'Derivações',    origem: 'planilha' },
    { id: 'te_bilateral',     rot: 'Tê — saída bilateral',           K: 1.80, cat: 'Derivações',    origem: 'az' },
    { id: 'juncao',           rot: 'Junção',                         K: 0.40, cat: 'Derivações',    origem: 'az' },
    { id: 'derivacao_peq',    rot: 'Pequena derivação',              K: 0.03, cat: 'Derivações',    origem: 'az' },

    { id: 'vg',               rot: 'Válvula de gaveta aberta',       K: 0.20, cat: 'Válvulas',      origem: 'planilha' },
    { id: 'vg_volante',       rot: 'Válvula de gaveta com volante',  K: 0.20, cat: 'Válvulas',      origem: 'planilha' },
    { id: 'vb',               rot: 'Válvula borboleta aberta',       K: 0.30, cat: 'Válvulas',      origem: 'az' },
    { id: 'vr',               rot: 'Válvula de retenção',            K: 2.50, cat: 'Válvulas',      origem: 'planilha' },
    { id: 'vr_portinhola',    rot: 'Válvula de retenção de portinhola', K: 2.50, cat: 'Válvulas',   origem: 'az' },
    { id: 'v_globo',          rot: 'Válvula de globo aberta',        K: 10.0, cat: 'Válvulas',      origem: 'az' },
    { id: 'v_angulo',         rot: 'Válvula de ângulo aberta',       K: 5.00, cat: 'Válvulas',      origem: 'az' },
    { id: 'v_esfera',         rot: 'Válvula de esfera aberta',       K: 0.10, cat: 'Válvulas',      origem: 'lit' },
    { id: 'comporta',         rot: 'Comporta aberta',                K: 1.00, cat: 'Válvulas',      origem: 'az' },

    { id: 'medidor_vazao',    rot: 'Medidor de vazão (eletromagnético)', K: 0.20, cat: 'Acessórios', origem: 'planilha' },
    { id: 'venturi',          rot: 'Medidor Venturi',                K: 2.50, cat: 'Acessórios',    origem: 'az' },
    { id: 'ventosa',          rot: 'Ventosa',                        K: 0.20, cat: 'Acessórios',    origem: 'planilha' },
    { id: 'descarga',         rot: 'Descarga (ponta seca)',          K: 0.20, cat: 'Acessórios',    origem: 'planilha' },
    { id: 'hidrante',         rot: 'Hidrante',                       K: 0.20, cat: 'Acessórios',    origem: 'planilha' },
    { id: 'controlador',      rot: 'Controlador de vazão',           K: 2.50, cat: 'Acessórios',    origem: 'az' },
    { id: 'saida',            rot: 'Saída de canalização',           K: 1.00, cat: 'Acessórios',    origem: 'planilha' },
    { id: 'bocal',            rot: 'Bocal',                          K: 2.75, cat: 'Acessórios',    origem: 'az' }
  ];

  P.fontePecas = {
    az: 'AZEVEDO NETTO, J. M. — Manual de Hidráulica, 9ª ed., Blucher. Tabela de coeficientes K de perda de carga localizada.',
    planilha: 'Valor adotado nas planilhas de pré-dimensionamento de origem (compatível com a tabela do Manual de Hidráulica).',
    lit: 'Valor usual de catálogo de fabricante / literatura técnica — confirmar com o fornecedor da peça.'
  };

  P.buscarPeca = function (todas, id) {
    for (var i = 0; i < todas.length; i++) if (todas[i].id === id) return todas[i];
    return null;
  };

  /* ---------------- motores elétricos comerciais ----------------
     Potências nominais em cv da linha comercial brasileira (IEC).
     Editável pelo usuário nas configurações. */
  P.motores = [0.16, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 7.5, 10, 12.5, 15,
               20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400,
               450, 500, 600, 700, 800, 900, 1000];

  /* menor motor comercial >= potência requerida, com folga (%) */
  P.motorComercial = function (cvRequerido, folgaPct, tabela) {
    var t = tabela && tabela.length ? tabela : P.motores;
    var alvo = cvRequerido * (1 + (folgaPct || 0) / 100);
    for (var i = 0; i < t.length; i++) if (t[i] >= alvo - 1e-9) return t[i];
    return t[t.length - 1];
  };

  /* Folga mínima recomendada sobre a potência calculada (prática usual e
     recomendação de fabricantes de bombas) */
  P.folgaRecomendada = function (cv) {
    if (cv <= 2) return 50;
    if (cv <= 5) return 30;
    if (cv <= 10) return 20;
    if (cv <= 20) return 15;
    return 10;
  };

  P.fonteMotores = 'Folgas de 50 % (até 2 cv), 30 % (2–5 cv), 20 % (5–10 cv), 15 % (10–20 cv) e 10 % (acima de 20 cv) sobre a potência calculada — prática recomendada em manuais de bombeamento (KSB, Manual de Hidráulica) e adotada em projetos de elevatórias.';

  /* ---------------- critérios de verificação (editáveis) ---------------- */

  /* Faixas de referência por tipo de trecho e fluido.
     v  em m/s ; J em m/km */
  P.criterios = {
    agua: {
      succao:     { vMin: 0.60, vBom: [0.60, 1.50], vMax: 2.00, jBom: [0, 4.0], jMax: 6.0,
                    fonte: 'nbr12214', nota: 'NBR 12214: velocidade na sucção limitada para preservar o NPSH. Prática usual: 0,6 a 1,5 m/s.' },
      barrilete:  { vMin: 0.60, vBom: [1.00, 2.50], vMax: 3.50, jBom: [0, 15.0], jMax: 30.0,
                    fonte: 'nbr12214', nota: 'Trechos curtos internos à elevatória admitem velocidades maiores; o peso na perda total é pequeno.' },
      adutora:    { vMin: 0.60, vBom: [0.90, 2.00], vMax: 2.50, jBom: [1.5, 6.0], jMax: 10.0,
                    fonte: 'nbr12215', nota: 'Faixa econômica usual em adutoras de água. A perda unitária de 4 a 6 m/km costuma ser o intervalo de melhor relação custo de tubo × custo de energia.' }
    },
    esgoto: {
      succao:     { vMin: 0.60, vBom: [0.60, 1.50], vMax: 2.00, jBom: [0, 5.0], jMax: 8.0,
                    fonte: 'nbr12208', nota: 'NBR 12208: velocidade mínima de 0,6 m/s para autolimpeza, inclusive na sucção.' },
      barrilete:  { vMin: 0.60, vBom: [1.00, 3.00], vMax: 4.00, jBom: [0, 20.0], jMax: 40.0,
                    fonte: 'nbr12208', nota: 'Barrilete de elevatória de esgoto: garantir 0,6 m/s no cenário de menor vazão (1 bomba operando).' },
      adutora:    { vMin: 0.60, vBom: [0.90, 3.00], vMax: 3.50, jBom: [1.5, 10.0], jMax: 15.0,
                    fonte: 'nbr12208', nota: 'Linha de recalque de esgoto: velocidade mínima de autolimpeza 0,6 m/s (NBR 12208) e máxima usual 3,0 m/s. Verificar a mínima com apenas UMA bomba operando.' }
    }
  };

  P.tiposTrecho = [
    { id: 'succao',    rot: 'Sucção' },
    { id: 'barrilete', rot: 'Barrilete' },
    { id: 'adutora',   rot: 'Adutora / Linha de recalque' }
  ];

  PDA.P = P;
})(window.PDA = window.PDA || {});
