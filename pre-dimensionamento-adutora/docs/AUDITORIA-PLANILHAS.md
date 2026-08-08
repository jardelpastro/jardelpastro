# Auditoria das planilhas de origem

Registro do que foi encontrado ao transportar os dados e as fórmulas das duas
planilhas para o programa. As correções também aparecem dentro do programa, na
aba **Fontes**.

## 1. Divergências corrigidas

### 1.1 PVC DEFoFo — espessuras copiadas do PEAD

Na aba `PVC DEFoFo Amanco`, as espessuras de DN 150 a DN 300 eram
**4,8 / 10,9 / 12,3 / 13,8 / 15,3 mm** — exatamente as espessuras do
`PEAD PN 5 PE 100` para DE 315, 355, 400, 450 e 500. A série DEFoFo real segue
SDR 25 (PN 1,0 MPa), o que dá **4,8 / 6,8 / 8,9 / 11,0 / 13,1 mm** — os valores
que constam da própria aba `MPVC DEFoFo Tigre` da mesma planilha.

Efeito no cálculo: no DN 150 o DI saía 148,2 mm em vez de 156,4 mm, o que
**superestimava a perda de carga distribuída em cerca de 30 %** naquele diâmetro.

Adotado no programa: série SDR 25 (`e = DE/25`), coerente com a aba MPVC e com a
NBR 7665.

### 1.2 PEAD SDR 17 — DE 1200

A planilha traz `e = 67,9 mm`. Pela série, `e = DE/SDR = 1200/17 = 70,6 mm`.
Corrigido para 70,6 mm.

### 1.3 PEAD SDR 13,6 — DE 1000

A planilha traz `e = 72,5 mm`. Pela série, `e = 1000/13,6 = 73,5 mm`.
Corrigido para 73,5 mm.

### 1.4 Quinta linha da tabela de diâmetros — referência deslocada

Planilha Hazen-Williams, célula `F15`:

```
=IF(A14="", "", 10.646*(B14/D14)^1.852*(1/A14)^4.87*1000)
```

Todas as referências apontam para a linha **14**, não para a 15. Resultado: o
quinto diâmetro da comparação (`DN+2`) mostrava a perda unitária do quarto
(`DN+1`), repetindo o valor anterior. O mesmo deslocamento aparece na célula
`D15` da planilha Colebrook.

No programa a comparação varre todos os diâmetros do catálogo, cada linha com os
seus próprios dados.

### 1.5 Fator de atrito — parênteses faltando

Planilha Colebrook, célula `G11`:

```
=1/(LOG(D11/(3.71*A11)-(5.02/F11)*LOG((D11/3.71*A11)+(14.5/F11)))^2)
```

No termo interno do segundo logaritmo está escrito `D11/3.71*A11`. Sem
parênteses, o Excel avalia `(D11/3,71)*A11` — **multiplica** pelo diâmetro em vez
de dividir. O primeiro termo, três caracteres antes, está correto:
`D11/(3.71*A11)`.

Além disso, a constante consagrada na fórmula de Colebrook é **3,7** (e não 3,71).

No programa a fórmula de Zigrang-Sylvester está implementada como

```
f = 0,25 / [ log₁₀( ε/3,7D − (5,02/Re)·log₁₀( ε/3,7D + 14,5/Re ) ) ]²
```

e é oferecida como uma das opções de cálculo, ao lado da Colebrook-White
resolvida por iteração (que não depende de aproximação).

Sobre os fatores 1/4: a planilha calculava `f` sem o `0,25` e compensava com
`(0,08271/4)` na perda de carga. As duas simplificações se cancelam, e o
resultado final da perda estava correto — mas o valor exibido na coluna
*"Fator 1"* era **quatro vezes** o fator de atrito de Darcy-Weisbach. No programa
o `f` exibido é o de Darcy-Weisbach.

## 2. Formulações mantidas

Reproduzidas sem alteração, para garantir continuidade dos resultados:

| Item | Formulação |
|---|---|
| Hazen-Williams | `J = k·Q^a·C^−a·D^−b`, com k, a e b editáveis na aba Parâmetros de cálculo |
| Perda localizada | `hₗ = K·v²/2g`, equivalente ao `0,0826·K·Q²/D⁴` da planilha |
| Potência de eixo | `P = γ·Q·Hm/(75·η)` [cv, Q em L/s] |
| Coeficientes K | os 19 valores da aba `Conexões`, mais 19 da tabela do Manual de Hidráulica |
| DI dos tubos | `DI = DE − 2e` |
| Espessuras FD K7 e K9 | transcritas das abas `FD JGS K7` e `FD JGS K9` |
| Espessuras PEAD | transcritas das nove abas de PEAD (exceto os dois valores do item 1) |

As constantes de Hazen-Williams das planilhas (`10,646` e expoente `4,87`) ficam
disponíveis para ajuste na aba Parâmetros de cálculo. O padrão do programa é `10,643` e
`4,871`, do Manual de Hidráulica — a diferença nos resultados é inferior a 0,1 %.

Verificação cruzada nos testes (`tests/run.js`, seção 3): com as constantes da
planilha, o programa reproduz o valor da planilha com erro relativo abaixo de
10⁻⁹; e o `J` calculado confere com a forma independente
`v = 0,355·C·D^0,63·J^0,54` dentro de 1 %.

## 3. Diferenças de método, não de erro

### 3.1 Potência com mais de uma bomba

As planilhas obtinham a potência de 2, 3 e 4 bombas dividindo o BHP de uma bomba
por fatores fixos — `1,6`, `2,5` e `2,7`:

```
J20 = BHP/1,6      J21 = BHP/2,5      J22 = BHP/2,7
```

Esses divisores são uma correlação empírica. O programa recalcula o sistema
inteiro para cada quantidade de bombas em operação: a vazão total muda, as perdas
mudam com o quadrado da vazão, a altura manométrica muda e a potência sai daí.
A tabela **Cenários de operação** mostra uma linha por quantidade de conjuntos.

Fica registrado o limite dessa abordagem: mantém-se a vazão por bomba constante,
o que é a simplificação usual em pré-dimensionamento. Em paralelo real cada bomba
entrega menos vazão do que operando isolada.

### 3.2 Escolha do diâmetro

As planilhas escolhiam o diâmetro minimizando `|J − 5,5|` (célula `O11`), isto é,
buscando a perda unitária mais próxima de 5,5 m/km, dentro de uma janela de cinco
diâmetros em torno do DN informado.

O programa varre **todos** os diâmetros do catálogo e classifica cada um por duas
faixas simultâneas — velocidade e perda unitária — separadas por tipo de trecho e
por fluido, todas editáveis. A sugestão marcada com estrela é o menor diâmetro
que atende integralmente; se nenhum atender, é o de perda unitária mais próxima
do centro da faixa recomendada. O critério anterior pode ser reproduzido
ajustando a faixa boa de J para algo como 5,0 a 6,0 m/km.

### 3.3 Rugosidade na fórmula universal

A planilha Colebrook adotava `K = 0,00015 m` (0,15 mm) para DN ≥ 100 e
`0,00005 m` (0,05 mm) para DN < 100, independentemente do material — a rugosidade
variava com o diâmetro, e não com o tubo.

No programa a rugosidade vem do material e da faixa de idade, com faixa da
literatura e valor sugerido, mais um agravo pelo fluido. Continua sobreponível
por trecho para análise pontual.

### 3.4 Altura geométrica

A planilha usava `Hg = cota de chegada − cota de saída`, com um valor único. O
programa calcula as duas condições: `Hg` máxima com o nível de sucção mínimo (que
governa a altura manométrica e o motor) e `Hg` mínima com o nível máximo.

### 3.5 Perdas do barrilete

Nas planilhas as perdas localizadas do barrilete eram calculadas com a **vazão
total** (`$B$3`) em todas as peças, inclusive nas do trecho individual de cada
bomba. Em um barrilete com 4 bombas, a válvula de retenção individual passa
apenas 1/4 da vazão — a perda nela é 16 vezes menor do que a calculada com a
vazão total.

No programa cada trecho recebe a sua vazão: individual conduz uma bomba, e cada
trecho do barrilete comum conduz o número de bombas que ele reúne.

### 3.6 Coeficiente de ancoragem do transitório

A planilha não tratava transitório. Na primeira versão deste programa, o campo ψ
aceitava apenas o valor 1,0 e a dica afirmava que esse era o caso mais
conservador para a celeridade — **o que está invertido**. Como ψ multiplica o
termo `D/(e·E)` no denominador da celeridade, um ψ maior reduz a celeridade:

| Caso de ancoragem longitudinal | ψ | Celeridade |
|---|---|---|
| Com juntas de dilatação em todo o comprimento | 1 | a menor |
| Ancorado apenas na extremidade de montante | 1 − ν/2 | intermediária |
| Ancorado contra movimento longitudinal em todo o comprimento | 1 − ν² | **a maior** |

O tubo travado axialmente é mais rígido, a onda anda mais rápido e a sobrepressão
é maior — é o caso desfavorável. Os três casos, mais a entrada manual, estão
disponíveis, com o coeficiente de Poisson ν de cada material (Halliwell, 1963;
Streeter & Wylie).

### 3.7 Pressão negativa classificada como adequada

Defeito da primeira versão deste programa, encontrado em uso: a verificação de
pressão comparava a pressão apenas com o PN do tubo. Um ponto com **−21,95 mca**
saía como "Adequado", porque −21,95 é menor que o PN.

Corrigido: a classificação agora testa também os limites físicos. Pressão
negativa nunca é adequada — significa que a linha piezométrica passa abaixo da
tubulação. Abaixo de −10 mca, a coluna d'água se rompe.

A causa raiz naquele caso era outra, e também foi tratada: a **cota de chegada**
do bloco de níveis divergia da **cota final do último trecho** da adutora
(124,05 m contra 146,00 m). A altura geométrica saía do primeiro campo e o perfil
era desenhado com o segundo, e nada avisava. Agora os dois campos são um único
número — editar um ajusta o outro — e um verificador acusa qualquer divergência
remanescente, com correção em um clique.

### 3.8 Vazão em dobro na curva do sistema

Defeito da segunda versão, encontrado pelos testes ao implementar a curva da
bomba: a função que calcula a altura do sistema para uma vazão arbitrária
escalava a vazão *por bomba* e depois multiplicava pelo número de bombas,
dobrando a vazão total no cenário com dois conjuntos. Isso deslocava a curva do
sistema e o ponto de operação em paralelo.

Corrigido: a vazão por bomba passa a ser `qTotal/n`. O teste que guarda essa
propriedade verifica que, para a mesma vazão total, a altura do sistema é a mesma
com uma ou com duas bombas — porque as perdas são da tubulação, não do número de
conjuntos.

### 3.9 Trecho sem diâmetro caía no menor DN do catálogo

Defeito da terceira versão deste programa, encontrado ao investigar um relato de
NPSH negativo depois de acrescentar um barrilete.

Um trecho ativo sem diâmetro escolhido não era ignorado: a rotina que resolve o
tubo caía no **primeiro item do catálogo** — o menor DN. Num barrilete de sucção
com 685 L/s, isso significava DN 80 (DI 86 mm), velocidade de 118 m/s e perda de
carga de 1346 m, derrubando o NPSH disponível para −1334 mca.

O NPSH em si estava certo: usa apenas as perdas de sucção, e barriletes de
recalque nunca o alteraram. O que produzia o número absurdo era o diâmetro
fantasma.

Corrigido: um trecho ativo sem diâmetro fica **fora do cálculo** — não soma perda
nenhuma —, o cartão do trecho avisa em vermelho e a pendência aparece no Resumo e
no contador da aba. A cobrança só acontece quando o trecho já foi lançado (tem
extensão ou peças), para um trecho recém-criado em branco não gerar alarme.

Três medidas evitam que a situação se repita: um trecho novo herda catálogo,
diâmetro, idade e rugosidade do trecho anterior; o projeto em branco começa com
os barriletes desligados; e a aba Resultados fica em silêncio enquanto o projeto
não tiver vazão e diâmetro.

### 3.10 Critério de velocidade nos trechos de sucção comum

Os trechos criados no barrilete de sucção comum nasciam com o tipo `barrilete`, e
por isso eram coloridos pela faixa de velocidade do barrilete (até 3,5 m/s em
água) em vez da faixa de sucção (até 2,0 m/s), que é a que preserva o NPSH.
Corrigido, com ajuste automático dos projetos já gravados ao serem abertos.

### 3.11 Numeração do sumário e dos índices deslocada de uma página

Defeito da versão que introduziu o memorial exportável, encontrado ao conferir as
páginas geradas contra o que o sumário anunciava.

O paginador calcula os números de página medindo os blocos de verdade, e depois
mapeia cada capítulo, figura e tabela para a página em que caiu. O deslocamento
usado nesse mapeamento era `1 + páginas de sumário` — contava a capa, mas não
contava que o corpo começa **depois** da última página de índice. Com capa mais
duas páginas de sumário/índices, o capítulo que sai na página 4 era anunciado
como página 3, e o erro se repetia em todas as 49 chamadas.

Corrigido para `2 + páginas de sumário`. Um teste de interface passou a conferir,
para cada chamada do sumário e dos índices, o número anunciado contra a página em
que o elemento realmente aparece.

### 3.12 Tabela cortada e página quase em branco na paginação

Na mesma revisão, duas falhas de quebra de página:

- a divisão de uma tabela entre páginas estimava o espaço da legenda, do
  cabeçalho e das bordas por uma folga fixa de 8 px; quando a estimativa ficava
  curta, a primeira parte não cabia no que restava da página e era empurrada
  inteira para a seguinte, deixando três linhas numa folha praticamente vazia.
  Agora esse custo é **medido**, montando uma parte de uma linha só e descontando
  a altura da linha;
- um título de capítulo podia ficar sozinho no pé da página. Passou a exigir
  espaço para pelo menos três linhas de texto depois dele; caso contrário, começa
  na página seguinte.

No exemplo de esgoto o documento caiu de 23 para 21 páginas, sem nenhuma quebra
malfeita. Os testes conferem que nenhum bloco ultrapassa o rodapé e que nenhuma
página termina em título.

### 3.13 Impressão do memorial saía em branco a partir da prévia

A prévia mostra o documento dentro de uma janela; o botão de imprimir fechava
essa janela **depois** de montar o documento, e como o documento estava dentro
dela, ia junto — a impressão saía sem nada. Corrigido: a janela é fechada antes,
e o documento é recolocado no corpo da página antes de montar.

No mesmo passo, o nome do arquivo `.doc` levava um travessão; o navegador
descarta nomes com esse caractere e salvava tudo como `download`, sem extensão.
O nome passa por uma limpeza antes de ir para o arquivo.

### 3.14 Fórmulas escritas em linha

Até esta versão o memorial escrevia as expressões em linha — `J = f · v² / (2 ·
g · D)` —, o que é legível, mas não é a notação de um memorial de cálculo. Foi
escrito um compositor matemático próprio (`src/js/08c-formula.js`): lê um código
parecido com o do LaTeX e devolve um SVG com fração de barra horizontal, radical
com barra sobre o radicando, expoentes, índices e parênteses que crescem com o
conteúdo. Vale para a fórmula simbólica e para a memória de cálculo — nesta, as
linhas saem alinhadas pelo sinal de igual.

O SVG serve às duas saídas: fica vetorial no PDF e é convertido em imagem na
exportação para o Word, pelo mesmo caminho já usado nos gráficos.

### 3.15 Formatação do documento

O memorial passou a seguir a ABNT: Arial 12 pt, margens 3/2/3/2 cm, parágrafo
justificado com recuo de 1,25 cm, numeração progressiva das seções sem ponto
após o indicativo, seção primária em folha nova, número da página no canto
superior direito, equações numeradas entre parênteses, legenda de figura acima e
fonte abaixo, tabelas na largura da mancha com 10 pt, linhas de 0,6 cm e sem
traços verticais (padrão IBGE), pré-textuais na ordem capa, lista de figuras,
lista de tabelas e sumário, e referências como elemento pós-textual sem
indicativo numérico.

A única divergência deliberada em relação à norma é o **espaçamento entre
linhas: 1,2 em vez de 1,5**, a pedido do usuário.

## 4. Itens que dependem de conferência do fornecedor

Marcados no programa com a etiqueta **"conferir catálogo"** e listados no painel
de avisos dos resultados:

- **PVC PBA** (classes 12, 15 e 20): espessuras estimadas por `e = DE/SDR`, com
  `SDR = 2σ/p + 1` e σ = 10 MPa.
- **PVC-O classe 450**: espessuras estimadas por `SDR = 2σ/PN + 1`, com
  σ = MRS/C = 45/1,4 = 32 MPa (ISO 16422).
- **Aço galvanizado NBR 5580** e **aço inoxidável SCH 10S**: dimensões conforme
  as séries normativas, a confirmar no catálogo.
- **Ferro fundido K12**: espessuras calculadas por `e = 12·(0,5 + 0,001·DN)`.
  Conferem exatamente com as espessuras de DN 700 a 1200 da aba
  `FD Flanges Água` da planilha, o que valida a fórmula.

- **Ferro fundido flangeado PN 10 / 16 / 25 / 40**: a espessura de parede segue a
  classe K (K9 até DN 600 e K12 acima, nas classes até PN 16; K12 em toda a faixa
  nas classes PN 25 e PN 40), e a classe de pressão do conjunto é limitada pelo
  flange conforme EN 1092-2. A PFA por DN e a disponibilidade de cada diâmetro
  devem ser confirmadas no catálogo do fabricante.

Não foi cadastrada a **PFA (pressão de serviço admissível) das classes K do ferro
fundido dúctil** (K7, K9, K12), porque depende da classe, do DN e do tipo de
junta, e adotar um valor único levaria a erro de projeto.

Vale registrar por que não foi resolvido por fórmula. A expressão da EN 545 para
a resistência do corpo do tubo,

```
PFA [bar] = 20 · e · σ / (DE − e)      σ = Rm/SF = 420/3 = 140 MPa
```

dá, para o K9 DN 300 (e = 7,2 mm, DE = 326 mm), **63 bar** — enquanto o valor
publicado em catálogo para esse tubo com junta elástica é da ordem de 40 bar.
A diferença não é erro: o corpo do tubo aguenta mais do que a junta, e é a junta
que governa. Adotar o número da fórmula seria superestimar a capacidade e
aprovar pressões que o conjunto não suporta.

O programa então: preenche o campo sozinho quando o catálogo traz o PN; oferece
os degraus usuais da EN 545 num seletor, para preenchimento em um clique nas
classes K; e mostra a resistência do corpo apenas como referência na dica do
campo, dizendo explicitamente que é um limite superior.
