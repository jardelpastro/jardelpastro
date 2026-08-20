/* Testes do núcleo de cálculo — executar com:  node tests/run.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..', 'src', 'js');
const arquivos = fs.readdirSync(raiz).filter(f => f.endsWith('.js')).sort();

const sandbox = { window: {}, console, localStorage: null, JSON, Math, Number, Object, Array, String, isNaN, parseFloat, parseInt, Date };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of arquivos) {
  if (/^\d\d-(ui|app)/.test(f)) continue;   /* módulos de interface não entram no teste */
  vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), sandbox, { filename: f });
}
const PDA = sandbox.window.PDA;

let falhas = 0, total = 0;
function ok(nome, cond, detalhe) {
  total++;
  if (cond) { console.log('  ok   ' + nome); }
  else { falhas++; console.log('  FALHA ' + nome + (detalhe ? '  -> ' + detalhe : '')); }
}
function prox(nome, a, b, tol) {
  total++;
  const d = Math.abs(a - b);
  const rel = b !== 0 ? d / Math.abs(b) : d;
  if (rel <= tol) console.log(`  ok   ${nome}  (${a.toPrecision(6)} ~ ${b.toPrecision(6)})`);
  else { falhas++; console.log(`  FALHA ${nome}  obtido ${a} esperado ${b} (desvio ${(rel * 100).toFixed(3)} %)`); }
}
function titulo(t) { console.log('\n' + t); }
function UI0(v) { return v === null || v === undefined ? '—' : Number(v).toFixed(2); }

const H = PDA.H, U = PDA.U, R = PDA.R, CAT = PDA.CAT, C = PDA.C, E = PDA.E;

/* ---------------------------------------------------------------- */
titulo('1. Unidades');
prox('400 L/s -> m³/s', U.para('vazao', 400, 'L/s'), 0.4, 1e-12);
prox('1000 m³/h -> m³/s', U.para('vazao', 1000, 'm³/h'), 0.277778, 1e-5);
prox('6,67 km -> m', U.para('extensao', 6.67, 'km'), 6670, 1e-12);
prox('ida e volta m³/dia', U.de('vazao', U.para('vazao', 8640, 'm³/dia'), 'm³/dia'), 8640, 1e-12);

/* ---------------------------------------------------------------- */
titulo('2. Fator de atrito');
/* Referências clássicas do diagrama de Moody */
prox('Colebrook Re=1e5, eps/D=1e-3', H.fColebrook(1e5, 1e-3).f, 0.02224, 5e-3);
prox('Colebrook Re=1e6, eps/D=1e-4', H.fColebrook(1e6, 1e-4).f, 0.013441, 5e-3);
prox('Colebrook Re=1e5, lisa', H.fColebrook(1e5, 0).f, 0.01799, 5e-3);
prox('Laminar Re=1000', H.fColebrook(1000, 1e-3).f, 0.064, 1e-9);
ok('regime laminar identificado', H.fColebrook(1000, 1e-3).regime === 'laminar');
ok('regime turbulento identificado', H.fColebrook(1e5, 1e-3).regime === 'turbulento');
/* Swamee-Jain deve ficar a menos de 1,5 % de Colebrook na faixa de validade */
let piorSJ = 0;
[1e4, 1e5, 1e6, 1e7, 1e8].forEach(Re => {
  [1e-6, 1e-5, 1e-4, 1e-3, 1e-2].forEach(er => {
    const a = H.fColebrook(Re, er).f, b = H.fSwameeJain(Re, er);
    piorSJ = Math.max(piorSJ, Math.abs(a - b) / a);
  });
});
ok('Swamee-Jain a menos de 2,5 % de Colebrook (Re >= 1e4)', piorSJ < 0.025, (piorSJ * 100).toFixed(2) + ' %');
let piorZS = 0;
[5e3, 1e4, 1e5, 1e6, 1e7].forEach(Re => {
  [1e-5, 1e-4, 1e-3, 1e-2].forEach(er => {
    const a = H.fColebrook(Re, er).f, b = H.fZigrangSylvester(Re, er);
    piorZS = Math.max(piorZS, Math.abs(a - b) / a);
  });
});
ok('Zigrang-Sylvester a menos de 1 % de Colebrook', piorZS < 0.01, (piorZS * 100).toFixed(2) + ' %');
/* faixa central de projeto: as explícitas devem ficar a menos de 1,2 % */
let piorCentral = 0;
[1e5, 1e6, 1e7].forEach(Re => {
  [1e-6, 1e-5, 1e-4, 1e-3].forEach(er => {
    const a = H.fColebrook(Re, er).f;
    piorCentral = Math.max(piorCentral, Math.abs(a - H.fSwameeJain(Re, er)) / a);
    piorCentral = Math.max(piorCentral, Math.abs(a - H.fZigrangSylvester(Re, er)) / a);
  });
});
ok('explícitas a menos de 1,2 % na faixa usual de adutoras', piorCentral < 0.012, (piorCentral * 100).toFixed(2) + ' %');
/* convergência */
ok('Colebrook converge em menos de 20 iterações', H.fColebrook(1e7, 1e-5).iter < 20);

/* ---------------------------------------------------------------- */
titulo('3. Hazen-Williams — reprodução da planilha original');
/* Planilha C: Q=400 L/s, C=130, DI=452,2 mm (PEAD PN8 SDR21 DE500),
   J = 10,646·(Q/C)^1,852·(1/D)^4,87·1000  [m/km] */
const Qp = 0.4, Cp = 130, Dp = (500 - 2 * 23.9) / 1000;
const jPlanilha = 10.646 * Math.pow(Qp / Cp, 1.852) * Math.pow(1 / Dp, 4.87) * 1000;
H.HW.k = 10.646; H.HW.expQ = 1.852; H.HW.expD = 4.87;
prox('J com as constantes da planilha', H.jHazenWilliams(Qp, Dp, Cp) * 1000, jPlanilha, 1e-9);
H.HW.k = 10.643; H.HW.expQ = 1.852; H.HW.expD = 4.871;
const jPadrao = H.jHazenWilliams(Qp, Dp, Cp) * 1000;
ok('diferença entre constantes < 0,3 %', Math.abs(jPadrao - jPlanilha) / jPlanilha < 0.003,
   ((jPadrao - jPlanilha) / jPlanilha * 100).toFixed(3) + ' %');
/* Aferição independente: Hazen-Williams na forma v = 0,355·C·D^0,63·J^0,54 */
const vHW = H.velocidade(Qp, Dp);
const jInv = Math.pow(vHW / (0.355 * Cp * Math.pow(Dp, 0.63)), 1 / 0.54);
prox('forma v = 0,355·C·D^0,63·J^0,54', jPadrao / 1000, jInv, 0.01);

/* ---------------------------------------------------------------- */
titulo('4. Perda localizada');
/* hl = K v²/2g deve coincidir com a forma 0,0826·K·Q²/D⁴ da planilha */
const Kl = 2.5;
const hlPlanilha = 0.0826 * Kl * Math.pow(Qp, 2) / Math.pow(Dp, 4);
prox('K·v²/2g == 0,0826·K·Q²/D⁴ (constante arredondada)', H.perdaLocalizada(Qp, Dp, Kl), hlPlanilha, 1e-3);

/* ---------------------------------------------------------------- */
titulo('5. Darcy-Weisbach');
/* hf = f·(L/D)·v²/2g */
const L5 = 1000, D5 = 0.3, Q5 = 0.1;
const r5 = H.jUniversal(Q5, D5, 0.0001, H.viscosidadeAgua(20), 'colebrook');
const v5 = H.velocidade(Q5, D5);
prox('hf por Darcy explícito', r5.J * L5, r5.f * (L5 / D5) * v5 * v5 / (2 * H.g), 1e-12);
prox('J = 0,0826·f·Q²/D⁵ (constante arredondada)', r5.J, 0.0826 * r5.f * Q5 * Q5 / Math.pow(D5, 5), 1e-3);

/* ---------------------------------------------------------------- */
titulo('6. Propriedades da água');
prox('ni a 20 °C', H.viscosidadeAgua(20), 1.003e-6, 0.02);
prox('ni a 10 °C', H.viscosidadeAgua(10), 1.307e-6, 0.02);
prox('rho a 20 °C', H.massaEspecificaAgua(20), 998.2, 1e-3);
prox('pressão atmosférica ao nível do mar', H.pressaoAtmosferica(0), 10.33, 5e-3);
prox('pressão atmosférica a 1000 m', H.pressaoAtmosferica(1000), 9.17, 0.02);
prox('pressão de vapor a 20 °C', H.pressaoVaporAgua(20), 0.238, 0.03);

/* ---------------------------------------------------------------- */
titulo('7. Potência');
/* P[cv] = gama·Q·H/(75·9,80665) ~ Q[L/s]·H/(75·eta) */
prox('BHP 400 L/s x 30 mca x 70 %', H.potenciaEixoCV(0.4, 30, 0.70), 400 * 30 / (75 * 0.70), 2e-3);
prox('cv -> kW', H.cvParaKW(100), 73.55, 1e-9);
ok('motor comercial imediatamente acima (sem folga)', PDA.P.motorComercial(228.6, 0) === 250);
ok('motor comercial com 10 % de folga sobe de faixa', PDA.P.motorComercial(228.6, 10) === 300);
ok('potência exata não sobe de faixa', PDA.P.motorComercial(250, 0) === 250);
ok('folga automática para 3 cv = 30 %', PDA.P.folgaRecomendada(3) === 30);

/* ---------------------------------------------------------------- */
titulo('8. Catálogos');
ok('catálogos padrão carregados', CAT.padrao.length > 25, CAT.padrao.length + ' catálogos');
const k9 = CAT.buscar(CAT.padrao, 'fd_k9');
ok('FD K9 existe', !!k9);
const k9_300 = k9.itens.find(i => i.dn === 300);
prox('FD K9 DN300 DI', CAT.diInterno(k9, k9_300), 326 - 2 * 7.2, 1e-12);
/* fórmula normativa e = K(0,5+0,001DN) */
k9.itens.filter(i => i.dn >= 350).forEach(i => {
  const eF = Math.round(9 * (0.5 + 0.001 * i.dn) * 10) / 10;
  if (Math.abs(eF - i.e) > 0.11) {   /* DN 450 = 8,55 mm: a norma arredonda para 8,6 */ falhas++; console.log('  FALHA K9 DN' + i.dn + ' e=' + i.e + ' formula=' + eF); }
});
total++; console.log('  ok   FD K9 confere com e = 9·(0,5+0,001·DN) para DN >= 350');

const k12 = CAT.buscar(CAT.padrao, 'fd_k12');
[[700, 14.4], [800, 15.6], [900, 16.8], [1000, 18.0], [1200, 20.4]].forEach(([dn, e]) => {
  const it = k12.itens.find(i => i.dn === dn);
  prox('K12 DN' + dn + ' confere com a aba de flanges', it.e, e, 1e-9);
});

const sdr11 = CAT.buscar(CAT.padrao, 'pead_pe100_sdr11');
ok('PEAD PE100 SDR11 = PN16', sdr11.itens[0].pn === 16);
const p315 = sdr11.itens.find(i => i.de === 315);
prox('PEAD SDR11 DE315 DI', CAT.diInterno(sdr11, p315), 315 - 2 * 28.6, 1e-12);
/* consistência e ~ DE/SDR em toda a base PEAD */
let piorSDR = 0, piorRot = '';
CAT.padrao.filter(c => c.familia === 'PEAD').forEach(c => {
  const sdr = parseFloat(c.nome.match(/SDR ([\d,]+)/)[1].replace(',', '.'));
  c.itens.forEach(i => {
    if (i.de < 63) return;                     /* nos DE pequenos prevalece a espessura mínima normativa */
    const d = Math.abs(i.e - i.de / sdr) / (i.de / sdr);
    if (d > piorSDR) { piorSDR = d; piorRot = c.nome + ' ' + i.rot; }
  });
});
ok('espessuras PEAD a menos de 4 % de DE/SDR (DE >= 63)', piorSDR < 0.04, piorRot + ' -> ' + (piorSDR * 100).toFixed(2) + ' %');

const pe80s6 = CAT.buscar(CAT.padrao, 'pead_pe80_sdr6');
ok('PEAD PE80 SDR6 = PN25 (confere com a planilha)', pe80s6.itens[0].pn === 25);
const pe100s74 = CAT.buscar(CAT.padrao, 'pead_pe100_sdr7_4');
ok('PEAD PE100 SDR7,4 = PN25 (confere com a planilha)', pe100s74.itens[0].pn === 25);

const aco40 = CAT.buscar(CAT.padrao, 'aco_sch_40');
const a6 = aco40.itens.find(i => i.rot === '6"');
prox('Aço SCH40 6" DI', CAT.diInterno(aco40, a6), 168.3 - 2 * 7.11, 1e-12);
prox('Aço SCH40 6" DI (valor tabelado ASME)', CAT.diInterno(aco40, a6), 154.08, 1e-3);
const aco80 = CAT.buscar(CAT.padrao, 'aco_sch_80');
prox('Aço SCH80 4" DI (valor tabelado ASME)', CAT.diInterno(aco80, aco80.itens.find(i => i.rot === '4"')), 97.18, 1e-3);

const conc = CAT.buscar(CAT.padrao, 'concreto');
prox('concreto DN800 -> DI = DN', CAT.diInterno(conc, conc.itens.find(i => i.dn === 800)), 800, 1e-12);

/* todo item precisa gerar DI positivo e coerente */
let ruins = [];
CAT.padrao.forEach(c => c.itens.forEach(i => {
  const di = CAT.diInterno(c, i);
  if (!(di > 0) || (i.de && di >= i.de)) ruins.push(c.id + '/' + i.rot);
}));
ok('todos os itens com DI positivo e menor que o DE', ruins.length === 0, ruins.join(', '));

/* ---------------------------------------------------------------- */
titulo('9. Rugosidade');
const cNovo = R.consultar('pead', 'novo', 'agua_tratada');
ok('PEAD novo C = 145', cNovo.C === 145);
const cVelho = R.consultar('pead', 'a30', 'agua_tratada');
ok('PEAD antigo com C menor que o novo', cVelho.C < cNovo.C, cVelho.C + ' < ' + cNovo.C);
ok('PEAD antigo com eps maior que o novo', cVelho.eps > cNovo.eps);
const cEsg = R.consultar('pead', 'novo', 'esgoto_bruto');
ok('esgoto bruto reduz C', cEsg.C < cNovo.C, cEsg.C + ' < ' + cNovo.C);
ok('esgoto bruto aumenta eps', cEsg.eps > cNovo.eps);
/* monotonicidade em todos os materiais */
let naoMono = [];
Object.keys(R.materiais).forEach(m => {
  const f = ['novo', 'a5_15', 'a15_30', 'a30'];
  for (let i = 1; i < f.length; i++) {
    const a = R.consultar(m, f[i - 1], 'agua_tratada'), b = R.consultar(m, f[i], 'agua_tratada');
    if (b.C > a.C || b.eps < a.eps) naoMono.push(m + ' ' + f[i]);
  }
});
ok('C sempre decrescente e eps sempre crescente com a idade', naoMono.length === 0, naoMono.join(', '));
/* toda fonte referenciada precisa existir */
let semFonte = [];
Object.keys(R.materiais).forEach(m => (R.materiais[m].fontes || []).forEach(f => {
  if (!R.fontes[f]) semFonte.push(m + '/' + f);
}));
CAT.padrao.forEach(c => (c.fonteIds || []).forEach(f => { if (!R.fontes[f]) semFonte.push(c.id + '/' + f); }));
ok('todas as fontes citadas estão cadastradas', semFonte.length === 0, semFonte.join(', '));
/* todo catálogo aponta para um material existente */
let semMat = CAT.padrao.filter(c => !R.materiais[c.material]).map(c => c.id);
ok('todo catálogo aponta para material cadastrado', semMat.length === 0, semMat.join(', '));

/* ---------------------------------------------------------------- */
titulo('10. Cenários de bombeamento');
const st = E.padrao();
st.vazao = { valor: 400, unidade: 'L/s', base: 'total' };
st.bombas.instaladas = 3; st.bombas.operando = 2; st.bombas.rendBomba = 70;
st.cotas = { nivelSuccaoMin: 620, nivelSuccaoMax: 620, eixoBomba: 620, nivelChegada: 642, unid: 'm' };
st.calculo.metodo = 'hw';
st.adutoras = [E.novaAdutora(1)];
st.adutoras[0].catalogoId = 'pead_pe100_sdr21';
st.adutoras[0].itemRot = 'DE 500';
st.adutoras[0].extensao = 214; st.adutoras[0].unidExt = 'm';
st.adutoras[0].cOverride = 130;
st.barrileteComum.trechos = []; st.barrileteComum.ativo = false;
st.barrileteIndividual.ativo = false;

const cats = { padrao: CAT.padrao, usuario: [], todos: CAT.padrao };
let res = C.resumo(st, cats);
const cen2 = res.projeto;
prox('vazão total do cenário de projeto', cen2.qTotal, 0.4, 1e-12);
prox('vazão por bomba', cen2.qBomba, 0.2, 1e-12);
prox('Hg', cen2.Hg, 22, 1e-12);
/* conferência manual do trecho */
const diM = (500 - 2 * 23.9) / 1000;
const jMan = 10.643 * Math.pow(0.4 / 130, 1.852) * Math.pow(1 / diM, 4.871);
prox('hf da adutora', cen2.adutoras[0].hf, jMan * 214, 1e-6);
prox('v da adutora', cen2.adutoras[0].v, 0.4 / (Math.PI * diM * diM / 4), 1e-9);
prox('Hm', cen2.Hm, 22 + jMan * 214, 1e-6);
prox('BHP por bomba', cen2.bhpCv, 0.2 * 1000 * cen2.Hm / (75 * 0.7), 2e-3);

ok('gerou um cenário por bomba instalada', res.cenarios.length === 3);
ok('vazão cresce com o nº de bombas',
   res.cenarios[0].qTotal < res.cenarios[1].qTotal && res.cenarios[1].qTotal < res.cenarios[2].qTotal);
ok('Hm cresce com a vazão', res.cenarios[0].Hm < res.cenarios[2].Hm);
ok('BHP cresce com a vazão', res.cenarios[0].bhpCv < res.cenarios[2].bhpCv);

/* vazão informada por bomba */
const st2 = E.clone(st);
st2.vazao = { valor: 200, unidade: 'L/s', base: 'porBomba' };
const res2 = C.resumo(st2, cats);
prox('base "por bomba" reproduz a mesma vazão total', res2.projeto.qTotal, 0.4, 1e-12);

/* barrilete comum progressivo */
const st3 = E.clone(st);
st3.barrileteComum.ativo = true;
st3.barrileteComum.trechos = [E.novoTrechoComum(1), E.novoTrechoComum(2), E.novoTrechoComum(3)];
st3.barrileteComum.trechos.forEach((t, i) => {
  t.catalogoId = 'fd_flg_agua'; t.itemRot = 'DN 400'; t.extensao = 5;
  t.pecas = [E.novaPeca('te_direta')];
  t.nBombas = i + 1;
});
const res3 = C.resumo(st3, cats);
const q1 = res3.projeto.recalque[0].Q, q2 = res3.projeto.recalque[1].Q, q3 = res3.projeto.recalque[2].Q;
prox('trecho comum que coleta 1 bomba', q1, 0.2, 1e-12);
prox('trecho comum que coleta 2 bombas', q2, 0.4, 1e-12);
ok('trecho de 3 bombas limitado às 2 em operação', Math.abs(q3 - 0.4) < 1e-12, 'Q=' + q3);
const res3b = C.cenario(st3, C.contexto(st3, cats), 3);
prox('com 3 bombas operando o 3º trecho recebe a vazão das 3', res3b.recalque[2].Q, 0.6, 1e-12);

/* adutora ramificada */
const st4 = E.clone(st);
st4.adutoras = [E.novaAdutora(1), E.novaAdutora(2)];
st4.adutoras[0].catalogoId = 'fd_k7'; st4.adutoras[0].itemRot = 'DN 500';
st4.adutoras[0].extensao = 1000; st4.adutoras[0].vazaoPct = 100;
st4.adutoras[1].catalogoId = 'fd_k7'; st4.adutoras[1].itemRot = 'DN 400';
st4.adutoras[1].extensao = 800; st4.adutoras[1].vazaoPct = 60;
const res4 = C.resumo(st4, cats);
prox('trecho 1 com 100 % da vazão', res4.projeto.adutoras[0].Q, 0.4, 1e-12);
prox('trecho 2 com 60 % da vazão', res4.projeto.adutoras[1].Q, 0.24, 1e-12);
ok('perdas somadas dos dois trechos',
   Math.abs(res4.projeto.hfRecalque - (res4.projeto.adutoras[0].hf + res4.projeto.adutoras[1].hf)) < 1e-12);

/* vazão absoluta por trecho */
const st5 = E.clone(st4);
st5.adutoras[1].vazaoModo = 'abs';
st5.adutoras[1].vazaoAbs = 150; st5.adutoras[1].unidVazaoAbs = 'm³/h';
const res5 = C.resumo(st5, cats);
prox('vazão absoluta em m³/h', res5.projeto.adutoras[1].Q, 150 / 3600, 1e-12);

/* ---------------------------------------------------------------- */
titulo('11. Classificação por cores');
const ctx = C.contexto(st, cats);
const crit = C.criterioDe(st, ctx, 'adutora');
ok('faixa de água carregada', crit.vMin === 0.6);
ok('velocidade baixa reprovada', C.classificar(0.3, 0.003, crit).classe === 'ruim');
ok('velocidade alta reprovada', C.classificar(4.0, 0.003, crit).classe === 'ruim');
ok('dentro da faixa aprovada', C.classificar(1.5, 0.004, crit).classe === 'bom');
ok('J acima do limite reprovado', C.classificar(1.5, 0.05, crit).classe === 'ruim');
ok('fora da faixa boa mas dentro do limite = atenção', C.classificar(2.2, 0.008, crit).classe === 'atencao');
/* critério de esgoto */
const stE = E.clone(st); stE.fluido.tipo = 'esgoto_bruto';
const ctxE = C.contexto(stE, cats);
ok('esgoto usa a família de critérios própria', ctxE.familiaCriterio === 'esgoto');
ok('velocidade máxima maior para esgoto',
   C.criterioDe(stE, ctxE, 'adutora').vMax > crit.vMax);

/* ---------------------------------------------------------------- */
titulo('12. Varredura de diâmetros');
const varr = C.varrer(st, ctx, st.adutoras[0], 'adutoras.0', 2);
ok('varredura devolve uma linha por item do catálogo',
   varr.linhas.length === CAT.buscar(CAT.padrao, 'pead_pe100_sdr21').itens.length,
   varr.linhas.length + '');
ok('há exatamente um diâmetro recomendado',
   varr.linhas.filter(l => l.recomendado).length === 1);
ok('velocidade decresce com o diâmetro', (function () {
  for (let i = 1; i < varr.linhas.length; i++) if (varr.linhas[i].v >= varr.linhas[i - 1].v) return false;
  return true;
})());
ok('perda unitária decresce com o diâmetro', (function () {
  for (let i = 1; i < varr.linhas.length; i++) if (varr.linhas[i].jKm >= varr.linhas[i - 1].jKm) return false;
  return true;
})());
const recL = varr.linhas.find(l => l.recomendado);
ok('recomendado não é reprovado', recL.classe !== 'ruim', recL.rot + ' ' + recL.classe);
prox('Bresse K=1,0 para 400 L/s', varr.bresse.k10, Math.sqrt(0.4) * 1000, 1e-9);
ok('Bresse entre os limites', varr.bresse.k07 < varr.bresse.k10 && varr.bresse.k10 < varr.bresse.k13);

/* ---------------------------------------------------------------- */
titulo('13. Transitório hidráulico');
/* celeridade em aço de parede espessa deve se aproximar da onda na água */
const aAgua = 1 / Math.sqrt(998.2 / 2.19e9);
const aAco = H.celeridade(0.3, 0.2, 210e9, 998.2, 2.19e9, 1);
ok('celeridade em tubo muito rígido tende à da água livre',
   Math.abs(aAco - aAgua) / aAgua < 0.02, aAco.toFixed(0) + ' vs ' + aAgua.toFixed(0) + ' m/s');
const aPead = H.celeridade(0.4522, 0.0239, 1.0e9, 998.2, 2.19e9, 1);
ok('celeridade em PEAD entre 200 e 400 m/s', aPead > 200 && aPead < 400, aPead.toFixed(0) + ' m/s');
const aFd = H.celeridade(0.5, 0.007, 170e9, 998.2, 2.19e9, 1);
ok('celeridade em FD entre 900 e 1300 m/s', aFd > 900 && aFd < 1300, aFd.toFixed(0) + ' m/s');
prox('Joukowsky a=1000 dv=2', H.joukowsky(1000, 2), 1000 * 2 / H.g, 1e-12);
prox('tempo crítico', H.tempoCritico(2000, 1000), 4, 1e-12);
prox('Michaud', H.michaud(2000, 2, 10), 2 * 2000 * 2 / (H.g * 10), 1e-12);

const stG = E.clone(st4);
stG.golpe = { avaliar: true, tipoManobra: 'rapida', tempoManobra: 5, psi: 1 };
const resG = C.resumo(stG, cats);
ok('golpe avaliado para cada trecho', resG.golpe.length === 2);
ok('sobrepressão positiva', resG.golpe[0].dh > 0);
ok('pressão máxima maior que a Hm', resG.golpe[0].pressaoMaxMca > resG.projeto.Hm);

/* ---------------------------------------------------------------- */
titulo('13b. Pressão admissível do tubo');
const stPN = E.clone(st4);
stPN.adutoras[0].catalogoId = 'fd_k7';       /* catálogo sem PN cadastrado */
stPN.adutoras[0].itemRot = 'DN 500';
/* FD classe K com junta elástica (padrão): PFA adotada automaticamente
   pela EN 545 (parede mínima, teto de 64 bar) */
let resPN = C.resumo(stPN, cats);
ok('classe K + junta elástica adota PFA automática (EN 545)',
   resPN.piezometrica[1].pnMca !== null && resPN.golpe[0].atende !== null,
   String(resPN.piezometrica[1].pnMca));
{
  const ctxPN = C.contexto(stPN, cats);
  const infoJGS = C.pnInfo(stPN.adutoras[0], C.resolverTubo(stPN.adutoras[0], ctxPN));
  ok('origem registrada como junta', infoJGS.origem === 'junta', infoJGS.origem);
  /* K9 DN 400: e=8,1, tol 1,7 → e_min 6,4; DE 429 → 42 bar (tabela EN 545) */
  const stK9 = E.clone(stPN);
  stK9.adutoras[0].catalogoId = 'fd_k9'; stK9.adutoras[0].itemRot = 'DN 400';
  const iK9 = C.pnInfo(stK9.adutoras[0], C.resolverTubo(stK9.adutoras[0], C.contexto(stK9, cats)));
  ok('K9 DN 400 → PFA 42 bar (reproduz a EN 545)', iK9.mca === 420, String(iK9.mca));
  /* DN pequeno: teto de 64 bar da junta elástica */
  const stK9b = E.clone(stK9);
  stK9b.adutoras[0].itemRot = 'DN 150';
  const iK9b = C.pnInfo(stK9b.adutoras[0], C.resolverTubo(stK9b.adutoras[0], C.contexto(stK9b, cats)));
  ok('K9 DN 150 limitado aos 64 bar da junta elástica', iK9b.mca === 640, String(iK9b.mca));
  /* junta travada: a PFA da junta governa e varia com o DN → sem adoção */
  const stJTI = E.clone(stPN);
  stJTI.adutoras[0].junta = 'jti';
  const iJTI = C.pnInfo(stJTI.adutoras[0], C.resolverTubo(stJTI.adutoras[0], C.contexto(stJTI, cats)));
  ok('junta travada JTI não adota PFA automática', iJTI.mca === null && iJTI.origem === 'ausente');
  const resJTI = C.resumo(stJTI, cats);
  ok('com junta travada a verificação fica indefinida',
     resJTI.piezometrica[1].pnMca === null && resJTI.golpe[0].atende === null);
}
stPN.adutoras[0].pnMcaOverride = 400;
resPN = C.resumo(stPN, cats);
ok('PN informado pelo usuário é usado', resPN.piezometrica[1].pnMca === 400);
ok('verificação do transitório passa a concluir', resPN.golpe[0].atende !== null);
ok('400 mca atende a este caso', resPN.golpe[0].atende === true,
   'p máx = ' + resPN.golpe[0].pressaoMaxMca.toFixed(1));
stPN.adutoras[0].pnMcaOverride = 40;
resPN = C.resumo(stPN, cats);
ok('PN insuficiente é reprovado', resPN.golpe[0].atende === false);
/* PN do catálogo continua valendo quando não há valor informado */
const stPN2 = E.clone(st);
stPN2.adutoras[0].pnMcaOverride = null;
const rPN2 = C.resumo(stPN2, cats);
ok('PN vem do catálogo (PEAD SDR21 = PN8 = 80 mca)',
   rPN2.piezometrica[1].pnMca === 80, String(rPN2.piezometrica[1].pnMca));

/* ---------------------------------------------------------------- */
titulo('14. Comparação entre métodos');
const cmp = C.compararMetodos(st, cats);
ok('quatro métodos comparados', cmp.length === 4);
const hw = cmp.find(c => c.metodo === 'hw'), cb = cmp.find(c => c.metodo === 'colebrook');
ok('Hm de HW e Colebrook na mesma ordem de grandeza',
   Math.abs(hw.Hm - cb.Hm) / cb.Hm < 0.5, 'HW ' + hw.Hm.toFixed(2) + ' / CB ' + cb.Hm.toFixed(2));
ok('método restaurado após a comparação', st.calculo.metodo === 'hw');
const sj = cmp.find(c => c.metodo === 'swamee'), zs = cmp.find(c => c.metodo === 'zigrang');
ok('explícitas próximas da Colebrook (< 2 %)',
   Math.abs(sj.Hm - cb.Hm) / cb.Hm < 0.02 && Math.abs(zs.Hm - cb.Hm) / cb.Hm < 0.02);

/* ---------------------------------------------------------------- */
titulo('15. NPSH e piezométrica');
const stN = E.clone(st);
stN.bombas.tipo = 'afogada';
stN.succaoIndividual.ativo = true;
stN.succaoIndividual.catalogoId = 'fd_flg_agua';
stN.succaoIndividual.itemRot = 'DN 400';
stN.succaoIndividual.extensao = 8;
stN.succaoIndividual.pecas = [E.novaPeca('sino_succao'), E.novaPeca('curva90'), E.novaPeca('vg')];
stN.cotas.eixoBomba = 618;      /* bomba 2 m abaixo do nível de sucção */
const resN = C.resumo(stN, cats);
ok('NPSH disponível calculado', resN.projeto.npshd !== null);
prox('NPSHd', resN.projeto.npshd,
     H.pressaoAtmosferica(0) - H.pressaoVaporAgua(20) + 2 - resN.projeto.hSuccao, 1e-6);
ok('NPSHd positivo nessa configuração', resN.projeto.npshd > 0, resN.projeto.npshd.toFixed(2));
const stSub = E.clone(stN); stSub.bombas.tipo = 'submersivel';
const resSub = C.resumo(stSub, cats);
ok('submersível não computa sucção', resSub.projeto.succao.length === 0);
ok('submersível não calcula NPSHd', resSub.projeto.npshd === null);

const pz = resN.piezometrica;
ok('piezométrica com um ponto por trecho + saída', pz.length === 1 + resN.projeto.adutoras.length);
prox('carga na saída da elevatória', pz[0].hgl, 620 + resN.projeto.Hm, 1e-9);
prox('carga no fim da linha desconta as perdas de recalque',
     pz[pz.length - 1].hgl, 620 + resN.projeto.Hm - resN.projeto.hRecalque, 1e-9);

/* ---------------------------------------------------------------- */
titulo('16. Estado e migração');
const antigo = { versao: 0, vazao: { valor: 50, unidade: 'm³/h' } };
const mig = E.migrar(antigo);
ok('migração preserva o que existia', mig.vazao.valor === 50 && mig.vazao.unidade === 'm³/h');
ok('migração completa os campos faltantes', mig.vazao.base === 'total' && !!mig.criterios && !!mig.bombas);
ok('migração atualiza a versão', mig.versao === E.VERSAO);
const p = E.padrao();
ok('projeto padrão consistente', p.adutoras.length === 1 && p.bombas.instaladas >= p.bombas.operando);

/* ---------------------------------------------------------------- */
titulo('17. Coerência global de dimensionamento');
/* Ao dobrar o diâmetro a perda distribuída deve cair ~2^4,871 (HW) */
H.HW.k = 10.643; H.HW.expQ = 1.852; H.HW.expD = 4.871;
const jD = H.jHazenWilliams(0.4, 0.3, 130), j2D = H.jHazenWilliams(0.4, 0.6, 130);
prox('razão J(D)/J(2D) = 2^4,871', jD / j2D, Math.pow(2, 4.871), 1e-9);
/* Colebrook: perda deve crescer com a rugosidade */
const jLisa = H.jUniversal(0.4, 0.3, 1e-6, 1.003e-6, 'colebrook').J;
const jRug = H.jUniversal(0.4, 0.3, 1e-3, 1.003e-6, 'colebrook').J;
ok('perda cresce com a rugosidade', jRug > jLisa, jRug.toExponential(3) + ' > ' + jLisa.toExponential(3));
/* tubo mais velho -> mais perda, mesmo diâmetro */
const stV = E.clone(st); stV.calculo.metodo = 'colebrook';
stV.adutoras[0].cOverride = null; stV.adutoras[0].epsOverride = null;
stV.adutoras[0].idade = 'novo';
const hNovo = C.resumo(stV, cats).projeto.Hm;
stV.adutoras[0].idade = 'a30';
const hVelho = C.resumo(stV, cats).projeto.Hm;
ok('tubo antigo exige mais altura manométrica', hVelho > hNovo,
   hVelho.toFixed(3) + ' > ' + hNovo.toFixed(3));
/* override de rugosidade tem precedência */
const stO = E.clone(stV); stO.adutoras[0].epsOverride = 5;
ok('eps informado manualmente prevalece', C.resumo(stO, cats).projeto.Hm > hVelho);

/* ---------------------------------------------------------------- */
titulo('18. Pressão negativa nunca é adequada');
/* o caso relatado: cota de chegada global divergindo da cota final do trecho */
const stNeg = E.padrao();
stNeg.calculo.metodo = 'colebrook';
stNeg.vazao = { valor: 100, unidade: 'L/s', base: 'total' };
stNeg.barrileteComum.ativo = false; stNeg.barrileteIndividual.ativo = false;
stNeg.succaoIndividual.ativo = false;
stNeg.cotas = { nivelSuccaoMin: 122, nivelSuccaoMax: 122, eixoBomba: 120,
                cotaPartida: null, nivelChegada: 124.05, unid: 'm' };
stNeg.adutoras = [E.novaAdutora(1)];
stNeg.adutoras[0].catalogoId = 'pead_pe100_sdr21';
stNeg.adutoras[0].itemRot = 'DE 200';
stNeg.adutoras[0].extensao = 3000;
stNeg.adutoras[0].usarCotas = true;
stNeg.adutoras[0].cotaIni = 122; stNeg.adutoras[0].cotaFim = 146;
let rNeg = C.resumo(stNeg, cats);
const pFim = rNeg.piezometrica[rNeg.piezometrica.length - 1];
ok('reproduz a pressão negativa do caso relatado', pFim.pressao < -20, UI0(pFim.pressao));
ok('pressão negativa classificada como inadequada', pFim.classe === 'ruim', pFim.classe);
ok('o motivo explica o que aconteceu', /negativa|abaixo/.test(pFim.motivos.join(' ')), pFim.motivos.join('; '));

ok('classificarPressao: negativa reprovada', C.classificarPressao(-5, 120).classe === 'ruim');
ok('classificarPressao: abaixo de -10 reprovada com aviso de vaporização',
   C.classificarPressao(-12, 120).classe === 'ruim' &&
   /vaporiza/.test(C.classificarPressao(-12, 120).motivos.join(' ')));
ok('classificarPressao: dentro do PN aprovada', C.classificarPressao(60, 120).classe === 'bom');
ok('classificarPressao: acima de 85 % do PN em atenção', C.classificarPressao(110, 120).classe === 'atencao');
ok('classificarPressao: acima do PN reprovada', C.classificarPressao(130, 120).classe === 'ruim');
ok('classificarPressao: sem PN fica indefinida', C.classificarPressao(60, null).classe === 'na');
ok('classificarPressao: zero é aceitável', C.classificarPressao(0, 120).classe === 'bom');

/* ---------------------------------------------------------------- */
titulo('19. Detecção da incoerência de cotas');
const avs = rNeg.avisosDados;
ok('a incoerência de cota de chegada é detectada',
   avs.some(function (a) { return a.id === 'cotaChegada' && a.grave; }),
   JSON.stringify(avs.map(function (a) { return a.id; })));
const avCota = avs.filter(function (a) { return a.id === 'cotaChegada'; })[0];
ok('o aviso cita os dois valores divergentes',
   /124/.test(avCota.txt) && /146/.test(avCota.txt), avCota.txt.slice(0, 80));
ok('o aviso oferece as duas correções', avCota.acoes.length === 2);

/* aplicada a correção, o aviso desaparece e a pressão fica positiva */
stNeg.cotas.nivelChegada = 146;
rNeg = C.resumo(stNeg, cats);
ok('corrigida a cota, a incoerência desaparece',
   !rNeg.avisosDados.some(function (a) { return a.id === 'cotaChegada'; }));
ok('e a pressão no fim deixa de ser negativa',
   rNeg.piezometrica[rNeg.piezometrica.length - 1].pressao >= -0.01,
   UI0(rNeg.piezometrica[rNeg.piezometrica.length - 1].pressao));

/* nível máximo abaixo do mínimo */
const stNiv = E.clone(stNeg);
stNiv.cotas.nivelSuccaoMax = 100;
ok('nível máximo abaixo do mínimo é detectado',
   C.resumo(stNiv, cats).avisosDados.some(function (a) { return a.id === 'niveis'; }));

/* cota do eixo em outra referência */
const stEixo = E.clone(stNeg);
stEixo.cotas.eixoBomba = 3;
ok('cota do eixo em referência diferente é detectada',
   C.resumo(stEixo, cats).avisosDados.some(function (a) { return a.id === 'eixoDistante'; }));

/* ---------------------------------------------------------------- */
titulo('20. Cota de partida');
ok('em branco, a cota de partida é o nível de sucção mínimo',
   C.cotaPartida(stNeg) === 122, String(C.cotaPartida(stNeg)));
const stPart = E.clone(stNeg);
stPart.cotas.cotaPartida = 125;
ok('informada, prevalece', C.cotaPartida(stPart) === 125);
ok('a piezométrica parte da cota de partida',
   C.resumo(stPart, cats).piezometrica[0].cota === 125);

/* ---------------------------------------------------------------- */
titulo('21. DN da peça buscado no catálogo');
const stDN = E.clone(stNeg);
stDN.adutoras[0].pecas = [E.novaPeca('reducao_conc')];
let rDN = C.resumo(stDN, cats);
const tuboDN = rDN.projeto.adutoras[0].tubo;
ok('sem DN informado, usa o DI do trecho',
   Math.abs(rDN.projeto.adutoras[0].pecas[0].diMm - tuboDN.diMm) < 1e-9);
stDN.adutoras[0].pecas[0].dnLocal = 'DE 160';
rDN = C.resumo(stDN, cats);
const diEsperado = 160 - 2 * 7.7;   /* PEAD SDR 21, DE 160 */
ok('com DN informado, busca o DI correspondente no catálogo',
   Math.abs(rDN.projeto.adutoras[0].pecas[0].diMm - diEsperado) < 1e-9,
   UI0(rDN.projeto.adutoras[0].pecas[0].diMm) + ' vs ' + diEsperado);
ok('a perda cresce ao reduzir o diâmetro da peça',
   rDN.projeto.adutoras[0].pecas[0].h > 0);
/* DI direto continua tendo precedência */
stDN.adutoras[0].pecas[0].diLocalMm = 100;
rDN = C.resumo(stDN, cats);
ok('DI informado diretamente tem precedência sobre o DN',
   Math.abs(rDN.projeto.adutoras[0].pecas[0].diMm - 100) < 1e-9);

/* ---------------------------------------------------------------- */
titulo('22. Ancoragem e celeridade');
ok('quatro casos de ancoragem', H.ancoragem.length === 4);
ok('juntas de dilatação -> psi = 1', H.psiDe('juntas', 0.3) === 1);
prox('ancorado a montante -> 1 - nu/2', H.psiDe('montante', 0.3), 0.85, 1e-12);
prox('ancorado em todo o comprimento -> 1 - nu²', H.psiDe('ancorado', 0.3), 0.91, 1e-12);
prox('manual usa o valor informado', H.psiDe('manual', 0.3, 0.7), 0.7, 1e-12);
/* o caso ancorado é o mais desfavorável: maior celeridade */
const aJ = H.celeridade(0.5, 0.007, 170e9, 998.2, 2.19e9, H.psiDe('juntas', 0.28));
const aA = H.celeridade(0.5, 0.007, 170e9, 998.2, 2.19e9, H.psiDe('ancorado', 0.28));
ok('tubo ancorado tem celeridade maior que com juntas de dilatação', aA > aJ,
   UI0(aA) + ' > ' + UI0(aJ));

const stAnc = E.clone(stNeg);
stAnc.adutoras[0].catalogoId = 'fd_k7';
stAnc.adutoras[0].itemRot = 'DN 300';
stAnc.golpe = { avaliar: true, tempoManobra: 5, ancoragem: 'juntas', psi: 1 };
const dhJuntas = C.resumo(stAnc, cats).golpe[0].dh;
stAnc.golpe.ancoragem = 'ancorado';
const dhAnc = C.resumo(stAnc, cats).golpe[0].dh;
ok('a sobrepressão é maior no caso ancorado', dhAnc > dhJuntas,
   UI0(dhAnc) + ' > ' + UI0(dhJuntas));
ok('a pressão mínima do transitório é calculada',
   C.resumo(stAnc, cats).golpe[0].pressaoMinMca < C.resumo(stAnc, cats).projeto.Hm);

/* ---------------------------------------------------------------- */
titulo('23. Perfil e envoltórias');
const stP = E.clone(stNeg);
stP.adutoras[0].catalogoId = 'fd_k7';
stP.adutoras[0].itemRot = 'DN 300';
stP.adutoras[0].pnMcaOverride = 250;
stP.perfil = { ativo: true, modo: 'acumulada', unidExt: 'm',
  pontos: [{ est: 0, cota: 122 }, { est: 750, cota: 150, rot: 'ponto alto' },
           { est: 1500, cota: 130 }, { est: 2250, cota: 140 }, { est: 3000, cota: 146 }] };
let rP = C.resumo(stP, cats);
ok('envoltória calculada', !!rP.envoltoria);
ok('um ponto de envoltória por ponto de perfil', rP.envoltoria.pontos.length === 5);
ok('a envoltória máxima fica acima da piezométrica permanente',
   rP.envoltoria.pontos[0].envMax > rP.envoltoria.pontos[0].hgl);
ok('a envoltória mínima fica abaixo da piezométrica permanente',
   rP.envoltoria.pontos[0].envMin < rP.envoltoria.pontos[0].hgl);
ok('o Δh decai até zero na chegada',
   Math.abs(rP.envoltoria.pontos[4].envMax - rP.envoltoria.pontos[4].hgl) < 1e-9);
ok('Δh cheio na elevatória',
   Math.abs((rP.envoltoria.pontos[0].envMax - rP.envoltoria.pontos[0].hgl) - rP.envoltoria.dh) < 1e-9);
ok('o ponto crítico de pressão máxima é identificado', !!rP.envoltoria.criticoMax);
ok('o ponto crítico de pressão mínima é identificado', !!rP.envoltoria.criticoMin);
ok('o ponto alto do perfil tem a menor pressão permanente',
   rP.envoltoria.pontos[1].pPerm < rP.envoltoria.pontos[2].pPerm,
   UI0(rP.envoltoria.pontos[1].pPerm) + ' < ' + UI0(rP.envoltoria.pontos[2].pPerm));

/* modo "extensão individual" acumula */
const stP2 = E.clone(stP);
stP2.perfil.modo = 'individual';
stP2.perfil.pontos = [{ est: 0, cota: 122 }, { est: 750, cota: 150 }, { est: 750, cota: 130 },
                      { est: 750, cota: 140 }, { est: 750, cota: 146 }];
const pp2 = C.perfilPontos(stP2);
ok('modo individual acumula as extensões', pp2.ultimoX === 3000, String(pp2.ultimoX));
/* unidade km */
const stP3 = E.clone(stP);
stP3.perfil.unidExt = 'km';
stP3.perfil.pontos = [{ est: 0, cota: 122 }, { est: 3, cota: 146 }];
ok('unidade km convertida', C.perfilPontos(stP3).ultimoX === 3000);
/* divergência de extensão detectada */
const stP4 = E.clone(stP);
stP4.perfil.pontos = [{ est: 0, cota: 122 }, { est: 5000, cota: 146 }];
ok('divergência entre perfil e trechos é avisada',
   C.resumo(stP4, cats).avisosDados.some(function (a) { return a.id === 'perfilExtensao'; }));

/* ---------------------------------------------------------------- */
titulo('24. Curva do sistema e ponto de operação');
const stCB = E.clone(stNeg);
stCB.adutoras[0].catalogoId = 'fd_k7';
stCB.adutoras[0].itemRot = 'DN 300';
const ctxCB = C.contexto(stCB, cats);
const cs = C.curvaSistema(stCB, ctxCB, 1, 10, 1.5);
ok('curva do sistema com 11 pontos', cs.length === 11);
prox('com vazão nula a curva do sistema vale Hg', cs[0].H, C.resumo(stCB, cats).projeto.Hg, 1e-9);
/* a curva do sistema não pode depender de quantas bombas produzem a vazão:
   para a mesma vazão total, a altura é a mesma (as perdas são da tubulação) */
const csA = C.hmDoSistema(stCB, ctxCB, 0.08, 1).Hm;
const csB = C.hmDoSistema(stCB, ctxCB, 0.08, 2).Hm;
prox('mesma vazão total -> mesma altura do sistema, com 1 ou 2 bombas', csB, csA, 1e-9);
ok('a curva do sistema é crescente', (function () {
  for (var i = 1; i < cs.length; i++) if (cs[i].H <= cs[i - 1].H) return false;
  return true;
})());

/* ajuste de curva por 3 pontos exatos de uma parábola conhecida */
const aj = C.ajustarCurvaBomba([{ q: 0, H: 60 }, { q: 0.05, H: 55 }, { q: 0.1, H: 40 }]);
ok('ajuste devolve os coeficientes', !!aj);
prox('passa pelo 1º ponto', aj.H(0), 60, 1e-6);
prox('passa pelo 2º ponto', aj.H(0.05), 55, 1e-6);
prox('passa pelo 3º ponto', aj.H(0.1), 40, 1e-6);
ok('menos de 3 pontos não ajusta', C.ajustarCurvaBomba([{ q: 0, H: 60 }]) === null);

stCB.curvaBomba = { ativo: true, unidQ: 'L/s', npshr: null,
  pontos: [{ q: 0, H: 60 }, { q: 60, H: 52 }, { q: 120, H: 30 }] };
stCB.bombas.instaladas = 2; stCB.bombas.operando = 1;
const rCB = C.resumo(stCB, cats);
ok('ponto de operação encontrado', rCB.operacao && !rCB.operacao.erro,
   rCB.operacao ? (rCB.operacao.erro || 'ok') : 'null');
const opCB = rCB.operacao;
prox('no ponto de operação a curva da bomba e a do sistema se cruzam',
     rCB.curvaBomba.H(opCB.qBomba), C.hmDoSistema(stCB, C.contexto(stCB, cats), opCB.qTotal, 1).Hm, 1e-4);
ok('a vazão de operação é positiva e dentro da curva informada',
   opCB.qTotal > 0 && opCB.qTotal <= 0.12, UI0(opCB.qTotal * 1000) + ' L/s');
ok('operação calculada para cada quantidade de bombas', rCB.operacaoPorN.length === 2);
const op1 = rCB.operacaoPorN[0].op, op2 = rCB.operacaoPorN[1].op;
ok('duas bombas dão mais vazão que uma', op2.qTotal > op1.qTotal,
   UI0(op1.qTotal * 1000) + ' -> ' + UI0(op2.qTotal * 1000));
ok('em paralelo o ganho é menor que dobrar', op2.qTotal < 2 * op1.qTotal,
   UI0(op2.qTotal * 1000) + ' < ' + UI0(2 * op1.qTotal * 1000));
ok('cada bomba entrega menos em paralelo', op2.qBomba < op1.qTotal,
   UI0(op2.qBomba * 1000) + ' < ' + UI0(op1.qTotal * 1000));
ok('a altura sobe com mais bombas', op2.H > op1.H, UI0(op2.H) + ' > ' + UI0(op1.H));
/* bomba forte demais para os pontos informados */
const stCurta = E.clone(stCB);
stCurta.curvaBomba.pontos = [{ q: 0, H: 200 }, { q: 20, H: 195 }, { q: 40, H: 185 }];
const rCurta = C.resumo(stCurta, cats);
ok('curva que termina antes da interseção é sinalizada',
   rCurta.operacao && /vazão maior/.test(rCurta.operacao.erro || ''),
   rCurta.operacao ? (rCurta.operacao.erro || 'sem erro') : 'null');

/* bomba fraca demais */
const stFraca = E.clone(stCB);
stFraca.curvaBomba.pontos = [{ q: 0, H: 5 }, { q: 20, H: 4 }, { q: 40, H: 2 }];
const rFraca = C.resumo(stFraca, cats);
ok('bomba que não vence a altura geométrica é sinalizada',
   rFraca.operacao && !!rFraca.operacao.erro, rFraca.operacao ? rFraca.operacao.erro : 'null');

/* ---------------------------------------------------------------- */
titulo('25. Análise econômica');
prox('CRF de 8 % em 20 anos', C.crf(8, 20), 0.101852, 1e-4);
prox('CRF com taxa nula é 1/n', C.crf(0, 20), 0.05, 1e-12);
const stEco = E.clone(stCB);
stEco.economia = { ativo: true, tarifa: 0.65, horasDia: 20, anos: 20, taxa: 8,
                   custoA: 0.9, custoB: 1.45, custoInstalacao: 40 };
const ctxEco = C.contexto(stEco, cats);
const vEco = C.varrer(stEco, ctxEco, stEco.adutoras[0], 'adutoras.0', 1);
ok('a varredura calcula custos', vEco.ecoAtiva && vEco.linhas[0].eco);
ok('há um ótimo econômico marcado',
   vEco.linhas.filter(function (l) { return l.otimoEconomico; }).length === 1);
ok('o custo do tubo cresce com o diâmetro', (function () {
  for (var i = 1; i < vEco.linhas.length; i++) {
    if (vEco.linhas[i].eco.custoTubo <= vEco.linhas[i - 1].eco.custoTubo) return false;
  }
  return true;
})());
ok('o custo de energia cai com o diâmetro', (function () {
  for (var i = 1; i < vEco.linhas.length; i++) {
    if (vEco.linhas[i].eco.anualEnergia >= vEco.linhas[i - 1].eco.anualEnergia) return false;
  }
  return true;
})());
/* o ótimo fica num mínimo interior, não nos extremos */
const idxOt = vEco.linhas.findIndex(function (l) { return l.otimoEconomico; });
ok('o ótimo econômico não é o menor nem o maior diâmetro do catálogo',
   idxOt > 0 && idxOt < vEco.linhas.length - 1, 'índice ' + idxOt + ' de ' + vEco.linhas.length);
/* tarifa maior empurra para diâmetro maior */
const stEco2 = E.clone(stEco);
stEco2.economia.tarifa = 5;
const vEco2 = C.varrer(stEco2, C.contexto(stEco2, cats), stEco2.adutoras[0], 'adutoras.0', 1);
const idxOt2 = vEco2.linhas.findIndex(function (l) { return l.otimoEconomico; });
ok('tarifa mais alta desloca o ótimo para diâmetro maior', idxOt2 >= idxOt,
   idxOt + ' -> ' + idxOt2);
/* sem economia ativa, sem colunas */
const vSem = C.varrer(stCB, C.contexto(stCB, cats), stCB.adutoras[0], 'adutoras.0', 1);
ok('desativada, a varredura não calcula custo', !vSem.ecoAtiva && !vSem.linhas[0].eco);

/* ---------------------------------------------------------------- */
titulo('26. Catálogo de flanges Saint-Gobain');
['fd_flg_pn10', 'fd_flg_pn16', 'fd_flg_pn25', 'fd_flg_pn40'].forEach(function (id) {
  const c = CAT.buscar(CAT.padrao, id);
  ok(id + ' existe com PN cadastrado', !!c && c.itens.every(function (i) { return i.pn > 0; }));
});
const flg16 = CAT.buscar(CAT.padrao, 'fd_flg_pn16');
ok('PN 16 = 160 mca', flg16.itens[0].pn === 16);
prox('flangeado PN 16 DN 300 usa espessura K9', flg16.itens.filter(function (i) { return i.dn === 300; })[0].e, 7.2, 1e-9);
const flg40 = CAT.buscar(CAT.padrao, 'fd_flg_pn40');
prox('flangeado PN 40 DN 300 usa espessura K12', flg40.itens.filter(function (i) { return i.dn === 300; })[0].e, 9.6, 1e-9);
ok('PN 40 vai só até DN 600', Math.max.apply(null, flg40.itens.map(function (i) { return i.dn; })) === 600);
/* com o flangeado, a verificação de pressão passa a concluir */
const stFlg = E.clone(stNeg);
stFlg.adutoras[0].catalogoId = 'fd_flg_pn16';
stFlg.adutoras[0].itemRot = 'DN 300';
stFlg.adutoras[0].pnMcaOverride = null;
ok('PN do catálogo de flanges habilita a verificação',
   C.resumo(stFlg, cats).piezometrica[1].pnMca === 160,
   String(C.resumo(stFlg, cats).piezometrica[1].pnMca));

/* ---------------------------------------------------------------- */
titulo('27. NPSH disponível: o que entra e o que não entra');

function stNPSH() {
  var x = E.padrao();
  x.calculo.metodo = 'colebrook';
  x.vazao = { valor: 685, unidade: 'L/s', base: 'total' };
  x.bombas.instaladas = 5; x.bombas.operando = 4; x.bombas.rendBomba = 80;
  x.cotas = { nivelSuccaoMin: 126, nivelSuccaoMax: 128, eixoBomba: 124,
              cotaPartida: null, nivelChegada: 149, unid: 'm' };
  x.succaoIndividual.ativo = true;
  x.succaoIndividual.tipo = 'succao';
  x.succaoIndividual.catalogoId = 'fd_esgoto_je';
  x.succaoIndividual.itemRot = 'DN 400';
  x.succaoIndividual.extensao = 7;
  x.succaoIndividual.pecas = [E.novaPeca('sino_succao'), E.novaPeca('curva90'), E.novaPeca('vg')];
  x.barrileteIndividual.ativo = false;
  x.barrileteComum.ativo = false; x.barrileteComum.trechos = [];
  x.adutoras = [E.novaAdutora(1)];
  x.adutoras[0].catalogoId = 'fd_k7'; x.adutoras[0].itemRot = 'DN 800';
  x.adutoras[0].extensao = 6.67; x.adutoras[0].unidExt = 'km';
  return x;
}

var baseN = C.resumo(stNPSH(), cats).projeto;
/* conferência da fórmula, parcela por parcela */
var ctxN = C.contexto(stNPSH(), cats);
prox('NPSHd = patm − pv + z − hf,sucção', baseN.npshd,
     ctxN.patm - ctxN.pvapor + (126 - 124) - baseN.hSuccao, 1e-12);
ok('NPSHd usa só as perdas de sucção, não as de recalque',
   Math.abs(baseN.npshd - (ctxN.patm - ctxN.pvapor + 2 - baseN.hSuccao)) < 1e-12 &&
   baseN.hRecalque > 0, 'hRecalque = ' + UI0(baseN.hRecalque));

/* barrilete de recalque individual não pode mexer no NPSH */
var stB1 = stNPSH();
stB1.barrileteIndividual.ativo = true;
stB1.barrileteIndividual.catalogoId = 'fd_esgoto_je';
stB1.barrileteIndividual.itemRot = 'DN 400';
stB1.barrileteIndividual.extensao = 10;
stB1.barrileteIndividual.pecas = [E.novaPeca('vr'), E.novaPeca('vg_volante'), E.novaPeca('curva90')];
var rB1 = C.resumo(stB1, cats).projeto;
prox('barrilete individual de recalque não altera o NPSH', rB1.npshd, baseN.npshd, 1e-12);
ok('mas altera a altura manométrica', rB1.Hm > baseN.Hm, UI0(baseN.Hm) + ' -> ' + UI0(rB1.Hm));

/* barrilete comum de recalque também não */
var stB2 = stNPSH();
stB2.barrileteComum.ativo = true;
stB2.barrileteComum.trechos = [1, 2, 3, 4].map(function (n) {
  var t = E.novoTrechoComum(n, 'barrilete');
  t.catalogoId = 'fd_esgoto_je'; t.itemRot = 'DN 600'; t.extensao = 5;
  t.pecas = [E.novaPeca('te_direta')];
  return t;
});
var rB2 = C.resumo(stB2, cats).projeto;
prox('barrilete comum de recalque não altera o NPSH', rB2.npshd, baseN.npshd, 1e-12);
ok('os 4 trechos comuns entram no recalque', rB2.recalque.length === 4);

/* a sucção, sim, altera o NPSH */
var stSuc = stNPSH();
stSuc.succaoComum.ativo = true;
stSuc.succaoComum.trechos = [E.novoTrechoComum(4, 'succao')];
stSuc.succaoComum.trechos[0].catalogoId = 'fd_esgoto_je';
stSuc.succaoComum.trechos[0].itemRot = 'DN 700';
stSuc.succaoComum.trechos[0].extensao = 8;
stSuc.succaoComum.trechos[0].pecas = [E.novaPeca('curva90'), E.novaPeca('te_direta')];
var rSuc = C.resumo(stSuc, cats).projeto;
ok('barrilete de sucção comum reduz o NPSH', rSuc.npshd < baseN.npshd,
   UI0(baseN.npshd) + ' -> ' + UI0(rSuc.npshd));
prox('a redução é exatamente a perda acrescentada na sucção',
     baseN.npshd - rSuc.npshd, rSuc.hSuccao - baseN.hSuccao, 1e-12);

/* bomba mais baixa melhora o NPSH; mais alta piora */
var stEixoBaixo = stNPSH(); stEixoBaixo.cotas.eixoBomba = 120;
ok('baixar o eixo da bomba melhora o NPSH',
   C.resumo(stEixoBaixo, cats).projeto.npshd > baseN.npshd);
var stEixoAlto = stNPSH(); stEixoAlto.cotas.eixoBomba = 135;
var rEixoAlto = C.resumo(stEixoAlto, cats).projeto;
ok('eixo acima do nível de sucção piora o NPSH', rEixoAlto.npshd < baseN.npshd);
prox('e a carga na sucção fica negativa', rEixoAlto.zSuccao, 126 - 135, 1e-12);

/* altitude e temperatura */
var stAlt = stNPSH(); stAlt.fluido.altitude = 1500;
ok('altitude maior reduz o NPSH', C.resumo(stAlt, cats).projeto.npshd < baseN.npshd);
var stTemp = stNPSH(); stTemp.fluido.temperatura = 60;
ok('temperatura maior reduz o NPSH (pressão de vapor)',
   C.resumo(stTemp, cats).projeto.npshd < baseN.npshd);

/* mais bombas em operação não mexem na sucção individual */
var ctxM = C.contexto(stNPSH(), cats);
var cen1 = C.cenario(stNPSH(), ctxM, 1);
var cen4 = C.cenario(stNPSH(), ctxM, 4);
prox('sucção individual tem a mesma vazão em qualquer cenário',
     cen1.succao[0].Q, cen4.succao[0].Q, 1e-12);
prox('e portanto o mesmo NPSH', cen1.npshd, cen4.npshd, 1e-12);

/* ---------------------------------------------------------------- */
titulo('28. Trecho sem diâmetro fica fora do cálculo');
var stSD = stNPSH();
stSD.barrileteComum.ativo = true;
stSD.barrileteComum.trechos = [E.novoTrechoComum(1, 'barrilete'), E.novoTrechoComum(2, 'barrilete')];
stSD.barrileteComum.trechos.forEach(function (t) { t.extensao = 5; t.itemRot = ''; });
var rSD = C.resumo(stSD, cats);
ok('o trecho sem diâmetro é marcado', rSD.projeto.recalque[0].semDiametro === true);
prox('e não acrescenta perda nenhuma', rSD.projeto.hRecalque, baseN.hRecalque, 1e-12);
prox('nem altera a altura manométrica', rSD.projeto.Hm, baseN.Hm, 1e-12);
ok('o DI não cai no menor item do catálogo', rSD.projeto.recalque[0].tubo.diMm === 0,
   String(rSD.projeto.recalque[0].tubo.diMm));
ok('a incoerência é acusada como grave',
   rSD.avisosDados.some(function (a) { return a.id === 'semDiametro' && a.grave; }));
ok('o aviso nomeia os trechos',
   /Trecho 1/.test(rSD.avisosDados.filter(function (a) { return a.id === 'semDiametro'; })[0].txt));

/* o mesmo na sucção: sem diâmetro, o NPSH não despenca */
var stSD2 = stNPSH();
stSD2.succaoComum.ativo = true;
stSD2.succaoComum.trechos = [E.novoTrechoComum(4, 'succao')];
stSD2.succaoComum.trechos[0].extensao = 8;
stSD2.succaoComum.trechos[0].itemRot = '';
var rSD2 = C.resumo(stSD2, cats);
prox('sucção sem diâmetro não derruba o NPSH', rSD2.projeto.npshd, baseN.npshd, 1e-12);
ok('e o aviso aparece',
   rSD2.avisosDados.some(function (a) { return a.id === 'semDiametro'; }));

/* escolhido o diâmetro, o trecho volta a contar */
stSD2.succaoComum.trechos[0].catalogoId = 'fd_esgoto_je';
stSD2.succaoComum.trechos[0].itemRot = 'DN 700';
var rSD3 = C.resumo(stSD2, cats);
ok('com o diâmetro escolhido o trecho volta ao cálculo',
   rSD3.projeto.npshd < baseN.npshd &&
   !rSD3.avisosDados.some(function (a) { return a.id === 'semDiametro'; }));

/* trecho desativado não gera aviso */
stSD.barrileteComum.trechos.forEach(function (t) { t.ativo = false; });
ok('trecho desativado não é cobrado',
   !C.resumo(stSD, cats).avisosDados.some(function (a) { return a.id === 'semDiametro'; }));

/* ---------------------------------------------------------------- */
titulo('29. Trecho novo herda o tubo do anterior');
var modelo = { catalogoId: 'fd_esgoto_je', itemRot: 'DN 600', idade: 'a5_15',
               materialOverride: '', cOverride: null, epsOverride: 0.3,
               unidExt: 'km', pnMcaOverride: 250, pnAuto: false };
var herdado = E.novoTrechoComum(2, 'barrilete', modelo);
ok('herda catálogo e diâmetro', herdado.catalogoId === 'fd_esgoto_je' && herdado.itemRot === 'DN 600');
ok('herda idade e rugosidade', herdado.idade === 'a5_15' && herdado.epsOverride === 0.3);
ok('herda unidade e PN', herdado.unidExt === 'km' && herdado.pnMcaOverride === 250);
ok('mas mantém o que é próprio do trecho', herdado.nBombas === 2 && herdado.extensao === 0 &&
   herdado.pecas.length === 0);
var adHerd = E.novaAdutora(2, modelo);
ok('adutora nova também herda', adHerd.catalogoId === 'fd_esgoto_je' && adHerd.itemRot === 'DN 600');
ok('e continua sendo do tipo adutora', adHerd.tipo === 'adutora');
ok('sucção comum nasce com o tipo certo', E.novoTrechoComum(1, 'succao').tipo === 'succao');
/* o tipo define o critério aplicado */
var stTipo = stNPSH();
var ctxT = C.contexto(stTipo, cats);
ok('trecho de sucção usa o critério de sucção',
   C.criterioDe(stTipo, ctxT, 'succao').vMax !== C.criterioDe(stTipo, ctxT, 'barrilete').vMax);

/* ---------------------------------------------------------------- */
titulo('30. Blocos de ancoragem — empuxo');
const BA = PDA.BA;
/* com DE igual ao DN, reproduz os empuxos unitários da planilha */
prox('tê DN 250 (DE=DN): 49,09 kgf/mca', BA.empuxoUnit('te', 0.25), 49.09, 1e-3);
prox('curva 90° DN 250: 69,42', BA.empuxoUnit('c90', 0.25), 69.42, 1e-3);
prox('curva 45° DN 250: 37,57', BA.empuxoUnit('c45', 0.25), 37.57, 1e-3);
prox('curva 22°30′ DN 250: 19,15', BA.empuxoUnit('c22', 0.25), 19.15, 1e-3);
prox('curva 11°15′ DN 250: 9,62', BA.empuxoUnit('c11', 0.25), 9.62, 1e-3);
prox('redução 400→300 = A1−A2', BA.empuxoUnit('reducao', 0.4, 0.3),
     1000 * Math.PI / 4 * (0.16 - 0.09), 1e-9);
ok('curva 90° = √2 × tê', Math.abs(BA.empuxoUnit('c90', 0.3) / BA.empuxoUnit('te', 0.3) - Math.SQRT2) < 1e-9);

titulo('31. Blocos de ancoragem — seleção do bloco padronizado');
/* casos da planilha (aba GCAC), com o DN nominal para reproduzir a seleção */
let selB = BA.selecionarPadrao(200, 0.65, 31.42 * 60);      /* tê DN 200, 60 mca */
ok('tê DN 200 a 60 mca -> tipo 2 com 0,65 m',
   selB.achou && selB.linha.tipo === 2 && selB.rec === 0.65, JSON.stringify(selB));
selB = BA.selecionarPadrao(400, 0.65, 125.66 * 60);         /* tê DN 400, 60 mca */
ok('tê DN 400 a 60 mca -> cai para 0,90 m, tipo 8',
   selB.achou && selB.linha.tipo === 8 && selB.rec === 0.90 && !selB.recPedido, JSON.stringify(selB));
prox('e a capacidade dele é 7800 kgf', selB.achou ? selB.linha.cap : 0, 7800, 1e-9);
selB = BA.selecionarPadrao(800, 0.65, 200000);
ok('empuxo acima de toda a tabela -> "a ser calculado"', !selB.achou);
/* na fronteira exata, o bloco ainda atende (como o PROCV aproximado da planilha) */
selB = BA.selecionarPadrao(200, 0.65, 1800);
ok('empuxo igual à capacidade ainda usa o tipo 1', selB.achou && selB.linha.tipo === 1);
selB = BA.selecionarPadrao(200, 0.65, 1801);
ok('1 kgf acima já pede o tipo 2', selB.achou && selB.linha.tipo === 2);
/* os dois erros de digitação da planilha ficaram corrigidos */
const t175 = BA.capacidades.filter(c => c.rec === 1.75)[0];
const iDN700 = t175.dns.indexOf(700), iDN800 = t175.dns.indexOf(800);
ok('1,75 m / DN 700 / tipo 6 corrigido para 7000', t175.cap[t175.tipos.indexOf(6)][iDN700] === 7000);
ok('1,75 m / DN 800 / tipo 17 corrigido para 14000', t175.cap[t175.tipos.indexOf(17)][iDN800] === 14000);
ok('colunas DN 900/1000 de 1,75 m omitidas',
   t175.cap.every(l => l[t175.dns.indexOf(900)] === null && l[t175.dns.indexOf(1000)] === null));
/* capacidade nunca menor que o empuxo em nenhuma célula usada na seleção */
let coerente = true;
BA.capacidades.forEach(t => t.cap.forEach((linha, i) => linha.forEach((cap, j) => {
  if (cap === null) return;
  const s = BA.selecionarPadrao(t.dns[j], t.rec, cap);
  if (!s.achou || s.linha.cap < cap) coerente = false;
})));
ok('toda capacidade tabelada é atingível pela seleção', coerente);

titulo('32. Blocos de ancoragem — apoio no solo e peso');
let ap = BA.dimensionarApoio(7540, 10000, 1.5, 0.4264);
prox('A = FS·E/σ = 1,131 m²', ap.Anec, 1.5 * 7540 / 10000, 1e-9);
ok('encosto sugerido cobre a área', ap.Aefetiva >= ap.Anec - 1e-9);
ok('FS efetivo ≥ FS pedido', ap.fsEfetivo >= 1.5 - 1e-9);
ok('proporção do encosto contida (L ≤ 2,6·b)', ap.L <= 2.6 * ap.b + 1e-9);
ap = BA.dimensionarApoio(131035, 10000, 1.5, 0.842);          /* caso DN 800 */
ok('empuxo grande não gera encosto em fita (L ≤ 2,6·b)', ap.L <= 2.6 * ap.b + 1e-9,
   ap.b + ' x ' + ap.L);
ok('solo sem capacidade -> sem dimensionamento', BA.dimensionarApoio(5000, 0, 1.5, 0.2).ok === false);
let pesoB = BA.dimensionarPeso(10000, 1.5, 2400, 0.5);
prox('bloco de peso: V = FS·E/γ', pesoB.concreto, 1.5 * 10000 / 2400, 1e-9);

titulo('33. Blocos de ancoragem — resolução no projeto');
const stB = stNPSH();
stB.blocos.ativo = true;
stB.blocos.itens = [E.novoBloco(1)];
stB.blocos.itens[0].pressaoFonte = 'informada';
stB.blocos.itens[0].pressaoInformada = 60;
const ctxB = C.contexto(stB, cats);
const resB = C.resumo(stB, cats);
let infoB = C.blocoInfo(stB, ctxB, resB, stB.blocos.itens[0]);
ok('herda o DE do trecho da adutora', infoB.deMm > 0 && infoB.trechoRot !== null,
   JSON.stringify({ de: infoB.deMm, tr: infoB.trechoRot }));
prox('empuxo = unit × pressão', infoB.calc.E, infoB.calc.unit * 60, 1e-9);
/* pressão pela envoltória/golpe */
stB.blocos.itens[0].pressaoFonte = 'transitorio';
infoB = C.blocoInfo(stB, ctxB, resB, stB.blocos.itens[0]);
const pMaxGolpe = resB.golpe.reduce((a, g) => Math.max(a, g.pressaoMaxMca || 0), 0);
ok('pressão do transitório = máxima do golpe (sem perfil)',
   Math.abs(infoB.pMca - pMaxGolpe) < 1e-9, infoB.pMca + ' x ' + pMaxGolpe);
/* pressão de ensaio */
stB.blocos.itens[0].pressaoFonte = 'ensaio';
stB.blocos.itens[0].fatorEnsaio = 1.5;
infoB = C.blocoInfo(stB, ctxB, resB, stB.blocos.itens[0]);
prox('pressão de ensaio = 1,5 × Hm', infoB.pMca, resB.projeto.Hm * 1.5, 1e-9);
/* tipo escolhido manualmente que não atende é acusado */
stB.blocos.itens[0].pressaoFonte = 'informada';
stB.blocos.itens[0].tipoEscolhido = 1;
infoB = C.blocoInfo(stB, ctxB, resB, stB.blocos.itens[0]);
ok('tipo manual insuficiente vira "ruim"',
   infoB.calc.escolhido && !infoB.calc.escolhido.atende ? infoB.classe === 'ruim' : true);
/* bloco em curva vertical sai pelo cálculo */
stB.blocos.itens[0].tipoEscolhido = null;
stB.blocos.itens[0].orientacao = 'vert_cima';
infoB = C.blocoInfo(stB, ctxB, resB, stB.blocos.itens[0]);
ok('curva vertical convexa dimensiona por peso', infoB.calc.peso && infoB.calc.peso.concreto > 0);

/* ---------------------------------------------------------------- */
titulo('34. Contas nos campos numéricos');
/* o módulo de interface não entra no sandbox padrão; carrega só o parseNum
   com um stub mínimo de document */
const sb2 = { window: {}, document: { addEventListener: function () {}, createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, classList: { add: function () {} } }; }, createElementNS: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {} }; } }, console, JSON, Math, Number, Object, Array, String, isNaN, parseFloat, parseInt };
sb2.globalThis = sb2;
vm.createContext(sb2);
vm.runInContext(fs.readFileSync(path.join(raiz, '08-ui-base.js'), 'utf8'), sb2, { filename: '08-ui-base.js' });
const UIb = sb2.window.PDA.UI;
prox('=10+25+30 -> 65', UIb.parseNum('=10+25+30'), 65, 1e-12);
prox('10+25+30 sem igual também', UIb.parseNum('10+25+30'), 65, 1e-12);
prox('vírgula decimal: 2,5*4', UIb.parseNum('2,5*4'), 10, 1e-12);
prox('parênteses: (170-120)/2', UIb.parseNum('(170-120)/2'), 25, 1e-12);
prox('potência: 2^10', UIb.parseNum('2^10'), 1024, 1e-12);
prox('número simples continua igual', UIb.parseNum('123,45'), 123.45, 1e-12);
prox('milhar brasileiro preservado', UIb.parseNum('1.234,56'), 1234.56, 1e-12);
/* formatação com ponto de milhar (pt-BR) */
ok('UI.num agrupa o milhar', UIb.num(1234567.89, 2) === '1.234.567,89', UIb.num(1234567.89, 2));
ok('milhar sem casas decimais', UIb.num(6670, 0) === '6.670', UIb.num(6670, 0));
ok('negativo agrupado', UIb.num(-1234, 0) === '-1.234', UIb.num(-1234, 0));
ok('abaixo de mil não muda', UIb.num(999.5, 1) === '999,5', UIb.num(999.5, 1));
ok('numEdit continua sem agrupar (campos editáveis)', UIb.numEdit(6670) === '6670');
prox('round-trip parseNum(num(x))', UIb.parseNum(UIb.num(1234567.89, 2)), 1234567.89, 1e-9);
prox('negativo simples não vira conta', UIb.parseNum('-5'), -5, 1e-12);
ok('expressão malformada não explode', UIb.parseNum('10++') === 10 || UIb.parseNum('10++') === null);
ok('texto malicioso não avalia', UIb.parseNum('alert(1)') === null);

titulo('35. Ponto alto da linha');
function stAlto() {
  const st = E.padrao();
  st.vazao.valor = 100;
  st.cotas.nivelSuccaoMin = 170; st.cotas.nivelSuccaoMax = 171; st.cotas.eixoBomba = 168;
  st.cotas.nivelChegada = 180;
  st.adutoras[0].itemRot = 'DN 300';
  st.adutoras[0].extensao = 2000;
  return st;
}
/* sem ponto alto informado: nada acontece */
let stA = stAlto();
let resA = C.resumo(stA, cats);
ok('sem campo e sem perfil, sem verificação', resA.pontoAlto.fonte === null);
/* ponto alto manual acima da chegada, sem distância: cobra a distância */
stA = stAlto(); stA.cotas.cotaPontoAlto = 190;
resA = C.resumo(stA, cats);
ok('acima da chegada sem distância -> aviso grave pedindo distância',
   resA.pontoAlto.semDistancia && resA.avisosDados.some(a => a.id === 'pontoAltoSemDist' && a.grave));
/* com distância: piezométrica aproximada acusa o déficit */
stA.cotas.distPontoAlto = 1000;
resA = C.resumo(stA, cats);
ok('com distância, calcula a pressão no ponto alto', resA.pontoAlto.pPerm !== null);
ok('cota 190 entre 170 e 180 dá pressão negativa', resA.pontoAlto.pPerm < 0,
   String(resA.pontoAlto.pPerm));
ok('aviso grave com a Hm necessária',
   resA.avisosDados.some(a => a.id === 'pontoAlto' && a.grave && /precisaria ser de pelo menos/.test(a.txt)));
prox('Hm necessária = Hm + déficit', resA.pontoAlto.hmNecessaria,
     resA.projeto.Hm + resA.pontoAlto.deficit, 1e-9);
/* ponto alto abaixo da chegada: sempre passa */
stA = stAlto(); stA.cotas.cotaPontoAlto = 175;
resA = C.resumo(stA, cats);
ok('abaixo da chegada, sem aviso', resA.pontoAlto.pPerm >= 0 &&
   !resA.avisosDados.some(a => a.id === 'pontoAlto'));
/* com o perfil lançado, vale o perfil — e o campo divergente é acusado */
stA = stAlto(); stA.cotas.cotaPontoAlto = 186;
stA.perfil = { ativo: true, modo: 'acumulada', unidExt: 'm',
  pontos: [{ est: 0, cota: 170 }, { est: 1000, cota: 190 }, { est: 2000, cota: 180 }] };
resA = C.resumo(stA, cats);
ok('perfil ativo: fonte é o perfil', resA.pontoAlto.fonte === 'perfil');
ok('crista do perfil identificada', Math.abs(resA.pontoAlto.cotaMaxPerfil - 190) < 1e-9);
ok('campo manual divergente do perfil é acusado',
   resA.avisosDados.some(a => a.id === 'pontoAltoDiverge'));
ok('pressão negativa no perfil gera o aviso grave',
   resA.pontoAlto.pPerm < 0 && resA.avisosDados.some(a => a.id === 'pontoAlto' && a.grave));

titulo('36. Custo do tubo recalibrado');
const stEcoN = E.padrao();
prox('novo padrão: DN 300 ≈ 890 R$/m',
     stEcoN.economia.custoA * Math.pow(300, stEcoN.economia.custoB), 890, 0.05);
ok('DN 800 entre 2500 e 3300 R$/m', (function () {
  const v = stEcoN.economia.custoA * Math.pow(800, stEcoN.economia.custoB);
  return v > 2500 && v < 3300;
})());
const stMigN = E.padrao();
stMigN.economia.custoA = 0.9; stMigN.economia.custoB = 1.45;
const stMigN2 = E.migrar(JSON.parse(JSON.stringify(stMigN)));
ok('projeto antigo com os padrões antigos migra para os novos',
   stMigN2.economia.custoA === stEcoN.economia.custoA && stMigN2.economia.custoB === stEcoN.economia.custoB);
const stMigN3 = E.padrao();
stMigN3.economia.custoA = 1.1; stMigN3.economia.custoB = 1.45;
ok('coeficiente editado pelo usuário não é tocado',
   E.migrar(JSON.parse(JSON.stringify(stMigN3))).economia.custoA === 1.1);

titulo('37. Blocos — solução adotada (dimensões e quantidades)');
const calcSol = BA.calcular({ pecaId: 'c90', deMm: 326, pMca: 80, orientacao: 'horizontal',
  dn: 300, rec: 0.65, soloId: 'areia', fs: 1.5, gamaConcreto: 2400 });
const solB = BA.solucao(calcSol, { recobrimento: 0.65 });
ok('solução é o padronizado quando ele existe', solB.via === 'padrao' && solB.tipo === 10);
prox('espessura equivalente = V/(H·A)', solB.espessura,
     Math.ceil(1.22 / (1.5 * 1.5) * 20) / 20, 1e-9);
const calcSol2 = BA.calcular({ pecaId: 'c90', deMm: 842, pMca: 160, orientacao: 'horizontal',
  dn: 800, rec: 0.65, soloId: 'areia', fs: 1.5, gamaConcreto: 2400 });
const solB2 = BA.solucao(calcSol2, { recobrimento: 0.65 });
ok('sem padronizado que atenda, a solução é o apoio', solB2.via === 'apoio');
ok('apoio traz forma e aço estimados', solB2.forma > 0 && solB2.aco > 0 && solB2.acoEstimado);
prox('aço estimado = 70 kg/m³', solB2.aco, Math.round(70 * solB2.concreto), 1e-9);
const calcSol3 = BA.calcular({ pecaId: 'c90', deMm: 326, pMca: 80, orientacao: 'vert_cima',
  dn: 300, rec: 0.65, soloId: 'areia', fs: 1.5, gamaConcreto: 2400 });
const solB3 = BA.solucao(calcSol3, { recobrimento: 0.65 });
ok('curva vertical convexa: solução por peso', solB3.via === 'peso' && solB3.concreto > 0);

/* ---------------------------------------------------------------- */
titulo('38. Proteção do transitório — requisito');
const PR = PDA.PR;
function stProt() {
  const st = E.padrao();
  st.vazao.valor = 400; st.bombas.instaladas = 3; st.bombas.operando = 2;
  st.cotas.nivelSuccaoMin = 100; st.cotas.nivelSuccaoMax = 101; st.cotas.eixoBomba = 98;
  st.cotas.nivelChegada = 140;
  st.adutoras[0].itemRot = 'DN 500';
  st.adutoras[0].extensao = 3000;
  st.adutoras[0].pnMcaOverride = 160;
  st.protecao.ativo = true;
  st.perfil = { ativo: true, modo: 'acumulada', unidExt: 'm',
    pontos: [{ est: 0, cota: 100 }, { est: 1500, cota: 120 }, { est: 3000, cota: 140 }] };
  return st;
}
let stPR = stProt();
let resP = C.resumo(stPR, cats);
let reqP = PR.requisito(stPR, C.contexto(stPR, cats), resP);
ok('requisito calculado do perfil', reqP && reqP.temPerfil);
ok('linha não passa sem proteção', reqP.precisa === (resP.envoltoria.dh > reqP.dhAlvo));
ok('Δh alvo positivo e menor que o sem proteção', reqP.dhAlvo > 0 && reqP.dhAlvo < reqP.dhSemProtecao,
   JSON.stringify({ alvo: reqP.dhAlvo, sem: reqP.dhSemProtecao }));
/* o limite por sobrepressão bate com a conta manual no ponto governante */
if (reqP.pontoSobre) {
  const pgov = reqP.pontoSobre;
  const frac = 1 - pgov.xEscalado / resP.envoltoria.lTrechos;
  prox('limite por sobrepressão = (PN − folga − pPerm)/frac',
       reqP.dhAdmSobre, (pgov.pn - reqP.folga - pgov.pPerm) / frac, 1e-9);
}
/* ponto já inviável em regime permanente sai do requisito e é listado */
stPR = stProt();
stPR.perfil.pontos[1].cota = 170;         /* crista acima da piezométrica */
resP = C.resumo(stPR, cats);
reqP = PR.requisito(stPR, C.contexto(stPR, cats), resP);
ok('crista inviável no permanente é isolada do requisito',
   reqP.permInviavel.length >= 1 && reqP.dhAlvo !== null && reqP.dhAlvo >= 0);

titulo('39. Proteção — RHO pela coluna rígida');
stPR = stProt();
resP = C.resumo(stPR, cats);
const ctxP = C.contexto(stPR, cats);
reqP = PR.requisito(stPR, ctxP, resP);
const rhoP = PR.rho(stPR, ctxP, resP, reqP);
ok('dimensiona sem erro', !rhoP.erro && rhoP.vTanque > 0, JSON.stringify(rhoP.erro || rhoP.vTanque));
/* verificação de energia: KE = γ·p0·V0·ln(p1/p0) no caso de sobrepressão */
prox('balanço de energia fechado (sobrepressão)',
     9810 * rhoP.p0 * rhoP.v0Sobre * Math.log(rhoP.p1 / rhoP.p0), rhoP.KE, 1e-9);
prox('balanço de energia fechado (depressão)',
     9810 * rhoP.p0 * rhoP.v0Sub * Math.log(rhoP.p0 / rhoP.p2), rhoP.KE, 1e-9);
ok('folga de 20 % e ar = metade do tanque',
   Math.abs(rhoP.vTanque - Math.max(rhoP.v0Sobre, rhoP.v0Sub) * 1.2 * 2) < 1e-9);
ok('volume comercial é o menor que atende',
   rhoP.comercial === null || (rhoP.comercial >= rhoP.vTanque &&
     PR.VOLUMES_RHO.filter(v => v >= rhoP.vTanque)[0] === rhoP.comercial));
/* dhComRho é o inverso do dimensionamento */
if (rhoP.comercial) {
  const eff = PR.dhComRho(stPR, ctxP, resP, rhoP.vTanque);
  ok('com o volume necessário, o Δh efetivo ≈ alvo (ou melhor)',
     eff.dh <= Math.max(2, reqP.dhAlvo) + 1.0, JSON.stringify({ eff: eff.dh, alvo: reqP.dhAlvo }));
}
/* avaliação acusa sub e superdimensionamento */
stPR.protecao.dispositivos = [E.novoDispositivo('rho')];
stPR.protecao.dispositivos[0].volumeM3 = 0.5;
let avalP = PR.avaliar(stPR, ctxP, resP, reqP, stPR.protecao.dispositivos[0]);
ok('RHO pequeno acusa SUBDIMENSIONADO', avalP.classe === 'ruim' &&
   avalP.avisos.some(a => /SUBDIMENSIONADO/.test(a)));
stPR.protecao.dispositivos[0].volumeM3 = 1000;
avalP = PR.avaliar(stPR, ctxP, resP, reqP, stPR.protecao.dispositivos[0]);
ok('RHO gigante acusa SUPERDIMENSIONADO', avalP.classe === 'atencao' &&
   avalP.avisos.some(a => /SUPERDIMENSIONADO/.test(a)));

titulo('40. Proteção — ventosas, TAU e chaminé');
const regraV = PR.dnVentosa(500);
ok('regra 1/12 a 1/8: DN 500 -> mín 50, rec 80',
   regraV.dnMin === 50 && regraV.dnRec === 80, JSON.stringify(regraV));
/* ventosa simples em ponto com depressão é acusada */
stPR.protecao.dispositivos = [E.novoDispositivo('ventosa')];
stPR.protecao.dispositivos[0].funcao = 'simples';
stPR.protecao.dispositivos[0].dn = 80;
stPR.protecao.dispositivos[0].x = 1500;
stPR.perfil.pontos[1].cota = 145;          /* crista real (acima da chegada), com depressão na envoltória */
resP = C.resumo(stPR, cats);
const ptsV = PR.pontosSugeridos(stPR, ctxP, resP);
ok('sugere pontos do perfil', ptsV.length >= 1);
ok('ponto alto sugerido com função de admissão',
   ptsV.some(p => /ponto alto/.test(p.motivo) && (p.funcao === 'tripla' || p.funcao === 'quadrupla')));
reqP = PR.requisito(stPR, ctxP, resP);
avalP = PR.avaliar(stPR, ctxP, resP, reqP, stPR.protecao.dispositivos[0]);
ok('função simples onde há depressão é FUNÇÃO INSUFICIENTE',
   avalP.avisos.some(a => /FUNÇÃO INSUFICIENTE/.test(a)));
/* ventosa subdimensionada */
stPR.protecao.dispositivos[0].funcao = 'quadrupla';
stPR.protecao.dispositivos[0].dn = 25;
avalP = PR.avaliar(stPR, ctxP, resP, reqP, stPR.protecao.dispositivos[0]);
ok('DN abaixo de 1/12 acusa SUBDIMENSIONADA', avalP.avisos.some(a => /SUBDIMENSIONADA/.test(a)));
/* TAU dimensiona volume onde a envoltória mínima é negativa */
const tauP = PR.tau(stPR, ctxP, resP, 1400);
ok('TAU calcula o volume da zona de depressão', !tauP.erro && (tauP.volume >= 0));
const chP = PR.chamine(stPR, ctxP, resP, 1500);
ok('chaminé devolve a altura necessária', !chP.erro && chP.altura > 0);
/* envoltória protegida usa o Δh do RHO adotado */
stPR.protecao.dispositivos = [E.novoDispositivo('rho')];
stPR.protecao.dispositivos[0].volumeM3 = 30;
resP = C.resumo(stPR, cats);
const protP = PR.envoltoriaProtegida(stPR, ctxP, resP);
ok('envoltória protegida existe e tem Δh menor',
   protP && protP.env && protP.dh < resP.envoltoria.dh,
   protP ? JSON.stringify({ prot: protP.dh, sem: resP.envoltoria.dh }) : 'null');

titulo('40b. Os dispositivos conversam entre si');
stPR = stProt();
stPR.perfil.pontos[1].cota = 145;          /* crista com depressão na envoltória mínima */
resP = C.resumo(stPR, cats);
const reqSemDisp = PR.requisito(stPR, ctxP, resP);
ok('sem dispositivos não há alívio', reqSemDisp.aliviadosSub === 0 && !reqSemDisp.temAlivio);
/* ventosa de admissão na crista cria zona de alívio */
stPR.protecao.dispositivos = [E.novoDispositivo('ventosa')];
stPR.protecao.dispositivos[0].funcao = 'quadrupla';
stPR.protecao.dispositivos[0].dn = 80;
stPR.protecao.dispositivos[0].x = 1500;
const zonasV = PR.zonasAlivio(stPR, ctxP, resP);
ok('ventosa de admissão cria zona de alívio ±300 m',
   zonasV.length === 1 && zonasV[0].x0 === 1200 && zonasV[0].x1 === 1800, JSON.stringify(zonasV));
stPR.protecao.dispositivos[0].funcao = 'simples';
ok('ventosa simples não cria zona', PR.zonasAlivio(stPR, ctxP, resP).length === 0);
stPR.protecao.dispositivos[0].funcao = 'quadrupla';
const reqComDisp = PR.requisito(stPR, ctxP, resP);
ok('pontos cobertos saem do requisito de depressão', reqComDisp.aliviadosSub >= 1,
   String(reqComDisp.aliviadosSub));
ok('limite por depressão relaxa (ou deixa de existir)',
   reqComDisp.dhAdmSub === null ||
   (reqSemDisp.dhAdmSub !== null && reqComDisp.dhAdmSub >= reqSemDisp.dhAdmSub - 1e-9),
   JSON.stringify({ sem: reqSemDisp.dhAdmSub, com: reqComDisp.dhAdmSub }));
/* o RHO necessário diminui com a ventosa cobrindo a depressão */
const rhoSemD = PR.rho(stPR, ctxP, resP, reqSemDisp);
const rhoComD = PR.rho(stPR, ctxP, resP, reqComDisp);
ok('RHO necessário fica menor ou igual com a ventosa lançada',
   rhoComD.vTanque <= rhoSemD.vTanque + 1e-9,
   JSON.stringify({ sem: rhoSemD.vTanque, com: rhoComD.vTanque }));
/* envoltória protegida aparece com QUALQUER dispositivo (sem RHO) */
const protV = PR.envoltoriaProtegida(stPR, ctxP, resP);
ok('envoltória protegida existe só com a ventosa', !!(protV && protV.env) && !protV.temRho);
const naZona = protV.env.pontos.filter(p => p.xEscalado >= 1200 && p.xEscalado <= 1800);
const naZonaSem = resP.envoltoria.pontos.filter(p => p.xEscalado >= 1200 && p.xEscalado <= 1800);
ok('sem proteção havia depressão na zona da ventosa', naZonaSem.some(p => p.pMin < 0));
ok('na zona da ventosa a envoltória mínima não fica negativa',
   naZona.length > 0 && naZona.every(p => p.pMin >= -1e-9),
   JSON.stringify(naZona.map(p => p.pMin)));
/* TAU acrescenta zona até o fim da depressão; chaminé limita a máxima */
stPR.protecao.dispositivos.push(E.novoDispositivo('tau'));
stPR.protecao.dispositivos[1].x = 1500;
ok('TAU acrescenta zona de alívio', PR.zonasAlivio(stPR, ctxP, resP).length === 2);
stPR.protecao.dispositivos.push(E.novoDispositivo('chamine'));
stPR.protecao.dispositivos[2].x = 1500;
stPR.protecao.dispositivos[2].altura = 8;
const zonas3 = PR.zonasAlivio(stPR, ctxP, resP);
ok('chaminé cria zona local com teto na envoltória máxima',
   zonas3.some(z => z.tipo === 'chamine' && z.headMax !== undefined),
   JSON.stringify(zonas3));
ok('chaminé também alimenta a zona de depressão de jusante (como TAU ilimitado)',
   zonas3.some(z => z.tipo === 'chamine' && z.efeito === 'depressao' && z.x1 > 1650),
   JSON.stringify(zonas3));
const prot3 = PR.envoltoriaProtegida(stPR, ctxP, resP);
ok('rótulo lista os dispositivos lançados',
   /ventosa/.test(prot3.rotulo) && /TAU/.test(prot3.rotulo) && /chaminé/.test(prot3.rotulo), prot3.rotulo);
const noEntorno = prot3.env.pontos.filter(p => Math.abs(p.xEscalado - 1500) <= 150);
ok('no entorno da chaminé a envoltória máxima respeita o nível d\'água (cota + altura)',
   noEntorno.length > 0 && noEntorno.every(p => p.envMax <= 145 + 8 + 1e-6),
   JSON.stringify(noEntorno.map(p => p.envMax)));
/* pontos interpolados nas bordas das zonas: o efeito aparece no gráfico
   mesmo quando o perfil é esparso */
ok('a envoltória protegida ganha pontos nas bordas das zonas',
   prot3.env.pontos.length > resP.envoltoria.pontos.length &&
   prot3.env.pontos.some(p => Math.abs(p.xEscalado - 1200) < 1) &&
   prot3.env.pontos.some(p => Math.abs(p.xEscalado - 1800) < 1),
   prot3.env.pontos.map(p => Math.round(p.xEscalado)).join(','));
ok('pontos inseridos ficam ordenados e com cota interpolada',
   prot3.env.pontos.every((p, i, a) => i === 0 || p.xEscalado >= a[i - 1].xEscalado) &&
   prot3.env.pontos.filter(p => Math.abs(p.xEscalado - 1200) < 1)
     .every(p => p.cota > 100 && p.cota < 145));
/* chaminé sozinha também alivia o requisito */
{
  const stCh = stProt();
  stCh.perfil.pontos[1].cota = 145;
  const resCh = C.resumo(stCh, cats);
  stCh.protecao.dispositivos = [E.novoDispositivo('chamine')];
  stCh.protecao.dispositivos[0].x = 1500;
  stCh.protecao.dispositivos[0].altura = 8;
  const reqCh = PR.requisito(stCh, ctxP, resCh);
  ok('chaminé sozinha alivia o requisito de depressão', reqCh.aliviadosSub >= 1,
     String(reqCh.aliviadosSub));
}

titulo('40c. TAU pela cavidade de separação (coluna rígida)');
{
  const stT = stProt();
  stT.perfil.pontos[1].cota = 145;
  const resT = C.resumo(stT, cats);
  const tauC = PR.tau(stT, ctxP, resT, 1500);
  ok('TAU devolve a cavidade e o volume', !tauC.erro && tauC.cavidade > 0 && tauC.volume > 0,
     JSON.stringify(tauC));
  prox('volume = 1,5 × cavidade', tauC.volume, tauC.cavidade * 1.5, 1e-9);
  /* fecha com a cinemática: s = v²·Lj/(2·g·ΔH), cavidade = A·s */
  const pT = resT.envoltoria.pontos.filter(p => Math.abs(p.xEscalado - 1500) < 1)[0];
  const sT = tauC.vJus * tauC.vJus * tauC.LJus / (2 * 9.80665 * tauC.dH);
  prox('curso da coluna de jusante', tauC.curso, Math.min(sT, tauC.LJus), 1e-9);
  prox('ΔH é a pressão disponível no ponto em regime', tauC.dH, Math.max(2, pT.hgl - pT.cota), 1e-9);
  ok('a cavidade é MUITO menor que o tubo da zona de depressão (fim do exagero)',
     tauC.volume < tauC.volumeZona,
     JSON.stringify({ volume: tauC.volume, tuboDaZona: tauC.volumeZona }));
  ok('ponto acima do nível de chegada é sinalizado (gravidade a jusante)',
     tauC.desce === true);
}
/* a energia da coluna soma trecho a trecho com a velocidade de cada um */
{
  const st2t = stProt();
  st2t.adutoras[0].extensao = 1500;
  const dup = JSON.parse(JSON.stringify(st2t.adutoras[0]));
  dup.itemRot = 'DN 600'; dup.extensao = 1500; dup.nome = 'Trecho 2';
  st2t.adutoras.push(dup);
  const res2t = C.resumo(st2t, cats);
  const req2t = PR.requisito(st2t, C.contexto(st2t, cats), res2t);
  const rho2t = PR.rho(st2t, C.contexto(st2t, cats), res2t, req2t);
  const keMao = res2t.projeto.adutoras.reduce((acc, r) => {
    const A = Math.PI * r.tubo.diM * r.tubo.diM / 4;
    return acc + 0.5 * (C.contexto(st2t, cats).rho || 998) * A * r.L * r.v * r.v;
  }, 0);
  prox('KE somada por trecho (v de cada trecho)', rho2t.KE, keMao, 1e-6);
}

titulo('41. Tipos de junta');
const catFDj = CAT.buscar(cats.todos, 'fd_k7');
ok('FD tem 4 juntas (JGS, JTI, JTE, flangeada)', CAT.juntas['Ferro fundido dúctil'].length === 4);
ok('junta padrão do K7 é a elástica', CAT.juntaPadrao(catFDj) === 'jgs');
ok('catálogo flangeado tem junta padrão flangeada',
   CAT.juntaPadrao(CAT.buscar(cats.todos, 'fd_flg_agua')) === 'flg');
ok('JGS não ancora; JTI ancora',
   CAT.junta(catFDj, 'jgs').ancora === false && CAT.junta(catFDj, 'jti').ancora === true);
ok('PEAD: solda de topo autotravada',
   CAT.junta(CAT.buscar(cats.todos, 'pead_pn10_pe100') || cats.todos.filter(c => c.familia === 'PEAD')[0], 'solda_topo').ancora === true);
/* bloco herdando trecho com junta travada recebe o aviso */
const stJ = stProt();
stJ.adutoras[0].junta = 'jti';
stJ.blocos.ativo = true;
stJ.blocos.itens = [E.novoBloco(1)];
stJ.blocos.itens[0].pressaoFonte = 'informada';
stJ.blocos.itens[0].pressaoInformada = 60;
const resJ = C.resumo(stJ, cats);
const infoJ = C.blocoInfo(stJ, C.contexto(stJ, cats), resJ, stJ.blocos.itens[0]);
ok('bloco em trecho com junta travada avisa que o travamento dispensa bloco',
   infoJ.avisos.some(a => /junta travada|travad/i.test(a)));

console.log('\n' + '='.repeat(60));
console.log(falhas === 0 ? `TODOS OS ${total} TESTES PASSARAM` : `${falhas} de ${total} TESTES FALHARAM`);
console.log('='.repeat(60));
process.exit(falhas === 0 ? 0 : 1);
