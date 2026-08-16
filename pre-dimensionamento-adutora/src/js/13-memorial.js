/* ------------------------------------------------------------------
 * Memorial descritivo e de cálculo.
 *
 * Monta o documento completo — capa, sumário, índices, capítulos com
 * fórmula, aplicação numérica e tabela de resultados, e a bibliografia.
 * A paginação e a exportação ficam em 14-exportar.js.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var MEM = {};
  var UI, h;

  MEM.init = function () { UI = PDA.UI; h = UI.h; };

  function n(v, d) { return UI.num(v, d === undefined ? 2 : d); }
  function ne(v) { return UI.numEdit(v); }

  /* ================================================================
     Bibliografia
     ================================================================ */

  MEM.biblio = {
    az: { cit: 'AZEVEDO NETTO; FERNÁNDEZ, 2015',
          ref: 'AZEVEDO NETTO, J. M.; FERNÁNDEZ, M. F. <b>Manual de Hidráulica</b>. 9. ed. São Paulo: Blucher, 2015.' },
    porto: { cit: 'PORTO, 2006',
          ref: 'PORTO, R. M. <b>Hidráulica Básica</b>. 4. ed. São Carlos: EESC-USP, 2006.' },
    tsutiya: { cit: 'TSUTIYA, 2006',
          ref: 'TSUTIYA, M. T. <b>Abastecimento de Água</b>. 4. ed. São Paulo: Departamento de Engenharia Hidráulica e Sanitária da Escola Politécnica da USP, 2006.' },
    tsutiyaEsgoto: { cit: 'TSUTIYA; ALEM SOBRINHO, 2011',
          ref: 'TSUTIYA, M. T.; ALEM SOBRINHO, P. <b>Coleta e Transporte de Esgoto Sanitário</b>. 3. ed. São Paulo: Departamento de Engenharia Hidráulica e Sanitária da Escola Politécnica da USP, 2011.' },
    colebrook: { cit: 'COLEBROOK, 1939',
          ref: 'COLEBROOK, C. F. Turbulent flow in pipes, with particular reference to the transition region between the smooth and rough pipe laws. <b>Journal of the Institution of Civil Engineers</b>, v. 11, n. 4, p. 133-156, 1939.' },
    swamee: { cit: 'SWAMEE; JAIN, 1976',
          ref: 'SWAMEE, P. K.; JAIN, A. K. Explicit equations for pipe-flow problems. <b>Journal of the Hydraulics Division, ASCE</b>, v. 102, n. 5, p. 657-664, 1976.' },
    zigrang: { cit: 'ZIGRANG; SYLVESTER, 1982',
          ref: 'ZIGRANG, D. J.; SYLVESTER, N. D. Explicit approximations to the solution of Colebrook\'s friction factor equation. <b>AIChE Journal</b>, v. 28, n. 3, p. 514-515, 1982.' },
    halliwell: { cit: 'HALLIWELL, 1963',
          ref: 'HALLIWELL, A. R. Velocity of a water-hammer wave in an elastic pipe. <b>Journal of the Hydraulics Division, ASCE</b>, v. 89, n. 4, p. 1-21, 1963.' },
    streeter: { cit: 'STREETER; WYLIE, 1978',
          ref: 'STREETER, V. L.; WYLIE, E. B. <b>Fluid Transients</b>. New York: McGraw-Hill, 1978.' },
    joukowsky: { cit: 'JOUKOWSKY, 1898',
          ref: 'JOUKOWSKY, N. Über den hydraulischen Stoss in Wasserleitungsröhren. <b>Mémoires de l\'Académie Impériale des Sciences de St.-Pétersbourg</b>, 1898.' },
    nbr12214: { cit: 'ABNT NBR 12214', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 12214</b>: projeto de sistema de bombeamento de água para abastecimento público. Rio de Janeiro, 1992.' },
    nbr12215: { cit: 'ABNT NBR 12215', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 12215</b>: projeto de adutora de água para abastecimento público. Rio de Janeiro, 1991.' },
    nbr12208: { cit: 'ABNT NBR 12208', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 12208</b>: projeto de estações elevatórias de esgoto sanitário. Rio de Janeiro, 1992.' },
    nbr7675: { cit: 'ABNT NBR 7675', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 7675</b>: tubos e conexões de ferro fundido dúctil e acessórios para sistemas de adução e distribuição de água. Rio de Janeiro.' },
    nbr8682: { cit: 'ABNT NBR 8682', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 8682</b>: revestimento interno de argamassa de cimento em tubos de ferro fundido dúctil. Rio de Janeiro.' },
    nbr15561: { cit: 'ABNT NBR 15561', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 15561</b>: tubos de polietileno PE 80 e PE 100 para sistemas de distribuição de água. Rio de Janeiro.' },
    nbr7665: { cit: 'ABNT NBR 7665', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 7665</b>: tubos de PVC-U com junta elástica para adutoras e redes de água — série DEFoFo. Rio de Janeiro.' },
    nbr5647: { cit: 'ABNT NBR 5647', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 5647</b>: sistemas para adução e distribuição de água — tubos e conexões de PVC-U com junta elástica. Rio de Janeiro.' },
    nbr16631: { cit: 'ABNT NBR 16631 / ISO 16422', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 16631</b>: tubos e conexões de PVC-O para sistemas de adução e distribuição de água. Rio de Janeiro. Baseada na ISO 16422.' },
    nbr5580: { cit: 'ABNT NBR 5580', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 5580</b>: tubos de aço-carbono para usos comuns na condução de fluidos. Rio de Janeiro.' },
    nbr5590: { cit: 'ABNT NBR 5590', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 5590</b>: tubos de aço-carbono com costura, com ou sem revestimento, para condução de fluidos. Rio de Janeiro.' },
    nbr8890: { cit: 'ABNT NBR 8890', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 8890</b>: tubo de concreto de seção circular para água pluvial e esgoto sanitário. Rio de Janeiro.' },
    nbr15536: { cit: 'ABNT NBR 15536', ref: 'ASSOCIAÇÃO BRASILEIRA DE NORMAS TÉCNICAS. <b>NBR 15536</b>: sistemas para adução e distribuição de água e coletores de esgoto — tubos e conexões de PRFV. Rio de Janeiro.' },
    m41: { cit: 'AWWA M41',
          ref: 'AMERICAN WATER WORKS ASSOCIATION. <b>Manual M41</b>: ductile-iron pipe and fittings. 3. ed. Denver: AWWA. Cap. Thrust restraint design (DIPRA).' },
    asme: { cit: 'ASME B36.10M', ref: 'AMERICAN SOCIETY OF MECHANICAL ENGINEERS. <b>ASME B36.10M</b>: welded and seamless wrought steel pipe. New York.' },
    en545: { cit: 'EN 545', ref: 'EUROPEAN COMMITTEE FOR STANDARDIZATION. <b>EN 545</b>: ductile iron pipes, fittings, accessories and their joints for water pipelines. Brussels.' },
    en1092: { cit: 'EN 1092-2', ref: 'EUROPEAN COMMITTEE FOR STANDARDIZATION. <b>EN 1092-2</b>: flanges and their joints — cast iron flanges. Brussels.' }
  };

  MEM.cit = function (chave) {
    var b = MEM.biblio[chave];
    return b ? '(' + b.cit + ')' : '';
  };

  /* ================================================================
     Blocos do documento
     ================================================================ */

  function Doc(st, ctx, res) {
    this.st = st; this.ctx = ctx; this.res = res;
    this.blocos = [];
    this.capitulos = [];
    this.figuras = [];
    this.tabelas = [];
    this.equacoes = 0;
    this.fontesUsadas = {};
    this.nCap = 0;
  }

  Doc.prototype.add = function (el) { if (el) this.blocos.push(el); return el; };

  Doc.prototype.capitulo = function (titulo) {
    this.nCap++;
    var id = 'cap' + this.nCap;
    var el = h('h1', { class: 'doc-h1 bloco pagina-nova', 'data-ref': id }, this.nCap + ' ' + titulo);
    this.capitulos.push({ id: id, num: String(this.nCap), titulo: titulo, nivel: 1 });
    this.add(el);
    this.nSub = 0;
    return el;
  };

  /* seções pós-textuais (referências) não recebem indicativo numérico */
  Doc.prototype.capituloSemNumero = function (titulo) {
    var id = 'cap0' + this.capitulos.length;
    this.capitulos.push({ id: id, num: '', titulo: titulo, nivel: 1 });
    this.nSub = 0;
    return this.add(h('h1', { class: 'doc-h1 bloco pagina-nova', 'data-ref': id }, titulo));
  };

  Doc.prototype.secao = function (titulo) {
    this.nSub = (this.nSub || 0) + 1;
    var num = this.nCap + '.' + this.nSub;
    var id = 'sec' + num.replace('.', '_');
    this.capitulos.push({ id: id, num: num, titulo: titulo, nivel: 2 });
    return this.add(h('h2', { class: 'doc-h2 bloco', 'data-ref': id }, num + ' ' + titulo));
  };

  Doc.prototype.p = function () {
    var el = h('p', { class: 'doc-p bloco' });
    var i;
    for (i = 0; i < arguments.length; i++) UI.add(el, arguments[i]);
    return this.add(el);
  };

  Doc.prototype.nota = function (txt) {
    return this.add(h('p', { class: 'doc-nota bloco' }, txt));
  };

  /* Fórmula simbólica: composta de verdade — fração com barra, radical
     com barra sobre o radicando, expoentes e índices — centralizada e
     numerada entre parênteses na margem direita (NBR 14724). */
  Doc.prototype.formula = function (codigo, legenda, op) {
    op = op || {};
    var corpo = h('div', { class: 'formula-corpo' });
    (Array.isArray(codigo) ? codigo : [codigo]).forEach(function (c) {
      corpo.appendChild(PDA.FX.svg(c, { tam: 17 }));
    });
    var num = '';
    if (!op.semNumero) { this.equacoes++; num = '(' + this.equacoes + ')'; }
    var el = h('div', { class: 'doc-formula bloco-junto' },
      corpo,
      h('div', { class: 'formula-num' }, num));
    this.add(el);
    if (legenda) {
      this.add(h('p', { class: 'formula-leg bloco', html: 'em que ' + PDA.FX.emTexto(legenda) }));
    }
    return this.equacoes;
  };

  /* Aplicação numérica: a mesma fórmula com os valores no lugar das
     letras, com as linhas alinhadas pelo sinal de igual. */
  Doc.prototype.aplicacao = function () {
    var linhas = [], i;
    for (i = 0; i < arguments.length; i++) if (arguments[i]) linhas.push(arguments[i]);
    if (!linhas.length) return null;
    var bloco = h('div', { class: 'doc-aplicacao bloco-junto' });
    var textos = [], rotulos = [];
    linhas.forEach(function (l) {
      if (typeof l === 'object' && l.rot) rotulos.push(l);
      else textos.push(String(l));
    });
    rotulos.forEach(function (l) { bloco.appendChild(h('p', { class: 'doc-p sem-recuo' }, l.rot)); });
    if (textos.length) bloco.appendChild(PDA.FX.bloco(textos, { tam: 15 }));
    return this.add(bloco);
  };

  /* alíneas da NBR 6024: letra minúscula seguida de parêntese, texto
     iniciado por minúscula e terminado em ponto e vírgula */
  Doc.prototype.alineas = function (itens) {
    var letras = 'abcdefghijklmnopqrstuvwxyz';
    return this.add(h('ul', { class: 'doc-alineas bloco' },
      itens.map(function (t, i) {
        return h('li', {}, letras.charAt(i) + ') ' + t + (i === itens.length - 1 ? '.' : ';'));
      })));
  };

  Doc.prototype.tabela = function (titulo, cabs, linhas, fonte) {
    var num = this.tabelas.length + 1;
    var id = 'tab' + num;
    this.tabelas.push({ id: id, num: num, titulo: titulo });
    var tab = h('table', { class: 'doc-tabela' },
      h('thead', {}, h('tr', {}, cabs.map(function (c) {
        return typeof c === 'string' ? h('th', {}, c)
          : h('th', { class: c.esq ? 'esq' : null }, c.rot);
      }))),
      h('tbody', {}, linhas));
    return this.add(h('div', { class: 'doc-quadro bloco-tabela', 'data-ref': id },
      h('div', { class: 'doc-cap-tab' }, 'Tabela ' + num + ' – ' + titulo),
      tab,
      fonte ? h('div', { class: 'doc-fonte' }, 'Fonte: ' + fonte) : null));
  };

  Doc.prototype.figura = function (titulo, el, fonte) {
    var num = this.figuras.length + 1;
    var id = 'fig' + num;
    this.figuras.push({ id: id, num: num, titulo: titulo });
    return this.add(h('div', { class: 'doc-quadro bloco-junto', 'data-ref': id },
      h('div', { class: 'doc-cap-fig' }, 'Figura ' + num + ' – ' + titulo),
      h('div', { class: 'doc-fig' }, el),
      fonte ? h('div', { class: 'doc-fonte' }, 'Fonte: ' + fonte) : null));
  };

  Doc.prototype.usar = function () {
    var i;
    for (i = 0; i < arguments.length; i++) this.fontesUsadas[arguments[i]] = true;
    return MEM.cit(arguments[0]);
  };

  /* ================================================================
     Montagem
     ================================================================ */

  MEM.documento = function (st, ctx, res, op) {
    op = op || {};
    var D = new Doc(st, ctx, res);
    var c = res.projeto;
    var usaHW = st.calculo.metodo === 'hw';
    var submersivel = st.bombas.tipo === 'submersivel';
    var fl = PDA.R.fluidos.filter(function (f) { return f.id === st.fluido.tipo; })[0];
    var esgoto = ctx.familiaCriterio === 'esgoto';

    /* ---------------- 1. Introdução ---------------- */
    D.capitulo('Introdução');
    var intro = (st.memorial && st.memorial.introducao) ? st.memorial.introducao : MEM.introducaoPadrao(st, ctx, res);
    intro.split(/\n\s*\n/).forEach(function (par) {
      if (par.trim()) D.p(par.trim());
    });

    if (st.memorial && st.memorial.objetivo) {
      D.secao('Objetivo');
      st.memorial.objetivo.split(/\n\s*\n/).forEach(function (par) { if (par.trim()) D.p(par.trim()); });
    }

    /* ---------------- 2. Dados de projeto ---------------- */
    D.capitulo('Dados de projeto e premissas');
    D.p('Os dados de partida adotados neste pré-dimensionamento estão reunidos na Tabela 1. ' +
        'As cotas são altitudes absolutas, referidas ao mesmo datum do levantamento topográfico do projeto.');

    function lin(rot, val) {
      return h('tr', {}, h('td', { class: 'esq' }, rot), h('td', { class: 'esq' }, val));
    }
    var dados = [
      lin('Fluido bombeado', fl ? fl.rot : '—'),
      lin('Temperatura do fluido', ne(st.fluido.temperatura) + ' °C'),
      lin('Altitude do local', ne(st.fluido.altitude) + ' m'),
      lin('Vazão total de projeto', n(ctx.qTotal * 1000) + ' L/s  (' + n(ctx.qTotal * 3600) + ' m³/h)'),
      lin('Vazão por bomba', n(ctx.qBomba * 1000) + ' L/s'),
      lin('Conjuntos instalados', ne(ctx.nInst) + ' unidade(s)'),
      lin('Conjuntos em operação simultânea', ne(ctx.nOp) + ' unidade(s)'),
      lin('Arranjo dos conjuntos', ({ afogada: 'bomba afogada', succao: 'bomba com sucção negativa',
                                      submersivel: 'bomba submersível' })[st.bombas.tipo]),
      lin('Cota do nível d\'água de sucção — mínimo', n(st.cotas.nivelSuccaoMin) + ' m'),
      lin('Cota do nível d\'água de sucção — máximo', n(st.cotas.nivelSuccaoMax) + ' m'),
      submersivel ? null : lin('Cota do eixo da bomba', n(st.cotas.eixoBomba) + ' m'),
      lin('Cota de partida da adutora', n(PDA.C.cotaPartida(st)) + ' m'),
      lin('Cota de chegada', n(st.cotas.nivelChegada) + ' m'),
      lin('Altura geométrica de projeto', n(c.HgMax) + ' m  (com o nível de sucção mínimo)'),
      lin('Rendimento adotado para a bomba', ne(st.bombas.rendBomba) + ' %'),
      st.bombas.usarRendMotor ? lin('Rendimento adotado para o motor', ne(st.bombas.rendMotor) + ' %') : null,
      lin('Fórmula de perda de carga distribuída', PDA.C.rotMetodo[st.calculo.metodo]),
      lin('Perda de carga localizada', 'Método dos coeficientes de perda (K)')
    ].filter(Boolean);
    D.tabela('Dados de projeto e premissas adotadas', ['Item', 'Valor adotado'], dados,
      'Dados de entrada do projeto.');

    D.figura('Esquema da elevatória com as cotas de projeto',
      PDA.Q.niveisCotas(st, ctx, c),
      'Elaborado pelo programa a partir dos dados do projeto.');

    /* ---------------- 3. Metodologia ---------------- */
    D.capitulo('Metodologia de cálculo');
    D.p('O dimensionamento hidráulico foi conduzido pelo balanço de energia entre o nível de sucção e o ponto ' +
        'de chegada. A altura manométrica total corresponde à soma da altura geométrica com as perdas de carga ' +
        'distribuídas e localizadas em todos os trechos percorridos pelo escoamento ' + D.usar('az') + '.');
    D.formula('Hm = Hg + \\Sigma hf + \\Sigma h_l',
      'Hm é a altura manométrica total (mca); Hg, a altura geométrica (m); hf, a perda de carga distribuída (m); ' +
      'e h\u2097, a perda de carga localizada (m).');

    D.secao('Perda de carga distribuída');
    if (usaHW) {
      D.p('A perda de carga distribuída foi obtida pela fórmula empírica de Hazen-Williams ' + D.usar('az') +
          ', aplicável a água em temperatura ambiente, condutos de 50 a 3500 mm e velocidades de até cerca de ' +
          '3 m/s. O coeficiente C sintetiza a rugosidade da parede e a idade do tubo.');
      D.formula('J = ' + ne(st.calculo.hwK) + ' \\cdot \\frac{Q^{' + ne(st.calculo.hwExpQ) + '}}' +
                '{C^{' + ne(st.calculo.hwExpQ) + '} \\cdot D^{' + ne(st.calculo.hwExpD) + '}}',
        'J é a perda de carga unitária (m/m); Q, a vazão (m³/s); C, o coeficiente de Hazen-Williams ' +
        '(adimensional); e D, o diâmetro interno (m).');
    } else {
      D.p('A perda de carga distribuída foi obtida pela fórmula universal de Darcy-Weisbach, com o fator de ' +
          'atrito determinado pela equação de Colebrook-White ' + D.usar('colebrook') +
          ', resolvida por iteração. Essa formulação vale para qualquer regime turbulento e trabalha com a ' +
          'rugosidade absoluta equivalente da parede ' + D.usar('porto') + '.');
      D.formula('J = \\frac{f \\cdot v^2}{2 \\cdot g \\cdot D}',
        'J é a perda de carga unitária (m/m); f, o fator de atrito (adimensional); v, a velocidade média (m/s); ' +
        'g, a aceleração da gravidade, 9,80665 m/s²; e D, o diâmetro interno (m).');
      D.formula('\\frac{1}{\\sqrt{f}} = -2 \\cdot \\log_{10} [ \\frac{\\varepsilon}{3,7 \\cdot D} + ' +
                '\\frac{2,51}{Re \\cdot \\sqrt{f}} ]',
        '\u03b5 é a rugosidade absoluta equivalente da parede (m); e Re, o número de Reynolds (adimensional).');
      D.formula('Re = \\frac{v \\cdot D}{\\nu}',
        '\u03bd é a viscosidade cinemática do fluido (m²/s), calculada em função da temperatura.');
      if (st.calculo.metodo === 'swamee') {
        D.p('Na condição adotada, o fator de atrito foi obtido pela aproximação explícita de Swamee-Jain ' +
            D.usar('swamee') + ', cujo desvio em relação à solução iterativa de Colebrook-White é inferior a 1,5 % ' +
            'na faixa de interesse.');
      } else if (st.calculo.metodo === 'zigrang') {
        D.p('Na condição adotada, o fator de atrito foi obtido pela aproximação explícita de Zigrang-Sylvester ' +
            D.usar('zigrang') + ', cujo desvio em relação à solução iterativa é inferior a 1 % na faixa de interesse.');
      }
      D.p('A viscosidade cinemática foi calculada para ' + ne(st.fluido.temperatura) + ' °C, resultando em ν = ' +
          n(ctx.ni * 1e6, 3) + ' × 10⁻⁶ m²/s ' + D.usar('az') + '.');
    }

    D.secao('Perda de carga localizada');
    D.p('As perdas localizadas foram calculadas pelo método dos coeficientes de perda de carga, peça a peça, ' +
        'com a velocidade do próprio trecho — ou com a velocidade no diâmetro da peça, quando informado ' +
        'diâmetro distinto do tubo ' + D.usar('az') + '.');
    D.formula('h_l = K \\cdot \\frac{v^2}{2 \\cdot g}',
      'h\u2097 é a perda de carga localizada (m); e K, o coeficiente de perda da peça (adimensional).');

    D.secao('Coeficientes de rugosidade adotados');
    D.p('Os coeficientes de rugosidade foram adotados em função do material do tubo e da faixa de idade ou ' +
        'condição de conservação, a partir das faixas consagradas na literatura ' + D.usar('az') + ' ' +
        MEM.cit('porto') + '.' +
        (esgoto ? ' Por se tratar de ' + (fl ? fl.rot.toLowerCase() : 'esgoto') +
          ', foi aplicado um agravo sobre o valor de referência, prática usual em linhas de recalque em que a ' +
          'formação de biofilme na parede aumenta a rugosidade efetiva ' + D.usar('tsutiyaEsgoto') + '.' : ''));
    D.usar('porto');

    /* deixa explícito de onde veio o valor: tabela, tabela com o agravo do
       fluido, ou número digitado pelo projetista */
    function origemRug(r, cons) {
      if (r.tubo.cOverride || r.tubo.epsOverride) return 'informado pelo projetista';
      var aj = cons.ajusteFluido;
      var d = aj ? (usaHW ? aj.dC : aj.dEps) : 0;
      if (!d) return 'valor de referência';
      return 'valor de referência com agravo de ' +
             (usaHW ? n(Math.abs(d), 0) + ' no C' : n(Math.abs(d), 2) + ' mm em ε') +
             ' (' + aj.rot.toLowerCase() + ')';
    }

    var linhasRug = [];
    var vistosRug = {};
    c.succao.concat(c.recalque, c.adutoras).forEach(function (r) {
      if (!r.tubo || !r.tubo.item) return;
      var chave = r.tubo.material + '|' + r.conj.idade + '|' + (usaHW ? r.tubo.C : r.tubo.epsMm);
      if (vistosRug[chave]) return;
      vistosRug[chave] = true;
      var cons = r.tubo.consulta || {};
      var faixa = usaHW ? cons.faixaC : cons.faixaEps;
      linhasRug.push(h('tr', {},
        h('td', { class: 'esq' }, (PDA.R.materiais[r.tubo.material] || {}).rot || r.tubo.material),
        h('td', { class: 'esq' }, (PDA.R.faixasIdade.filter(function (f) { return f.id === r.conj.idade; })[0] || {}).rot || '—'),
        h('td', {}, faixa ? ne(faixa[0]) + ' a ' + ne(faixa[1]) : '—'),
        h('td', {}, usaHW ? n(r.tubo.C, 0) : n(r.tubo.epsMm, 4)),
        h('td', { class: 'esq' }, origemRug(r, cons))));
    });
    if (linhasRug.length) {
      D.tabela('Coeficientes de rugosidade adotados',
        [{ rot: 'Material', esq: true }, { rot: 'Idade / condição', esq: true },
         usaHW ? 'Faixa de C' : 'Faixa de ε (mm)',
         usaHW ? 'C adotado' : 'ε adotado (mm)', { rot: 'Origem', esq: true }], linhasRug,
        MEM.biblio.az.cit + '; ' + MEM.biblio.porto.cit + '.');
    }

    /* ---------------- capítulos de trechos ---------------- */
    if (c.succao.length) MEM.capituloTrechos(D, 'Barrilete de sucção', c.succao, 'succao');
    if (c.recalque.length) MEM.capituloTrechos(D, 'Barrilete de recalque', c.recalque, 'barrilete');
    if (c.adutoras.length) MEM.capituloTrechos(D, 'Adutora / linha de recalque', c.adutoras, 'adutora');

    /* ---------------- perfil ---------------- */
    if (res.envoltoria) MEM.capituloPerfil(D);

    /* ---------------- resumo das perdas ---------------- */
    MEM.capituloResumo(D);

    /* ---------------- bomba ---------------- */
    MEM.capituloBomba(D);

    if (!submersivel) MEM.capituloNPSH(D);
    if (res.curvaBomba && res.operacao && !res.operacao.erro) MEM.capituloOperacao(D);
    if (st.golpe.avaliar && res.golpe && res.golpe.length) MEM.capituloTransitorio(D);
    if (st.blocos && st.blocos.ativo && (st.blocos.itens || []).length) MEM.capituloBlocos(D);

    /* ---------------- considerações finais ---------------- */
    D.capitulo('Considerações finais');
    D.p('Os resultados apresentados correspondem a um pré-dimensionamento: definem a ordem de grandeza do ' +
        'diâmetro, da altura manométrica e da potência dos conjuntos, e apontam os pontos que exigem atenção. ' +
        'O projeto executivo permanece condicionado às verificações relacionadas a seguir ' +
        D.usar('nbr12214') + ' ' + MEM.cit('nbr12215') + ':');
    D.usar('nbr12215');
    D.alineas([
      'obtenção da curva característica da bomba junto ao fabricante e confirmação do ponto de operação real',
      'conferência do NPSH requerido pela bomba selecionada, com a margem de segurança recomendada',
      'análise do regime transitório com os dispositivos de proteção e o método das características',
      'confirmação das dimensões, das classes de pressão e da disponibilidade dos tubos nos catálogos vigentes',
      'levantamento topográfico de detalhe da diretriz e verificação das interferências'
    ]);

    var pend = PDA.Res.coletarAvisos(st, ctx, res);
    if (pend.length) {
      D.p('A verificação automática dos critérios adotados registrou os pontos relacionados na Tabela ' +
          (D.tabelas.length + 1) + ', que devem ser analisados antes do fechamento do projeto.');
      D.tabela('Pontos a verificar', [{ rot: 'Item', esq: true }, { rot: 'Observação', esq: true }],
        pend.map(function (t, i) {
          return h('tr', {}, h('td', {}, String(i + 1)), h('td', { class: 'esq' }, t));
        }), 'Verificação automática dos critérios adotados.');
    }

    if (st.projeto.obs) {
      D.secao('Observações do projeto');
      st.projeto.obs.split(/\n\s*\n/).forEach(function (par) { if (par.trim()) D.p(par.trim()); });
    }

    /* ---------------- bibliografia ---------------- */
    D.capituloSemNumero('Referências');
    D.p('As referências relacionadas a seguir correspondem às fontes efetivamente utilizadas nas formulações, ' +
        'nos coeficientes e nos critérios adotados neste memorial. Recomenda-se conferir a edição vigente das ' +
        'normas citadas.');
    var chaves = Object.keys(D.fontesUsadas);
    /* acrescenta as normas dos catálogos de tubo empregados */
    var mapaCat = { nbr7675: 'nbr7675', nbr8682: 'nbr8682', iso4427: 'nbr15561', nbr7665: 'nbr7665',
                    nbr5647: 'nbr5647', iso16422: 'nbr16631', nbr5580: 'nbr5580', nbr5590: 'nbr5590',
                    asme_b3610: 'asme', nbr8890: 'nbr8890', nbr15536: 'nbr15536', en1092: 'en1092',
                    nbr12214: 'nbr12214', nbr12215: 'nbr12215', nbr12208: 'nbr12208', tsutiya: 'tsutiya',
                    tsutiya_esgoto: 'tsutiyaEsgoto' };
    c.succao.concat(c.recalque, c.adutoras).forEach(function (r) {
      if (!r.tubo || !r.tubo.cat) return;
      (r.tubo.cat.fonteIds || []).forEach(function (f) {
        if (mapaCat[f] && chaves.indexOf(mapaCat[f]) < 0) chaves.push(mapaCat[f]);
      });
    });
    if (esgoto && chaves.indexOf('nbr12208') < 0) chaves.push('nbr12208');
    if (chaves.indexOf('nbr12214') < 0) chaves.push('nbr12214');

    var refs = chaves.map(function (k) { return MEM.biblio[k]; }).filter(Boolean);
    refs.sort(function (a, b) { return a.ref.localeCompare(b.ref, 'pt-BR'); });
    refs.forEach(function (r) {
      D.add(h('p', { class: 'doc-ref bloco', html: r.ref }));
    });

    return D;
  };

  /* ================================================================
     Capítulo genérico de trechos
     ================================================================ */

  MEM.capituloTrechos = function (D, titulo, trechos, tipo) {
    var st = D.st, ctx = D.ctx;
    var usaHW = st.calculo.metodo === 'hw';
    var g = PDA.H.g;

    D.capitulo(titulo);

    var validos = trechos.filter(function (r) { return r.tubo && r.tubo.item; });
    if (!validos.length) {
      D.p('Não há trechos lançados com diâmetro definido neste grupo.');
      return;
    }

    var intro = {
      succao: 'A tubulação de sucção conduz o fluido do poço até a bomba. As perdas de carga deste trecho ' +
              'entram integralmente no cálculo do NPSH disponível, razão pela qual a velocidade é mantida ' +
              'baixa e o número de singularidades, mínimo ' + D.usar('nbr12214') + '.',
      barrilete: 'O barrilete reúne a descarga dos conjuntos elevatórios até a saída da estação. O trecho ' +
              'individual conduz a vazão de uma bomba; cada trecho do barrilete comum conduz a vazão das ' +
              'bombas que já reuniu, o que é considerado trecho a trecho neste memorial.',
      adutora: 'A adutora conduz a vazão da saída da estação até o ponto de entrega. Quando a linha se ' +
              'ramifica, cada trecho a jusante da derivação conduz a fração de vazão correspondente, com ' +
              'diâmetro próprio.'
    }[tipo];
    D.p(intro);

    var crit = PDA.C.criterioDe(st, ctx, tipo);
    D.p('Os diâmetros foram verificados contra os seguintes critérios: velocidade entre ' + ne(crit.vBom[0]) +
        ' e ' + ne(crit.vBom[1]) + ' m/s (mínima admissível de ' + ne(crit.vMin) + ' m/s e máxima de ' +
        ne(crit.vMax) + ' m/s) e perda de carga unitária de até ' + ne(crit.jMax) + ' m/km' +
        (crit.fonte && MEM.biblio[({ nbr12214: 'nbr12214', nbr12215: 'nbr12215', nbr12208: 'nbr12208' })[crit.fonte]]
          ? ' ' + D.usar(({ nbr12214: 'nbr12214', nbr12215: 'nbr12215', nbr12208: 'nbr12208' })[crit.fonte]) : '') + '.');

    validos.forEach(function (r) {
      D.secao(r.rot);
      var t = r.tubo;
      var dm = t.diM;
      var A = Math.PI * dm * dm / 4;

      D.p('Tubo adotado: ' + t.cat.nome + ', ' + t.item.rot + ', com diâmetro interno de ' + n(t.diMm, 1) +
          ' mm' + (t.item.e ? ' e espessura de parede de ' + n(t.item.e, 1) + ' mm' : '') + '. ' +
          'Extensão de ' + n(r.L, 1) + ' m e vazão de ' + n(r.Q * 1000, 1) + ' L/s' +
          (r.nBombas ? ' (' + r.nBombas + ' bomba(s))' : '') + '.');

      D.formula('v = \\frac{Q}{A} = \\frac{4 \\cdot Q}{\\pi \\cdot D^2}',
        'v é a velocidade média (m/s); Q, a vazão do trecho (m³/s); A, a área da seção (m²); ' +
        'e D, o diâmetro interno (m).', { semNumero: D.equacoes > 6 });
      D.aplicacao('A = \\frac{\\pi \\cdot ' + n(dm, 4) + '^2}{4} = ' + n(A, 5) + '\\ \\text{m}^2',
                  'v = \\frac{4 \\cdot ' + n(r.Q, 4) + '}{\\pi \\cdot ' + n(dm, 4) + '^2} = ' +
                  n(r.v, 3) + '\\ \\text{m/s}');

      if (usaHW) {
        D.aplicacao('J = ' + ne(st.calculo.hwK) + ' \\cdot \\frac{' + n(r.Q, 4) + '^{' + ne(st.calculo.hwExpQ) +
                    '}}{' + n(t.C, 0) + '^{' + ne(st.calculo.hwExpQ) + '} \\cdot ' + n(dm, 4) + '^{' +
                    ne(st.calculo.hwExpD) + '}} = ' + n(r.J, 5) + '\\ \\text{m/m} = ' +
                    n(r.J * 1000, 2) + '\\ \\text{m/km}');
      } else {
        D.aplicacao('Re = \\frac{' + n(r.v, 3) + ' \\cdot ' + n(dm, 4) + '}{' + n(ctx.ni * 1e6, 3) +
                    ' \\cdot 10^{-6}} = ' + n(r.Re / 1000, 0) + ' \\cdot 10^3',
                    '\\frac{\\varepsilon}{D} = \\frac{' + n(t.epsMm, 4) + '}{' + n(t.diMm, 1) + '} = ' +
                    (t.epsMm / t.diMm).toExponential(2).replace('.', ',').replace('e-', ' \\cdot 10^{-') + '}',
                    'f = ' + n(r.f, 5) + '\\qquad \\text{(regime ' + (r.regime || 'turbulento') + ')}',
                    'J = \\frac{' + n(r.f, 5) + ' \\cdot ' + n(r.v, 3) + '^2}{2 \\cdot ' + n(g, 3) +
                    ' \\cdot ' + n(dm, 4) + '} = ' + n(r.J, 5) + '\\ \\text{m/m} = ' +
                    n(r.J * 1000, 2) + '\\ \\text{m/km}');
      }
      D.aplicacao('hf = J \\cdot L = ' + n(r.J, 5) + ' \\cdot ' + n(r.L, 1) + ' = ' + n(r.hf, 3) + '\\ \\text{m}');

      if (r.pecas && r.pecas.length) {
        var somaK = 0, somaH = 0;
        var linhasP = r.pecas.map(function (p) {
          somaK += p.K * p.qtd; somaH += p.h;
          return h('tr', {},
            h('td', { class: 'esq' }, p.rot),
            h('td', {}, ne(p.qtd)),
            h('td', {}, ne(p.K)),
            h('td', {}, n(p.K * p.qtd, 2)),
            h('td', {}, n(p.diMm, 0)),
            h('td', {}, n(p.v, 2)),
            h('td', {}, n(p.h, 4)));
        });
        linhasP.push(h('tr', { class: 'total' },
          h('td', { class: 'esq' }, 'Total'), h('td', {}, ''), h('td', {}, ''),
          h('td', {}, n(somaK, 2)), h('td', {}, ''), h('td', {}, ''), h('td', {}, n(somaH, 4))));
        D.p('As peças e conexões lançadas no trecho, os coeficientes de perda adotados e a fonte de onde ' +
            'foram tomados constam da Tabela ' + (D.tabelas.length + 1) + '.');
        D.tabela('Peças e conexões – ' + r.rot,
          [{ rot: 'Peça', esq: true }, 'Quant.', 'K unitário', 'ΣK', 'DI (mm)', 'v (m/s)', 'hₗ (m)'],
          linhasP, PDA.P.fontePecas.az.replace(/\.$/, '') + '.');
        D.usar('az');
        D.aplicacao('\\Sigma h_l = \\Sigma K \\cdot \\frac{v^2}{2 \\cdot g} = ' + n(somaK, 2) +
                    ' \\cdot \\frac{' + n(r.v, 3) + '^2}{2 \\cdot ' + n(g, 3) + '} = ' +
                    n(r.hl, 3) + '\\ \\text{m}');
      }

      D.aplicacao('h_{total} = hf + \\Sigma h_l = ' + n(r.hf, 3) + ' + ' + n(r.hl, 3) +
                  ' = ' + n(r.htotal, 3) + '\\ \\text{m}');

      var cl = PDA.C.classificar(r.v, r.J, crit);
      D.p('Verificação: velocidade de ' + n(r.v, 2) + ' m/s e perda unitária de ' + n(r.J * 1000, 2) +
          ' m/km — ' + ({ bom: 'dentro das faixas recomendadas', atencao: 'fora da faixa recomendada, porém dentro dos limites admissíveis',
                          ruim: 'FORA dos limites admissíveis', na: 'sem vazão' })[cl.classe] + '.' +
          (cl.classe !== 'bom' ? ' ' + cl.motivos.join('; ') + '.' : ''));
    });

    /* tabela resumo do grupo */
    var somaL = 0, somaHf = 0, somaHl = 0;
    var linhas = validos.map(function (r) {
      somaL += r.L; somaHf += r.hf; somaHl += r.hl;
      return h('tr', {},
        h('td', { class: 'esq' }, r.rot),
        h('td', { class: 'esq' }, r.tubo.item.rot),
        h('td', {}, n(r.tubo.diMm, 1)),
        h('td', {}, n(r.L, 1)),
        h('td', {}, n(r.Q * 1000, 1)),
        h('td', {}, n(r.v, 2)),
        h('td', {}, n(r.J * 1000, 2)),
        h('td', {}, n(r.hf, 3)),
        h('td', {}, n(r.hl, 3)),
        h('td', {}, n(r.htotal, 3)));
    });
    linhas.push(h('tr', { class: 'total' },
      h('td', { class: 'esq' }, 'Total'), h('td', {}, ''), h('td', {}, ''),
      h('td', {}, n(somaL, 1)), h('td', {}, ''), h('td', {}, ''), h('td', {}, ''),
      h('td', {}, n(somaHf, 3)), h('td', {}, n(somaHl, 3)), h('td', {}, n(somaHf + somaHl, 3))));

    D.tabela('Resumo – ' + titulo,
      [{ rot: 'Trecho', esq: true }, { rot: 'Diâmetro', esq: true }, 'DI (mm)', 'L (m)', 'Q (L/s)',
       'v (m/s)', 'J (m/km)', 'hf (m)', 'Σhₗ (m)', 'h total (m)'], linhas,
      'Resultados calculados pelo programa.');

    if (tipo === 'adutora') {
      var v = PDA.C.varrer(st, ctx, validos[0].conj, 'adutoras.0', ctx.nOp);
      var lc = v.linhas.map(function (l) {
        return h('tr', { class: l.rot === validos[0].conj.itemRot ? 'destaque' : null },
          h('td', { class: 'esq' }, l.rot + (l.rot === validos[0].conj.itemRot ? '  (adotado)' : '')),
          h('td', {}, n(l.diMm, 1)),
          h('td', {}, n(l.v, 2)),
          h('td', {}, n(l.jKm, 2)),
          h('td', {}, n(l.htotal, 3)),
          h('td', { class: 'esq' }, ({ bom: 'adequado', atencao: 'atenção', ruim: 'inadequado', na: '—' })[l.classe]));
      });
      D.tabela('Comparação de diâmetros – ' + validos[0].rot,
        [{ rot: 'Diâmetro', esq: true }, 'DI (mm)', 'v (m/s)', 'J (m/km)', 'h total (m)', { rot: 'Situação', esq: true }],
        lc, 'Varredura do catálogo, com os critérios de velocidade e perda unitária adotados.');
      D.p('O diâmetro de Bresse, tomado como referência de ordem de grandeza, resulta entre ' +
          n(v.bresse.k07, 0) + ' e ' + n(v.bresse.k13, 0) + ' mm para a vazão do trecho ' + D.usar('tsutiya') + '.');
    }
  };

  /* ================================================================
     Perfil e envoltórias
     ================================================================ */

  MEM.capituloPerfil = function (D) {
    var st = D.st, ctx = D.ctx, res = D.res;
    var env = res.envoltoria;
    D.capitulo('Perfil da linha e verificação de pressões');
    D.p('O perfil da tubulação foi lançado com ' + env.pontos.length + ' pontos, cobrindo ' +
        n(env.lTrechos, 0) + ' m de extensão. A linha piezométrica em regime permanente foi interpolada a ' +
        'partir das perdas de carga de cada trecho, e a pressão disponível em cada ponto corresponde à ' +
        'diferença entre a linha piezométrica e a cota da geratriz da tubulação.');
    D.p('Sobre a linha piezométrica permanente foram traçadas as envoltórias de pressão máxima e mínima do ' +
        'regime transitório, pela hipótese de anteprojeto em que a sobrepressão vale integralmente na ' +
        'elevatória e decai linearmente até zero no ponto de chegada, onde o nível do reservatório é fixo ' +
        D.usar('porto') + ' ' + MEM.cit('nbr12215') + '.');
    D.usar('nbr12215');
    D.formula('p_{max}(x) = LP(x) + \\Delta h \\cdot ( 1 - \\frac{x}{L} ) - cota(x)',
      'LP(x) é a linha piezométrica em regime permanente (m); \u0394h, a sobrepressão na elevatória (mca); ' +
      'x, a distância desde a elevatória (m); e L, a extensão total da linha (m).');
    D.aplicacao('\\Delta h = ' + n(env.dh, 2) + '\\ \\text{mca}',
                'p_{max} = ' + n(env.criticoMax.pMax, 2) + '\\ \\text{mca}\\qquad \\text{(x = ' +
                n(env.criticoMax.x, 0) + ' m)}',
                'p_{min} = ' + n(env.criticoMin.pMin, 2) + '\\ \\text{mca}\\qquad \\text{(x = ' +
                n(env.criticoMin.x, 0) + ' m)}');

    D.figura('Perfil da linha com a piezométrica e as envoltórias de pressão',
      PDA.Pf.grafico(st, ctx, res),
      'Elaborado pelo programa a partir do perfil lançado e das perdas calculadas.');

    var linhas = env.pontos.map(function (p) {
      return h('tr', {},
        h('td', {}, n(p.x, 1)),
        h('td', { class: 'esq' }, p.rot || '—'),
        h('td', {}, n(p.cota, 2)),
        h('td', {}, n(p.hgl, 2)),
        h('td', {}, n(p.pPerm, 2)),
        h('td', {}, n(p.pMax, 2)),
        h('td', {}, n(p.pMin, 2)),
        h('td', {}, p.pn ? n(p.pn, 0) : '—'),
        h('td', { class: 'esq' }, ({ bom: 'adequado', atencao: 'atenção', ruim: 'verificar', na: '—' })[p.classe]));
    });
    D.tabela('Pressões ao longo da linha', ['Distância (m)', { rot: 'Ponto', esq: true }, 'Cota (m)',
      'L.P. (m)', 'p permanente (mca)', 'p máxima (mca)', 'p mínima (mca)', 'PN (mca)',
      { rot: 'Situação', esq: true }], linhas,
      'Resultados calculados pelo programa.');

    var crit = env.pontos.filter(function (p) { return p.classe === 'ruim'; });
    if (crit.length) {
      D.p('Foram identificados ' + crit.length + ' ponto(s) em que a pressão calculada extrapola os limites ' +
          'adotados. A pré-avaliação do transitório considera a tubulação sem dispositivos de proteção; ' +
          'nesses casos, o passo seguinte é o estudo específico do transitório e o dimensionamento da ' +
          'proteção ' + D.usar('streeter') + '.');
    }
  };

  /* ================================================================
     Resumo das perdas
     ================================================================ */

  MEM.capituloResumo = function (D) {
    var c = D.res.projeto, ctx = D.ctx;
    D.capitulo('Resumo das perdas de carga e altura manométrica');

    var linhas = [
      h('tr', {}, h('td', { class: 'esq' }, 'Altura geométrica (Hg)'), h('td', {}, n(c.HgMax, 3))),
      h('tr', {}, h('td', { class: 'esq' }, 'Perda de carga distribuída na sucção'), h('td', {}, n(c.hfSuccao, 3))),
      h('tr', {}, h('td', { class: 'esq' }, 'Perda de carga localizada na sucção'), h('td', {}, n(c.hlSuccao, 3))),
      h('tr', {}, h('td', { class: 'esq' }, 'Perda de carga distribuída no recalque'), h('td', {}, n(c.hfRecalque, 3))),
      h('tr', {}, h('td', { class: 'esq' }, 'Perda de carga localizada no recalque'), h('td', {}, n(c.hlRecalque, 3))),
      h('tr', { class: 'total' }, h('td', { class: 'esq' }, 'Altura manométrica total (Hm)'), h('td', {}, n(c.Hm, 3)))
    ];
    D.tabela('Composição da altura manométrica', [{ rot: 'Parcela', esq: true }, 'Valor (m)'], linhas,
      'Resultados calculados pelo programa.');

    D.aplicacao('Hm = ' + n(c.HgMax, 3) + ' + ' + n(c.hfSuccao + c.hfRecalque, 3) + ' + ' +
                n(c.hlSuccao + c.hlRecalque, 3) + ' = ' + n(c.Hm, 3) + '\\ \\text{mca}');

    var hTot = c.hSuccao + c.hRecalque;
    D.p('As perdas de carga respondem por ' + n(c.Hm > 0 ? hTot / c.Hm * 100 : 0, 1) + ' % da altura ' +
        'manométrica total, sendo ' + n(hTot > 0 ? (c.hfSuccao + c.hfRecalque) / hTot * 100 : 0, 1) +
        ' % de perda distribuída e ' + n(hTot > 0 ? (c.hlSuccao + c.hlRecalque) / hTot * 100 : 0, 1) +
        ' % de perda localizada. Com o nível de sucção máximo, a altura manométrica se reduz a ' +
        n(c.HmMin, 2) + ' mca.');

    /* cenários */
    var linhasC = D.res.cenarios.map(function (x) {
      return h('tr', { class: x.n === ctx.nOp ? 'destaque' : null },
        h('td', {}, x.n + (x.n === ctx.nOp ? '  (projeto)' : '')),
        h('td', {}, n(x.qTotal * 1000, 1)),
        h('td', {}, n(x.qBomba * 1000, 1)),
        h('td', {}, n(x.Hg, 2)),
        h('td', {}, n(x.hSuccao + x.hRecalque, 2)),
        h('td', {}, n(x.Hm, 2)),
        h('td', {}, n(x.bhpCv, 1)),
        h('td', {}, ne(x.motorCv)));
    });
    D.tabela('Cenários de operação por número de conjuntos',
      ['Bombas', 'Q total (L/s)', 'Q por bomba (L/s)', 'Hg (m)', 'Perdas (m)', 'Hm (mca)',
       'BHP por bomba (cv)', 'Motor (cv)'], linhasC,
      'Resultados calculados pelo programa.');
    D.p('A altura manométrica cresce com a vazão porque as perdas variam aproximadamente com o quadrado dela. ' +
        'Nesta tabela a vazão por bomba é mantida constante, simplificação usual em pré-dimensionamento; ' +
        'o comportamento real em paralelo depende da curva característica dos conjuntos.');
  };

  /* ================================================================
     Bomba
     ================================================================ */

  MEM.capituloBomba = function (D) {
    var st = D.st, ctx = D.ctx, c = D.res.projeto;
    D.capitulo('Conjuntos elevatórios');
    D.p('A potência hidráulica útil corresponde ao produto do peso específico do fluido pela vazão e pela ' +
        'altura manométrica. A potência no eixo resulta da divisão pela eficiência do conjunto ' + D.usar('az') + '.');
    D.formula('P = \\frac{\\gamma \\cdot Q \\cdot Hm}{75 \\cdot \\eta}',
      'P é a potência no eixo (cv); \u03b3, o peso específico do fluido (kgf/m³); Q, a vazão por bomba (m³/s); ' +
      'Hm, a altura manométrica (mca); e \u03b7, o rendimento da bomba (decimal).');
    D.aplicacao('\\gamma = ' + n(ctx.gama, 0) + '\\ \\text{N/m}^3 \\qquad \\text{(a ' +
                ne(st.fluido.temperatura) + ' °C)}',
                'P = \\frac{' + n(ctx.qBomba * 1000, 2) + ' \\cdot ' + n(c.Hm, 2) + '}{75 \\cdot ' +
                n(st.bombas.rendBomba / 100, 2) + '} = ' + n(c.bhpCv, 2) + '\\ \\text{cv} = ' +
                n(c.bhpKw, 2) + '\\ \\text{kW}');
    D.p('Sobre a potência calculada foi aplicada folga de ' + n(c.folgaPct, 0) + ' %, resultando na adoção de ' +
        'motor comercial de ' + ne(c.motorCv) + ' cv (' + n(c.motorKw, 1) + ' kW) por conjunto. ' +
        'Com ' + ctx.nOp + ' conjunto(s) em operação simultânea, a potência instalada em funcionamento é de ' +
        n(c.potTotalKw, 1) + ' kW.');

    var linhas = [
      h('tr', {}, h('td', { class: 'esq' }, 'Vazão por bomba'), h('td', {}, n(ctx.qBomba * 1000, 2) + ' L/s')),
      h('tr', {}, h('td', { class: 'esq' }, 'Altura manométrica'), h('td', {}, n(c.Hm, 2) + ' mca')),
      h('tr', {}, h('td', { class: 'esq' }, 'Rendimento adotado da bomba'), h('td', {}, ne(st.bombas.rendBomba) + ' %')),
      h('tr', {}, h('td', { class: 'esq' }, 'Potência útil'), h('td', {}, n(c.potUtilCv, 2) + ' cv')),
      h('tr', {}, h('td', { class: 'esq' }, 'Potência no eixo (BHP)'), h('td', {}, n(c.bhpCv, 2) + ' cv  (' + n(c.bhpKw, 2) + ' kW)')),
      h('tr', {}, h('td', { class: 'esq' }, 'Folga aplicada'), h('td', {}, n(c.folgaPct, 0) + ' %')),
      h('tr', { class: 'total' }, h('td', { class: 'esq' }, 'Motor comercial adotado'), h('td', {}, ne(c.motorCv) + ' cv  (' + n(c.motorKw, 1) + ' kW)')),
      st.bombas.usarRendMotor ? h('tr', {}, h('td', { class: 'esq' }, 'Potência elétrica consumida por bomba'), h('td', {}, n(c.eletricaKw, 2) + ' kW')) : null,
      h('tr', {}, h('td', { class: 'esq' }, 'Conjuntos instalados / em operação'), h('td', {}, ctx.nInst + ' / ' + ctx.nOp))
    ].filter(Boolean);
    D.tabela('Dimensionamento dos conjuntos elevatórios', [{ rot: 'Item', esq: true }, 'Valor'], linhas,
      'Resultados calculados pelo programa; linha de motores comerciais conforme a norma IEC.');
  };

  /* ================================================================
     NPSH
     ================================================================ */

  MEM.capituloNPSH = function (D) {
    var st = D.st, ctx = D.ctx, c = D.res.projeto;
    D.capitulo('NPSH disponível');
    D.p('O NPSH disponível é uma propriedade da instalação e corresponde à energia absoluta disponível na ' +
        'entrada da bomba, acima da pressão de vaporização do fluido. A instalação é viável quando o NPSH ' +
        'disponível supera o NPSH requerido pela bomba, obtido na curva do fabricante, com margem de segurança ' +
        D.usar('nbr12214') + ' ' + MEM.cit('tsutiya') + '.');
    D.usar('tsutiya');
    D.formula('NPSH_d = \\frac{p_{atm} - p_v}{\\gamma} \\pm z - hf_{suc}',
      'p_{atm} é a pressão atmosférica local; p_v, a pressão de vapor do fluido na temperatura de trabalho; ' +
      'z, o desnível entre o nível de sucção e o eixo da bomba, positivo quando a bomba está afogada; ' +
      'e hf_{suc}, a perda de carga total na sucção.');
    D.aplicacao('\\frac{p_{atm}}{\\gamma} = ' + n(ctx.patm, 3) + '\\ \\text{mca} \\qquad ' +
                  '\\text{(altitude de ' + ne(st.fluido.altitude) + ' m)}',
                '\\frac{p_v}{\\gamma} = ' + n(ctx.pvapor, 3) + '\\ \\text{mca} \\qquad \\text{(a ' +
                  ne(st.fluido.temperatura) + ' °C)}',
                'z = ' + n(st.cotas.nivelSuccaoMin, 2) + ' - ' + n(st.cotas.eixoBomba, 2) + ' = ' +
                  n(c.zSuccao, 2) + '\\ \\text{m} \\qquad \\text{(bomba ' +
                  (c.zSuccao >= 0 ? 'afogada' : 'aspirando') + ')}',
                'hf_{suc} = ' + n(c.hSuccao, 4) + '\\ \\text{m}',
                'NPSH_d = ' + n(ctx.patm, 3) + ' - ' + n(ctx.pvapor, 3) + ' + ( ' + n(c.zSuccao, 2) + ' ) - ' +
                  n(c.hSuccao, 4) + ' = ' + n(c.npshd, 3) + '\\ \\text{mca}');

    if (st.curvaBomba && st.curvaBomba.npshr) {
      var margem = c.npshd - Number(st.curvaBomba.npshr);
      D.p('O NPSH requerido informado para a bomba é de ' + ne(st.curvaBomba.npshr) + ' mca, resultando em ' +
          'margem de ' + n(margem, 2) + ' mca. ' +
          (margem < 0.5 ? 'A margem é inferior a 0,5 mca, valor mínimo usualmente recomendado — a configuração ' +
            'da sucção deve ser revista.' : 'A margem atende à recomendação usual de 0,5 a 1,0 mca.'));
    } else {
      D.p('O NPSH requerido deve ser obtido na curva característica da bomba selecionada e comparado ao valor ' +
          'acima, adotando-se margem mínima da ordem de 0,5 a 1,0 mca.');
    }

    D.figura('Composição do NPSH disponível', PDA.Q.npsh(st, ctx, c),
      'Elaborado pelo programa a partir dos dados do projeto.');
  };

  /* ================================================================
     Curva do sistema e ponto de operação
     ================================================================ */

  MEM.capituloOperacao = function (D) {
    var st = D.st, ctx = D.ctx, res = D.res;
    var op = res.operacao, cv = res.curvaBomba;
    D.capitulo('Curva do sistema e ponto de operação');
    D.p('A curva do sistema representa a altura manométrica exigida pela instalação em função da vazão, para ' +
        'os diâmetros e as singularidades adotados. O ponto de operação real é a interseção entre a curva do ' +
        'sistema e a curva característica da bomba ' + D.usar('az') + '.');
    D.formula('H_{sistema}(Q) = Hg + \\Sigma hf(Q) + \\Sigma h_l(Q)', null);
    D.p('A curva da bomba foi ajustada por mínimos quadrados sobre os pontos informados, na forma polinomial ' +
        'de segundo grau usual para bombas centrífugas.');
    D.formula('H_{bomba}(Q) = a_0 + a_1 \\cdot Q + a_2 \\cdot Q^2', null);
    D.aplicacao('a_0 = ' + n(cv.a0, 4) + '\\qquad a_1 = ' + n(cv.a1, 4) + '\\qquad a_2 = ' + n(cv.a2, 4),
                { rot: 'com H em mca e Q em m³/s.' });

    var linhasP = cv.pontos.map(function (p) {
      return h('tr', {}, h('td', {}, n(p.q * 1000, 1)), h('td', {}, n(p.H, 2)),
        h('td', {}, n(cv.H(p.q), 2)), h('td', {}, n(cv.H(p.q) - p.H, 3)));
    });
    D.tabela('Pontos da curva característica da bomba',
      ['Q (L/s)', 'H informado (mca)', 'H ajustado (mca)', 'Desvio (mca)'], linhasP,
      'Pontos informados a partir da curva do fabricante.');

    D.aplicacao({ rot: 'Ponto de operação com ' + op.n + ' bomba(s):' },
                'Q = ' + n(op.qTotal * 1000, 2) + '\\ \\text{L/s} \\qquad \\text{(' +
                  n(op.qBomba * 1000, 2) + ' L/s por bomba)}',
                'H = ' + n(op.H, 2) + '\\ \\text{mca}',
                'P = ' + n(op.bhpCv, 2) + '\\ \\text{cv por bomba}',
                '\\Delta Q = ' + n(op.desvioQ, 1) + '\\ \\text{% em relação à vazão de projeto}');

    D.figura('Curva do sistema e curva da bomba, com o ponto de operação',
      PDA.F.graficoCurvas(st, ctx, res),
      'Elaborado pelo programa a partir da curva informada e dos diâmetros adotados.');

    if (res.operacaoPorN && res.operacaoPorN.length > 1) {
      var linhasN = res.operacaoPorN.map(function (x, i) {
        if (!x.op || x.op.erro) {
          return h('tr', {}, h('td', {}, x.n), h('td', { class: 'esq', colspan: 5 }, x.op ? x.op.erro : '—'));
        }
        /* o ganho só faz sentido quando o cenário anterior também tem interseção */
        var pre = i > 0 ? res.operacaoPorN[i - 1].op : null;
        var temAnt = !!(pre && !pre.erro);
        return h('tr', { class: x.n === ctx.nOp ? 'destaque' : null },
          h('td', {}, x.n), h('td', {}, n(x.op.qTotal * 1000, 1)), h('td', {}, n(x.op.qBomba * 1000, 1)),
          h('td', {}, n(x.op.H, 2)), h('td', {}, n(x.op.bhpCv, 1)),
          h('td', {}, temAnt ? '+' + n((x.op.qTotal - pre.qTotal) * 1000, 1) : '—'));
      });
      D.tabela('Operação em paralelo', ['Bombas', 'Q total (L/s)', 'Q por bomba (L/s)', 'H (mca)',
        'BHP por bomba (cv)', 'Ganho de vazão (L/s)'], linhasN,
        'Resultados calculados pelo programa.');
      D.p('Em associação em paralelo o ganho de vazão obtido ao acionar um conjunto adicional é sempre inferior ' +
          'à vazão de uma bomba operando isoladamente, porque a altura exigida pelo sistema cresce com a vazão.');
    }
  };

  /* ================================================================
     Blocos de ancoragem
     ================================================================ */

  MEM.capituloBlocos = function (D) {
    var st = D.st, ctx = D.ctx, res = D.res;
    var infos = PDA.C.blocosResolvidos(st, ctx, res)
      .filter(function (i) { return i.deMm > 0 && i.pMca > 0; });
    if (!infos.length) return;

    D.capitulo('Blocos de ancoragem');
    D.p('Nas mudanças de direção e de seção de tubulação com junta não travada, a pressão interna gera um ' +
        'empuxo que precisa ser transmitido ao terreno por blocos de ancoragem. O empuxo foi calculado com o ' +
        'diâmetro EXTERNO do tubo, porque a pressão atua na seção da junta ' + D.usar('az') + ' ' +
        MEM.cit('m41') + '.');
    D.usar('m41');
    D.formula(['E = p \\cdot A', 'E = 2 \\cdot p \\cdot A \\cdot sen ( \\frac{\\theta}{2} )',
               'E = p \\cdot ( A_1 - A_2 )'],
      'E é o empuxo (kgf); p, a pressão de cálculo (mca, tomada como kgf/m² por metro de coluna); ' +
      'A, a área da seção externa do tubo (m²); \u03b8, o ângulo da curva. A primeira forma vale para ' +
      'extremidades, tês e válvulas fechadas; a segunda, para curvas; a terceira, para reduções.');

    D.p('Cada bloco foi pré-dimensionado por duas vias: a seleção entre os blocos padronizados da ' +
        'concessionária, pela capacidade tabelada por DN e recobrimento, e a verificação clássica de apoio ' +
        'no solo, em que a área de encosto na parede não escavada da vala deve transmitir o empuxo majorado ' +
        'sem exceder a tensão admissível do terreno ' + MEM.cit('m41') + '.');
    D.formula('A_{nec} = \\frac{FS \\cdot E}{\\sigma_{adm}}',
      'A_{nec} é a área de encosto necessária (m²); FS, o fator de segurança adotado (' +
      ne(st.blocos.fs) + '); e \u03c3_{adm}, a tensão admissível de apoio do solo (kgf/m²).');

    infos.forEach(function (info) {
      var calc = info.calc;
      D.secao(info.b.rot + ' — ' + PDA.BA.peca(info.b.pecaId).rot +
              (info.dn ? ', DN ' + info.dn : ''));
      D.p('Tubo com DE de ' + n(info.deMm, 1) + ' mm' +
          (info.trechoRot ? ' (herdado de ' + info.trechoRot + ')' : '') +
          '. Pressão de cálculo de ' + n(info.pMca, 1) + ' mca — ' + info.pOrigem + '. ' +
          'Solo de apoio: ' + calc.solo.rot.toLowerCase() + ', com σ admissível de ' +
          n(calc.sigma, 0) + ' kgf/m².');

      D.aplicacao('E = ' + n(calc.unit, 2) + ' \\cdot ' + n(info.pMca, 1) + ' = ' +
                  n(calc.E, 0) + '\\ \\text{kgf}' );

      if (calc.orientacao === 'horizontal') {
        var adotado = calc.escolhido ||
          (calc.padrao && calc.padrao.achou ? calc.padrao.linha : null);
        if (adotado) {
          var tipoN = calc.escolhido ? calc.escolhido.tipo : calc.padrao.linha.tipo;
          var recAd = calc.escolhido ? info.b.recobrimento : calc.padrao.rec;
          D.p('Bloco padronizado adotado: tipo ' + tipoN + ' (capacidade de ' +
              n(adotado.cap || 0, 0) + ' kgf com recobrimento de ' + ne(recAd) +
              ' m), com ' + n(adotado.concreto, 2) + ' m³ de concreto, ' + n(adotado.forma, 2) +
              ' m² de forma e ' + n(adotado.aco, 0) + ' kg de aço.');
        } else {
          D.p('Nenhum bloco padronizado resiste ao empuxo — vale o bloco calculado pelo apoio.');
        }
        if (calc.apoio && calc.apoio.ok) {
          D.aplicacao('A_{nec} = \\frac{' + ne(st.blocos.fs) + ' \\cdot ' + n(calc.E, 0) + '}{' +
                      n(calc.sigma, 0) + '} = ' + n(calc.apoio.Anec, 2) + '\\ \\text{m}^2',
                      { rot: 'Encosto sugerido: ' + n(calc.apoio.b, 2) + ' × ' + n(calc.apoio.L, 2) +
                        ' m (' + n(calc.apoio.Aefetiva, 2) + ' m²), com ' + n(calc.apoio.concreto, 2) +
                        ' m³ de concreto.' });
        }
      } else if (calc.orientacao === 'vert_cima' && calc.peso) {
        D.p('Curva vertical convexa: o empuxo é ascendente e a resistência vem do peso próprio do bloco.');
        D.aplicacao('G = ' + ne(st.blocos.fs) + ' \\cdot ' + n(calc.E, 0) + ' = ' + n(calc.peso.G, 0) +
                    '\\ \\text{kgf}',
                    'V = \\frac{' + n(calc.peso.G, 0) + '}{' + ne(st.blocos.gamaConcreto) + '} = ' +
                    n(calc.peso.concreto, 2) + '\\ \\text{m}^3');
      } else if (calc.apoio && calc.apoio.ok) {
        D.p('Curva vertical côncava: o empuxo é descendente, apoiado no fundo da vala.');
        D.aplicacao('A_{nec} = \\frac{' + ne(st.blocos.fs) + ' \\cdot ' + n(calc.E, 0) + '}{' +
                    n(calc.sigma, 0) + '} = ' + n(calc.apoio.Anec, 2) + '\\ \\text{m}^2');
      }
      info.avisos.forEach(function (avz) { D.nota('Atenção: ' + avz); });
    });

    /* tabela-resumo */
    var linhasB = infos.map(function (info) {
      var calc = info.calc;
      var adot = calc.escolhido || (calc.padrao && calc.padrao.achou ? calc.padrao.linha : null);
      return h('tr', {},
        h('td', { class: 'esq' }, info.b.rot),
        h('td', { class: 'esq' }, PDA.BA.peca(info.b.pecaId).rot),
        h('td', {}, info.dn ? String(info.dn) : '—'),
        h('td', {}, n(info.deMm, 0)),
        h('td', {}, n(info.pMca, 1)),
        h('td', {}, n(calc.E, 0)),
        h('td', { class: 'esq' }, calc.orientacao === 'horizontal'
          ? (adot ? 'tipo ' + (calc.escolhido ? calc.escolhido.tipo : calc.padrao.linha.tipo) : 'calculado')
          : (calc.orientacao === 'vert_cima' ? 'peso' : 'apoio no fundo')),
        h('td', {}, adot ? n(adot.concreto, 2)
          : (calc.peso ? n(calc.peso.concreto, 2)
            : (calc.apoio && calc.apoio.ok ? n(calc.apoio.concreto, 2) : '—'))));
    });
    D.tabela('Blocos de ancoragem', [{ rot: 'Bloco', esq: true }, { rot: 'Peça', esq: true },
      'DN', 'DE (mm)', 'p (mca)', 'E (kgf)', { rot: 'Solução', esq: true }, 'Concreto (m³)'], linhasB,
      'Resultados calculados pelo programa; blocos padronizados conforme padrão da concessionária.');

    D.p('O dimensionamento acima é de anteprojeto e considera o empuxo transmitido a solo firme, não ' +
        'escavado. Blocos de grande porte, solos moles e travessias exigem verificação geotécnica e ' +
        'estrutural específicas.');
  };

  /* ================================================================
     Transitório
     ================================================================ */

  MEM.capituloTransitorio = function (D) {
    var st = D.st, res = D.res;
    D.capitulo('Transitório hidráulico – pré-avaliação');
    D.p('A parada abrupta dos conjuntos ou o fechamento rápido de uma válvula provocam variação brusca da ' +
        'velocidade e, em consequência, sobrepressões e subpressões que se propagam pela tubulação com ' +
        'celeridade própria do conjunto fluido-tubo ' + D.usar('streeter') + '. A verificação a seguir é ' +
        'preliminar e destina-se a conferir se a classe de pressão adotada possui folga.');
    D.formula('a = \\frac{1}{\\sqrt{\\rho \\cdot ( \\frac{1}{K} + \\frac{\\psi \\cdot D}{e \\cdot E} )}}',
      'a é a celeridade da onda (m/s); \u03c1, a massa específica do fluido (kg/m³); K, o módulo de ' +
      'elasticidade volumétrica da água, 2,19 GPa; \u03c8, o coeficiente de ancoragem longitudinal; ' +
      'D, o diâmetro interno (m); e, a espessura de parede (m); e E, o módulo de elasticidade do material (Pa).');
    var anc = PDA.H.ancoragem.filter(function (a) { return a.id === (st.golpe.ancoragem || 'juntas'); })[0];
    D.p('Foi adotada a condição de ancoragem "' + (anc ? anc.rot.toLowerCase() : '—') + '" ' +
        D.usar('halliwell') + '.');
    D.formula('t_c = \\frac{2 \\cdot L}{a} \\qquad \\Delta h = \\frac{a \\cdot \\Delta v}{g}',
      't_c é o tempo crítico de manobra (s); e \u0394v, a variação de velocidade (m/s). ' +
      'Vale para manobra rápida, isto é, quando o tempo de manobra é menor que t_c.');
    D.formula('\\Delta h = \\frac{2 \\cdot L \\cdot v}{g \\cdot t}',
      't é o tempo de manobra (s). Vale para manobra lenta, quando t é maior que t_c.');
    D.usar('joukowsky');

    res.golpe.forEach(function (g) {
      D.aplicacao({ rot: g.rot + ':' },
        'a = ' + n(g.celeridade, 0) + '\\ \\text{m/s} \\qquad \\text{(E = ' + n(g.E_GPa, 0) +
          ' GPa; \u03bd = ' + ne(g.nu) + '; \u03c8 = ' + n(g.psi, 3) + '; e = ' + n(g.eMm, 1) + ' mm)}',
        't_c = \\frac{2 \\cdot ' + n(g.L, 0) + '}{' + n(g.celeridade, 0) + '} = ' + n(g.tempoCritico, 2) +
          '\\ \\text{s} \\qquad \\text{(manobra ' + (g.manobraRapida ? 'rápida' : 'lenta') +
          ', com t = ' + ne(g.tempoManobra) + ' s)}',
        '\\Delta h = ' + n(g.dh, 1) + '\\ \\text{mca}',
        'p_{max} = Hm + \\Delta h = ' + n(g.pressaoMaxMca, 1) + '\\ \\text{mca}' +
          (g.pnMca ? '\\qquad \\text{(admissível do tubo: ' + n(g.pnMca, 0) + ' mca)}' : ''));
    });

    var linhas = res.golpe.map(function (g) {
      return h('tr', {},
        h('td', { class: 'esq' }, g.rot),
        h('td', {}, n(g.celeridade, 0)),
        h('td', {}, n(g.tempoCritico, 2)),
        h('td', { class: 'esq' }, g.manobraRapida ? 'rápida' : 'lenta'),
        h('td', {}, n(g.dh, 1)),
        h('td', {}, n(g.pressaoMaxMca, 1)),
        h('td', {}, n(g.pressaoMinMca, 1)),
        h('td', {}, g.pnMca ? n(g.pnMca, 0) : '—'),
        h('td', { class: 'esq' }, g.atende === null ? 'PN não informado' : (g.atende ? 'atende' : 'NÃO atende')));
    });
    D.tabela('Pré-avaliação do transitório hidráulico',
      [{ rot: 'Trecho', esq: true }, 'Celeridade (m/s)', 't_c (s)', { rot: 'Manobra', esq: true },
       'Δh (mca)', 'p máx. (mca)', 'p mín. (mca)', 'PN (mca)', { rot: 'Situação', esq: true }], linhas,
      'Resultados calculados pelo programa.');

    D.p('ALCANCE DESTA VERIFICAÇÃO: o cálculo considera a tubulação sem dispositivos de proteção — não foram ' +
        'considerados tanque de alívio, chaminé de equilíbrio, válvula antecipadora de onda, ventosa de duplo ' +
        'efeito ou volante de inércia. Também não foram integradas as equações do transitório pelo método das ' +
        'características, nem representadas as reflexões de onda nas mudanças de diâmetro e de material, nem ' +
        'modelada a separação e o retorno da coluna líquida. Caso a sobrepressão exceda a classe de pressão da ' +
        'tubulação, o encaminhamento adequado não é o aumento da espessura de parede, e sim o dimensionamento ' +
        'da proteção mediante estudo específico ' + D.usar('streeter') + '.');
  };

  /* ================================================================
     Introdução gerada a partir dos dados
     ================================================================ */

  MEM.introducaoPadrao = function (st, ctx, res) {
    var c = res.projeto;
    var fl = PDA.R.fluidos.filter(function (f) { return f.id === st.fluido.tipo; })[0];
    var esgoto = ctx.familiaCriterio === 'esgoto';
    var extensao = 0;
    c.adutoras.forEach(function (r) { extensao += r.L; });
    var mats = {};
    c.adutoras.forEach(function (r) { if (r.tubo && r.tubo.cat) mats[r.tubo.cat.familia] = true; });
    var listaMat = Object.keys(mats);

    var p1 = 'O presente memorial apresenta o pré-dimensionamento hidráulico da ' +
      (esgoto ? 'linha de recalque' : 'adutora') + ' do ' +
      (st.projeto.nome ? '"' + st.projeto.nome + '"' : 'empreendimento em estudo') +
      (st.projeto.local ? ', localizado em ' + st.projeto.local : '') + '. ' +
      'O sistema foi concebido para transportar ' + (fl ? fl.rot.toLowerCase() : 'o fluido') +
      ' a uma vazão de projeto de ' + n(ctx.qTotal * 1000, 1) + ' L/s (' + n(ctx.qTotal * 3600, 1) + ' m³/h), ' +
      'por meio de ' + ctx.nInst + ' conjunto(s) elevatório(s), sendo ' + ctx.nOp +
      ' em operação simultânea na condição de projeto.';

    var p2 = 'A ' + (esgoto ? 'linha de recalque' : 'adutora') + ' possui extensão total de ' +
      n(extensao, 0) + ' m' + (listaMat.length ? ', em ' + listaMat.join(' e ') : '') + ', vencendo ' +
      'desnível geométrico de ' + n(c.HgMax, 2) + ' m entre a cota de partida (' +
      n(PDA.C.cotaPartida(st), 2) + ' m) e a cota de chegada (' + n(st.cotas.nivelChegada, 2) + ' m). ' +
      'Da condição adotada resulta altura manométrica total de ' + n(c.Hm, 2) + ' mca e potência de eixo de ' +
      n(c.bhpCv, 1) + ' cv por conjunto, para a qual se adotam motores comerciais de ' + ne(c.motorCv) + ' cv.';

    var p3 = 'O estudo compreende o dimensionamento das tubulações de sucção e recalque, a verificação das ' +
      'velocidades e das perdas de carga, o cálculo da altura manométrica e da potência dos conjuntos, ' +
      'a verificação do NPSH disponível e a pré-avaliação do regime transitório. ' +
      'Os critérios, coeficientes e formulações adotados estão indicados ao longo do texto, com as ' +
      'respectivas referências.';

    return p1 + '\n\n' + p2 + '\n\n' + p3;
  };

  PDA.MEM = MEM;
})(window.PDA = window.PDA || {});
