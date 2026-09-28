# Revisão técnica — planilha MC_EEE03_e_LR03.xlsx

Revisão célula a célula da planilha de memorial de cálculo da EEE03 / LR03
(Santa Cruz do Capibaribe/PE), feita como insumo para o desenvolvimento do
**DimensionamentoEEE.html**. Cada item indica a aba e a célula. O software novo
já nasce com todos estes pontos corrigidos ou verificados automaticamente.


## Erros de fórmula (impacto direto no resultado)

1. **`Cálc. das Pressões'!B8` — constante 2ρ do ábaco de Donsky usa Hg em vez de Hm.**
   `2r = (a·V)/(g·'LRE03'!M15)`, onde `M15` é o **desnível geométrico** (4,54 m). A definição da
   constante da linha no método de Donsky usa a **altura manométrica total de regime** (`N15` = 7,24 mca)
   — o ábaco é lido em "% AMT". Com Hg, 2ρ = 15,4; com Hm, 2ρ = 9,6 → muda a curva do ábaco e as
   sub/sobrepressões resultantes.

2. **`LRE03'!H15` (fator de atrito, Colebrook explícito) — parêntese errado no termo interno.**
   `LOG((E15/3.71*B15)+(14.5/G15))` calcula `k·D/3,71` quando deveria ser `k/(3,71·D)`
   (o termo externo está correto: `E15/(3.71*B15)`). Com D=0,31 m o termo interno fica ~13,7× maior.

3. **`EEE03'!I95` — ΣK inconsistente na curva do sistema.**
   Todas as linhas da curva usam `11·v²/2g`, exceto a linha da vazão de operação (linha 95), que usa
   `10·v²/2g`. O ponto de operação está sendo calculado com perda localizada diferente do resto da curva.

4. **`Canal e Grad Médio man'!B71` — Kirschmer com grade obstruída: dois erros.**
   `$B$15/$B$13^(4/3)` (potência aplicada só ao denominador, deveria ser `($B$15/$B$13)^(4/3)`) e
   `SIN($B$13·π/180)` usa o **espaçamento (30 mm)** como se fosse o **ângulo** — deveria ser `$B$14` (60°).
   `B72` repete o erro do seno. Nas abas de grade fina o mesmo bloco está correto, confirmando o typo.

5. **`Canal e Grad Fino man2'!C15`** rotula a barra de 6,35 mm como "5/16"" — 6,35 mm é 1/4".
   A aba inteira é uma cópia da grade média com título "gradiamento médio" mas espaçamento de grade fina
   (15 mm) — títulos e rótulos trocados entre as três abas de gradeamento ("gradiamento" também é grafia).

6. **`LRE03'!F31/F33/F34` (barrilete comum)** — no ramo "com dn informado" a fórmula referencia
   `$F$17` (vazão do barrilete **individual**) em vez de `$F$29` (vazão do barrilete comum).
   Hoje não afeta porque as linhas usam DN, mas é uma bomba-relógio.

7. **`Dados gerais Recalque'!B34 (K)`** — o IF não tem ramo para "PVC-O" e retorna `FALSO`.
8. **`Dados gerais Recalque'!B36` — peso específico do esgoto = 900 kgf/m³.** Esgoto sanitário tem
   massa específica ≈ 998–1005 kg/m³ (praticamente água). 900 subestima qualquer cálculo de empuxo/força.
   Além disso a potência na curva do sistema (`EEE03'!M91…`) usa 1000 — inconsistente com os 900 declarados.

9. **`EEE03'!J32`** — o degrau z da Calha Parshall puxa `B33` (z **calculado** = 0,08) em vez de `B34`
   (z **adotado** = 0,07). O NA máximo do poço fica 1 cm mais baixo do que o projeto realmente terá.

10. **Células `#REF!` espalhadas** — colunas P das três abas de canal, `Pressão de Colapso PVC/PEAD'!B7:B9`
    (fator de temperatura → "Máxima pressão de operação" quebrada) e a aba `Grade` inteira. A verificação
    de colapso está rodando **sem** o fator de redução por temperatura da NBR 15802.

## Impropriedades de engenharia (resultado "passa" mas não deveria, ou critério ausente)

11. **Velocidade entre barras acima do limite e sem destaque.** `Canal e Grad Médio man'!B38 = 1,38 m/s`
    e `Fino!B37 = 1,49 m/s` para a QMH de fim de plano → "Verificar" (limite NBR/da própria planilha:
    1,20 m/s para grade manual). O projeto seguiu mesmo assim; nada muda de cor nem impede.

12. **Desarenador reprovado na taxa de escoamento superficial e sem verificação.** Área superficial
    disponível 7,8 m²; área máxima necessária no fim de plano 23,76 m² (`D74`); TES resultante
    `D80` = **1.828 m³/m²·d** contra limite máximo declarado de 1.300 (`B13`). Não existe célula de
    OK/Verificar para isso — o desarenador está subdimensionado para fim de plano e a planilha não avisa.

13. **Hm de operação digitado (5,93 mca) diverge da própria curva do sistema.** A curva da planilha dá
    7,46 mca na vazão de operação (`EEE03'!L95`) e a aba LRE03 dá 7,24 mca (`N15`). Três alturas
    manométricas diferentes convivem no arquivo; a bomba foi selecionada para a menor delas.

14. **Duas metodologias de perda de carga em paralelo com resultados divergentes** (Hazen-Williams com
    ΣK forfaitário = 11 na aba EEE03 × Colebrook + K detalhado na LRE03) sem indicação de qual governa.

15. **Kirschmer com a velocidade errada.** A fórmula clássica usa a **velocidade de aproximação** no
    canal (v0); a planilha aplica a velocidade **entre as barras**, superestimando a perda limpa
    (conservador, mas conceitualmente errado — e o check das duas versões coexiste com a fórmula
    "(v²−v0²)/(1,4·2g)" sem dizer qual vale).

16. **Volume do poço × partidas/hora inconsistente.** `B16` usa 150 s (equivale a T = 10 min → 6
    partidas/h), mas `C71` declara 10 partidas/hora (T = 6 min → bastariam 90 s). Não há vínculo entre
    o volume exigido e o nº de partidas admissível do motor — são dados soltos.

17. **Calha Parshall genérica.** Só 6 tamanhos (3" a 24"), rotulados com apóstrofo (pés) em vez de
    aspas (polegadas), e a equação única `Q = 2,2·W·h^1,5` para todos os tamanhos. Cada garganta tem
    seu par (K, n) próprio (Azevedo Netto/Chow); nos tamanhos pequenos a diferença passa de 5%.
    O tamanho escolhido (9") entra "hard-coded" via `$B$19` nas fórmulas.

18. **Checks com rótulo trocado.** `D39: SE(vméd ≤ 1,2; "Vméd > 0,60 m/s - OK")` — o texto afirma a
    verificação de mínimo (0,60) mas o teste é o de máximo (1,20); a velocidade média mínima nunca é
    de fato verificada nas grades.

19. **"Verificação dos níveis" depende de atingir meta manual** ("Atingir meta = 0" em `H10`) — o perfil
    hidráulico do canal não fecha sozinho; exige Solver/manual toda vez que uma vazão muda.

20. **Abas mortas/de outro projeto**: `Incontrol` (catálogo de medidores), `Recalque V D` (ventosas e
    descargas de uma linha de ~4,9 km — não desta LR de 40,65 m), `Grade` (toda #REF!). Confundem e
    passam a impressão de verificação que não existe.

21. **Sem NPSH, sem vórtice/submergência normativa explícita, sem verificação de PN × pressão máxima
    transitória** na própria planilha (a pressão máxima calculada, 12,5 mca, nunca é comparada com a
    classe de pressão da tubulação em uma célula de verificação).

22. **Volume máximo (detenção 30 min) calculado mas não confrontado** — `B21` = 45,1 m³ existe, mas não
    há check `volume útil ≤ volume máximo`.
