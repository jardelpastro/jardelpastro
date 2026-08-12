# 💧 Tempo de Esvaziamento de Adutora

Aplicativo web (arquivo único, sem dependências) para **cálculo do tempo de esvaziamento de um trecho de adutora** pela descarga de fundo e para **dimensionamento do diâmetro da descarga** a partir de um tempo-alvo.

## Como usar

Basta abrir o arquivo [`Tempo de Esvaziamento de Adutora.html`](Tempo%20de%20Esvaziamento%20de%20Adutora.html) em qualquer navegador — não precisa de internet nem de instalação. Funciona também no celular.

Dois modos de operação:

1. **⏱️ Calcular tempo de esvaziamento** — informe os dados da adutora e o diâmetro da descarga; o app retorna o tempo de esvaziamento, a vazão inicial e a velocidade do jato.
2. **📐 Dimensionar a descarga** — informe o tempo de esvaziamento desejado (passo de 0,1 h); o app calcula o diâmetro mínimo teórico e sugere o DN comercial imediatamente superior.

E duas configurações de descarga:

- **Extremidade (um lado)** — a descarga fica na ponta baixa do trecho;
- **Ponto baixo (dois lados)** — a descarga fica num ponto baixo com adutora dos dois lados, cada lado com **diâmetro, extensão e desnível próprios** (ex.: DN 300, 1.000 m e 15 m à esquerda; DN 200, 500 m e 8 m à direita). Ao ativar o segundo lado, o DN₂ herda o valor do esquerdo até ser editado.

Ao escolher o DN da adutora, o app **já preenche a descarga com o DN sugerido** (maior DN comercial da faixa usual D/6 a D/4) e exibe a faixa como botões clicáveis — o usuário permanece livre para adotar qualquer outro valor.

## Dados de entrada

| Dado | Símbolo | Unidade |
|---|---|---|
| Diâmetro (interno) de cada lado da adutora | D (ou DN₁, DN₂) | mm |
| Extensão de cada lado (ponto alto → descarga) | L (ou L₁, L₂) | m |
| Desnível de cada lado (cota do ponto alto − cota da descarga) | H (ou H₁, H₂) | m |
| Diâmetro da descarga *(modo 1)* | d | mm |
| Tempo de esvaziamento desejado *(modo 2)* | t | h |
| Coeficiente de vazão da descarga | Cd | – |

Valores usuais de Cd: 0,61 (orifício de parede delgada), 0,82 (tubo curto + válvula — caso mais comum), 0,97 (bocal com bordas arredondadas).

## Método de cálculo

Cada lado é tratado como um reservatório prismático que esvazia por um orifício, com a carga sobre a descarga decrescendo à medida que a linha esvazia (declividade uniforme):

- Volume do trecho: `V = A₁·L₁ + A₂·L₂`, com `Aᵢ = π·Dᵢ²/4`
- Vazão inicial pela descarga: `Q₀ = Cd·a·√(2g·Hmax)`, com `a = π·d²/4`

**Um lado:** `t = 2·V/Q₀ = 2·V / (Cd·a·√(2gH))` — a integração da equação do orifício com carga variável, para volume distribuído linearmente com a cota, resulta no dobro do tempo da vazão inicial constante.

**Dois lados (desníveis diferentes):** definindo a "capacitância" de cada lado `cᵢ = Aᵢ·Lᵢ/Hᵢ` (volume por metro de carga), o esvaziamento ocorre em duas fases:

1. **Fase 1** — enquanto o nível do lado mais alto está acima de `H_baixo`, o lado mais baixo permanece cheio (pressurizado pela coluna vizinha) e só o lado alto rebaixa:
   `t₁ = 2·c_alto·(√H_alto − √H_baixo) / (Cd·a·√(2g))`
2. **Fase 2** — com os níveis igualados, os dois lados esvaziam juntos:
   `t₂ = 2·(c₁+c₂)·√H_baixo / (Cd·a·√(2g))`

Tempo total: **`t = t₁ + t₂`**. Com desníveis iguais, a expressão se reduz exatamente à fórmula de um lado.

A velocidade inicial na seção da descarga é `v₀ = Cd·√(2g·Hmax)` — ela depende **apenas do desnível e do Cd**, não do diâmetro da descarga (Torricelli).

## Hipóteses

- Adutora isolada a montante (registros fechados, sem vazão afluente);
- Entrada de ar adequada nos pontos altos (ventosas) — sem ela o tempo real é maior e há risco de colapso por subpressão;
- Declividade uniforme em cada lado;
- Perdas de carga distribuídas na adutora desprezadas (a favor da segurança na velocidade do jato; efeito pequeno no tempo para descargas usuais).

## Verificações automáticas

- Relação d/D abaixo da faixa usual **D/6 a D/4**;
- Tempo de esvaziamento acima de **6 horas** (sugestão de aumentar a descarga ou prever descargas intermediárias);
- Velocidade do jato exibida **sempre** (alerta quando acima de 6 m/s — prever dissipação de energia e proteção anti-erosiva no lançamento).

## Tema / cores

O tema segue a identidade visual da **Pastro Engenharia**: azul-marinho (`#1b2452`) como cor principal e verde-água (`#2aa39c`) como realce, com o cabeçalho em degradê marinho → teal. Todas as cores ficam em variáveis CSS no início do arquivo (bloco `:root`, seção "PALETA DO TEMA") — ajustando `--primaria`, `--primaria-escura`, `--realce` e derivadas, a interface e o esquema ilustrativo (SVG) acompanham automaticamente.

## Memória de cálculo

A memória de cálculo ocupa a largura total abaixo dos resultados e apresenta cada passo em três linhas: **fórmula em notação matemática** (frações e radicais renderizados em CSS puro, sem bibliotecas externas — o app segue 100% offline), **fórmula substituída pelos valores** e **resultado**, com a **fonte de cada fórmula** indicada ao lado do título do passo (Azevedo Netto — *Manual de Hidráulica*; Porto — *Hidráulica Básica*; Tsutiya — *Abastecimento de Água*).

> ⚠️ Ferramenta de **pré-dimensionamento**: os resultados devem ser verificados nas condições específicas de cada projeto.
