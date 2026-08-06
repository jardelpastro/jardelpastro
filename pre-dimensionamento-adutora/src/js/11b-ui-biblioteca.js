/* ------------------------------------------------------------------
 * Biblioteca de projetos: lista os projetos guardados no navegador,
 * ordenável por qualquer coluna, com os exemplos ao final.
 * ------------------------------------------------------------------ */
(function (PDA) {
  'use strict';

  var B = {};
  var UI, h;

  B.init = function () { UI = PDA.UI; h = UI.h; };

  B.ordem = { campo: 'salvoEm', desc: true };
  B.filtro = '';

  var COLUNAS = [
    { campo: 'nome', rot: 'Projeto', esq: true },
    { campo: 'local', rot: 'Local', esq: true },
    { campo: 'responsavel', rot: 'Responsável', esq: true },
    { campo: 'data', rot: 'Data do projeto', esq: true },
    { campo: 'salvoEm', rot: 'Salvo em', esq: true }
  ];

  function dataBR(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    function z(n) { return (n < 10 ? '0' : '') + n; }
    return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() +
           '  ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }

  function ordenar(lista) {
    var c = B.ordem.campo, desc = B.ordem.desc;
    return lista.slice().sort(function (a, b) {
      var va = a[c], vb = b[c];
      if (c === 'salvoEm') {
        va = va || ''; vb = vb || '';
        return desc ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
      }
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      var r = va.localeCompare(vb, 'pt-BR');
      return desc ? -r : r;
    });
  }

  /* ================================================================
     Modal
     ================================================================ */

  B.abrir = function () {
    var corpo = h('div', {});
    B.desenhar(corpo);
    UI.modal('Abrir projeto', corpo, [
      h('button', { class: 'btn', type: 'button', onclick: UI.fecharModal }, 'Fechar'),
      h('button', { class: 'btn', type: 'button', 'data-acao': 'importarProjeto' }, 'Abrir de arquivo…')
    ]);
  };

  B.desenhar = function (corpo) {
    UI.limpar(corpo);
    var todos = PDA.E.biblioteca();
    var termo = B.filtro.trim().toLowerCase();
    var lista = termo
      ? todos.filter(function (r) {
          return [r.nome, r.local, r.responsavel, r.data].join(' ').toLowerCase().indexOf(termo) >= 0;
        })
      : todos;
    lista = ordenar(lista);

    var busca = h('input', {
      type: 'text', placeholder: 'filtrar por projeto, local, responsável…',
      value: B.filtro, style: 'max-width:320px'
    });
    busca.addEventListener('input', function () {
      B.filtro = busca.value;
      B.desenhar(corpo);
      var novo = corpo.querySelector('input[type="text"]');
      if (novo) { novo.focus(); novo.setSelectionRange(novo.value.length, novo.value.length); }
    });

    corpo.appendChild(h('div', { class: 'linha', style: 'margin-bottom:10px' },
      busca,
      h('span', { class: 'nota' },
        todos.length + ' projeto(s) guardado(s) neste navegador' +
        (termo ? '  ·  ' + lista.length + ' na busca' : ''))));

    if (!todos.length) {
      corpo.appendChild(h('div', { class: 'aviso info' },
        h('b', {}, 'A biblioteca está vazia'),
        'Use o botão Salvar no cabeçalho para guardar o projeto atual aqui. ' +
        'A biblioteca fica no navegador deste computador — para levar um projeto para outra máquina, ' +
        'use Exportar e depois "Abrir de arquivo".'));
    } else if (!lista.length) {
      corpo.appendChild(h('p', { class: 'vazio' }, 'Nada encontrado para "' + B.filtro + '".'));
    } else {
      var cabs = COLUNAS.map(function (col) {
        var ativa = B.ordem.campo === col.campo;
        return h('th', {
          class: (col.esq ? 'esq ' : '') + 'ordenavel',
          title: 'Ordenar por ' + col.rot.toLowerCase(),
          onclick: function () {
            if (B.ordem.campo === col.campo) B.ordem.desc = !B.ordem.desc;
            else { B.ordem.campo = col.campo; B.ordem.desc = col.campo === 'salvoEm'; }
            B.desenhar(corpo);
          }
        }, col.rot, ativa ? h('span', { class: 'seta' }, B.ordem.desc ? ' ▾' : ' ▴') : null);
      });
      cabs.push(h('th', {}, ''));

      var linhas = lista.map(function (r) {
        var atual = PDA.App.st && PDA.App.st.id === r.id;
        return h('tr', { class: atual ? 'selecionada' : null },
          h('td', { class: 'esq' },
            h('b', {}, r.nome),
            atual ? h('span', { class: 'tag neutro', style: 'margin-left:6px' }, 'aberto') : null,
            h('div', { class: 'nota' }, B.descricao(r))),
          h('td', { class: 'esq' }, r.local || '—'),
          h('td', { class: 'esq' }, r.responsavel || '—'),
          h('td', { class: 'esq' }, r.data || '—'),
          h('td', { class: 'esq' }, dataBR(r.salvoEm)),
          h('td', { style: 'white-space:nowrap' },
            h('button', { class: 'btn mini primario', type: 'button',
                          'data-acao': 'abrirDaBiblioteca', 'data-id': r.id }, 'Abrir'),
            h('button', { class: 'btn mini', type: 'button', style: 'margin-left:4px',
                          'data-acao': 'duplicarDaBiblioteca', 'data-id': r.id,
                          title: 'Abrir como um projeto novo, sem sobrescrever este' }, 'Duplicar'),
            h('button', { class: 'btn mini perigo', type: 'button', style: 'margin-left:4px',
                          'data-acao': 'excluirDaBiblioteca', 'data-id': r.id }, 'Excluir')));
      });

      corpo.appendChild(h('div', { class: 'rolagem', style: 'max-height:46vh;overflow-y:auto' },
        h('table', { class: 'enxuta' }, h('thead', {}, h('tr', {}, cabs)), h('tbody', {}, linhas))));
      corpo.appendChild(h('p', { class: 'nota', style: 'margin-top:7px' },
        'Clique no título de qualquer coluna para ordenar.'));
    }

    corpo.appendChild(UI.sub('Exemplos'));
    corpo.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
      h('button', {
        class: 'btn', type: 'button', style: 'text-align:left;padding:10px',
        'data-acao': 'exemploAgua'
      }, h('b', {}, 'Adutora de água tratada — 400 L/s, 214 m'),
         h('div', { class: 'nota' }, 'PEAD PE 100, cotas 620 → 642 m, 3 bombas instaladas e 2 em operação, Hazen-Williams com C = 130.')),
      h('button', {
        class: 'btn', type: 'button', style: 'text-align:left;padding:10px',
        'data-acao': 'exemploEsgoto'
      }, h('b', {}, 'Linha de recalque de esgoto bruto — 685 L/s, 6,67 km'),
         h('div', { class: 'nota' }, 'Ferro fundido dúctil K7, cotas 126 → 149 m, 5 bombas instaladas e 4 em operação, Colebrook-White com barrilete comum progressivo.'))));
  };

  B.descricao = function (r) {
    var s = r.resumo;
    if (!s) return '';
    var partes = [];
    if (s.vazao) partes.push(UI.numEdit(s.vazao) + ' ' + s.unidade);
    if (s.bombas) partes.push(s.bombas + ' bombas');
    if (s.trechos) partes.push(s.trechos + ' trecho(s)');
    if (s.extensao) partes.push(UI.num(s.extensao, 0) + ' m');
    var fl = PDA.R.fluidos.filter(function (f) { return f.id === s.fluido; })[0];
    if (fl) partes.push(fl.rot.toLowerCase());
    return partes.join('  ·  ');
  };

  PDA.B = B;
})(window.PDA = window.PDA || {});
