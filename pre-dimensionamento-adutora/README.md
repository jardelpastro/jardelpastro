# Pré-dimensionamento de Adutora e Linha de Recalque

Programa de pré-dimensionamento hidráulico de adutoras e linhas de recalque de
água (bruta e tratada) e de esgoto (bruto e tratado), com cálculo por
**Hazen-Williams** e pela **fórmula universal (Colebrook-White)**.

Substitui e amplia as duas planilhas de origem
(`Pr_dimensionamento_AATR_e_LR__C.xlsx` e `Pr_dimensionamento_AATR_e_LR.xlsx`),
unificando as duas formulações num único programa.

## Como usar

O programa é **um único arquivo HTML**:

```
dist/Pre-dimensionamento-Adutora.html
```

Copie para o desktop, um pen drive ou uma pasta de rede e dê **dois cliques**.
Abre no navegador que já existe na máquina (Chrome, Edge, Firefox, Safari).

- Não instala nada
- Não pede permissão de administrador
- Não precisa de internet
- Não envia dado nenhum para fora: todo o cálculo roda no navegador
- Funciona em Windows, macOS e Linux

O projeto em andamento é guardado automaticamente no navegador daquele
computador. Para levar de uma máquina a outra, use **Salvar** (gera um arquivo
`.json`) e **Abrir**.

## O que o programa faz

**Entrada com unidades à escolha** — vazão em L/s, m³/h, m³/s, m³/dia, L/min,
L/dia ou gpm; extensão em m, km, cm, ft ou mi; pressão em mca, kPa, bar, MPa,
kgf/cm² ou psi.

**Catálogos de tubos com diâmetro interno e rugosidade** — 31 catálogos na base:

| Família | Catálogos |
|---|---|
| Ferro fundido dúctil | K7, K9, K12, flangeado para água, esgoto junta elástica, esgoto série PH |
| PEAD | PE 80 e PE 100 nos SDR 33, 26, 21, 17, 13,6, 11, 9, 7,4 e 6 (18 catálogos, PN 3,2 a 32) |
| PVC | DEFoFo, PVC-M DEFoFo, PBA classes 12, 15 e 20 |
| PVC-O | classe 450 nos PN 12,5, 16, 20 e 25 |
| Aço | SCH 40, SCH 80, STD e XS (ASME B36.10M) |
| Aço inoxidável | SCH 10S |
| Aço galvanizado | NBR 5580 classes média e pesada |
| Concreto e PRFV | NBR 8890 e NBR 15536 |

**Coeficientes de rugosidade por material e idade** — 17 materiais em quatro
faixas de condição (novo, 5–15, 15–30 e acima de 30 anos), com C de
Hazen-Williams e rugosidade absoluta ε, cada um com faixa da literatura, valor
sugerido e a fonte acessível por um botão. O fluido escolhido aplica um agravo
adicional (biofilme em esgoto, sólidos em água bruta). Todo coeficiente pode ser
sobreposto manualmente para análise pontual — o campo fica destacado quando isso
acontece.

**Comparação de diâmetros com cores** — cada trecho traz uma tabela com todos os
diâmetros do catálogo, com velocidade, perda unitária, perda total, Reynolds,
fator de atrito e a velocidade no cenário de uma só bomba (crítica para a
autolimpeza). Verde, âmbar e vermelho seguem faixas **editáveis** de velocidade
e de perda unitária, separadas por tipo de trecho (sucção, barrilete, adutora) e
por fluido (água ou esgoto). Uma estrela marca a sugestão do programa. Clicar na
linha adota o diâmetro.

**Estrutura completa da elevatória** — barrilete de sucção individual e comum,
barrilete de recalque individual e comum, e a adutora. O barrilete comum aceita
um trecho por etapa de reunião das bombas: a vazão de cada trecho acompanha
quantas bombas ele coleta, e cai automaticamente quando o cenário simulado tem
menos conjuntos em operação. No arranjo submersível os trechos de sucção são
suprimidos.

**Adutora com ramificação** — vários trechos em série, cada um com seu catálogo,
diâmetro, extensão, idade, rugosidade, cotas, PN e lista de peças. A vazão de
cada trecho pode ser uma fração da vazão total (para os trechos a jusante de uma
derivação) ou um valor absoluto. Trechos podem ser adicionados, duplicados,
desativados e removidos.

**Peças e conexões** — 38 peças com coeficiente K de tabela, cada uma com
quantidade, K sobreponível e diâmetro próprio quando diferente do tubo do trecho.

**Bombas de 1 a 50** — um cenário de cálculo para cada quantidade em operação
simultânea, com vazão, altura manométrica, potência útil, potência de eixo,
motor comercial (com folga automática por faixa de potência ou percentual fixo),
potência elétrica e NPSH disponível. A linha de motores é editável.

**Verificações** — NPSH disponível com pressão atmosférica pela altitude e
pressão de vapor pela temperatura; linha piezométrica com perfil desenhado e
pressão ponto a ponto contra o PN do tubo; pré-avaliação de golpe de aríete
(celeridade, tempo crítico, Joukowsky e Michaud) com conferência da classe de
pressão. Um painel no topo dos resultados lista tudo o que ficou fora de faixa.

**Comparação entre as quatro fórmulas** — mesmos dados, mesmas peças, mesmos
diâmetros: Hazen-Williams, Colebrook-White iterativa, Swamee-Jain e
Zigrang-Sylvester, lado a lado, com a diferença percentual na altura
manométrica.

**Memorial de cálculo** — premissas, formulação, tabela de trechos, resultado e
ressalvas, pronto para imprimir ou salvar em PDF pelo próprio navegador.

**Cadastro de catálogos** — consulta de todos os catálogos da base com DE, e, DI,
PN e área; cadastro de catálogos novos colando a tabela do fabricante
(tabulação, ponto e vírgula ou espaço como separador de coluna, vírgula decimal
preservada); duplicação de um catálogo da base para ajuste; exportação e
importação em arquivo `.json`.

**Aba de fontes** — todas as fórmulas, coeficientes de rugosidade, coeficientes
K, normas e literatura usadas, com a origem de cada número, além do registro de
auditoria das divergências encontradas nas planilhas de origem.

## Estrutura

```
src/index.html              esqueleto da página
src/styles.css              estilos (tema claro/escuro e estilos de impressão)
src/js/01-unidades.js       unidades e conversões
src/js/02-hidraulica.js     núcleo hidráulico (perda de carga, potência, NPSH, transitório)
src/js/03-rugosidade.js     coeficientes por material/idade/fluido, com fontes
src/js/04-catalogos.js      catálogos de tubos da base
src/js/05-pecas-motores.js  peças e coeficientes K, motores, critérios de verificação
src/js/06-estado.js         modelo de dados, persistência, migração
src/js/07-calculo.js        motor de cálculo (cenários, varredura, piezométrica, golpe)
src/js/08-ui-base.js        utilidades de interface
src/js/09-ui-forms.js       painéis de entrada
src/js/10-ui-resultados.js  resultados, perfil e memorial
src/js/11-ui-catalogos.js   catálogos e fontes
src/js/12-app.js            aplicação, ações, arquivos
build.py                    gera dist/Pre-dimensionamento-Adutora.html
tests/run.js                129 testes do núcleo de cálculo
tests/ui.js                 100 testes de interface em navegador
docs/AUDITORIA-PLANILHAS.md auditoria das planilhas de origem
```

## Desenvolvimento

```bash
python3 build.py        # gera o arquivo único em dist/
node tests/run.js       # testes do núcleo de cálculo (sem dependências)

npm install --no-save playwright
node tests/ui.js        # testes de interface em navegador
```

Os testes do núcleo conferem o fator de atrito contra valores do diagrama de
Moody, a reprodução exata da formulação das planilhas de origem, a coerência das
espessuras dos catálogos com as fórmulas normativas (`e = K(0,5+0,001·DN)` para
ferro fundido, `e = DE/SDR` para PEAD), a monotonicidade dos coeficientes com a
idade, os cenários de bombeamento, a classificação por cores e o transitório.

## Alcance

É **pré**-dimensionamento: define ordem de grandeza de diâmetro, altura
manométrica e potência, e sinaliza o que precisa de atenção. O projeto executivo
continua exigindo a curva da bomba, o ponto de operação real, a verificação do
NPSH requerido e a análise do transitório com dispositivos de proteção.

A operação em paralelo é tratada de forma simplificada: a vazão por bomba é
mantida constante e a vazão total cresce proporcionalmente ao número de
conjuntos. Em paralelo real cada bomba entrega menos vazão do que operando
isolada, e o ponto de operação sai da interseção da curva conjunta com a curva
do sistema.

Dimensões marcadas como **"conferir catálogo"** na base de tubos foram estimadas
por fórmula normativa e precisam ser confirmadas com o fornecedor antes do
detalhamento. A pressão admissível (PFA) do ferro fundido dúctil não está
cadastrada porque depende da classe, do DN e do tipo de junta — informe-a no
campo *PN / PFA do tubo* do trecho para habilitar a verificação de pressão.
