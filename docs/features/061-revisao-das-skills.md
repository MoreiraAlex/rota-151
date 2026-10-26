# 🚀 Versão 0.0.61 — Revisão das skills

## Resumo

Ajuste final de todos os golpes antes do spawn (062): tempo das animações,
forma, VFX, som e gameplay (poder, precisão, efeitos). Um Pokémon por vez,
na ordem da Pokédex, golpe por golpe.

No jogo a câmera fica atrás da criatura e o golpe sai de costas pra ela —
não dá pra analisar direito. Por isso a feature começa por um **laboratório
de golpes**: escolhe o Pokémon, o golpe e o alvo, e o golpe fica rodando em
loop, com todos os parâmetros ajustáveis ao vivo.

Versão: `0.0.61` (`package.json`). Branch: `feature/061-revisao-das-skills`.

---

## Como está hoje

- Um golpe é um recurso em `core/data/skills/<id>/index.js` (molde em
  `_template/`); a espécie referencia o id nos slots (`skills`, o kit
  inicial) e no learnset (`moves`), com `overrides` só no que muda pra ela
  (`resolveSkill` mescla por seção).
- `duration` e `effectAt` escalam pelo `speed` da criatura; custo, recarga e
  horas de treino saem da fórmula pelo peso do golpe (`actionCost.js`) e o
  domínio mexe no custo e na recarga. O tempo que se vê no jogo não é o
  escrito no arquivo.
- Laboratórios que já existem (fora do jogo, raiz R3F própria): animação e
  grito (`/tools/lab-animacao`), corpo (`/tools/lab-corpo`) e luz
  (`/tools/lab-luz`). Nenhum roda o combate.

Golpes por espécie (kit + learnset):

| Pokémon | Golpes |
|---|---|
| 001 Bulbasaur | Growl, Tackle, Vine Whip, Growth, Leech Seed, Razor Leaf |
| 004 Charmander | Growl, Scratch, Ember, Smokescreen, Dragon Breath, Flamethrower |
| 007 Squirtle | Tackle, Water Gun, Tail Whip, Withdraw, Rapid Spin, Bite |
| 010 Caterpie | Tackle, String Shot, Bug Bite |
| 013 Weedle | Poison Sting, String Shot, Bug Bite |
| 016 Pidgey | Tackle, Sand Attack, Gust |
| 019 Rattata | Tackle, Tail Whip, Quick Attack, Focus Energy, Bite |
| 021 Spearow | Peck, Growl, Leer, Assurance, Fury Attack |
| 023 Ekans | Wrap, Leer, Poison Sting, Bite, Glare |
| 025 Pikachu | Thunder Shock, Quick Attack, Tail Whip, Thunder Wave, Double Team, Electro Ball |

Golpe que aparece em mais de uma espécie é revisado na primeira delas; nas
seguintes, só o que for dela (override).

---

## Parte 1 — Laboratório de golpes

Página `/tools/lab-golpes` (`tools/skillLab/`), fora do jogo, no molde dos
outros laboratórios.

Decisões do usuário:

- **Pipeline real do jogo**: o golpe roda pelos mesmos systems (ataque,
  animação, física, efeitos, dano, status) e pelas mesmas views (VFX, aviso
  no chão, carga/canal/ação, números de dano, som). O que se vê no lab é o
  que acontece no jogo.
- **Todos os parâmetros**, inclusive os de gameplay (poder, categoria,
  precisão, efeitos de status, área, IA).
- **Alvo de espécie escolhível**, que reage como no jogo.
- **Botão Copiar**: o lab não grava nada; gera o trecho pra colar.

### Cena

- Chão plano e iluminado, sem chunks, vegetação, clima nem treinador. Só os
  systems que o golpe precisa, registrados pelo lab (não o
  `registerSystems.js` do jogo).
- **Atacante**: criatura do time, sem controle do jogador. O lab dispara o
  golpe escolhido pelo mesmo caminho da IA (`WantsToAttack` →
  `tryStartAttack`), mirando no alvo. Repete com um intervalo ajustável
  entre um lançamento e outro, sem esperar recarga nem gastar energia.
  Golpe canalizado segura o botão até o fim. Nível e domínio escolhíveis
  (mudam tempo, custo e recarga).
- **Alvo**: selvagem da espécie escolhida, a uma distância ajustável. Não
  anda, não foge e não revida, mas leva o golpe de verdade: animação de
  dano, número de dano, efeitos de status. Opção de zerar entre golpes (HP
  cheio, sem estágios nem status) ou deixar acumular (pra ver estágio e
  efeito somando). Opção sem alvo (golpe no vazio, até o fim do alcance).

### Ver o golpe

- Câmera orbital livre, com atalhos: lado, frente do atacante, de cima e
  atrás (como no jogo).
- Velocidade do tempo (normal, metade, um quarto), pausar e avançar um
  quadro — o delta do loop do lab, então animação, VFX e dano andam juntos.
- **Linha do tempo** do golpe: disparo, `effectAt`, fim da `duration` e fim
  do VFX, com os valores efetivos (já escalados pelo `speed`) ao lado dos
  escritos.
- Som ligado/desligado.

### Parâmetros

- Todos os campos do golpe, por seção, como no molde: mecanismo (tempo,
  alcance, raio, mira, modo de lançar, área, canal), animação (clipe —
  lista das chaves de `nativeAnimations` da espécie — e frames), visual
  (grupos de efeito, escala, durações, revelação, offsets de rotação e de
  posição, tipo do impacto), áudio (grupos, grito), dano, precisão, efeitos
  e IA.
- Cada campo mostra **de onde vem** o valor: base do golpe, override da
  espécie ou padrão. Ao editar, escolhe-se a camada: **base do golpe** (vale
  pra toda espécie) ou **só nesta espécie** (override).
- Derivados só de leitura: duração e `effectAt` efetivos, custo, recarga,
  horas de treino e dano no alvo atual.
- Ao vivo: o lab mexe na cópia em memória dos dados que o jogo lê (registro
  de golpes e referência da espécie); recarregar a página volta aos
  arquivos.
- **Copiar**: o bloco do golpe base (`<id>/index.js`) e/ou a entrada da
  espécie (`skills[N]` ou `moves`, só com os `overrides` que diferem da
  base). Formatação em função pura, com teste de ida e volta.

O lab edita os campos e grupos que já existem. VFX, som ou tipo de efeito
novo que um Pokémon precisar entra no código, na parte dele.

### Como ficou

- **Mundo** (`tools/skillLab/skillLabWorld.js`): o `world` do jogo, com um
  chão de malha de triângulos (não heightfield, pela 083) criado pelo `labPhysicsSystem`
  no lugar do `physicsBootstrapSystem`, e os systems do golpe na ordem do
  `registerSystems.js` (ataque, atordoamento, condições, modo
  combate, efeitos, estágios, física e estado de animação). Sem IA, chunks,
  input, desmaio nem save. O `skillLabSystem` espera o atacante ficar livre,
  conta a pausa, põe os dois nos lugares de partida e lança por
  `tryStartAttack` (o mesmo caminho da IA) com energia e recarga liberadas.
  O alvo não desmaia: a vida que zera volta cheia. Atacante e alvo com IV no
  meio da faixa.
- **Loop** (`SkillLabScene.jsx`): o mesmo passo fixo + apresentação do
  `GameLoop`, com os systems de apresentação do golpe (transform, hit stop,
  animação, luz de fogo, som, brilho, números de dano, piscar, boca) e as
  views do jogo. O Canvas roda com `frameloop="never"` e um relógio próprio:
  câmera lenta, pausa e quadro a quadro valem também para os VFX, que andam
  pelo `delta` do R3F. O som continua na velocidade normal. O loop é o dono
  da cena (monta e desmonta), então uma recarga a quente refaz tudo.
- **Ao vivo** (`skillLabLive.js`): a página mexe no `SKILL_REGISTRY` e na
  entrada da espécie (`skills`/`moves`) no lugar; ao sair, tudo volta ao que
  veio dos arquivos. "Restaurar do arquivo" volta só o golpe aberto. Mexer
  no som refaz a cena (o som é carregado quando o modelo monta).
- **Camadas** (`skillLabData.js`): base e override da espécie mesclados como
  o `resolveSkill` (campo a campo em `visual`/`audio`/`animation`, agora
  exportadas como `OVERRIDABLE_SECTIONS`; inteiro no resto). Na espécie, um
  campo de `damage`/`ai` leva a seção inteira. Cada campo mostra a origem
  (E, B ou ausente).
- **Copiar**: na base, só o que mudou (campo a campo nas seções mescladas,
  inteiro no resto, e o que saiu); na espécie, a entrada inteira (`skills[N]`
  ou `moves`, com o `requires`), só com os overrides que diferem da base.
  Testes de ida e volta com todos os golpes do registro e todas as entradas
  das espécies.
- **Painel**: a linha do tempo usa `resolveAttackForEntity` (o tempo, o custo
  e a recarga que o atacante lança, com teste); "Últimos golpes" mostra
  dano, tick, crítico, efetividade, mudança de estágio e lançamento sem
  acerto.
- Para as listas do painel, o registro de VFX ganhou
  `listAttackEffectGroups()` e o `ContinuousAttackEffectsView`,
  `CONTINUOUS_EFFECT_GROUPS`.
- Conferido no navegador (Chromium na GPU): os golpes das 10 espécies rodam
  em loop sem erro.

### Ajustes pedidos pelo usuário

- **Anel do tempo da ação**: o anel no chão que esvazia até o fim da
  `duration` (`ActionTimerRingView`) passou a aceitar quem seguir
  (`follow`; no jogo continua sendo a criatura controlada) e aparece no
  atacante do lab.
- **Relevo** (`tools/skillLab/labRelief.js`): morro, degrau ou rampa entre
  o atacante e o alvo, com altura (negativa = mais baixo), posição na linha
  entre os dois e comprimento. O perfil é igual em todo X e a mesma conta
  gera o colisor (malha de triângulos, refeita quando o relevo muda — os
  dois voltam pra casa em pé no chão novo) e o desenho, com a grade
  seguindo o relevo. No degrau e na rampa o alvo fica no alto (ou embaixo).
- **Growl girando com a câmera**: não era config — as ondas usavam
  `facing: 'direction'`, quadro ao longo do movimento que gira em volta dele
  pra encarar a câmera (de quina ficava diagonal). Entrou `facing: 'plane'`
  no emissor de partículas (`particleEmitter.js`): o mesmo quadro, com a face
  pra `spec.normal` (padrão pra cima, no plano do golpe), sem depender da
  câmera. O Growl passou pra ele — vale no jogo também.
- **Aviso no chão sumindo no relevo**: a forma (aviso laranja e indicador
  de mira) era um plano reto, do chão embaixo do atacante inclinado até o fim
  da trajetória, e respeita profundidade — no morro ficava enterrada, no
  degrau e na rampa sumia embaixo da quina. Decisão do usuário: a forma
  passa a acompanhar o terreno (vale no jogo). `view/scene/attackShapeMesh.js`
  monta cone, cápsula e círculo subdivididos (passo `DRAPE_STEP`, com as
  laterais do cone também), e o `AttackShape` desce cada vértice até o chão
  por um raio `groundOnly` (o relevo; árvore, pedra e caixa não contam),
  escrevendo a malha direto no mundo a cada frame. O `groundOnly` passou a
  aceitar também malha de triângulos (o chão do lab; o jogo não tem
  nenhuma). Sem chão achado, a forma fica na altura dos pés, como antes.

- **Alcance exato e trigger de acerto** (pedido do usuário: "range é só a
  distância máxima", sem depender do tamanho do alvo):
  - O `range` é a distância MÁXIMA da área do golpe, contada do centro do
    corpo. A cápsula do golpe normal agora tem a PONTA no fim da trajetória
    (o segmento encurta o `radius`, `resolveCapsuleAreaEnd`); no cone a ponta
    da meia-lua já caía no `range`. A marcação no chão é a mesma área.
  - Cada espécie pode ter um **trigger** (`body.trigger`,
    `core/battle/hitTrigger.js`), separado da cápsula de colisão: uma
    **pílula 2D no chão** (decisão do usuário — o acerto é no plano, onde a
    mira do golpe vai), que gira com o corpo: raio, meio-comprimento (0 =
    círculo), ângulo em relação à frente do corpo e deslocamento X/Z. Uma
    forma só cobre as 10 espécies (círculo/pílula curta nos de corpo
    redondo, pílula comprida no Caterpie, Weedle e Ekans). Sem `trigger`, sai
    da cápsula da física (em pé → círculo; deitada → pílula ao longo do
    eixo). O golpe acerta quando a área TOCA ou atravessa o trigger (cápsula:
    distância entre os segmentos no chão; cone: pontos do eixo do trigger
    contra o leque). A altura é outra regra (plano de combate: pulo, voo).
  - Criatura no caminho não para mais a trajetória do dano nem a marcação
    (só terreno e estrutura) — quem decide é o trigger; o golpe normal
    continua pegando só o primeiro trigger ao longo dela. O visual do feixe
    canalizado (jato do Water Gun, rajada do Razor Leaf) também para no
    trigger (ver Parte 2, "Razor Leaf de distância").
  - A IA usa a mesma regra: alcance = `range` + raio do trigger do alvo
    (`resolveReachFor`, `resolveAttackReach`), cone com o trigger dos outros
    inimigos, e o desvio mede o trigger de quem desvia.
  - Os golpes ficaram mais curtos que antes (sumiu a folga de `radius` + corpo
    do alvo) — os valores se ajustam na revisão de cada Pokémon.
- **Na rampa só acertava mais perto** (relato do usuário: golpe de 1.4 m só
  pegava a 1.3 m): o alcance estava certo; quem saía do lugar era o
  atacante. Com a rampa/morro começando debaixo dele, a cápsula de física
  deitada (não inclina com o chão) bate a ponta na subida e a física empurra
  o corpo pra trás e pra cima — o golpe sai de alguns centímetros atrás. É o
  que acontece no jogo também. No lab entrou a **distância real agora** (do
  centro do atacante até a borda do trigger do alvo, onde estão de fato),
  que avisa quando a física mexeu; o controle de distância passou a ir de
  centímetro em centímetro.
- **Encostar exatamente errava por um fio** (resto numérico): o acerto ganhou
  uma folga de contato mínima (`CONTACT_EPSILON`, `hitTrigger.js`) — com a
  distância igual ao `range`, acerta.
- **Som de ataque com entidade destruída**: trocando o alvo no lab, a
  entidade antiga era destruída e o registro de áudio só saía quando a view
  desmontava (um frame depois) — o `attackAudioSystem` mexia nela e quebrava.
  Agora pula quem não está mais vivo (também protege o jogo: recolher,
  desmaio).
- **No lab**: a distância é do centro do atacante até a BORDA do trigger do
  alvo (com distância = `range`, encosta e acerta). Seções **Atacante** e
  **Alvo**: mostrar a cápsula da física (azul, em arame) e o trigger (rosa,
  pintado no chão seguindo o relevo, `placeGroundPill`) na cena,
  e o trigger da espécie ao vivo, com Copiar e Restaurar (o trigger é da
  espécie — atacante e alvo iguais mexem no mesmo). Grade do chão a cada meio
  metro, mais escura a cada metro.
- **Vários alvos** (pedido do usuário, pra testar os golpes em área): a
  seção **Alvos** tem uma lista (até `LAB_MAX_TARGETS`), cada um com espécie,
  nível e posição em **x, y e z** — `x`/`z` no chão, com o atacante na origem
  olhando +Z, e `y` acima do chão. Todos ficam virados pro atacante. Acima do
  chão o alvo fica no ar com `Flying` (sem gravidade; o golpe mede a altura
  dele como mede a de quem voa). Mexer na posição leva o alvo pro lugar na
  hora, sem esperar o próximo golpe. **Mirar em** escolhe o alvo da mira ou a
  frente (+Z); sem alvo, o golpe sai no vazio. O vão até o atacante aparece
  em cada alvo, e "Últimos golpes" diz quem levou (alvo N). O controle de
  "vão entre os triggers" saiu (o `z` faz o papel; alvo novo nasce no vão de
  partida ou ao lado do último). O relevo se mede até o alvo 1. Cápsula e
  trigger na cena valem pra todos os alvos; a seção do trigger é uma por
  espécie.

- [x] Página e cena com o pipeline real (chão, atacante, alvo)
- [x] Disparo em loop pelo caminho da IA, com intervalo
- [x] Alvo parado que reage; zerar entre golpes ou acumular
- [x] Câmera com atalhos; velocidade, pausa e quadro a quadro
- [x] Linha do tempo com valores escritos e efetivos
- [x] Painel de parâmetros por seção, com origem e camada de edição
- [x] Copiar (base e espécie), com teste
- [x] Anel do tempo da ação no atacante
- [x] Relevo entre atacante e alvo
- [x] Ondas do Growl no plano do cone (`facing: 'plane'`)
- [x] Aviso e indicador acompanhando o relevo
- **Range contado da borda do corpo** (decisão do usuário; substitui a regra
  da 059, "o `range` conta do centro do corpo"): com o `range` contado do
  centro, o mesmo golpe sobrava muito na frente de um corpo pequeno e quase
  nada (ou nada) na de um grande. Agora ele conta da **borda do trigger** de
  quem ataca, na direção do golpe (`resolveTriggerEdge`, `hitTrigger.js`): o
  `range` é o vão na frente do corpo, igual pra toda espécie, e o golpe de
  um corpo grande chega mais longe no mundo. Com isso o `range` sai do tipo
  do golpe (contato, cone, jato, projétil), sem override por espécie.
  - O golpe continua saindo de onde sai (centro + `positionOffset`); só o
    FIM muda: borda + `range`. Mudar o `positionOffset` (de onde o VFX sai)
    não aumenta o alcance (`resolveAttackReach` desconta o `z` dele).
  - Vale pra tudo que mede o golpe: dano, cone, canal, golpe de efeito, aviso
    no chão, indicador de mira e jato contínuo. Na IA, o alcance é a borda da
    frente dela + `range` + raio do trigger do alvo (`resolveReachFor` — ela
    só lança virada pro alvo), e o desvio e o treino contam igual.
  - O custo não muda: o bônus de alcance continua comparando só o `range`,
    então o preço do golpe é o mesmo pra todas as espécies.
  - No lab, a distância virou o **vão entre os triggers** (da borda da
    frente do atacante até a borda do alvo): com o vão igual ao `range`, o
    golpe encosta. A "distância real agora" mede o mesmo vão.
  - Wiki: a página de alcance ainda diz que conta do centro — atualizar no
    fim da feature.
- **Área começando na borda do trigger** (pedido do usuário: o aviso de cada
  golpe começava num lugar — no corpo ou mais à frente, conforme o
  `positionOffset`): a ÁREA do golpe — o acerto e o aviso no chão — começa na
  borda do trigger de quem ataca, a mesma de onde o `range` conta
  (`resolveAttackAreaStart`, `attackGeometry.js`), pra todo golpe igual. A
  cápsula tem a ponta de trás na borda (o eixo começa um `radius` adiante); o
  cone abre da borda, com a abertura do `range` (`resolveAttackCone`). O VFX
  continua saindo do `positionOffset`. Vale pro golpe normal, o de efeito, o
  canalizado (feixe e cone) e pra IA (alvos extras no cone, desvio).
- **Aviso nascendo pela metade** (relato do usuário, depois dos grupos): o
  preenchimento da cápsula crescia só pelo eixo, e as duas tampas redondas já
  apareciam cheias — no corpo a corpo (curto e largo) o aviso nascia quase
  todo cheio. Agora ele enche o comprimento inteiro, da ponta de trás até a
  da frente, começando vazio (`capsuleShape`, `attackShapeMesh.js`).
- **Golpe na diagonal até o alvo mais alto ou mais baixo** (relato do
  usuário: numa rampa alta, ainda dentro do alcance, o golpe acertava mas
  saía reto): a trajetória já subia o terreno, mas o visual não seguia.
  - O contato com um alvo no chão fica na altura que o golpe mantém sobre o
    terreno, em cima do chão DELE (`resolveGroundedContactY`,
    `attackTargets.js`) — antes era a reta entre a origem e o fim da
    trajetória (no cone, a altura da origem). Quem voa continua com a altura
    da trajetória.
  - Todos os efeitos de partículas seguem o terreno (pedido do usuário,
    "para todos os efeitos"): o `AttackEffect` nasce virado na direção do
    golpe NA HORIZONTAL, com `length` medido no chão, e leva o caminho do
    golpe (`AttackPath`, os pontos de `resolveAttackPath`). A view passa o
    perfil dele pro espaço do efeito (`resolveEffectRise`,
    `AttackEffectView.jsx`) e as partículas sobem e descem com ele — a brasa
    do Ember, a semente do Leech Seed e a fumaça do Smokescreen sobem a rampa
    até o alvo em vez de ir reto. Os efeitos de malha (Vine Whip, Punch,
    Whirlpool) são só no ponto de impacto, sem perfil. O visual de cada tick
    do canalizado nasce no ponto (já na altura do terreno), virado na
    direção do golpe.
  - O canal contínuo (a rajada do Razor Leaf, o jato do Water Gun) SEGUE O
    TERRENO (pedido do usuário: inclinado reto da origem ao fim, o começo
    passava por dentro do morro): a trajetória devolve o caminho inteiro,
    amostra a amostra (`resolveAttackPath`, `attackTrajectory.js`), a view
    passa o perfil de altura dele no quadro do emissor (`frame.rise`) e cada
    partícula sobe e desce com ele enquanto anda (`followTerrain`,
    `particleSimulation.js`).
  - O aviso no chão não muda (já acompanha o relevo).

- [x] `range` como distância máxima e trigger de acerto por espécie
- [x] `range` contado da borda do trigger de quem ataca
- [x] Lab: distância até o trigger, cápsulas na cena, trigger ao vivo, grade
      de meio metro
- [x] Lab: vários alvos com posição x/y/z, virados pro atacante, e mira
- [x] Conferido pelo usuário

---

## Parte 2 — Bulbasaur (001)

Growl, Tackle, Vine Whip, Growth, Leech Seed, Razor Leaf.

- **Leech Seed caindo no fim do alcance** (relato do usuário: com o alvo
  perto, o estouro final aparecia no limite do `range`): só o golpe de dano
  trocava o ponto do VFX pelo contato com o alvo; o golpe só de efeito
  nascia sempre no fim da trajetória. Agora o `applyAttackEffects` devolve
  quem acertou e o golpe de efeito de alvo único segue a regra do Ember: VFX
  no contato com o alvo; errou, no fim da trajetória. O cone (Growl) não
  muda.
- **Contato dentro do alvo** (relato do usuário: o efeito nascia dentro do
  corpo, não na frente): quando a trajetória atravessava o trigger, o
  contato era o ponto dela mais perto do eixo — o centro do alvo. Agora é
  onde ela ENTRA no trigger (`resolveTriggerEntry`, `attackGeometry.js`), a
  borda virada pra quem ataca; de raspão (só a área encosta), continua o
  ponto da borda na direção da trajetória. Vale pra todo golpe de alvo único
  (dano e efeito): VFX, número de dano e o `contactPoint` do evento.
- **Razor Leaf com VFX próprio** (pedido do usuário: o `punch` de antes não
  tinha nada a ver com o golpe): tradução do `razorleaf` do Cobblemon
  (`view/vfx/razorLeafVfx.js`, texturas em `assets/effects/leaf/`), em três
  fases do canalizado — na carga (`chargeGroup: 'razor-leaf-charge'`) folhas
  girando sobem e se abrem em volta do corpo; no canal (`channelGroup:
  'razor-leaf'`) a rajada de folhas corta o cone até o fim, abrindo até o
  `radius`; a cada tick (`channelHitGroup: 'razor-leaf-hit'`) cortes e lascas
  de folha na frente de cada alvo. Sem efeito de impacto único
  (`effectGroup: 'none'`).
  - O `channelHitGroup` passou a valer também no cone: um por alvo dentro
    dele, a cada tick (antes, só o feixe).
  - O `contactPoint` do cone deixou de ser o centro do alvo: é a borda do
    trigger virada pra quem ataca (vale pro número de dano do Flamethrower).
  - O canal em cone desenha até o fim do cone, passando pelos corpos (como
    o dano); o feixe continua parando no primeiro.
- **Razor Leaf de distância passando do alvo** (relato do usuário, ao mudar
  o golpe pra `group: 'ranged'` — vira feixe canalizado): o dano do feixe
  para no trigger do primeiro alvo, mas o visual do canal media até onde um
  raio da FÍSICA batia — saindo do `positionOffset` (alto, no Bulbasaur), ele
  passava por cima da cápsula de um alvo baixo e as folhas iam até o fim do
  alcance. Agora o visual do canal usa a mesma conta do tick
  (`resolveChannelGeometry` + `resolveBeamTarget`, `attackChannelTick.js`):
  o feixe para no contato com o primeiro trigger; o cone segue até o fim.
  Vale pro jato do Water Gun também.
  - Som do Cobblemon (`sounds/move/razorleaf/`): os dois de quem usa (a
    subida das folhas e o disparo) e o do alvo, no grupo composto
    `'razor-leaf'` (`attackSound.js`) — subida e acerto juntos no
    `effectAt` (golpe instantâneo), o disparo no meio da rajada.

### Descrição dos golpes

Pedido do usuário: cada golpe com uma descrição pro jogador, no estilo das
habilidades do LoL, pra HUD mostrar depois no slot, no treino e na escolha de
golpe (etapa de melhorar a HUD). Por ora, só no código.

- Campo `description` na skill (documentado no `_template`), com marcadores
  pros números (`{power}`, `{range:m}`, `{effects.0.duration:s}`,
  `{effects.0.tick.fraction:%}`...). `formatSkillDescription`
  (`view/shared/skillDescription.js`) preenche com o golpe RESOLVIDO — grupo
  e override da espécie —, então o texto acompanha o ajuste dos valores. Uma
  espécie troca o texto inteiro pelos `overrides`.
- Feito pros golpes do Bulbasaur (Growl, Tackle, Vine Whip, Growth, Leech
  Seed, Razor Leaf); os outros entram na parte de cada Pokémon. O teste
  confere, por espécie já descrita (`DESCRIBED_SPECIES`), que todo golpe tem
  descrição e nenhum marcador ficou sem valor.

### Condições padronizadas (a rever)

Pedido do usuário, a partir do Leech Seed: padronizar os efeitos que duram
no alvo. Hoje semente e queimadura são peças separadas que repetem o mesmo
esqueleto (ação, trait + relação, system com o mesmo laço de tick, e um caso
cada na IA, no custo, no log, na wiki e na bola). Elas são o mesmo bloco: as
duas tiram uma fração do HP a cada intervalo, só muda pra onde vai o HP.

**Desenho:**

- A condição vira dado, no molde dos golpes (`core/data/conditions/<id>/`),
  montada por **comportamentos**: **tick** (perde HP por intervalo; destino:
  some ou cura quem aplicou), **modificador** (multiplica um atributo
  enquanto dura), **bloqueio** (não age, falha por chance ou não anda) e
  **atordoar** (interrompe na hora, como o `hitStun`).
- No golpe, o efeito só aponta pra condição (`{ type: 'condition',
  condition: 'burn', chance }`), com override opcional de duração e afins.
- Um system só (tempo, tick, remoção) e uma ação só (chance, imunidade,
  renovar), no lugar do `leechSeedSystem`/`burnSystem`. IA, custo, log, wiki
  e bola leem os dados da condição em vez de um caso por tipo.
- Trait genérico `Conditions` (a lista das ativas) + relação com quem
  aplicou (decisão minha, liberada pelo usuário).
- **Tudo soma** (decisão do usuário): sem a regra do Pokémon de uma condição
  principal por vez. A coluna "Tipo" abaixo é só a referência da série.
- Ficam fora (instantâneos, não duram): estágio de atributo, drenar vida
  (Absorb), dano de volta e cura — continuam como `effects` do golpe.

**Tabela** (decisão do usuário: fica assim por ora, revisar depois). `?` =
precisa de regra própria no tempo real (o Pokémon é por turno).

| Condição | Tipo | Tick (destino do HP) | Modificador | Bloqueio | Atordoar | Acaba quando | Fica na bola |
|---|---|---|---|---|---|---|---|
| Queimar | principal | sim (some) | Ataque físico menor | — | — | tempo | sim |
| Envenenar | principal | sim (some) | — | — | — | tempo | sim |
| Envenenar forte (Toxic) | principal | sim, crescente | — | — | — | tempo | sim |
| Paralisar | principal | — | — | — | sim (o tempo todo) | tempo | sim |
| Dormir | principal | — | — | não age nem anda | — | tempo, ou ao levar dano ? | sim |
| Congelar | principal | — | — | não age nem anda | — | tempo, ou levar golpe de Fogo | sim |
| Semente | volátil | sim (cura quem plantou) | — | — | — | tempo | não |
| Prender (Wrap) | volátil | sim (some) | — | não anda, mas pode atacar | — | tempo | não |
| Confundir | volátil | — | — | ? (andar torto, golpe sair pro lado…) | — | tempo | não |
| Recuo (flinch) | volátil | — | — | — | sim (curto) | na hora | não |

**Ordem:** agora, o molde + system genérico + migração da semente e da
queimadura, sem mudar o comportamento. Cada condição nova entra no Pokémon
que a usa, na ordem da revisão: veneno (Weedle/Ekans, Poison Sting), recuo
(Squirtle/Rattata, Bite), prender e paralisar (Ekans: Wrap, Glare),
paralisar (Pikachu, Thunder Wave).

**Como ficou** (molde + migração):

- **Dados**: `core/data/conditions/` (`_template/`, `burn/`, `leech-seed/`,
  registro com `getCondition`/`listConditions`/`resolveConditionEffect`).
  Cada condição tem `label`, `verb` (wiki), `duration`, `tick` (`fraction`,
  `interval`, `to`), `modifiers`, `immuneTypes`, `keepsInBall`,
  `captureBonus`, `ai.value`, `feedback` (cor, selo, linhas do log) e
  `visual.tick`. Saíram do `GAME_CONFIG` o valor da IA de semente e
  queimadura, a duração do visual da drenagem, a cor da queimadura e o bônus
  de captura — agora são da condição.
- **Golpes**: `{ type: 'condition', condition, chance }` (Ember,
  Flamethrower, Leech Seed); o golpe pode trocar `duration`, `tick`,
  `modifiers` e `immuneTypes` só pra ele.
- **ECS**: trait `Conditions` (lista das ativas) + relação de quem aplicou
  por condição (`conditionSource(id)`); ação `aplicarCondicao` e leitores
  (`readCondition`, `readConditionModifier(s)`, `removerCondicoes`) em
  `core/actions/conditions.js`; um `conditionSystem` no lugar do
  `leechSeedSystem` e do `burnSystem`. Eventos `conditionApplied` e
  `conditionTicked` no lugar de `burnApplied`, `burnDamaged` e
  `leechSeedDrained`.
- **Dano**: os `modifiers` entram no atributo do ataque (`attackerModifiers`
  no `computeDamage`) — a queimadura corta `attack`, então só o físico.
- **IA e custo**: um avaliador `condition` (`ai.value` × `chance`).
- **Bola e save**: guarda as condições com `keepsInBall` (hoje só a
  queimadura, como antes). Save na versão 3, com migração da 2 (`{ burn }` →
  lista).
- **View**: log, números, selo da HUD (`feedback.badge`; a semente continua
  sem selo) e o fogo da queimadura leem a condição. Wiki: o texto do efeito
  sai dos comportamentos.
- **Lab**: o efeito `condition` escolhe a condição e mostra os valores dela;
  mexer num campo (chance, duração, tick, corte do Ataque, imunes) vira
  override no golpe.
- **Mudanças pequenas de comportamento**: o tick da queimadura agora também
  tira do treino (antes só a semente); condição aplicada num golpe de treino
  não entra no log.

- [x] Tabela revista pelo usuário
- [x] Molde de condição, system e ação genéricos
- [x] Semente e queimadura migradas
- [x] Conferido no jogo pelo usuário

- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

## Partes seguintes

Uma por Pokémon, na ordem da tabela acima: Charmander, Squirtle, Caterpie,
Weedle, Pidgey, Rattata, Spearow, Ekans, Pikachu.

Antes delas, os **padrões** dos golpes (pedido do usuário): a lista de todos
os golpes que os 151 aprendem por nível, com tipo, poder, alvo, marcas
(contato, som, projétil...) e o grupo de cada um, está em
`docs/reference/golpes-dos-151.md`.

**Grupos de alcance** (decisão do usuário): quatro, valendo pra dano e
status, cada um com um `range` FIXO (sem faixa por golpe; contado da borda do
corpo). Os números abaixo são os escolhidos pelo usuário:

| Grupo | `range` | Forma | Quem entra (alvo do golpe na série) |
|---|---|---|---|
| Corpo a corpo | 1.4 | cápsula | um alvo, com contato |
| Distância | 6 | cápsula | um alvo, sem contato |
| Área | 3 (cone) / 4 (círculo) | cone ou círculo | inimigos em volta, todos em volta, aliados (e armadilha no lado inimigo) |
| Em si mesmo | 0 | círculo | só ele mesmo (e clima/terreno) |

A forma também é do grupo (decisão do usuário). Impacto (golpe único) ou
canalizado (segurar o botão) é escolhido golpe a golpe — ex.: Ember e Water
Gun são de distância, um é tiro único e o outro canalizado.

- **Cone ou círculo** (decisão do usuário), pelo alvo na série: "inimigos em
  volta" (Razor Leaf, Growl, Heat Wave, Rock Slide…) → cone pra frente;
  "todos em volta" (Earthquake, Surf, Explosion…) e os golpes em ALIADOS
  (Reflect, Light Screen, Safeguard, Howl, Helping Hand, Aromatherapy…) →
  círculo em volta de quem usa, com o tamanho dado pelo `range`; armadilha no
  lado inimigo (Spikes…) → círculo, a definir com a mecânica. Acupressure (si
  mesmo ou um aliado) fica em si mesmo.
- **Quem é atingido** (decisão do usuário): a cápsula acerta só o PRIMEIRO
  alvo no caminho; cone e círculo acertam TODOS dentro — no golpe único e no
  canalizado.
- **Largura** (`radius`, fixa por grupo, escolhida pelo usuário): corpo a
  corpo 0.5, distância 0.35, área em cone 3.5 (a meia-largura na ponta). O
  círculo da área não usa `radius`: o tamanho é o `range`. Em si mesmo:
  indiferente — o círculo do tamanho do anel do tempo da ação.
- **Modo de execução** (decisão do usuário): um campo do golpe, alterável
  golpe a golpe — `instant` (aperta e sai, vai até o fim sozinho), `charge`
  (segura até o `effectAt`; soltar antes cancela) ou `channel` (segura o tempo
  todo, dano em ticks; soltar encerra). Padrão: `charge` nos golpes em si
  mesmo e em aliados, `instant` no resto. Substitui as regras implícitas de
  hoje (`area: 'self'` → segura até o efeito; `damageMode: 'channel'` →
  canalizado). O canalizado segue a forma do grupo: na cápsula é feixe
  (primeiro alvo), no cone e no círculo pega todos dentro.
- **Interrupção por dano** (decisão do usuário): só golpe `charge`, levando
  dano antes do `effectAt`. Substitui a regra de hoje (todo golpe de status
  durante a carga — Growl, Leer, Smokescreen deixam de ser interrompidos).
- **`castMode`** (decisão do usuário): vira opção do JOGADOR (mostrar o
  alcance antes de lançar ou não), não campo do golpe.
- **`aim`** da IA: pelo grupo — corpo a corpo `melee`, o resto `ranged`.
- **Tempo** (decisão do usuário): `duration` e `effectAt` são POR ESPÉCIE
  (override na entrada da espécie — cada uma tem a sua animação). Padrão do
  golpe base: `duration` entre 1 e 1.5 s e `effectAt` em 40% da `duration`.

**Aplicado no código:**

- O golpe declara o **`group`** (`'melee'`, `'ranged'`, `'cone'`, `'self'`) e
  o perfil de cada um fica em `GAME_CONFIG.ATTACK_GROUPS` (alcance, largura,
  forma, `aim` e execução padrão). `applySkillGroup` (`core/data/skills/
  index.js`) aplica o perfil no fim do `resolveSkill`: o que o grupo dá ganha
  de qualquer valor escrito no golpe ou na espécie. Os golpes e as espécies
  não escrevem mais `range`, `radius`, `aim` nem `area` (os overrides que
  existiam saíram — inclusive o `area: 'line'` do Razor Leaf do Bulbasaur e o
  alcance/raio do Smokescreen e do Flamethrower do Charmander).
- **`execution`** (`'instant'`, `'charge'`, `'channel'`) no lugar do
  `damageMode` e das regras implícitas: `isChannelAttack`/`isChargeAttack`
  (`channelAttack.js`); o feixe é o canalizado na cápsula (sem
  `area: 'line'`); segurar o botão (`requiresHold`) e a interrupção por dano
  (`isInterruptible`) valem pelo modo.
- **`castMode`** saiu dos golpes: `resolveCastMode` só olha a opção de quem
  joga (hoje só o modo debug liga o `'confirm'`; a opção no menu ainda não
  existe).
- Os 35 golpes ganharam o grupo pela classificação da lista dos 151; os que
  mudam de forma: Thunder Wave, Glare, Sand Attack e Smokescreen saem do cone
  pra cápsula de distância (um alvo); Flamethrower vira feixe (canalizado na
  cápsula); Poison Sting vai pra distância; Vine Whip pra corpo a corpo.
- Tempo: os golpes não canalizados ficaram com o padrão (`duration` e
  `effectAt` em 40% dela) no golpe base; os canalizados mantêm o deles. Os
  overrides de tempo das espécies continuam.
- Lab: o painel edita `group` e `execution` (sem alcance, raio, mira, área,
  modo do dano e lançamento).
- **Grupo `'circle'`** (pedido do usuário, testado no Rapid Spin do
  Squirtle): área em volta de quem usa, `range` 4 (número da tabela acima).
  O centro é o corpo de quem ataca e o raio é a borda do trigger dele + o
  `range` (`resolveCircleRadius`); acerta TODOS os triggers que tocam o
  círculo (`resolveCircleTargets`), sem depender da mira. Vale no golpe
  único, no canalizado e no golpe só de efeito; o aviso no chão é o disco
  do mesmo tamanho; a IA soma cada inimigo dentro e desvia pra fora do
  raio; o preço leva o mesmo bônus do cone.
- **Golpe único de dano em área**: o golpe de dano instantâneo pegava só o
  primeiro alvo mesmo no cone. Agora cone e círculo acertam todos dentro
  também no golpe único (como a decisão acima): cada alvo com o próprio
  sorteio de precisão, o próprio `attackResolved` e um VFX de impacto no
  contato de cada um (`damageTargets`, `attackImpact.js`).
- Ainda não existe: a opção do jogador pro `castMode`.

## String Shot (Caterpie e Weedle)

Decisões do usuário: a Velocidade menor vale pros **golpes e pro passo**
(andar, correr e voar), e a **teia fica visível** no alvo enquanto durar.
Depois, separando os dois (pedido do usuário): o **atributo** Velocidade é um
estágio (efeito, acumula) e mexe só no tempo dos golpes; o que mexe no
**passo** é uma **condição** (não acumula), que também é dona da teia no
corpo. O quanto baixa ficou comigo: o estágio como na série atual (−2), a
condição pela metade do passo, as duas com o tempo dos outros golpes de
estágio — números de partida (fictícios até o ajuste no lab).

- **Estágio de Velocidade** (`speed` em `STAT_STAGE_KEYS`,
  `core/battle/statStages.js`): acumula, renova e expira como os outros. Muda
  o tempo dos golpes: `duration` e `effectAt` × `speedStageTimeFactor` (a
  mesma curva do `speed` no tempo do golpe, raiz inversa do multiplicador do
  estágio), FORA da faixa do fator do `speed` — vale pra qualquer espécie.
  Custo e recarga não mudam. `resolveAttackForEntity` ganhou o `speedStage`
  (`readSpeedStage`), passado por quem lança, a IA, o desvio e a
  interrupção. HUD, número na cabeça e log ganharam o rótulo da Velocidade.
- **Condição Enredado** (`core/data/conditions/tangled/`): sem tick, com o
  modificador novo **`movement`** (o passo), selo na HUD e linha no log. O
  passo de todo mundo que anda/corre (`resolveMoveSpeed`, jogador, time,
  selvagem, IA de luta) e o voo (`flightSystem`) multiplicam por
  `readConditionModifier(entity, 'movement')` — o mesmo caminho que a
  paralisia vai usar. A wiki descreve o modificador de passo.
- **Visual no corpo pela condição**: a condição declara `visual.body` (o
  grupo do efeito no corpo enquanto dura; a queimadura passou a declarar o
  dela) e o `StatusConditionEffectsView` monta o efeito pelo dado, sem caso
  por id. O String Shot aplica os dois: `{ type: 'statStage', stat: 'speed'
  }` e `{ type: 'condition', condition: 'tangled' }`. (Antes da separação a
  teia vinha de um `visual` no estágio — saiu.)
- **VFX** (`view/vfx/stringShotVfx.js`, tradução do Cobblemon, texturas em
  `assets/effects/string-shot/`): no golpe, fios finos esticados que saem da
  boca e abrem no leque do cone, mais o borrifo de seda (`'string-shot'`); em
  cada alvo atingido, depois da pausa da linha do tempo de lá, fios girando
  em volta do corpo e o anel de teia enrolando (`'string-shot-target'`); no
  corpo, enquanto dura, anéis de teia e fiapos (não existe no Cobblemon).
- **Som** (`sounds/move/stringshot/` do Cobblemon): o disparo e a teia
  grudando, no grupo composto `'string-shot'`, o do alvo com o atraso da
  pausa.
- Descrição pro jogador escrita.
- **Ajustes do usuário no lab:**
  - Fios saindo de pontos diferentes (parecia irregular): o quadro do fio
    crescia pros dois lados do centro enquanto andava. Agora ele nasce parado
    na boca e cresce dali (`pivot: 'tail'` no emissor, `particleEmitter.js`):
    todos saem do mesmo ponto e abrem no leque.
  - Teia do mesmo tamanho num Weedle e num Bulbasaur: os efeitos do alvo e a
    teia no corpo passaram a receber o tamanho do corpo (`resolveBodyExtent`,
    `core/physics/capsule.js` — largura, comprimento e altura pela cápsula
    da física, comprida no eixo dela quando deitada). O efeito que nasce no
    alvo (`targetEffectGroup`) leva o corpo no `AttackEffect`
    (`bodyWidth`/`bodyLength`/`bodyHeight`) e o giro do alvo; a teia do corpo
    leva no seguidor da condição. O emissor passa o corpo no `ctx.body` e no
    `size`. Os
    anéis são elipses do tamanho do corpo (comprido no Weedle e no Ekans),
    os fios giram numa elipse em volta dele, na altura dele, e os fiapos
    crescem com a largura.

- [x] Estágio de Velocidade (tempo dos golpes, acumula)
- [x] Condição Enredado (passo, não acumula) com a teia no corpo
- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

## Bug Bite (Caterpie e Weedle)

Decisões do usuário: **só o dano** (comer a fruta do alvo, da série, não
entra — nem como pendência) e o **visual da mordida do Leech Life** do
Cobblemon, que não tem o Bug Bite.

- Gameplay como estava: corpo a corpo, físico, poder da série.
- **VFX** (`view/vfx/bugBiteVfx.js`, grupo `'bug-bite'`): as presas de
  inseto fechando (`leechlife_target`, textura `fang` em
  `assets/effects/bug-bite/`, num laranja quente que aparece e some) e as
  faíscas no meio da mordida (`leechlife_targetspark`, a textura das do
  Bite). A drenagem do Leech Life fica de fora. O `piecewise` do
  `biteVfx.js` passou a ser exportado (o alfa ARGB dos dois).
- **Som**: a mordida do Leech Life (`sounds/move/leechlife/`), grupo
  `'bug-bite-target'`.
- Descrição pro jogador escrita.

- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

## Poison Sting e o veneno (Weedle)

Decisões do usuário: a condição de **veneno** entra aqui, com a chance da
série no Poison Sting; um **ferrão próprio** voando até o alvo (o Cobblemon
não tem o golpe); e **bolhas roxas no corpo** enquanto estiver envenenado.

- **Condição Envenenado** (`core/data/conditions/poison/`): tick que some com
  o HP (a mesma fração e intervalo da queimadura), sem modificador, fica na
  bola e ajuda na captura como a queimadura. Imune: tipo Veneno (a tabela é
  a da Gen 1, sem Aço). Selo, log, IA, custo, wiki e bola leem do dado.
- **Poison Sting**: o efeito `{ type: 'condition', condition: 'poison',
  chance }` — números de partida (fictícios até o ajuste no lab).
- **VFX** (`view/vfx/poisonVfx.js`, grupo `'poison-sting'`): o ferrão é um
  risco roxo esticado que sai da criatura e chega ao alvo, com rastro; quando
  chega (`STING_TRAVEL`, logo depois do `effectAt`), o respingo roxo e as
  bolhas do Poison Fang do Cobblemon (`poisonfang_targetimpact` e
  `_targetbubble`, textura da bolha em `assets/effects/poison/`). Som: o
  impacto do tipo Veneno, que já tocava (o Cobblemon não tem som de ferrão).
- **No corpo** (`visual.body: 'poison'`): bolhas roxas subindo de dentro do
  corpo enquanto dura, no tamanho dele.

- [x] Condição Envenenado e chance no Poison Sting
- [x] VFX do ferrão e bolhas no corpo
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Descrições (Bulbasaur, Charmander, Squirtle, Caterpie e Weedle)

Pedido do usuário: descrição em todos os golpes das cinco espécies. Entraram
as de Scratch, Ember, Smokescreen, Flamethrower, Dragon Breath, Bite, Rapid
Spin, Tail Whip, Water Gun e Withdraw (String Shot, Bug Bite e Poison Sting já
vieram com as delas). O teste das descrições (`DESCRIBED_SPECIES`) passou a
cobrir as cinco espécies.


## Pidgey (016)

### Sand Attack

Decisões do usuário: Precisão −1 como estágio (acumula), com o tempo
baixado pro dos outros golpes de estágio (números de partida, fictícios até
o ajuste no lab); visual e som do Sand Attack do Cobblemon, no lugar dos do
Smokescreen. Depois, no lab, o usuário passou o golpe pra **cone** (todos os
inimigos dentro, cada um com os grãos e a poeira dele); a descrição
acompanhou.

- **VFX** (`view/vfx/sandAttackVfx.js`): no golpe (`'sand-attack'`), a areia
  chutada pra frente em arco, caindo com a gravidade (`sandattack_actor`,
  textura `powder`), e a poeira junto (`sandattack_residual`, `smokeorb`);
  no alvo (`'sand-attack-target'`), quando a areia chega (`SAND_TRAVEL`, a
  pausa da linha do tempo de lá), os grãos estourando (`sandattack_impact`)
  e a nuvem na frente dele (`sandattack_impactresidual`). No original o jato
  tem força fixa; aqui ela acompanha a distância até o alvo, pra areia cair
  nele perto ou longe. Texturas em `assets/effects/sand-attack/`.
- **Som** (`sounds/move/sandattack/`): o chute e o acerto, no grupo composto
  `'sand-attack'`, o do alvo com o atraso da chegada da areia.
- Descrição pro jogador escrita.

- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Gust

Gameplay como na série e como estava (distância, um alvo, especial). Visual e
som do Gust do Cobblemon, no lugar do impacto genérico.

- **VFX** (`view/vfx/gustVfx.js`, grupo `'gust'`): as lufadas azuladas
  correndo da criatura até o alvo (`gust_actor`) — no original o ponto de
  saída anda até a metade do caminho; aqui percorre o caminho inteiro e a
  força acompanha a distância — e, quando o vento chega (`GUST_TRAVEL`, a
  pausa da linha do tempo de lá), o sopro estourando (`gust_target`) e o
  redemoinho (`gust_targethit`, textura `gust` em `assets/effects/gust/`).
- **Som** (`sounds/move/gust/`): o vento saindo (o `gust-actor` que o Rapid
  Spin já usava) e batendo no alvo (`gust-target`), no grupo composto
  `'gust'`, o do alvo com o atraso da chegada.
- Descrição pro jogador escrita.

- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo


## Rattata (019)

### Tail Whip — a cauda abanando por cima do `attackRanged`

Pedido do usuário: o Rattata não tinha animação de abanar (nenhuma nativa
mexe a cauda o bastante). O clipe procedural completo (corpo girando, cauda
no alto) foi recusado; a decisão foi **o `attackRanged` nativo com a cauda
balançando por cima**.

- **Camada por cima da embutida** (motor, vale pra qualquer espécie): um
  clipe procedural pode declarar `base` (uma chave de `nativeAnimations`).
  Pedido esse clipe, o `animationSystem` toca a embutida `base` e, depois do
  mixer, soma as curvas dele só nos ossos do clipe, a partir da pose que o
  mixer escreveu (`applyAdditiveClip`, `core/animation/applyAnimationClip.js`:
  `q = base · Rx · Ry · Rz`). Antes do mixer do quadro seguinte esses ossos
  voltam à pose de base, senão a camada acumularia (o mixer só reescreve osso
  cuja trilha muda — o mesmo cuidado do `mouthSyncSystem`). Relógio próprio,
  esticado na duração da ação como o resto.
- **Clipe** (`species/019-rattata/clips/tail-whip.json`, chave `tailWhip`,
  `base: 'attackRanged'`): os 6 ossos da cauda sobem um pouco (mais na base)
  e abanam de lado com a onda correndo da base à ponta (cada osso atrasado,
  a ponta mais solta), com o quadril rebolando junto; tudo sob um envelope
  que começa e termina em zero (soma de senos — o formato não tem produto).
  Os eixos locais saíram da pose de descanso (girar = z, inclinar = y na
  cauda). Valores de partida, ajustáveis no preview (artifact "Tail Whip do
  Rattata"), que toca a nativa com a camada do mesmo jeito do motor.
- O Tail Whip do Rattata usa a chave pelo override da espécie
  (`animation.clipKey: 'tailWhip'`).

- [x] Camada procedural por cima da embutida (motor)
- [x] Clipe da cauda no Rattata
- [x] Ajustes do usuário no preview, aplicados
- [x] Conferido no jogo


### Quick Attack — rápido e com arrancada

Era cópia do Tackle (mesmo tempo, poder, visual, som e animação). Decisão: a
sugestão minha (A + B), pro usuário avaliar no lab — a prioridade da série
vira um golpe que **sai rápido** e que **corre até o alvo** antes de acertar.

- **Rápido**: `duration` e `effectAt` bem menores que os do Tackle (números de
  partida, fictícios até o ajuste no lab).
- **Arrancada** (`lunge: { distance, duration }` na skill, vale pra
  qualquer golpe): o `attackLungeSystem` planeja quanto andar
  (`planLungeDistance`, `core/battle/attackLunge.js`: a distância toda, ou
  até encostar no primeiro alvo no caminho — a mesma conta do acerto com o
  alcance esticado, parando a `LUNGE_STOP_GAP` da borda dele) e escreve a
  velocidade na direção do golpe (chegando um pouco antes do acerto,
  `LUNGE_WINDOW`); o acerto sai de onde ela chegou. Roda depois de quem para a criatura que
  golpeia e antes da física (não atravessa ninguém). A IA conta a arrancada
  no alcance (`resolveReachFor`). O lab edita a distância (`lunge.distance`)
  e roda o system.
- **VFX**: na arrancada, as linhas de velocidade e a poeira do dash
  (`visual.lungeGroup: 'quick-attack'` — o efeito do dash já era a tradução
  das do Quick Attack do Cobblemon); no acerto, o clarão do Tackle com as
  faíscas próprias do Quick Attack (`quickattack_targetsparks`,
  `QUICK_ATTACK_EMITTERS` em `tackleVfx.js`).
- **Som** (`sounds/move/quickattack/`): o da arrancada (`audio.lungeGroup`)
  e o do acerto.
- Descrição pro jogador escrita. O custo não muda com a arrancada (o bônus de
  alcance só olha o `range`).

- **Arrancada só a partir do `effectAt`** (correção do usuário): até o
  `effectAt` a criatura fica parada (o gesto e a mira); ali a arrancada
  começa e dura `lunge.duration`, e o ACERTO vem quando ela chega —
  `resolveImpactAt` (`attackLunge.js`) = `effectAt` + `lunge.duration`.
  - O "instante do acerto" de todo o motor passou a ser esse: o dano
    (`creatureAttackSystem`), o aviso no chão, a carga, a interrupção e o
    desvio da IA (`resolveAttackHitTime`). Sem arrancada nada muda.
  - `lunge.duration` escala com a velocidade como `duration`/`effectAt`.
  - A arrancada é planejada quando começa, da direção já travada.
  - Visual e som da arrancada ganharam campos próprios, na janela dela
    (`isAttackLunging`): `visual.lungeGroup` (as linhas e a poeira do dash, no
    lugar do `chargeGroup`) e `audio.lungeGroup` (o som da arrancada, uma vez
    e inteiro, sem repetir nem cortar). O lab edita os dois e o
    `lunge.duration`.

- [x] Tempo, arrancada, VFX e som
- [x] Avaliado pelo usuário no lab
- [x] Conferido no jogo


### Focus Energy — a condição Focado

Decisões do usuário: **condição, sem acumular** (pela regra do String Shot:
atributo = estágio que acumula; o resto = condição), multiplicando a chance
de crítico (o +2 estágios das gerações 2 a 5, sobre a mesma base do jogo) por
um tempo; **faíscas no corpo** enquanto dura. Números de partida (fictícios
até o ajuste no lab).

- **Crítico com modificador**: o sorteio (`rollCriticalMultiplier`,
  `calculateDamage.js`) multiplica a chance pelo modificador `critical` das
  condições de quem ataca (golpe único e tick do canal), até sempre. Serve
  pros golpes de crítico alto depois.
- **Condição Focado** (`core/data/conditions/focused/`): sem tick, `critical`
  nos modificadores, selo, linha no log, faíscas no corpo (`visual.body:
  'focus'`). Campo novo nas condições: **`beneficial`** — condição boa pra
  quem tem; a IA dá valor a ela em si mesma/aliado e não no inimigo
  (`evaluateConditionEffect`).
- **Golpe em si mesmo aplica condição**: o `applySelfEffects` passou a usar
  o mesmo caminho do alvo (estágio e condição), com o `conditionApplied`.
- **VFX** (`view/vfx/focusVfx.js`): no uso, o "atributo subiu" do Cobblemon
  avermelhado (`'focus-energy'`); no corpo, faíscas vermelho-alaranjadas
  subindo, no tamanho dele. O Cobblemon não tem o golpe. Som: o do "atributo
  subiu".
- Wiki descreve o modificador de crítico. Descrição pro jogador escrita.

- [x] Condição Focado, crítico com modificador, VFX
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo


## Spearow (021)

### Growl

Base revisada no Bulbasaur; no Spearow, só o override do som (a voz dele no
lugar do grito sincronizado), ajustado pelo usuário no lab.

### Peck

Gameplay como na série e como estava (corpo a corpo, Voador, físico). Visual
e som no lugar dos do Scratch: o Cobblemon não tem o golpe, então é o acerto
do Aerial Ace (também Voador), sem o pulo e o pouso de quem usa.

- **VFX** (`view/vfx/peckVfx.js`, grupo `'peck'`): os dois cortes cruzados
  na frente do alvo (`aerialace_targetcut1` e `_targetcut2`, textura `swipe`)
  e o estouro de faíscas azuladas que cruza o alvo e cai
  (`aerialace_targetburst`, textura `white`), com a linha do tempo do
  original encurtada (a bicada é mais rápida). Menor que o original pelo
  `visual.scale` (que também mexe na força do estouro). Texturas em
  `assets/effects/peck/`.
- **Som** (`sounds/move/aerialace/`): o corte batendo no alvo, grupo
  `'peck-target'`.
- Descrição pro jogador escrita.

- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Leer

Gameplay como estava (cone, Defesa −1 com o tempo do Tail Whip, que tem o
mesmo efeito). Visual e som do Leer do Cobblemon, no lugar das ondas do Growl
e do impacto genérico. Revisado aqui; no Ekans entra só o override.

- **VFX** (`view/vfx/leerVfx.js`, `visual.actionGroup: 'leer'`): o brilho
  amarelo piscando no olho de quem usa (`leer_gleam`, textura
  `mediumsparkle` em `assets/effects/leer/`), preso ao corpo, no `effectAt`.
  Sem efeito de impacto (`effectGroup: 'none'`); o alvo mostra o "Defesa ↓"
  de sempre. O original nasce no localizador do olho; aqui o olho é o
  `visual.positionOffset` — o do golpe base é o do Spearow, e cada espécie
  troca pelo override.
- **Som** (`sounds/move/scaryface/`): o começo do `scaryface_actor` (o
  usuário escolheu só um trecho; cortado com fade no fim), que a linha do
  tempo do Leer de lá toca junto do brilho, grupo `'leer-actor'`.
- Descrição pro jogador escrita.

- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Assurance

Decisões do usuário: o poder maior contra quem **levou dano há pouco**, de
qualquer fonte (no lugar do "já apanhou no mesmo turno" da série), e o visual
e som do **Pursuit** do Cobblemon (Sombrio, como o Assurance na série; o
Cobblemon não tem o golpe). Números de partida (fictícios até o ajuste no
lab).

- **Poder maior** (`core/battle/recentDamageBoost.js`): o golpe declara
  `damage.recentDamageBoost: { window, multiplier }`; contra um alvo que levou
  dano há no máximo `window` s, o poder é multiplicado (`attackImpact.js`,
  lido antes do dano do próprio golpe). Golpe, tick de queimadura, veneno e
  semente contam, e o acerto anterior do próprio Assurance também. Sem estado
  novo: o tempo desde o último dano sai do atraso da regeneração do HP
  (`Vitals.hpRegenDelay`, que todo dano reinicia), então a janela enxerga no
  máximo esse atraso da espécie do alvo. Vale no golpe único (não no
  canalizado: o tick anterior contaria). A IA e o custo olham só o `power`.
- O `attackResolved` ganhou `boosted`; o lab mostra "poder maior" em "Últimos
  golpes", edita a janela e o multiplicador, e "zerar entre golpes" também
  zera o dano recente (pra o golpe seguinte não contar o anterior).
- **VFX** (`view/vfx/assuranceVfx.js`, grupo `'assurance'`): a marca escura
  no alvo (`pursuit_target`, textura `pursuit` em `assets/effects/assurance/`),
  e o golpe azul-escuro com os pontos estourando pra fora (`pursuit_targethit`
  e `_targetdots`), com a linha do tempo do original encurtada. No acerto com
  o poder maior, tudo sai maior (`visual.boostedScale`, campo novo,
  multiplicando o `visual.scale` só nesse acerto).
- **Som** (`sounds/move/pursuit/`): o `pursuit_target`, grupo
  `'assurance-target'`.
- Descrição pro jogador escrita, com a janela e o multiplicador.

- [x] Poder maior contra quem apanhou há pouco
- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Fury Attack

Decisões do usuário: os **vários acertos** como na série (de 2 a 5, com o
peso de cada número da série) dentro do mesmo golpe, só o primeiro sorteando
a precisão; **animação nativa** de ataque, uma vez (a camada procedural de
bicadas fica pra depois, se precisar). Visual e som: a bicada do Peck em cada
acerto (o Cobblemon não tem o golpe).

- **Vários acertos** (`multiHit: { counts, weights, interval }` na skill,
  vale pra qualquer golpe de alvo único; `core/battle/multiHit.js`): o
  primeiro acerto é o golpe normal e, se pegou alguém, sorteia quantos vêm
  (`startMultiHit`, guardado em `ActionState.multiHit`). Os seguintes vão no
  MESMO alvo, um a cada `interval` s depois do primeiro (o `interval` escala
  com a velocidade como o resto do tempo do golpe), cada um com o próprio
  dano, crítico, número, VFX e som, sem sortear precisão
  (`applyExtraHit`, `attackExtraHit.js`). O contato acompanha o alvo se ele
  se mexer; alvo que some, desmaia ou zera a vida encerra os acertos. Sem
  efeito secundário nos seguintes (o golpe vale um, como no canalizado).
- O `attackResolved` ganhou `hitIndex` e `hitCount`; o lab mostra "acerto N
  de M" em "Últimos golpes" e edita o `interval`. A `duration` precisa caber
  o último acerto possível (teste).
- O custo e a IA olham só o `power` de UM acerto (o golpe sai barato pelo
  dano total) — fica pro ajuste no lab/balanceamento.
- `attackImpact.js`: o dano num alvo (`damageTarget`), o VFX de impacto
  (`spawnImpactEffect`) e o pulso do som (`markAttackPulse`) viraram funções
  exportadas, usadas também pelos acertos seguintes.
- Descrição pro jogador escrita. Com ela, o Spearow entrou no teste das
  descrições (`DESCRIBED_SPECIES`).
- **VFX próprio** (relato do usuário: "não vi muita diferença pro Peck"): com
  o efeito inteiro do Peck em cada acerto, no mesmo ponto e um em cima do
  outro, a rajada parecia uma bicada só. Agora cada acerto nasce UMA bicada
  curta (`view/vfx/furyAttackVfx.js`, grupo `'fury-attack'`): um corte só,
  num ângulo e num ponto sorteados em volta do contato, e um punhado de
  faíscas saindo dele — com as texturas do Peck. Pro corte e as faíscas de
  uma bicada caírem no mesmo ponto, o emissor de partículas ganhou o
  **`ctx.seed`** (`particleEmitter.js`): randoms sorteadas uma vez por efeito,
  iguais pra todas as partículas dele.
- **Som** (escolha do usuário, depois de uma rodada de candidatos): o
  impacto genérico do tipo (`audio.group: 'impact'`), recomeçando a cada
  acerto.

- [x] Vários acertos, VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo


## Ekans (023)

Wrap, Leer, Poison Sting, Bite, Glare. Leer, Poison Sting e Bite já foram
revisados (Spearow, Weedle, Squirtle): no Ekans, só o que for dele.

### Wrap — a condição Preso

Decisões do usuário (a linha "Prender" da tabela de condições): o alvo **não
anda, mas pode atacar**; acaba **só pelo tempo** (não solta se quem prendeu
se afastar ou sair); **perde HP** por tempo, que some; visual de **anéis
apertando**. Números de partida (fictícios até o ajuste no lab).

- **Condição Preso** (`core/data/conditions/bound/`): tick que some com o HP
  (como a queimadura), modificador de passo zerado (`movement`, o mesmo do
  Enredado — andar, correr e voar param), selo e linha no log, anéis no
  corpo (`visual.body: 'wrap'`). Não fica na bola. Não acumula: de novo,
  renova o tempo.
- **Sem passo, sem sair do lugar**: o dash não sai (`isDashReady`,
  `actions/dash.js`) e a arrancada de golpe não anda (`attackLungeSystem`)
  enquanto o modificador de passo for zero. Girar e lançar golpes continuam.
  O Enredado (que só freia) não muda.
- **Wrap**: aplica o Preso sempre que acerta (como na série).
- **Efeito no corpo do alvo no golpe de dano**: o `targetEffectGroup` só
  nascia no golpe só de efeito; virou `spawnTargetEffect`
  (`attackStatusEffects.js`) e nasce também em cada alvo que o golpe de dano
  pega (`attackImpact.js`).
- **VFX** (`view/vfx/wrapVfx.js`, o Cobblemon não tem o golpe): no acerto
  (`'wrap-target'`), três anéis lilás do tamanho do corpo chegam largos e
  apertam até encostar, de baixo pra cima; preso, os anéis ficam no corpo,
  com um aperto leve e ritmado. Textura do anel do String Shot. Sem impacto
  no ponto de contato (`effectGroup: 'none'`).
- **Som** (`'wrap-target'`): o Cobblemon não tem som de Wrap, Bind nem
  Constrict; o usuário escolheu, entre candidatos, o acerto do Infestation
  (`sounds/move/infestation/`), que também prende.
- Descrição pro jogador escrita.
- Wiki: o texto do Preso sai dos comportamentos; conferir no fim da feature.

- [x] Condição Preso (passo zerado, dash e arrancada parados, tick)
- [x] VFX
- [x] Som escolhido pelo usuário
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Glare — a paralisia como atordoamento

Decisões do usuário: a paralisia é um **stun** (atordoado enquanto dura, com
a animação de atordoado que várias espécies já têm), **sem imunes** (como na
Gen 1), e o visual e o som do **Scary Face** com as partículas de status da
paralisia do Cobblemon (o Cobblemon não tem o Glare). Números de partida
(fictícios até o ajuste no lab); a duração começa curta, porque o stun é bem
mais forte que a paralisia da série.

- **Comportamento atordoar** (o quarto da tabela, `stun: true` na condição,
  documentado no `_template`): enquanto a condição dura, a criatura entra na
  ação `'stunned'` (`iniciarAtordoamentoPorCondicao`, `actions/hitStun.js`;
  `creatureHitStunSystem`, que já cuidava do atordoamento do acerto) — o que
  estava fazendo é interrompido (o golpe em andamento se perde, sem recarga),
  fica parada (não anda, ataca, pula nem voa: quem age já respeita a ação em
  andamento, e o `isHitStunned` passou a valer pras duas) e sai quando a
  condição acaba. `isConditionStunned` (`actions/conditions.js`) lê das
  condições ativas.
- **Condição Paralisado** (`core/data/conditions/paralysis/`): atordoa, passo
  zerado (o dash e a arrancada também param), fica na bola e ajuda na
  captura como a queimadura, selo e linha no log, faíscas no corpo
  (`visual.body: 'paralysis'`). Vale depois pro Thunder Wave do Pikachu.
- **Animação**: estado `stunned` (`animationStates.js`, cíclico, pelo tempo
  da condição; sem animação, a idle) e a chave `stunned` (`stunStart`,
  `stunLoop`, `stunEnd` do `.glb`) nas sete espécies que têm: Bulbasaur,
  Charmander, Squirtle, Weedle, Pidgey, Ekans e Pikachu. Caterpie, Rattata e
  Spearow ficam na idle.
- **Glare**: aplica a paralisia (sem chance, como na série).
- **VFX** (`view/vfx/glareVfx.js`): o brilho no olho de quem usa
  (`visual.actionGroup: 'glare'`, `scaryface_gleam`; o olho é o
  `positionOffset`, e o Ekans usa o do Leer dele); em cada alvo
  (`targetEffectGroup: 'glare-target'`), depois da pausa (`GLARE_DELAY`), o
  rosto assustador crescendo na frente dele (`scaryface_actor`) e as faíscas
  da paralisia pegando (`paralysis_actor`); paralisado, as faíscas voltando
  de tempos em tempos (`paralysis_passive` e `_actorresidual`). Texturas em
  `assets/effects/glare/` e `assets/effects/paralysis/`.
- **Som** (grupo composto `'glare'`): o Scary Face (o mesmo trecho do Leer)
  e, quando o olhar chega, o som de paralisia do Cobblemon
  (`sounds/status/nonvolatile/`, grupo `'paralysis-target'`).
- Descrição pro jogador escrita.
- Wiki: o texto da condição ainda não descreve o atordoar (sai dos
  comportamentos); atualizar no fim da feature.

- [x] Atordoar como comportamento de condição, condição Paralisado
- [x] Animação de atordoado nas espécies que têm
- [x] VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo


## Pikachu (025)

Thunder Shock, Quick Attack, Tail Whip, Thunder Wave, Double Team, Electro
Ball. Quick Attack e Tail Whip já foram revisados (Rattata, Squirtle): no
Pikachu, só o que for dele.

### Thunder Shock

Gameplay como estava (distância, Elétrico, especial, poder da série), agora
com a **chance de paralisar** da série (a paralisia do Glare, que aqui
atordoa — com um golpe básico, a chance e a duração são as primeiras coisas
a olhar no lab). Visual e som do Thunder Shock do Cobblemon, no lugar do
impacto genérico.

- **VFX** (`view/vfx/thunderShockVfx.js`): carregando
  (`chargeGroup: 'thunder-shock-charge'`), faíscas saltando de uma casca em
  volta do corpo e raios curtos saindo dele em direções que giram
  (`thundershock_actorsparks`, `_actorbolts`); no `effectAt`
  (`'thunder-shock'`), o raio de quem usa até o contato
  (`thundershock_actor`) e, no alvo, as faíscas, o choque amarelo e os
  estilhaços elétricos (`_target`, `_targetbolts`, `_targetimpact`).
  Texturas em `assets/effects/thunder-shock/` (o `critical_hit` do Bite e o
  `impact_electric` do impacto já existiam).
- **Motor de partículas**: o `size` do spec recebe também o comprimento do
  golpe (`particle.length`, o raio esticado até o alvo), e o flipbook ganhou
  `loop` (`frameAt`: recomeça do primeiro quadro em vez de parar no último).
- **Som** (`sounds/move/thundershock/`, grupo composto `'thunder-shock'`): o
  choque saindo e acertando, os dois no acerto (lá o de quem usa toca no
  começo do gesto; o som de carga daqui repete e corta no `effectAt`).
- Descrição pro jogador escrita.

- [x] Chance de paralisar, VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Thunder Wave

Gameplay da série: distância, um alvo, Elétrico, status, a precisão da
série; agora **paralisa sempre que acerta** (a paralisia do Glare, que
atordoa) e **não pega em tipo Terra** (`immuneTypes` do golpe, como o Leech
Seed com Planta — a condição em si não tem imunes). Visual e som do Thunder
Wave do Cobblemon, no lugar das ondas do Growl e do impacto genérico.

- **VFX** (`view/vfx/thunderWaveVfx.js`, grupo `'thunder-wave'`): os anéis
  grandes saindo de quem usa (`thunderwave_launch1`/`2`), os anéis correndo
  até o alvo (`thunderwave_actor`) e, quando a onda chega (`WAVE_TRAVEL`), o
  anel enorme (`_impact1`), os anéis girando em volta do ponto (`_impact2`/
  `_impact3`) e as faíscas (`_sparking`, a textura do status). Linha do
  tempo do original encurtada. Texturas dos anéis em
  `assets/effects/thunder-wave/`.
- **Anéis de pé indo pra frente**: o quadro `plane` do emissor ganhou o
  `axis` (`particleEmitter.js`) — o eixo do quadro fixo em vez da direção do
  movimento, pro anel andar pra onde está virado (o `emitter_transform_xy`
  do Bedrock).
- **Som** (`sounds/move/thunderwave/`, grupo composto `'thunder-wave'`): a
  onda saindo e, quando chega, o do alvo.
- Descrição pro jogador escrita.

- [x] Paralisia, imune Terra, VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Double Team — o estágio de Evasão

Decisões do usuário: **estágio de Evasão +1** (como na série, pela regra do
String Shot: atributo = estágio que acumula) e, de visual, **vultos + as
linhas** do Cobblemon (que só tem as linhas de velocidade e uma animação de
esquiva que o Pikachu não tem). Números de partida (fictícios até o ajuste no
lab).

- **Estágio de Evasão** (`evasion` em `STAT_STAGE_KEYS`, campos
  `evasionStage`/`evasionTime` no `StatStages`): acumula, renova e expira
  como os outros. Entra no sorteio de acerto pela regra da série — a PRECISÃO
  de quem ataca menos a EVASÃO do alvo, no limite dos estágios
  (`resolveAccuracyStage`, `accuracy.js`), no golpe de dano e no de status,
  cada alvo com o seu. A IA, o lab e o system de estágios já liam a lista;
  número na cabeça, log, selo da HUD e wiki ganharam o rótulo. A página de
  estágios da wiki ainda não cita a Evasão (fim da feature).
- **Double Team**: Evasão +1 em quem usa.
- **Vultos** (`visual.afterimages: { count, spread, duration, opacity,
  flicker }`, `view/systems/afterimageSystem.js`, vale pra qualquer golpe):
  no instante do golpe (`attackUsed`), cópias translúcidas do modelo de quem
  usa, na pose daquele instante, deslizam pros dois lados (direita, esquerda,
  e cada par mais longe), piscam e apagam. Só visual. Cada vulto é um clone
  do modelo (`SkeletonUtils.clone`) com materiais próprios transparentes,
  descartados quando ele some; o contorno do toon fica de fora. O lab edita
  os cinco campos.
- **VFX** (`view/vfx/doubleTeamVfx.js`, grupo `'double-team'`): as linhas de
  velocidade correndo pros lados (`doubleteam_dashlines`, a textura das
  linhas do Quick Attack), nos pés de quem usa.
- **Som** (`sounds/move/doubleteam/`): `'double-team-actor'`.
- Descrição pro jogador escrita.

- [x] Estágio de Evasão no sorteio de acerto
- [x] Vultos, VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo

### Electro Ball — poder pela Velocidade

Como na série, o **poder vem da razão entre a Velocidade** de quem usa e a do
alvo (os degraus da série). O Cobblemon não tem o golpe: o visual é o
**Shadow Ball em amarelo elétrico**, com o impacto do Thunder Shock.

- **Poder pela Velocidade** (`damage.speedPower: [{ ratio, power }]`,
  `core/battle/speedPower.js`, vale pra qualquer golpe): no dano de cada
  alvo (`damageTarget`, `attackImpact.js` — também nos acertos seguintes do
  golpe de vários acertos), a Velocidade de combate de cada lado (o atributo
  calculado × o estágio de Velocidade) dá a razão, e vale o degrau mais alto
  que ela alcança. O `power` do golpe fica sendo o do meio, a referência da
  IA e do custo.
- O `attackResolved` ganhou `power` (o poder usado no alvo, com os bônus do
  Assurance e do Electro Ball); "Últimos golpes" do lab mostra.
- **VFX** (`view/vfx/electroBallVfx.js`): carregando (`chargeGroup:
  'electro-ball-charge'`), faíscas de uma esfera grande correndo pro ponto da
  bola na frente do peito, a bola se formando e fagulhas escapando
  (`shadowball_actorcharge`, `_actorblob`, `_actorflaring`); no `effectAt`
  (`'electro-ball'`), o anel do lançamento (`_actorlaunch`), a bola voando
  até o alvo em `BALL_TRAVEL` com rastro de fagulhas (`_targetblob`) e,
  quando chega, o impacto do Thunder Shock (faíscas, choque e estilhaços).
  Texturas do orbe e do anel em `assets/effects/electro-ball/`.
- **Som** (grupo composto `'electro-ball'`): a bola saindo (o Shadow Ball) e,
  quando chega, o acerto do Thunderbolt — escolhas de partida, pra trocar no
  lab se não servirem.
- Descrição pro jogador escrita. Com ela, todas as 10 espécies estão no teste
  das descrições (`DESCRIBED_SPECIES`).

- [x] Poder pela Velocidade, VFX e som
- [x] Ajustes do usuário no lab, aplicados
- [x] Conferido no jogo


## Formato dos golpes nas espécies

Pedido do usuário: os overrides de golpe ficavam espalhados entre `skills`
(o kit) e `moves` (o learnset). Agora:

- **`moves`** lista TODOS os golpes que a espécie tem ou pode ter — os do
  kit primeiro, sem `requires`, e o learnset —, cada um com os `overrides`
  dela.
- **`skills`** só aponta, por slot, o id de um golpe de `moves`; nunca leva
  override.

As 10 espécies migradas (mesmos valores, só mudaram de lugar) e o
`_template` documentado. Quem lê:

- `resolveSpeciesMoveReference` (`species/moves.js`) acha os overrides só em
  `moves`; `resolveCreatureAttack` sem `moveSet` (wiki, previews) passa por
  ele; `listLearnset` e `createMovesState` não mudaram. O save e o estado da
  criatura (`CreatureMoves`) guardam só ids — nada muda neles.
- Wiki: "golpes fora dos slots" (`resolveSpeciesMoves`, `listSkillUsers`)
  deixa de fora os do kit, que agora também estão em `moves`.
- Lab: a camada da espécie é sempre a entrada em `moves`; o Copiar gera essa
  entrada (com o `requires`). Isso substitui o "`skills[N]` ou `moves`" da
  Parte 1.
- Teste de regra (`species/moves.test.js`): todo id do kit está em `moves`,
  sem `requires`, e nenhum golpe se repete em `moves`.



## Os efeitos que faltavam (Dragon Breath, Bite, Rapid Spin)

Pedido do usuário, depois do fechamento: os três efeitos da série que tinham
ficado pra 090 entram aqui. Números da série (chances) e de partida
(durações).

- **Dragon Breath**: chance de paralisar (a paralisia do Glare, que
  atordoa); no canal, cada alvo sorteia uma vez por uso.
- **Bite — o recuo** (a linha "Recuo" da tabela de condições): condição
  **Recuou** (`core/data/conditions/flinch/`) com o comportamento novo
  **interromper** (`interrupt: true`, documentado no `_template`): na hora em
  que pega, o alvo para o que estava fazendo e fica atordoado como no golpe
  interrompido (`iniciarAtordoamento`, a animação de hit, pela duração da
  espécie); não entra na lista de condições (sem tempo, selo nem visual),
  só a linha no log. O Bite tem a chance da série.
- **Rapid Spin — efeitos em quem usa**: campo novo **`selfEffects`** no golpe
  (vale pra qualquer golpe que não seja em si mesmo; `attackImpact.js` aplica
  quando o golpe ACERTA alguém — errou, ou o alvo é imune, nada —, pelo
  `applySelfEffects`, que passou a aceitar a lista; correção do usuário: antes
  valia a cada uso). O Rapid
  Spin sobe a Velocidade de quem usa e o solta do Wrap e da semente, como na
  série — tipo de efeito novo **`removeConditions`** (tira as condições
  listadas, `removerCondicoesPorId`, `actions/conditions.js`).
- **IA e custo olham os `selfEffects`** (pedido do usuário): no preço, o peso
  de cada um entra junto do dos efeitos no alvo (`resolveAttackWeight`; o
  soltar de condições pesa o `ai.value` de cada condição da lista, cheio); na
  nota da IA (`scoreAiAttack`), eles somam uma vez, avaliados em quem usa,
  quando o golpe pega alguém — com o avaliador novo
  `evaluateRemoveConditionsEffect` (vale o `ai.value` das condições da lista
  que quem usa TEM agora).
- Descrições dos três atualizadas; wiki (no lugar): o texto do "interrompe"
  na tabela de condições e "Em quem usa, quando acerta alguém" na página do
  golpe.
- A 090 do roadmap ficou só com as conferências no jogo.


## Limitações resolvidas

Pedido do usuário: resolver as limitações que as mecânicas novas tinham
deixado (a lista foi mostrada a ele antes).

- **IA e custo com o dano esperado**:
  - Vários acertos (Fury Attack): o custo (`resolveAttackWeight`) e a nota da
    IA multiplicam o poder pela média de acertos (`resolveExpectedHits`,
    `multiHit.js` — os números pesados pelos pesos).
  - Poder que muda com o alvo: a IA calcula o poder real em cada alvo
    (`resolveAiPower`, `aiAttackChoice.js`) — pela Velocidade de cada um
    (Electro Ball) e com o bônus contra quem apanhou há pouco (Assurance).
    O custo usa o `power` de referência desses dois, porque o preço é do
    golpe, não de um alvo.
  - Arrancada (Quick Attack): o alcance que dá o bônus de distância no preço
    soma a `lunge.distance` (hoje o Quick Attack continua abaixo do limite).
- **A janela do Assurance com relógio próprio**: `Vitals.hpDamageAge`
  (segundos desde o último dano, `-1` = nunca; `applyDamage` zera,
  `vitalsRegenSystem` conta) no lugar de deduzir do atraso de regeneração —
  a janela não fica mais presa a esse atraso da espécie. O "zerar entre
  golpes" do lab zera ele também.
- **O bônus e o poder pela Velocidade no canalizado**: no tick, o bônus de
  quem apanhou há pouco é medido ANTES do primeiro tick em cada alvo (senão o
  próprio canal contaria) e guardado pro canal inteiro
  (`ActionState.channelMultipliers`); o poder pela Velocidade vale em todo
  tick. O `attackResolved` do tick leva o `power`.
- **Efeito secundário em cada acerto** do golpe de vários acertos (como na
  série: cada acerto sorteia o seu).
- **`selfEffects` no canalizado**: valem uma vez por canal, no primeiro alvo
  que ele pega.
- **Lab**: edita os acertos possíveis e os pesos (`multiHit.counts`,
  `multiHit.weights` — controle de lista de números) e os degraus de poder
  pela Velocidade (`damage.speedPower` — controle de degraus, uma linha por
  degrau).
- **Paralisado sem animação de atordoado** (Caterpie, Rattata e Spearow, sem
  `stun` no modelo): primeiro a reação de golpe (`hit`) repetindo; depois,
  a pedido do usuário, o **Caterpie** usa o descanso dele (`restStart`,
  `restLoop`, `restEnd` — o único dos três com `rest`) e o **Rattata** e o
  **Spearow** ganharam um **tremor de choque** procedural por cima do `idle`
  (`clips.stunned`, `base: 'idle'`, cíclico): tronco, meio e cabeça
  encolhidos (y negativo, medido nos dois esqueletos) e sacudindo nos três
  eixos, com solavancos — a soma de dois senos de frequências vizinhas
  (batida). Valores de partida, ajustáveis no preview "Tremor de Paralisia",
  que refaz o clipe com o mesmo gerador nas duas espécies. Teste de regra:
  toda espécie tem o que tocar paralisada (a animação do modelo ou a camada
  sobre uma base que existe).
- **Leer e Glare**: um brilho em cada olho (o original tem um só), a meia
  distância `EYE_SPREAD` (`leerVfx.js`) para cada lado do
  `positionOffset`, acompanhando o `visual.scale`.

## Fechamento

- **Wiki (0.0.x, no lugar)**: Alcance (conta da frente do corpo, a área começa
  ali, a forma "Em volta", o alcance e o raio são do jeito do golpe e iguais
  pra toda espécie); Acerto e erro (a Evasão do alvo desconta da Precisão de
  quem ataca; os acertos seguintes de um golpe de vários acertos não erram);
  Golpes (só os golpes que carregam são interrompidos; seção "Golpes com
  regras próprias": vários acertos, poder que muda, arrancada); Efeitos em
  batalha (Velocidade e Evasão nos níveis de atributo; tabela de todas as
  condições, com o texto saindo dos comportamentos — o atordoar e o "não sai
  do lugar" entraram no texto); página de cada golpe com a descrição pro
  jogador e as mecânicas especiais.
- Suíte inteira, lint e build (numa cópia, com o `next dev` rodando)
  passando.
- Roadmap: a 061 saiu do Marco 2 para "Já feito" (Combate); a 090 ficou só
  com o que falta (a paralisia do Dragon Breath, o recuo do Bite e a
  Velocidade do Rapid Spin, e as conferências no jogo).

---

## Etapas

- [x] Roadmap: 061 detalhada
- [x] Bump do `package.json` para `0.0.61`
- [x] Parte 1 — laboratório de golpes
- [x] Parte 2 — Bulbasaur
- [x] Charmander, Squirtle, Caterpie, Weedle, Pidgey, Rattata, Spearow,
      Ekans, Pikachu
- [x] Fechamento: suíte inteira (`npm test`), `npm run lint`,
      `npm run build` (numa cópia, com o `next dev` rodando)
- [x] Wiki (0.0.x, no lugar), se algo mudar para o jogador
- [x] Roadmap: a 061 sai do Marco 2 para "Já feito"

## Critérios de Conclusão

- Laboratório de golpes rodando o combate de verdade, com todos os
  parâmetros ao vivo e Copiar.
- Os golpes das 10 espécies revisados pelo usuário no lab e conferidos no
  jogo.
- `npm run build`, `npm run lint` e `npm test` passando.
