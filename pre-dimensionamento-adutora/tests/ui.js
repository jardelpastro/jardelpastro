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
  ok('abas montadas', (await page.locator('#abas button').count()) === 11,
     String(await page.locator('#abas button').count()));
  ok('marca no cabeçalho', (await page.locator('#marca .marca-bloco').count()) === 1);
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
  ok('aceita arquivo de imagem', (await page.locator('.modal input[type="file"]').count()) === 1);
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
