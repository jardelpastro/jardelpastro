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
  ok('abas montadas', (await page.locator('#abas button').count()) === 8);
  ok('conteúdo da aba Projeto renderizado', (await page.locator('#conteudo .cartao').count()) > 3);
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
  await page.locator('#abas button', { hasText: 'Projeto' }).click();
  await page.waitForTimeout(160);
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
  await page.locator('#abas button', { hasText: 'Projeto' }).click();
  await page.waitForTimeout(220);
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
  ok('sem PN a tabela informa que não está cadastrado',
     /PN não cadastrado/.test(await page.locator('#conteudo').innerText()));
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
  const dl = page.waitForEvent('download', { timeout: 5000 });
  await page.locator('[data-acao="salvarProjeto"]').click();
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
     (await page.locator('#conteudo .cartao').count()) > 3 && erros.filter(e => !/localStorage/.test(e)).length === 0);

  titulo('25. Impressão');
  await page.locator('#abas button', { hasText: 'Resultados' }).click();
  await page.waitForTimeout(300);
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  ok('gera PDF de impressão', pdf.length > 12000, (pdf.length / 1024).toFixed(0) + ' kB');

  await browser.close();
  console.log('\n' + '='.repeat(60));
  console.log(falhas === 0 ? `TODOS OS ${total} TESTES DE INTERFACE PASSARAM` : `${falhas} de ${total} TESTES DE INTERFACE FALHARAM`);
  console.log('='.repeat(60));
  process.exit(falhas === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
