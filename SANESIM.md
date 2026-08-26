# SaneSim — Simulador Hidráulico de Redes de Esgoto Sanitário

Software de dimensionamento e verificação de redes coletoras de esgoto
(estilo CESG / SewerGEMS), com geração de **memorial de cálculo em Excel**
no padrão de concessionárias (modelo SANEPAR/OSE).

## Como executar

```bash
pip install -r requirements.txt

# Interface gráfica
python main.py                          # projeto em branco
python main.py examples/exemplo_rede.json

# Linha de comando (roda a simulação e exporta o memorial)
python -m sanesim.cli examples/exemplo_rede.json -o memorial.xlsx

# Testes
python -m pytest tests/
```

## Interface

A **planta é a tela principal** — o ambiente de trabalho permanente, com
o traçado contínuo da rede ("Desenhar rede": clique no vazio cria PV e o
trecho ligando ao anterior; clique num PV existente conecta; botão
direito troca o tipo do nó; elevatória encerra; ESC sai), terreno, fundo,
desfazer/refazer, cores e exportação DXF. Os demais conteúdos abrem como
**janelas sobre a planta** pelos botões da barra (Ctrl+1 a Ctrl+4):
*Dados do Projeto* (critérios, dimensionamento, método, materiais),
*Tabelas da Rede* (nós e trechos), *Resultados* e *OSEs* — este último um
**grupo com três abas sincronizadas pela OSE selecionada: Planilha,
Perfil e Croqui (planta da OSE)**. Qualquer alteração de topologia
**invalida os resultados** da simulação anterior automaticamente. A
simulação (**F5**) e as exportações funcionam de qualquer lugar. Tema
visual nas cores da Pastro Engenharia (azul-marinho e turquesa), tabelas
com textos centralizados e ponto de milhar.

Conteúdo das janelas:

1. **Critérios de Projeto** — início e fim de plano: população, consumo
   per capita, coeficiente de retorno (C), K1, K2, K3; taxa de
   infiltração; taxas de contribuição linear automáticas (população ÷
   extensão da rede) ou manuais; **zonas de contribuição** (adensamento /
   áreas de influência): regiões com população, per capita e C próprios,
   rateados apenas pela extensão dos trechos atribuídos à zona — para
   redes que atravessam regiões de ocupação diferente (região nobre,
   região verticalizada etc.). Por padrão, a população das zonas **já é
   parte da população global** (você informa o total do projeto e as
   zonas indicam onde ele está concentrado; o rateio global distribui o
   restante nos trechos sem zona) — um checkbox permite tratá-las como
   contribuição adicional.
2. **Dimensionamento** — vazão mínima, DN mínimo, recobrimento mínimo
   (rua e passeio), profundidade máxima, tensão trativa mínima,
   velocidades mínima/máxima, lâmina máxima (y/D), declividades
   mínima/máxima impostas, degrau mínimo em PV e largura de vala.
3. **Método de Cálculo** — Manning (n do material ou n fixo); modo
   **pessimista** (vazão mínima de 1,5 l/s aplicada trecho a trecho, como
   no CESG) ou **otimista** (vazões reais acumuladas); renomear PVs em
   ordem de cálculo; cota de terreno manual ou interpolada de curvas de
   nível carregadas na tela principal (Terreno).
4. **Nós (PVs)** — nome, tipo (PV, TIL, TL, CP, TQ, EEE, Lançamento),
   coordenadas N/E, cota do terreno, vazões pontuais início/fim.
5. **Trechos** — nó de montante/jusante, extensão (ou automática pelas
   coordenadas), material, DN (fixo ou automático), declividade (fixa ou
   automática), zona de contribuição, situação (projetada/existente).
6. **Materiais e Tubos** — catálogo com PVC Ocre, PEAD corrugado,
   Concreto, Cerâmico, PRFV e Ferro Fundido; rugosidade de Manning
   mín/adotada/máx visível e editável; DNs comerciais de cada material.
7. **Resultados** — planilha no padrão do memorial (duas linhas por
   trecho: montante/jusante e início/fim de plano), com violações de
   critério destacadas em vermelho.
8. **OSEs** — as OSEs são entidades do projeto (a planta e o perfil usam
   as mesmas: alterar aqui reflete lá). A **prévia é a própria folha da
   OSE**, no layout da exportação, com os campos não hidráulicos
   **editáveis clicando neles**: número, locação, folha de cadastro,
   cidade, rua, lado, entre/e rua, observações e responsáveis
   (proposição, aprovação, liberação, execução). O **gabarito da régua é
   ajustável por OSE** (redes profundas podem exigir régua maior) e a
   planilha de estaqueamento recalcula na hora. Os três painéis (lista |
   parâmetros | prévia) são **redimensionáveis arrastando os divisores**.
   "Gerar p/ trechos sem OSE" cria OSEs automaticamente (uma por rede).
9. **Perfil** — perfil longitudinal desenhado **sempre de montante
   (esquerda) para jusante (direita)**, com **escalas independentes**
   (padrão horizontal 1:1000, vertical 1:100, ambas editáveis), grid com
   linhas mestras (100 m na horizontal, 5 m na vertical) e secundárias
   tracejadas mais fracas, terreno, tubo (geratrizes inferior e
   superior), **lâmina d'água de fim de plano preenchida em azul dentro
   do tubo**, PVs com linhas de chamada, título centralizado e títulos
   dos eixos. Sob o perfil, **bandas estilo Civil 3D**: distâncias
   (entre PVs no centro do vão + acumulada na vertical em cada PV), cota
   do terreno, cota da geratriz inferior e profundidade (a cada 20 m e
   nos PVs, textos na vertical), declividade e material/vazão por
   trecho. Zoom com a roda do mouse. Caminhos por OSE (um por ramal
   contínuo) ou por cabeceira da rede.
10. **Planta** — editor gráfico da rede: **Inserir PV** (clique cria o
    nó do tipo escolhido), **Inserir Trecho** (clique no montante e no
    jusante), arrastar PVs move e atualiza coordenadas, **botão direito**
    abre menu (Propriedades / Inverter sentido / Excluir), **clique
    esquerdo** seleciona e o painel lateral mostra as propriedades
    editáveis e os **resultados da simulação** (DN, lâmina, velocidade,
    trativa, cotas, recobrimentos); trechos com violação ficam
    vermelhos. Zoom com a roda, Pan, Delete exclui. A planta edita os
    mesmos objetos das tabelas/OSEs/perfil — tudo sincronizado.

## Metodologia de cálculo (NBR 9649)

- Vazões: `Qini = K2·C·Pi·qi/86400 + Qinf`, `Qfim = K1·K2·C·Pf·qf/86400 +
  Qinf`, distribuídas por taxa linear (l/s·km) + vazões pontuais,
  acumuladas de montante para jusante (ordenação topológica).
- Hidráulica: equação de Manning em seção circular parcialmente cheia
  (solução iterativa da lâmina y/D).
- Declividade adotada: acompanha o terreno, respeitando a mínima da norma
  (`0,0055·Qi^-0,47`), a máxima (`4,65·Qf^-0,67`, V ≤ 5 m/s) e — refino
  automático — a **tensão trativa mínima** (σ = γ·Rh·I ≥ 1 Pa), importante
  para materiais lisos (PVC, n = 0,010), em que a fórmula da declividade
  mínima da norma não garante 1 Pa.
- Diâmetro: menor DN comercial do material com y/D ≤ 0,75 na vazão final,
  nunca menor que o DN de montante.
- Cotas: geratriz inferior a partir do recobrimento mínimo, continuidade
  sem contra-declive nos PVs (com degrau quando necessário), verificação
  de recobrimento e profundidade máxima em ambas as extremidades.
- Verificações reportadas por trecho: lâmina, trativa, velocidades,
  velocidade crítica (`Vc = 6√(g·Rh)`, lâmina limitada a 50% quando
  excedida), recobrimento, profundidade (sugestão de EEE).

## Memorial de cálculo

`Exportar Memorial` gera um `.xlsx` com as abas **Capa** (critérios e
zonas), **Trechos**, **Nós**, **Dimensionamento** e **Resultados** — no
mesmo layout do memorial modelo. `Exportar OSEs` gera **uma folha por
OSE** no formato do modelo SANEPAR (folha 3): cabeçalho com número da
O.S.E., locação e folha de cadastro; identificação de cidade, rua, lado,
extensão, diâmetro e material; estaqueamento a cada 20 m contínuo por
ramal — distâncias, cota do terreno (interpolada linearmente entre PVs),
declividade, cota da geratriz inferior, régua (gabarito ajustável por
OSE), profundidade da vala e recobrimento; observações e bloco de
assinaturas (proposição/aprovação/liberação/execução).

Números são exibidos no padrão brasileiro (ponto de milhar e vírgula
decimal) na interface, e no Excel via formato nativo (`#.##0,00`), que
acompanha o idioma do usuário. As células de edição aceitam tanto
`1.234,56` quanto `1234.56`.

## Decisões estruturais (para o crescimento do software)

- **IDs estáveis**: todo nó e trecho tem um `id` interno imutável além do
  nome (renomear um PV não quebra referências) — base para o editor
  gráfico e futuras referências cruzadas.
- **Versionamento do projeto**: o `.json` grava `schema_version`;
  projetos antigos migram automaticamente na abertura e versões futuras
  são detectadas.
- **SI no núcleo, formatação na borda**: o motor calcula tudo em float/SI
  e a formatação pt-BR só acontece na apresentação.

## Estrutura do código

```
sanesim/
  core/
    hydraulics.py    # Manning, seção circular, trativa, Vc, declividades
    materials.py     # catálogo de materiais e DNs comerciais
    models.py        # projeto, critérios, nós, trechos (salva em JSON)
    simulation.py    # marcha de cálculo e verificações
    memorial.py      # exportação do memorial em Excel
  ui/                # interface PySide6 (Qt)
  cli.py             # uso em linha de comando
tests/               # 19 testes (hidráulica, simulação, interface)
examples/            # projeto de exemplo
```

## Roadmap

- [x] Motor de cálculo + memorial em Excel
- [x] Interface com abas e simulação de qualquer aba
- [x] Zonas de contribuição (adensamento / áreas de influência)
- [x] OSEs editáveis no programa + exportação no formato do modelo
- [x] Perfil longitudinal na tela: lâmina d'água, escalas, grid e bandas
- [x] Editor gráfico de planta com mouse (inserir PV/trecho, mover,
      botão direito para propriedades, seleção mostra resultados)
- [x] Cores na planta: individual (propriedades), por tipo de nó
      (elevatória = triângulo rosa) e por nome de rede (diálogo
      "Cores das redes" — coletor/interceptor com cores próprias)
- [x] Exportação do perfil para PDF (A3 paisagem) e PNG
- [x] Terreno por curvas de nível: importação de DXF (polylines com
      elevação) e CSV (E,N,Z), interpolação TIN (Delaunay, estilo
      Civil 3D; IDW como reserva), curvas desenhadas na planta e cota
      automática dos PVs (na simulação ou gravada nos nós)
- [x] Fundo de planta: DXF de arruamento/cadastro (linhas, círculos,
      arcos, textos e blocos explodidos, em cinza atrás da rede) e
      imagem raster georreferenciada (world file .jgw/.pgw/.tfw lido
      automaticamente, ou posicionamento manual E/N + m/pixel)
- [x] Exportação DXF para CAD: planta em coordenadas reais (layers
      SANESIM-* — rede por nome de rede com as cores configuradas, PVs
      por tipo, textos com DN/extensão/declividade, setas de fluxo e
      curvas de nível em polylines 3D) e perfil (layers PERFIL-* — grid,
      terreno, tubo, lâmina, PVs, bandas completas com textos)
- [x] Desfazer/refazer no editor gráfico (Ctrl+Z / Ctrl+Y, até 60
      passos: inserir/mover/excluir/editar/dividir/inverter)
- [x] Snap ao PV mais próximo ao inserir trechos; "Inserir PV neste
      ponto" no botão direito do trecho divide-o em dois, com a cota do
      novo PV vinda do terreno (ou interpolada entre os PVs vizinhos)
