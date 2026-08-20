/* ------------------------------------------------------------------
 * Composição de fórmulas com cara de fórmula.
 *
 * Um compositor matemático pequeno: recebe um código parecido com o do
 * LaTeX ( \frac{a}{b}, \sqrt{x}, a^2, \pi, \cdot ) e devolve um SVG com
 * fração de barra horizontal, radical com barra sobre o radicando,
 * expoentes, índices e parênteses que crescem com o conteúdo.
 *
 * Sai em SVG por dois motivos: fica nítido em qualquer zoom na impressão
 * em PDF e vira imagem na exportação para o Word pelo mesmo caminho já
 * usado nos gráficos.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var FX = {};
  var NS = 'http://www.w3.org/2000/svg';
  var FONTE = 'Arial, Helvetica, sans-serif';

  FX.TAM = 15;                       /* corpo padrão das fórmulas, em px */

  /* ================================================================
     Símbolos
     ================================================================ */

  var SIM = {
    cdot: '·', times: '×', div: '÷', pm: '±', mp: '∓', ast: '∗',
    le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≅',
    sim: '~', equiv: '≡', to: '→', rightarrow: '→', infty: '∞', partial: '∂',
    alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ',
    epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ',
    kappa: 'κ', lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ',
    pi: 'π', Pi: 'Π', rho: 'ρ', sigma: 'σ', Sigma: 'Σ', tau: 'τ',
    phi: 'φ', varphi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ', Psi: 'Ψ',
    omega: 'ω', Omega: 'Ω',
    prime: '′', degree: '°', percent: '%', angstrom: 'Å',
    quad: ' ', qquad: '  '
  };

  /* funções e operadores escritos em redondo, como manda a convenção */
  var FUNCOES = ['log', 'ln', 'exp', 'sen', 'sin', 'cos', 'tan', 'tg',
                 'max', 'min', 'med', 'sqrt'];

  /* ================================================================
     Medição de texto
     ================================================================ */

  var cache = {};
  var medidor = null, alvo = null;

  function abrirMedidor() {
    if (medidor && medidor.parentNode) return;
    medidor = document.createElementNS(NS, 'svg');
    medidor.setAttribute('width', '10');
    medidor.setAttribute('height', '10');
    medidor.setAttribute('aria-hidden', 'true');
    medidor.style.cssText = 'position:fixed;left:-9999px;top:0;visibility:hidden';
    alvo = document.createElementNS(NS, 'text');
    alvo.setAttribute('font-family', FONTE);
    medidor.appendChild(alvo);
    document.body.appendChild(medidor);
  }

  function medir(txt, tam, italico) {
    if (!txt) return 0;
    var k = tam + (italico ? 'i' : 'n') + txt;
    if (cache[k] !== undefined) return cache[k];
    abrirMedidor();
    alvo.setAttribute('font-size', tam);
    alvo.setAttribute('font-style', italico ? 'italic' : 'normal');
    alvo.textContent = txt;
    var w = 0;
    try { w = alvo.getComputedTextLength(); } catch (e) { w = 0; }
    if (!w) w = txt.length * tam * 0.52;      /* medida indisponível: estima */
    cache[k] = w;
    return w;
  }

  /* ================================================================
     Leitura do código
     ================================================================ */

  function tokenizar(src) {
    var t = [], i = 0, c;
    while (i < src.length) {
      c = src.charAt(i);
      if (c === '\\') {
        var m = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
        if (!m) { i++; continue; }
        t.push({ tipo: 'cmd', v: m[1] });
        i += m[0].length;
      } else if ('{}^_[]'.indexOf(c) >= 0) {
        t.push({ tipo: c, v: c });
        i++;
      } else if (c === ' ') {
        t.push({ tipo: 'esp', v: ' ' });
        i++;
      } else {
        t.push({ tipo: 'ch', v: c });
        i++;
      }
    }
    return t;
  }

  function Leitor(tokens) { this.t = tokens; this.i = 0; }
  Leitor.prototype.fim = function () { return this.i >= this.t.length; };
  Leitor.prototype.olhar = function () { return this.t[this.i]; };
  Leitor.prototype.pegar = function () { return this.t[this.i++]; };

  /* Lê um grupo { ... } ou um único átomo. */
  function lerGrupo(L) {
    while (!L.fim() && L.olhar().tipo === 'esp') L.pegar();
    if (L.fim()) return { t: 'linha', filhos: [] };
    if (L.olhar().tipo === '{') {
      L.pegar();
      var filhos = lerLinha(L, '}');
      if (!L.fim() && L.olhar().tipo === '}') L.pegar();
      return { t: 'linha', filhos: filhos };
    }
    return lerAtomo(L);
  }

  /* conteúdo de \text{...} lido cru, sem interpretar nada: o que está ali
     é texto corrido, com parênteses, barras e acentos. */
  function lerBruto(L) {
    while (!L.fim() && L.olhar().tipo === 'esp') L.pegar();
    if (L.fim() || L.olhar().tipo !== '{') {
      var t = L.pegar();
      return t ? t.v : '';
    }
    L.pegar();
    var s = '', nivel = 1, tk;
    while (!L.fim()) {
      tk = L.pegar();
      if (tk.tipo === '{') nivel++;
      else if (tk.tipo === '}') { nivel--; if (!nivel) break; }
      s += tk.tipo === 'cmd' ? (SIM[tk.v] || tk.v) : tk.v;
    }
    return s;
  }

  function lerColchete(L) {
    if (L.fim() || L.olhar().tipo !== '[') return null;
    L.pegar();
    var filhos = lerLinha(L, ']');
    if (!L.fim() && L.olhar().tipo === ']') L.pegar();
    return { t: 'linha', filhos: filhos };
  }

  var ABRE = { '(': ')', '[': ']', '\\{': '\\}' };

  function lerAtomo(L) {
    var tk = L.pegar();
    if (!tk) return null;

    if (tk.tipo === 'cmd') {
      var c = tk.v;
      if (c === 'frac' || c === 'dfrac') {
        return { t: 'frac', num: lerGrupo(L), den: lerGrupo(L) };
      }
      if (c === 'sqrt') {
        var idx = lerColchete(L);
        return { t: 'raiz', rad: lerGrupo(L), idx: idx };
      }
      if (c === 'text' || c === 'mathrm' || c === 'operatorname') {
        return { t: 'txt', s: lerBruto(L), it: false };
      }
      if (c === 'left' || c === 'right') {
        return { t: 'ignora' };
      }
      if (c === ' ') return { t: 'esp', w: 0.33 };
      if (c === ',') return { t: 'esp', w: 0.17 };
      if (c === ';') return { t: 'esp', w: 0.28 };
      if (FUNCOES.indexOf(c) >= 0) return { t: 'txt', s: c, it: false };
      if (SIM[c]) {
        var classe = null;
        if ('cdot times div pm mp ast'.split(' ').indexOf(c) >= 0) classe = 'bin';
        else if ('le leq ge geq ne neq approx equiv to rightarrow'.split(' ').indexOf(c) >= 0) classe = 'rel';
        return { t: 'txt', s: SIM[c], it: false, op: classe };
      }
      return { t: 'txt', s: c, it: false };
    }

    /* espaço solto não conta: o espaçamento vem da classe do operador,
       como em qualquer composição matemática. Use \  para forçar um. */
    if (tk.tipo === 'esp') return { t: 'esp', w: 0 };

    if (tk.tipo === '{') {
      var f = lerLinha(L, '}');
      if (!L.fim() && L.olhar().tipo === '}') L.pegar();
      return { t: 'linha', filhos: f };
    }

    var ch = tk.v;
    if (ABRE[ch]) {
      /* junta tudo até o fecha correspondente, para o parêntese crescer */
      var dentro = lerLinha(L, ABRE[ch]);
      if (!L.fim() && L.olhar().v === ABRE[ch]) L.pegar();
      return { t: 'delim', abre: ch, fecha: ABRE[ch], corpo: { t: 'linha', filhos: dentro } };
    }
    if (/[0-9]/.test(ch)) {
      var s = ch;
      while (!L.fim() && /^[0-9.,]$/.test(L.olhar().v) && L.olhar().tipo === 'ch') s += L.pegar().v;
      return { t: 'txt', s: s, it: false };
    }
    if (/[A-Za-z]/.test(ch)) return { t: 'txt', s: ch, it: true };
    if (ch === "'") return { t: 'txt', s: '′', it: false };
    if ('=<>≤≥≠≅→±'.indexOf(ch) >= 0) return { t: 'txt', s: ch, it: false, op: 'rel' };
    if ('+-·×÷∓'.indexOf(ch) >= 0) return { t: 'txt', s: ch === '-' ? '−' : ch, it: false, op: 'bin' };
    return { t: 'txt', s: ch, it: false };
  }

  function lerLinha(L, parar) {
    var filhos = [];
    while (!L.fim()) {
      var tk = L.olhar();
      if (parar && (tk.v === parar || tk.tipo === parar)) break;
      if (tk.tipo === '}' || tk.tipo === ']') break;

      if (tk.tipo === '^' || tk.tipo === '_') {
        L.pegar();
        var alvoAnt = filhos.length ? filhos[filhos.length - 1] : { t: 'linha', filhos: [] };
        if (alvoAnt.t !== 'script') {
          alvoAnt = { t: 'script', base: alvoAnt, sup: null, sub: null };
          if (filhos.length) filhos[filhos.length - 1] = alvoAnt; else filhos.push(alvoAnt);
        }
        if (tk.tipo === '^') alvoAnt.sup = lerGrupo(L); else alvoAnt.sub = lerGrupo(L);
        continue;
      }
      var a = lerAtomo(L);
      if (a && a.t !== 'ignora') filhos.push(a);
    }
    return filhos;
  }

  function textoDe(no) {
    if (!no) return '';
    if (no.t === 'txt') return no.s;
    if (no.t === 'esp') return ' ';
    if (no.t === 'linha') return no.filhos.map(textoDe).join('');
    return '';
  }

  FX.ler = function (codigo) {
    return { t: 'linha', filhos: lerLinha(new Leitor(tokenizar(String(codigo)))) };
  };

  /* ================================================================
     Composição: cada nó vira uma caixa com largura, altura acima da
     linha de base (a) e altura abaixo (d)
     ================================================================ */

  function el(tag, at) {
    var e = document.createElementNS(NS, tag), k;
    for (k in at) if (at[k] !== null && at[k] !== undefined) e.setAttribute(k, at[k]);
    return e;
  }

  function caixaTexto(s, tam, italico, op) {
    var w = medir(s, tam, italico);
    /* respiro à volta dos operadores, conforme a classe */
    var margem = op === 'rel' ? tam * 0.20 : (op === 'bin' ? tam * 0.14 : (op ? tam * 0.14 : 0));
    return {
      w: w + 2 * margem, a: tam * 0.74, d: tam * 0.23,
      desenhar: function (g, x, y) {
        var t = el('text', {
          x: x + margem, y: y, 'font-size': tam, 'font-family': FONTE,
          'font-style': italico ? 'italic' : 'normal', fill: 'currentColor'
        });
        t.textContent = s;
        g.appendChild(t);
      }
    };
  }

  function caixaVazia(w) {
    return { w: w, a: 0, d: 0, desenhar: function () {} };
  }

  function caixaLinha(caixas) {
    var w = 0, a = 0, d = 0;
    caixas.forEach(function (c) { w += c.w; a = Math.max(a, c.a); d = Math.max(d, c.d); });
    return {
      w: w, a: a, d: d,
      desenhar: function (g, x, y) {
        var cx = x;
        caixas.forEach(function (c) { c.desenhar(g, cx, y); cx += c.w; });
      }
    };
  }

  function caixaFrac(num, den, tam) {
    var eixo = 0.27 * tam;                    /* altura da barra sobre a base */
    var reg = Math.max(1, 0.055 * tam);       /* espessura da barra */
    var folga = 0.20 * tam;
    var lado = 0.24 * tam;
    var w = Math.max(num.w, den.w) + 2 * lado;
    var subirNum = eixo + reg / 2 + folga + num.d;
    var descerDen = -eixo + reg / 2 + folga + den.a;
    return {
      w: w, a: subirNum + num.a, d: descerDen + den.d,
      desenhar: function (g, x, y) {
        num.desenhar(g, x + (w - num.w) / 2, y - subirNum);
        den.desenhar(g, x + (w - den.w) / 2, y + descerDen);
        g.appendChild(el('line', {
          x1: x + reg, y1: y - eixo, x2: x + w - reg, y2: y - eixo,
          stroke: 'currentColor', 'stroke-width': reg, 'stroke-linecap': 'round'
        }));
      }
    };
  }

  function caixaRaiz(rad, idx, tam) {
    var reg = Math.max(1, 0.05 * tam);
    var folga = 0.16 * tam;                   /* espaço entre a barra e o radicando */
    var alt = rad.a + rad.d + folga;
    var larg = 0.52 * tam;                    /* largura do sinal de radical */
    var recuo = idx ? Math.max(0, idx.w - larg * 0.45) : 0;
    var pad = 0.16 * tam;
    var a = rad.a + folga + reg;
    return {
      w: recuo + larg + rad.w + pad, a: a, d: rad.d,
      desenhar: function (g, x, y) {
        var x0 = x + recuo;
        var topo = y - a;
        var base = y + rad.d;
        var d = 'M ' + (x0) + ' ' + (topo + alt * 0.58) +
                ' L ' + (x0 + larg * 0.26) + ' ' + (topo + alt * 0.48) +
                ' L ' + (x0 + larg * 0.52) + ' ' + base +
                ' L ' + (x0 + larg) + ' ' + (topo + reg / 2) +
                ' L ' + (x0 + larg + rad.w + pad) + ' ' + (topo + reg / 2);
        g.appendChild(el('path', {
          d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': reg,
          'stroke-linejoin': 'miter', 'stroke-linecap': 'square'
        }));
        rad.desenhar(g, x0 + larg + pad / 2, y);
        if (idx) idx.desenhar(g, x, topo + alt * 0.46);
      }
    };
  }

  function caixaScript(base, sup, sub, tam) {
    var ts = Math.max(7, tam * 0.68);
    var subir = sup ? Math.max(0.44 * tam, base.a - 0.36 * ts) : 0;
    var descer = sub ? Math.max(0.20 * tam, base.d + 0.18 * ts) : 0;
    var wl = Math.max(sup ? sup.w : 0, sub ? sub.w : 0);
    var folga = 0.04 * tam;
    return {
      w: base.w + wl + folga,
      a: Math.max(base.a, sup ? subir + sup.a : 0),
      d: Math.max(base.d, sub ? descer + sub.d : 0),
      desenhar: function (g, x, y) {
        base.desenhar(g, x, y);
        if (sup) sup.desenhar(g, x + base.w + folga, y - subir);
        if (sub) sub.desenhar(g, x + base.w + folga, y + descer);
      }
    };
  }

  function caixaDelim(abre, fecha, corpo, tam) {
    var alt = Math.max(corpo.a + corpo.d, tam * 0.95);
    var meio = (corpo.a - corpo.d) / 2;
    var esc = alt / (tam * 0.95);
    var w = tam * (abre === '[' ? 0.30 : 0.32) * Math.min(1.7, Math.max(1, esc * 0.75));
    var reg = Math.max(1, 0.05 * tam);
    var pad = tam * 0.06;

    function tracar(g, x, y, dir) {
      var topo = y - meio - alt / 2, base = y - meio + alt / 2;
      var d;
      if (abre === '[') {
        d = dir > 0
          ? 'M ' + (x + w * 0.85) + ' ' + topo + ' L ' + (x + w * 0.25) + ' ' + topo +
            ' L ' + (x + w * 0.25) + ' ' + base + ' L ' + (x + w * 0.85) + ' ' + base
          : 'M ' + (x + w * 0.15) + ' ' + topo + ' L ' + (x + w * 0.75) + ' ' + topo +
            ' L ' + (x + w * 0.75) + ' ' + base + ' L ' + (x + w * 0.15) + ' ' + base;
      } else {
        d = dir > 0
          ? 'M ' + (x + w * 0.82) + ' ' + topo + ' Q ' + (x + w * 0.12) + ' ' + (y - meio) +
            ' ' + (x + w * 0.82) + ' ' + base
          : 'M ' + (x + w * 0.18) + ' ' + topo + ' Q ' + (x + w * 0.88) + ' ' + (y - meio) +
            ' ' + (x + w * 0.18) + ' ' + base;
      }
      g.appendChild(el('path', {
        d: d, fill: 'none', stroke: 'currentColor', 'stroke-width': reg,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    }

    return {
      w: 2 * (w + pad) + corpo.w,
      a: Math.max(corpo.a, alt / 2 + meio), d: Math.max(corpo.d, alt / 2 - meio),
      desenhar: function (g, x, y) {
        tracar(g, x, y, 1);
        corpo.desenhar(g, x + w + pad, y);
        tracar(g, x + w + pad + corpo.w + pad, y, -1);
      }
    };
  }

  function compor(no, tam) {
    if (!no) return caixaVazia(0);
    switch (no.t) {
      case 'linha':
        if (!no.filhos.length) return caixaVazia(0);
        return caixaLinha(no.filhos.map(function (f) { return compor(f, tam); }));
      case 'txt':
        return caixaTexto(no.s, tam, no.it, no.op);
      case 'esp':
        return caixaVazia(no.w * tam);
      case 'frac':
        return caixaFrac(compor(no.num, tam * 0.98), compor(no.den, tam * 0.98), tam);
      case 'raiz':
        return caixaRaiz(compor(no.rad, tam), no.idx ? compor(no.idx, tam * 0.6) : null, tam);
      case 'script':
        return caixaScript(compor(no.base, tam),
                           no.sup ? compor(no.sup, tam * 0.68) : null,
                           no.sub ? compor(no.sub, tam * 0.68) : null, tam);
      case 'delim':
        return caixaDelim(no.abre, no.fecha, compor(no.corpo, tam), tam);
      default:
        return caixaVazia(0);
    }
  }

  FX.caixa = function (codigo, tam) {
    return compor(FX.ler(codigo), tam || FX.TAM);
  };

  /* ================================================================
     Saída em SVG
     ================================================================ */

  function montar(caixas, tam, op) {
    op = op || {};
    var pad = 2;
    var entre = op.entreLinhas === undefined ? tam * 0.62 : op.entreLinhas;
    var larg = 0, i, alturas = [], y = pad;

    caixas.forEach(function (c) { larg = Math.max(larg, c.w); });

    for (i = 0; i < caixas.length; i++) {
      y += caixas[i].a;
      alturas.push(y);
      y += caixas[i].d;
      if (i < caixas.length - 1) y += entre;
    }
    var alt = y + pad;
    larg = Math.max(larg + 2 * pad, 1);

    var svg = el('svg', {
      xmlns: NS, viewBox: '0 0 ' + arred(larg) + ' ' + arred(alt),
      width: arred(larg), height: arred(alt), role: 'img', class: 'formula-svg'
    });
    var g = el('g', {});
    svg.appendChild(g);
    caixas.forEach(function (c, k) {
      var x = pad;
      if (op.alinhar === 'centro') x = (larg - c.w) / 2;
      else if (op.deslocamentos) x = pad + op.deslocamentos[k];
      c.desenhar(g, x, alturas[k]);
    });
    return svg;
  }

  function arred(v) { return Math.round(v * 100) / 100; }

  /* Uma fórmula em uma linha. */
  FX.svg = function (codigo, op) {
    op = op || {};
    var tam = op.tam || FX.TAM;
    return montar([FX.caixa(codigo, tam)], tam, { alinhar: op.alinhar || 'centro' });
  };

  /* Várias linhas alinhadas pelo primeiro sinal de igual — é assim que
     uma memória de cálculo fica legível. */
  FX.bloco = function (codigos, op) {
    op = op || {};
    var tam = op.tam || FX.TAM;
    var partes = codigos.map(function (c) { return dividirNoIgual(String(c)); });
    var esq = [], dir = [], maxEsq = 0;

    partes.forEach(function (p) {
      var e = p[0] === null ? null : FX.caixa(p[0], tam);
      esq.push(e);
      dir.push(FX.caixa(p[1], tam));
      if (e) maxEsq = Math.max(maxEsq, e.w);
    });

    var caixas = [], desl = [];
    partes.forEach(function (p, i) {
      if (esq[i]) {
        caixas.push(caixaLinha([esq[i], caixaVazia(maxEsq - esq[i].w), dir[i]]));
        desl.push(0);
      } else {
        caixas.push(dir[i]);
        desl.push(maxEsq);
      }
    });
    return montar(caixas, tam, { alinhar: op.alinhar || 'esq', deslocamentos: desl });
  };

  /* separa "a = b = c" em ["a ", "= b = c"], respeitando chaves */
  function dividirNoIgual(codigo) {
    var nivel = 0, i, c;
    for (i = 0; i < codigo.length; i++) {
      c = codigo.charAt(i);
      if (c === '\\') { i++; continue; }
      if (c === '{' || c === '[' || c === '(') nivel++;
      else if (c === '}' || c === ']' || c === ')') nivel--;
      else if (c === '=' && nivel === 0) {
        return [codigo.slice(0, i), codigo.slice(i)];
      }
    }
    return [null, codigo];
  }

  FX.SIM = SIM;

  /* Símbolos soltos no meio do texto corrido: converte p_{atm}, h_l,
     \varepsilon e afins para HTML, para a legenda "em que ..." sair com a
     mesma notação da fórmula. */
  FX.emTexto = function (txt) {
    var s = String(txt)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/\\([a-zA-Z]+)/g, function (m, c) { return SIM[c] || m; });
    s = s.replace(/([A-Za-zÀ-ÿ\u0370-\u03ff\)])_\{([^}]*)\}/g, '$1<sub>$2</sub>');
    s = s.replace(/([A-Za-zÀ-ÿ\u0370-\u03ff\)])\^\{([^}]*)\}/g, '$1<sup>$2</sup>');
    s = s.replace(/([A-Za-zÀ-ÿ\u0370-\u03ff\)])_([A-Za-z0-9])/g, '$1<sub>$2</sub>');
    s = s.replace(/([A-Za-zÀ-ÿ\u0370-\u03ff\)])\^([A-Za-z0-9])/g, '$1<sup>$2</sup>');
    return s;
  };

  PDA.FX = FX;
})(window.PDA = window.PDA || {});
