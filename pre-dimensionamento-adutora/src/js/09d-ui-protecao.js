/* ------------------------------------------------------------------
 * Aba Transitório e proteção.
 *
 * Parte do que a pré-avaliação já mostra (a linha SEM proteção) e dá o
 * passo seguinte: o requisito que a proteção precisa cumprir, os pontos
 * sugeridos de instalação, o pré-dimensionamento de RHO, TAU, chaminé e
 * ventosas — com alerta de sub/superdimensionamento — e a envoltória
 * COM a proteção lançada, para ver a linha caber no tubo.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var UP = {};
  var UI, h, PR;

  UP.init = function () { UI = PDA.UI; h = UI.h; PR = PDA.PR; };

  var TIPOS = [
    { id: 'rho', rot: 'RHO — reservatório hidropneumático',
      desc: 'Vaso com colchão de ar junto ao barrilete: amortece a parada da bomba pelos dois lados (sobrepressão e depressão). É a proteção padrão de linha de recalque.' },
    { id: 'tau', rot: 'TAU — tanque alimentador unidirecional',
      desc: 'Tanque aberto com válvula de retenção: injeta água quando a pressão local cai, preenchendo a zona de depressão. Usual a jusante de pontos altos.' },
    { id: 'chamine', rot: 'Chaminé de equilíbrio',
      desc: 'Tubo vertical aberto ligado à linha: reflete a onda. Só é prática onde a piezométrica passa perto do terreno.' },
    { id: 'ventosa', rot: 'Ventosa',
      desc: 'Admissão e expulsão de ar nos pontos altos. Protege contra depressão e viabiliza enchimento/esvaziamento — não substitui o RHO na sobrepressão.' }
  ];

  function tipoDe(id) { return TIPOS.filter(function (t) { return t.id === id; })[0] || TIPOS[0]; }

  /* ================================================================
     Requisito
     ================================================================ */

  function cartaoRequisito(st, ctx, res, req) {
    if (!req) {
      return UI.cartao('Requisito da proteção', null, h('div', { class: 'aviso info' },
        'Avalie o golpe de aríete (cartão acima) e, de preferência, lance o perfil da linha — o requisito da ' +
        'proteção sai da envoltória de pressões.'));
    }
    var corpo = [
      h('div', { class: 'grade' },
        UI.campo(st, 'Folga abaixo do PN (mca)', 'protecao.folgaPN', {
          dica: 'Margem mantida entre a envoltória máxima protegida e a pressão admissível do tubo. Usual: 5 a 10 mca.' }),
        UI.campo(st, 'Pressão mínima admitida (mca)', 'protecao.pMinAlvo', {
          dica: 'Piso da envoltória mínima protegida. 0 evita pressão negativa; valores negativos até −5 mca podem ser aceitos em trechos curtos, a critério do projetista.' })),
      h('div', { class: 'faixa-resumo', style: 'margin-top:10px' },
        h('span', { class: 'chip' }, h('b', {}, 'Δh sem proteção: '), UI.num(req.dhSemProtecao, 1) + ' mca'),
        req.dhAlvo !== null ? h('span', { class: 'chip ' + (req.precisa ? 'forte' : '') },
          h('b', {}, 'Δh que a linha tolera: '), UI.num(req.dhAlvo, 1) + ' mca') : null,
        req.dhAdmSobre !== null ? h('span', { class: 'chip' },
          h('b', {}, 'limite por sobrepressão: '), UI.num(req.dhAdmSobre, 1) + ' mca') : null,
        req.dhAdmSub !== null ? h('span', { class: 'chip' },
          h('b', {}, 'limite por depressão: '), UI.num(req.dhAdmSub, 1) + ' mca') : null,
        req.dhAdmSub === null && req.temAlivio && req.aliviadosSub > 0 ? h('span', { class: 'chip bom' },
          h('b', {}, 'depressão: '), 'coberta pelos dispositivos lançados') : null),
      req.temAlivio && req.aliviadosSub > 0 ? h('div', { class: 'aviso ok', style: 'margin-top:9px' },
        h('b', {}, 'Os dispositivos conversam entre si. '),
        'Ventosas de admissão, TAU e chaminé lançados cobrem a depressão em ' + req.aliviadosSub +
        ' ponto(s) do perfil — esses pontos saíram do requisito de subpressão do RHO' +
        (req.dhAdmSubBruto !== null && req.dhAdmSub !== null && req.dhAdmSub > req.dhAdmSubBruto + 0.05
          ? ' (o limite por depressão subiu de ' + UI.num(req.dhAdmSubBruto, 1) + ' para ' +
            UI.num(req.dhAdmSub, 1) + ' mca)'
          : (req.dhAdmSub === null ? ' (a depressão deixou de governar o RHO)' : '')) +
        ', e o volume necessário do RHO cai de acordo.') : null,
      req.permInviavel && req.permInviavel.length ? h('div', { class: 'aviso erro', style: 'margin-top:9px' },
        h('b', {}, 'Há ponto fora já em REGIME PERMANENTE — proteção de transitório não resolve isso. '),
        req.permInviavel.slice(0, 3).map(function (p) {
          return 'Na distância ' + UI.num(p.xEscalado, 0) + ' m (cota ' + UI.num(p.cota, 1) +
                 ' m) a pressão permanente é ' + UI.num(p.pPerm, 1) + ' mca. ';
        }).join('') +
        (req.permInviavel.length > 3 ? '(+' + (req.permInviavel.length - 3) + ' ponto(s)) ' : '') +
        'A causa é diâmetro, traçado ou altura manométrica — veja o aviso do ponto alto no Resumo. ' +
        'O requisito abaixo vale para os demais pontos.') : null,
      req.precisa
        ? h('div', { class: 'aviso erro', style: 'margin-top:9px' },
            h('b', {}, 'A linha NÃO passa sem proteção. '),
            'O golpe sem proteção gera Δh de ' + UI.num(req.dhSemProtecao, 1) + ' mca e a linha só tolera ' +
            UI.num(req.dhAlvo, 1) + ' mca — o requisito é limitar o transitório a esse valor. O caso governante é a ' +
            req.governante +
            (req.pontoSobre && req.governante === 'sobrepressão'
              ? ', na distância ' + UI.num(req.pontoSobre.xEscalado, 0) + ' m (PN ' + UI.num(req.pontoSobre.pn, 0) + ' mca)'
              : (req.pontoSub ? ', na distância ' + UI.num(req.pontoSub.xEscalado, 0) + ' m' : '')) + '.')
        : h('div', { class: 'aviso ok', style: 'margin-top:9px' },
            'Com a folga adotada, a envoltória sem proteção já cabe no tubo. Ventosas para ar e ' +
            'esvaziamento continuam necessárias; RHO/TAU ficam a critério.'),
      req.temPerfil ? null : h('div', { class: 'aviso', style: 'margin-top:8px' },
        'Sem o perfil da linha o requisito olha apenas a elevatória. Lance o perfil (bastam os pontos ' +
        'notáveis) para o requisito valer ponto a ponto e para o programa sugerir onde instalar cada dispositivo.')
    ];
    return UI.cartao('Requisito da proteção',
      'Quanto o transitório precisa ser limitado para a linha caber no tubo', corpo,
      UI.botaoFonte ? null : null);
  }

  /* ================================================================
     Pontos sugeridos
     ================================================================ */

  function cartaoPontos(st, ctx, res) {
    var pts = PR.pontosSugeridos(st, ctx, res);
    if (!pts.length) return null;
    var linhas = pts.map(function (p) {
      var fn = PR.FUNCOES_VENTOSA.filter(function (f) { return f.id === p.funcao; })[0];
      return h('tr', { class: p.critico ? 'atencao' : '' },
        h('td', {}, UI.num(p.x, 0)),
        h('td', {}, UI.num(p.cota, 2)),
        h('td', { class: 'esq' }, p.motivo + (p.critico ? ' — envoltória mínima NEGATIVA aqui' : '')),
        h('td', { class: 'esq' }, fn ? fn.rot : p.funcao),
        h('td', {}, h('button', { class: 'btn mini', type: 'button', 'data-acao': 'protVentosaAqui',
          'data-x': p.x, 'data-funcao': p.funcao }, '+ Ventosa aqui'),
          p.critico ? h('button', { class: 'btn mini', type: 'button', 'data-acao': 'protTauAqui',
            'data-x': p.x, style: 'margin-left:5px' }, '+ TAU aqui') : null));
    });
    return UI.cartao('Pontos sugeridos de instalação', 'Lidos do perfil da linha',
      h('div', {},
        UI.tabela(['Distância (m)', 'Cota (m)', { rot: 'Por quê', esq: true },
          { rot: 'Função sugerida', esq: true }, 'Lançar'], linhas),
        h('p', { class: 'nota', style: 'margin-top:6px' },
          'Pontos altos pedem ventosa de admissão (tríplice; quádrupla non-slam quando a depressão é severa). ' +
          'Nos trechos longos sem ponto notável, a prática usual é uma ventosa a cada 500–800 m.')));
  }

  /* ================================================================
     Cartão de um dispositivo
     ================================================================ */

  function corpoRho(st, ctx, res, req, d, i, aval) {
    var rho = aval.rho;
    var base = 'protecao.dispositivos.' + i;
    if (!rho) return h('div', { class: 'aviso' }, aval.avisos[0] || '—');
    var linhas = PR.VOLUMES_RHO.map(function (v) {
      var atende = v >= rho.vTanque - 1e-9;
      var sugerido = v === rho.comercial;
      var sel = Number(d.volumeM3) === v;
      return h('tr', {
        class: (atende ? (sugerido ? 'bom' : '') : 'ruim') + (sel ? ' selecionada' : ''),
        style: 'cursor:pointer', 'data-acao': 'protVolume', 'data-i': i, 'data-v': v,
        title: atende ? 'Clique para adotar' : 'Não segura o Δh alvo'
      },
        h('td', { class: 'esq' }, sugerido ? h('span', { style: 'color:var(--teal-vivo)' }, '★ ') : null,
          UI.numEdit(v) + ' m³'),
        h('td', {}, (function () {
          var eff = PR.dhComRho(st, ctx, res, v);
          if (!eff) return '—';
          return eff.dh > 999 ? '> 1000' : UI.num(eff.dh, 1);
        })()),
        h('td', {}, UI.tagClasse(atende ? 'bom' : 'ruim')));
    });
    return h('div', {},
      h('div', { class: 'blocos-vias' },
        h('div', { class: 'via' },
          h('h4', {}, 'Pré-dimensionamento (coluna rígida, ar isotérmico)',
            UI.dica('A energia cinética da coluna d\'água (½·m·v²) é absorvida pelo trabalho do ar: KE = γ·p₀·V₀·ln(p₁/p₀). O maior volume entre o caso de sobrepressão e o de depressão, com 20 % de folga; o tanque é o dobro do ar (ar ≈ 50 % em regime). TSUTIYA; STEPHENSON. É anteprojeto: o volume final sai do estudo de transiente.')),
          h('table', { class: 'tab-apoio' }, h('tbody', {},
            h('tr', {}, h('td', { class: 'esq' }, 'Coluna d\'água (L, v₀)'),
              h('td', {}, UI.num(rho.L, 0) + ' m · ' + UI.num(rho.v0, 2) + ' m/s')),
            h('tr', {}, h('td', { class: 'esq' }, 'Energia cinética da coluna'),
              h('td', {}, UI.num(rho.KE / 1000, 1) + ' kJ')),
            h('tr', {}, h('td', { class: 'esq' }, 'Pressões absolutas (p₀ / p₁ / p₂)'),
              h('td', {}, UI.num(rho.p0, 1) + ' / ' + UI.num(rho.p1, 1) + ' / ' + UI.num(rho.p2, 1) + ' mca')),
            h('tr', {}, h('td', { class: 'esq' }, 'Ar necessário (governa a ' + rho.governa + ')'),
              h('td', {}, UI.num(rho.v0Ar, 2) + ' m³')),
            h('tr', { class: 'total' }, h('td', { class: 'esq' }, 'Volume do tanque (ar ≈ 50 %)'),
              h('td', {}, h('b', {}, UI.num(rho.vTanque, 1) + ' m³'))))),
          UI.campo(st, 'Volume adotado (m³)', base + '.volumeM3',
            { placeholder: rho.comercial !== null ? UI.numEdit(rho.comercial) : 'escolher',
              dica: 'Clique em um volume comercial na tabela ao lado, ou digite. O programa confere se o volume segura o Δh alvo.' }),
          rho.subCoberta ? h('p', { class: 'nota', style: 'margin-top:4px' },
            'A depressão está coberta pelas ventosas/TAU/chaminé lançados: o RHO é dimensionado só para a ' +
            'sobrepressão — por isso o volume necessário caiu.') : null),
        h('div', { class: 'via' },
          h('h4', {}, 'Volumes comerciais', UI.dica('Série usual de vasos hidropneumáticos. ★ é o menor que atende ao requisito. A coluna Δh mostra a oscilação que cada volume seguraria nesta linha.')),
          UI.tabela([{ rot: 'Vaso', esq: true }, 'Δh que segura (mca)', 'Situação'], linhas))),
      rho.comercial === null ? h('div', { class: 'aviso', style: 'margin-top:6px' },
        'Nenhum vaso da série (até 50 m³) segura sozinho o Δh alvo — o caso pede COMBINAÇÃO: RHO para a ' +
        'sobrepressão na elevatória + TAU/ventosas non-slam nos pontos críticos de depressão (o que alivia o ' +
        'requisito do RHO), ou vasos múltiplos em paralelo (ex.: 2 × ' +
        UI.numEdit(Math.ceil(rho.vTanque / 2)) + ' m³). O estudo de transiente confirma a combinação.') : null,
      aval.efetivo && Number(d.volumeM3) > 0 ? h('p', { class: 'nota', style: 'margin-top:6px' },
        'Com ' + UI.numEdit(d.volumeM3) + ' m³, o RHO limita o transitório a Δh ≈ ' +
        UI.num(aval.efetivo.dh, 1) + ' mca (sobrepressão ' + UI.num(aval.efetivo.dhSobre, 1) +
        '; depressão ' + UI.num(aval.efetivo.dhSub, 1) + ').') : null);
  }

  function corpoTau(st, ctx, res, req, d, i, aval) {
    var base = 'protecao.dispositivos.' + i;
    var tau = aval.tau;
    return h('div', {},
      h('div', { class: 'grade' },
        UI.campo(st, 'Posição na linha (m)', base + '.x',
          { dica: 'Distância da elevatória até o TAU, medida ao longo da linha. O usual é logo a jusante do ponto alto crítico.' }),
        UI.campo(st, 'Volume adotado (m³)', base + '.volumeM3', {})),
      tau && !tau.erro ? h('table', { class: 'tab-apoio', style: 'max-width:560px' }, h('tbody', {},
        h('tr', {}, h('td', { class: 'esq' }, 'Volume da zona de depressão a jusante'),
          h('td', {}, tau.volumeZona ? UI.num(tau.volumeZona, 1) + ' m³' : '—')),
        h('tr', { class: 'total' }, h('td', { class: 'esq' }, 'Volume necessário (com 50 % de folga)'),
          h('td', {}, h('b', {}, tau.volume ? UI.num(tau.volume, 1) + ' m³' : '—'))),
        tau.alcance ? h('tr', {}, h('td', { class: 'esq' }, 'Zona protegida até'),
          h('td', {}, UI.num(tau.alcance, 0) + ' m')) : null)) : null);
  }

  function corpoChamine(st, ctx, res, req, d, i, aval) {
    var base = 'protecao.dispositivos.' + i;
    var ch = aval.chamine;
    return h('div', {},
      h('div', { class: 'grade' },
        UI.campo(st, 'Posição na linha (m)', base + '.x', {}),
        UI.campo(st, 'Altura adotada (m)', base + '.altura', {})),
      ch && !ch.erro ? h('table', { class: 'tab-apoio', style: 'max-width:560px' }, h('tbody', {},
        h('tr', {}, h('td', { class: 'esq' }, 'Cota do terreno no ponto'), h('td', {}, UI.num(ch.cota, 2) + ' m')),
        h('tr', {}, h('td', { class: 'esq' }, 'Piezométrica permanente / envoltória máx.'),
          h('td', {}, UI.num(ch.hglPerm, 2) + ' / ' + UI.num(ch.envMax, 2) + ' m')),
        h('tr', { class: 'total' }, h('td', { class: 'esq' }, 'Altura necessária (com 1 m de borda livre)'),
          h('td', {}, h('b', {}, UI.num(ch.altura, 1) + ' m'))))) : null);
  }

  function corpoVentosa(st, ctx, res, req, d, i, aval) {
    var base = 'protecao.dispositivos.' + i;
    var dnLinha = PR.dnDaLinha(res);
    var regra = aval.regra;
    return h('div', {},
      h('div', { class: 'grade' },
        UI.campo(st, 'Posição na linha (m)', base + '.x', {}),
        UI.select(st, 'Função', base + '.funcao',
          PR.FUNCOES_VENTOSA.map(function (f) { return { v: f.id, rot: f.rot }; }),
          { dica: PR.FUNCOES_VENTOSA.map(function (f) { return f.rot + ' — ' + f.desc; }).join('\n\n') }),
        UI.select(st, 'DN da ventosa', base + '.dn',
          [{ v: '', rot: '—' }].concat(PR.DNS_VENTOSA.map(function (v) {
            return { v: v, rot: 'DN ' + v + (regra && v === regra.dnRec ? '  ★ recomendado' : '') };
          })), { tipo: 'num',
            dica: 'Regra usual de anteprojeto: DN da ventosa entre 1/12 e 1/8 do DN da linha' +
              (dnLinha ? ' (linha DN ' + dnLinha + ' → DN ' + (regra ? regra.dnMin : '—') + ' a DN ' +
                (regra ? regra.dnRec : '—') + ')' : '') +
              '. A capacidade de admissão/expulsão de ar do MODELO escolhido deve ser conferida na curva do fabricante.' }),
        UI.campo(st, 'Modelo (opcional)', base + '.modelo',
          { tipo: 'texto', placeholder: 'ex.: ARI D-060 C, BERMAD C70, PAM Ventex',
            dica: 'Campo livre para registrar o modelo do fabricante (ARI, BERMAD, Saint-Gobain/PAM...). O modelo sai no memorial. Envie as páginas do catálogo do fabricante para cadastrarmos as curvas de admissão e a seleção automática por modelo.' })));
  }

  function cartaoDispositivo(st, ctx, res, req, d, i, total) {
    var t = tipoDe(d.tipo);
    var aval = PR.avaliar(st, ctx, res, req, d);
    var corpo;
    if (d.tipo === 'rho') corpo = corpoRho(st, ctx, res, req, d, i, aval);
    else if (d.tipo === 'tau') corpo = corpoTau(st, ctx, res, req, d, i, aval);
    else if (d.tipo === 'chamine') corpo = corpoChamine(st, ctx, res, req, d, i, aval);
    else corpo = corpoVentosa(st, ctx, res, req, d, i, aval);

    return UI.cartao(
      h('span', {}, t.rot + (d.tipo === 'ventosa' && d.x ? ' — ' + UI.num(d.x, 0) + ' m' : ''), ' ',
        UI.tagClasse(aval.classe)),
      t.desc,
      h('div', {},
        aval.avisos.map(function (a) { return h('div', { class: 'aviso' }, a); }),
        corpo),
      h('button', { class: 'btn mini perigo', type: 'button', 'data-acao': 'protExcluir', 'data-i': i }, 'Excluir'));
  }

  /* ================================================================
     Envoltórias lado a lado
     ================================================================ */

  function cartaoEnvoltorias(st, ctx, res) {
    if (!res.envoltoria) return null;
    var prot = PR.envoltoriaProtegida(st, ctx, res);
    var lados = [
      h('div', { class: 'via' },
        h('h4', {}, 'Sem proteção (Δh = ' + UI.num(res.envoltoria.dh, 1) + ' mca)'),
        PDA.Pf.grafico(st, ctx, res))
    ];
    if (prot && prot.env) {
      var res2 = Object.assign({}, res, { envoltoria: prot.env });
      lados.push(h('div', { class: 'via' },
        h('h4', {}, 'Com a proteção lançada (' + prot.rotulo + ') — estimada'),
        PDA.Pf.grafico(st, ctx, res2),
        prot.temRho ? h('p', { class: 'nota', style: 'margin-top:4px' },
          'O RHO limita o Δh global a ≈ ' + UI.num(prot.dhSobre, 1) + ' mca na sobrepressão e ' +
          UI.num(prot.dhSub, 1) + ' mca na depressão.') : h('p', { class: 'nota', style: 'margin-top:4px' },
          'Sem RHO lançado a sobrepressão continua a do golpe sem proteção — os dispositivos lançados ' +
          'aliviam a DEPRESSÃO nas suas zonas.')));
    } else {
      lados.push(h('div', { class: 'via' },
        h('h4', {}, 'Com proteção'),
        h('div', { class: 'aviso info' },
          'Lance qualquer dispositivo — RHO, ventosa, TAU ou chaminé — e o programa desenha aqui a envoltória ' +
          'protegida estimada, lado a lado com a envoltória sem proteção. Cada dispositivo lançado atualiza a curva.')));
    }
    return UI.cartao('Envoltórias de pressão', 'Antes e depois da proteção',
      h('div', {},
        h('div', { class: 'blocos-vias' }, lados),
        h('p', { class: 'nota', style: 'margin-top:7px' },
          'A envoltória protegida é ESTIMADA e considera TODOS os dispositivos lançados: o RHO reduz o Δh global ' +
          '(coluna rígida); ventosas de admissão (dupla, tríplice, quádrupla), TAU e chaminé seguram a envoltória ' +
          'mínima em zero na sua zona de alívio (ventosa ±300 m, TAU até o fim da zona de depressão, chaminé ±150 m); ' +
          'a chaminé também limita a envoltória máxima ao seu nível d\'água. Os dispositivos CONVERSAM: a depressão ' +
          'coberta por ventosas/TAU sai do requisito do RHO, que pode ficar menor. O estudo de transiente pelo ' +
          'método das características é quem confirma tudo.')));
  }

  /* ================================================================
     Aba
     ================================================================ */

  UP.aba = function (st, ctx, res) {
    var out = [];
    var pr = st.protecao;

    /* dados de entrada da pré-avaliação (Joukowsky/Michaud) — era o
       rodapé da aba Adutora, agora vive aqui */
    out.push(PDA.F.cartaoGolpeEntrada(st, ctx, res));

    out.push(UI.cartao('Estudo da proteção', 'Do "não passa sem proteção" ao anteprojeto dos dispositivos', [
      UI.check(st, 'Estudar a proteção contra o transitório desta linha', 'protecao.ativo', {
        dica: 'A pré-avaliação acima calcula a linha SEM proteção. Aqui o programa calcula quanto a proteção precisa limitar o golpe, sugere onde instalar cada dispositivo, pré-dimensiona RHO, TAU, chaminé e ventosas e estima a envoltória protegida.'
      }),
      !pr.ativo ? h('p', { class: 'nota', style: 'margin-top:9px' },
        'Com a opção desligada nada muda no restante do programa. A pré-avaliação sem proteção continua na aba Resultados.') : null
    ]));
    if (!pr.ativo) return out;

    if (!st.golpe.avaliar) {
      out.push(UI.cartao('Golpe de aríete desligado', null, h('div', { class: 'aviso erro' },
        'A pré-avaliação do golpe está desligada no cartão acima — ligue "Avaliar golpe de aríete" para o estudo de proteção ter o Δh de partida.')));
      return out;
    }

    var req = PR.requisito(st, ctx, res);
    out.push(cartaoRequisito(st, ctx, res, req));

    var pontos = cartaoPontos(st, ctx, res);
    if (pontos) out.push(pontos);

    (pr.dispositivos || []).forEach(function (d, i) {
      out.push(cartaoDispositivo(st, ctx, res, req, d, i, pr.dispositivos.length));
    });

    out.push(h('div', { class: 'linha', style: 'gap:8px;flex-wrap:wrap;margin:4px 0 10px' },
      TIPOS.map(function (t) {
        return h('button', { class: 'btn', type: 'button', 'data-acao': 'protNovo', 'data-tipo': t.id },
          '+ ' + t.rot.split(' — ')[0]);
      })));

    var env = cartaoEnvoltorias(st, ctx, res);
    if (env) out.push(env);

    out.push(UI.cartao('Alcance deste estudo', null,
      h('div', { class: 'nota', style: 'line-height:1.6' },
        h('p', {}, h('b', {}, 'É anteprojeto.'), ' O requisito sai da envoltória simplificada (Joukowsky/Michaud com decaimento linear); ' +
          'o RHO sai do método da coluna rígida com ar isotérmico; TAU e chaminé, de volumes e alturas geométricas. ' +
          'Nada disto integra as equações do transitório: o dimensionamento FINAL dos dispositivos sai do estudo pelo ' +
          'método das características (Allievi, Hammer, KyPipe), que valida vasos, curvas de ventosa, reflexões e separação de coluna.'),
        h('p', {}, h('b', {}, 'O que este passo entrega:'), ' os dispositivos certos, nos pontos certos, na ordem de grandeza certa — e o memorial já documenta o porquê de cada um.'))));

    return out;
  };

  PDA.UP = UP;
})(window.PDA = window.PDA || {});
