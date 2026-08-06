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

O projeto em andamento é guardado sozinho a cada alteração. **Salvar** guarda o
projeto na biblioteca do navegador; **Abrir** mostra essa biblioteca, com filtro e
ordenação por projeto, local, responsável, data do projeto ou data de gravação —
os exemplos ficam na mesma tela. Para levar de uma máquina a outra, **Exportar**
gera um arquivo `.json` e "Abrir de arquivo" faz o caminho de volta.
Atalhos: Ctrl+S guarda, Ctrl+O abre.

## Por onde começar

A aba **Resumo** é a porta de entrada: os campos com borda destacada são o
mínimo necessário — vazão, fluido, cota de partida, cota de chegada e número de
bombas. Logo abaixo aparecem a altura geométrica, a altura manométrica e o
panorama de todos os trechos com material, diâmetro, perdas, extensões e
potências. É o resumo do resumo.

O esquema desenhado nessa mesma aba mostra onde cada cota entra: todos os campos
de cota pedem **altitude absoluta**, na mesma referência de nível do
levantamento — não profundidade nem altura em relação ao fundo do poço. A cota de
chegada e a cota final do último trecho da adutora são o mesmo número, e o
programa mantém as duas iguais: editar uma ajusta a outra.

As abas seguintes detalham (bombas e níveis, sucção, barriletes, adutora,
perfil), e a aba **Parâmetros de cálculo**, no fim, reúne o que já vem com valor
padrão: fórmula de perda de carga, faixas que definem as cores, custos da análise
econômica e linha de motores.

## O que o programa faz

**Entrada com unidades à escolha** — vazão em L/s, m³/h, m³/s, m³/dia, L/min,
L/dia ou gpm; extensão em m, km, cm, ft ou mi; pressão em mca, kPa, bar, MPa,
kgf/cm² ou psi.

**Catálogos de tubos com diâmetro interno e rugosidade** — 35 catálogos na base:

| Família | Catálogos |
|---|---|
| Ferro fundido dúctil | K7, K9, K12, flangeado para água, flangeado PN 10 / 16 / 25 / 40, esgoto junta elástica, esgoto série PH |
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
quantidade e K sobreponível. A lista é reordenável: arraste pela alça ⠿ ou use as
setas ↑ ↓ para deixar as peças na sequência física do barrilete. O mesmo vale
para trechos de barrilete, trechos de adutora e pontos de perfil. Quando a peça tem diâmetro diferente do tubo do
trecho — uma redução, uma válvula menor que a linha — basta escolher o **DN
comercial**: o programa busca o diâmetro interno correspondente no catálogo e
calcula a perda com a velocidade nesse diâmetro.

**Desenhos esquemáticos** — as informações que dão margem a dúvida vêm com um
desenho que se atualiza com os dados do projeto: as cotas da elevatória, a
divisão do barrilete individual e comum, a ramificação da adutora, a composição
do NPSH disponível e as envoltórias do transitório.

**Curva da bomba e ponto de operação** — com três ou mais pontos da curva do
fabricante, o programa ajusta H = a₀ + a₁Q + a₂Q² por mínimos quadrados, traça a
curva do sistema e mostra o cruzamento. Também calcula a operação em paralelo
para cada quantidade de conjuntos, deixando visível que o ganho de vazão ao
ligar mais uma bomba é sempre menor que a vazão de uma bomba isolada.

**Perfil da linha e envoltórias de pressão** — cole da sua planilha as distâncias
e as cotas da geratriz da tubulação. O programa interpola a linha piezométrica em
cada ponto, soma e subtrai a sobrepressão do transitório e mostra, ponto a ponto,
onde a pressão estoura a classe do tubo e onde cai abaixo de zero (subpressão) ou
abaixo de −10 mca (separação de coluna).

**Análise econômica de diâmetro** — opcional. Acrescenta à tabela de comparação
o custo do tubo, o custo anual da energia associada à perda de carga daquele
trecho e o custo anual total, marcando com **$** o diâmetro de menor custo. O
preço do tubo é estimado por lei de potência sobre o DN, com coeficientes
editáveis: serve para localizar o mínimo, não para orçar.

**Biblioteca de projetos** — os projetos ficam guardados no navegador com nome,
local, responsável e data. A tela de abrir lista todos, com filtro por texto e
ordenação por qualquer coluna, e permite abrir, duplicar ou excluir.

**Impressão fiel à tela** — o papel reproduz a aba que está aberta: mesmos
cartões, mesmas cores das tabelas, mesmos desenhos. Some o que é comando de tela,
os campos viram texto e entra um cabeçalho com a logo e a identificação do
projeto. A aba Resultados traz o memorial completo.

**Trecho sem diâmetro fica fora do cálculo** — um trecho ativo em que o diâmetro
ainda não foi escolhido não entra na altura manométrica nem no NPSH, e é
sinalizado em vermelho no cartão e no Resumo. Trechos novos herdam catálogo,
diâmetro, idade e rugosidade do trecho anterior, então o caso é raro.

**Bombas de 1 a 50** — um cenário de cálculo para cada quantidade em operação
simultânea, com vazão, altura manométrica, potência útil, potência de eixo,
motor comercial (com folga automática por faixa de potência ou percentual fixo),
potência elétrica e NPSH disponível. A linha de motores é editável.

**Verificações** — NPSH disponível com pressão atmosférica pela altitude e
pressão de vapor pela temperatura; linha piezométrica com perfil desenhado e
pressão ponto a ponto contra o PN do tubo; pré-avaliação de golpe de aríete
(celeridade com os quatro casos de ancoragem longitudinal, tempo crítico,
Joukowsky e Michaud) com conferência da classe de pressão. Pressão negativa nunca
é classificada como adequada. Um painel no topo dos resultados lista tudo o que
ficou fora de faixa, e um **!** ao lado de cada resultado marca o que costuma
passar batido: perdas acima de 60 % da altura manométrica, altura manométrica
muito acima da geométrica, motor com folga excessiva, NPSH apertado, pressão fora
da classe do tubo. O contador na aba Resultados mostra quantos pontos estão fora
de faixa; o da aba Resumo avisa que há incoerência nos dados de entrada, com
botão de correção em um clique.

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
src/js/00-marca.js          marca do cabeçalho e carregamento da logo
src/js/08-ui-base.js        utilidades de interface
src/js/08b-esquemas.js      desenhos esquemáticos
src/js/09-ui-forms.js       painéis de entrada
src/js/09b-ui-perfil.js     perfil da linha e envoltórias
src/js/10-ui-resultados.js  resultados, piezométrica e memorial
src/js/11-ui-catalogos.js   catálogos e fontes
src/js/11b-ui-biblioteca.js biblioteca de projetos
src/js/12-app.js            aplicação, ações, arquivos
build.py                    gera dist/Pre-dimensionamento-Adutora.html
tests/run.js                243 testes do núcleo de cálculo
tests/ui.js                 236 testes de interface em navegador
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
idade, os cenários de bombeamento, a classificação por cores, a curva do sistema,
o ponto de operação em paralelo, as envoltórias do transitório e o ótimo
econômico de diâmetro.

## Pressão admissível do tubo

Quando o catálogo traz o PN — PEAD, PVC, PVC-O, ferro fundido flangeado —, o
campo *PN / PFA do tubo* do trecho é **preenchido sozinho** e acompanha a troca de
diâmetro, até você digitar um valor próprio.

As classes K do ferro fundido dúctil (K7, K9, K12) não têm PN único: a pressão
admissível depende da classe, do DN e do tipo de junta, e o que costuma governar
é a junta, não a parede. Para esses casos há um seletor com os degraus usuais de
pressão da EN 545 (10, 12, 16, 20, 25, 30, 32, 40 bar…), que preenche o campo em
um clique — a lista oferece os degraus, não afirma qual se aplica ao seu DN.
A dica do campo mostra, como referência, a resistência do corpo do tubo pela
expressão da EN 545 (`PFA = 20·e·σ/(DE−e)`), deixando claro que é um limite
superior. Confirme sempre no catálogo do fabricante.

## A logo

O símbolo do cabeçalho é um desenho vetorial feito para acompanhar as cores da
marca. O botão **Logo** carrega o arquivo oficial (PNG com fundo transparente,
JPG ou SVG) e ele substitui o desenho, inclusive na impressão do memorial. Fica
gravado no navegador daquele computador.

## Alcance

É **pré**-dimensionamento: define ordem de grandeza de diâmetro, altura
manométrica e potência, e sinaliza o que precisa de atenção. O projeto executivo
continua exigindo a curva da bomba, o ponto de operação real, a verificação do
NPSH requerido e a análise do transitório com dispositivos de proteção.

Nos cenários por número de bombas, a operação em paralelo é tratada de forma
simplificada: a vazão por bomba é mantida constante e a vazão total cresce
proporcionalmente ao número de conjuntos. Para o comportamento real, lance a
curva da bomba na aba Bombas e níveis — aí o ponto de operação sai da interseção
da curva conjunta com a curva do sistema, e a tabela de operação em paralelo
mostra o ganho efetivo de vazão de cada conjunto adicional.

A avaliação do transitório é preliminar e considera a **tubulação sem
dispositivos de proteção**: sem tanque de alívio, chaminé de equilíbrio, válvula
antecipadora de onda, ventosa de duplo efeito ou volante de inércia. Não integra
as equações do transitório pelo método das características, não representa
reflexões nas mudanças de diâmetro e de material e não modela separação e retorno
de coluna. Serve para saber se a classe de pressão tem folga e se o transitório
exige estudo específico — e, quando exige, o caminho não é engrossar a parede do
tubo, é dimensionar a proteção.

Dimensões marcadas como **"conferir catálogo"** na base de tubos foram estimadas
por fórmula normativa e precisam ser confirmadas com o fornecedor antes do
detalhamento. A pressão admissível (PFA) do ferro fundido dúctil não está
cadastrada porque depende da classe, do DN e do tipo de junta — informe-a no
campo *PN / PFA do tubo* do trecho para habilitar a verificação de pressão.
