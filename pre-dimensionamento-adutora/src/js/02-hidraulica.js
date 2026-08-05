/* ------------------------------------------------------------------
 * Núcleo hidráulico
 *
 * Unidades internas: Q [m³/s], D [m], L [m], v [m/s], J [m/m], h [m]
 *
 * Referências das formulações estão em PDA.H.fontes
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var H = {};

  H.g = 9.80665;               /* m/s²  – aceleração da gravidade normal */
  H.GAMA_AGUA = 9806.65;       /* N/m³ a 4 °C (peso específico de referência) */

  /* Constantes de Hazen-Williams expostas para ajuste fino do usuário.
     Padrão: J = 10,643 · Q^1,852 · C^-1,852 · D^-4,871  (Azevedo Netto) */
  H.HW = { k: 10.643, expQ: 1.852, expD: 4.871 };

  /* ---------------- propriedades do fluido ---------------- */

  /* Viscosidade cinemática da água [m²/s] em função da temperatura [°C].
     Correlação de Poiseuille/Helmholtz (forma usual em hidráulica):
       ni = 1,792e-6 / (1 + 0,0337 T + 0,000221 T²) */
  H.viscosidadeAgua = function (T) {
    if (T === undefined || T === null || isNaN(T)) T = 20;
    return 1.792e-6 / (1 + 0.0337 * T + 0.000221 * T * T);
  };

  /* Massa específica da água [kg/m³] – ajuste de Thiesen/Tanaka (0–100 °C) */
  H.massaEspecificaAgua = function (T) {
    if (T === undefined || T === null || isNaN(T)) T = 20;
    return 1000 * (1 - (T + 288.9414) * Math.pow(T - 3.9863, 2) /
                       (508929.2 * (T + 68.12963)));
  };

  /* Pressão de vapor da água [mca] – equação de Buck */
  H.pressaoVaporAgua = function (T) {
    if (T === undefined || T === null || isNaN(T)) T = 20;
    var pkPa = 0.61121 * Math.exp((18.678 - T / 234.5) * (T / (257.14 + T)));
    return pkPa * 1000 / 9806.65; /* kPa -> mca */
  };

  /* Pressão atmosférica [mca] em função da altitude [m] – ISA */
  H.pressaoAtmosferica = function (altitude) {
    if (!altitude) altitude = 0;
    var pkPa = 101.325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
    return pkPa / 9.80665;
  };

  /* ---------------- geometria ---------------- */

  H.area = function (D) { return Math.PI * D * D / 4; };
  H.velocidade = function (Q, D) { return Q / H.area(D); };
  H.reynolds = function (v, D, ni) { return v * D / ni; };

  /* ---------------- fator de atrito ---------------- */

  /* Colebrook-White resolvido iterativamente (ponto fixo amortecido).
       1/sqrt(f) = -2 log10( eps/(3,7 D) + 2,51/(Re sqrt(f)) )
     eps e D na mesma unidade. Retorna {f, iter, regime} */
  H.fColebrook = function (Re, epsRel) {
    if (!(Re > 0)) return { f: 0, iter: 0, regime: 'nulo' };
    if (Re < 2000) return { f: 64 / Re, iter: 0, regime: 'laminar' };

    var regime = (Re < 4000) ? 'transicao' : 'turbulento';
    /* semente de Swamee-Jain */
    var x = 1 / Math.sqrt(H.fSwameeJain(Re, epsRel));
    var i, xn;
    for (i = 0; i < 60; i++) {
      xn = -2 * Math.log10(epsRel / 3.7 + 2.51 * x / Re);
      if (Math.abs(xn - x) < 1e-12) { x = xn; break; }
      x = xn;
    }
    return { f: 1 / (x * x), iter: i, regime: regime };
  };

  /* Swamee-Jain (1976) – explícita, erro < 1 % na faixa
     1e-6 <= eps/D <= 1e-2 e 5e3 <= Re <= 1e8 */
  H.fSwameeJain = function (Re, epsRel) {
    if (!(Re > 0)) return 0;
    if (Re < 2000) return 64 / Re;
    var a = Math.log10(epsRel / 3.7 + 5.74 / Math.pow(Re, 0.9));
    return 0.25 / (a * a);
  };

  /* Zigrang-Sylvester (1982) – forma usada na planilha Colebrook original
     1/sqrt(f) = -2 log10[ eps/3,7D - (5,02/Re) log10( eps/3,7D + 14,5/Re ) ] */
  H.fZigrangSylvester = function (Re, epsRel) {
    if (!(Re > 0)) return 0;
    if (Re < 2000) return 64 / Re;
    var t = epsRel / 3.7;
    var a = Math.log10(t - (5.02 / Re) * Math.log10(t + 14.5 / Re));
    return 0.25 / (a * a);
  };

  H.fatorAtrito = function (Re, epsRel, metodo) {
    switch (metodo) {
      case 'swamee':  return { f: H.fSwameeJain(Re, epsRel), regime: Re < 2000 ? 'laminar' : (Re < 4000 ? 'transicao' : 'turbulento') };
      case 'zigrang': return { f: H.fZigrangSylvester(Re, epsRel), regime: Re < 2000 ? 'laminar' : (Re < 4000 ? 'transicao' : 'turbulento') };
      default:        return H.fColebrook(Re, epsRel);
    }
  };

  /* ---------------- perda de carga distribuída ---------------- */

  /* Hazen-Williams: J [m/m]. C adimensional, Q [m³/s], D [m] */
  H.jHazenWilliams = function (Q, D, C) {
    if (!(Q > 0) || !(D > 0) || !(C > 0)) return 0;
    return H.HW.k * Math.pow(Q, H.HW.expQ) /
           (Math.pow(C, H.HW.expQ) * Math.pow(D, H.HW.expD));
  };

  /* Universal (Darcy-Weisbach): J [m/m]. eps [m] */
  H.jUniversal = function (Q, D, eps, ni, metodo) {
    if (!(Q > 0) || !(D > 0)) return { J: 0, f: 0, Re: 0, v: 0, regime: 'nulo' };
    var v = H.velocidade(Q, D);
    var Re = H.reynolds(v, D, ni);
    var r = H.fatorAtrito(Re, eps / D, metodo);
    var J = r.f * v * v / (2 * H.g * D);
    return { J: J, f: r.f, Re: Re, v: v, regime: r.regime };
  };

  /* Fórmula única de acesso.
     op = {metodo:'hw'|'colebrook'|'swamee'|'zigrang', C, eps, ni} */
  H.perdaDistribuida = function (Q, D, L, op) {
    var out = { J: 0, hf: 0, v: 0, Re: 0, f: null, regime: null, metodo: op.metodo };
    if (!(D > 0)) return out;
    out.v = H.velocidade(Q, D);
    if (op.metodo === 'hw') {
      out.J = H.jHazenWilliams(Q, D, op.C);
      out.Re = H.reynolds(out.v, D, op.ni || H.viscosidadeAgua(20));
    } else {
      var r = H.jUniversal(Q, D, op.eps, op.ni || H.viscosidadeAgua(20), op.metodo);
      out.J = r.J; out.f = r.f; out.Re = r.Re; out.regime = r.regime;
    }
    out.hf = out.J * L;
    return out;
  };

  /* ---------------- perda de carga localizada ---------------- */

  /* Método dos coeficientes K:  hl = K · v²/(2g)
     Quando informado diâmetro próprio da peça (di), usa a velocidade nele. */
  H.perdaLocalizada = function (Q, D, K) {
    if (!(D > 0) || !(K > 0)) return 0;
    var v = H.velocidade(Q, D);
    return K * v * v / (2 * H.g);
  };

  /* Método do comprimento equivalente: hl = J · Leq */
  H.perdaLocalizadaLeq = function (J, Leq) { return J * (Leq || 0); };

  /* ---------------- bomba ---------------- */

  /* Potência útil [cv]: Pu = gama·Q·H / 735,5  (SI) ~ Q[L/s]·H/75 */
  H.potenciaUtilCV = function (Q, Hm, gama) {
    gama = gama || H.GAMA_AGUA;
    return gama * Q * Hm / 735.49875;
  };

  /* Potência no eixo (BHP) [cv] considerando rendimento da bomba */
  H.potenciaEixoCV = function (Q, Hm, rendBomba, gama) {
    if (!(rendBomba > 0)) return 0;
    return H.potenciaUtilCV(Q, Hm, gama) / rendBomba;
  };

  H.cvParaKW = function (cv) { return cv * 0.7355; };
  H.kwParaCV = function (kw) { return kw / 0.7355; };

  /* NPSH disponível [mca]
     NPSHd = (patm - pv)/gama + z_sucção - hf_sucção
     zSuccao: positivo se a bomba está afogada (nível acima do eixo) */
  H.npshDisponivel = function (patmMca, pvMca, zSuccao, hfSuccao) {
    return patmMca - pvMca + zSuccao - hfSuccao;
  };

  /* ---------------- transitório hidráulico (pré-avaliação) ---------------- */

  /* Casos de ancoragem longitudinal (Halliwell, 1963).
     psi multiplica o termo D/(eE): quanto MAIOR o psi, menor a celeridade.
     O caso mais desfavorável (maior celeridade e maior sobrepressão) é o
     tubo ancorado em todo o comprimento. */
  H.ancoragem = [
    { id: 'juntas',   rot: 'Com juntas de dilatação em todo o comprimento',
      psi: function () { return 1; },
      nota: 'psi = 1. O tubo pode se deformar livremente na direção longitudinal. É o caso usual de tubulação enterrada com junta elástica, e o que resulta na MENOR celeridade.' },
    { id: 'montante', rot: 'Ancorado apenas na extremidade de montante',
      psi: function (nu) { return 1 - nu / 2; },
      nota: 'psi = 1 − ν/2, com ν o coeficiente de Poisson do material.' },
    { id: 'ancorado', rot: 'Ancorado contra movimento longitudinal em todo o comprimento',
      psi: function (nu) { return 1 - nu * nu; },
      nota: 'psi = 1 − ν². Tubo travado axialmente (blocos de ancoragem contínuos, tubo em galeria engastado). Resulta na MAIOR celeridade e, portanto, na maior sobrepressão — é o caso mais desfavorável.' },
    { id: 'manual',   rot: 'Informar psi diretamente',
      psi: function (nu, valor) { return valor; },
      nota: 'Valor informado pelo usuário.' }
  ];

  H.psiDe = function (idCaso, nu, valorManual) {
    var i;
    for (i = 0; i < H.ancoragem.length; i++) {
      if (H.ancoragem[i].id === idCaso) {
        return H.ancoragem[i].psi(nu === undefined || nu === null ? 0.3 : nu,
                                  valorManual === undefined || valorManual === null ? 1 : valorManual);
      }
    }
    return 1;
  };

  /* Celeridade da onda [m/s]
       a = 1 / sqrt( rho·(1/Ka + psi·D/(e·E)) )
     Ka  módulo de elasticidade volumétrica da água [Pa]
     E   módulo de elasticidade do material [Pa]
     psi coeficiente de ancoragem longitudinal (ver H.ancoragem) */
  H.celeridade = function (D, e, E, rho, Ka, psi) {
    rho = rho || 998.2;
    Ka = Ka || 2.19e9;
    psi = (psi === undefined) ? 1.0 : psi;
    if (!(e > 0) || !(E > 0)) return 0;
    return 1 / Math.sqrt(rho * (1 / Ka + psi * D / (e * E)));
  };

  /* Sobrepressão de Joukowsky (manobra rápida) [mca]:  dh = a·dv/g */
  H.joukowsky = function (a, dv) { return a * dv / H.g; };

  /* Sobrepressão de Michaud/Allievi (manobra lenta) [mca]: dh = 2·L·v/(g·t) */
  H.michaud = function (L, v, t) {
    if (!(t > 0)) return Infinity;
    return 2 * L * v / (H.g * t);
  };

  /* Tempo crítico de manobra [s]: tc = 2L/a */
  H.tempoCritico = function (L, a) { return a > 0 ? 2 * L / a : Infinity; };

  /* ---------------- diâmetro econômico ---------------- */

  /* Bresse: D = K·sqrt(Q) — K usual 0,7 a 1,3 (0,9 a 1,1 mais comum) */
  H.bresse = function (Q, K) { return (K || 1.0) * Math.sqrt(Q); };

  /* Bresse com marcha (fator de utilização): D = K·sqrt(X)·sqrt(Q),
     X = horas de funcionamento / 24 */
  H.bresseMarcha = function (Q, K, horasDia) {
    var X = (horasDia || 24) / 24;
    return (K || 1.0) * Math.pow(X, 0.25) * Math.sqrt(Q);
  };

  /* ABNT NBR 12215 / prática usual: fórmula de Forchheimer para trecho
     de sucção quando comparada ao recalque: Ds = 1,3·sqrt(X)·sqrt(Q) */
  H.forchheimer = function (Q, horasDia) {
    var X = (horasDia || 24) / 24;
    return 1.3 * Math.sqrt(X) * Math.sqrt(Q);
  };

  H.fontes = [
    { id: 'hw', txt: 'Hazen-Williams: J = 10,643·Q^1,852·C^-1,852·D^-4,871 — AZEVEDO NETTO, J. M. "Manual de Hidráulica", 9ª ed., Blucher, cap. 8.' },
    { id: 'colebrook', txt: 'Colebrook-White: 1/√f = -2·log₁₀(ε/3,7D + 2,51/(Re√f)) — COLEBROOK, C. F. (1939), J. Inst. Civ. Eng.; PORTO, R. M. "Hidráulica Básica", 4ª ed., EESC-USP, cap. 3.' },
    { id: 'swamee', txt: 'Swamee-Jain (1976): f = 0,25/[log₁₀(ε/3,7D + 5,74/Re^0,9)]² — ASCE J. Hydraulics Div., 102(5).' },
    { id: 'zigrang', txt: 'Zigrang-Sylvester (1982): f = 0,25/[log₁₀(ε/3,7D − (5,02/Re)·log₁₀(ε/3,7D + 14,5/Re))]² — AIChE Journal, 28(3). É a forma empregada na planilha "Colebrook" original.' },
    { id: 'localizada', txt: 'Perda localizada pelo método dos coeficientes: hₗ = K·v²/2g — AZEVEDO NETTO, cap. 9; PORTO, cap. 5.' },
    { id: 'bresse', txt: 'Bresse: D = K·√Q, com K de 0,7 a 1,3 — TSUTIYA, M. T. "Abastecimento de Água", 4ª ed., EPUSP, cap. 9.' },
    { id: 'forchheimer', txt: 'Forchheimer (sucção/marcha): D = 1,3·√X·√Q — TSUTIYA, cap. 9.' },
    { id: 'potencia', txt: 'Potência no eixo: P = γ·Q·Hm/(75·η) [cv, Q em L/s] — AZEVEDO NETTO, cap. 12.' },
    { id: 'npsh', txt: 'NPSH disponível: NPSHd = (patm − pv)/γ ± z − hf,sucção — ABNT NBR 12214:1992 (projeto de sistema de bombeamento de água); TSUTIYA, cap. 10.' },
    { id: 'celeridade', txt: 'Celeridade: a = 1/√[ρ(1/K + ψD/(eE))] — STREETER & WYLIE, "Fluid Transients"; PORTO, cap. 9.' },
    { id: 'joukowsky', txt: 'Sobrepressão máxima (manobra rápida): Δh = a·Δv/g — JOUKOWSKY (1898); PORTO, cap. 9.' },
    { id: 'ancoragem', txt: 'Coeficiente de ancoragem longitudinal ψ: 1 (juntas de dilatação), 1 − ν/2 (ancorado só a montante) e 1 − ν² (ancorado em todo o comprimento) — HALLIWELL, A. R. (1963), "Velocity of a water-hammer wave in an elastic pipe", ASCE Journal of the Hydraulics Division, 89(4); STREETER & WYLIE, "Fluid Transients", cap. 2.' },
    { id: 'envoltoria', txt: 'Envoltórias de pressão do pré-dimensionamento: reta de (Hm ± Δh) na elevatória até o nível de chegada, hipótese simplificada usual em anteprojeto (equivalente ao traçado clássico com os gráficos de Allievi) — PORTO, cap. 9; ABNT NBR 12215.' },
    { id: 'michaud', txt: 'Manobra lenta (Michaud/Allievi): Δh = 2·L·v/(g·t) — PORTO, cap. 9.' },
    { id: 'viscosidade', txt: 'Viscosidade cinemática da água: ν = 1,792·10⁻⁶/(1 + 0,0337·T + 0,000221·T²) — AZEVEDO NETTO, cap. 1.' }
  ];

  PDA.H = H;
})(window.PDA = window.PDA || {});
