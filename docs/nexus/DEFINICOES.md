# Pastro Nexus: definições antes de começar

Data: 03/09/2026. Estado: análise, nada da plataforma foi construído.

Este documento responde à pergunta "começo, ou preciso definir algo antes para não complicar depois?". A resposta é: sim, existe um bloco de definições que precisa ser fechado antes da primeira linha de código da plataforma. Elas ficam gravadas dentro de cada HTML (e de toda cópia salva), em URLs, em chaves de banco e nos termos que o usuário aceita no primeiro login. Por isso não se corrigem depois sem migração, rebuild dos seis apps ou reaceite de termos.

Tudo o mais pode esperar, desde que o esquema deixe o espaço preparado. A seção 5 lista o que espera e o que fica preparado.

Método: seis leitores mapearam cada aplicativo a partir do código; três arquiteturas foram propostas de forma independente e julgadas por três avaliadores com lentes distintas (operador único, antipirataria, produto e receita); quatro críticos adversariais (antipirataria, negócio, LGPD, engenharia) levantaram armadilhas e definições. Este texto consolida o que sobreviveu.

---

## 1. Inventário dos aplicativos (estado em 03/09/2026)

Fonte: os seis branches `claude/*` do repositório `jardelpastro/jardelpastro`. Nenhum foi mesclado no `main`. Os PRs 1 a 5 estão abertos; o PR 6 (SaneSim) foi fechado sem merge.

| Aplicativo | Branch | Stack | Tamanho | Persistência | Exporta | Versão no projeto salvo |
|---|---|---|---|---|---|---|
| Pré-dimensionamento de Adutora e LR (+ Bloco de Ancoragem) | `adutora-dimensionamento-software-dn4dye` | HTML único gerado por `build.py` a partir de `src/` | 676 KB | localStorage `pda.*` | PDF, DOC, JSON, XLSX | sim (`E.VERSAO`) |
| Tempo de Esvaziamento de Adutora | `adutora-esvaziamento-calc-z5nmb3` | HTML único | 46 KB | só tema (`tema-esvaziamento`) | nenhuma | não se aplica |
| Conduto Forçado por Gravidade | `gravity-conduit-sizing-software-c5h89e` | HTML único | 196 KB | localStorage `gcf_*` | JSON, impressão | sim (`versao: 1`) |
| Dimensionamento de EEE | `sewage-lift-station-sizing-s4bdb3` | HTML único (linhagem PDA) | 743 KB | localStorage `eee.*` | PDF, JSON | sim (`E.VERSAO`) |
| Dimensionamento de Travessia | `software-dimensionamento-travessia-ia272p` | HTML único (linhagem PDA) | 318 KB | localStorage `trv.*` | PDF, JSON | sim (`E.VERSAO`) |
| SaneSim (redes de esgoto) | `sewage-hydraulic-simulation-hhe6sl` | Python 3 + PySide6 desktop, CLI | 48 arquivos | JSON em disco | XLSX (memorial, OSE), DXF | sim (`schema_version`) |

Traços comuns aos cinco apps HTML:

- Zero chamadas de rede, zero dependência externa (CDN, fontes). Tudo embutido.
- Tema Pastro (azul-marinho `#0E2148`, turquesa `#0E6F66`), com variação de paleta no Esvaziamento e no SaneSim (`#1B2B5B` / `#2FB8A9`).
- Prefixo próprio nas chaves de localStorage, então não colidem se servidos do mesmo domínio.
- Nenhum tem noção de usuário, licença, plano ou telemetria.
- O README do app Adutora promete: "Não instala nada, não precisa de internet, não envia dado nenhum para fora, copie para o desktop ou pen drive e dê dois cliques".

O SaneSim tem versão declarada em código (`__version__ = 0.1.0`) que não aparece em nenhuma tela. Nenhum dos cinco HTML tem versão de software; o que existe (`versao: 1`, sufixo `.v1` nas chaves) é versão de esquema de dados.

### 1.1 O que não foi possível ver

A pasta "Pastro Nexus" citada no pedido não existe no repositório. Trabalhei sobre os seis branches. Se a pasta local tiver versões mais novas ou aplicativos a mais, é preciso enviá-la ao repositório antes de qualquer decisão de layout.

### 1.2 Fato que precede tudo: o repositório é público e sem licença

`jardelpastro/jardelpastro` é o repositório de perfil do GitHub. Ele precisa ser público para o README aparecer no perfil. Consequência: os seis aplicativos completos estão baixáveis por qualquer pessoa hoje, sem arquivo LICENSE e sem aviso de direitos em nenhum HTML.

Agravantes verificados:

- Todos os commits dos seis branches têm autoria "Claude". Em disputa de titularidade, a prova de autoria humana (Lei 9.610, art. 11) fica enfraquecida sem documentação do processo de especificação e revisão.
- O arquivo `RevisaoPlanilha_MC_EEE03_e_LR03.md` (branch da EEE) é uma revisão célula a célula de uma planilha de projeto real e cita o município (Santa Cruz do Capibaribe/PE). Se o contrato de origem tiver cláusula de confidencialidade, isso já é um problema.
- Os exemplos embutidos (EEE03, LR03, "Emissário ETE C3", `exemplo_rede.json` com cidade "Campo Largo") derivam de planilhas de projetos. Precisam ser conferidos e, se necessário, substituídos por dados fictícios.

Isso não impede a plataforma. Impede que o modelo de receita dependa de sigilo do código.

---

## 2. Premissa técnica que muda o produto: os apps são 100% cliente

Os cinco HTML são legíveis, sem minificação, com namespaces globais (`window.PDA`, `window.TRV`, `window.GCF`). Qualquer usuário logado aperta Ctrl+S e leva o programa inteiro. Qualquer pessoa com o console do navegador chama `PDA.X.pdf()` e gera o memorial. Qualquer bloqueio dentro do HTML é conveniência para o usuário honesto entender o que está pagando; não é proteção.

O que a plataforma controla de fato, porque depende de coisas que só o servidor tem:

- quem entra (conta e sessão) e com quais capacidades;
- quem recebe versões novas (correções de cálculo, catálogos atualizados, recursos novos);
- download do SaneSim e, no futuro, projetos na nuvem;
- rastreabilidade: quem baixou o quê, quando, e o nome do licenciado nos documentos gerados.

Consequências para as definições:

1. Zero horas em ofuscação ou minificação. Não para ninguém determinado e piora o suporte.
2. Nenhum material comercial ou termo pode usar as palavras "proteção", "DRM" ou "antipirataria".
3. O preço do plano gratuito é definido sabendo que o HTML completo está com todo usuário logado. O que se vende é acesso atualizado, documento identificado, suporte e nuvem.
4. O enforcement que funciona neste nicho é contratual: licença pessoal e intransferível nos Termos, identificação do licenciado nos documentos, consequência (encerramento da conta).
5. Se um dia for necessário gate de conteúdo, a única alavanca sem reescrever o motor é servir os catálogos pelo servidor. Fica registrado como fase futura, nunca antes de haver clientes.

---

## 3. Definições que precisam ser tomadas agora

Cada item traz o que decidir, por que agora e a recomendação. A recomendação é uma escolha, não um menu. Onde a decisão é só sua, está marcado.

### Bloco A. Titularidade e jurídico

**A1. Quem vende e quem controla os dados.**
Termos de Uso, Política de Privacidade, nota fiscal, INPI e a figura do controlador (LGPD) exigem um único nome desde o primeiro aceite. Lançar como pessoa física e migrar para a PJ depois é novo contrato com cada assinante.
Recomendação: Pastro Engenharia (PJ) como fornecedora, licenciante e controladora. Termo de cessão de direitos autorais de Jardel para a PJ cobrindo os seis programas, com anexo do histórico de especificação e revisão como prova de autoria humana. Registro dos programas no INPI (facultativo, mas prova data e titularidade).

**A2. Repositório privado, licença proprietária e saída dos apps do repositório de perfil.**
Cada dia com o código público aumenta cópias e forks que não se recolhem. Os seis branches partem do mesmo commit e têm layouts incompatíveis (quatro na raiz, dois em subpasta); nunca serão mesclados em `main` sem reorganização.
Recomendação: criar `jardelpastro/pastro-nexus` privado como monorepo, importar cada branch com histórico (`git subtree add --prefix=apps/<slug>`), adicionar LICENSE proprietário e cabeçalho de copyright em cada HTML gerado e em `main.py`. Depois, apagar os seis branches do repositório de perfil e registrar a data. Este repositório de perfil volta a ser só o README.

**A3. Exemplos e materiais de origem sem dado de cliente real.**
Exemplos vão para o botão "Exemplos" de um produto comercial e para toda cópia salva. Anonimizar depois obriga a refazer os testes numéricos.
Recomendação: regra escrita: nenhum exemplo com nome de obra, município identificável, rua, coordenada real, contrato ou ART. Dados fictícios de mesma ordem de grandeza, testes recalibrados uma vez. `RevisaoPlanilha_MC_EEE03_e_LR03.md` sai do repositório distribuído. Caso real só com autorização escrita do cliente.

**A4. Autoria dos documentos gerados.**
Hoje o memorial sai com o símbolo Pastro na capa quando nenhuma logo foi escolhida (adutora, EEE, travessia); o conduto imprime "PASTRO ENGENHARIA" fixo no cabeçalho; o SaneSim carimba pranchas com a marca. Ao vender a terceiros, cada memorial com erro de terceiro sai com aparência de autoria da Pastro perante CREA, concessionária e Ministério Público.
Recomendação: substituir a marca autoral por um crédito fixo em toda saída: "Gerado com Pastro Nexus, <app> v<versão>, dados normativos v<versão>, em DD/MM/AAAA. Pré-dimensionamento sob responsabilidade do profissional identificado." Logo Pastro só por escolha explícita do usuário. Bloquear a geração de memorial se o campo do responsável técnico estiver vazio (decisão sua). Nos Termos: ferramenta de apoio, a Pastro não revisa, não assina, não emite ART; responsabilidade limitada ao valor pago nos 12 meses anteriores, sem excluir dolo (isenção total é nula perante consumidor).

### Bloco B. Identidade, acesso e sessão

**B1. Login por código de 6 dígitos, sem link, sem senha.**
O público (concessionárias, prefeituras, escritórios) usa gateways corporativos (Safe Links, Proofpoint, Mimecast) que pré-abrem links de e-mail e consomem tokens de uso único; o login por link falha sem explicação. Link abre no navegador padrão do cliente de e-mail, muitas vezes outro, e a sessão nasce longe do localStorage dos apps. Trocar o método depois é migrar toda a base.
Recomendação: código de 6 dígitos, validade 10 minutos, uso único, guardado só como hash, 5 tentativas por código, limite por e-mail e por IP, sem link consumível no e-mail. Código vinculado ao navegador que pediu (cookie de desafio) quando o provedor permitir. Nunca colocar o código no assunto do e-mail. Sem senha significa que não existe "esqueci a senha"; o e-mail é a identidade.

**B2. Conta é da pessoa; perfil criado só após verificação.**
`users.email` é a chave lógica em qualquer arquitetura. Criar registro antes de verificar o código permite que qualquer visitante crie perfil com o e-mail de outra pessoa (dado pessoal sem base legal).
Recomendação: titular é a pessoa física dona do e-mail, mesmo corporativo. Perfil só após o código validado; registros não verificados apagados em 24 h. Caixas compartilhadas (`projetos@empresa`) desencorajadas nos Termos e tratadas como compartilhamento indevido. Licença por empresa vai para organizações (B4). Regra escrita para quando o engenheiro sai da empresa: a conta e os dados locais ficam com a pessoa; o assento da organização é reatribuível pelo dono da organização.

**B3. Sessão opaca, em cookie HttpOnly, separada do token de capacidades.**
Os apps vão dividir origem com o login e montam HTML com conteúdo colado pelo usuário (`innerHTML` no esvaziamento, parsers de catálogo colado, importação de JSON sem validação, `REL.imprimir` do conduto). Um XSS em qualquer app na mesma origem de um token legível por JavaScript vira roubo de conta e incidente LGPD reportável.
Recomendação: sessão opaca no servidor, cookie `__Host-`, HttpOnly, Secure, revogável, 30 dias deslizantes, máximo de 5 sessões ativas por conta com lista em /conta. Token de capacidades separado e de baixo valor. Antes do lançamento: escapar todo dado de usuário nos pontos de `innerHTML` e validar envelopes importados. CSP estrita no portal; nos apps só depois de refatorar os handlers inline do esvaziamento.

**B4. Modelo de dados: usuário separado de assinatura, organizações mínimas, anonimização em vez de exclusão.**
Assinatura tem histórico (trial, upgrade, cortesia, cancelamento) e não pode ser coluna do usuário. Escritórios e órgãos compram por CNPJ com vários assentos e nota única; sem `org_id` na primeira migração, toda assinatura nasce amarrada a uma pessoa. O Marco Civil (art. 15) manda guardar registros de acesso por 6 meses e o fisco manda guardar nota por 5 anos; exclusão em cascata apaga o que a lei manda guardar.
Recomendação: tabelas `usuarios`, `organizacoes` e `membros` (sem interface de convite na fase 1; o administrador preenche), `planos` (matriz de capacidades em JSON, editável sem deploy), `assinaturas` (com `usuario_id` ou `org_id`, exatamente um, e `status` em trial/ativa/atrasada/cancelada/expirada, `origem`, `fim_em`, `referencia_externa`), `eventos` (auditoria, retenção 12 meses), `emissoes` (cada token ou cópia emitida), `versoes_app` (build publicado por app, com hash e rollback), `configuracoes` (cadastro aberto, plano padrão, prazos), `emails` (status de entrega). Exclusão de conta = anonimização do perfil; assinatura e dados fiscais sem cascata, retidos 5 anos.

**B5. Região dos dados: Brasil.**
Mudar região depois é migrar projeto, chaves e URLs e reescrever a Política com novo aceite. Contratos com concessionárias podem vetar dados fora do país quando a nuvem chegar.
Recomendação: banco e autenticação em São Paulo. E-mail transacional e CDN no exterior aceitos com transferência internacional declarada na Política e termos dos fornecedores arquivados. Gateway de pagamento nacional para CPF, CNPJ e nota ficarem no Brasil.

### Bloco C. Contrato entre app e plataforma

**C1. Origem única e definitiva; apps como páginas de topo, sem iframe.**
localStorage é por origem. Toda biblioteca, catálogo, logo e timbrado que os usuários criarem na plataforma fica preso na origem escolhida; trocar depois apaga tudo pela segunda vez (a primeira é a saída do `file://`). Iframe está descartado por fatos do código: `window.prompt`, `confirm`, `Blob + <a download>`, `window.print`, Ctrl+S e Ctrl+O interceptados; tudo quebra em iframe.
Recomendação: produção em `https://nexus.pastroeng.com/apps/<slug>/`, homologação em `nexus-hml.pastroeng.com`. Nunca lançar em domínio provisório com usuários reais. Registrar que os cinco apps HTML dividem a mesma cota de localStorage (5 a 10 MB por navegador); timbrado A4 e logo de até 900 kB gravados separadamente por app estouram isso mais cedo. Mover logo e timbrado para IndexedDB é correção barata e deve entrar na integração.

**C2. Identificadores imutáveis.**
O slug vira pasta, URL, prefixo de capacidade, coluna em eventos e projetos, campo no `.json` exportado. Hoje há três nomes para o mesmo app (branch `gravity-conduit`, arquivo `conduto-forcado-gravidade`, pasta `conduto-gravidade`).
Recomendação: slugs `adutora`, `bloco`, `esvaziamento`, `conduto`, `eee`, `travessia`, `sanesim`. Minúsculas, sem hífen, sem acento. `bloco` é variante de build da adutora (flag `PDA_BLOCO`) mas entra no painel com slug, URL e capacidades próprias; o compartilhamento de catálogos, logo e timbrado com a adutora fica documentado como intencional. Arquivos em `dist/` passam a `<slug>.html`; o título humano fica só no `<title>`. Slugs de plano também são chave primária e nome comercial pode mudar, slug não (ver E1 sobre "ilimitado").

**C3. Vocabulário de capacidades, regra de ausência e independência do transporte.**
O que for compilado dentro do HTML fica em toda cópia salva para sempre. As três arquiteturas divergiram num ponto que não se corrige depois: "chave ausente = liberada" (apagar a chave no console libera o recurso) contra "chave ausente = padrão gratuito declarado pelo app". O transporte (localStorage, script injetado, token assinado) pode mudar; a API que os módulos chamam não pode, porque será escrita nos despachantes de ação de cinco apps.
Recomendação: módulo `runtime/nexus.js` em ES5, prefixado em todo build como `000-nexus.js`, expondo `NEXUS.registrar(padroes)`, `NEXUS.pode(chave)`, `NEXUS.limite(chave)`, `NEXUS.valor(chave)`, `NEXUS.bloquear(chave, rotulo)`, `NEXUS.usuario()`, `NEXUS.estado()`, `NEXUS.chave(nomeStorage)` e `NEXUS.evento(tipo, dados)` como função vazia. Regras: cada app declara em `registrar` o padrão de cada chave que consulta; chave ausente usa o padrão do app (fail-closed); resolução `cap[<app>][k]`, senão `cap['*'][k]`, senão padrão do app; tipos booleano, inteiro (-1 ilimitado, 0 indisponível) e enumeração fechada; nenhuma chave leva nome de plano e nenhum app ramifica por "pro" ou "premium"; versão do vocabulário `cv = 1`; nunca renomear, só acrescentar. Documento `docs/capacidades.md` antes do primeiro token emitido. A seção 6 traz a proposta de vocabulário.

**C4. Matriz do gratuito compilada nos apps desde o primeiro build público.**
O padrão compilado fica dentro de cada cópia salva e não pode ser alterado remotamente. Se o primeiro build sair "tudo liberado" para facilitar o lançamento, toda cópia Ctrl+S daquele período é full para sempre, sem recall. Isso repete o problema atual em escala de URL pública.
Recomendação: comportamento sem plataforma (`file://`, envelope ausente ou vencido) = matriz do gratuito, definida agora mesmo que mínima. O servidor emite um plano "fundador" generoso por cima para os primeiros usuários, com data de fim escrita no aceite (ver E2). Teste automatizado que falha se o padrão compilado liberar qualquer coisa fora da lista do gratuito.

**C5. Como o token chega ao app e por quanto tempo vale.**
Injetar o token na página servida pelo portal faz cada Ctrl+S carregar dias de uso completo e dado pessoal (e-mail) sem o usuário saber. Envelope sem assinatura em localStorage é editável em segundos. Prazos de validade e graça viram promessa nos Termos.
Recomendação: página servida sem token; o runtime busca `GET /api/licenca` com a sessão e guarda o token assinado (JWS ES256, `kid` no cabeçalho) em localStorage da origem. Validade 7 dias na URL, renovada em silêncio a cada abertura. Cópia offline só por download explícito, quando a capacidade `copiaOffline` estiver ativa, com 30 dias mais 7 de graça, registrada em `emissoes` com quem, quando e de que IP. Guarda de relógio: gravar o maior `iat` de servidor visto; se o relógio local for anterior a ele, tratar como expirado. Latência máxima de revogação (37 dias) escrita nos Termos.

### Bloco D. Versão, dados e rastreabilidade

**D1. Versão de software e versão dos dados normativos visíveis em tudo o que sai.**
Sem versão não se reproduz um cálculo em litígio, não se sabe quais memoriais saíram com um coeficiente errado e não se cumpre o dever de comunicar defeito conhecido (CDC art. 10). Os 46 catálogos e a tabela de blocos são dados transcritos à mão e vão mudar sem mudar o código.
Recomendação: `apps/<slug>/manifest.json` com slug, nome, versão semver, entrada, variantes, ordem dos módulos, chaves de storage e capacidades consultadas. O build injeta `window.NEXUS_BUILD = {app, versao, commit, data, versaoDados}`, exibido no rodapé, na Ajuda, no rodapé de cada página do memorial (PDF e .doc), no `.json` exportado e no manifest agregado. Versão inicial 1.0.0 nos cinco HTML e 0.2.0 no SaneSim (no título da janela e em Ajuda > Sobre). Catálogos ganham versão própria impressa no memorial. Ids de catálogo são imutáveis: nunca apagar, só marcar descontinuado.

**D2. Envelope único de projeto com identificador de app e recusa de esquema futuro.**
Adutora e EEE exportam o mesmo `{tipo:'pda-projeto', versao:1}`; a distinção é heurística. O conduto exporta o estado cru e aceita qualquer JSON. `E.migrar` nos quatro apps força `versao = 1` e não rejeita versões futuras: um arquivo de esquema mais novo é rebaixado e autosalvo, corrompendo o projeto em silêncio. Arquivos exportados a partir de hoje vão circular por anos anexados a processos.
Recomendação: envelope comum `{tipo:'nexus-projeto', app, esquema, appVersao, geradoEm, projeto, catalogosUsuario}`. `esquema` começa em 2 em todos os apps (1 fica para os legados). Leitores continuam aceitando os formatos antigos por 12 meses. `E.migrar` recusa esquema maior que o suportado com a mensagem que o SaneSim já usa. Importador trata toda string como texto, limita tamanho e rejeita app diferente. Extensão `.nexus.json` com o slug no nome.

**D3. Chaves de localStorage por indireção.**
As chaves não têm noção de usuário: dois logins no mesmo navegador de sala de projeto compartilham autosave e biblioteca, e o autosave a cada renderização grava o projeto de um na sessão do outro (cliente A vê dados do cliente B). Mudar isso depois de haver dados na origem definitiva exige migrar chaves com dados reais.
Recomendação: todas as constantes passam por `NEXUS.chave(nome)`, que na fase 1 devolve o próprio nome e depois poderá prefixar por `usuario.id` sob controle da plataforma. Uma linha por constante, nenhuma migração agora. Aviso bloqueante quando o e-mail do login difere do anterior, com oferta de exportar. Regra escrita: logout e downgrade nunca apagam dados de app. Prefixo `nexus.*` reservado para a plataforma.

### Bloco E. Produto, planos e comunicação

**E1. Eixo de diferenciação dos planos e nome do último nível.** (decisão sua)
São cerca de 35 capacidades vezes 6 apps. Sem um significado único por nível, premium vira "pro com mais coisas" e ilimitado vira "pro com -1 nos limites", o que não sustenta preço maior. "Ilimitado" com qualquer teto (5 sessões, cota do navegador, 50 bombas no clamp) é publicidade contestável no Procon.
Recomendação: gratuito = calcular e conferir (motor completo, tela, impressão da aba, 3 projetos na biblioteca, catálogos básicos, importar JSON, memorial com marca d'água). Pro = entregar documento (memorial PDF sem marca, exportar JSON, catálogos completos e próprios, biblioteca sem teto, perfil, curva de bomba, cenários, comparações, download do SaneSim). Premium = módulos especializados e identidade do escritório (Word, logo e timbrado, transitório e proteção, blocos, concessionária na EEE, ferrovia e galeria/HDD na travessia, paralelo e perfil no conduto, parâmetros editáveis, OSE e DXF no SaneSim). Quarto nível renomeado para "Empresa" antes de virar chave primária: CNPJ, assentos, nota única, nuvem quando existir. Não é "mais recursos", é "mais pessoas". Lançar com gratuito e pro visíveis; os outros dois existem como linhas ocultas até haver pedido.

**E2. O que os primeiros usuários recebem e até quando.**
Hoje todo usuário tem os arquivos full. Gravar "tudo liberado" nas quatro linhas de planos produz uma página de planos com quatro planos idênticos e ancora o produto como gratuito. Restringir depois sem data combinada é alteração unilateral (CDC art. 51) e fonte de contestação.
Recomendação: gratuito perpétuo com matriz fixa desde o dia 1, sem trial automático. Plano "fundador" oculto atribuído no cadastro durante a janela de lançamento, com `fim_em` fixo (90 a 180 dias) escrito no aceite, no banner do app e no e-mail de boas-vindas; ao vencer, cai para gratuito ou converte com desconto de fundador. Cortesias posteriores só com `fim_em` obrigatório. Cláusula de alteração de recursos de plano pago só com aviso de 30 dias e direito de cancelar com devolução proporcional.

**E3. Memorial no gratuito: marca d'água, não bloqueio.**
Bloquear o PDF não bloqueia o resultado, porque a impressão da aba por Ctrl+P sempre funciona. Trocar bloqueio por marca d'água depois altera cinco apps e a expectativa dos fundadores.
Recomendação: gratuito gera o memorial completo com marca d'água diagonal "Versão gratuita, Pastro Nexus" em todas as páginas e sem logo própria; pro remove a marca. Marca d'água modelada como capacidade (`marca.dagua = true` no gratuito). Aviso de pré-dimensionamento e responsabilidade do profissional em todo memorial de todo plano. Decisão sua: aceita que um cliente apresente a uma concessionária um memorial com marca "versão gratuita"?

**E4. Nova promessa de offline e privacidade, em texto único.**
Os textos atuais ficam falsos no dia em que existir login. Foram localizados em pelo menos doze pontos: README da adutora ("Não precisa de internet", "Não envia dado nenhum para fora", "copie para um pen drive"), docstring de `build.py`, `noscript` de adutora, EEE, travessia e conduto, modal Ajuda de adutora, EEE e travessia ("Nenhum dado sai do computador"), modal Logo da travessia, três avisos do conduto, README do esvaziamento ("100% offline", "Funciona também no celular"). LGPD exige aviso antes da coleta; publicar com texto falso é coleta sem aviso e publicidade enganosa (CDC art. 37).
Recomendação: um texto de três frases, gerado pelo build a partir de `docs/textos.json` e inserido em todos os pontos: "Para entrar é preciso internet; depois o programa funciona sem conexão pelo prazo informado no painel. Os dados do projeto ficam no seu navegador e não são enviados à Pastro Engenharia. A plataforma recebe apenas seu e-mail, data e hora de acesso, endereço IP e qual programa e versão foi aberto, conforme a Política de Privacidade." Retirar "funciona no celular" até testar. Guardar o diff dos textos e a data como prova de que o aviso precedeu a coleta.

**E5. Telemetria de dentro dos apps: decidir agora, mesmo que a resposta seja não.** (decisão sua)
A resposta define a Política de Privacidade e o aceite. Ligar depois exige novo aviso e reaceite de toda a base, e as cópias baixadas nunca recebem o texto novo. Desligar depois é trivial. Sem eventos (app aberto, ação bloqueada, memorial gerado) a matriz de planos será calibrada por intuição.
Recomendação: fase 1 sem nenhum evento saindo de dentro dos apps; o servidor registra apenas login, emissão de capacidades, app aberto (pela entrega do HTML) e downloads. `NEXUS.evento()` existe como função vazia. Isso mantém a frase "os dados ficam no seu navegador" literalmente verdadeira. Se preferir métricas de uso de recursos desde o início, a Política nasce com base legal de legítimo interesse, sem nenhum dado de projeto, e a contagem de bloqueios aparece também para o próprio usuário em /conta.

**E6. Versão avulsa gratuita para pen drive: sim ou não, decidido explicitamente.** (decisão sua)
O canal oficial passa a ser a URL. A promessa do pen drive só continua verdadeira se existir um build sem login, com a matriz gratuita fixa e sem expiração.
Recomendação: sim. Mesmo build, variante `dist/<slug>.avulso.html`, rotulada "versão avulsa, sem conta, recursos do plano gratuito", com versão visível, oferecida no painel. Substitui a distribuição informal de hoje e dá caminho legítimo a quem só quer o básico. O Bloco de Ancoragem segue a mesma regra.

**E7. Estrutura comercial: pacote único por pessoa, mensal e anual, em BRL com tributos inclusos, vendido pela PJ com nota a cada recebimento.**
Define colunas de preço, a página de planos no dia 1 e o que a fatura descreve. Anual sem regra de reembolso nos termos aceitos vira Procon. Venda de software exige CNAE compatível (62.02-3 ou 62.03-1) e enquadramento definido pelo contador; órgão público retém ISS na fonte. Stripe não emite NFS-e nem faz Pix recorrente, e o público compra por Pix, boleto e empenho.
Recomendação: pacote com os seis apps, por assento, mensal e anual (anual igual a 10 mensalidades), preço exibido com tributos. SaneSim incluído a partir do pro, não produto separado (decisão sua). Gateway nacional com Pix, boleto, cartão recorrente e NFS-e integrada (Asaas ou equivalente) na fase 1.5; Stripe descartado. Fase 1 com cobrança manual por Pix e nota emitida a cada recebimento. Nenhuma cobrança, nem Pix manual, antes do parecer do contador. Regras de ciclo nos Termos do primeiro aceite: cancelamento a qualquer momento com acesso até o fim do período; arrependimento em 7 dias; upgrade imediato pro-rata; downgrade na virada; inadimplência com 7 dias de graça e queda para gratuito sem apagar dados.

**E8. Nome e marca.**
"Nexus" é termo genérico com muitos registros. O nome entra no título dos seis apps, no remetente do e-mail, nos modais, nos termos e no subdomínio com reputação de envio.
Recomendação: busca no INPI (classes 9 e 42) antes da primeira publicação; se livre, depósito de "Pastro Nexus". Domínio `nexus.pastroeng.com`; `pastronexus.com.br` só como redirecionamento. Nome do produto centralizado em uma constante para trocar em um lugar.

### Bloco F. Engenharia e operação

**F1. Monorepo, build unificado a partir de fontes modulares, `dist/` gerado só por CI.**
Só a adutora tem fontes e build versionados. EEE (14 mil linhas) e travessia (7 mil) são monólitos com marcadores de módulo, recuperáveis por corte automático; conduto (3,7 mil) não tem marcadores; esvaziamento é um script único. O runtime precisa ser prefixado em todo build e cada gate entra em pontos internos dos módulos. Fazer isso à mão em monólitos sem build é a forma mais rápida de quebrar cálculo sem perceber.
Recomendação: generalizar `build.py` para ler o manifest de cada app: concatena o runtime, os módulos na ordem declarada, injeta `NEXUS_BUILD` e variantes, recusa `</script` no conteúdo, grava `dist/<slug>.html`. Recuperar EEE e travessia cortando nos marcadores; conduto entra como módulo único; esvaziamento idem. Adutora e EEE compartilham a linhagem PDA mas ficam como duas cópias declaradas; unificação só com testes verdes nos dois. `dist/` sai do controle de versão.

**F2. Linha de base de testes de fumaça por app antes de qualquer gate.**
Adutora tem 366 testes de núcleo; SaneSim tem 112; EEE, travessia, conduto e esvaziamento têm zero. Os pontos onde a plataforma vai mexer (despachantes de ação, `E.guardar`, `E.carregarCatalogos`, clamps) são exatamente os que alteram resultado de cálculo ou perdem projeto. Depois da primeira alteração, a "referência" já é o código alterado.
Recomendação: regra escrita: nenhuma edição de plataforma entra em um app sem teste que carregue o bundle em `vm` (modelo de `tests/run.js` da adutora), rode o exemplo embutido e compare 3 a 5 números fixados por você ou pelas planilhas de origem. CI com matriz por app; PR obrigatório para `main`; produção só por tag. O teste do SaneSim quebra ao mudar de pasta (caminho relativo em `test_ui_smoke.py`) e `exemplo_rede.json` está em `schema_version` 3 com código em 8: corrigir na importação.

**F3. Dois ambientes desde o primeiro deploy, com backends e remetentes separados.**
Login por código, templates de e-mail, URLs de redirecionamento e migrações precisam ser testados com e-mails reais antes de tocar usuário. Código de teste saindo do remetente de produção queima reputação.
Recomendação: homologação publicada a cada merge em `main`, produção só por tag. Backend próprio por ambiente, remetente `hml@envio.pastroeng.com` para testes. Segredos só no cofre do CI. Branch `main` protegido, token de deploy com escopo mínimo, 2FA em todas as contas com códigos de recuperação fora do computador.

**F4. DNS e e-mail transacional: subdomínio de envio dedicado; escolher o provedor de backend antes de mexer no DNS.**
Sem e-mail entregue não existe login. Reputação, propagação e alinhamento SPF/DKIM/DMARC levam semanas. Enviar do domínio raiz coloca `pastro@pastroeng.com` na mesma reputação de um remetente automático novo. Uma das arquiteturas exigiria mover a zona inteira de `pastroeng.com`, o que toca MX e SPF do e-mail corporativo.
Recomendação: envio exclusivamente de `envio.pastroeng.com` com SPF, DKIM e DMARC próprios e Reply-To humano. Antes de qualquer registro, exportar a zona atual e conferir a política DMARC do raiz (sem tag `sp`, ela se aplica aos subdomínios) e o número de consultas do SPF. Não mover a zona. Testar entrega em Gmail, Microsoft 365 e um domínio de concessionária antes de anunciar.

**F5. Custódia de segredos e segundo humano de confiança.**
A chave privada de assinatura comprometida permite forjar licenças até a rotação; perder acesso a uma conta sem segundo humano para o produto.
Recomendação: chave privada só no cofre do provedor, nunca em arquivo local; `kid` e mapa de duas chaves públicas no runtime; rotação semestral no calendário. Runbook em `docs/` com passos de restauração; simulado de restauração de backup antes do primeiro cliente externo e trimestral depois. Nome de uma segunda pessoa com acesso de emergência.

**F6. Escopo da fase 1 fechado por escrito.**
"Nuvem de projetos" e "sincronizar entre computadores" vão aparecer no primeiro mês. Conflito de edição, versões e cotas são projeto próprio.
Recomendação: fase 1 sem nuvem de projetos, sem gateway de pagamento, sem organizações na interface, sem telemetria de dentro dos apps, sem gate em Python no SaneSim. SaneSim entra como download autenticado do pacote atual, com `licenca.json` (nome, e-mail, versão, data) dentro do zip e versão visível, sem verificação interna. Escrito na página de planos: "projetos ficam no navegador até a nuvem existir".

---

## 4. Arquitetura recomendada

Três arquiteturas foram propostas de forma independente e julgadas por três avaliadores.

| Proposta | Operador único | Antipirataria | Produto e receita |
|---|---|---|---|
| Supabase + Cloudflare Pages | 31 | 28 | 30 |
| Cloudflare Worker + D1 + KV (edge puro) | 26 | 28 | 28 |
| FastAPI + SQLite + VPS Hetzner (Python) | 26 | 23 | 28 |

Notas de 8 a 40. Dois juízes escolheram a primeira; o juiz de antipirataria empatou a primeira com a segunda e desempatou pela segunda.

**Escolha: Supabase (autenticação por código, Postgres em São Paulo, RLS) + Cloudflare Pages com Functions para entrega dos apps só a sessão válida + Resend para e-mail transacional**, com os seguintes enxertos das outras duas, todos já refletidos na seção 3:

- sessão server-side em cookie HttpOnly (fluxo SSR do Supabase), sem o SDK rodando dentro dos apps (B3);
- regra fail-closed para chave ausente e matriz do gratuito compilada (C3, C4);
- token assinado ES256 buscado por API, não injetado na página; cópia offline só por download explícito com registro (C5);
- captcha no formulário de e-mail e cadastro por convite nos primeiros 60 dias;
- tabelas `configuracoes`, `versoes_app`, `emissoes` e `emails` (B4);
- `NEXUS.chave()` desde a primeira integração (D3);
- gateway nacional na fase 1.5, não Stripe (E7);
- painel administrativo mínimo protegido por papel e por Cloudflare Access, com toda ação registrada em `eventos`.

Por que não o edge puro: exige mover a zona DNS inteira de `pastroeng.com` para a Cloudflare (risco ao e-mail corporativo), o banco D1 não tem região na América do Sul (dados nos EUA), e é mais código próprio para uma pessoa manter.

Por que não o VPS em Python: menor custo mensal e conhecimento de Python do dono pesam a favor, mas coloca em uma pessoa a operação de servidor, TLS, backup, restauração e segurança do sistema operacional, e os dados ficariam na Alemanha (ou custaria mais em São Paulo). É a alternativa se o Supabase decepcionar na entrega do código por e-mail.

Ordens de grandeza (estimativas dos proponentes, sem impostos):

| Item | Faixa |
|---|---|
| Custo fixo mensal, 0 a 100 usuários | R$ 0 a 150 (Supabase Pro entra no primeiro pagante) |
| Custo fixo mensal, 100 a 1.000 usuários | R$ 300 a 600 |
| Esforço da fase 1 (sem cobrança automática) | 13 a 20 dias úteis |
| Operação depois do lançamento | 2 a 4 horas por semana |

Riscos próprios desta escolha: cobrança em dólar com IOF; o plano gratuito do Supabase pausa o projeto após 7 dias sem uso e não tem backup (migrar para o Pro antes do primeiro cliente); o Supabase muda o comportamento da autenticação com frequência (manter a configuração no repositório, verificar tokens por JWKS); entregabilidade do código em Outlook corporativo exige um dia de testes com caixas reais.

---

## 5. Decisões adiáveis e o que deixar preparado

| Decisão | Quando | O que fica preparado agora |
|---|---|---|
| Valores em reais dos planos e desconto de fundador | Antes de abrir cadastro público ou 30 dias antes do fim do fundador, após conversar com 5 a 10 usuários atuais | Colunas de preço em centavos; página de planos lendo do banco; fundador com `fim_em` |
| Gateway concreto, webhook, NFS-e automática | Ao chegar a 10 pagantes, obrigatório antes de 30 | `origem`, `referencia_externa`, `status` completo, CPF/CNPJ e endereço no perfil e na organização; rotina diária de expiração e aviso 7 dias antes |
| Interface de organizações (convite, assentos, painel do dono) | No primeiro pedido de 3 ou mais assentos com nota única | Tabelas e CHECK já criados; regra de capacidade efetiva implementada |
| Nuvem de projetos e de ativos (logo, timbrado) | Após cobrança rodando, ou no primeiro relato de TI que apaga o navegador ao fechar | Envelope com `app`, `esquema`, `appVersao`; `usuario.id` no token; `NEXUS.chave()`; DDL escrita e não aplicada; limite de 1 MB por projeto; nuvem opt-in por projeto, conteúdo opaco |
| Namespacing de localStorage por usuário | Junto com a nuvem | `NEXUS.chave()`; aviso de troca de conta; regra de nunca apagar |
| Licença interna e empacotamento do SaneSim (PyInstaller) | Antes de cobrar por OSE ou DXF, ou quando chamados do `.bat` passarem de 2 por semana | Versão visível; `licenca.json` no zip; pontos de gate previstos no core (`simulate`, `export_memorial`, `export_oses`, `dxf_export`), não na GUI, porque a CLI contorna a GUI |
| Catálogos servidos pelo servidor | Só se cópias full circulando virarem problema medido | `E.carregarCatalogos` e `CAT.paraUso` como ponto único; ids referenciados e fallbacks sempre resolvem |
| Venda a órgão público (empenho, contrato, ISS retido) | No primeiro pedido formal | Campos de contrato e empenho na assinatura; minuta de contrato institucional |
| Login social ou SSO Microsoft | Quando um cliente corporativo exigir | Identidade = e-mail normalizado; sessão opaca independente do provedor |
| Trial automático de pro | Se a conversão gratuito para pro ficar baixa após 90 dias de cobrança | Status `trial` no enum; texto de termos prevendo período de teste |
| Suporte a celular e tablet | Após 90 dias de user agents nos eventos | Não prometer; painel e login responsivos; apps desktop-first |
| Service worker para abrir a URL sem rede | Se a cópia offline explícita não bastar | HTML servido com `no-store`; versão do build como chave de cache |
| CSP nos apps | Depois de refatorar os handlers inline do esvaziamento | Proibição de novos handlers inline; lista de pontos de `innerHTML` em `docs/seguranca.md` |
| Paleta unificada (esvaziamento e SaneSim divergem) | Qualquer sprint de acabamento | `runtime/tema.css` com as variáveis canônicas |
| Encarregado formal, relatório de impacto | Quando deixar de ser agente de pequeno porte | Canal `privacidade@pastroeng.com` na Política; inventário de dados em planilha |
| Plano de resposta a incidente | Antes do primeiro pagante | Eventos com IP e user agent; consulta que lista e-mails afetados; roteiro de uma página |
| Seguro de responsabilidade civil com cobertura de software | Quando houver receita que pague a apólice | Cláusula de limitação redigida; registro de versões e correções |

---

## 6. Vocabulário de capacidades v1 (proposta para validação)

Chaves em minúsculas, separadas por ponto. Sem prefixo de app: vale para todos os apps HTML que tenham o recurso. Com prefixo: vale só para aquele app. Tipos: B (booleano), N (inteiro; -1 ilimitado, 0 indisponível), E (enumeração fechada). A coluna "gratuito" é a matriz compilada em cada app; os demais planos vivem no banco e mudam sem rebuild.

| Chave | Tipo | Gratuito (proposta) | Onde entra no código |
|---|---|---|---|
| `memorial.pdf` | B | true (com marca d'água) | `X.pdf` / `App.aoClicar` |
| `memorial.word` | B | false | `X.word` |
| `memorial.editarIntroducao` | B | false | `X.modalIntroducao` |
| `marca.dagua` | B | true | `X.render` (gancho do timbrado) |
| `marca.logo` | B | false | `M.gravarLogo` |
| `marca.timbrado` | B | false | `M.gravarTimbrado` |
| `marca.rodapeLicenciado` | B | true | rodapé do memorial |
| `biblioteca.max` | N | 3 | `E.guardar` |
| `projeto.exportar` | B | false | `App.baixarProjeto` |
| `projeto.importar` | B | true | `App.carregarProjeto` |
| `catalogos.usuario` | B | false | `E.salvarCatalogos` |
| `catalogos.base` | E | `basica` | `E.carregarCatalogos`, `CAT.paraUso` |
| `calculo.parametros` | B | false | aba Parâmetros |
| `calculo.comparar` | B | true | `calculo.comparar` |
| `copiaOffline` | B | false | botão no painel |
| `adutora.trechos.max` | N | 1 | `addAdutora` |
| `adutora.bombas.max` | N | 2 | clamp em `App.aoDigitar` |
| `adutora.perfil` | B | false | `PDA.Pf` |
| `adutora.curvaBomba` | B | false | aba Bombas |
| `adutora.economia` | B | false | aba Economia |
| `adutora.protecao` | B | false | `PDA.PR` |
| `adutora.blocos` | B | false | `PDA.BA` |
| `bloco.memoria` | B | false | capítulo de blocos no memorial |
| `eee.bombas.max` | N | 2 | clamp |
| `eee.concessionaria` | B | false | seletor de padrão |
| `eee.preliminarAvancado` | B | false | aba Preliminar |
| `eee.perfilSeries` | B | false | aba Perfil |
| `travessia.ferrovia` | B | false | modo ferrovia |
| `travessia.galeriaHdd` | B | false | métodos galeria e HDD |
| `conduto.cenarios` | B | false | cenários |
| `conduto.perfil` | B | false | perfil por trecho |
| `conduto.paralelo` | B | false | tubos em paralelo |
| `conduto.compararDiametros` | B | true | comparação |
| `esvaziamento.dimensionar` | B | true | modo 2 |
| `esvaziamento.doisLados` | B | true | ponto baixo |
| `esvaziamento.memoria` | B | true | memória de cálculo |
| `sanesim.download` | B | false | Pages Function |
| `nuvem.projetos.max` | N | 0 | fase 2 |
| `storage.porUsuario` | B | false | `NEXUS.chave()` |

Regras que acompanham a matriz: o gate nunca altera, apaga ou trunca estado; biblioteca acima do teto continua legível, só não aceita novo; catálogo já referenciado por um projeto aberto sempre resolve (o gate atua na escolha de catálogo novo); os ids de fallback da travessia (`aco_camisa_arema`, `concreto_nbr8890`, `fd_k7`, `pead_pe100_sdr17`) e dos exemplos ficam sempre no subconjunto básico. Sem isso, downgrade produz "sem diâmetro" na adutora, "Tubo do catálogo não escolhido" no conduto e memorial bloqueado na travessia.

O esvaziamento é pequeno e sem exportação; a proposta é deixá-lo inteiro no gratuito como porta de entrada.

---

## 7. Armadilhas onde você será contestado

Consolidação do que os quatro críticos apontaram e que não está coberto acima de forma explícita.

- **Compartilhamento de conta por caixa genérica** (`projetos@empresa`): um pagamento para uma equipe. Termos proibindo, limite de 5 sessões com lista em /conta, e o plano Empresa como saída legítima mais barata que a briga. Consulta pronta desde o dia 1: contas com sessões em mais de 3 cidades em 7 dias.
- **Ambientes corporativos que apagam o navegador ao fechar** (VDI, Citrix, Edge gerenciado, GPO): localStorage, sessão e token somem todo dia; a plataforma será acusada de perder projeto. Detectar persistência (gravar marcador e conferir no próximo carregamento) e avisar "este ambiente apaga seus projetos ao fechar; exporte". Se esse perfil de cliente aparecer, a nuvem deixa de ser fase 2.
- **Migração da biblioteca de `file://` para a URL**: do ponto de vista do usuário, biblioteca, catálogos, logo e timbrado somem. Um último release do arquivo avulso com "Exportar biblioteca inteira" e um importador em lote na plataforma; sem isso, com 20 projetos guardados, o roteiro manual é abandono garantido.
- **Recurso anunciado diferente do entregue**: "Word" é HTML com namespaces do Office (.doc), não DOCX; "PDF" depende do diálogo de impressão do navegador; a EEE ainda carrega no CSS o título "Pré-dimensionamento de Adutora". Redação exata na página de planos e correção do título residual.
- **Documentação com números divergentes do código**: README da adutora fala em 35 catálogos e 331 testes (código tem 46 e 366); `SANESIM.md` fala em 19 testes (há 112). Copiado para o site vira propaganda enganosa. Números gerados no CI, nunca digitados.
- **Nomes de concessionárias como chancela** ("padrão SANEPAR", "SABESP NTS", formato SANEPAR das OSE): frase fixa "conforme documento público X, sem vínculo ou homologação da concessionária"; nunca usar logotipo delas.
- **Proibir "Salvar como" nos Termos**: a Lei 9.609 (art. 6, I) garante cópia de salvaguarda. Os Termos proíbem redistribuição e uso fora da licença, não a cópia de segurança.
- **Descontinuação sem cláusula**: se você parar, os tokens vencem em 37 dias e quem pagou anual perde o que pagou. Cláusula com aviso de 90 dias, exportação em lote e licença de longa duração da última versão para assinantes ativos (tecnicamente, uma alteração de `gracaAte`).
- **"Aceito os Termos" tratado como consentimento LGPD**: aceite de contrato é adesão (base legal: execução de contrato). Consentimento só para e-mail de novidades, em caixa separada e desmarcada. Consentimento como base do essencial obrigaria a apagar dados de cobrança que a lei manda guardar.
- **Acesso do administrador sem trilha**: toda alteração administrativa registrada em `eventos` com ator admin; personificação de usuário só com autorização registrada; o administrador acessa dados cadastrais, nunca conteúdo de projeto (princípio da necessidade).
- **Pipeline de entrega**: um único token de deploy publica HTML para todos os usuários em minutos. Branch protegido, produção só por tag com aprovação manual, escopo mínimo, verificação do hash do HTML publicado contra o build do CI.

---

## 8. Insumos que preciso de você

Agrupados por tipo. Sem os do grupo 1 não fecho as definições; sem os do grupo 2 não começo a construir.

### Grupo 1. Decisões (só você responde)

1. Quem vende: Pastro Engenharia (razão social, CNPJ, cidade da comarca, regime tributário, CNAEs atuais) ou pessoa física? Existe outro sócio com direito sobre o código?
2. O repositório público: aceita migrar para privado e apagar os seis branches do repositório de perfil após a importação? Qual texto de licença proprietária?
3. Os exemplos embutidos e o `RevisaoPlanilha_MC_EEE03_e_LR03.md` contêm dados de projetos reais de clientes? Quais? Os contratos de origem têm cláusula de confidencialidade ou de propriedade intelectual sobre metodologia e planilhas?
4. Quem tem cópias hoje (pessoas, empresas, quais arquivos, desde quando, em que condição)? Existe lista de e-mails para comunicar a migração e dar cortesia?
5. Qual público paga primeiro: engenheiro autônomo, escritório de 2 a 10 pessoas, ou concessionária e prefeitura por empenho? Alguém já pediu para pagar? Que valor mensal por pessoa você acha defensável?
6. Quatro planos ou dois (gratuito e pago) no lançamento? Aceita renomear "ilimitado" para "Empresa" antes de virar chave primária?
7. Matriz do gratuito: valide ou altere a coluna "gratuito" da seção 6, item a item, incluindo a lista de ids de catálogo do subconjunto básico por app. Ela é compilada em cada arquivo e não muda depois.
8. Memorial no gratuito com marca d'água (recomendado) ou bloqueado?
9. Telemetria de dentro dos apps: nenhuma na fase 1 (recomendado) ou eventos mínimos desde o início?
10. Versão avulsa gratuita para pen drive: sim (recomendado) ou o arquivo deixa de ser canal?
11. Bloco de Ancoragem: cartão próprio no painel como porta de entrada gratuita (sem memória de cálculo) ou só a aba da adutora no premium?
12. SaneSim na mesma assinatura (recomendado, a partir do pro) ou produto separado?
13. Aceita retirar a marca Pastro da posição de autora nos memoriais de terceiros e bloquear a geração enquanto o responsável técnico estiver vazio?
14. Cadastro aberto desde o dia 1 ou por convite nos primeiros 60 dias (recomendado)? Data prevista para começar a cobrar (define o fim do plano fundador)?
15. Aceita 37 dias de latência máxima para uma revogação chegar a uma cópia offline, escrita nos Termos?
16. Caixas de e-mail compartilhadas: aceitas ou proibidas? Regra quando o engenheiro sai da empresa?
17. Mensal e anual, ou só mensal? Anual igual a 10 mensalidades?
18. Dados pessoais podem ficar fora do Brasil com aviso, ou é requisito hospedar em São Paulo (recomendado)?
19. Quantas horas por semana você reserva para operação e suporte depois do lançamento? Abaixo de 2 horas o desenho precisa ser ainda mais simples.
20. O nome "Pastro Nexus" é definitivo? Autoriza busca no INPI? Tem alternativa?

### Grupo 2. Acessos, contas e infraestrutura

- Acesso ao DNS de `pastroeng.com` e exportação completa da zona atual (MX, SPF, DKIM, `_dmarc`). Onde está hospedado o DNS e qual é o provedor do e-mail corporativo (Microsoft 365, Google Workspace, outro)?
- Conta GitHub com 2FA e permissão para criar o repositório privado `pastro-nexus`, proteção de branch, Actions e Secrets.
- Contas novas, todas com 2FA e e-mail de recuperação separado: Supabase, Cloudflare, Resend. Cartão de crédito internacional (cobrança em dólar com IOF).
- Gerenciador de senhas (Bitwarden ou equivalente) com códigos de recuperação guardados fora do computador.
- Três a cinco caixas de e-mail reais em domínios do público alvo (Microsoft 365 com Safe Links, concessionária, prefeitura, Gmail) para testar a entrega do código antes do primeiro usuário externo.
- Uma máquina Windows limpa (sem Python, com antivírus e, se possível, proxy corporativo) para testar o SaneSim, a cópia offline por `file://` e a expiração com relógio alterado.
- Nome da segunda pessoa de confiança com acesso de emergência às contas.

### Grupo 3. Documentos e textos

- Parecer do contador: CNAE de licenciamento de software (62.02-3 ou 62.03-1), item da LC 116, anexo do Simples, alíquota efetiva, retenção de ISS por órgão público, emissão de NFS-e para assinatura recorrente. Sem isso, nenhuma cobrança, nem Pix manual.
- Termo de cessão de direitos autorais de Jardel para a PJ, com anexo do histórico de especificação e revisão.
- Termos de Uso e Política de Privacidade em português (posso redigir a primeira versão a partir das definições deste documento; revisão de 2 a 4 horas de advogado, ou decisão expressa de assumir o risco).
- Texto do e-mail de código, nome do remetente, texto do aceite no primeiro login, texto da faixa de graça e do modal de bloqueio.
- Nome comercial e descrição de uma linha para cada um dos sete cartões do painel.
- Logo da Pastro Engenharia em SVG e PNG, favicon 32 e 180 px, confirmação da paleta canônica (`#0E2148`, `#0E6F66`, `#14A5A0`).
- Caixas `suporte@pastroeng.com` e `privacidade@pastroeng.com` funcionais, com prazo de resposta que você consegue cumprir (proposta: 2 dias úteis para suporte, 15 dias para pedidos LGPD).

### Grupo 4. Dados técnicos

- Gabaritos numéricos por app: para cada exemplo embutido, 3 a 5 valores esperados validados por você ou extraídos das planilhas de origem (`AUDITORIA-PLANILHAS.md`, `RevisaoPlanilha_MC_EEE03_e_LR03.md`, planilha do conduto, casos do README do esvaziamento, `exemplo_rede.json`). São a linha de base dos testes de fumaça.
- Versões anonimizadas dos exemplos, se a resposta ao item 3 do grupo 1 for "sim, são reais".
- Navegadores e sistemas que os clientes usam de fato (Chrome ou Edge gerenciado, versões, Windows 10, macOS). Mantém ou libera a restrição de ES5.
- Se você tem projetos, catálogos próprios, logo e timbrado no localStorage dos arquivos abertos por `file://` que quer migrar, e quantos por app.

---

## 9. Fases

**Fase 0. Definições e saneamento (antes de qualquer código da plataforma).**
Respostas do grupo 1; repositório privado com os seis apps importados e branches do perfil apagados; LICENSE e copyright; exemplos anonimizados; `docs/capacidades.md`, `docs/seguranca.md`, `docs/textos.json` e uma nota por decisão em `docs/decisoes/`; testes de fumaça por app com gabaritos; build unificado gerando `dist/<slug>.html` com versão; textos de promessa reescritos; DNS do subdomínio de envio configurado e testado.

**Fase 1. Plataforma mínima, sem cobrança automática.**
Login por código, painel com os sete cartões, entrega dos apps só a sessão válida, runtime de capacidades integrado nos cinco HTML com a matriz do gratuito compilada, plano fundador com data de fim, /conta com sessões e uso de armazenamento, download autenticado do SaneSim com `licenca.json`, painel administrativo mínimo, homologação e produção, backup com restauração ensaiada. Cobrança manual por Pix com nota a cada recebimento.

**Fase 1.5. Cobrança.**
Gateway nacional com Pix, boleto, cartão recorrente e NFS-e; webhook alimentando `assinaturas`; régua de aviso e inadimplência; cópia offline por download explícito.

**Fase 2. Dados que seguem o usuário e SaneSim empacotado.**
Nuvem de projetos e ativos (opt-in por projeto, conteúdo opaco); namespacing por usuário; organizações com interface; SaneSim em PyInstaller com licença verificada no core; telemetria mínima, se decidida, com reaceite.
