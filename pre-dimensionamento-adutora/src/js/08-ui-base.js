/* ------------------------------------------------------------------
 * Utilidades de interface: construção de DOM, formatação, campos
 * ligados ao estado, modais e avisos.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var UI = {};

  /* ---------------- DOM ---------------- */

  function h(tag, attrs) {
    var el = document.createElement(tag), i, k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'disabled') el.disabled = !!v;
        else if (k === 'selected') el.selected = !!v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v);
      }
    }
    for (i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }

  function add(pai, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(pai, x); }); return; }
    if (typeof c === 'string' || typeof c === 'number') { pai.appendChild(document.createTextNode(String(c))); return; }
    pai.appendChild(c);
  }

  UI.h = h;
  UI.add = add;
  UI.limpar = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* ---------------- formatação (pt-BR) ---------------- */

  UI.num = function (v, dec) {
    if (v === null || v === undefined || v === '' || isNaN(v)) return '—';
    if (!isFinite(v)) return '∞';
    var d = dec === undefined ? 2 : dec;
    return Number(v).toFixed(d).replace('.', ',');
  };

  /* formatação com nº de casas adaptado à magnitude */
  UI.auto = function (v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var a = Math.abs(v);
    if (a === 0) return '0';
    if (a >= 1000) return UI.num(v, 0);
    if (a >= 100) return UI.num(v, 1);
    if (a >= 1) return UI.num(v, 2);
    if (a >= 0.01) return UI.num(v, 3);
    return Number(v).toExponential(2).replace('.', ',');
  };

  /* formatação para célula de tabela: mantém a coluna legível quando o
     valor varia de 0,001 a alguns milhares */
  UI.tab = function (v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    if (!isFinite(v)) return '∞';
    var a = Math.abs(v);
    if (a >= 10000) return UI.num(v, 0);
    if (a >= 1000) return UI.num(v, 1);
    if (a >= 0.01 || a === 0) return UI.num(v, 2);
    if (a >= 0.001) return UI.num(v, 3);
    return Number(v).toExponential(1).replace('.', ',');
  };

  UI.parseNum = function (s) {
    if (typeof s === 'number') return s;
    if (s === null || s === undefined) return null;
    s = String(s).trim().replace(/\s/g, '');
    if (s === '') return null;
    /* aceita 1.234,56 e 1234.56 */
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(s);
    return isNaN(v) ? null : v;
  };

  /* ---------------- caminhos no estado ---------------- */

  UI.get = function (obj, caminho) {
    var p = caminho.split('.'), o = obj, i;
    for (i = 0; i < p.length; i++) {
      if (o === null || o === undefined) return undefined;
      o = o[p[i]];
    }
    return o;
  };

  UI.set = function (obj, caminho, valor) {
    var p = caminho.split('.'), o = obj, i;
    for (i = 0; i < p.length - 1; i++) {
      if (o[p[i]] === undefined || o[p[i]] === null) o[p[i]] = {};
      o = o[p[i]];
    }
    o[p[p.length - 1]] = valor;
  };

  /* ---------------- campos ligados ao estado ---------------- */

  /* op: {tipo:'num'|'texto'|'int', unid:{grandeza, caminho}, dica, larg,
          sufixo, editado, min, max, placeholder, aoAlterar} */
  UI.campo = function (st, rot, caminho, op) {
    op = op || {};
    var valor = UI.get(st, caminho);
    var input = h('input', {
      type: 'text',
      class: (op.tipo === 'texto' ? '' : 'num ') + (op.editado ? 'editado' : ''),
      value: op.tipo === 'texto' ? (valor === null || valor === undefined ? '' : valor)
                                 : (valor === null || valor === undefined || valor === '' ? '' : UI.numEdit(valor)),
      'data-bind': caminho,
      'data-tipo': op.tipo || 'num',
      inputmode: op.tipo === 'texto' ? null : 'decimal',
      placeholder: op.placeholder || null,
      title: op.title || null
    });

    var campoInterno = input;
    if (op.unid) {
      campoInterno = h('div', { class: 'par-unid' }, input, UI.selectUnid(st, op.unid.grandeza, op.unid.caminho));
    } else if (op.sufixo) {
      campoInterno = h('div', { class: 'par-unid' }, input,
        h('span', { class: 'nota', style: 'align-self:center;padding-left:2px;white-space:nowrap' }, op.sufixo));
    }

    return h('label', { class: 'campo' + (op.compacto ? ' compacto' : '') + (op.chave ? ' chave' : '') },
      h('span', { class: 'rot' }, rot, op.dica ? UI.dica(op.dica) : null),
      campoInterno);
  };

  /* valor para edição: usa vírgula mas não força casas decimais */
  UI.numEdit = function (v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v !== 'number') return String(v);
    var s = String(Math.round(v * 1e10) / 1e10);
    return s.replace('.', ',');
  };

  UI.selectUnid = function (st, grandeza, caminho) {
    var atual = UI.get(st, caminho);
    return h('select', { 'data-bind': caminho, 'data-tipo': 'texto' },
      PDA.U.lista(grandeza).map(function (u) {
        return h('option', { value: u, selected: u === atual }, PDA.U[grandeza][u].rot);
      }));
  };

  /* op: {opcoes:[{v,rot}], dica, aoAlterar} */
  UI.select = function (st, rot, caminho, opcoes, op) {
    op = op || {};
    var atual = UI.get(st, caminho);
    var sel = h('select', { 'data-bind': caminho, 'data-tipo': op.tipo || 'texto', class: op.editado ? 'editado' : '' },
      opcoes.map(function (o) {
        return h('option', { value: o.v, selected: String(o.v) === String(atual) }, o.rot);
      }));
    if (!rot) return sel;
    return h('label', { class: 'campo' + (op.chave ? ' chave' : '') },
      h('span', { class: 'rot' }, rot, op.dica ? UI.dica(op.dica) : null), sel);
  };

  UI.check = function (st, rot, caminho, op) {
    op = op || {};
    return h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: !!UI.get(st, caminho), 'data-bind': caminho, 'data-tipo': 'bool' }),
      h('span', {}, rot),
      op.dica ? UI.dica(op.dica) : null);
  };

  /* ---------------- dica / fonte ---------------- */

  UI.dica = function (texto, titulo) {
    return h('button', {
      class: 'dica naoimprime', type: 'button', title: 'Ver a origem desta informação',
      onclick: function (e) { e.preventDefault(); e.stopPropagation(); UI.modalTexto(titulo || 'Origem da informação', texto); }
    }, 'i');
  };

  UI.botaoFonte = function (ids, extra) {
    return h('button', {
      class: 'btn mini naoimprime', type: 'button',
      onclick: function () { UI.modalFontes(ids, extra); }
    }, 'Fonte');
  };

  /* ---------------- modais ---------------- */

  var fundo = null;

  UI.fecharModal = function () {
    if (fundo && fundo.parentNode) fundo.parentNode.removeChild(fundo);
    fundo = null;
  };

  UI.modal = function (titulo, conteudo, botoes) {
    UI.fecharModal();
    var m = h('div', { class: 'modal' },
      h('div', { class: 'cab' }, h('h3', {}, titulo),
        h('button', { class: 'btn mini', type: 'button', onclick: UI.fecharModal }, 'Fechar')),
      h('div', { class: 'corpo' }, conteudo),
      botoes && botoes.length ? h('div', { class: 'pe' }, botoes) : null);
    fundo = h('div', {
      class: 'fundo-modal',
      onclick: function (e) { if (e.target === fundo) UI.fecharModal(); }
    }, m);
    document.body.appendChild(fundo);
    return m;
  };

  UI.modalTexto = function (titulo, texto) {
    UI.modal(titulo, h('div', { class: 'nota', style: 'font-size:13px;line-height:1.6' }, texto));
  };

  UI.modalFontes = function (ids, extra) {
    var itens = (ids || []).map(function (id) {
      var f = PDA.R.fontes[id];
      if (!f) return null;
      return h('div', { class: 'fonte-item' },
        h('span', { class: 'tipo' }, f.tipo),
        h('h4', {}, f.titulo),
        h('p', {}, f.detalhe));
    }).filter(Boolean);
    if (extra) itens.push(h('div', { class: 'aviso info' }, extra));
    if (!itens.length) itens.push(h('p', { class: 'nota' }, 'Sem fonte cadastrada para este item.'));
    UI.modal('Origem da informação', itens);
  };

  UI.toast = function (msg) {
    var t = h('div', { class: 'toast' }, msg);
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
  };

  UI.confirmar = function (titulo, msg, aoConfirmar) {
    UI.modal(titulo, h('p', {}, msg), [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Cancelar'),
      h('button', {
        class: 'btn primario', type: 'button',
        onclick: function () { UI.fecharModal(); aoConfirmar(); }
      }, 'Confirmar')
    ]);
  };

  /* ---------------- blocos reutilizáveis ---------------- */

  UI.cartao = function (titulo, sub, corpo, dir) {
    return h('section', { class: 'cartao' },
      h('div', { class: 'cab' },
        h('h2', {}, titulo),
        sub ? h('span', { class: 'sub' }, sub) : null,
        dir ? h('div', { class: 'dir' }, dir) : null),
      h('div', { class: 'corpo' }, corpo));
  };

  UI.sub = function (t) { return h('div', { class: 'subtitulo' }, t); };

  UI.tabela = function (cabs, linhas, rodape) {
    return h('div', { class: 'rolagem' },
      h('table', {},
        h('thead', {}, h('tr', {}, cabs.map(function (c) {
          if (typeof c === 'string') return h('th', {}, c);
          return h('th', { class: c.esq ? 'esq' : null, title: c.title || null },
            c.rot, c.dica ? UI.dica(c.dica) : null);
        }))),
        h('tbody', {}, linhas),
        rodape ? h('tfoot', {}, rodape) : null));
  };

  UI.tagClasse = function (classe) {
    var m = { bom: ['bom', 'Adequado'], atencao: ['atencao', 'Atenção'], ruim: ['ruim', 'Inadequado'], na: ['cinza', '—'] };
    var t = m[classe] || m.na;
    return h('span', { class: 'tag ' + t[0] }, t[1]);
  };

  PDA.UI = UI;
})(window.PDA = window.PDA || {});
