# Auditoria das planilhas de origem

Registro do que foi encontrado ao transportar os dados e as fórmulas das duas
planilhas para o programa. As correções também aparecem dentro do programa, na
aba **Fontes e critérios**.

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
| Hazen-Williams | `J = k·Q^a·C^−a·D^−b`, com k, a e b editáveis na aba Projeto |
| Perda localizada | `hₗ = K·v²/2g`, equivalente ao `0,0826·K·Q²/D⁴` da planilha |
| Potência de eixo | `P = γ·Q·Hm/(75·η)` [cv, Q em L/s] |
| Coeficientes K | os 19 valores da aba `Conexões`, mais 19 da tabela do Manual de Hidráulica |
| DI dos tubos | `DI = DE − 2e` |
| Espessuras FD K7 e K9 | transcritas das abas `FD JGS K7` e `FD JGS K9` |
| Espessuras PEAD | transcritas das nove abas de PEAD (exceto os dois valores do item 1) |

As constantes de Hazen-Williams das planilhas (`10,646` e expoente `4,87`) ficam
disponíveis para ajuste na aba Projeto. O padrão do programa é `10,643` e
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

Não foi cadastrada a **PFA (pressão de serviço admissível) do ferro fundido
dúctil**, porque depende da classe, do DN e do tipo de junta, e adotar um valor
único levaria a erro de projeto. O campo *PN / PFA do tubo* de cada trecho
permite informá-la e habilitar a verificação de pressão.
