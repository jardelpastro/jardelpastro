# 💧 Tempo de Esvaziamento de Adutora

Aplicativo web (arquivo único, sem dependências) para **cálculo do tempo de esvaziamento de um trecho de adutora** pela descarga de fundo e para **dimensionamento do diâmetro da descarga** a partir de um tempo-alvo.

## Como usar

Basta abrir o arquivo [`index.html`](index.html) em qualquer navegador — não precisa de internet nem de instalação. Funciona também no celular.

Dois modos de operação:

1. **⏱️ Calcular tempo de esvaziamento** — informe os dados da adutora e o diâmetro da descarga; o app retorna o tempo de esvaziamento, a vazão inicial e a velocidade do jato.
2. **📐 Dimensionar a descarga** — informe o tempo de esvaziamento desejado; o app calcula o diâmetro mínimo teórico e sugere o DN comercial imediatamente superior.

## Dados de entrada

| Dado | Símbolo | Unidade |
|---|---|---|
| Diâmetro (interno) da adutora | D | mm |
| Extensão do trecho (ponto alto → descarga) | L | m |
| Desnível (cota do ponto alto − cota da descarga) | H | m |
| Diâmetro da descarga *(modo 1)* | d | mm |
| Tempo de esvaziamento desejado *(modo 2)* | t | h |
| Coeficiente de vazão da descarga | Cd | – |

Valores usuais de Cd: 0,61 (orifício de parede delgada), 0,82 (tubo curto + válvula — caso mais comum), 0,97 (bocal com bordas arredondadas).

## Método de cálculo

O trecho é tratado como um reservatório prismático que esvazia por um orifício, com a carga sobre a descarga decrescendo à medida que a linha esvazia (declividade uniforme entre o ponto alto e a descarga):

- Volume do trecho: `V = (π·D²/4)·L`
- Vazão inicial pela descarga: `Q₀ = Cd·a·√(2gH)`, com `a = π·d²/4`
- Tempo de esvaziamento: **`t = 2·V/Q₀ = 2·V / (Cd·a·√(2gH))`**

A integração da equação do orifício com carga variável, para volume distribuído linearmente com a cota, resulta no dobro do tempo que se obteria mantendo a vazão inicial constante.

## Hipóteses

- Adutora isolada a montante (registro fechado, sem vazão afluente);
- Entrada de ar adequada no ponto alto (ventosas) — sem ela o tempo real é maior e há risco de colapso por subpressão;
- Declividade uniforme no trecho.

## Verificações automáticas

O app emite alertas quando:

- a relação d/D fica abaixo da faixa usual **D/6 a D/4**;
- o tempo de esvaziamento supera **6 horas** (sugestão de aumentar a descarga ou prever descargas intermediárias);
- a velocidade do jato supera **6 m/s** (prever dissipação de energia e proteção anti-erosiva no lançamento).

> ⚠️ Ferramenta de **pré-dimensionamento**: os resultados devem ser verificados nas condições específicas de cada projeto.
