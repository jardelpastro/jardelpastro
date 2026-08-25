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

A janela principal tem 7 abas — a simulação (**F5** ou botão
**▶ Rodar Simulação**) e a exportação do memorial funcionam de **qualquer
aba**, sem precisar passar por todas:

1. **Critérios de Projeto** — início e fim de plano: população, consumo
   per capita, coeficiente de retorno (C), K1, K2, K3; taxa de
   infiltração; taxas de contribuição linear automáticas (população ÷
   extensão da rede) ou manuais; **zonas de contribuição** (adensamento /
   áreas de influência): regiões com população, per capita e C próprios,
   rateados apenas pela extensão dos trechos atribuídos à zona — para
   redes que atravessam regiões de ocupação diferente (região nobre,
   região verticalizada etc.).
2. **Dimensionamento** — vazão mínima, DN mínimo, recobrimento mínimo
   (rua e passeio), profundidade máxima, tensão trativa mínima,
   velocidades mínima/máxima, lâmina máxima (y/D), declividades
   mínima/máxima impostas, degrau mínimo em PV e largura de vala.
3. **Método de Cálculo** — Manning (n do material ou n fixo); modo
   **pessimista** (vazão mínima de 1,5 l/s aplicada trecho a trecho, como
   no CESG) ou **otimista** (vazões reais acumuladas); renomear PVs em
   ordem de cálculo; cota de terreno manual ou interpolada de curvas de
   nível (reservado para a versão com planta).
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
mesmo layout do memorial modelo. `Exportar OSE` gera a planilha da Ordem
de Serviço para Execução (estilo folha 3 do modelo SANEPAR): um bloco por
trecho com estaqueamento a cada 20 m — distâncias, cota do terreno
(interpolada linearmente entre PVs), cota da geratriz inferior, altura e
bordo da régua (gabarito 3,00 m), profundidade da vala e recobrimento.

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
- [x] Planilha da OSE (folha 3 do modelo — estaqueamento a cada 20 m)
- [ ] Perfil longitudinal (folha 1) — desenho terreno × coletor
- [ ] Planta da rede (folha 2) + interpolação de curvas de nível
- [ ] Editor gráfico com mouse: inserir PVs/estruturas clicando na tela,
      botão direito para editar propriedades, botão esquerdo para
      inspecionar resultados (lâmina, vazões...). A base já está
      preparada: a interface usa Qt, cujo `QGraphicsScene/QGraphicsView`
      oferece exatamente esse modelo de interação (itens clicáveis com
      menu de contexto, zoom/pan, snapping).
- [ ] Exportação DXF (planta/perfil para CAD)
