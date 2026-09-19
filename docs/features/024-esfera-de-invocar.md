# 🚀 Versão 0.0.24 — Esfera de invocar + som de invocar/recolher

Quatro frentes, cada uma dependendo da anterior já existir: (1) o som de
invocar/recolher criatura, que já tinha o mecanismo pronto desde a
v0.0.23 mas ainda esperava os arquivos de áudio de verdade — agora
subidos e parametrizados; (2) pedido do usuário: em vez da criatura
nascer direto a uma distância fixa (`summonOffset`) na direção que a
câmera aponta, o treinador agora ARREMESSA uma esfera nessa direção, e a
criatura só nasce de verdade onde ela pousar — por toque em algo no
caminho, ou, se não tocar em nada, na distância máxima de `summonOffset`
(mesmo resultado de antes, agora como fallback em vez de posição
garantida); (3) pedido seguinte do usuário, descrevendo o ciclo completo
de uma "abertura"/"saída"/"retorno" de esfera — a saída (esfera se abre
com um clarão de luz, criatura aparece) e o retorno (feixe de luz
vermelha puxa a criatura de volta) viraram dois efeitos visuais novos,
`SummonFlash`/`RecallBeam`; (4) três ajustes finos pedidos depois de ver
o resultado em jogo — o arremesso não respeitava a inclinação/pitch da
câmera (só o yaw), a esfera voava reta sem nenhuma física, e ela nascia
do meio do corpo do treinador em vez de uma aproximação de mão. Os três
foram resolvidos reaproveitando exatamente o mecanismo que o arremesso de
item já usa (`resolveAimPoint`/`resolveHandOrigin`, ver abaixo) e
adicionando gravidade real à esfera; (5) a gravidade do item (4) trouxe um
bug novo, relatado jogando: a esfera podia pousar tocando o CHÃO — algo
que nunca acontecia antes (ela só viajava na horizontal, na altura do
treinador) — e a criatura nascia com a cápsula centrada exatamente no
ponto de toque, metade afundada na superfície. Corrigido deslocando o
pouso pra cima em `verticalClearance` quando resolve por TOQUE (não
quando esgota `maxDistance` no ar); (6) outro bug relatado jogando, num
caso bem específico — inclinando a câmera pro céu ao máximo, a esfera saía
numa direção sem relação com pra onde a câmera de fato apontava na tela.
Raiz: a colisão da câmera orbital (docs/backlog.md → "Câmera orbital com
colisão") só corrigia a posição RENDERIZADA (`cameraFollowSystem.js`) —
em pitches extremos, a posição IDEAL da câmera (usada pela mira,
`computeAimRay`) podia ficar dentro do chão, bem diferente de onde a
câmera de fato estava na tela. `resolveCameraCollision` (extraída de
`cameraFollowSystem.js` pra `core/camera/orbitCamera.js`, compartilhada)
agora também entra em `computeAimRay`, então a mira sempre parte de onde
a câmera de verdade está, colidida ou não; (7) pedido do usuário sobre o
`RecallBeam`: em vez de um cilindro vertical solto, nascido só na posição
da criatura, o feixe agora vai do TREINADOR até a criatura, com
"deformidade como se fosse um raio" (não uma linha reta) — espessura e
deformidade parametrizáveis; (8) o usuário iterou no visual em cima disso
(segmentos retos em ziguezague, em vez de uma curva suave, pra parecer
mais elétrico) e pediu dois ajustes finais: a origem do feixe devia sair
da MÃO do treinador (não do centro do corpo — mesma correção que a
esfera já tinha) e uma revisão geral de estilo/convenções do arquivo;
(9) mesmo depois disso, o feixe ainda parecia sair do meio do corpo —
com os offsets copiados de `throw`/`summon` (0.15/-0.25/1.25), o ponto
calculado ficava a milímetros da superfície da cápsula do treinador
(`capsuleRadius: 0.4`), não fora dela — imperceptível pra um efeito
grande/brilhante como o feixe, mesmo funcionando bem pro item pequeno
arremessado. Valores próprios de `recall` bem maiores resolveram; (10)
pedido seguinte: a esfera de invocar (o mesmo visual redondo do
`SummonBallView.jsx`) devia "aparecer na mão do bot" durante o recall
também, não só o feixe sozinho — como se fosse ela puxando a criatura de
volta; (11) o usuário autorou uma animação de verdade pro gesto de
recolher (`clips/recall.json`) e relatou que a esfera/o feixe continuavam
"saindo do meio do corpo" mesmo depois de (9) — zerar os offsets pra
testar não mudava nada, sinal de bug de verdade, não só magnitude
insuficiente. Causa raiz: ANTES de existir a animação, o treinador ficava
em T-pose durante o recall, e a aproximação geométrica (`resolveHandOrigin`,
um offset fixo — o motor headless não tem acesso a osso nenhum) calhava
de parecer certa por coincidência (braços de T-pose já abertos pros
lados). Com uma animação de gesto de verdade tocando, a mão real do rig
se move pra uma pose bem diferente da aproximação, expondo a limitação
que sempre existiu. Resolvido seguindo o OSSO de verdade
(`mixamorig_RightHand`, mesmo mecanismo de `heldItemViewSystem.js` pro
item na mão) em vez da aproximação — ver seção própria abaixo; (12)
seguindo o osso de verdade, o usuário notou que `handForwardOffset`/
`handSideOffset`/`handHeightOffset` "pararam de fazer efeito" (testou com
valores extremos, `10`, sem mudança visível nenhuma) — esperado, já que
o osso resolvido sobrescreve a aproximação todo frame. Os três ganharam
um segundo papel: viraram um AJUSTE FINO somado em cima da posição real
da mão (não mais a posição inteira), então continuam úteis, só que numa
magnitude bem menor; (13) pedido seguinte: o feixe também devia aparecer
NA CRIATURA — "no formato dela" (inviável de forma genérica, sem malha
específica por espécie pronta pra isso), mas respeitando o TAMANHO dela.
Primeira tentativa: um "envelope" elipsoidal (esfera esticada nos eixos da
cápsula física da espécie recolhida) que cobre a criatura no instante em
que o feixe chega nela e encolhe até sumir — "encobre e recolhe" num só
gesto; (14) o usuário rejeitou o formato do envelope: "não queria algo
cilíndrico, pode ser uma forma abstrata" (fazia sentido — um elipsoide
esticado lembra um cilindro/cápsula). Trocado por um "cristal"/blob
irregular (icosaedro de baixa subdivisão com vértices deslocados por um
ruído determinístico), de raio isotrópico (esfera de volume equivalente
ao da cápsula, não mais sua proporção/eixo) — mesmo "encobre e recolhe",
sem lembrar a forma física de origem.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Som de invocar/recolher

Mecanismo (registries/systems/config) já existia desde a v0.0.23; só
faltavam os arquivos de áudio. Agora resolvidos em
`core/data/species/bot/index.js`, dentro de `sounds`:

```js
summon: {
  clips: ['/assets/audio/summon/summon-01.wav'],
  volume: 0.4,
  refDistance: 1,
},
recall: {
  clips: ['/assets/audio/recall/recall-01.wav'],
  volume: 0.4,
  refDistance: 1,
},
```

Toca via **`SummonPulse`/`RecallPulse`** (`core/traits/components/
party.js`, pulso de UM TICK, mesmo princípio de `Jumped`) — mas o INSTANTE
em que `SummonPulse` é adicionado mudou com a esfera (ver abaixo):
recall continua marcando no `effectAt` da própria ação (a criatura já
existe, destruir é instantâneo); summon agora marca quando a `SummonBall`
POUSA e a criatura de fato nasce, não mais no disparo do arremesso. Sem
essa mudança, o som tocaria enquanto a esfera ainda está voando, bem
antes da criatura aparecer de verdade.

## Esfera de invocar (`SummonBall`)

`actions.summon.effectAt` (`bot/index.js`) não spawna mais a
`SummonedCreature` direto — lança uma **`SummonBall`** (`core/traits/
components/summonBall.js`) na direção travada no disparo. A criatura só
nasce quando ela resolve, em `core/systems/summonBallSystem.js`:

- **Direção = mira de verdade, não só o yaw da câmera** — `beginSummon`
  usa exatamente o mesmo mecanismo do arremesso de item
  (`playerActionSystem.js`, docs/features/016-mira-e-arremesso.md):
  `resolveAimPoint` (raycast a partir da câmera, já respeitando a
  inclinação/pitch, não só o giro horizontal) menos `resolveHandOrigin`
  (aproximação de mão), normalizado — vetor unitário 3D
  (`action.dirX/dirY/dirZ`), travado no disparo pelo mesmo motivo de
  sempre (a câmera é livre pra girar durante a ação). Antes disso, a
  esfera só considerava o yaw da câmera (plano horizontal) — pedido
  explícito do usuário pra ela respeitar a inclinação também. `resolveHandOrigin`
  foi promovida de função interna de `playerActionSystem.js` pra
  `core/aim.js` (exportada) justamente pra ser reaproveitada aqui, em vez
  de duplicar a fórmula.
- **Nasce na mão, não no centro do corpo** — outro pedido explícito: a
  esfera nascia em `Position` (a base/pés do treinador, "saindo do meio
  do bot"). Agora nasce em `resolveHandOrigin(pos, rot.y, actions.summon)`
  — mesma aproximação geométrica do arremesso (à frente do corpo,
  deslocada lateralmente, numa altura fixa), com campos PRÓPRIOS
  (`actions.summon.handForwardOffset`/`handSideOffset`/`handHeightOffset`,
  `bot/index.js`) — podem divergir dos de `actions.throw` se um dia a
  pose de segurar a esfera parecer diferente da de segurar um item.
- **Gravidade de verdade** — "o mínimo de física pra cair", pedido
  explícito do usuário: `summonBallSystem.js` agora aplica
  `GAME_CONFIG.PHYSICS.GRAVITY` (mesma constante que
  `characterPhysicsSystem.js` usa pro resto do jogo) a `vel.y` todo tick,
  ANTES de integrar a posição — mesma ordem de operações que personagens
  já usam. A trajetória curva sozinha, sem esse system precisar calcular
  uma parábola explicitamente. Isso é uma DIVERGÊNCIA deliberada de
  `Projectile` (`projectileSystem.js`, reto/sem gravidade de propósito) —
  o usuário pediu queda física só pra esfera de invocar, não pro
  arremesso de item.
- **Colisão por raycast varrido** — do `Position` atual pro `Position`
  que o PRÓXIMO tick teria (não um raycast pontual, que "pularia" por
  cima de uma parede fina cruzada inteira num tick), mesma técnica de
  `projectileSystem.js` — com a trajetória agora curva, o segmento varrido
  cada tick já reflete a curva DESTE tick, não uma reta desatualizada.
  Exclui a cápsula do TREINADOR (achado por `Party`, não
  `InputControlled` — a esfera sai dele mesmo que uma criatura esteja
  sendo pilotada no momento).
- **Pouso por toque desloca pra CIMA em `verticalClearance`** (bug real,
  relatado jogando, consequência direta da gravidade acima): o raycast da
  esfera acerta a superfície num PONTO, sem volume — a esfera em si não
  tem cápsula. Sem ajuste, a criatura nasceria com o CENTRO da própria
  cápsula exatamente nesse ponto, metade afundada no chão/obstáculo.
  `resolveBall` resolve a espécie ANTES de decidir a posição final e, só
  quando pousou por toque (não quando esgotou `maxDistance` ainda no ar,
  onde não há superfície nenhuma pra apoiar), soma `capsuleRadius +
  capsuleHalfHeight` (cápsula em pé, `axis: 'y'`) ou só `capsuleRadius`
  (deitada, `'x'`/`'z'` — a meia-altura fica no eixo horizontal, não
  conta pra cima) ao Y antes de criar o corpo físico — mesma cápsula que
  `characterPhysicsSystem.js`/`creatureFollowSystem.js` já tratam como
  "cápsula deitada só o raio toca o chão".
- **`maxDistance` como orçamento de CAMINHO, não posição fixa em linha
  reta** — `party.summonOffset` (lido no disparo da esfera, congelado em
  `SummonBall.maxDistance`) deixa de ser "a criatura sempre nasce a X
  metros" e vira "a esfera nunca percorre mais que X metros de CAMINHO
  (arco, com a gravidade curvando) antes de desistir e pousar de
  qualquer jeito". Cada tick anda `min(distância do segmento, maxDistance
  - traveled)` — nunca ultrapassa o orçamento, então o caso "não tocou em
  nada" sempre pousa exatamente quando o orçamento acaba (mais perto, em
  linha reta, do que os X metros originais — parte do caminho virou
  queda vertical).
- **`party.summonBallSpeed`** (novo campo, `bot/index.js`) — velocidade
  (m/s) inicial da esfera em voo.
- **Slot/espécie/direção congelados no disparo** (`SummonBall.slot`/
  `speciesId`), não recalculados no pouso — mesmo raciocínio de
  `SummonedCreature.speciesId`: o time pode mudar enquanto a esfera está
  voando.
- **Cancelamento silencioso**: se `Party[slot]` não for mais a MESMA
  espécie que estava equipada no disparo quando a esfera pousa (trocada/
  removida pelo `InventoryPanel` enquanto voava), ela simplesmente some
  sem spawnar nada — mesmo espírito gracioso do recolhimento automático.
- **`hasPendingBall`** (`partySummonSystem.js`, novo helper) — impede uma
  SEGUNDA esfera pro mesmo slot enquanto a primeira ainda está em voo.
  Necessário porque `duration` (o gesto, ~0.4s) normalmente termina bem
  ANTES da esfera pousar — sem a checagem, apertar o mesmo `secondaryN`
  de novo assim que o treinador destrava lançava uma segunda esfera,
  resultando em duas criaturas nascendo do mesmo slot.
- **Recall não muda** — a criatura já existe num lugar concreto quando se
  recolhe, não há "onde pousar" pra resolver; continua instantâneo no
  `effectAt` da própria ação, sem esfera nenhuma envolvida.

### View

`view/scene/SummonBallView.jsx` + `summonBallVisual.js` — esfera simples
(placeholder visual, cor/tamanho fixos — trocar por modelo/material de
verdade é trabalho futuro, sem mudança de mecanismo), mesmo padrão de
`ProjectileView.jsx`/`throwableVisual.js`. Registrada em `GameScene.jsx`
ao lado de `<ProjectilesView />`.

### Debug

`DebugPanel.jsx` ganhou uma listagem de esferas em voo (posição), mesmo
padrão da listagem de projéteis já existente — útil pra acompanhar o
pouso manualmente.

## Clarão de abertura + feixe de retorno

Pedido explícito do usuário, descrevendo o ciclo de vida de uma esfera de
invocar: abertura (o arremesso em si — já coberto acima, sem mudança),
**saída** ("a bola se abre com um clarão de luz e o monstrinho aparece
pronto pra agir") e **retorno** ("o feixe de luz vermelha puxa o Pokémon
de volta pra dentro da esfera"). Dois traits novos, mesmo formato trivial
de `ConsumeEffect` (`Position`/`Rotation` cuidam de onde aparece,
`lifetime` conta até desaparecer sozinho, sem movimento):

- **`SummonFlash`** (`core/traits/components/summonFlash.js`) — spawnado
  por `summonBallSystem.js`'s `resolveBall`, exatamente no ponto/tick em
  que a `SummonedCreature` de fato nasce (mesmo instante de `SummonPulse`).
  `lifetime` vem de `actions.summon.flashDuration` (`bot/index.js`, novo
  campo — independente de `duration`/`effectAt`, mesmo espírito de
  `consume.effectVisualDuration`).
- **`RecallBeam`** (`core/traits/components/recallBeam.js`) — spawnado
  por `partySummonSystem.js`'s `applyRecall`, um instante ANTES de
  destruir a `SummonedCreature`. `Position`/`Rotation` (a ponta de
  CHEGADA do feixe) ficam na posição exata da criatura, mesmo de sempre;
  `fromX/fromY/fromZ` (novos campos) guardam a ponta de SAÍDA — não a
  `Position` crua do treinador (centro do corpo), a MÃO dele
  (`resolveHandOrigin`, mesmo mecanismo da `SummonBall`/do arremesso;
  pedido explícito do usuário depois de tentar e não conseguir na mão —
  `rot.y` nesse instante já é o que `beginRecall` girou pra encarar a
  criatura, então a mão "aponta" pra ela). Pedido explícito do usuário: o
  feixe deixou de ser um efeito solto só na criatura, agora vai de um
  ponto ao outro de verdade. `lifetime` vem de `actions.recall.beamDuration`
  (mesmo espírito de antes). `speciesId` (novo campo) guarda a espécie
  recolhida — lido de `SummonedCreature` ANTES de destruí-la — mesma
  convenção de `SummonBall.speciesId`/`SummonedCreature.speciesId` (trait
  guarda só o id, quem consome busca `getSpecies(speciesId).body` quando
  precisa de dado derivado); `RecallBeamView.jsx` usa isso pro "envelope"
  que cobre a criatura (ver View, abaixo).
  - **Offsets da mão maiores que `throw`/`summon` de propósito** (bug
    relatado jogando, DEPOIS da primeira versão do `resolveHandOrigin`
    aqui): com os mesmos valores de `throw`/`summon` (0.15/-0.25/1.25), o
    ponto calculado ainda ficava a milímetros da superfície da cápsula do
    treinador (`capsuleRadius: 0.4`) — a 1.25 de altura já cai na "tampa"
    arredondada da cápsula, onde o raio local é menor que 0.4, mas mesmo
    assim 0.25 de lado não chegava a sair de fato. Imperceptível pra um
    item pequeno arremessado, mas óbvio pra um efeito grande/brilhante
    como o feixe. `handHeightOffset: 0.7` (bem-behaved: fica na parte
    CILÍNDRICA da cápsula, onde o raio é sempre 0.4 em qualquer direção
    horizontal) + `handForwardOffset: 0.35`/`handSideOffset: -0.6`
    (`√(0.35² + 0.6²) ≈ 0.69`, bem além dos 0.4) resolveram com folga.
- **`summonEffectsSystem.js`** (novo) — conta o `lifetime` dos dois pra
  baixo e destrói a entidade ao chegar a zero. Os dois efeitos moram no
  MESMO arquivo de system (ao contrário de audio/registries de outras
  features, que ficam cada um no seu) porque a lógica é idêntica e
  nasceram juntos, na mesma feature — sem motivo pra duplicar o mesmo
  laço duas vezes.

### View

`SummonFlashView.jsx` — esfera emissiva que cresce e esvai + uma
`pointLight` que acompanha o mesmo fade, dando o "clarão".

`RecallBeamView.jsx` — bem mais elaborado que um cilindro:
`buildLightningGeometry` gera um `THREE.TubeGeometry` sobre um
`THREE.CurvePath` de segmentos RETOS (`THREE.LineCurve3` encadeados, não
uma curva suave — o usuário iterou nisso depois da primeira versão com
`CatmullRomCurve3`: ângulos bruscos parecem mais elétricos que uma
ondulação) que vai da MÃO do treinador até a criatura (origem local do
grupo, que já está na posição dela via `syncTransformSystem`), passando
por pontos INTERMEDIÁRIOS deslocados lateralmente — pedido explícito do
usuário: "deformidade como se fosse um raio". Cada ponto desvia na
direção de UM dos dois vetores perpendiculares ao segmento, ALTERNADOS
por índice (ziguezague, em vez de uma direção aleatória qualquer, que
pareceria mais "tremido" que "raio"), sinal sorteado. As PONTAS nunca são
deslocadas, só o meio ziguezagueia. A geometria é regenerada
(`REFRESH_INTERVAL`, ~20x/segundo) enquanto o efeito está ativo, dando o
tremor/piscar de um relâmpago de verdade — não uma curva deformada uma
vez só e parada.

Também renderiza uma ESFERA na ponta "mão" (mesmo visual de
`SummonBallView.jsx` — `SUMMON_BALL_RADIUS`/`SUMMON_BALL_COLOR`
reaproveitados de `summonBallVisual.js`, não duplicados) — pedido
explícito do usuário: a esfera de invocar deve "aparecer na mão do bot"
durante o recall também, não só o feixe sozinho, como se fosse ela
puxando a criatura de volta pra dentro. Esvai (`opacity`) junto com o
feixe, mesmo `t`/`BEAM_DURATION`.

**A ponta "mão" (de ambos, feixe e esfera) segue o OSSO DE VERDADE**
(`mixamorig_RightHand`, todo frame — não uma aproximação geométrica
congelada no disparo). Bug real, relatado jogando, depois do usuário
autorar uma animação de verdade pro gesto de recolher
(`clips/recall.json`): antes da animação existir, o treinador ficava em
T-pose durante o recall, e a aproximação antiga (`RecallBeam.fromX/Y/Z`,
resolvida via `resolveHandOrigin` no disparo — um offset fixo
forward/side/height, o motor headless não tem acesso a osso nenhum)
calhava de parecer certa por coincidência (T-pose já tem os braços
abertos pros lados, perto de onde um offset lateral fixo aponta). Assim
que a animação de gesto de verdade passou a tocar, a mão real do rig se
moveu pra uma pose bem diferente — e ficou óbvio que a aproximação nunca
soube de fato onde a mão estava, só "parecia certa" no caso particular
do T-pose. `RecallBeam.fromX/Y/Z` continua existindo como FALLBACK
(usado no instante do disparo, e sempre que o osso ainda não foi
resolvido num frame qualquer) — o osso de verdade só existe na VIEW, o
core continua sem saber nada sobre rig/bones, mesma separação de sempre.

- **`HAND_BONE_BY_SPECIES`** (`view/handBoneBySpecies.js`, novo arquivo)
  — extraída de `heldItemViewSystem.js` (onde morava sozinha, só pro item
  na mão) quando um segundo consumidor (`RecallBeamView.jsx`) precisou do
  MESMO osso (`mixamorig_RightHand`, único hoje — só o treinador/`bot`
  tem mão).
- Mecanismo: `getAnimatedBonesEntry(playerEntity)?.bones[HAND_BONE_NAME]
  ?.bone` (mesma API que `heldItemViewSystem.js` já usa) — achado, lê
  `bone.getWorldPosition` e converte pra espaço LOCAL do grupo
  (`groupRef.current.worldToLocal`) todo frame, tanto pro ponto de
  partida do tubo quanto pra posição da esfera. DIFERENTE do item na mão
  (que vira filho de verdade do osso, `bone.add()`) — a esfera aqui só
  acompanha a POSIÇÃO, sem herdar rotação/escala do rig (não precisa "virar
  junto" com a mão, só seguir onde ela está), então não precisa da
  correção de escala que `bone.add()` exigiria (rig ~0.015, ver
  `heldItemViewSystem.js`).
- Sem ordem garantida entre o registro de ossos do treinador
  (`useAnimatedModel.js`, outro componente React) e o mount de
  `RecallBeamView` — tenta achar o osso a cada frame até conseguir (mesmo
  "tenta de novo no próximo frame" de `heldItemViewSystem.js`); até lá,
  usa o fallback geométrico.
- **`handForwardOffset`/`handSideOffset`/`handHeightOffset` ganharam um
  segundo papel** (pedido do usuário, depois de notar que "pararam de
  fazer efeito" testando com valores extremos — esperado, o osso resolvido
  sobrescreve a aproximação todo frame): com o osso já resolvido, viram um
  AJUSTE FINO somado em cima da posição REAL da mão
  (`resolveHandOrigin(ORIGIN, rot.y, RECALL)` — zerar a posição de base
  extrai só o vetor de deslocamento), na direção que o treinador encara
  AGORA (`Rotation.y` ao vivo, não travado no disparo). Continuam sendo
  a posição INTEIRA no caminho de fallback (`applyRecall`, sem osso
  resolvido) — por isso a MAGNITUDE esperada mudou bastante entre os dois
  papéis (grande o bastante pra sair da cápsula no fallback; pequena, só
  um "cutucão", no ajuste fino sobre o osso).

- **`actions.recall.beamThickness`** (`bot/index.js`, novo campo) —
  espessura do feixe (raio do tubo, em metros).
- **`actions.recall.beamJitter`** (novo campo) — deformidade: FRAÇÃO
  (0-1+, não metros absolutos) do comprimento de CADA segmento que ele
  pode desviar lateralmente da linha reta treinador→criatura — o mesmo
  valor então parece proporcional não importa a distância do recall
  (`jitterAmount = jitter * segmentLength`, em `buildLightningGeometry`).
  `0` desativa (vira uma linha reta lisa).
- Os dois são lidos AO VIVO (`getPlayerSpecies().actions.recall`, dentro
  do `useFrame`), não congelados no disparo — mudar no painel de
  configurações (se algum dia existir um pro treinador) valeria na hora,
  mesmo espírito de outros parâmetros ao vivo do motor.

Geometria gerenciada IMPERATIVAMENTE (`mesh.geometry = novaGeometria`, não
`<bufferGeometry>` declarativo) — cada troca (e o desmonte final) descarta
(`.dispose()`) a geometria anterior, pra não vazar memória de GPU a cada
regeneração.

**Envelope na ponta "criatura"** — pedido do usuário: o feixe também
devia aparecer NA CRIATURA, "no formato dela" (inviável genericamente,
sem malha específica por espécie pronta pra isso), mas "respeitando o
tamanho" dela — e, ao chegar, "encobre ela e recolhe". PRIMEIRA versão
usou uma esfera unitária escalada NÃO-uniformemente pra aproximar a
cápsula física da espécie (eixo da cápsula com escala `radius +
halfHeight`, os outros dois só `radius`) — rejeitada pelo usuário: "não
queria algo cilíndrico, pode ser uma forma abstrata" (fazia sentido: um
elipsoide bem esticado LEMBRA um cilindro/cápsula, justo o formato que
não devia aparecer). Versão atual, um "cristal"/blob irregular:

- **`resolveEnvelopeRadius(body)`** — em vez de escalar por eixo, calcula
  o raio de uma esfera de VOLUME equivalente ao da cápsula
  (`4/3·π·R³ = π·r²·2h + 4/3·π·r³` → `R = cbrt(r³ + 1.5·h·r²)`) — um
  único número isotrópico (mesmo raio em qualquer direção), "respeita o
  tamanho" sem herdar a proporção alongada da cápsula.
- **`buildEnvelopeGeometry(radius, seed)`** — um `THREE.IcosahedronGeometry`
  de subdivisão baixa (`ENVELOPE_DETAIL: 1`, poucas facetas grandes, de
  propósito — reforça a leitura de "forma abstrata/cristal", não uma
  esfera lisa) com cada vértice deslocado pra dentro/fora ao longo da
  própria direção, por um fator de ruído determinístico
  (`hashDirection(direção, seed)`, mesmo estilo de hash usado em shaders
  GLSL clássicos) — NÃO `Math.random()` por vértice: `PolyhedronGeometry`
  deduplica vértices compartilhados entre facetas adjacentes, e um hash
  por DIREÇÃO (não por índice) garante que vértices coincidentes caiam no
  mesmo resultado, sem abrir frestas visíveis na malha.
- Regenerada a cada `REFRESH_INTERVAL` com um `seed` novo (mesmo raio,
  fixado uma vez no mount) — a FORMA treme junto com o raio, mesmo
  espírito do relâmpago aplicado a um blob em vez de uma curva.
- Encolhe com escala UNIFORME (`setScalar(1 - t)`, o MESMO `t` do fade do
  feixe/da esfera) até sumir — "encobre e recolhe" num só gesto,
  sincronizado com o resto do efeito (sem campo de `lifetime`/duração
  próprios).
- Sem espécie resolvida (`speciesId` nulo ou inválido, não devia
  acontecer), cai num raio-fallback fixo (`DEFAULT_ENVELOPE_RADIUS`) em
  vez de desenhar um envelope de tamanho zero.

Geometria (não só a do raio) gerenciada IMPERATIVAMENTE, mesmo motivo de
sempre — trocada a cada refresh, disposta a cada troca e no desmonte.

Os dois efeitos (`SummonFlashView`/`RecallBeamView`) animam via `useFrame`
(relógio do R3F, não o tick da simulação) — efeito cosmético de curta
duração, não precisa ser determinístico; `BEAM_DURATION`/`FLASH_DURATION`
são constantes locais em cada componente, propositalmente iguais ao
`lifetime` configurado em `bot/index.js` (documentado no comentário de
cada arquivo — se um dia divergirem, o efeito visual desaparece antes/
depois da entidade morrer de verdade, sem quebrar nada, só ficando menos
preciso). `RecallBeam`/`Position` são lidos uma ÚNICA vez, via
`entity.get()` direto (não `useTrait`, que re-renderizaria o componente
React a CADA TICK — `lifetime` muda todo tick em `summonEffectsSystem.js`,
mas `fromX/Y/Z`/a posição da criatura são congelados no disparo). Ambos
registrados em `GameScene.jsx` ao lado de `<SummonBallsView />`.

## Colisão da câmera também vale pra mira (`resolveCameraCollision`)

`core/camera/orbitCamera.js` ganhou `resolveCameraCollision` (movida de
`view/systems/cameraFollowSystem.js`, onde era função interna só pra
posicionar a câmera renderizada — mesma lógica exata, só exportada) e
`computeAimRay` passou a chamá-la antes de resolver `origin`: em vez da
posição IDEAL da câmera (`computeCameraPosition`, sem checar nada no
caminho), agora usa a posição JÁ corrigida por colisão — a mesma que
`cameraFollowSystem.js` usa pra renderizar de verdade. `excludeColliderHandle`
(novo terceiro parâmetro de `computeAimRay`, propagado por
`resolveAimPoint`) evita a correção se autoacertar contra a própria
cápsula de quem está mirando.

Sem isso, em pitches bem inclinados (`MIN_PITCH`, olhando pro céu, com
`distance` grande) a posição IDEAL da câmera podia ficar dentro do chão —
a câmera RENDERIZADA já corrigia isso (ficava acima do chão, puxada pra
mais perto), mas a MIRA (arremesso de item, esfera de invocar) continuava
calculando a partir do ponto original, embaixo do chão — resultando numa
direção sem relação nenhuma com pra onde a câmera de fato apontava na
tela. Bug pré-existente do arremesso de item também, só nunca notado
antes — a esfera de invocar foi o que expôs, testando pitches mais
extremos.

## Arquivos

- **Novo**: `core/traits/components/summonBall.js`, `summonFlash.js`,
  `recallBeam.js`; `core/systems/summonBallSystem.js` (+ teste),
  `summonEffectsSystem.js` (+ teste); `view/scene/SummonBallView.jsx`,
  `summonBallVisual.js`, `SummonFlashView.jsx`, `RecallBeamView.jsx`;
  `view/handBoneBySpecies.js` (extraído de `heldItemViewSystem.js`).
- **Modificado**: `core/systems/partySummonSystem.js` (`applySummon`
  virou `spawnSummonBall`; `beginSummon` agora usa `resolveAimPoint`/
  `resolveHandOrigin` em vez de só `resolveCameraYaw`; novo
  `hasPendingBall`; `applyRecall` agora recebe `pos`/`rot` do treinador,
  resolve a MÃO dele via `resolveHandOrigin` e congela em
  `RecallBeam.fromX/Y/Z` ao spawnar), `core/traits/components/
  recallBeam.js` (`fromX/fromY/fromZ` novos), `core/aim.js`
  (`resolveHandOrigin` promovida de função interna de
  `playerActionSystem.js` pra cá, exportada; `resolveAimPoint` propaga
  `excludeColliderHandle` pra `computeAimRay`), `core/camera/
  orbitCamera.js` (`resolveCameraCollision` nova/exportada;
  `computeAimRay` ganhou `excludeColliderHandle` e corrige a origem por
  colisão), `core/systems/playerActionSystem.js` (importa
  `resolveHandOrigin` de `core/aim.js` em vez de declarar a própria
  cópia), `core/systems/summonBallSystem.js` (gravidade,
  `GAME_CONFIG.PHYSICS.GRAVITY`; `verticalClearance` no pouso por toque),
  `view/systems/cameraFollowSystem.js` (usa `resolveCameraCollision`
  importada em vez da própria cópia), `view/scene/RecallBeamView.jsx`
  (reescrito, e depois iterado pelo usuário — `buildLightningGeometry`,
  `THREE.TubeGeometry` sobre um `THREE.CurvePath` de segmentos retos, em
  vez do cilindro vertical antigo; ganhou uma esfera parada na ponta
  "mão", reaproveitando `SUMMON_BALL_RADIUS`/`SUMMON_BALL_COLOR` de
  `summonBallVisual.js`), `core/traits/index.js`,
  `core/data/species/bot/index.js` (`party.summonBallSpeed`,
  `actions.summon.handForwardOffset`/`handSideOffset`/`handHeightOffset`/
  `flashDuration`, `actions.recall.handForwardOffset`/`handSideOffset`/
  `handHeightOffset`/`beamDuration`/`beamThickness`/`beamJitter` novos;
  áudio de summon/recall descomentado/parametrizado), `view/loop/
  registerSystems.js` (registra `summonBallSystem` logo depois de
  `partySummonSystem` —
  dependência real de ordem, não só proximidade — e `summonEffectsSystem`
  perto de `consumeEffectSystem`, mesma família), `view/scene/
  GameScene.jsx`, `tools/debug/DebugPanel.jsx`,
  `view/systems/heldItemViewSystem.js` (importa `HAND_BONE_BY_SPECIES` de
  `view/handBoneBySpecies.js` em vez de declarar a própria cópia),
  `core/data/species/bot/clips/recall.json` (novo, animação de verdade
  do gesto de recolher, autorada pelo usuário); `core/traits/components/
  recallBeam.js` (`speciesId` novo), `core/systems/partySummonSystem.js`
  (`applyRecall` lê `speciesId` de `SummonedCreature` ANTES de destruí-la
  e propaga pro `RecallBeam`), `view/scene/RecallBeamView.jsx`
  (`resolveEnvelopeRadius`/`buildEnvelopeGeometry`/`hashDirection` novos +
  terceira mesh, o "envelope" — um blob/cristal abstrato, não um
  elipsoide cilíndrico — que cobre a criatura e encolhe).

## Testes

- `summonBallSystem.test.js` (novo) — integra posição pela velocidade com
  gravidade (`vel.y` decresce a cada tick, horizontal fica reto); sem
  física carregada (`castRay` sempre `null`), pousa exatamente ao esgotar
  `maxDistance` (percorrido ao longo do caminho já curvo, não em linha
  reta) e spawna a criatura ali — validado contra uma reprodução
  independente do laço de física do system (`simulateBallLanding`, mesmo
  padrão de reprodução isolada que `playerActionSystem.test.js` já usa
  pra `resolveHandOrigin`/`resolveAimPoint`); cancela silenciosamente se o
  slot mudou de espécie enquanto voava; com física real
  (`initPhysics`/`createStaticLevel`, mesmo padrão de
  `projectileSystem.test.js`), para no ponto de impacto ao atingir o chão
  (mais perto que `maxDistance`) e spawna deslocada em `verticalClearance`
  acima da superfície — não com a cápsula afundada nela (dois testes,
  espécies diferentes, mesma checagem); exclui a cápsula do treinador
  (não se autoacerta nascendo perto do próprio corpo).
- `partySummonSystem.test.js` — reescrito pra refletir o novo fluxo
  assíncrono: `tick()` agora roda `partySummonSystem` + `summonBallSystem`
  juntos (mesma ordem do loop real); `advanceUntilFree` (só o gesto)
  continua existindo pros testes especificamente sobre timing do gesto;
  `advanceUntilResolved` espera o gesto E qualquer `SummonBall` pendente
  já ter pousado — é o que a maioria dos testes de summon usa, já que a
  criatura só existe de fato depois disso. Testes de direção/posição
  reescritos pra reproduzir `resolveAimPoint`/`resolveHandOrigin`/a
  integração com gravidade localmente (mesmo padrão de
  `simulateBallLanding`), em vez de assumir geometria pura de yaw —
  incluindo o detalhe de que a esfera nasce (no `effectAt`) com a
  rotação JÁ NOVA do treinador (`beginSummon` já girou o corpo pra
  encarar a direção resolvida), não a de antes do disparo (essa só entra
  no cálculo da PRÓPRIA direção, por causa do "ovo e a galinha" de ainda
  não saber pra onde girar). Novo teste cobrindo `hasPendingBall`: apertar
  `secondaryN` de novo assim que o gesto destrava (esfera anterior ainda
  voando) não lança uma segunda esfera pro mesmo slot; teste do
  `RecallBeam` atualizado — confirma que ele nasce na posição exata da
  criatura recolhida E carrega a posição da MÃO do treinador (não a
  `Position` crua) em `fromX/Y/Z`, validado contra `resolveHandOrigin`
  reproduzida localmente (agora recebe `config` como parâmetro, reusada
  pra `SUMMON`/`RECALL`); mais um `expect` confirmando que `RecallBeam.speciesId`
  vem da espécie de verdade que foi recolhida (usado por `RecallBeamView.jsx`
  pra dimensionar o envelope — sem teste automatizado pra
  `resolveEnvelopeRadius`/`buildEnvelopeGeometry`/o próprio envelope,
  Three.js/visual, mesmo precedente de sempre pra essa parte do arquivo).
- `summonEffectsSystem.test.js` (novo) — conta `lifetime` de
  `SummonFlash`/`RecallBeam` pra baixo, destrói ao zerar, mesmo padrão de
  `consumeEffectSystem.test.js`; confirma que os dois efeitos não
  interferem um no outro (moram no mesmo system, mas em queries
  separadas).
- `summonBallSystem.test.js` ganhou assertions confirmando que
  `resolveBall` spawna o `SummonFlash` na posição de pouso quando a
  criatura nasce, e NÃO spawna nada quando o pouso é cancelado
  (espécie/slot divergente).
- `orbitCamera.test.js` — novos testes pra `resolveCameraCollision`
  (sem física, devolve a posição sem alteração; com física real,
  `initPhysics`/`createStaticLevel`, puxa a posição pra logo antes do
  chão em vez de atravessar) e pra `computeAimRay` (com física real, um
  pitch/distância que faria a posição IDEAL da câmera ficar dentro do
  chão — a origem devolvida já vem corrigida, acima da superfície).
- Sem teste automatizado pra `buildLightningGeometry`/`RecallBeamView.jsx`
  (Three.js/browser, mesmo precedente de sempre — a geração da geometria
  em si é só matemática de vetores, mas o valor de testar isso isolado
  do resto do componente não compensa o esforço aqui).
- `npm run lint`/`npx vitest run` verdes — mesma baseline pré-existente
  (`items`/`world`/`wildCreatureSpawnSystem`, alheios a esta feature).

## Fora de escopo (de propósito)

- Visual definitivo da esfera em si (modelo/material de verdade) — cor/
  tamanho fixos por enquanto, mesmo estágio que os throwables genéricos;
  só o clarão/feixe (efeitos em volta dela) ganharam visual dedicado.
- Colisão da esfera com outras entidades (criaturas/treinador) — só
  contra o mundo estático, mesmo escopo de `Projectile`.
- `AimAnchor` (mira travada, botão direito segurado) considerado no
  disparo da esfera — o arremesso de item respeita a âncora quando ativa
  (usa o ponto travado em vez de recalcular via raycast); a esfera de
  invocar sempre recalcula na hora, não olha pra âncora. Fora de escopo
  porque não foi pedido; adicionar depois é só trocar a chamada de
  `resolveAimPoint` por uma checagem de `AimAnchor.active`, mesmo padrão
  já usado em `playerActionSystem.js`.
- Recolher também virar uma "ação com esfera" (a esfera fisicamente
  viajando até a criatura antes do feixe) — pedido do usuário foi só
  sobre o feixe de retorno em si; a esfera de recolher continua
  implícita/instantânea.
- Criatura "encolhendo"/dissolvendo visualmente enquanto o `RecallBeam`
  aparece — hoje ela é destruída no mesmo tick em que o feixe nasce
  (coincidem no espaço, não numa transição animada entre os dois).
