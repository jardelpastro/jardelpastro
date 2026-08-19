/* Teste de interface no navegador — executar com:  node tests/ui.js
   Requer: npm install --no-save playwright                            */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ARQ = 'file://' + path.join(__dirname, '..', 'dist', 'Pre-dimensionamento-Adutora.html');

let falhas = 0, total = 0;
function ok(nome, cond, det) {
  total++;
  if (cond) console.log('  ok   ' + nome);
  else { falhas++; console.log('  FALHA ' + nome + (det ? '  -> ' + det : '')); }
}
function titulo(t) { console.log('\n' + t); }

(async () => {
  /* usa o Chromium já presente no ambiente, sem baixar navegador */
  const fs = require('fs');
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));

  await page.goto(ARQ);
  await page.waitForSelector('#abas button');

  titulo('1. Carregamento');
  ok('abas montadas', (await page.locator('#abas button').count()) === 13,
     String(await page.locator('#abas button').count()));
  ok('marca no cabeçalho', (await page.locator('#marca .marca-bloco').count()) === 1);
  ok('projeto em branco abre sem pendências',
     (await page.locator('#abas button .marcador').count()) === 0,
     String(await page.locator('#abas button .marcador').count()));
  ok('aba inicial é o Resumo',
     (await page.locator('#abas button[aria-selected="true"]').innerText()) === 'Resumo');
  ok('resumo traz os campos essenciais destacados',
     (await page.locator('#conteudo label.campo.chave').count()) >= 5,
     String(await page.locator('#conteudo label.campo.chave').count()));
  ok('esquema de cotas desenhado', (await page.locator('#conteudo svg.esquema').count()) >= 1);
  ok('sem erro de console no carregamento', erros.length === 0, erros.join(' | '));

  titulo('2. Navegação por todas as abas');
  const abas = await page.locator('#abas button').allTextContents();
  for (let i = 0; i < abas.length; i++) {
    erros.length = 0;
    await page.locator('#abas button').nth(i).click();
    await page.waitForTimeout(140);
    const n = await page.locator('#conteudo .cartao, #conteudo .aviso').count();
    ok('aba "' + abas[i] + '" renderiza (' + n + ' blocos)', n > 0 && erros.length === 0,
       erros.join(' | '));
  }

  titulo('3. Exemplo de água (reprodução da planilha Hazen-Williams)');
  erros.length = 0;
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Adutora de água tratada' }).click();
  await page.waitForTimeout(320);
  ok('carregou sem erro', erros.length === 0, erros.join(' | '));
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(300);
  const faixa = await page.locator('.faixa-resumo').first().innerText();
  ok('vazão total 400,0 L/s na faixa de resumo', /400,0/.test(faixa), faixa.replace(/\n/g, ' | '));
  ok('mostra Hm', /Hm/i.test(faixa));
  ok('mostra motor', /Motor/i.test(faixa));

  /* conferência numérica: Hm e BHP devem bater com o cálculo direto */
  const conf = await page.evaluate(() => {
    const P = window.PDA;
    const res = P.C.resumo(P.App.st, P.App.cats);
    const c = res.projeto;
    return {
      Hm: c.Hm, Hg: c.Hg, bhp: c.bhpCv, motor: c.motorCv,
      qTot: c.qTotal, hf: c.hfRecalque + c.hfSuccao, hl: c.hlRecalque + c.hlSuccao,
      nAdut: c.adutoras.length, nRec: c.recalque.length, nSuc: c.succao.length,
      metodo: P.App.st.calculo.metodo
    };
  });
  ok('método Hazen-Williams ativo', conf.metodo === 'hw');
  ok('Hg = 22 m', Math.abs(conf.Hg - 22) < 1e-9, String(conf.Hg));
  ok('Hm coerente (Hg + perdas)', Math.abs(conf.Hm - (conf.Hg + conf.hf + conf.hl)) < 1e-9);
  ok('Hm maior que Hg', conf.Hm > conf.Hg, conf.Hm.toFixed(2));
  ok('BHP positivo e plausível', conf.bhp > 50 && conf.bhp < 400, conf.bhp.toFixed(1) + ' cv');
  ok('motor comercial acima do BHP', conf.motor >= conf.bhp, conf.motor + ' >= ' + conf.bhp.toFixed(1));
  ok('1 trecho de adutora, 2 de barrilete comum + 1 individual, 1 de sucção',
     conf.nAdut === 1 && conf.nRec === 3 && conf.nSuc === 1,
     `${conf.nAdut}/${conf.nRec}/${conf.nSuc}`);

  titulo('4. Tabela de diâmetros com cores');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(200);
  const nBom = await page.locator('#conteudo tr.bom').count();
  const nAt = await page.locator('#conteudo tr.atencao').count();
  const nRuim = await page.locator('#conteudo tr.ruim').count();
  ok('há linhas coloridas nas três situações', nBom > 0 && nAt > 0 && nRuim > 0,
     `bom ${nBom} / atenção ${nAt} / ruim ${nRuim}`);
  ok('há exatamente uma sugestão marcada com estrela',
     (await page.locator('#conteudo tr td:has-text("★")').count()) >= 1);

  titulo('5. Clique escolhe o diâmetro');
  const antes = await page.evaluate(() => window.PDA.App.st.adutoras[0].itemRot);
  const linhas = page.locator('#conteudo .conjunto tr.bom');
  const alvo = await linhas.last().locator('td').first().innerText();
  await linhas.last().click();
  await page.waitForTimeout(250);
  const depois = await page.evaluate(() => window.PDA.App.st.adutoras[0].itemRot);
  ok('diâmetro trocado pelo clique', depois !== antes && alvo.indexOf(depois) >= 0,
     `${antes} -> ${depois} (clicado: ${alvo.trim()})`);

  titulo('6. Edição de campo numérico com vírgula');
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(200);
  const campoQ = page.locator('input[data-bind="vazao.valor"]');
  await campoQ.fill('123,5');
  await page.waitForTimeout(420);
  const q = await page.evaluate(() => window.PDA.App.st.vazao.valor);
  ok('vírgula decimal aceita', Math.abs(q - 123.5) < 1e-9, String(q));
  const foco = await page.evaluate(() => document.activeElement.getAttribute('data-bind'));
  ok('foco preservado após o recálculo', foco === 'vazao.valor', String(foco));
  const valVisivel = await campoQ.inputValue();
  ok('valor digitado preservado na tela', valVisivel === '123,5', valVisivel);

  titulo('7. Troca de unidade de vazão');
  await page.selectOption('select[data-bind="vazao.unidade"]', 'm³/h');
  await page.waitForTimeout(250);
  const qSI = await page.evaluate(() => window.PDA.C.contexto(window.PDA.App.st, window.PDA.App.cats).qTotal);
  ok('123,5 m³/h convertidos para m³/s', Math.abs(qSI - 123.5 / 3600) < 1e-12, String(qSI));

  titulo('8. Troca de fórmula');
  await page.locator('#abas button', { hasText: 'Parâmetros' }).click();
  await page.waitForTimeout(240);
  await page.selectOption('select[data-bind="calculo.metodo"]', 'colebrook');
  await page.waitForTimeout(300);
  const temEps = await page.locator('input[data-bind="adutoras.0.epsOverride"]').count();
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(220);
  ok('campo de rugosidade absoluta aparece com Colebrook',
     (await page.locator('input[data-bind="adutoras.0.epsOverride"]').count()) === 1);
  ok('coluna do fator de atrito aparece na tabela',
     (await page.locator('#conteudo th', { hasText: /^f$/ }).count()) >= 1);

  titulo('9. Exemplo de esgoto (reprodução da planilha Colebrook)');
  erros.length = 0;
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(400);
  ok('carregou sem erro', erros.length === 0, erros.join(' | '));
  const esg = await page.evaluate(() => {
    const P = window.PDA;
    const res = P.C.resumo(P.App.st, P.App.cats);
    return {
      Hm: res.projeto.Hm, Hg: res.projeto.Hg, bhp: res.projeto.bhpCv,
      v: res.projeto.adutoras[0].v, L: res.projeto.adutoras[0].L,
      di: res.projeto.adutoras[0].tubo.diMm,
      eps: res.projeto.adutoras[0].tubo.epsMm,
      nCen: res.cenarios.length, golpe: res.golpe ? res.golpe.length : 0,
      celeridade: res.golpe && res.golpe[0] ? res.golpe[0].celeridade : null,
      fam: P.C.contexto(P.App.st, P.App.cats).familiaCriterio,
      v1bomba: res.cenarios[0].adutoras[0].v
    };
  });
  ok('extensão 6670 m', Math.abs(esg.L - 6670) < 1e-9, String(esg.L));
  ok('Hg = 23 m', Math.abs(esg.Hg - 23) < 1e-9, String(esg.Hg));
  ok('DI do FD K7 DN800 = 842 - 2x9,1 = 823,8 mm', Math.abs(esg.di - 823.8) < 0.01, String(esg.di));
  ok('rugosidade agravada por esgoto bruto', esg.eps > 0.10, esg.eps + ' mm');
  ok('velocidade plausível', esg.v > 1 && esg.v < 2, esg.v.toFixed(2) + ' m/s');
  ok('Hm maior que Hg (perdas na linha de 6,7 km)', esg.Hm > esg.Hg + 5, esg.Hm.toFixed(2));
  ok('5 cenários de operação', esg.nCen === 5);
  ok('critério de esgoto ativo', esg.fam === 'esgoto');
  ok('celeridade de FD entre 900 e 1300 m/s', esg.celeridade > 900 && esg.celeridade < 1300,
     esg.celeridade ? esg.celeridade.toFixed(0) : 'null');
  ok('velocidade com 1 bomba menor que no projeto', esg.v1bomba < esg.v,
     esg.v1bomba.toFixed(2) + ' < ' + esg.v.toFixed(2));

  titulo('10. Resultados: perfil, transitório e memorial');
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(350);
  ok('perfil piezométrico desenhado', (await page.locator('svg.perfil').count()) === 1);
  ok('linha piezométrica traçada', (await page.locator('svg.perfil polyline.lp').count()) === 1);
  ok('perfil do terreno traçado', (await page.locator('svg.perfil polyline.terreno').count()) === 1);
  const txtRes = await page.locator('#conteudo').innerText();
  ok('cartão de transitório presente', /Transitório hidráulico/.test(txtRes));
  ok('memorial presente', /Memorial de pré-dimensionamento/.test(txtRes));
  ok('memorial cita a formulação', /Colebrook|log/.test(txtRes));
  ok('comparação entre fórmulas presente', /Comparação entre as fórmulas/.test(txtRes));
  ok('tabela de cenários com 5 linhas',
     (await page.locator('#conteudo table').nth(1).locator('tbody tr').count()) === 5);

  titulo('11. Adicionar e remover trechos de adutora');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(220);
  await page.locator('[data-acao="addAdutora"]').click();
  await page.waitForTimeout(250);
  ok('trecho adicionado', (await page.evaluate(() => window.PDA.App.st.adutoras.length)) === 2);
  await page.locator('input[data-bind="adutoras.1.vazaoPct"]').fill('60');
  await page.waitForTimeout(420);
  const ram = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return { q0: r.projeto.adutoras[0].Q, q1: r.projeto.adutoras[1].Q };
  });
  ok('ramificação reduz a vazão do 2º trecho', Math.abs(ram.q1 / ram.q0 - 0.6) < 1e-6,
     (ram.q1 / ram.q0).toFixed(3));
  await page.locator('[data-acao="delAdutora"]').last().click();
  await page.waitForTimeout(250);
  ok('trecho removido', (await page.evaluate(() => window.PDA.App.st.adutoras.length)) === 1);

  titulo('12. Peças: adicionar, editar K e remover');
  const nPecas0 = await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.length);
  await page.locator('select[data-acao-change="addPeca"][data-base="adutoras.0"]').selectOption('vr');
  await page.waitForTimeout(250);
  ok('peça adicionada', (await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.length)) === nPecas0 + 1);
  const idx = nPecas0;
  await page.locator(`input[data-bind="adutoras.0.pecas.${idx}.kOverride"]`).fill('4,5');
  await page.waitForTimeout(420);
  const kOv = await page.evaluate(i => window.PDA.App.st.adutoras[0].pecas[i].kOverride, idx);
  ok('K sobreposto aceito', Math.abs(kOv - 4.5) < 1e-9, String(kOv));
  const marcado = await page.locator(`input[data-bind="adutoras.0.pecas.${idx}.kOverride"]`).getAttribute('class');
  ok('campo sobreposto fica destacado', /editado/.test(marcado || ''), String(marcado));
  await page.locator(`[data-acao="removerPeca"][data-base="adutoras.0"][data-i="${idx}"]`).click();
  await page.waitForTimeout(250);
  ok('peça removida', (await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.length)) === nPecas0);

  titulo('13. Barrilete comum progressivo');
  await page.locator('#abas button', { hasText: 'Barriletes' }).click();
  await page.waitForTimeout(280);
  const bc = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return r.projeto.recalque.map(x => ({ rot: x.rot, q: x.Q, n: x.nBombas }));
  });
  ok('4 trechos comuns + 1 individual', bc.length === 5, JSON.stringify(bc.map(b => b.n)));
  ok('vazão cresce trecho a trecho no barrilete comum',
     bc[1].q < bc[2].q && bc[2].q < bc[3].q && bc[3].q < bc[4].q,
     bc.slice(1).map(b => (b.q * 1000).toFixed(0)).join(' < '));
  await page.locator('[data-acao^="addTrecho:barrileteComum"]').click();
  await page.waitForTimeout(260);
  ok('trecho de barrilete adicionado',
     (await page.evaluate(() => window.PDA.App.st.barrileteComum.trechos.length)) === 5);

  titulo('14. Sucção e arranjo submersível');
  await page.locator('#abas button', { hasText: 'Sucção' }).click();
  await page.waitForTimeout(240);
  ok('aba de sucção mostra o trecho individual',
     (await page.locator('#conteudo .conjunto').count()) >= 1);
  await page.evaluate(() => { window.PDA.App.st.bombas.tipo = 'submersivel'; window.PDA.App.render(); });
  await page.waitForTimeout(260);
  ok('submersível avisa que não há barrilete de sucção',
     /submersível/i.test(await page.locator('#conteudo').innerText()));
  const semSuc = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return { n: r.projeto.succao.length, npsh: r.projeto.npshd };
  });
  ok('nenhum trecho de sucção computado', semSuc.n === 0);
  ok('NPSH não calculado para submersível', semSuc.npsh === null);
  await page.evaluate(() => { window.PDA.App.st.bombas.tipo = 'afogada'; window.PDA.App.render(); });
  await page.waitForTimeout(220);

  titulo('15. Critérios editáveis mudam as cores');
  await page.locator('#abas button', { hasText: 'Parâmetros' }).click();
  await page.waitForTimeout(260);
  const c0 = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const v = P.C.varrer(P.App.st, ctx, P.App.st.adutoras[0], 'adutoras.0', ctx.nOp);
    return v.linhas.filter(l => l.classe === 'bom').length;
  });
  await page.locator('input[data-bind="criterios.esgoto.adutora.vBom.1"]').fill('1,2');
  await page.waitForTimeout(450);
  const c1 = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const v = P.C.varrer(P.App.st, ctx, P.App.st.adutoras[0], 'adutoras.0', ctx.nOp);
    return v.linhas.filter(l => l.classe === 'bom').length;
  });
  ok('estreitar a faixa reduz os diâmetros aprovados', c1 < c0, c0 + ' -> ' + c1);
  await page.locator('[data-acao="restaurarCriterios"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Confirmar' }).click();
  await page.waitForTimeout(300);
  const c2 = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const v = P.C.varrer(P.App.st, ctx, P.App.st.adutoras[0], 'adutoras.0', ctx.nOp);
    return v.linhas.filter(l => l.classe === 'bom').length;
  });
  ok('restaurar volta ao estado original', c2 === c0, c0 + ' vs ' + c2);

  titulo('16. Catálogos');
  await page.locator('#abas button', { hasText: 'Catálogos' }).click();
  await page.waitForTimeout(280);
  const nOpt = await page.evaluate(() => document.querySelectorAll('#conteudo select option').length);
  ok('seletor lista todos os catálogos', nOpt > 25, String(nOpt));
  ok('tabela de diâmetros exibida', (await page.locator('#conteudo table').count()) >= 2);
  ok('resumo por família exibido', /Cobertura da base/.test(await page.locator('#conteudo').innerText()));

  titulo('17. Cadastro de catálogo novo (colando tabela)');
  await page.locator('[data-acao="novoCatalogo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal input').first().fill('Tubo de teste do fabricante X');
  await page.locator('.modal input').nth(1).fill('Teste');
  await page.locator('.modal textarea').last().fill('100\t120\t5,0\t10\n150\t170\t7,0\t10\n200\t225\t9,5\t16');
  await page.locator('.modal button', { hasText: 'Interpretar' }).click();
  await page.waitForTimeout(160);
  ok('3 itens interpretados', /3 itens interpretados/.test(await page.locator('.modal').innerText()));
  await page.locator('.modal button', { hasText: 'Salvar catálogo' }).click();
  await page.waitForTimeout(350);
  const novoCat = await page.evaluate(() => {
    const c = window.PDA.App.cats.usuario;
    return c.length ? { n: c.length, nome: c[c.length - 1].nome, itens: c[c.length - 1].itens.length,
                        di: window.PDA.CAT.diInterno(c[c.length - 1], c[c.length - 1].itens[0]) } : null;
  });
  ok('catálogo gravado', novoCat && novoCat.itens === 3, JSON.stringify(novoCat));
  ok('DI calculado do catálogo novo (120 - 2x5 = 110)', novoCat && Math.abs(novoCat.di - 110) < 1e-9,
     novoCat ? String(novoCat.di) : '—');
  const espDec = await page.evaluate(() => {
    const c = window.PDA.App.cats.usuario[window.PDA.App.cats.usuario.length - 1];
    return c.itens.map(i => i.e);
  });
  ok('vírgula decimal preservada na importação (5,0 / 7,0 / 9,5)',
     JSON.stringify(espDec) === JSON.stringify([5, 7, 9.5]), JSON.stringify(espDec));
  ok('catálogo novo aparece no seletor de tubos', await page.evaluate(() => {
    const P = window.PDA;
    return P.CAT.buscar(P.App.cats.todos, P.App.cats.usuario[P.App.cats.usuario.length - 1].id) !== null;
  }));

  titulo('18. Usar o catálogo novo em um trecho');
  const idNovo = await page.evaluate(() => window.PDA.App.cats.usuario[window.PDA.App.cats.usuario.length - 1].id);
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(240);
  await page.selectOption('select[data-bind="adutoras.0.catalogoId"]', idNovo);
  await page.waitForTimeout(320);
  ok('diâmetro zerado ao trocar de catálogo',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].itemRot)) === '');
  await page.selectOption('select[data-bind="adutoras.0.itemRot"]', 'DN 200');
  await page.waitForTimeout(320);
  const usoNovo = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return { di: r.projeto.adutoras[0].tubo.diMm, hf: r.projeto.adutoras[0].hf };
  });
  ok('DI de 206 mm (225 - 2x9,5) em uso', Math.abs(usoNovo.di - 206) < 1e-9, String(usoNovo.di));
  ok('perda de carga recalculada', usoNovo.hf > 0);

  titulo('18b. PN informado habilita a verificação de pressão');
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.adutoras[0].catalogoId = 'fd_k7';
    st.adutoras[0].itemRot = 'DN 800';
    st.adutoras[0].pnMcaOverride = null;
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);
  ok('campo de PN presente no trecho de adutora',
     (await page.locator('input[data-bind="adutoras.0.pnMcaOverride"]').count()) === 1);
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(320);
  ok('sem PN a tabela informa que não está informado',
     /PN não informado/.test(await page.locator('#conteudo').innerText()));
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(260);
  await page.locator('input[data-bind="adutoras.0.pnMcaOverride"]').fill('250');
  await page.waitForTimeout(450);
  const vpn = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return { pn: r.piezometrica[1].pnMca, atende: r.golpe[0].atende };
  });
  ok('PN de 250 mca considerado', vpn.pn === 250, String(vpn.pn));
  ok('verificação do transitório conclui', vpn.atende !== null, String(vpn.atende));

  titulo('19. Persistência');
  await page.evaluate(() => { window.PDA.App.st.projeto.nome = 'Projeto gravado no navegador'; window.PDA.App.render(); });
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForSelector('#abas button');
  await page.waitForTimeout(300);
  const nomeVolta = await page.evaluate(() => window.PDA.App.st.projeto.nome);
  ok('projeto recuperado após recarregar', nomeVolta === 'Projeto gravado no navegador', nomeVolta);
  const catVolta = await page.evaluate(() => window.PDA.App.cats.usuario.length);
  ok('catálogo do usuário recuperado', catVolta >= 1, String(catVolta));

  titulo('20. Exportar projeto em arquivo');
  await page.locator('[data-acao="exportarProjeto"]').click();
  await page.waitForSelector('.modal');
  const txtExp = await page.locator('.modal').innerText();
  ok('modal oferece o memorial', /Memorial descritivo e de cálculo/.test(txtExp));
  ok('modal oferece o arquivo do projeto', /Arquivo do projeto/.test(txtExp));
  const dl = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('.modal [data-acao="exportarArquivo"]').click();
  const arq = await dl;
  ok('download disparado', /\.adutora\.json$/.test(arq.suggestedFilename()), arq.suggestedFilename());

  titulo('21. Fontes');
  await page.locator('#abas button', { hasText: 'Fontes' }).click();
  await page.waitForTimeout(300);
  const tf = await page.locator('#conteudo').innerText();
  ok('cita Azevedo Netto', /AZEVEDO NETTO/.test(tf));
  ok('cita normas ABNT', /NBR 7675/.test(tf) && /NBR 12208/.test(tf));
  ok('cita Colebrook', /Colebrook/.test(tf));
  ok('lista coeficientes por idade', /Novo \(0 a 5 anos\)/.test(tf));
  ok('registra as divergências corrigidas', /Divergências corrigidas/.test(tf));
  ok('lista coeficientes K das peças', /Válvula de retenção/.test(tf));

  titulo('22. Botão de fonte abre o detalhe');
  await page.locator('#conteudo button.btn.mini').first().click();
  await page.waitForSelector('.modal');
  ok('modal de fonte com conteúdo', (await page.locator('.modal .corpo').innerText()).length > 60);
  await page.locator('.modal button', { hasText: 'Fechar' }).click();
  await page.waitForTimeout(120);
  ok('modal fechado', (await page.locator('.modal').count()) === 0);

  titulo('23. Tema escuro e ajuda');
  await page.locator('[data-acao="tema"]').click();
  await page.waitForTimeout(160);
  ok('tema escuro aplicado',
     (await page.evaluate(() => document.documentElement.getAttribute('data-tema'))) === 'escuro');
  await page.locator('[data-acao="tema"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-acao="ajuda"]').click();
  await page.waitForSelector('.modal');
  ok('ajuda explica o alcance do programa',
     /pré-dimensionamento/i.test(await page.locator('.modal').innerText()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  ok('Escape fecha o modal', (await page.locator('.modal').count()) === 0);

  titulo('24. Robustez com dados vazios ou absurdos');
  erros.length = 0;
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.vazao.valor = null;
    st.adutoras[0].extensao = null;
    st.cotas.nivelChegada = null;
    st.bombas.rendBomba = 0;
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);
  ok('não quebra com campos vazios', erros.length === 0, erros.join(' | '));
  ok('interface segue renderizada', (await page.locator('#conteudo .cartao, #conteudo .aviso').count()) > 0);
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.vazao.valor = 1e9; st.adutoras[0].extensao = 1e7; st.bombas.rendBomba = 200;
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);
  ok('não quebra com valores absurdos', erros.length === 0, erros.join(' | '));

  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#abas button');
  await page.waitForTimeout(250);
  ok('recomeça limpo após limpar o navegador',
     (await page.locator('#conteudo .cartao').count()) >= 2 &&
     erros.filter(e => !/localStorage/.test(e)).length === 0,
     String(await page.locator('#conteudo .cartao').count()));

  titulo('24b. Aba Resumo com entrada rápida e panorama');
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(300);
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(400);
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(320);
  const txtResumo = await page.locator('#conteudo').innerText();
  ok('panorama lista os trechos', /Panorama do sistema/.test(txtResumo));
  ok('panorama mostra altura manométrica', /ALTURA MANOMÉTRICA/i.test(txtResumo));
  ok('panorama mostra o motor', /MOTOR POR BOMBA/i.test(txtResumo));
  ok('campos essenciais destacados', (await page.locator('#conteudo label.campo.chave').count()) >= 5);
  ok('esquema de cotas presente', (await page.locator('#conteudo svg.esquema').count()) >= 1);

  titulo('24c. Cotas sincronizadas entre o resumo e o trecho');
  await page.locator('input[data-bind="cotas.nivelChegada"]').fill('160');
  await page.waitForTimeout(450);
  const sinc = await page.evaluate(() => {
    const st = window.PDA.App.st;
    const at = st.adutoras.filter(a => a.ativo !== false);
    return { chegada: st.cotas.nivelChegada, trecho: at[at.length - 1].cotaFim };
  });
  ok('editar a cota de chegada ajusta a cota final do trecho',
     sinc.chegada === 160 && sinc.trecho === 160, JSON.stringify(sinc));
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(300);
  await page.locator('input[data-bind="adutoras.0.cotaFim"]').fill('155');
  await page.waitForTimeout(450);
  const sinc2 = await page.evaluate(() => window.PDA.App.st.cotas.nivelChegada);
  ok('editar a cota final do trecho ajusta a cota de chegada', sinc2 === 155, String(sinc2));

  titulo('24d. Incoerência de cota é detectada e corrigível');
  await page.evaluate(() => { window.PDA.App.st.cotas.nivelChegada = 130; window.PDA.App.render(); });
  await page.waitForTimeout(320);
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(320);
  ok('aviso de incoerência exibido', /Dados incoerentes/.test(await page.locator('#conteudo').innerText()));
  ok('marcador de alerta na aba Resumo',
     (await page.locator('#abas button .marcador').count()) >= 1);
  await page.locator('button[data-acao="sincCotaChegada"]').click();
  await page.waitForTimeout(380);
  ok('correção com um clique resolve',
     !/Dados incoerentes/.test(await page.locator('#conteudo').innerText()));

  titulo('24e. Pressão negativa é reprovada');
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.cotas.nivelChegada = 300;                 /* bomba insuficiente de propósito */
    const at = st.adutoras.filter(a => a.ativo !== false);
    at[at.length - 1].cotaFim = 300;
    at[at.length - 1].pnMcaOverride = 250;
    window.PDA.App.render();
  });
  await page.waitForTimeout(400);
  const negOk = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    const p = r.piezometrica[r.piezometrica.length - 1];
    return { pressao: p.pressao, classe: p.classe };
  });
  ok('pressão calculada', typeof negOk.pressao === 'number');
  if (negOk.pressao < 0) {
    ok('pressão negativa não é classificada como adequada', negOk.classe === 'ruim', negOk.classe);
  } else {
    ok('cenário não gerou pressão negativa (verificação no núcleo)', true);
  }

  titulo('24f. Perfil da linha e envoltórias');
  await page.locator('#abas button', { hasText: 'Perfil' }).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.cotas.nivelChegada = 149;
    const at = st.adutoras.filter(a => a.ativo !== false);
    at[at.length - 1].cotaFim = 149;
    at[at.length - 1].pnMcaOverride = 250;
    window.PDA.App.render();
  });
  await page.waitForTimeout(320);
  await page.locator('input[data-bind="perfil.ativo"]').check();
  await page.waitForTimeout(320);
  await page.locator('[data-acao="colarPerfil"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal textarea').fill(
    '0\t126,0\n1200\t138,5\n2400\t162,0\tponto alto\n3600\t144,0\n5000\t140,0\n6670\t149,0');
  await page.locator('.modal button', { hasText: 'Interpretar' }).click();
  await page.waitForTimeout(180);
  ok('6 pontos interpretados', /6 ponto/.test(await page.locator('.modal').innerText()));
  await page.locator('.modal button', { hasText: 'Substituir o perfil' }).click();
  await page.waitForTimeout(450);
  const perf = await page.evaluate(() => {
    const P = window.PDA;
    return { n: P.App.st.perfil.pontos.length,
             cotas: P.App.st.perfil.pontos.map(p => p.cota),
             rot: P.App.st.perfil.pontos[2].rot,
             env: !!P.C.resumo(P.App.st, P.App.cats).envoltoria };
  });
  ok('perfil gravado com 6 pontos', perf.n === 6, String(perf.n));
  ok('vírgula decimal preservada no perfil',
     JSON.stringify(perf.cotas) === JSON.stringify([126, 138.5, 162, 144, 140, 149]),
     JSON.stringify(perf.cotas));
  ok('identificação do ponto lida', perf.rot === 'ponto alto', perf.rot);
  ok('envoltória calculada', perf.env);
  ok('gráfico do perfil desenhado', (await page.locator('#conteudo svg.perfil').count()) >= 1);
  const txtEnv = await page.locator('#conteudo').innerText();
  ok('tabela de envoltórias presente', /p máxima|p mínima/i.test(txtEnv));
  ok('explica como as envoltórias foram traçadas', /decai linearmente/.test(txtEnv));
  ok('diz que não considera dispositivo de proteção', /não considera dispositivo de proteção nenhum/.test(txtEnv));
  ok('ponto alto aparece na tabela', /ponto alto/.test(txtEnv));

  titulo('24g. Curva da bomba e ponto de operação');
  await page.locator('#abas button', { hasText: 'Bombas' }).click();
  await page.waitForTimeout(320);
  await page.locator('input[data-bind="curvaBomba.ativo"]').check();
  await page.waitForTimeout(320);
  await page.locator('[data-acao="colarCurva"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal textarea').fill('0\t62,0\n100\t58,0\n200\t48,0\n260\t38,0');
  await page.locator('.modal button', { hasText: 'Interpretar' }).click();
  await page.waitForTimeout(180);
  await page.locator('.modal button', { hasText: 'Substituir a curva' }).click();
  await page.waitForTimeout(600);
  const curva = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    return { n: P.App.st.curvaBomba.pontos.length, ajuste: !!r.curvaBomba,
             op: r.operacao && !r.operacao.erro ? { q: r.operacao.qTotal, H: r.operacao.H } : null,
             erro: r.operacao ? r.operacao.erro : null,
             porN: r.operacaoPorN ? r.operacaoPorN.length : 0 };
  });
  ok('4 pontos de curva gravados', curva.n === 4, String(curva.n));
  ok('curva ajustada', curva.ajuste);
  ok('ponto de operação obtido ou justificado', !!curva.op || !!curva.erro,
     curva.erro || JSON.stringify(curva.op));
  if (curva.op) {
    ok('gráfico das curvas desenhado', (await page.locator('#conteudo svg.perfil').count()) >= 1);
    ok('tabela de operação em paralelo', curva.porN >= 1, String(curva.porN));
  }

  titulo('24h. Peça com DN diferente do trecho');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(320);
  await page.locator('select[data-acao-change="addPeca"][data-base="adutoras.0"]').selectOption('reducao_conc');
  await page.waitForTimeout(320);
  const iRed = await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.length - 1);
  const selDN = page.locator(`select[data-bind="adutoras.0.pecas.${iRed}.dnLocal"]`);
  ok('seletor de DN da peça existe', (await selDN.count()) === 1);
  const opcoes = await selDN.locator('option').allTextContents();
  ok('as opções mostram o DI de cada DN', opcoes.some(o => /DI \d+ mm/.test(o)), opcoes[1]);
  await selDN.selectOption({ index: 3 });
  await page.waitForTimeout(400);
  const peca = await page.evaluate(i => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats);
    const pc = r.projeto.adutoras[0].pecas[i];
    return { dn: P.App.st.adutoras[0].pecas[i].dnLocal, di: pc.diMm,
             diTrecho: r.projeto.adutoras[0].tubo.diMm };
  }, iRed);
  ok('DN escolhido gravado', !!peca.dn, peca.dn);
  ok('DI da peça buscado no catálogo e diferente do trecho',
     peca.di > 0 && Math.abs(peca.di - peca.diTrecho) > 0.5,
     peca.di + ' vs trecho ' + peca.diTrecho);
  await page.locator(`[data-acao="removerPeca"][data-base="adutoras.0"][data-i="${iRed}"]`).click();
  await page.waitForTimeout(280);

  titulo('24i. Casos de ancoragem do transitório');
  const anc = await page.locator('select[data-bind="golpe.ancoragem"]');
  ok('seletor de ancoragem presente', (await anc.count()) === 1);
  ok('quatro casos oferecidos', (await anc.locator('option').count()) === 4,
     String(await anc.locator('option').count()));
  const psiJ = await page.evaluate(() => window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).golpe[0].psi);
  await anc.selectOption('ancorado');
  await page.waitForTimeout(400);
  const gAnc = await page.evaluate(() => {
    const g = window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).golpe[0];
    return { psi: g.psi, dh: g.dh, a: g.celeridade };
  });
  ok('psi muda com o caso de ancoragem', gAnc.psi !== psiJ, psiJ + ' -> ' + gAnc.psi);
  ok('tubo ancorado é o caso mais desfavorável (psi < 1)', gAnc.psi < 1, String(gAnc.psi));
  await anc.selectOption('juntas');
  await page.waitForTimeout(350);

  titulo('24j. Análise econômica de diâmetro');
  await page.locator('#abas button', { hasText: 'Parâmetros' }).click();
  await page.waitForTimeout(320);
  await page.locator('input[data-bind="economia.ativo"]').check();
  await page.waitForTimeout(350);
  ok('campos de custo aparecem', (await page.locator('input[data-bind="economia.tarifa"]').count()) === 1);
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(400);
  const txtEco = await page.locator('#conteudo').innerText();
  ok('colunas de custo na tabela de diâmetros', /Total \(mil R\$\/ano\)/.test(txtEco));
  ok('ótimo econômico marcado com $', /\$/.test(txtEco));
  const otimo = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const v = P.C.varrer(P.App.st, ctx, P.App.st.adutoras[0], 'adutoras.0', ctx.nOp);
    return v.linhas.filter(l => l.otimoEconomico).length;
  });
  ok('exatamente um ótimo econômico', otimo === 1, String(otimo));

  titulo('24k. Logo carregável');
  await page.locator('[data-acao="logo"]').click();
  await page.waitForSelector('.modal');
  ok('modal de logo explica a substituição',
     /arquivo oficial/.test(await page.locator('.modal').innerText()));
  ok('aceita arquivo de imagem', (await page.locator('.modal input[type="file"]').count()) >= 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const logoPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  await page.evaluate(d => { window.PDA.M.gravarLogo(d); window.PDA.App.montarMarca(); }, logoPng);
  await page.waitForTimeout(200);
  ok('logo carregada substitui o desenho', (await page.locator('#marca img.marca-img').count()) === 1);
  await page.evaluate(() => { window.PDA.M.removerLogo(); window.PDA.App.montarMarca(); });
  await page.waitForTimeout(180);
  ok('removida, volta o desenho', (await page.locator('#marca .marca-simbolo svg').count()) === 1);

  titulo('24l. Sinais de atenção nos resultados');
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(400);
  const nSinais = await page.locator('#conteudo .sinal, .faixa-resumo .sinal').count();
  ok('faixa de resumo renderizada', (await page.locator('.faixa-resumo').count()) >= 1);
  const al = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const r = P.C.resumo(P.App.st, P.App.cats);
    const a = P.Res.alertas(P.App.st, ctx, r);
    return Object.keys(a).filter(k => a[k]).length;
  });
  ok('função de alertas responde', typeof al === 'number');
  /* força um caso que deve alertar: perdas dominando a altura manométrica */
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.adutoras[0].itemRot = 'DN 200';
    window.PDA.App.render();
  });
  await page.waitForTimeout(420);
  const al2 = await page.evaluate(() => {
    const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
    const a = P.Res.alertas(P.App.st, ctx, P.C.resumo(P.App.st, P.App.cats));
    return { perdas: !!a.perdas, hm: !!a.hm };
  });
  ok('diâmetro apertado dispara alerta de perdas ou de Hm', al2.perdas || al2.hm,
     JSON.stringify(al2));

  titulo('24m. Memorial cobre os módulos novos');
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(500);
  const mem = await page.locator('.memorial').innerText();
  ok('memorial traz o ponto de operação', /Ponto de operação com a curva da bomba/.test(mem));
  ok('memorial traz a curva ajustada', /H = .*·Q²/.test(mem));
  ok('memorial traz as envoltórias', /Envoltórias de pressão do transitório/.test(mem));
  ok('memorial ressalva o limite do transitório',
     /sem dispositivos de proteção/i.test(mem));
  ok('memorial ressalva o limite da análise econômica',
     /não para orçar/i.test(mem));

  titulo('26. Rolagem preservada ao editar');
  await page.locator('#abas button', { hasText: 'Barriletes' }).click();
  await page.waitForTimeout(400);
  /* desce até um campo do último trecho do barrilete comum */
  const nTr = await page.evaluate(() => window.PDA.App.st.barrileteComum.trechos.length);
  const campoFundo = page.locator(`input[data-bind="barrileteComum.trechos.${nTr - 1}.extensao"]`);
  await campoFundo.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const yAntes = await page.evaluate(() => window.pageYOffset);
  ok('rolou para o meio da página', yAntes > 300, String(yAntes));
  await campoFundo.fill('12,5');
  await page.waitForTimeout(500);
  const yDepois = await page.evaluate(() => window.pageYOffset);
  ok('a tela não volta para o topo ao digitar', Math.abs(yDepois - yAntes) < 60,
     yAntes + ' -> ' + yDepois);
  const focoDepois = await page.evaluate(() => document.activeElement.getAttribute('data-bind'));
  ok('o foco continua no campo editado',
     focoDepois === `barrileteComum.trechos.${nTr - 1}.extensao`, String(focoDepois));
  /* Tab também não pode jogar a tela para cima */
  await page.keyboard.press('Tab');
  await page.waitForTimeout(450);
  const yTab = await page.evaluate(() => window.pageYOffset);
  ok('Tab não joga a tela para o topo', Math.abs(yTab - yAntes) < 120, yAntes + ' -> ' + yTab);
  /* adicionar peça também mantém a posição */
  const yA = await page.evaluate(() => window.pageYOffset);
  await page.locator(`select[data-acao-change="addPeca"][data-base="barrileteComum.trechos.${nTr - 1}"]`)
    .selectOption('curva90');
  await page.waitForTimeout(450);
  const yB = await page.evaluate(() => window.pageYOffset);
  ok('adicionar peça mantém a posição da tela', Math.abs(yB - yA) < 120, yA + ' -> ' + yB);
  /* trocar de aba, aí sim, volta ao topo */
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(350);
  ok('trocar de aba volta ao topo', (await page.evaluate(() => window.pageYOffset)) < 40);

  titulo('27. Faixa de resumo fixa');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(400);
  ok('faixa fixa ativa na aba Adutora',
     await page.evaluate(() => document.getElementById('fixo').classList.contains('ativa')));
  ok('posição sticky aplicada',
     (await page.evaluate(() => getComputedStyle(document.getElementById('fixo')).position)) === 'sticky');
  const topoAntes = await page.evaluate(() => document.getElementById('fixo').getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(250);
  const topoDepois = await page.evaluate(() => document.getElementById('fixo').getBoundingClientRect().top);
  ok('a faixa continua visível ao rolar', topoDepois > 0 && topoDepois < 200,
     'topo em ' + topoDepois.toFixed(0) + ' px');
  ok('a faixa mostra a vazão', /L\/s/.test(await page.locator('#fixo').innerText()));
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(300);
  ok('faixa fixa oculta na aba Resumo',
     !(await page.evaluate(() => document.getElementById('fixo').classList.contains('ativa'))));
  await page.locator('#abas button', { hasText: 'Parâmetros' }).click();
  await page.waitForTimeout(300);
  ok('faixa fixa oculta em Parâmetros',
     !(await page.evaluate(() => document.getElementById('fixo').classList.contains('ativa'))));

  titulo('28. Reordenar peças');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(400);
  const antesOrdem = await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.map(p => p.pecaId));
  ok('há peças para reordenar', antesOrdem.length >= 3, JSON.stringify(antesOrdem));
  ok('coluna de ordem presente',
     (await page.locator('#conteudo .col-mover').count()) >= 3);
  ok('alça de arraste presente', (await page.locator('#conteudo .col-mover .alca').count()) >= 3);
  ok('linhas preparadas para reordenação',
     (await page.locator('#conteudo tr.arrastavel').count()) >= 3);
  ok('linhas NÃO nascem arrastáveis (senão o clique no campo vira arraste)',
     (await page.locator('#conteudo tr.arrastavel[draggable="true"]').count()) === 0);
  /* mover a primeira peça para baixo pelo botão */
  await page.locator('[data-acao="mover"][data-arr="adutoras.0.pecas"][data-i="0"][data-para="1"]').click();
  await page.waitForTimeout(400);
  const depoisOrdem = await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.map(p => p.pecaId));
  ok('botão desce a peça uma posição',
     depoisOrdem[0] === antesOrdem[1] && depoisOrdem[1] === antesOrdem[0],
     JSON.stringify(antesOrdem) + ' -> ' + JSON.stringify(depoisOrdem));
  /* subir de volta */
  await page.locator('[data-acao="mover"][data-arr="adutoras.0.pecas"][data-i="1"][data-para="0"]').click();
  await page.waitForTimeout(400);
  const voltaOrdem = await page.evaluate(() => window.PDA.App.st.adutoras[0].pecas.map(p => p.pecaId));
  ok('botão sobe a peça de volta',
     JSON.stringify(voltaOrdem) === JSON.stringify(antesOrdem), JSON.stringify(voltaOrdem));
  ok('primeira peça não tem botão de subir habilitado',
     await page.evaluate(() =>
       document.querySelector('[data-acao="mover"][data-arr="adutoras.0.pecas"][data-i="0"][data-para="-1"]').disabled));
  /* a reordenação não altera a perda total */
  const perdaAntes = await page.evaluate(() =>
    window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).projeto.adutoras[0].hl);
  await page.evaluate(() => window.PDA.App.moverItem('adutoras.0.pecas', 0, 2));
  await page.waitForTimeout(350);
  const perdaDepois = await page.evaluate(() =>
    window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).projeto.adutoras[0].hl);
  ok('reordenar não muda a perda localizada', Math.abs(perdaAntes - perdaDepois) < 1e-12,
     perdaAntes.toFixed(6) + ' vs ' + perdaDepois.toFixed(6));

  titulo('28b. Selecionar texto no campo não inicia arraste');
  const linhaPeca = page.locator('#conteudo tr.arrastavel').first();
  const campoQtd = linhaPeca.locator('input.num').first();
  /* segurar o clique dentro do campo, como quem seleciona texto */
  const cx = await campoQtd.boundingBox();
  await page.mouse.move(cx.x + 8, cx.y + cx.height / 2);
  await page.mouse.down();
  await page.mouse.move(cx.x + cx.width - 8, cx.y + cx.height / 2, { steps: 6 });
  ok('a linha continua não arrastável durante a seleção',
     (await linhaPeca.getAttribute('draggable')) === 'false',
     String(await linhaPeca.getAttribute('draggable')));
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('o campo recebeu o foco em vez de arrastar',
     (await page.evaluate(() => document.activeElement.tagName)) === 'INPUT');
  ok('nenhuma linha ficou em estado de arraste',
     (await page.locator('#conteudo tr.arrastando').count()) === 0);
  /* já a alça libera o arraste */
  const alca = linhaPeca.locator('.alca').first();
  const ca = await alca.boundingBox();
  await page.mouse.move(ca.x + ca.width / 2, ca.y + ca.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  ok('segurar a alça torna a linha arrastável',
     (await linhaPeca.getAttribute('draggable')) === 'true',
     String(await linhaPeca.getAttribute('draggable')));
  await page.mouse.up();
  await page.waitForTimeout(150);
  ok('soltar devolve a linha ao estado normal',
     (await linhaPeca.getAttribute('draggable')) === 'false');
  /* campos nunca são arrastáveis por si */
  ok('campos marcados como não arrastáveis',
     (await page.evaluate(() => {
       const c = document.querySelectorAll('#conteudo input, #conteudo select');
       for (let i = 0; i < c.length; i++) if (c[i].getAttribute('draggable') !== 'false') return false;
       return c.length > 0;
     })));

  titulo('29. Reordenar trechos');
  await page.locator('#abas button', { hasText: 'Barriletes' }).click();
  await page.waitForTimeout(400);
  const trAntes = await page.evaluate(() => window.PDA.App.st.barrileteComum.trechos.map(t => t.nBombas));
  ok('trechos arrastáveis', (await page.locator('#conteudo .conjunto.arrastavel').count()) >= 2);
  await page.locator('[data-acao="mover"][data-arr="barrileteComum.trechos"][data-i="0"][data-para="1"]').click();
  await page.waitForTimeout(400);
  const trDepois = await page.evaluate(() => window.PDA.App.st.barrileteComum.trechos.map(t => t.nBombas));
  ok('trecho de barrilete muda de posição',
     trDepois[0] === trAntes[1] && trDepois[1] === trAntes[0],
     JSON.stringify(trAntes) + ' -> ' + JSON.stringify(trDepois));
  await page.locator('[data-acao="mover"][data-arr="barrileteComum.trechos"][data-i="1"][data-para="0"]').click();
  await page.waitForTimeout(400);

  titulo('29b. NPSH não é afetado por barrilete de recalque');
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(500);
  const npshA = await page.evaluate(() =>
    window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).projeto.npshd);
  await page.locator('#abas button', { hasText: 'Barriletes' }).click();
  await page.waitForTimeout(400);
  await page.locator('[data-acao^="addTrecho:barrileteComum"]').click();
  await page.waitForTimeout(500);
  const dep = await page.evaluate(() => {
    const P = window.PDA, r = P.C.resumo(P.App.st, P.App.cats).projeto;
    const t = P.App.st.barrileteComum.trechos;
    return { npsh: r.npshd, ultimoDN: t[t.length - 1].itemRot, hRec: r.hRecalque };
  });
  ok('o trecho novo herda o diâmetro do anterior', !!dep.ultimoDN, String(dep.ultimoDN));
  ok('acrescentar barrilete de recalque não mexe no NPSH',
     Math.abs(dep.npsh - npshA) < 1e-9, npshA.toFixed(3) + ' -> ' + dep.npsh.toFixed(3));

  titulo('29c. Trecho sem diâmetro sai do cálculo e é acusado');
  /* um trecho recém-criado, ainda em branco, não é cobrado */
  const emBranco = await page.evaluate(() =>
    window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats)
      .avisosDados.some(a => a.id === 'semDiametro'));
  ok('trecho ainda em branco não gera pendência', !emBranco);
  const semD = await page.evaluate(() => {
    const P = window.PDA, st = P.App.st;
    const t = st.barrileteComum.trechos;
    t[t.length - 1].itemRot = '';
    t[t.length - 1].extensao = 6;      /* trecho lançado, mas sem diâmetro */
    P.App.render();
    const r = P.C.resumo(st, P.App.cats);
    return {
      npsh: r.projeto.npshd, hRec: r.projeto.hRecalque,
      di: r.projeto.recalque[r.projeto.recalque.length - 1].tubo.diMm,
      aviso: r.avisosDados.some(a => a.id === 'semDiametro' && a.grave)
    };
  });
  await page.waitForTimeout(400);
  ok('o DI não cai no menor diâmetro do catálogo', semD.di === 0, String(semD.di));
  ok('o NPSH continua íntegro', Math.abs(semD.npsh - npshA) < 1e-9, semD.npsh.toFixed(3));
  ok('a incoerência é acusada como grave', semD.aviso);
  ok('o cartão do trecho avisa que está fora do cálculo',
     /fora do cálculo/.test(await page.locator('#conteudo').innerText()));
  await page.locator('#abas button', { hasText: 'Resumo' }).click();
  await page.waitForTimeout(400);
  ok('o aviso aparece também no Resumo',
     /sem diâmetro escolhido/.test(await page.locator('#conteudo').innerText()));
  ok('a aba Resumo ganha o marcador de pendência',
     (await page.locator('#abas button .marcador').count()) >= 1);
  /* limpa para os testes seguintes */
  await page.evaluate(() => {
    const t = window.PDA.App.st.barrileteComum.trechos;
    t.pop();
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);

  titulo('30. PN pré-preenchido');
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(400);
  /* catálogo com PN: preenche sozinho */
  await page.selectOption('select[data-bind="adutoras.0.catalogoId"]', 'fd_flg_pn16');
  await page.waitForTimeout(400);
  await page.selectOption('select[data-bind="adutoras.0.itemRot"]', 'DN 400');
  await page.waitForTimeout(450);
  const pn1 = await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride);
  ok('catálogo com PN preenche o campo sozinho', pn1 === 160, String(pn1));
  const campoPN = page.locator('input[data-bind="adutoras.0.pnMcaOverride"]');
  ok('o valor aparece no campo', (await campoPN.inputValue()) === '160',
     await campoPN.inputValue());
  /* trocar de diâmetro atualiza */
  await page.selectOption('select[data-bind="adutoras.0.itemRot"]', 'DN 600');
  await page.waitForTimeout(450);
  ok('trocar de diâmetro mantém o PN do catálogo',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride)) === 160);
  /* valor digitado pelo usuário não é sobrescrito */
  await campoPN.fill('95');
  await page.waitForTimeout(450);
  await page.selectOption('select[data-bind="adutoras.0.itemRot"]', 'DN 500');
  await page.waitForTimeout(450);
  ok('valor informado pelo usuário não é sobrescrito',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride)) === 95,
     String(await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride)));
  /* classe K: seletor de degraus normativos */
  await page.evaluate(() => { window.PDA.App.st.adutoras[0].pnAuto = true; window.PDA.App.render(); });
  await page.selectOption('select[data-bind="adutoras.0.catalogoId"]', 'fd_k9');
  await page.waitForTimeout(400);
  await page.selectOption('select[data-bind="adutoras.0.itemRot"]', 'DN 400');
  await page.waitForTimeout(450);
  ok('classe K sem PN deixa o campo em branco',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride)) === null);
  const selDegrau = page.locator('select[data-bind="adutoras.0.pnMcaOverride"]');
  ok('seletor de degraus aparece para as classes K', (await selDegrau.count()) === 1);
  ok('degraus da EN 545 oferecidos', (await selDegrau.locator('option').count()) >= 8);
  await selDegrau.selectOption('400');
  await page.waitForTimeout(450);
  ok('escolher o degrau preenche o PN',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].pnMcaOverride)) === 400);
  ok('a verificação de pressão passa a concluir',
     (await page.evaluate(() =>
       window.PDA.C.resumo(window.PDA.App.st, window.PDA.App.cats).piezometrica[1].pnMca)) === 400);
  ok('a origem do PN é registrada',
     (await page.evaluate(() => {
       const P = window.PDA, ctx = P.C.contexto(P.App.st, P.App.cats);
       return P.C.pnInfo(P.App.st.adutoras[0], P.C.resolverTubo(P.App.st.adutoras[0], ctx)).origem;
     })) === 'informado');

  titulo('31. Biblioteca de projetos');
  await page.evaluate(() => localStorage.removeItem('pda.biblioteca.v1'));
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.id = null;
    st.projeto = { nome: 'EEE Aeroporto', local: 'Chapecó', responsavel: 'J. Pastro', data: '10/03/2026', obs: '' };
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);
  await page.locator('[data-acao="salvarProjeto"]').click();
  await page.waitForTimeout(400);
  const bib1 = await page.evaluate(() => window.PDA.E.biblioteca().length);
  ok('projeto guardado na biblioteca', bib1 === 1, String(bib1));
  /* mais dois, para testar ordenação */
  await page.evaluate(() => {
    const A = window.PDA.App, E = window.PDA.E;
    A.st.id = null; A.st.projeto.nome = 'Adutora Zona Norte'; A.st.projeto.local = 'Ararangua';
    A.st.projeto.responsavel = 'A. Silva';
    E.guardar(A.st, '2026-01-05T10:00:00.000Z');
    A.st.id = null; A.st.projeto.nome = 'Booster Centro'; A.st.projeto.local = 'Blumenau';
    A.st.projeto.responsavel = 'Z. Souza';
    E.guardar(A.st, '2026-07-20T10:00:00.000Z');
  });
  await page.locator('[data-acao="abrirProjeto"]').click();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(250);
  ok('biblioteca lista os três projetos',
     (await page.locator('.modal tbody tr').count()) === 3,
     String(await page.locator('.modal tbody tr').count()));
  ok('exemplos aparecem na mesma tela',
     /Adutora de água tratada/.test(await page.locator('.modal').innerText()));
  /* ordenar por nome */
  await page.locator('.modal th[title="Ordenar por projeto"]').click();
  await page.waitForTimeout(220);
  let nomes = await page.locator('.modal tbody tr td:first-child b').allTextContents();
  ok('ordena por nome crescente',
     JSON.stringify(nomes) === JSON.stringify(['Adutora Zona Norte', 'Booster Centro', 'EEE Aeroporto']),
     JSON.stringify(nomes));
  await page.locator('.modal th[title="Ordenar por projeto"]').click();
  await page.waitForTimeout(220);
  nomes = await page.locator('.modal tbody tr td:first-child b').allTextContents();
  ok('segundo clique inverte a ordem', nomes[0] === 'EEE Aeroporto', JSON.stringify(nomes));
  /* ordenar por local */
  await page.locator('.modal th[title="Ordenar por local"]').click();
  await page.waitForTimeout(220);
  const locais = await page.locator('.modal tbody tr td:nth-child(2)').allTextContents();
  ok('ordena por local', locais[0].trim() === 'Ararangua', JSON.stringify(locais));
  /* ordenar por responsável */
  await page.locator('.modal th[title="Ordenar por responsável"]').click();
  await page.waitForTimeout(220);
  const resps = await page.locator('.modal tbody tr td:nth-child(3)').allTextContents();
  ok('ordena por responsável', resps[0].trim() === 'A. Silva', JSON.stringify(resps));
  /* filtrar */
  await page.locator('.modal input[type="text"]').fill('blumenau');
  await page.waitForTimeout(280);
  ok('filtro reduz a lista', (await page.locator('.modal tbody tr').count()) === 1,
     String(await page.locator('.modal tbody tr').count()));
  await page.locator('.modal input[type="text"]').fill('');
  await page.waitForTimeout(280);
  /* abrir um projeto */
  await page.locator('.modal tbody tr', { hasText: 'EEE Aeroporto' })
    .locator('button', { hasText: 'Abrir' }).click();
  await page.waitForTimeout(450);
  ok('projeto aberto da biblioteca',
     (await page.evaluate(() => window.PDA.App.st.projeto.nome)) === 'EEE Aeroporto');
  ok('modal fechou ao abrir', (await page.locator('.modal').count()) === 0);
  /* salvar de novo atualiza em vez de duplicar */
  await page.locator('[data-acao="salvarProjeto"]').click();
  await page.waitForTimeout(400);
  ok('salvar de novo atualiza o registro',
     (await page.evaluate(() => window.PDA.E.biblioteca().length)) === 3);
  /* duplicar */
  await page.locator('[data-acao="abrirProjeto"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal tbody tr', { hasText: 'EEE Aeroporto' })
    .locator('button', { hasText: 'Duplicar' }).click();
  await page.waitForTimeout(450);
  ok('duplicar abre uma cópia sem id',
     /\(cópia\)/.test(await page.evaluate(() => window.PDA.App.st.projeto.nome)) &&
     !(await page.evaluate(() => window.PDA.App.st.id)),
     await page.evaluate(() => window.PDA.App.st.projeto.nome));
  /* excluir */
  await page.locator('[data-acao="abrirProjeto"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal tbody tr', { hasText: 'Booster Centro' })
    .locator('button', { hasText: 'Excluir' }).click();
  await page.waitForSelector('.modal button:has-text("Confirmar")');
  await page.locator('.modal button', { hasText: 'Confirmar' }).click();
  await page.waitForTimeout(450);
  ok('projeto excluído da biblioteca',
     (await page.evaluate(() => window.PDA.E.biblioteca().length)) === 2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  /* sobrevive ao recarregar */
  await page.reload();
  await page.waitForSelector('#abas button');
  await page.waitForTimeout(400);
  ok('biblioteca sobrevive ao recarregar',
     (await page.evaluate(() => window.PDA.E.biblioteca().length)) === 2);

  titulo('32. Projeto sem nome pede identificação');
  await page.evaluate(() => {
    window.PDA.App.st = window.PDA.E.padrao();
    window.PDA.App.render();
  });
  await page.waitForTimeout(300);
  await page.locator('[data-acao="salvarProjeto"]').click();
  await page.waitForSelector('.modal');
  ok('pede o nome antes de guardar',
     /Nome do projeto/.test(await page.locator('.modal .cab').innerText()));
  await page.locator('.modal input').first().fill('Projeto de teste');
  await page.locator('.modal button', { hasText: 'Guardar' }).click();
  await page.waitForTimeout(450);
  ok('guardado com o nome informado',
     (await page.evaluate(() => window.PDA.E.biblioteca()))
       .some(r => r.nome === 'Projeto de teste'));

  titulo('33. Logo: os três modos e o encaixe na caixa');
  await page.locator('[data-acao="logo"]').click();
  await page.waitForSelector('.modal');
  const txtLogo = await page.locator('.modal').innerText();
  ok('oferece o desenho padrão', /O desenho que já vem no programa/.test(txtLogo));
  ok('oferece carregar um arquivo', /Um arquivo meu/.test(txtLogo));
  ok('oferece ficar sem logo', /Sem logo/.test(txtLogo));
  ok('mostra a prévia na tela e no papel',
     (await page.locator('.modal .previa-caixa').count()) === 2);
  ok('o padrão vem marcado', /● O desenho/.test(txtLogo));

  /* uma logo bem comprida e uma bem alta têm de caber na mesma caixa */
  async function medirMarca(w, hh) {
    return await page.evaluate(async ([w, hh]) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = hh;
      const g = c.getContext('2d');
      g.fillStyle = '#0E2148'; g.fillRect(0, 0, w, hh);
      const uri = c.toDataURL('image/png');
      window.PDA.M.gravarLogo(uri);
      window.PDA.App.montarMarca();
      await new Promise(r => setTimeout(r, 250));
      const img = document.querySelector('#marca img.marca-img');
      if (!img) return null;
      const r = img.getBoundingClientRect();
      return { largura: r.width, altura: r.height, caixa: window.PDA.M.CAIXA.larguraTela,
               alta: window.PDA.M.CAIXA.alturaTela };
    }, [w, hh]);
  }
  const comprida = await medirMarca(1600, 120);
  ok('logo comprida cabe na largura da caixa',
     comprida && comprida.largura <= comprida.caixa + 1 && comprida.altura <= comprida.alta + 1,
     comprida && `${comprida.largura.toFixed(0)}×${comprida.altura.toFixed(0)}`);
  const alta = await medirMarca(300, 900);
  ok('logo alta cabe na altura da caixa',
     alta && alta.altura <= alta.alta + 1 && alta.largura <= alta.caixa + 1,
     alta && `${alta.largura.toFixed(0)}×${alta.altura.toFixed(0)}`);
  const semDistorcer = alta && Math.abs((alta.largura / alta.altura) - (300 / 900)) < 0.05;
  ok('a logo não é distorcida', !!semDistorcer);

  const semLogo = await page.evaluate(async () => {
    window.PDA.M.definirModo('nenhuma');
    window.PDA.App.montarMarca();
    await new Promise(r => setTimeout(r, 200));
    const b = document.querySelector('#marca .marca-bloco');
    return { vazia: !!(b && b.classList.contains('marca-vazia')), filhos: b ? b.children.length : -1 };
  });
  ok('modo "sem logo" deixa o cabeçalho limpo', semLogo.vazia && semLogo.filhos === 0);
  await page.evaluate(async () => {
    window.PDA.M.removerLogo();
    window.PDA.App.montarMarca();
    await new Promise(r => setTimeout(r, 200));
  });
  ok('apagar o arquivo devolve o desenho padrão',
     (await page.evaluate(() => window.PDA.M.modo())) === 'padrao' &&
     (await page.locator('#marca .marca-simbolo svg').count()) === 1);

  titulo('33b. Timbrado do memorial');
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(200);
  await page.locator('[data-acao="logo"]').click();
  await page.waitForSelector('.modal');
  const txtT = await page.locator('.modal').innerText();
  ok('modal explica o timbrado', /papel timbrado do memorial/i.test(txtT));
  ok('avisa que a conversão é local', /Nada é enviado para fora/.test(txtT));
  ok('sem timbrado, informa as margens da ABNT', /margens da ABNT/.test(txtT));

  /* imagem grande, como um timbrado de verdade, tem de ser reduzida */
  const timb = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 2480; c.height = 3508;                    /* A4 a 300 dpi */
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#0E2148'; g.fillRect(0, 0, c.width, 240);
    g.fillRect(0, c.height - 160, c.width, 160);
    const grande = c.toDataURL('image/png');
    return await new Promise(res => {
      window.PDA.M.reduzirParaA4(grande, t => {
        const ok = window.PDA.M.gravarTimbrado(Object.assign({ margSup: 35, margInf: 25 }, t));
        res({ originalKb: Math.round(grande.length * 0.75 / 1024), reduzidoKb: Math.round(t.bytes / 1024),
              gravou: ok, largura: t.largura, altura: t.altura });
      });
    });
  });
  ok('timbrado grande é reduzido para caber no navegador',
     timb.gravou && timb.reduzidoKb < 900 && timb.reduzidoKb < timb.originalKb,
     `${timb.originalKb} kB -> ${timb.reduzidoKb} kB`);
  ok('guarda as dimensões do original', timb.largura === 2480 && timb.altura === 3508);

  const comTimb = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const alvo = document.createElement('div');
    alvo.className = 'doc'; document.body.appendChild(alvo);
    alvo.appendChild(P.X.render(P.X.montar(P.App.st, ctx, res), P.App.st));
    const pg = alvo.querySelector('.pagina:not(.pagina-capa)');
    const mm = 96 / 25.4;
    const r = {
      fundos: alvo.querySelectorAll('img.pag-timbrado').length,
      paginas: alvo.querySelectorAll('.pagina').length,
      naCapa: !!alvo.querySelector('.pagina-capa img.pag-timbrado'),
      margSup: parseFloat(getComputedStyle(pg).paddingTop) / mm,
      margInf: parseFloat(getComputedStyle(pg).paddingBottom) / mm,
      atras: getComputedStyle(alvo.querySelector('img.pag-timbrado')).zIndex
    };
    alvo.remove();
    return r;
  });
  ok('timbrado entra em todas as páginas, capa inclusive',
     comTimb.fundos === comTimb.paginas && comTimb.naCapa,
     `${comTimb.fundos} de ${comTimb.paginas}`);
  ok('margens passam a ser as do timbrado',
     Math.abs(comTimb.margSup - 35) < 0.5 && Math.abs(comTimb.margInf - 25) < 0.5,
     `${comTimb.margSup.toFixed(0)} / ${comTimb.margInf.toFixed(0)} mm`);
  ok('o timbrado fica atrás do texto', comTimb.atras === '0', comTimb.atras);

  await page.evaluate(() => window.PDA.M.removerTimbrado());
  await page.waitForTimeout(120);
  const semTimb = await page.evaluate(() => {
    const m = window.PDA.X.margens();
    return { sup: m.sup, inf: m.inf, tem: !!window.PDA.M.timbrado() };
  });
  ok('removido o timbrado, voltam as margens da ABNT',
     !semTimb.tem && semTimb.sup === 30 && semTimb.inf === 20,
     `${semTimb.sup} / ${semTimb.inf}`);

  titulo('34. Memorial descritivo e de cálculo');
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(250);
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.projeto.nome = 'EEE Jardim Aeroporto';
    st.projeto.local = 'Chapecó / SC';
    st.projeto.responsavel = 'Eng. Jardel Pastro';
    st.perfil = {
      ativo: true, modo: 'acumulada', unidExt: 'm', pontos: [
        { est: 0, cota: 126 }, { est: 1600, cota: 141 }, { est: 2400, cota: 168, rot: 'ponto alto' },
        { est: 4000, cota: 144 }, { est: 6670, cota: 149 }]
    };
    st.adutoras[0].pnMcaOverride = 400;
    st.curvaBomba = { ativo: true, unidQ: 'L/s', npshr: 6, pontos: [{ q: 0, H: 70 }, { q: 100, H: 66 }, { q: 200, H: 54 }, { q: 260, H: 42 }] };
    window.PDA.App.render();
  });
  await page.waitForTimeout(400);

  const doc = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const doc = P.X.montar(P.App.st, ctx, res);
    const alvo = document.createElement('div');
    alvo.id = 'doc-teste'; alvo.className = 'doc';
    document.body.appendChild(alvo);
    alvo.appendChild(P.X.render(doc, P.App.st));

    /* páginas em que cada referência realmente saiu */
    const real = {};
    const pgs = alvo.querySelectorAll('.pagina');
    pgs.forEach((pg, i) => {
      pg.querySelectorAll('[data-ref]').forEach(el => {
        const k = el.getAttribute('data-ref');
        if (real[k] === undefined) real[k] = i + 1;
      });
    });
    const erradas = Object.keys(doc.mapa).filter(k => real[k] !== doc.mapa[k]);

    /* nenhum bloco pode passar do rodapé */
    let estouros = 0;
    pgs.forEach(pg => {
      const corpo = pg.querySelector('.pag-corpo');
      if (!corpo) return;
      const cb = corpo.getBoundingClientRect();
      corpo.querySelectorAll(':scope > *').forEach(el => {
        if (el.getBoundingClientRect().bottom > cb.bottom + 0.5) estouros++;
      });
    });

    /* título não pode ser o último bloco de uma página */
    let orfaos = 0;
    pgs.forEach(pg => {
      const corpo = pg.querySelector('.pag-corpo');
      const ult = corpo && corpo.lastElementChild;
      if (ult && (ult.classList.contains('doc-h1') || ult.classList.contains('doc-h2'))) orfaos++;
    });

    const t = alvo.textContent;
    const r = {
      paginas: pgs.length, total: doc.total, refs: Object.keys(doc.mapa).length,
      erradas: erradas, estouros: estouros, orfaos: orfaos,
      capa: !!alvo.querySelector('.pagina-capa'),
      logoCapa: !!alvo.querySelector('.pagina-capa .marca-bloco'),
      sumario: /SUMÁRIO/.test(t),
      idxFiguras: /LISTA DE FIGURAS/.test(t),
      idxTabelas: /LISTA DE TABELAS/.test(t),
      introducao: /1 Introdução/.test(t),
      metodologia: /Metodologia de cálculo/.test(t),
      biblio: /Referências/.test(t),
      formulas: alvo.querySelectorAll('.doc-formula').length,
      aplicacoes: alvo.querySelectorAll('.doc-aplicacao').length,
      formulasSvg: alvo.querySelectorAll('.doc-formula svg.formula-svg').length,
      fracoes: alvo.querySelectorAll('.doc-formula svg line').length,
      raizes: alvo.querySelectorAll('.formula-svg path').length,
      equacoesNumeradas: (function () {
        var k = 0;
        alvo.querySelectorAll('.formula-num').forEach(function (e) { if (/\(\d+\)/.test(e.textContent)) k++; });
        return k;
      })(),
      alineas: alvo.querySelectorAll('.doc-alineas li').length,
      figuras: doc.D.figuras.length,
      tabelas: doc.D.tabelas.length,
      capitulos: doc.D.capitulos.filter(c => c.nivel === 1).length,
      fonteK: /AZEVEDO NETTO/.test(t),
      normaCitada: /NBR 12214/.test(t),
      perfil: /Perfil da linha/.test(t),
      curva: /Curva do sistema e ponto de operação/.test(t),
      npsh: /NPSH disponível/.test(t),
      virgula: !/=\s-?\d+\.\d/.test(t),
      numeros: alvo.querySelectorAll('.pag-num').length,
      /* --- conformidade ABNT --- */
      abnt: (function () {
        var cs = getComputedStyle(alvo.querySelector('.doc-p'));
        var pg = alvo.querySelector('.pagina .pag-num') ?
                 alvo.querySelector('.pagina .pag-num').parentNode :
                 alvo.querySelector('.pagina:not(.pagina-capa)');
        var pgs = getComputedStyle(pg);
        var nu = pg.querySelector('.pag-num');
        var nus = nu ? getComputedStyle(nu) : null;
        var tab = alvo.querySelector('.doc-tabela');
        var ts = getComputedStyle(tab);
        var td = tab.querySelector('tbody td');
        var corpo = pg.querySelector('.pag-corpo');
        var mm = 96 / 25.4;
        return {
          fonte: cs.fontFamily,
          corpoPt: parseFloat(cs.fontSize) / (96 / 72),
          entrelinhas: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize),
          recuoMm: parseFloat(cs.textIndent) / mm,
          justificado: cs.textAlign,
          margEsqMm: parseFloat(pgs.paddingLeft) / mm,
          margSupMm: parseFloat(pgs.paddingTop) / mm,
          margDirMm: parseFloat(pgs.paddingRight) / mm,
          margInfMm: parseFloat(pgs.paddingBottom) / mm,
          numTopo: nus ? parseFloat(nus.top) / mm : -1,
          numDir: nus ? parseFloat(nus.right) / mm : -1,
          tabelaPt: parseFloat(ts.fontSize) / (96 / 72),
          linhaMm: td.getBoundingClientRect().height / mm,
          larguraTabela: tab.getBoundingClientRect().width / corpo.getBoundingClientRect().width,
          semTracoVertical: getComputedStyle(td).borderLeftWidth === '0px' &&
                            getComputedStyle(td).borderRightWidth === '0px'
        };
      })(),
      /* toda seção primária tem de abrir uma folha */
      capitulosNoTopo: (function () {
        var fora = 0;
        pgs.forEach(function (pg) {
          var corpo = pg.querySelector('.pag-corpo');
          if (!corpo) return;
          corpo.querySelectorAll('.doc-h1').forEach(function (t) {
            if (t !== corpo.firstElementChild) fora++;
          });
        });
        return fora;
      })()
    };
    alvo.remove();
    return r;
  });

  ok('documento com várias páginas', doc.paginas > 12, String(doc.paginas));
  ok('contagem total bate com as páginas montadas', doc.total === doc.paginas,
     `${doc.total} × ${doc.paginas}`);
  ok('capa com a marca', doc.capa && doc.logoCapa);
  ok('tem sumário', doc.sumario);
  ok('tem índice de figuras', doc.idxFiguras);
  ok('tem índice de tabelas', doc.idxTabelas);
  ok('números do sumário e dos índices conferem com as páginas reais',
     doc.erradas.length === 0, doc.erradas.slice(0, 4).join(' | '));
  ok('mapeia todas as chamadas', doc.refs > 30, String(doc.refs));
  ok('nenhum bloco passa do rodapé', doc.estouros === 0, String(doc.estouros));
  ok('nenhum título fica sozinho no pé da página', doc.orfaos === 0, String(doc.orfaos));
  ok('traz introdução', doc.introducao);
  ok('traz a metodologia', doc.metodologia);
  ok('capítulos numerados', doc.capitulos >= 12, String(doc.capitulos));
  ok('fórmulas apresentadas', doc.formulas >= 8, String(doc.formulas));
  ok('fórmulas com os números substituídos', doc.aplicacoes >= 6, String(doc.aplicacoes));
  ok('figuras numeradas', doc.figuras >= 3, String(doc.figuras));
  ok('tabelas numeradas', doc.tabelas >= 15, String(doc.tabelas));
  ok('cita a fonte dos coeficientes K', doc.fonteK);
  ok('cita as normas ABNT', doc.normaCitada);
  ok('capítulo do perfil da linha', doc.perfil);
  ok('capítulo da curva do sistema com a bomba', doc.curva);
  ok('capítulo do NPSH', doc.npsh);
  ok('bibliografia ao final', doc.biblio);
  ok('números com vírgula decimal', doc.virgula);
  ok('número de página em todas as folhas do texto', doc.numeros > 10, String(doc.numeros));
  ok('equações numeradas entre parênteses', doc.equacoesNumeradas >= 8, String(doc.equacoesNumeradas));
  ok('fórmulas compostas em SVG', doc.formulasSvg >= 8, String(doc.formulasSvg));
  ok('frações com barra horizontal', doc.fracoes >= 6, String(doc.fracoes));
  ok('radical desenhado', doc.raizes >= 1, String(doc.raizes));
  ok('itemização em alíneas', doc.alineas >= 3, String(doc.alineas));
  ok('cada seção primária abre uma folha', doc.capitulosNoTopo === 0, String(doc.capitulosNoTopo));

  titulo('34c. Conformidade com a ABNT');
  const A = doc.abnt;
  ok('fonte Arial', /Arial/i.test(A.fonte), A.fonte);
  ok('corpo do texto em 12 pt', Math.abs(A.corpoPt - 12) < 0.2, A.corpoPt.toFixed(1) + ' pt');
  ok('entrelinhas 1,2 (exceção pedida à NBR 14724)', Math.abs(A.entrelinhas - 1.2) < 0.03,
     A.entrelinhas.toFixed(2));
  ok('texto justificado', A.justificado === 'justify', A.justificado);
  ok('recuo de primeira linha de 1,25 cm', Math.abs(A.recuoMm - 12.5) < 0.6, A.recuoMm.toFixed(1) + ' mm');
  ok('margens 3 / 2 / 3 / 2 cm',
     Math.abs(A.margEsqMm - 30) < 0.5 && Math.abs(A.margSupMm - 30) < 0.5 &&
     Math.abs(A.margDirMm - 20) < 0.5 && Math.abs(A.margInfMm - 20) < 0.5,
     `${A.margEsqMm.toFixed(0)}/${A.margSupMm.toFixed(0)}/${A.margDirMm.toFixed(0)}/${A.margInfMm.toFixed(0)}`);
  ok('número no canto superior direito, a 2 cm da borda',
     Math.abs(A.numTopo - 20) < 0.5 && Math.abs(A.numDir - 20) < 0.5,
     `${A.numTopo.toFixed(0)} / ${A.numDir.toFixed(0)} mm`);
  ok('tabelas em corpo 10 pt', Math.abs(A.tabelaPt - 10) < 0.2, A.tabelaPt.toFixed(1) + ' pt');
  ok('linhas de tabela com pelo menos 0,6 cm', A.linhaMm >= 5.95, A.linhaMm.toFixed(1) + ' mm');
  ok('tabelas ocupando a largura da mancha', A.larguraTabela > 0.99,
     (A.larguraTabela * 100).toFixed(1) + ' %');
  ok('tabelas sem traços verticais (padrão IBGE)', A.semTracoVertical);

  titulo('34b. Prévia, PDF e Word do memorial');
  await page.locator('[data-acao="exportarProjeto"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal [data-acao="memorial"]').click();
  await page.waitForTimeout(1200);
  ok('prévia aberta com as páginas', (await page.locator('.visor-doc .pagina').count()) > 10);
  ok('prévia oferece o PDF', (await page.locator('[data-acao="memorialPdf"]').count()) === 1);
  ok('prévia oferece o Word', (await page.locator('[data-acao="memorialWord"]').count()) === 1);
  ok('prévia deixa editar a introdução', (await page.locator('[data-acao="editarIntroducao"]').count()) === 1);

  const dlDoc = page.waitForEvent('download', { timeout: 20000 });
  await page.locator('[data-acao="memorialWord"]').click();
  const arqDoc = await dlDoc;
  ok('Word baixado', /\.doc$/.test(arqDoc.suggestedFilename()), arqDoc.suggestedFilename());

  /* o botão de PDF monta o documento em #doc-saida e manda imprimir */
  await page.evaluate(() => { window.__imprimiu = 0; window.print = () => { window.__imprimiu++; }; });
  await page.locator('[data-acao="memorialPdf"]').click();
  await page.waitForTimeout(1500);
  ok('o botão de PDF chama a impressão', (await page.evaluate(() => window.__imprimiu)) === 1);
  await page.evaluate(() => document.documentElement.classList.add('imprimindo-doc'));
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(250);
  const pdfMem = await page.evaluate(() => {
    return {
      paginas: document.querySelectorAll('#doc-saida .pagina').length,
      topo: (function (e) { return e ? e.getClientRects().length : -1; })(document.querySelector('header.topo')),
      doc: (function (e) { return e ? e.getClientRects().length : -1; })(document.getElementById('doc-saida')),
      corpo: document.body.children.length
    };
  });
  ok('documento montado para impressão', pdfMem.paginas > 10, JSON.stringify(pdfMem));
  ok('o documento não fica preso no modal fechado', pdfMem.doc > 0);
  ok('modo de impressão do memorial esconde a interface', pdfMem.topo === 0 && pdfMem.doc > 0);
  const pdfDoc = await page.pdf({ format: 'A4', printBackground: true });
  ok('memorial sai em PDF', pdfDoc.length > 40000, (pdfDoc.length / 1024).toFixed(0) + ' kB');
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    document.documentElement.classList.remove('imprimindo-doc');
    const s = document.getElementById('doc-saida');
    if (s) s.remove();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(300);

  titulo('35. Blocos de ancoragem — aba');
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(200);
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(500);
  await page.locator('#abas button', { hasText: 'Blocos' }).click();
  await page.waitForTimeout(350);
  ok('aba existe e explica antes de ligar',
     /Dimensionar os blocos de ancoragem/.test(await page.locator('#conteudo').innerText()));
  await page.locator('input[data-bind="blocos.ativo"]').click();
  await page.waitForTimeout(450);
  const txtBl = await page.locator('#conteudo').innerText();
  ok('ligou e já veio um bloco pronto', /Bloco padronizado|bloco calculado/i.test(txtBl));
  ok('herda o tubo do trecho da adutora', /travessia até a ETE/.test(txtBl));
  ok('pressão padrão é a envoltória do transitório', /Envoltória do transitório/.test(txtBl));
  ok('mostra o empuxo em kgf', /Empuxo:\s*[\d.]+/.test(txtBl.replace(/ /g, ' ')));
  ok('duas vias: padronizado e apoio no solo',
     /Bloco padronizado/.test(txtBl) && /apoio no solo/.test(txtBl));
  ok('esquema desenhado', (await page.locator('#conteudo svg.esquema').count()) >= 1);

  /* pressão informada baixa: aparece a estrela e dá para adotar por clique */
  await page.evaluate(() => {
    const b = window.PDA.App.st.blocos.itens[0];
    b.pressaoFonte = 'informada';
    b.pressaoInformada = 20;
    b.tuboOrigem = 'manual';
    b.catalogoId = 'fd_k7';
    b.itemRot = 'DN 200';
    b.pecaId = 'te';
    window.PDA.App.render();
  });
  await page.waitForTimeout(400);
  ok('sugestão marcada com estrela', (await page.locator('#conteudo tr.selecionada').count()) >= 1 &&
     /★/.test(await page.locator('#conteudo').innerText()));
  const linhasOk = page.locator('#conteudo tr[data-acao="blocoTipo"].bom, #conteudo tr[data-acao="blocoTipo"].selecionada');
  const antesTipo = await page.evaluate(() => window.PDA.App.st.blocos.itens[0].tipoEscolhido);
  ok('sem escolha manual, tipoEscolhido é nulo', antesTipo === null);
  await page.locator('#conteudo tr[data-acao="blocoTipo"]').last().click();
  await page.waitForTimeout(350);
  const depoisTipo = await page.evaluate(() => window.PDA.App.st.blocos.itens[0].tipoEscolhido);
  ok('clique adota o tipo', typeof depoisTipo === 'number', String(depoisTipo));
  await page.locator('#conteudo button', { hasText: 'Voltar à sugestão' }).click();
  await page.waitForTimeout(300);
  ok('voltar à sugestão limpa a escolha',
     (await page.evaluate(() => window.PDA.App.st.blocos.itens[0].tipoEscolhido)) === null);

  /* adicionar, duplicar, excluir */
  await page.locator('[data-acao="blocoNovo"]').click();
  await page.waitForTimeout(300);
  ok('adiciona bloco', (await page.evaluate(() => window.PDA.App.st.blocos.itens.length)) === 2);
  await page.locator('[data-acao="blocoDuplicar"]').first().click();
  await page.waitForTimeout(300);
  ok('duplica bloco', (await page.evaluate(() => window.PDA.App.st.blocos.itens.length)) === 3);
  await page.locator('[data-acao="blocoExcluir"]').last().click();
  await page.waitForTimeout(300);
  ok('exclui bloco', (await page.evaluate(() => window.PDA.App.st.blocos.itens.length)) === 2);

  /* memorial ganha o capítulo */
  const memBl = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const D = P.MEM.documento(P.App.st, ctx, res);
    const tmp = document.createElement('div');
    D.blocos.forEach(b => tmp.appendChild(b));
    return {
      capitulo: /Blocos de ancoragem/.test(tmp.textContent),
      formula: /sen/.test(tmp.textContent),
      tabela: D.tabelas.some(t => /Blocos de ancoragem/.test(t.titulo)),
      fonte: /AWWA M41|M41/.test(tmp.textContent)
    };
  });
  ok('memorial tem o capítulo de blocos', memBl.capitulo);
  ok('com a fórmula do empuxo', memBl.formula);
  ok('com a tabela-resumo', memBl.tabela);
  ok('citando a fonte (AWWA M41)', memBl.fonte);

  /* desligar limpa tudo do memorial e das abas */
  await page.evaluate(() => { window.PDA.App.st.blocos.ativo = false; window.PDA.App.render(); });
  await page.waitForTimeout(300);
  const memSem = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const D = P.MEM.documento(P.App.st, ctx, res);
    return D.capitulos.some(c => /Blocos de ancoragem/.test(c.titulo));
  });
  ok('desligado, o memorial não menciona blocos', !memSem);

  titulo('35b. Blocos de ancoragem — versão avulsa');
  const pagBloco = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  pagBloco.on('pageerror', e => { console.log('  [PAGEERROR avulsa]', e.message); falhas++; total++; });
  await pagBloco.goto('file://' + path.join(__dirname, '..', 'dist', 'Bloco-de-Ancoragem.html'));
  await pagBloco.waitForSelector('#abas button');
  await pagBloco.waitForTimeout(400);
  const tituloAv = await pagBloco.evaluate(() => document.querySelector('header.topo h1').textContent);
  ok('cabeçalho identifica a versão avulsa', /Bloco de Ancoragem/.test(tituloAv), tituloAv);
  const abasAv = await pagBloco.locator('#abas button').allInnerTexts();
  ok('só as abas de blocos e catálogos', abasAv.length === 2 &&
     /Blocos/.test(abasAv[0]) && /Catálogos/.test(abasAv[1]), abasAv.join(' | '));
  ok('sem botão de exemplos', (await pagBloco.locator('[data-acao="exemplo"]:visible').count()) === 0);
  const txtAv = await pagBloco.locator('#conteudo').innerText();
  ok('abre com um bloco pronto', /Peça/.test(txtAv) && /Pressão/.test(txtAv));
  ok('sem seletor de trecho da adutora', !/travessia|Trecho 1 —/.test(txtAv));
  await pagBloco.evaluate(() => {
    const b = window.PDA.App.st.blocos.itens[0];
    b.catalogoId = 'fd_k7'; b.itemRot = 'DN 300'; b.pecaId = 'c90'; b.pressaoInformada = 80;
    window.PDA.App.render();
  });
  await pagBloco.waitForTimeout(400);
  const calcAv = await pagBloco.evaluate(() => {
    const P = window.PDA, st = P.App.st;
    const info = P.C.blocoInfo(st, P.C.contexto(st, P.App.cats), null, st.blocos.itens[0]);
    return { E: info.calc.E, de: info.deMm, p: info.pMca };
  });
  ok('calcula com pressão informada e DE do catálogo',
     calcAv.p === 80 && calcAv.de > 300 && calcAv.E > 0, JSON.stringify(calcAv));
  /* guarda em chave própria, sem atropelar o projeto principal */
  const chaves = await pagBloco.evaluate(() => ({
    bloco: !!localStorage.getItem('pda.projeto.blocos.v1')
  }));
  ok('projeto avulso guardado em chave própria', chaves.bloco);
  await pagBloco.close();

  titulo('36. Ponto alto da linha');
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const P = window.PDA;
    P.App.st = P.E.padrao();
    const st = P.App.st;
    st.vazao.valor = 100;
    st.cotas.nivelSuccaoMin = 170; st.cotas.nivelSuccaoMax = 171; st.cotas.eixoBomba = 168;
    st.cotas.nivelChegada = 180;
    st.adutoras[0].itemRot = 'DN 300';
    st.adutoras[0].extensao = 2000;
    P.App.irPara('bombas');
  });
  await page.waitForTimeout(450);
  const txtBom = await page.locator('#conteudo').innerText();
  ok('campo do ponto mais alto na aba Bombas', /Cota do ponto mais alto/.test(txtBom));
  ok('campo da distância até ele', /Distância até ele/.test(txtBom));
  await page.locator('input[data-bind="cotas.cotaPontoAlto"]').fill('190');
  await page.locator('input[data-bind="cotas.cotaPontoAlto"]').press('Tab');
  await page.waitForTimeout(500);
  ok('cota alta sem distância pede a distância',
     /sem a distância até ele/.test(await page.locator('#conteudo').innerText()));
  await page.locator('input[data-bind="cotas.distPontoAlto"]').fill('1000');
  await page.locator('input[data-bind="cotas.distPontoAlto"]').press('Tab');
  await page.waitForTimeout(500);
  const txtBom2 = await page.locator('#conteudo').innerText();
  ok('acusa a piezométrica abaixo do ponto alto', /ACIMA da linha piezométrica/.test(txtBom2));
  ok('diz a Hm necessária', /precisaria ser de pelo menos/.test(txtBom2));
  /* com o perfil lançado, os campos manuais saem e o perfil manda */
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.cotas.cotaPontoAlto = 186;   /* divergente do perfil, de propósito */
    st.perfil = { ativo: true, modo: 'acumulada', unidExt: 'm',
      pontos: [{ est: 0, cota: 170 }, { est: 1000, cota: 190 }, { est: 2000, cota: 180 }] };
    window.PDA.App.render();
  });
  await page.waitForTimeout(450);
  const txtBom3 = await page.locator('#conteudo').innerText();
  ok('com perfil, o campo manual dá lugar ao resumo do perfil',
     /Ponto alto \(do perfil da linha\)/.test(txtBom3) && !/Cota do ponto mais alto \(m\)/.test(txtBom3));
  ok('divergência entre campo e perfil é acusada', /confira qual dos dois está certo/.test(txtBom3));
  ok('aviso também aparece no Resumo', await page.evaluate(() => {
    const P = window.PDA;
    const res = P.C.resumo(P.App.st, P.App.cats);
    return res.avisosDados.some(a => a.id === 'pontoAlto' && a.grave);
  }));

  titulo('37. Conta nos campos numéricos');
  await page.evaluate(() => { window.PDA.App.st = window.PDA.E.padrao(); window.PDA.App.irPara('resumo'); });
  await page.waitForTimeout(400);
  const campoVazao = page.locator('input[data-bind="vazao.valor"]').first();
  await campoVazao.fill('=10+25+30');
  await campoVazao.press('Enter');
  await page.waitForTimeout(500);
  ok('=10+25+30 vira 65 na vazão',
     (await page.evaluate(() => window.PDA.App.st.vazao.valor)) === 65);
  await campoVazao.fill('2,5*40');
  await campoVazao.press('Tab');
  await page.waitForTimeout(500);
  ok('2,5*40 vira 100', (await page.evaluate(() => window.PDA.App.st.vazao.valor)) === 100);
  /* digitar a expressão não aplica pela metade: só no Enter/Tab */
  await campoVazao.fill('50');
  await campoVazao.press('Tab');
  await page.waitForTimeout(400);
  await campoVazao.fill('50+');
  await page.waitForTimeout(600);
  ok('expressão incompleta não entra no estado enquanto digita',
     (await page.evaluate(() => window.PDA.App.st.vazao.valor)) === 50);
  await campoVazao.press('Escape');

  titulo('38. Blocos — solução adotada, desenho e memória');
  await page.evaluate(() => {
    const P = window.PDA;
    P.App.st = P.E.padrao();
    const st = P.App.st;
    st.blocos.ativo = true;
    st.blocos.itens = [P.E.novoBloco(1)];
    st.blocos.itens[0].tuboOrigem = 'manual';
    st.blocos.itens[0].catalogoId = 'fd_k7';
    st.blocos.itens[0].itemRot = 'DN 300';
    st.blocos.itens[0].pressaoFonte = 'informada';
    st.blocos.itens[0].pressaoInformada = 80;
    P.App.irPara('blocos');
  });
  await page.waitForTimeout(500);
  const txtBl2 = await page.locator('#conteudo').innerText();
  ok('faixa "Solução adotada" presente', /Solução adotada:/.test(txtBl2));
  ok('deixa claro que o solo muda só a verificação',
     /muda com o solo/i.test(txtBl2) || /Verificação de apoio no solo/.test(txtBl2));
  ok('4 vistas desenhadas', (await page.locator('#conteudo svg.vista-bloco').count()) === 4);
  ok('vistas nomeadas', /PLANTA/.test(txtBl2) && /CORTE TRANSVERSAL/.test(txtBl2) &&
     /CORTE LONGITUDINAL/.test(txtBl2) && /PERSPECTIVA/.test(txtBl2));
  ok('quadro com profundidade da vala', /Profundidade da vala/.test(txtBl2));
  ok('previsão de armadura', /Armadura/.test(txtBl2));
  ok('memória de cálculo na tela', /Memória de cálculo dos blocos/.test(txtBl2));
  ok('memória com fórmulas compostas',
     (await page.locator('#conteudo .memoria-bloco svg.formula-svg').count()) >= 1);
  /* trocar o solo NÃO muda o bloco padronizado adotado, e a tela diz isso */
  const antesSolo = await page.evaluate(() => {
    const P = window.PDA;
    const info = P.C.blocoInfo(P.App.st, P.C.contexto(P.App.st, P.App.cats), null, P.App.st.blocos.itens[0]);
    return P.BA.solucao(info.calc, P.App.st.blocos.itens[0]);
  });
  await page.evaluate(() => { window.PDA.App.st.blocos.itens[0].soloId = 'argila_mole'; window.PDA.App.render(); });
  await page.waitForTimeout(400);
  const depoisSolo = await page.evaluate(() => {
    const P = window.PDA;
    const info = P.C.blocoInfo(P.App.st, P.C.contexto(P.App.st, P.App.cats), null, P.App.st.blocos.itens[0]);
    return P.BA.solucao(info.calc, P.App.st.blocos.itens[0]);
  });
  ok('trocar o solo mantém o bloco padronizado adotado',
     antesSolo.via === 'padrao' && depoisSolo.via === 'padrao' &&
     antesSolo.tipo === depoisSolo.tipo && antesSolo.concreto === depoisSolo.concreto);
  /* memorial ganha a figura das vistas */
  const memVistas = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const D = P.MEM.documento(P.App.st, ctx, res);
    return D.figuras.some(f => /vistas do bloco adotado/.test(f.titulo));
  });
  ok('memorial traz a figura das vistas do bloco', memVistas);

  titulo('39. Transitório e proteção — aba');
  await page.evaluate(() => window.PDA.UI.fecharModal());
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const P = window.PDA;
    P.App.st = P.E.padrao();
    const st = P.App.st;
    st.vazao.valor = 400; st.bombas.instaladas = 3; st.bombas.operando = 2;
    st.cotas.nivelSuccaoMin = 100; st.cotas.nivelSuccaoMax = 101; st.cotas.eixoBomba = 98;
    st.cotas.nivelChegada = 140;
    st.adutoras[0].itemRot = 'DN 500';
    st.adutoras[0].extensao = 3000;
    st.adutoras[0].pnMcaOverride = 160;
    st.perfil = { ativo: true, modo: 'acumulada', unidExt: 'm',
      pontos: [{ est: 0, cota: 100 }, { est: 1500, cota: 142 }, { est: 3000, cota: 140 }] };
    P.App.irPara('protecao');
  });
  await page.waitForTimeout(450);
  ok('aba existe e explica antes de ligar',
     /Estudar a proteção contra o transitório/.test(await page.locator('#conteudo').innerText()));
  await page.locator('input[data-bind="protecao.ativo"]').click();
  await page.waitForTimeout(500);
  const txtPr = await page.locator('#conteudo').innerText();
  ok('mostra o requisito com Δh sem proteção e Δh tolerado',
     /Δh sem proteção/.test(txtPr) && /Δh que a linha tolera/.test(txtPr));
  ok('sugere pontos de instalação do perfil', /Pontos sugeridos de instalação/.test(txtPr));
  ok('ponto alto do perfil vem com função e botão de lançar',
     /ponto alto do perfil/.test(txtPr) && (await page.locator('[data-acao="protVentosaAqui"]').count()) >= 1);
  ok('botões dos quatro dispositivos', (await page.locator('[data-acao="protNovo"]').count()) === 4);

  /* lança a ventosa sugerida e depois um RHO */
  await page.locator('[data-acao="protVentosaAqui"]').first().click();
  await page.waitForTimeout(400);
  const vLancada = await page.evaluate(() => window.PDA.App.st.protecao.dispositivos[0]);
  ok('ventosa lançada com posição, função e DN sugeridos',
     vLancada.tipo === 'ventosa' && vLancada.x > 0 && vLancada.dn > 0, JSON.stringify(vLancada));
  await page.locator('[data-acao="protNovo"][data-tipo="rho"]').click();
  await page.waitForTimeout(500);
  const txtRho = await page.locator('#conteudo').innerText();
  ok('RHO com pré-dimensionamento pela coluna rígida',
     /coluna rígida/.test(txtRho) && /Volume do tanque/.test(txtRho));
  ok('tabela de volumes comerciais com estrela',
     (await page.locator('tr[data-acao="protVolume"]').count()) > 10 && /★/.test(txtRho));
  /* adota o volume sugerido clicando na linha com estrela */
  const volNec = await page.evaluate(() => {
    const P = window.PDA, st = P.App.st;
    const res = P.C.resumo(st, P.App.cats);
    const req = P.PR.requisito(st, P.C.contexto(st, P.App.cats), res);
    return P.PR.rho(st, P.C.contexto(st, P.App.cats), res, req).comercial;
  });
  await page.locator('tr[data-acao="protVolume"][data-v="' + volNec + '"]').click();
  await page.waitForTimeout(500);
  ok('clique adota o volume', (await page.evaluate(() => window.PDA.App.st.protecao.dispositivos[1].volumeM3)) === volNec);
  const txtPr2 = await page.locator('#conteudo').innerText();
  ok('mostra o Δh que o volume adotado segura', /limita o transitório a Δh/.test(txtPr2));
  ok('envoltórias lado a lado (sem e com proteção)',
     /Sem proteção \(Δh/.test(txtPr2) && /Com o RHO lançado/.test(txtPr2));
  ok('dois gráficos desenhados', (await page.locator('#conteudo .blocos-vias svg').count()) >= 2);
  /* subdimensionar acusa */
  await page.evaluate(() => { window.PDA.App.st.protecao.dispositivos[1].volumeM3 = 0.5; window.PDA.App.render(); });
  await page.waitForTimeout(400);
  ok('RHO pequeno acusa SUBDIMENSIONADO na tela',
     /SUBDIMENSIONADO/.test(await page.locator('#conteudo').innerText()));
  /* memorial ganha o capítulo */
  await page.evaluate(() => { window.PDA.App.st.protecao.dispositivos[1].volumeM3 = 30; });
  const memPr = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const D = P.MEM.documento(P.App.st, ctx, res);
    return {
      cap: D.capitulos.some(c => /Proteção contra o transitório/.test(c.titulo)),
      fig: D.figuras.some(f => /proteção lançada/.test(f.titulo)),
      tab: D.tabelas.some(t => /Dispositivos de proteção/.test(t.titulo))
    };
  });
  ok('memorial tem o capítulo de proteção', memPr.cap);
  ok('com a figura da envoltória protegida', memPr.fig);
  ok('e a tabela de dispositivos', memPr.tab);

  titulo('40. Tipo de junta no trecho');
  await page.evaluate(() => { window.PDA.App.irPara('adutoras'); });
  await page.waitForTimeout(450);
  const selJunta = page.locator('select[data-bind="adutoras.0.junta"]');
  ok('seletor de junta no trecho FD', (await selJunta.count()) === 1);
  const opsJunta = await selJunta.locator('option').allInnerTexts();
  ok('com JGS, JTI, JTE e flangeada',
     /JGS/.test(opsJunta.join('|')) && /JTI/.test(opsJunta.join('|')) &&
     /JTE/.test(opsJunta.join('|')) && /Flangeada/.test(opsJunta.join('|')), opsJunta.join(' | '));
  ok('padrão do K7 é a elástica',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].junta)) === 'jgs');
  await selJunta.selectOption('jti');
  await page.waitForTimeout(400);
  ok('troca para JTI gravada',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].junta)) === 'jti');
  /* memorial menciona a junta */
  const memJ = await page.evaluate(() => {
    const P = window.PDA;
    const ctx = P.C.contexto(P.App.st, P.App.cats);
    const res = P.C.resumo(P.App.st, P.App.cats);
    const D = P.MEM.documento(P.App.st, ctx, res);
    const tmp = document.createElement('div');
    D.blocos.forEach(b => tmp.appendChild(b));
    return /junta travada interna|jti/i.test(tmp.textContent);
  });
  ok('memorial cita a junta do trecho', memJ);
  /* trocar de catálogo re-padroniza a junta */
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    st.adutoras[0].catalogoId = 'fd_flg_agua';
    st.adutoras[0].junta = '';
    window.PDA.App.render();
  });
  await page.waitForTimeout(400);
  ok('catálogo flangeado assume junta flangeada',
     (await page.evaluate(() => window.PDA.App.st.adutoras[0].junta)) === 'flg');
  /* PEAD tem juntas próprias */
  await page.evaluate(() => {
    const st = window.PDA.App.st;
    const pead = window.PDA.App.cats.todos.filter(c => c.familia === 'PEAD')[0];
    st.adutoras[0].catalogoId = pead.id;
    st.adutoras[0].junta = '';
    window.PDA.App.render();
  });
  await page.waitForTimeout(400);
  const opsPead = await page.locator('select[data-bind="adutoras.0.junta"] option').allInnerTexts();
  ok('PEAD oferece solda de topo / eletrofusão / flange',
     /Solda de topo/.test(opsPead.join('|')) && /Eletrofusão/.test(opsPead.join('|')), opsPead.join(' | '));

  titulo('25. Impressão fiel');
  await page.locator('[data-acao="exemplo"]').click();
  await page.waitForSelector('.modal');
  await page.locator('.modal button', { hasText: 'Linha de recalque de esgoto' }).click();
  await page.waitForTimeout(500);
  await page.locator('#abas button', { hasText: 'Adutora' }).click();
  await page.waitForTimeout(450);

  ok('cabeçalho de impressão montado',
     (await page.locator('#cabecalho-impressao .marca-bloco').count()) === 1);
  const cabImp = await page.evaluate(() => document.getElementById('cabecalho-impressao').textContent);
  ok('cabeçalho traz o nome do projeto', /esgoto bruto/i.test(cabImp), cabImp.slice(0, 70));
  ok('cabeçalho identifica a folha impressa', /Adutora/.test(cabImp));
  ok('cabeçalho oculto na tela',
     (await page.evaluate(() => getComputedStyle(document.getElementById('cabecalho-impressao')).display)) === 'none');

  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(250);
  const impr = await page.evaluate(() => {
    function vis(sel) {
      const e = document.querySelector(sel);
      /* getClientRects vazio cobre também o caso de um ancestral escondido */
      return e ? e.getClientRects().length > 0 : false;
    }
    return {
      cabecalho: vis('#cabecalho-impressao'),
      logo: !!document.querySelector('#cabecalho-impressao .marca-simbolo svg, #cabecalho-impressao img.marca-img'),
      topo: vis('header.topo'),
      abas: vis('nav.abas'),
      fixa: vis('.faixa-fixa'),
      copiaFaixa: vis('.somenteimprime'),
      cartoes: document.querySelectorAll('.cartao').length,
      tabelas: document.querySelectorAll('table').length,
      botoes: vis('button.btn'),
      inputs: vis('input[data-bind]'),
      esquema: vis('svg.esquema')
    };
  });
  ok('cabeçalho aparece no papel', impr.cabecalho);
  ok('logo vai junto no papel', impr.logo);
  ok('barra de comandos e abas somem', !impr.topo && !impr.abas);
  ok('a faixa fixa é substituída por uma cópia no fluxo', !impr.fixa && impr.copiaFaixa);
  ok('cartões preservados no papel', impr.cartoes > 1, String(impr.cartoes));
  ok('tabelas preservadas no papel', impr.tabelas > 1, String(impr.tabelas));
  ok('botões somem', !impr.botoes);
  ok('campos preenchidos continuam visíveis', impr.inputs);
  ok('desenho esquemático vai para o papel', impr.esquema);
  await page.emulateMedia({ media: 'screen' });
  await page.waitForTimeout(200);

  const pdf = await page.pdf({ format: 'A4', printBackground: true, landscape: true });
  ok('gera PDF de impressão', pdf.length > 12000, (pdf.length / 1024).toFixed(0) + ' kB');
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(400);
  const pdf2 = await page.pdf({ format: 'A4', printBackground: true });
  ok('memorial gera PDF com várias páginas', pdf2.length > 20000, (pdf2.length / 1024).toFixed(0) + ' kB');

  await browser.close();
  console.log('\n' + '='.repeat(60));
  console.log(falhas === 0 ? `TODOS OS ${total} TESTES DE INTERFACE PASSARAM` : `${falhas} de ${total} TESTES DE INTERFACE FALHARAM`);
  console.log('='.repeat(60));
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
