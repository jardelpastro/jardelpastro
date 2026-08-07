/* ------------------------------------------------------------------
 * Paginação e exportação do memorial.
 *
 * O documento é distribuído em páginas A4 medidas de verdade, o que
 * permite numerar o sumário e os índices. Daí saem duas saídas: a
 * impressão (PDF pelo próprio navegador) e um arquivo .doc que o Word
 * e o LibreOffice abrem para edição.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var X = {};
  var UI, h;

  X.init = function () { UI = PDA.UI; h = UI.h; };

  var MM = 96 / 25.4;              /* 1 mm em px a 96 dpi */
  X.PAG = {
    largura: 210, altura: 297,
    margEsq: 25, margDir: 20, margSup: 20, margInf: 15,
    cabecalho: 14, rodape: 10
  };

  X.larguraUtilMm = function () { return X.PAG.largura - X.PAG.margEsq - X.PAG.margDir; };
  X.alturaUtilMm = function () {
    return X.PAG.altura - X.PAG.margSup - X.PAG.margInf - X.PAG.cabecalho - X.PAG.rodape;
  };

  /* ================================================================
     Medição
     ================================================================ */

  function abrirMedidor() {
    var m = document.getElementById('doc-medidor');
    if (!m) {
      m = document.createElement('div');
      m.id = 'doc-medidor';
      document.body.appendChild(m);
    }
    m.className = 'doc doc-medidor';
    m.style.width = X.larguraUtilMm() * MM + 'px';
    UI.limpar(m);
    return m;
  }

  /* Altura ocupada pelo bloco, MARGENS INCLUÍDAS. Sem elas a soma fica
     menor que o layout real e a última tabela da página estoura o rodapé. */
  function medir(medidor, el) {
    medidor.appendChild(el);
    var cs = window.getComputedStyle(el);
    var alt = el.getBoundingClientRect().height +
              (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
    medidor.removeChild(el);
    return alt;
  }

  /* ================================================================
     Divisão de tabelas entre páginas
     ================================================================ */

  function dividirTabela(quadro, medidor, alturaPrimeira, alturaCheia) {
    var clone = quadro.cloneNode(true);
    medidor.appendChild(clone);
    var cap = clone.querySelector('.doc-cap-tab');
    var tab = clone.querySelector('table');
    var fonte = clone.querySelector('.doc-fonte');
    if (!tab) { medidor.removeChild(clone); return null; }

    var thead = tab.querySelector('thead');
    var linhas = Array.prototype.slice.call(tab.querySelectorAll('tbody tr'));
    var alturas = linhas.map(function (tr) { return tr.getBoundingClientRect().height; });
    medidor.removeChild(clone);

    if (!linhas.length) return null;

    /* Monta uma parte da tabela com as linhas indicadas. */
    function montar(de, ate, continuacao, comFonte) {
      var parte = quadro.cloneNode(false);
      parte.removeAttribute('data-ref');
      if (!continuacao && quadro.getAttribute('data-ref')) {
        parte.setAttribute('data-ref', quadro.getAttribute('data-ref'));
      }
      if (cap) {
        var c2 = cap.cloneNode(true);
        if (continuacao) c2.textContent = cap.textContent + '  (continuação)';
        parte.appendChild(c2);
      }
      var t2 = tab.cloneNode(false);
      if (thead) t2.appendChild(thead.cloneNode(true));
      var tb = document.createElement('tbody');
      for (var k = de; k < ate; k++) tb.appendChild(linhas[k].cloneNode(true));
      t2.appendChild(tb);
      parte.appendChild(t2);
      if (comFonte && fonte) parte.appendChild(fonte.cloneNode(true));
      return parte;
    }

    /* O que a parte gasta além das próprias linhas: legenda, cabeçalho da
       tabela, bordas e o espaçamento do quadro. Medido de verdade, senão a
       parte "cabe" na conta e não cabe na página. */
    function sobrecarga(continuacao, comFonte) {
      return medir(medidor, montar(0, 1, continuacao, comFonte)) - alturas[0];
    }
    var sobreNormal = sobrecarga(false, false);
    var sobreCont = sobrecarga(true, false);
    var sobreUlt = sobrecarga(false, true) - sobrecarga(false, false);   /* só a fonte */

    var partes = [], idx = 0, primeira = true;
    var MIN_LINHAS = 2;
    while (idx < linhas.length) {
      var cont = partes.length > 0;
      var disp = (primeira ? alturaPrimeira : alturaCheia) - (cont ? sobreCont : sobreNormal);
      var n = 0, acc = 0;
      while (idx + n < linhas.length && acc + alturas[idx + n] <= disp) { acc += alturas[idx + n]; n++; }
      /* se termina a tabela nesta parte, a fonte entra e pode não caber mais */
      if (idx + n >= linhas.length) {
        while (n > 1 && acc + sobreUlt > disp) { n--; acc -= alturas[idx + n]; }
      }
      /* não coube nem o mínimo no resto da página: começa a tabela na próxima */
      if (n < MIN_LINHAS && primeira) { primeira = false; continue; }
      if (!n) n = 1;                                 /* linha maior que a página */

      var ultima = idx + n >= linhas.length;
      partes.push({ el: montar(idx, idx + n, cont, ultima), primeira: primeira });
      idx += n;
      primeira = false;
    }
    return partes;
  }

  /* ================================================================
     Paginação
     ================================================================ */

  /* blocos: array de elementos. Devolve páginas (arrays de elementos). */
  X.paginar = function (blocos) {
    var medidor = abrirMedidor();
    var H = X.alturaUtilMm() * MM - 4;   /* folga de 4 px contra arredondamento */
    var paginas = [[]];
    var atual = 0;

    function novaPagina() { paginas.push([]); atual = 0; }
    function vazia() { return !paginas[paginas.length - 1].length; }

    /* um título não pode ficar sozinho no pé da página */
    function ehTitulo(el) {
      return el.classList && (el.classList.contains('doc-h1') || el.classList.contains('doc-h2'));
    }
    var MIN_APOS = 62;      /* espaço mínimo que precisa sobrar depois do título */

    blocos.forEach(function (b) {
      var alt = medir(medidor, b);
      var restante = H - atual;

      if (ehTitulo(b) && alt + MIN_APOS > restante && !vazia()) {
        novaPagina();
        restante = H;
      }

      if (alt <= restante) {
        paginas[paginas.length - 1].push(b);
        atual += alt;
        return;
      }

      /* tabela grande: divide entre páginas */
      if (b.classList && b.classList.contains('bloco-tabela') && alt > H * 0.2) {
        var partes = dividirTabela(b, medidor, restante, H);
        if (partes && partes.length) {
          partes.forEach(function (p, i) {
            if (i > 0 || !p.primeira) {
              if (paginas[paginas.length - 1].length) novaPagina();
            }
            var hp = medir(medidor, p.el);
            if (hp > H - atual && paginas[paginas.length - 1].length) novaPagina();
            paginas[paginas.length - 1].push(p.el);
            atual += hp;
          });
          return;
        }
      }

      /* quebra de página normal */
      if (paginas[paginas.length - 1].length) novaPagina();
      paginas[paginas.length - 1].push(b);
      atual += alt;
      if (atual > H) atual = H;    /* bloco maior que a página: segue na próxima */
    });

    UI.limpar(medidor);
    return paginas.filter(function (p) { return p.length; });
  };

  /* ================================================================
     Montagem do documento paginado
     ================================================================ */

  X.montar = function (st, ctx, res) {
    var D = PDA.MEM.documento(st, ctx, res);
    var nFrente = 1;             /* páginas do sumário + índices */
    var paginas, mapa, i;

    for (i = 0; i < 6; i++) {
      paginas = X.paginar(D.blocos.map(function (b) { return b.cloneNode(true); }));
      /* capa (1) + páginas de sumário/índices (nFrente) ficam antes do corpo,
         logo a primeira página do corpo é a de número nFrente + 2 */
      mapa = X.mapear(paginas, 2 + nFrente);
      var frente = X.paginar(X.blocosFrente(D, mapa).map(function (b) { return b.cloneNode(true); }));
      if (frente.length === nFrente) break;
      nFrente = frente.length;
    }
    var frenteFinal = X.paginar(X.blocosFrente(D, mapa).map(function (b) { return b.cloneNode(true); }));

    return {
      D: D,
      capa: X.capa(st, ctx, res),
      frente: frenteFinal,
      corpo: paginas,
      mapa: mapa,
      total: 1 + frenteFinal.length + paginas.length
    };
  };

  X.mapear = function (paginas, deslocamento) {
    var mapa = {};
    paginas.forEach(function (pag, i) {
      pag.forEach(function (el) {
        var refs = [];
        if (el.getAttribute && el.getAttribute('data-ref')) refs.push(el.getAttribute('data-ref'));
        var dentro = el.querySelectorAll ? el.querySelectorAll('[data-ref]') : [];
        var k;
        for (k = 0; k < dentro.length; k++) refs.push(dentro[k].getAttribute('data-ref'));
        refs.forEach(function (r) { if (mapa[r] === undefined) mapa[r] = deslocamento + i; });
      });
    });
    return mapa;
  };

  /* sumário, índice de figuras e índice de tabelas */
  X.blocosFrente = function (D, mapa) {
    var out = [];

    function lista(titulo, itens, montar) {
      if (!itens.length) return;
      out.push(h('h1', { class: 'doc-h1 doc-h1-frente bloco' }, titulo));
      itens.forEach(function (it) {
        out.push(montar(it));
      });
    }

    lista('Sumário', D.capitulos, function (cap) {
      return h('div', { class: 'doc-sum bloco nivel' + cap.nivel },
        h('span', { class: 'sum-txt' }, cap.num + '.  ' + cap.titulo),
        h('span', { class: 'sum-pts' }),
        h('span', { class: 'sum-pag' }, mapa[cap.id] === undefined ? '—' : String(mapa[cap.id])));
    });

    lista('Índice de figuras', D.figuras, function (f) {
      return h('div', { class: 'doc-sum bloco nivel2' },
        h('span', { class: 'sum-txt' }, 'Figura ' + f.num + ' — ' + f.titulo),
        h('span', { class: 'sum-pts' }),
        h('span', { class: 'sum-pag' }, mapa[f.id] === undefined ? '—' : String(mapa[f.id])));
    });

    lista('Índice de tabelas', D.tabelas, function (t) {
      return h('div', { class: 'doc-sum bloco nivel2' },
        h('span', { class: 'sum-txt' }, 'Tabela ' + t.num + ' — ' + t.titulo),
        h('span', { class: 'sum-pts' }),
        h('span', { class: 'sum-pag' }, mapa[t.id] === undefined ? '—' : String(mapa[t.id])));
    });

    return out;
  };

  X.capa = function (st, ctx, res) {
    var esgoto = ctx.familiaCriterio === 'esgoto';
    return h('div', { class: 'doc-capa' },
      h('div', { class: 'capa-topo' }, PDA.M.marca(64, { larguraMax: 260 })),
      h('div', { class: 'capa-meio' },
        h('div', { class: 'capa-tipo' }, 'Memorial descritivo e de cálculo'),
        h('h1', { class: 'capa-titulo' }, st.projeto.nome || 'Pré-dimensionamento de adutora'),
        h('div', { class: 'capa-sub' },
          'Pré-dimensionamento hidráulico de ' + (esgoto ? 'linha de recalque' : 'adutora')),
        h('div', { class: 'capa-linha' })),
      h('div', { class: 'capa-dados' },
        st.projeto.local ? h('div', {}, h('b', {}, 'Local: '), st.projeto.local) : null,
        st.projeto.responsavel ? h('div', {}, h('b', {}, 'Responsável técnico: '), st.projeto.responsavel) : null,
        h('div', {}, h('b', {}, 'Vazão de projeto: '), UI.num(ctx.qTotal * 1000, 1) + ' L/s'),
        h('div', {}, h('b', {}, 'Altura manométrica: '), UI.num(res.projeto.Hm, 2) + ' mca'),
        st.projeto.data ? h('div', {}, h('b', {}, 'Data: '), st.projeto.data) : null),
      h('div', { class: 'capa-rodape' }, PDA.App.dataHoraBR()));
  };

  /* páginas prontas para exibir e imprimir */
  X.render = function (doc, st) {
    var frag = document.createDocumentFragment();
    var num = 1;

    var capa = h('div', { class: 'pagina pagina-capa' }, doc.capa);
    frag.appendChild(capa);
    num++;

    function pagina(blocos) {
      var p = h('div', { class: 'pagina' },
        h('div', { class: 'pag-cabecalho' },
          h('span', { class: 'pc-marca' }, PDA.M.marca(20, { larguraMax: 120, semTexto: false })),
          h('span', { class: 'pc-titulo' }, st.projeto.nome || 'Memorial de cálculo')),
        h('div', { class: 'pag-corpo' }, blocos),
        h('div', { class: 'pag-rodape' },
          h('span', {}, 'Memorial descritivo e de cálculo' +
            (st.projeto.local ? ' — ' + st.projeto.local : '')),
          h('span', {}, num + ' / ' + doc.total)));
      num++;
      return p;
    }

    doc.frente.forEach(function (bl) { frag.appendChild(pagina(bl)); });
    doc.corpo.forEach(function (bl) { frag.appendChild(pagina(bl)); });
    return frag;
  };

  /* ================================================================
     Pré-visualização
     ================================================================ */

  X.previa = function () {
    var App = PDA.App;
    var st = App.st;
    var ctx = PDA.C.contexto(st, App.cats);
    var res = PDA.C.resumo(st, App.cats);

    var alvo = document.getElementById('doc-saida');
    if (!alvo) {
      alvo = document.createElement('div');
      alvo.id = 'doc-saida';
      document.body.appendChild(alvo);
    }
    alvo.className = 'doc';
    UI.limpar(alvo);

    var doc = X.montar(st, ctx, res);
    alvo.appendChild(X.render(doc, st));
    X.docAtual = doc;

    var visor = h('div', { class: 'visor-doc' });
    visor.appendChild(alvo);

    UI.modal('Memorial descritivo e de cálculo', [
      h('div', { class: 'linha', style: 'margin-bottom:10px' },
        h('span', { class: 'nota' },
          doc.total + ' páginas  ·  ' + doc.D.capitulos.filter(function (c) { return c.nivel === 1; }).length +
          ' capítulos  ·  ' + doc.D.figuras.length + ' figuras  ·  ' + doc.D.tabelas.length + ' tabelas'),
        h('button', { class: 'btn mini', type: 'button', 'data-acao': 'editarIntroducao' },
          'Editar a introdução')),
      visor
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Fechar'),
      h('button', { class: 'btn', type: 'button', 'data-acao': 'memorialWord' }, 'Baixar Word (.doc)'),
      h('button', { class: 'btn primario', type: 'button', 'data-acao': 'memorialPdf' },
        'Imprimir / salvar em PDF')
    ]);
  };

  /* ================================================================
     PDF (impressão do navegador)
     ================================================================ */

  X.pdf = function () {
    var App = PDA.App;
    var st = App.st;
    var ctx = PDA.C.contexto(st, App.cats);
    var res = PDA.C.resumo(st, App.cats);

    /* A prévia guarda o documento dentro do modal; fechar o modal primeiro
       evitaria imprimir folha em branco, por isso o alvo é recolocado no
       corpo da página antes de montar. */
    UI.fecharModal();

    var alvo = document.getElementById('doc-saida');
    if (!alvo) {
      alvo = document.createElement('div');
      alvo.id = 'doc-saida';
    }
    if (alvo.parentNode !== document.body) document.body.appendChild(alvo);
    alvo.className = 'doc';
    UI.limpar(alvo);
    var doc = X.montar(st, ctx, res);
    alvo.appendChild(X.render(doc, st));

    document.documentElement.classList.add('imprimindo-doc');
    window.print();
    setTimeout(function () {
      document.documentElement.classList.remove('imprimindo-doc');
    }, 400);
  };

  /* ================================================================
     Word (.doc que o Word e o LibreOffice abrem)
     ================================================================ */

  /* copia os estilos calculados para dentro do SVG, para ele sobreviver
     fora da página */
  function embutirEstilos(origem, destino) {
    var props = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray',
                 'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-family',
                 'font-weight', 'text-anchor', 'opacity'];
    var cs = window.getComputedStyle(origem);
    props.forEach(function (p) {
      var v = cs.getPropertyValue(p);
      if (v && v !== 'none' || p === 'fill' || p === 'stroke') destino.setAttribute(p, v);
    });
    var fo = origem.children, fd = destino.children, i;
    for (i = 0; i < fo.length && i < fd.length; i++) embutirEstilos(fo[i], fd[i]);
  }

  X.svgParaImagem = function (svg, cb) {
    var clone = svg.cloneNode(true);
    embutirEstilos(svg, clone);
    var caixa = svg.getBoundingClientRect();
    var vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/);
    var lw = vb.length === 4 ? Number(vb[2]) : (caixa.width || 600);
    var lh = vb.length === 4 ? Number(vb[3]) : (caixa.height || 300);
    clone.setAttribute('width', lw);
    clone.setAttribute('height', lh);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    var texto = new XMLSerializer().serializeToString(clone);
    var uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texto);

    var img = new Image();
    img.onload = function () {
      try {
        var esc = 2;
        var cv = document.createElement('canvas');
        cv.width = lw * esc; cv.height = lh * esc;
        var g = cv.getContext('2d');
        g.fillStyle = '#ffffff';
        g.fillRect(0, 0, cv.width, cv.height);
        g.drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/png'), lw, lh);
      } catch (e) {
        cb(uri, lw, lh);          /* se o canvas recusar, vai o próprio SVG */
      }
    };
    img.onerror = function () { cb(uri, lw, lh); };
    img.src = uri;
  };

  X.word = function () {
    var App = PDA.App;
    var st = App.st;
    var ctx = PDA.C.contexto(st, App.cats);
    var res = PDA.C.resumo(st, App.cats);

    var D = PDA.MEM.documento(st, ctx, res);

    /* container temporário, preciso dele na página para ler estilos do SVG */
    var tmp = h('div', { class: 'doc doc-medidor' });
    tmp.style.width = X.larguraUtilMm() * MM + 'px';
    document.body.appendChild(tmp);
    D.blocos.forEach(function (b) { tmp.appendChild(b); });

    var svgs = Array.prototype.slice.call(tmp.querySelectorAll('svg'));
    var pendentes = svgs.length;

    function terminar() {
      var corpo = tmp.innerHTML;
      document.body.removeChild(tmp);

      var sumario = D.capitulos.map(function (c) {
        return '<p class=sum' + c.nivel + '>' + c.num + '. ' + escapar(c.titulo) + '</p>';
      }).join('');
      var idxFig = D.figuras.map(function (f) {
        return '<p class=sum2>Figura ' + f.num + ' — ' + escapar(f.titulo) + '</p>';
      }).join('');
      var idxTab = D.tabelas.map(function (t) {
        return '<p class=sum2>Tabela ' + t.num + ' — ' + escapar(t.titulo) + '</p>';
      }).join('');

      var capaHtml =
        '<div class=capa>' +
        (X.logoWord ? '<p><img src="' + X.logoWord + '" style="max-height:70px"></p>' : '') +
        '<p class=capatipo>Memorial descritivo e de cálculo</p>' +
        '<h1 class=capatit>' + escapar(st.projeto.nome || 'Pré-dimensionamento de adutora') + '</h1>' +
        (st.projeto.local ? '<p class=capadado><b>Local:</b> ' + escapar(st.projeto.local) + '</p>' : '') +
        (st.projeto.responsavel ? '<p class=capadado><b>Responsável técnico:</b> ' + escapar(st.projeto.responsavel) + '</p>' : '') +
        '<p class=capadado><b>Vazão de projeto:</b> ' + UI.num(ctx.qTotal * 1000, 1) + ' L/s</p>' +
        '<p class=capadado><b>Altura manométrica:</b> ' + UI.num(res.projeto.Hm, 2) + ' mca</p>' +
        (st.projeto.data ? '<p class=capadado><b>Data:</b> ' + escapar(st.projeto.data) + '</p>' : '') +
        '</div>';

      var html =
        '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
        'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
        '<title>' + escapar(st.projeto.nome || 'Memorial') + '</title>' +
        '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
        '<w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
        '<style>' + X.cssWord() + '</style></head><body>' +
        capaHtml +
        '<div class=quebra></div><h1>Sumário</h1>' + sumario +
        (idxFig ? '<div class=quebra></div><h1>Índice de figuras</h1>' + idxFig : '') +
        (idxTab ? '<div class=quebra></div><h1>Índice de tabelas</h1>' + idxTab : '') +
        '<p class=notarodape>As páginas do sumário e dos índices são renumeradas pelo editor de texto ao abrir ' +
        'o arquivo. A versão em PDF, gerada pelo próprio programa, já traz a numeração correta.</p>' +
        '<div class=quebra></div>' + corpo +
        '</body></html>';

      var blob = new Blob(['﻿' + html], { type: 'application/msword;charset=utf-8' });
      var nome = (st.projeto.nome || 'memorial').replace(/[^\wÀ-ÿ .-]+/g, '').trim().slice(0, 60) || 'memorial';
      X.baixar(nome + ' - memorial.doc', blob);
      UI.toast('Memorial exportado. Abra no Word ou no LibreOffice para editar.');
    }

    /* logo da capa em imagem */
    var marca = PDA.M.marca(64, { larguraMax: 260 });
    tmp.appendChild(marca);
    var svgMarca = marca.querySelector('svg');
    var imgMarca = marca.querySelector('img');
    X.logoWord = imgMarca ? imgMarca.src : null;

    function converterSvgs() {
      if (!pendentes) { terminar(); return; }
      svgs.forEach(function (svg) {
        X.svgParaImagem(svg, function (uri, lw, lh) {
          var img = document.createElement('img');
          img.src = uri;
          img.style.width = Math.min(560, lw) + 'px';
          if (svg.parentNode) svg.parentNode.replaceChild(img, svg);
          pendentes--;
          if (!pendentes) terminar();
        });
      });
    }

    if (svgMarca && !X.logoWord) {
      X.svgParaImagem(svgMarca, function (uri) {
        X.logoWord = uri;
        marca.parentNode.removeChild(marca);
        converterSvgs();
      });
    } else {
      marca.parentNode.removeChild(marca);
      converterSvgs();
    }
  };

  function escapar(t) {
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  X.cssWord = function () {
    return '@page { size: A4; margin: ' + X.PAG.margSup + 'mm ' + X.PAG.margDir + 'mm ' +
      X.PAG.margInf + 'mm ' + X.PAG.margEsq + 'mm; }' +
      'body { font-family: "Times New Roman", serif; font-size: 11pt; color: #000; line-height: 1.4; }' +
      'h1 { font-size: 14pt; margin: 18pt 0 8pt; page-break-before: always; page-break-after: avoid; }' +
      'h1:first-of-type { page-break-before: auto; }' +
      'h2 { font-size: 12pt; margin: 12pt 0 6pt; page-break-after: avoid; }' +
      'p { margin: 0 0 6pt; text-align: justify; }' +
      '.doc-formula { text-align: center; margin: 8pt 0; font-family: "Cambria Math", "Times New Roman", serif; }' +
      '.formula-txt { font-size: 12pt; }' +
      '.formula-leg { font-size: 9pt; color: #444; text-align: center; }' +
      '.doc-aplicacao { margin: 6pt 0 6pt 18pt; font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }' +
      'table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 4pt 0 6pt; }' +
      'th, td { border: 0.5pt solid #999; padding: 2pt 4pt; text-align: right; }' +
      'th { background: #eef2f6; font-weight: bold; text-align: center; }' +
      'td.esq, th.esq { text-align: left; }' +
      'tr.total td { font-weight: bold; background: #f4f6f8; }' +
      'tr.destaque td { background: #eaf5f4; }' +
      '.doc-cap-tab, .doc-cap-fig { font-size: 9.5pt; font-weight: bold; text-align: center; margin: 8pt 0 2pt; }' +
      '.doc-cap-fig { margin-top: 2pt; }' +
      '.doc-fonte { font-size: 8.5pt; color: #444; text-align: center; margin-bottom: 8pt; }' +
      '.doc-fig { text-align: center; }' +
      '.doc-nota { font-size: 9.5pt; color: #333; }' +
      '.doc-ref { text-align: left; text-indent: 0; margin-bottom: 8pt; }' +
      '.quebra { page-break-before: always; }' +
      '.capa { text-align: center; margin-top: 60pt; }' +
      '.capatipo { letter-spacing: 2pt; text-transform: uppercase; font-size: 10pt; }' +
      '.capatit { font-size: 20pt; page-break-before: auto; margin: 18pt 0; }' +
      '.capadado { text-align: center; font-size: 11pt; margin: 2pt 0; }' +
      '.sum1 { margin: 3pt 0; font-weight: bold; }' +
      '.sum2 { margin: 2pt 0 2pt 14pt; }' +
      '.notarodape { font-size: 8.5pt; color: #555; margin-top: 12pt; }';
  };

  X.baixar = function (nome, blob) {
    /* travessão e sinais de caminho fazem o navegador descartar o nome e
       salvar o arquivo como "download" */
    nome = String(nome).replace(/[‐-―]/g, '-')
                       .replace(/[\\/:*?"<>|]+/g, '-')
                       .replace(/\s+/g, ' ').trim() || 'memorial.doc';
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  /* ================================================================
     Edição da introdução
     ================================================================ */

  X.modalIntroducao = function () {
    var App = PDA.App, st = App.st;
    var ctx = PDA.C.contexto(st, App.cats);
    var res = PDA.C.resumo(st, App.cats);
    if (!st.memorial) st.memorial = { introducao: '', objetivo: '' };

    var padrao = PDA.MEM.introducaoPadrao(st, ctx, res);
    var ta = h('textarea', { rows: 12, style: 'font-size:13px;line-height:1.55' },
      st.memorial.introducao || padrao);
    var obj = h('textarea', { rows: 5, style: 'font-size:13px;line-height:1.55' },
      st.memorial.objetivo || '');

    UI.modal('Introdução do memorial', [
      h('p', { class: 'nota' },
        'O texto abaixo abre o memorial. O programa monta uma versão inicial a partir dos dados do projeto — ' +
        'nome, local, fluido, vazão, extensão, materiais, desnível e potência — e você ajusta como quiser. ' +
        'Separe os parágrafos com uma linha em branco.'),
      h('div', { class: 'linha', style: 'margin:9px 0' },
        h('button', {
          class: 'btn', type: 'button', onclick: function () {
            ta.value = PDA.MEM.introducaoPadrao(st, ctx, res);
            UI.toast('Texto regerado a partir dos dados atuais do projeto.');
          }
        }, 'Regerar a partir dos dados do projeto')),
      ta,
      UI.sub('Objetivo (opcional)'),
      h('p', { class: 'nota' },
        'Se preenchido, entra como uma seção logo após a introdução.'),
      obj
    ], [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button', onclick: function () {
          st.memorial.introducao = ta.value.trim();
          st.memorial.objetivo = obj.value.trim();
          UI.fecharModal();
          App.render();
          UI.toast('Introdução gravada no projeto.');
        }
      }, 'Salvar')
    ]);
  };

  PDA.X = X;
})(window.PDA = window.PDA || {});
