# 🚀 Versão 0.0.25 — Ataque comum de criatura

Primeira skill de criatura de verdade: até aqui, controlando uma
`SummonedCreature` (ver docs/features/018-troca-de-controle-treinador-
criatura.md), só valiam 4 verbos (andar, correr, pular, dash) — `Q`/`E`/`R`
ficavam reservados, sem ação nenhuma. Pedido do usuário: implementar o
ataque comum, no botão ESQUERDO do mouse (não Q/E/R — essas continuam
reservadas pras skills futuras), com um efeito visual genérico de
partículas e uma visualização de debug clara do alcance/área efetiva.
Animação específica por criatura ainda não existe (trabalho em paralelo,
por fora desta feature) — a arquitetura já fica pronta pra tocar o clipe
assim que existir, mesmo princípio já usado pro `'recall'`
(docs/features/017-locomocao-e-recolhimento-de-criaturas.md).

Duas decisões perguntadas ao usuário antes de programar (ambíguas o
bastante pra não adivinhar):

1. **Dano/detecção de acerto**: fora de escopo nesta etapa — só o
   mecanismo de ação + VFX + debug de alcance/área. Decisão do usuário,
   consistente com o projeto: `stats`/`moves` continuam vazios em toda
   espécie (`_template/index.js` já avisa "o sistema de batalha ainda não
   foi desenhado"), e `applyDamage` (core/traits/components/vitals.js)
   ainda só tem uma fonte real, o botão de debug do `DebugPanel`. Aplicar
   dano de verdade a um alvo dentro da área é trabalho futuro.
2. **Escopo da config** (range/área/duração, e futuramente o clipe): POR
   ESPÉCIE, não genérico/global — cada criatura `kind: 'pokemon'` ganha seu
   próprio bloco `actions.attack`, mesmo padrão de `actions.throw`/
   `.consume` do treinador (`bot/index.js`). Hoje os valores são idênticos
   em toda espécie (efeito genérico, sem golpe próprio definido ainda), mas
   a estrutura já está pronta pra divergir de verdade quando cada Pokémon
   tiver seu próprio golpe/animação — é justamente o que "arquitetura
   preparada pra receber uma animação configurada pra criatura depois"
   (pedido do usuário) exige.

Depois de ver a v1 rodando, o usuário pediu dois ajustes: (3) o golpe
devia respeitar a direção/inclinação da CÂMERA, não só `Rotation.y` (a
v1 atacava sempre pra onde o corpo já estava encarando, sem levar em
conta pra onde o jogador estava olhando de verdade — mesmo problema que
o arremesso do treinador já tinha resolvido antes, docs/features/016-
mira-e-arremesso.md); (4) em vez de uma explosão de partículas ÚNICA pra
qualquer criatura, o efeito visual devia ser escolhido por GRUPO — "muitas
criaturas vão compartilhar o ataque básico de arranhar, outras vão ser
específicas como um chicote" — com um genérico (arranhão, `'scratch'`)
pronto agora, mas a arquitetura pronta pra registrar golpes visualmente
distintos depois, mesmo espírito de `footstepGroup`/`dashGroup`
(`core/data/audio/*.js`): várias espécies compartilhando o mesmo grupo, em
vez de cada uma reimplementar o próprio visual.

Terceira rodada, dois pedidos novos do usuário ("esqueci de pedir, mas..."):
(5) o ataque tem que consumir STAMINA também — faltava desde a v1, mesmo
padrão que dash/arremesso já seguem (`GAME_CONFIG.PLAYER_ACTIONS.dash.
STAMINA_COST`/`actions.throw.staminaCost`), só não tinha sido pedido antes;
(6) o efeito visual (grupo `'scratch'`) devia parar de ser uma explosão de
partículas flutuantes e virar uma "simulação de soco" — impacto físico de
verdade (flash + onda de choque + estilhaços), não poeira brilhante
subindo.

Quarta rodada: o ataque também precisa de SOM — mesmo mecanismo que
passo/dash/pulo/invocar/recolher já usam (`core/data/audio/*.js` +
registry entidade→áudio na view), tocando no instante do IMPACTO
(`effectAt`, mesmo instante do VFX), não no início do gesto. Pedido só do
MECANISMO — o usuário ainda vai colocar o(s) arquivo(s) de áudio de
verdade (ver "Onde colocar o áudio", abaixo). Feito isso, o usuário
ajustou por conta própria: subiu `attack-01.wav`/`attack-02.wav` de
verdade, renomeou o grupo de `'default'` pra `'punch'` (código + toda
espécie) e reduziu `radius` de `0.7` pra `0.3` depois de ver o resultado
em jogo.

Quinta rodada, duas perguntas/pedidos novos: (7) o guia de debug (esfera
de 16×12 segmentos pra mostrar a área efetiva) estava onerando a
performance? — resposta: não de verdade (a geometria nunca era RECRIADA
por frame, só escalada/reposicionada), mas sem motivo nenhum pra ter mais
detalhe que um indicador de debug precisa, então trocada por um
icosaedro de baixíssimo detalhe mesmo assim (ver "Debug" abaixo); (8) o
ataque precisa RESPEITAR O TRAJETO até o ponto de impacto, não só o
destino — com um `range` grande (simulando o alcance de um chicote, por
exemplo), um obstáculo no meio do caminho não pode ser ignorado
("teleportando" o efeito através dele). Resolvido com um raycast
(`castRay`, já usado em `resolveAimPoint`/`summonBallSystem.js`) do corpo
até o ponto calculado — para no primeiro toque, exatamente como o
arremesso do treinador já respeita paredes.

Sexta rodada: o usuário disponibilizou `.exemple/Effects/` — um pacote de
efeitos de combate "rippado" de um jogo Pokémon 3DS (mesma família de rip
já usada pros modelos/texturas de espécie), com 30 malhas próprias
(`.obj`/`.mtl`/`.dae`) + texturas — e pediu ajuda pra definir como usar
isso no ataque. Depois de examinar o pacote e alinhar com o usuário (ver
"Efeitos de verdade", abaixo), dois grupos passaram a usar malha real em
vez de forma procedural: `'scratch'` (a malha `EffCommonScratch`,
escolhida pelo usuário — bate com o nome do grupo) e um `'punch'` novo
(`EffCommonHitNormalA` + `EffCommonHitNormalShockWave`, também escolhido
pelo usuário), depois deixado como padrão em toda espécie nova. Um bug
real relatado jogando logo em seguida (nada aparecia, nem em escala 100)
foi corrigido nessa mesma rodada — `side: THREE.DoubleSide` faltando no
material, ver seção "Efeitos de verdade" pro diagnóstico.

Sétima rodada, três pedidos do usuário de uma vez, com o `'punch'` já
como padrão e o pedido virando "melhorar o Scratch": (9) o efeito do
`'scratch'` não devia aparecer inteiro de uma vez — precisa ser REVELADO
progressivamente (0% a 100% do traço visível), controlável, pra passar a
sensação de golpe indo de um ponto a outro; (10) a orientação do efeito
estava presa ao componente horizontal (`Rotation.y`) — precisa ser
configurável, "rotacionar livremente"; (11) — o maior dos três —
reorganizar toda a config de ataque: um único lugar por ataque (visual,
áudio, modelo, custo, alcance, cooldown, e futuramente dano), a espécie
só REFERENCIANDO o ataque por id, com override específico por criatura
quando precisar de um valor diferente do padrão, sem duplicar a
definição inteira. As três só puderam ser resolvidas juntas de verdade —
o `revealDuration`/`rotationOffset` configuráveis já nasceram DENTRO da
nova arquitetura de ataque (`core/data/attacks/`), não teria feito
sentido implementar como mais um campo solto na espécie pra já ter que
mudar de lugar na sequência.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## Mecanismo (`creatureAttackSystem.js`)

Novo system, mesma família de `playerActionSystem.js`/
`partySummonSystem.js` — mesmo mecanismo genérico de `ActionState` que
dash/arremesso/uso/summon/recall já usam: trava `current = 'attack'` no
disparo, o efeito de verdade (spawnar o VFX) só acontece no instante
`effectAt`, e `current` volta a `null` em `duration`. Não é dono de
nenhuma outra ação — ignora explicitamente qualquer `current` que não seja
`'attack'`, mesmo padrão de exclusão mútua que `playerActionSystem.js` já
usa pra `'summon'`/`'recall'`.

- **Gatilho**: `input.primary` (botão esquerdo, borda "apertou agora" —
  mesmo pulso que já existia em `pointerInput.js`), SEM precisar segurar o
  botão direito (`input.aiming`) — diferente do arremesso do treinador, a
  criatura não mira com ÂNCORA (`aimAnchorSystem.js` continua ignorando
  `SummonedCreature`), mas o golpe em si respeita a direção da CÂMERA (ver
  "Direção: câmera, não `Rotation.y`" abaixo).
- **Query**: `InputControlled, SummonedCreature, ActionState,
  CharacterController, PhysicsBody, Position, Rotation` —
  `SummonedCreature` no filtro (não `resolveSpeciesKind`) é o mesmo
  critério que `aimAnchorSystem.js` já usa pra "isto é uma criatura, não o
  treinador": o treinador nunca tem `SummonedCreature`, e toda
  `SummonedCreature` real já tem os outros traits (dados no spawn,
  `summonBallSystem.js`).
- **Sem `actions.attack` configurado** (espécie ainda não preenchida, ou
  espécie desconhecida) → `input.primary` simplesmente não faz nada, sem
  quebrar — mesmo espírito gracioso de sempre no projeto (item/espécie
  inválido também só vira no-op).
- **Custa stamina** (`actions.attack.staminaCost`, por espécie — pedido
  do usuário na 3ª rodada, esquecido no pedido original): descontada uma
  vez no disparo (não por segundo), mesmo padrão de `DASH.STAMINA_COST`/
  `actions.throw.staminaCost`. Sem stamina suficiente
  (`vitals.stamina < staminaCost`), o ataque simplesmente não dispara —
  `input.primary` vira no-op silencioso (mesma precondição que já bloqueia
  dash/arremesso), sem cooldown separado (não pedido). Reseta
  `vitals.staminaRegenDelay` pro `staminaRegenDelayAfterUse` da PRÓPRIA
  criatura (campo em `Vitals`, copiado da espécie no spawn), mesmo
  princípio de correr/pular/dash. Todo `actions.attack` ganhou
  `staminaCost: 15` (mesmo valor em toda espécie hoje, sem balanceamento
  de verdade ainda).
- **`playerActionSystem.js`/`partySummonSystem.js` não interferem**: uma
  `SummonedCreature` casa nas queries dos dois (tem `HeldItem`/`AimAnchor`
  pra caber na de `playerActionSystem`, mas nunca `Party`, então nunca casa
  na de `partySummonSystem`) — `heldItem.itemId` nunca é setado numa
  criatura, então o branch de `primary` de `playerActionSystem.js` sempre
  cai no `else { return }` dele antes de tocar `ActionState`, sobrando pra
  `creatureAttackSystem.js` (registrado logo depois) processar o clique de
  verdade.

## Direção: câmera, não `Rotation.y` (pedido do usuário, depois da v1)

`core/aim.js` ganhou `resolveAimDirection(world, originPos,
excludeColliderHandle)` — mesmo raio de `computeAimRay` (que
`resolveAimPoint` já usa pro arremesso/summon do treinador, já respeitando
a inclinação/pitch, não só o giro horizontal), mas SEM o raycast contra o
mundo nem `aimRange` (config exclusiva de `actions.throw`, não faz sentido
pra quem chama isto) — só a direção pura, 3D, unitária. Generalizada (não
amarrada ao treinador, ao contrário de `resolveAimPoint`) porque o
mecanismo agora serve tanto pro arremesso do treinador (indiretamente, via
`computeAimRay`) quanto pro ataque de qualquer criatura.

`creatureAttackSystem.js` resolve essa direção UMA VEZ no disparo (`action.
dirX/dirY/dirZ`, travados — mesmo motivo de sempre, `beginSummon`/
`resolveThrowLaunch`: a câmera é livre pra girar durante o gesto, então
recalcular no `effectAt` poderia divergir de pra onde a criatura acabou de
virar) e usa essa MESMA direção pras duas coisas:

- **Corpo** (`Rotation.y`) — só o componente horizontal (`atan2(dirX,
  dirZ)`), mesma convenção de sempre (o corpo não inclina pra cima/baixo,
  só gira em Y).
- **Centro da área efetiva** — 3D COMPLETO (`pos + direction * range`,
  incluindo a altura/`dirY`) a partir da altura aproximada do meio do
  corpo (`CharacterController.capsuleRadius + capsuleHalfHeight`) — olhar
  pra cima/baixo desloca a área efetiva pra cima/baixo também, não só a
  distância horizontal. **Menos que algo esteja no caminho antes disso —
  ver "Respeita o trajeto" logo abaixo.**

`PhysicsBody` entrou na query só pra propagar `colliderHandle` (evita a
correção de colisão da câmera se autoacertar contra a própria cápsula da
criatura, mesmo raciocínio de `resolveAimPoint`/`beginSummon`) — sem
física carregada (testes isolados), isso não muda nada (`castRay` sempre
`null`).

### Respeita o trajeto, não só o destino (`resolveAttackImpactPoint`, 5ª rodada)

Pedido explícito do usuário: com um `range` grande (ex.: simulando o
alcance de um golpe tipo chicote), um obstáculo no meio do caminho não
podia ser ignorado — do jeito que estava, o ponto de impacto era sempre
`origin + direction * range` em linha reta, "teleportando" o efeito
através de parede/objeto no meio.

`resolveAttackImpactPoint(origin, direction, range, excludeColliderHandle)`
(nova, exportada de `creatureAttackSystem.js`) resolve isso com um
`castRay` (`core/physics/raycast.js`, mesma função que `resolveAimPoint`/
`summonBallSystem.js` já usam) do `origin` na `direction`, até `range`
metros: sem nada no caminho, cai no ponto cheio de sempre; com algo no
meio, para no ponto de impacto — mesmo raciocínio de `resolveAimPoint`,
só que sem `aimRange`/lógica exclusiva de treinador (`range` já vem
resolvido por quem chama, serve pra qualquer entidade).

`creatureAttackSystem.js` chama isso no `effectAt`, com `origin` na altura
do meio do corpo (mesma conta de antes) e `excludeColliderHandle` da
PRÓPRIA criatura (não se autoacerta). Sem física carregada, `castRay`
sempre `null` — cai no ponto cheio, mesmo fallback gracioso de sempre.

`AttackRangeDebugView.jsx` reusa a MESMA função (importada diretamente de
`creatureAttackSystem.js` — `tools/` pode importar de qualquer camada,
ver docs/rules/README.md) pro guia de debug mostrar onde o golpe vai
acertar DE VERDADE, já considerando obstáculo no caminho — sem isso, o
guia mostraria um destino desatualizado (atravessando a mesma parede que
o ataque de verdade vai respeitar).

### Orientação do VFX: 3D completo + ajuste fino configurável (7ª rodada)

Pedido explícito do usuário: "o Scratch fica limitado a uma orientação
horizontal [`Rotation.y` só]... quero que a orientação seja configurável,
permitindo rotacionar o efeito livremente conforme necessário". Duas
mudanças, sempre em `creatureAttackSystem.js`:

- **`resolveEffectRotation(direction, rotationOffset)`** (nova, exportada
  — mesmo motivo de `resolveAttackImpactPoint`, testável como função pura)
  calcula `yaw`/`pitch` a partir do vetor 3D COMPLETO da direção do golpe
  (`atan2` pros dois — não `asin`, por robustez numérica perto de
  `direction.y` = ±1), diferente do CORPO (`rot.y`, que continua só
  horizontal de propósito — a criatura não inclina pra cima/baixo ao
  andar/atacar). Antes, o VFX usava a mesma rotação do corpo
  (`Rotation({ y: rot.y })`) — um golpe mirado pra cima nascia "deitado",
  sem refletir a inclinação de verdade.
- **`attack.visual.rotationOffset`** (`{ x, y, z }`, GRAUS — mesma
  convenção de `vfx.tailFire.rotation`) é somado por cima do
  `yaw`/`pitch` calculado. Existe porque a malha de rip convertida não
  tem "forward" garantidamente alinhado com a convenção do jogo (`forward
  = (sin(yaw), cos(yaw))` em pitch 0) — em vez de adivinhar/fixar isso no
  código, o campo deixa corrigir por config, olhando o resultado em jogo.
  É exatamente o mecanismo de "rotacionar livremente" pedido — qualquer
  ângulo em qualquer eixo, sem tocar em nenhum system.

`AttackEffect` nasce com `Rotation(resolveEffectRotation(direction,
ATTACK.visual.rotationOffset))` em vez de `Rotation({ y: rot.y })` —
`syncTransformSystem` aplica isso no grupo pai (`AttackEffectView.jsx`) de
graça, os componentes de efeito (`ScratchAttackEffect.jsx`/
`PunchAttackEffect.jsx`) continuam sem saber nada de direção/câmera, só
escala/opacidade/revelação locais.

## Efeito visual: registro por grupo (`AttackEffect.effectGroup`)

Pedido do usuário, depois de ver a v1 (uma explosão de partículas fixa,
igual pra qualquer criatura): "muitas criaturas vão compartilhar o ataque
básico de arranhar, outras vão ser específicas como um chicote... pode
fazer um genérico pra mim por hora, mas permitir que eu possa configurar
isso". Mesmo princípio de `footstepGroup`/`dashGroup`
(`core/data/audio/*.js`) — a espécie só carrega um ID (`actions.attack.
effectGroup`, texto puro, sem saber nada de Three/React), e a ponte
id→visual mora inteira na VIEW:

- **`AttackEffect`** (`core/traits/components/attackEffect.js`) — mesmo
  formato trivial de `ConsumeEffect`: `Position`/`Rotation`
  cuidam de onde aparece, `lifetime` conta até desaparecer sozinho, sem
  movimento/gravidade. `radius` (de `actions.attack.radius`) dimensiona o
  efeito; `effectGroup` (novo, de `actions.attack.effectGroup`, com
  fallback pra `DEFAULT_ATTACK_EFFECT_GROUP = 'scratch'` se a espécie não
  configurar) diz QUAL visual usar. Ambos congelados no spawn.
- **`view/scene/attackEffects/registry.js`** (novo) —
  `resolveAttackEffectComponent(effectGroup)`, mapa id→componente React,
  mesmo princípio de `SPECIES_REGISTRY`. Grupo desconhecido cai no
  DEFAULT (mesmo espírito gracioso de sempre), nunca deixa de renderizar
  nada.
- **`view/scene/attackEffects/ScratchAttackEffect.jsx`** — o grupo usado
  por toda espécie hoje. Passou por três versões: `Sparkles` (drei) na
  v1; um IMPACTO procedural (flash + onda de choque billboard +
  estilhaços) na 3ª rodada, pedido do usuário ("ao invés de partículas,
  consegue fazer uma simulação de punch?"); e, na 6ª rodada, a malha de
  rip de verdade `EffCommonScratch` — ver seção "Efeitos de verdade"
  abaixo pro estado atual.
  Um `'whip'` (chicote) ou qualquer golpe visualmente distinto entra como
  um componente novo + uma linha no registry —
  `AttackEffectView.jsx`/`creatureAttackSystem.js` não mudam nada.
- **`AttackEffectView.jsx`** virou só o WRAPPER (registro de ref +
  posição, `<group>`) — delega o visual de verdade pro componente
  resolvido pelo registry.

Nasce no CENTRO da área efetiva calculada acima (não na criatura).
`attackEffectSystem.js` (idêntico a `consumeEffectSystem.js`) conta o
`lifetime` pra baixo e destrói ao zerar — não muda com esta rodada.

Depois da 7ª rodada (reorganização da config, ver seção própria abaixo),
`effectGroup` deixou de ser inline em `sounds`/`actions.attack` da
espécie — mora dentro da definição de ataque
(`core/data/attacks/<id>/index.js`, campo `visual.effectGroup`), e a
espécie só referencia o ataque por id (`attacks.primary`). `fox`/`wolf`/
`004-charmander` usam `'scratch'`; `001-bulbasaur`/`007-squirtle` usam
`'punch'` (o padrão pra espécie nova, desde a 6ª rodada).

## Efeitos de verdade: rip convertido (6ª rodada)

O usuário disponibilizou `.exemple/Effects/` — um pacote de efeitos de
combate "rippado" de um jogo Pokémon 3DS (mesma família de rip já usada
pros modelos/texturas de espécie, `pm0001_00_...`): 30 malhas próprias
(`.obj`+`.mtl`+`.dae`, a mesma malha em dois formatos) + texturas, mais
duas pastas de partículas 2D (`Particles/`, `Adventure Particles/`, não
usadas ainda). Depois de examinar o pacote (ver categorização completa no
histórico da conversa — os relevantes pra combate corpo-a-corpo:
`EffCommonScratch`, `EffCommonHitNormalA`/`HitNormalShockWave`,
`EffCommonHitCut`/`HitCutShockWave`, `EffCommonMerikomi`,
`EffCommonHitFire`/`HitElec` — o resto é rastro de movimento/pouso, fora
de escopo), o usuário escolheu `EffCommonScratch` pro grupo `'scratch'`
existente e `EffCommonHitNormalA`+`EffCommonHitNormalShockWave` pra um
grupo `'punch'` novo.

**Pipeline de conversão** (`.obj`/`.mtl`/`.png` → `.glb`) — o projeto só
aceita glTF/glb (docs/rules/README.md, seção 5.2), então cada rip passou
por dois passos de CLI (`npx`, sem dependência nova no `package.json` —
rodados uma vez, o resultado é o `.glb` commitado):

```
npx obj2gltf -i EffCommonScratch.obj -o public/assets/effects/scratch.glb
npx gltf-pipeline -i scratch.glb -o scratch.glb -d   # comprime com Draco
```

`obj2gltf` funde a malha + o material (`.mtl`) + a textura referenciada
(`map_Kd`) num único `.glb` autocontido (textura embutida no chunk `BIN`,
não um arquivo `.png` separado); `gltf-pipeline -d` aplica Draco por cima
— mesmo "comprimido (draco ou meshopt)" que a regra já pede pros modelos
de espécie. `useGLTF` (drei) já decodifica Draco sozinho (decoder via
CDN, nenhuma configuração adicional no projeto) — os `.glb` novos
carregam pelo MESMO hook que já carrega modelo de espécie, sem infra
nova. Três arquivos gerados:

```
public/assets/effects/scratch.glb
public/assets/effects/hit-normal.glb
public/assets/effects/hit-normal-shockwave.glb
```

**Por que reconstruir o material** (`useAdditiveEffectMesh.js`, novo,
compartilhado pelos dois componentes — segundo consumidor da mesma
necessidade, extraído em vez de duplicar): a textura de cada rip é um
mapa de BRILHO em fundo preto (pensada pra somar luz num shader aditivo,
técnica clássica de "hit effect" de jogo de luta/RPG — ver
`eff_cmn_scrach.png`, uma risca branca sobre preto), não uma textura de
cor comum. O material PBR que `obj2gltf` gera por padrão é opaco (o
`.mtl` de origem não tem noção de "aditivo", esse conceito não existe no
formato OBJ) — sem reconstruir, a malha apareceria como um retalho cinza
sólido em vez de um brilho. `useAdditiveEffectMesh(path, color)` clona a
cena (`useMemo`, por INSTÂNCIA — cada ataque simultâneo anima sua própria
opacidade, sem compartilhar estado via cache do `useGLTF`) e troca o
material de cada mesh por um `MeshBasicMaterial` (`map` reaproveitado do
material original, `transparent`, `depthWrite: false`,
`blending: THREE.AdditiveBlending`) — mesma técnica que
`flameParticles.js` já usa pro fogo.

**Escala**: cada rip usa uma unidade arbitrária própria (a malha do
`EffCommonScratch` mede ~22 unidades no eixo mais comprido; a do
`EffCommonHitNormalA`, ~104 — nem entre rips do MESMO pacote a escala
bate) — cada componente tem sua própria constante `*_SCALE`, multiplicada
por `AttackEffect.radius` (mesmo espírito de `model.scale` por espécie,
`core/data/species/*/index.js`). São valores de PARTIDA, comentados como
tal — ajustar olhando o resultado em jogo é esperado, mesmo processo que
todo `model.scale`/`vfx.tailFire` já passou (o usuário já ajustou
`SCRATCH_SCALE`/`HIT_SCALE` ao vivo depois do bug abaixo ser corrigido).
**Orientação** deixou de ser só `Rotation.y` na 7ª rodada — ver seção
"Orientação do VFX: 3D completo + ajuste fino configurável" acima.

**`PunchAttackEffect.jsx`** (grupo `'punch'`) combina as duas malhas
(`EffCommonHitNormalA` — o flash — e `EffCommonHitNormalShockWave` — a
onda de choque), cada uma com sua curva de escala/fade própria (o flash
cresce pouco e esvai rápido; a onda se expande bem mais). Virou o padrão
de toda espécie nova (`attacks.primary: 'punch'`, ver "Reorganização da
config" abaixo) — trocar por `'scratch'` é só mudar a referência.

**Bug real, relatado jogando**: nenhuma das duas malhas aparecia — o
usuário testou aumentando `SCRATCH_SCALE`/`HIT_SCALE` pra `100` de
propósito, só pra descartar escala como causa, e mesmo assim nada. Sem
navegador neste sandbox pra reproduzir visualmente, a malha foi
inspecionada por fora (extraindo o JSON do `.glb` gerado e validando
geometria/UV/material com o `GLTFLoader` em Node) — geometria e material
batiam certinho, então a causa não podia ser aí. Raiz encontrada: o
`.mtl` de origem marca a malha como `doubleSided: false`, e o material
reconstruído (`useAdditiveEffectMesh.js`) não definia `side` nenhum — Three.js
usa `FrontSide` por padrão, e a malha reorientada pela direção do golpe
(`Rotation.y`, ver acima) podia facilmente acabar de costas pra câmera,
sumindo por completo mesmo com tudo mais correto (culling de face, não
tamanho/posição). `side: THREE.DoubleSide` no material resolve — um
efeito fino sem espessura de verdade não tem "lado de trás" que precise
ficar oculto, desenhar dos dois lados não custa nada aqui.
`SCRATCH_SCALE`/`HIT_SCALE` revertidos pros valores de partida depois do
teste de descarte.

### Revelação progressiva do `'scratch'` (7ª rodada)

Pedido explícito do usuário: "não quero que o efeito visual do Scratch
apareça inteiro de uma vez... deve ser revelado progressivamente,
mostrando apenas uma porcentagem do efeito por vez, para dar a sensação
de que o arranhão começa em um ponto e termina em outro... controlável".
`'punch'` (flash + onda de choque) continua aparecendo inteiro — não faz
sentido revelar um estouro instantâneo aos poucos, só um TRAÇO como o
arranhão.

Implementado como um shader "wipe" via `onBeforeCompile` (técnica padrão
do Three.js pra ajustar um shader embutido do material sem reescrevê-lo
inteiro), em `useAdditiveEffectMesh.js` (`options.reveal`, novo parâmetro
— `false` por padrão, só `ScratchAttackEffect.jsx` liga):

- Injeta `uniform float uProgress;` e `if (vUv.x > uProgress) discard;`
  logo depois de `#include <map_fragment>` no fragment shader do
  `MeshBasicMaterial` — mesmo ponto onde `alphaTest` já descartaria
  fragmentos (conferido no `meshbasic.glsl.js` do Three.js instalado,
  pra não adivinhar nome de chunk errado). `vUv` já existe de graça
  (populada sempre que o material tem `map`, que é sempre o caso aqui) —
  não precisou declarar variável nova nenhuma.
- Usa o eixo **U da textura**, não a posição local do vértice — a imagem
  de origem (`eff_cmn_scrach.png`) já é um traço desenhado ao longo do
  U, então revelar por U é a MESMA revelação que o jogo original
  provavelmente fazia (só que lá provavelmente animando a UV, aqui via
  discard). Evita depender de suposição sobre orientação/bounding box da
  malha.
- `revealUniforms` (um `{ value: number }` por material da malha,
  devolvido por `useAdditiveEffectMesh`) é o que `ScratchAttackEffect.jsx`
  MUTA em `useFrame` — mutar `.value` direto (não recriar o objeto) é o
  jeito correto de atualizar um uniform por frame sem forçar
  recompilação do shader.

**"Controlável"** — pedido explícito do usuário — significa que a
DURAÇÃO da revelação é config, não uma constante hardcoded acoplada ao
fade: `attack.visual.revealDuration` (segundos, `core/data/attacks/
scratch/index.js`, hoje `0.2`) flui `core/data/attacks/` →
`creatureAttackSystem.js` → `AttackEffect.revealDuration` (campo novo no
trait) → `AttackEffectView.jsx` (prop) → `ScratchAttackEffect.jsx`
(`revealProgress = min(elapsedRef / revealDuration, 1)`, relógio PRÓPRIO,
independente do relógio do fade/`IMPACT_DURATION`). `0` (ou omitido) =
revelado por inteiro desde o primeiro frame, sem divisão por zero — é o
que `PunchAttackEffect.jsx` recebe (ele nem lê o prop, mas o valor
default cobre qualquer grupo que não use reveal).

Sem teste automatizado pro shader em si (Three.js/GPU, mesmo precedente
de sempre) — a PARTE testável (o valor de `revealDuration` fluindo
corretamente do ataque resolvido até o trait `AttackEffect`) está coberta
em `creatureAttackSystem.test.js`.

### Correção: revelação não funcionava — `vUv` nunca existiu de graça (8ª rodada)

Usuário reportou: "Revelação progressiva do Scratch não funcionou". A
premissa do parágrafo acima ("`vUv` já existe de graça, populada sempre
que o material tem `map`") estava ERRADA — e é exatamente por isso que o
`discard` nunca cortava nada, o traço sempre aparecia inteiro desde o
frame 0.

Investigado lendo o código-fonte do Three.js instalado (sem navegador no
sandbox pra abrir o DevTools e inspecionar o shader compilado de
verdade):

- `vUv` só é DECLARADA (`varying vec2 vUv`) sob
  `#if defined(USE_UV) || defined(USE_ANISOTROPY)`
  (`node_modules/three/src/renderers/shaders/ShaderChunk/
  uv_pars_fragment.glsl.js`).
- Um `MeshBasicMaterial` que só define `.map` (o caso de
  `useAdditiveEffectMesh.js`) ativa `USE_MAP`, não `USE_UV` — conferido
  em `WebGLProgram.js`, onde cada define do programa é decidido
  independentemente por qual propriedade do material está setada. Sem
  `USE_UV`/`USE_ANISOTROPY`, a varying `vUv` nunca é declarada no
  fragment shader.
- Quem de fato existe nesse caso é `vMapUv` — a varying dedicada à UV do
  `map`, declarada sempre que `USE_MAP` está ativo (mesmo arquivo,
  branch separada). O trecho injetado por `onBeforeCompile` referenciava
  uma variável inexistente (`vUv.x`), o que ou falha silenciosamente ou
  nunca teve o valor esperado — de qualquer forma, o `discard` nunca
  cortava o triângulo certo.

Correção em `useAdditiveEffectMesh.js`: troca `vUv.x` por `vMapUv.x` na
condição de discard. Mesma lógica de revelação por eixo U, só aponta pra
varying certa. **Não verificado visualmente** (mesma limitação de sempre
nesta sessão — sandbox sem Chromium funcional); pendente de teste manual
do usuário rodando `npm run dev`.

### Correção: efeito do `'scratch'` atravessando parede (8ª rodada)

Usuário perguntou se o mecanismo de "respeita o trajeto"
(`resolveAttackImpactPoint`, ver seção acima) tinha sido feito pra todo
ataque ou só pro `'punch'` — a resposta, olhando o código, é que SIM, é
genérico (`creatureAttackSystem.js` chama a mesma função pra qualquer
`ATTACK`, sem nenhum branch por `effectGroup`/id). Confirmado isso, o
usuário relatou o sintoma de verdade: "o efeito do Scratch está
atravessando o muro".

Investigado inspecionando o `.glb` gerado (`scratch.glb`, accessor de
posição da malha — sem navegador, mesma técnica de sempre nesta sessão):
o eixo Z da malha `EffCommonScratch` vai de `-0.9` a `+3.68` — a MAIORIA
da malha em Z positivo. Pela mesma convenção de `resolveEffectRotation`
(eixo local +Z = direção do golpe, depois de aplicado `Rotation`, mesmo
princípio de `rot.y` do corpo), e como o `AttackEffect` nasce exatamente
no `impactPoint` (o ponto já travado pelo raycast, na superfície do
obstáculo), qualquer vértice da malha em Z positivo cai ALÉM desse
ponto — ou seja, dentro/atravessando a parede que o raycast já tinha
parado antes. O mecanismo de raycast nunca teve o bug (`'punch'` não
sofre disso porque suas duas malhas são radialmente simétricas ao redor
do próprio centro) — o problema era só a MALHA do `'scratch'` não nascer
"puxada pra trás" da própria origem.

Correção: `useAdditiveEffectMesh.js` ganhou `options.alignForwardTip`
(`false` por padrão, só `ScratchAttackEffect.jsx` liga) — translada a
GEOMETRIA (não `object.position`, que não escalaria junto com
`object.scale.setScalar(...)` mudando todo frame) de modo que a ponta
mais distante (`boundingBox.max.z`) fique em Z=0; o resto do traço passa
a se estender só em Z negativo, sempre PRA TRÁS do ponto de impacto.
Aplicado uma única vez por geometria (`userData.forwardTipAligned`) —
como `object = scene.clone()` não clona a geometria (só a hierarquia,
comportamento padrão do `Object3D.clone()` do Three.js), sem essa flag
cada instância nova acumularia outra translação por cima da anterior.
**Não verificado visualmente** — mesma limitação de sempre; pendente de
teste manual do usuário.

## Som: mecanismo (`attackAudioSystem.js`), 4ª rodada

Pedido do usuário: "preciso que o ataque tenha som também, faça o
mecanismo pra mim e me diga onde deixar o áudio". Mesmo mecanismo,
ponta a ponta, que passo/dash/pulo/invocar/recolher já usam — nenhuma
peça nova de arquitetura, só mais uma instância do padrão já existente:

- **`AttackPulse`** (`core/traits/components/attackEffect.js`, novo) —
  tag de UM TICK, mesmo princípio de `Jumped`/`SummonPulse`/`RecallPulse`.
  `creatureAttackSystem.js` adiciona na CRIATURA (não no `AttackEffect`
  spawnado) no MESMO instante `effectAt` em que o VFX nasce — o som tem
  que coincidir com o impacto, não com o início do gesto.
- **`core/data/audio/attackSound.js`** (novo) — `createActionSoundResolver`
  (mesma fábrica de `dashSound.js`/`jumpSound.js`, extraída na v0.0.19):
  grupo compartilhado (`sounds.attackGroup`, ex.: `'punch'`) OU som
  individual (`sounds.attack: { clips, volume?, refDistance? }`), o
  individual vencendo se os dois existirem. **Grupo de SOM independente**
  do grupo de VISUAL (`effectGroup`) — duas espécies podem compartilhar o
  mesmo som com visuais diferentes, ou vice-versa; registries separados
  de propósito, mesma filosofia de `footstepGroup` vs. o resto.
- **`view/registry/attackAudioRegistry.js`** (novo) — `createSimpleAudioRegistry()`,
  idêntico a `jumpAudioRegistry.js`/`summonAudioRegistry.js` (só
  `audio`/`buffers`, sem estado extra — o pulso já dispensa rastrear
  borda como `dashAudioRegistry.js` precisa).
- **`view/systems/attackAudioSystem.js`** (novo) — consome `AttackPulse`
  (remove a tag, toca uma variação aleatória via `pickRandomVariation`),
  idêntico a `jumpAudioSystem.js`/`summonAudioSystem.js`. Fase
  presentation, registrado perto de `dashAudioSystem`/`jumpAudioSystem`/
  `summonAudioSystem`/`recallAudioSystem` (mesma família, sem
  dependência real de ordem).
- **`view/hooks/useAnimatedModel.js`** — ganhou o `useEffect` de setup do
  nó de áudio posicional (`setupPositionalActionSound`, já existente,
  reaproveitado — não duplicado), idêntico ao bloco de summon/recall/
  jump/dash, só trocando `resolveAttackSound`/`registerAttackAudio`. Como
  o hook já recebe `species` (a de QUEM está renderizando — treinador OU
  criatura), a fiação já funciona pra qualquer entidade sem código
  condicional extra: o treinador simplesmente nunca resolve nada (sem
  `sounds.attack`/`attackGroup` no `bot/index.js`), mesmo fallback
  gracioso de sempre.
- Toda espécie `kind: 'pokemon'` hoje existente ganhou
  `sounds.attackGroup: 'punch'`.

## Onde colocar o áudio

`public/assets/audio/attack/punch/`, dois (ou mais) arquivos de
variação — toca uma ao acaso a cada impacto (`pickRandomVariation`), mesma
convenção de `public/assets/audio/dash/default/`/`public/assets/audio/
jump/default/`:

```
public/assets/audio/attack/punch/attack-01.wav
public/assets/audio/attack/punch/attack-02.wav
```

Os nomes/quantidade exatos não importam (`ATTACK_SOUND_GROUPS.punch.
clips`, em `core/data/audio/attackSound.js`, é só um array de paths) —
ajusta a lista lá se os arquivos finais tiverem nomes diferentes.
`volume`/`refDistance` do grupo `'punch'` também ficam nesse mesmo
arquivo, ajustáveis sem tocar em código de system.

O usuário já subiu os dois arquivos de verdade (`attack-01.wav`/
`attack-02.wav`) e renomeou o grupo de `'default'` pra `'punch'` — em
toda espécie (`sounds.attackGroup`) e em `ATTACK_SOUND_GROUPS`/
`volume`/`refDistance` (`core/data/audio/attackSound.js`).

## Debug: alcance + área efetiva (`AttackRangeDebugView.jsx`)

Pedido explícito do usuário: "identificar claramente o alcance e a área
efetiva do ataque" no modo debug (F2). Diferente do VFX (que só aparece no
instante do ataque), este guia fica SEMPRE visível enquanto uma
`SummonedCreature` com `actions.attack` estiver no controle — o objetivo é
mostrar ANTES de clicar onde o golpe vai acertar, não só depois.

Dois desenhos:

- **Anel plano** ao redor da criatura, raio = `attack.range` — o ALCANCE
  (distância até o centro da área efetiva). Simétrico, não depende de
  direção nenhuma.
- **Icosaedro wireframe**, raio = `attack.radius` — a ÁREA EFETIVA,
  centrada exatamente onde o `AttackEffect` de verdade nasceria AGORA —
  mesma fórmula de `creatureAttackSystem.js` (`resolveAttackImpactPoint`,
  ver seção "Respeita o trajeto" acima), incluindo altura/`dirY` E o
  raycast contra obstáculo no caminho.

**Acompanha a câmera AO VIVO** (recalculada todo frame via
`resolveAimDirection`/`resolveAttackImpactPoint`, NÃO travada) —
atualizado junto com a mudança de direção acima: como o ataque de
verdade agora mira pela câmera (não mais `Rotation.y`, que só muda no
instante do disparo), o guia precisa recalcular a cada frame pra
continuar mostrando "onde vai acertar se eu clicar AGORA", incluindo
parar num obstáculo no caminho — travar na direção do corpo mostraria a
área do ÚLTIMO ataque, desatualizada assim que o jogador olha pra outro
lugar. Isso eliminou o grupo rotacionado por `Rotation.y` que a v1 usava
— a esfera agora é posicionada direto por um vetor 3D
(`impactPoint - pos`), sem precisar girar nada.

**Geometria de baixo detalhe, de propósito** (5ª rodada — o usuário
perguntou se a esfera de 16×12 segmentos da v1 onerava a performance):
não onerava de verdade — a geometria nunca era RECRIADA por frame, só
escalada/reposicionada (`mesh.scale.setScalar`/`position.set`, operações
baratas) — mas sem motivo nenhum pra ter mais detalhe que um indicador de
debug precisa. Trocada por um `icosahedronGeometry` de detalhe 0 (12
vértices, 20 triângulos, contra ~380 da esfera UV anterior), mesmo
raciocínio de `ENVELOPE_DETAIL: 1` em `RecallBeamView.jsx` (forma
abstrata/baixo-poli o bastante pra ler como "uma área", sem precisar ser
lisa). O anel também caiu de 64 pra 24 segmentos.

Geometrias UNITÁRIAS (raio 1) escaladas por `range`/`radius` a cada frame
(`mesh.scale.setScalar`), em vez de recriadas — não precisam mudar de
FORMA, só de tamanho, então não há necessidade da geometria imperativa que
`RecallBeamView.jsx` usa pro relâmpago/blob (que mudam de forma a cada
refresh). `useFrame` (mesma exceção documentada de sempre — só redesenha
debug, nunca mexe em estado de jogo) lê `world.queryFirst` direto, mesmo
padrão de `PathfindingDebugView.jsx`. Sem criatura com ataque configurado
no controle (treinador, ou criatura sem `actions.attack`), o grupo inteiro
fica `visible = false`.

Montado em `src/app/(auth)/page.js`, ao lado de `PhysicsDebugView`/
`PathfindingDebugView`, mesmo toggle `F2`.

## Animação: arquitetura pronta, sem clipe ainda

`core/data/animationStates.js` ganhou a entrada `'attack'`
(`oneShot: true, when: ctx => ctx.action === 'attack'`), mesmo mecanismo já
usado pro `'recall'` — `ActionState.current === 'attack'` já resolve o id
de animação certo; sem `clips.attack` autorado em nenhuma espécie ainda
(animação por criatura é trabalho separado, em paralelo a esta feature),
`animationSystem.js` cai no fallback de "clipe ausente" (pose de descanso),
exatamente como já acontece com `'recall'`. Assim que o clipe existir
(`core/data/species/<id>/clips/attack.json`), basta importar e listar em
`clips: { attack: ATTACK_CLIP }` na espécie — zero mudança de mecanismo.

## `resolveActionSlots('pokemon')` deixa de ser só documentação

`core/data/actionSlots.js` — `primary` agora resolve de verdade pra
`'attack'` (antes voltava `null` pra `'pokemon'`, comentário dizia "sem
conteúdo de golpe definido ainda"). `secondary1-3` continuam `null` — Q/E/R
seguem reservados pras skills ativas futuras (docs/features/018-troca-de-
controle-treinador-criatura.md), sem conteúdo pra resolver ainda.

## Reorganização da config: `core/data/attacks/` (7ª rodada)

Pedido explícito do usuário: "as configurações estão muito espalhadas
pelo código, então quero ter um único lugar responsável por parametrizar
tudo relacionado a cada ataque: efeito visual, áudio, modelo, custos,
alcance, cooldown e, futuramente, dano e outros atributos. Na
configuração da criatura, a ideia deve ser apenas referenciar quais
ataques ela possui... [com] override específico por criatura sem
precisar duplicar toda a configuração do ataque". Antes desta rodada, um
ataque era espalhado em DOIS lugares por espécie (`actions.attack` +
`sounds.attackGroup`), cada uma das 5 espécies com sua própria cópia
quase idêntica dos mesmos números.

**`core/data/attacks/`** (novo) — mesmo princípio de `core/data/species/`/
`core/data/items/`: um REGISTRO de recursos reutilizáveis e nomeados, não
mais dado inline por espécie.

- **`core/data/attacks/<id>/index.js`** (`scratch/`, `punch/`, hoje) — a
  definição BASE de um ataque, um arquivo só: `duration`/`effectAt`/
  `range`/`radius`/`staminaCost`/`cooldown` (mecanismo,
  `creatureAttackSystem.js`), `visual` (`effectGroup`/
  `effectVisualDuration`/`revealDuration`/`rotationOffset` — view),
  `audio` (`group`/`clips` — `core/data/audio/attackSound.js`),
  `animation` (`clipKey` — ver "Animação" abaixo), `damage` (`null`,
  placeholder pro sistema de batalha).
- **`core/data/attacks/index.js`** — `getAttack`/`listAttacks` (mesma
  assinatura de `getSpecies`/`getItem`) + **`resolveCreatureAttack(reference)`**,
  a peça nova de verdade: aceita uma STRING (`'scratch'`, usa a base sem
  alteração) ou `{ id, overrides }` (mescla `overrides` por cima da base
  — CAMPO A CAMPO dentro de cada seção `visual`/`audio`/`animation`, não
  substituição inteira: sobrescrever só `visual.rotationOffset` não apaga
  `visual.effectGroup`/`.revealDuration` da base). Sem referência, ou id
  desconhecido, devolve `null` — mesmo fallback gracioso de sempre.
- **`core/data/attacks/_template/index.js`** — molde documentado, mesmo
  padrão de `core/data/species/_template/`, incluindo a seção "Override
  por criatura" explicando as duas formas de referência.

**Espécie só referencia, não duplica**: `core/data/species/<id>/index.js`
ganhou `attacks: { primary: <referência> }` (`primary` = botão esquerdo,
mesma nomenclatura de `resolveActionSlots`/`core/data/actionSlots.js`) no
lugar de `actions.attack`/`sounds.attackGroup`. `creatureAttackSystem.js`,
`AttackRangeDebugView.jsx` e `core/data/audio/attackSound.js` (o
`resolveAttackSound(species)` mudou por dentro, mas a ASSINATURA — ainda
recebe `species` — não mudou, então `useAnimatedModel.js` nem precisou
ser tocado nesse ponto) chamam `resolveCreatureAttack(species.attacks
?.primary)` pra obter a definição de verdade.

**Cooldown virou um campo de verdade, não só documentado**: pedido
explícito do usuário listou "cooldown" junto de custo/alcance (não em
"futuramente", ao contrário de dano) — `ActionState` ganhou
`cooldownRemaining` (decrementado TODO tick,
independente de qual ação está em andamento — corre em paralelo);
`creatureAttackSystem.js` trava em `attack.cooldown` no disparo e recusa
disparar de novo enquanto `> 0`, mesmo com stamina cheia. `cooldown: 0`
em `'scratch'`/`'punch'` hoje — no-op, só documentando que o mecanismo já
existe pra quando algum ataque precisar de um valor real.

**Escala do VFX virou campo de config (8ª rodada)**: usuário observou,
depois de ver `visual.scale` em uso indireto pelo `radius`: "a escala dos
efeitos deveria estar na config do ataque, pois uma criatura grande vai
ter o efeito maior do que o de uma criatura pequena, mesmo os 2 usando o
mesmo efeito". Antes, o tamanho final do VFX vinha só de `radius`
(alcance/área efetiva, um número de GAMEPLAY) multiplicado por uma
constante fixa dentro de cada componente de view (`SCRATCH_SCALE`/
`HIT_SCALE`/`SHOCKWAVE_SCALE`) — não dava pra uma criatura grande ter o
mesmo golpe visualmente maior sem alterar `radius` (que também mudaria a
área efetiva de verdade, um acoplamento indesejado entre dois conceitos
diferentes).

- `attack.visual.scale` (novo campo, padrão `1`) — multiplicador de
  TAMANHO do efeito, independente de `radius`. Flui `core/data/attacks/`
  → `creatureAttackSystem.js` (`AttackEffect.visualScale`, campo novo no
  trait) → `AttackEffectView.jsx` (prop `scale`) → cada componente de
  view (`ScratchAttackEffect.jsx`/`PunchAttackEffect.jsx`).
- As constantes antigas (`SCRATCH_SCALE`/`HIT_SCALE`/`SHOCKWAVE_SCALE`)
  foram renomeadas pra `*_BASE_SCALE` e voltaram a ser SÓ normalização
  técnica — convertem a unidade arbitrária de cada malha `.obj` ripada
  (dezenas de unidades no eixo mais longo) pra algo perto de `1`, nunca o
  botão de ajuste por criatura. `object.scale.setScalar(radius *
  BASE_SCALE * scale * curvaDeCrescimento)` em ambos os componentes —
  `PunchAttackEffect.jsx` aplica o mesmo `scale` nas duas malhas (flash +
  onda de choque) juntas, preservando a proporção entre elas.
- Uma criatura maior sobrescreve só `visual.scale` (ex.:
  `{ id: 'punch', overrides: { visual: { scale: 1.4 } } }`) sem duplicar
  o resto da definição do ataque — mesmo mecanismo de override por seção
  de `resolveCreatureAttack` que já existia pra `revealDuration`/
  `rotationOffset`. Nenhuma espécie usa isso ainda (todas as 5 continuam
  com `scale: 1` implícito) — fica disponível pra quando o usuário for
  balancear tamanhos.
- Coberto em `creatureAttackSystem.test.js` (assert de `visualScale`
  fluindo de `ATTACK.visual.scale` até o trait, mesmo padrão de
  `effectGroup`/`revealDuration`); sem teste pro resultado visual em si
  (Three.js/GPU, mesmo precedente de sempre).

**"Modelo"** (mencionado pelo usuário) virou `animation.clipKey` — qual
chave em `species.clips` este ataque tocaria. Fica registrado como
INTENÇÃO, mas `core/data/animationStates.js` ainda resolve sempre pelo id
fixo `'attack'` (não por ataque específico) — rewiring pra clip
DINÂMICO por ataque é trabalho futuro (só importa quando dois ataques na
MESMA espécie precisarem de clipes diferentes, o que não acontece ainda,
já que só existe o slot `primary`). Caminho pra fazer isso quando for a
vez: `ActionState` ganhar um campo pro clip key ativo, setado no disparo,
e `animationStateSystem.js` usar ISSO em vez do id `'attack'` fixo — sem
mudar o resto do mecanismo.

## Habilidades das 3 espécies iniciais (9ª rodada)

Pedido do usuário: "seguindo o mesmo padrão já definido, pode fazer as
habilidades agora? Procura um efeito na pasta de Effects e me sugere as
habilidades, se puder fazer uma para cada um dos 3 pokémons iniciais.
Depois que definir pra mim quais vao ser, vou atras do som" — primeira
vez que `secondary1-3` (Q/E/R) ganham conteúdo de verdade, reaproveitando
INTEIRAMENTE a arquitetura de `attacks.primary` (mesmo registro, mesmo
`resolveCreatureAttack`, mesmo `creatureAttackSystem.js` generalizado —
nada de sistema paralelo pra "skills").

### Escolha dos efeitos

Examinado `.exemple/Effects/` de novo (mesma pasta da 6ª rodada) atrás de
malhas que combinassem com os 3 iniciais — critério: (1) tema visual
batendo com o tipo (fogo/planta/água), (2) sem o bug geométrico de
"atravessar parede" que motivou `alignForwardTip` na correção do
`'scratch'` (ver seção acima), (3) sem referência de textura quebrada no
`.mtl` de origem (inspecionado ANTES de converter, não depois — aprendido
com o próprio bug do `'scratch'`, mais barato checar a malha crua que
descobrir problema depois de já ter gerado o `.glb`):

- **Charmander → Brasa (`'ember'`)**: `EffCommonHitFire` — malha plana
  (Z ≈ 0, "cartão" sem profundidade), textura já com as cores de fogo
  desenhadas (`eff_cmn_hit_fire.png`, laranja/vermelho — não precisa
  tingir por cima). Match direto, sem concorrência de outra opção no
  pacote.
- **Bulbasaur → Chicote de Videira (`'vine-whip'`)**: `EffCommonHitCut` +
  `EffCommonHitCutShockWave` (mesma dupla flash+onda de `'punch'`) — sem
  malha de "folha"/"vinha" no pacote (só efeitos de combate genéricos de
  um jogo Pokémon 3DS, não golpes por tipo), então o corte plano
  (streak/slash, textura `eff_cmn_hit_cut00/01.png`) tingido de VERDE
  representa o golpe de chicote — mesma técnica de tingir uma malha em
  escala de cinza já usada em todo o pacote.
- **Squirtle → Redemoinho (`'whirlpool'`)**: `EffCommonWhirlwindL`
  (coluna girando, formato de tornado) tingida de AZUL. A opção "óbvia"
  seria `EffCommonIce` (já azul/gelo na própria textura, `EffCommonIceDB0
  .png`) — DESCARTADA depois de inspecionar `EffCommonIce.mtl`: o
  material `mat3` (63 das 244 faces da malha, ~26%) referencia `map_Kd
  .png` — um NOME DE ARQUIVO QUEBRADO (literalmente ".png", sem nome
  antes da extensão, arquivo que não existe). Convertê-la arriscava um
  erro no `obj2gltf` ou perder um quarto da malha silenciosamente, sem
  aviso nenhum. `EffCommonWhirlwindL` não tem esse problema (as duas
  texturas do `.mtl` existem de verdade) e o formato de vórtice combina
  bem com "Redemoinho".

### Pipeline de conversão (mesmo de sempre)

```
npx obj2gltf -i EffCommonHitCut.obj -o vine-whip-cut.glb
npx obj2gltf -i EffCommonHitCutShockWave.obj -o vine-whip-shockwave.glb
npx obj2gltf -i EffCommonHitFire.obj -o ember-fire.glb
npx obj2gltf -i EffCommonWhirlwindL.obj -o whirlpool.glb
npx gltf-pipeline -i <arquivo>.glb -o <arquivo>.glb -d   # Draco, um por vez
```

4 arquivos novos em `public/assets/effects/`: `vine-whip-cut.glb`,
`vine-whip-shockwave.glb`, `ember-fire.glb`, `whirlpool.glb`. Cada malha
teve a bounding box conferida (accessor de posição do `.glb` gerado,
mesma técnica Python usada pra achar o bug do `'scratch'`) ANTES de virar
componente de view, especificamente pra descartar o problema de
"atravessar parede": `EffCommonHitCut` é praticamente plana (Z de
±0.04), `EffCommonHitCutShockWave` nasce inteira em Z negativo (atrás do
ponto de impacto), `EffCommonWhirlwindL` é simétrica em X/Z — nenhuma das
4 malhas novas precisou de `alignForwardTip`.

### Bug igual encontrado por inspeção no `'punch'` (não relatado jogando)

Enquanto conferia a bounding box das malhas novas contra o padrão que
causou o bug do `'scratch'`, a mesma checagem em `EffCommonHitNormalShockWave`
(já em uso pelo `'punch'`, o ataque comum padrão) revelou Z de `+4.78` a
`+72` — TODO positivo, ou seja, a malha inteira nasce ALÉM do ponto de
impacto na direção do golpe, mesma classe de bug do `'scratch'` (lá era
só METADE da malha; aqui é o rip INTEIRO). Corrigido proativamente:
`PunchAttackEffect.jsx` liga `alignForwardTip: true` só na onda de
choque (o flash, `EffCommonHitNormalA`, nasce todo em Z negativo — já
seguro, não precisa). **Não verificado visualmente** (mesma limitação de
sempre nesta sessão) — como não foi reportado jogando, pode ser sutil o
bastante pra não ter sido notado, ou pode não se manifestar em combates
mais afastados de parede; de qualquer forma, o fix é o mesmo mecanismo já
comprovado pro `'scratch'`.

### Generalização do mecanismo: 4 slots em vez de 1

Até aqui, `creatureAttackSystem.js` só entendia `input.primary` +
`species.attacks.primary`, hardcoded. Generalizado pra um array
`ATTACK_SLOTS` (`{ input, slot }`, mesmo padrão de `SLOTS` em
`partySummonSystem.js`) percorrido mouse→Q→E→R; o primeiro slot com
tecla pressionada + `species.attacks.<slot>` resolvido + stamina/cooldown
livres dispara — só um por tick (segurar mouse E Q ao mesmo tempo só
dispara o mouse, prioridade da lista).

- **`ActionState.pendingSlot` reaproveitado** (antes só usado por
  invocar/recolher) pra guardar QUAL slot disparou — necessário porque
  `action.current` vira só `'attack'` pras quatro fontes; sem o slot,
  `creatureAttackSystem` não saberia se deve reler `attacks.primary` ou
  `attacks.secondary1` no meio do gesto (`effectAt`/`duration`).
- **Cooldown virou `AttackCooldowns` (trait novo)**, um campo por slot
  (`primary`/`secondary1-3`), no lugar do único `ActionState.
  cooldownRemaining` da 7ª rodada. Motivo: skills de verdade configuram
  `cooldown > 0` (2.5s a 3.5s, ver tabela abaixo) — com um campo
  compartilhado, usar uma skill travaria o ataque comum do mouse pelo
  MESMO tempo (e vice-versa), o que não faz sentido nenhum (são recursos
  independentes). Cada campo decrementa todo tick, igual antes.
- **Debug (`AttackRangeDebugView.jsx`) generalizado junto** — antes
  mostrava só o guia do `primary`; agora desenha um guia (anel+área) por
  slot CONFIGURADO, cada um com um par de cores próprio
  (`SLOT_GUIDE_COLORS`), pra dar pra ver o alcance de Q antes de apertar,
  mesmo objetivo de sempre da ferramenta.

Tabela de valores das 3 skills (todos de PARTIDA, sem validação em jogo):

| Skill | `range` | `radius` | `staminaCost` | `cooldown` |
|---|---|---|---|---|
| `'vine-whip'` | 2.2 | 0.35 | 6 | 2.5s |
| `'ember'` | 3 | 0.4 | 8 | 3s |
| `'whirlpool'` | 1.6 | 0.5 | 7 | 3.5s |

### Som: ainda não

As 3 skills configuram `audio.group: null` DE PROPÓSITO — usuário disse
"depois que definir pra mim quais vao ser, vou atras do som", ou seja,
sequência igual à do ataque comum (mecanismo/VFX primeiro, áudio depois
que os arquivos existirem). **Limitação conhecida, documentada** (ver
docstring de `creatureAttackSystem.js`, seção "Som do impacto", e de
`attackSound.js`): `attackAudioSystem.js`/`resolveAttackSound` ainda só
resolvem `attacks.primary` — até a rodada de áudio generalizar isso, o
`AttackPulse` de uma skill não tem ouvinte próprio (nem toca nada errado
de propósito, mas também não tem SEU PRÓPRIO som ainda). Onde deixar os
arquivos quando o usuário trouxer: mesma convenção de sempre,
`public/assets/audio/attack/<grupo>/attack-0N.wav` — cada skill vai
provavelmente querer um grupo próprio (`vine-whip`/`ember`/`whirlpool`)
em vez de compartilhar `'punch'`.

### Bug real, relatado jogando: Q não fazia nada (nem o ataque comum)

Usuário reportou: "Estou apertando o Q depois de assumir o controle de
um dos pokemons e nao acontece nada". Investigando, o mecanismo de
input em si estava correto (`KeyQ` → pulso `secondary1`,
`platform/input/keyboardInput.js` — mesmo mecanismo que já funciona pra
`partySummonSystem.js` invocar/recolher pelo treinador) e
`creatureAttackSystem.js` também estava correto (testado e passando).
O problema: a generalização pra 4 slots (acima, "Generalização do
mecanismo") passou a exigir `AttackCooldowns` na query do system, mas
**`summonBallSystem.js` — o ÚNICO lugar que spawna uma `SummonedCreature`
de verdade no jogo — nunca foi atualizado pra incluir esse trait no
`world.spawn(...)`**. Sem ele, a query nunca casava com NENHUMA criatura
real: não só a skill nova (Q), o ataque comum do mouse (`primary`)
TAMBÉM tinha parado de disparar pra qualquer criatura invocada
normalmente — só que ninguém tinha voltado a testar o mouse depois da
9ª rodada, então só o sintoma do Q foi notado e relatado.

`creatureAttackSystem.test.js` não pegava esse tipo de regressão porque
usa um helper de spawn PRÓPRIO (`spawnControlledCreature`, isolado,
já atualizado junto do resto do teste) — testa o MECANISMO do system
corretamente, mas nunca exercita o caminho de spawn de verdade do jogo.
Corrigido adicionando `AttackCooldowns` ao `world.spawn(...)` de
`spawnCreature` (`summonBallSystem.js`), e uma asserção nova em
`summonBallSystem.test.js` (a criatura recém-pousada tem `ActionState`/
`AttackCooldowns`) — pra pegar qualquer trait futuro que
`creatureAttackSystem`/outro system passe a exigir e este spawn
esquecer de incluir.

**Lição pra próximas mudanças de query em system que reage a
`SummonedCreature`**: sempre conferir `summonBallSystem.js`
(`spawnCreature`) além dos testes do próprio system — é o único ponto
de verdade de composição de traits de uma criatura jogável.

## HUD das skills + efeito de recarga (10ª rodada)

Pedido do usuário: "preciso da hud das habilidades bem como algum efeito
que mostre o tempo de recarga no slot da habilidade". Novo componente,
`tools/hud/SkillsHud.jsx`, seguindo o MESMO padrão de `tools/hud/
PartyHud.jsx` (já existente, "HUD real (não-debug)" — ver docs/backlog.md):
só leitura, sempre montado (`src/app/(auth)/page.js`), estilo idêntico
(caixa `border`/`bg-black/70`, fonte `font-mono text-xs`).

- **Só aparece pilotando uma CRIATURA** — `useQueryFirst(InputControlled,
  SummonedCreature)` devolve `null` pro treinador (nunca tem
  `SummonedCreature`), mesma técnica reativa que `DebugPanel.jsx` já usa
  pra achar "quem está sendo pilotado agora".
- **Só mostra Q/E/R** (`secondary1-3`) — o usuário chamou de
  "habilidades", termo que o resto do projeto já reserva pras skills, não
  pro ataque comum (`primary`, botão esquerdo — esse já tem indicação
  própria, a mira/`Crosshair.jsx`). Slot sem `species.attacks.<slot>`
  resolvido nem aparece — hoje só `secondary1` tem conteúdo (as 3
  espécies iniciais), então o HUD normalmente mostra UM slot só.
- **Ícone por skill** (`view/attackColors.js`, `ATTACK_COLORS` — novo
  mapa, mesmo princípo de `itemColors.js`/`creatureTints.js`): as 3
  skills novas usam a cor do TIPO elemental (fogo/planta/água), mesmo
  quando o tint de verdade do VFX for outro (`ember` tinge de branco no
  VFX de verdade, porque a textura já é colorida — mas laranja aqui
  identifica a skill de relance no HUD, sem abrir o jogo pra ver).
  `SlotPreview.jsx` (compartilhado com `PartyHud.jsx`/`InventoryPanel.jsx`)
  ganhou um terceiro `kind: 'attack'` (quadrado colorido, sem contagem —
  skill não empilha).
- **Efeito de recarga**: um véu escuro (`bg-black/70`) cobrindo o ícone
  de CIMA pra BAIXO, com `height` em porcentagem = `AttackCooldowns.<slot>
  / attack.cooldown` — encolhe conforme o cooldown esvazia, mesma técnica
  de "escalar por cima com `height`/`width` em %" que barra de vida/
  stamina já usaria (nenhuma geometria nova, só CSS). Mais um número em
  segundos (`remaining.toFixed(1)`) enquanto `> 0`; some e a borda vira
  verde (mesmo verde de "ativo" de `PartyHud.jsx`) quando pronto.
- **Atualiza sozinho, sem polling manual**: `creatureAttackSystem.js`
  MUTA `AttackCooldowns` por referência todo tick (`cooldowns[slot] =
  ...`, não `entity.set`) — `useTrait` (koota/react) já reage a isso,
  mesmo padrão que `DebugPanel.jsx` usa pra mostrar stamina/vida ao vivo;
  o HUD não precisa de nenhum `useFrame`/intervalo próprio.

**Nota pra testar**: as 3 skills (`vine-whip`/`ember`/`whirlpool`) estão
com `cooldown: 0` no momento (o usuário ajustou os valores de partida
depois da 9ª rodada) — o véu de recarga só aparece de verdade com um
cooldown > 0 configurado; com `0`, o slot fica sempre "pronto"
(comportamento correto, só não dá pra VER o efeito sem subir algum
`cooldown` temporariamente pra testar).

Sem teste automatizado (componente React puramente visual, mesmo
precedente de sempre — `PartyHud.jsx`/`Crosshair.jsx` também não têm).
Não verificado visualmente (sandbox sem navegador nesta sessão, mesma
limitação de sempre) — pendente de teste manual do usuário.

## Dados por espécie

`attacks.primary` referencia o ataque comum em toda espécie `kind:
'pokemon'` hoje existente; `attacks.secondary1` (tecla Q) referencia a
skill de verdade das 3 espécies iniciais, desde a 9ª rodada (ver
"Habilidades das 3 espécies iniciais" abaixo) — `secondary2`/`secondary3`
(E/R) continuam sem conteúdo em toda espécie:

| Espécie | `attacks.primary` | Override | `attacks.secondary1` |
|---|---|---|---|
| `fox`/`wolf` (e clones `fox-red/green/blue`) | `'scratch'` | nenhum | — |
| `004-charmander` | `'scratch'` | `range: 1` (corpo menor) | `'ember'` (Brasa) |
| `001-bulbasaur` | `'punch'` | `range: 1.8` (vinha/chicote, alcance maior) | `'vine-whip'` (Chicote de Videira) |
| `007-squirtle` | `'punch'` | `range: 1` (corpo menor) | `'whirlpool'` (Redemoinho) |

`duration`/`effectAt`/`staminaCost`/`radius`/`visual`/`audio` continuam
IDÊNTICOS entre `'scratch'`/`'punch'` (`duration: 0.5`, `effectAt: 0.25`,
`radius: 0.3`, `staminaCost: 2`, `audio.group: 'punch'` — só existe um
pacote de áudio de ataque hoje) — só `range` diverge por espécie
(exemplos reais de override, não hipotéticos), e `visual.effectGroup`/
`revealDuration` divergem entre os DOIS ataques (não entre espécies do
mesmo ataque). As 3 skills novas (`vine-whip`/`ember`/`whirlpool`) já
divergem bem mais entre si (`range`/`radius`/`staminaCost`/`cooldown`
próprios cada uma, nenhuma delas 0) — ver "Habilidades das 3 espécies
iniciais" abaixo pro porquê de cada valor. `_template/index.js` (espécie)
documenta as duas formas de `attacks.<slot>` (string sem override,
`{ id, overrides }` com); o `_template/index.js` de `core/data/attacks/`
documenta o que cada campo da definição BASE significa.

## Arquivos

- **Novo**: `core/traits/components/attackEffect.js` (`AttackEffect` +
  `AttackPulse`); `core/systems/creatureAttackSystem.js` (+ teste),
  `core/systems/attackEffectSystem.js` (+ teste);
  `core/data/audio/attackSound.js`; `view/registry/attackAudioRegistry.js`,
  `view/systems/attackAudioSystem.js`; `view/scene/AttackEffectView.jsx`;
  `view/scene/attackEffects/registry.js`,
  `view/scene/attackEffects/ScratchAttackEffect.jsx`;
  `tools/debug/AttackRangeDebugView.jsx`.
- **Modificado**: `core/aim.js` (`resolveAimDirection` nova/exportada),
  `core/traits/components/attackEffect.js`/`core/traits/index.js`
  (`effectGroup`/`AttackPulse`/`DEFAULT_ATTACK_EFFECT_GROUP` exportados),
  `core/data/animationStates.js` (entrada `'attack'`),
  `core/data/actionSlots.js` (+ teste — `'pokemon'` resolve `primary`),
  `core/data/species/_template/index.js` (documenta `actions.attack` e
  `sounds.attackGroup`/`sounds.attack`, incluindo `effectGroup` e a
  direção por câmera), `core/data/species/fox/index.js` (bloco completo +
  comentário de `resolveActionSlots` atualizado),
  `core/data/species/wolf/index.js` (idem, comentário curto referenciando
  `fox`), `core/data/species/001-bulbasaur/index.js`,
  `core/data/species/004-charmander/index.js`,
  `core/data/species/007-squirtle/index.js` (bloco `actions.attack`,
  incluindo `effectGroup: 'scratch'`/`staminaCost: 15`, e
  `sounds.attackGroup: 'punch'`), `view/hooks/useAnimatedModel.js`
  (`useEffect` de setup do áudio de ataque, mesmo bloco de dash/jump/
  summon/recall), `view/loop/registerSystems.js` (registra
  `creatureAttackSystem` logo depois de `playerActionSystem`,
  `attackEffectSystem` perto de `consumeEffectSystem`, `attackAudioSystem`
  perto de `dashAudioSystem`/`jumpAudioSystem`/`summonAudioSystem`/
  `recallAudioSystem`), `view/scene/GameScene.jsx`
  (`<AttackEffectsView />`), `src/app/(auth)/page.js`
  (`<AttackRangeDebugView />` no bloco `showDebug`). 5ª rodada:
  `core/systems/creatureAttackSystem.js` (`resolveAttackImpactPoint` nova/
  exportada, usa `castRay`; query ganhou nada de novo — já tinha
  `PhysicsBody`), `tools/debug/AttackRangeDebugView.jsx` (reusa
  `resolveAttackImpactPoint`, geometria trocada por `icosahedronGeometry`
  de detalhe 0, `RING_SEGMENTS` 64→24).
- **6ª rodada — Novo**: `public/assets/effects/scratch.glb`,
  `hit-normal.glb`, `hit-normal-shockwave.glb` (rips convertidos, ver
  seção "Efeitos de verdade"); `view/scene/attackEffects/
  useAdditiveEffectMesh.js` (hook compartilhado — carrega `.glb` +
  reconstrói material aditivo), `view/scene/attackEffects/
  PunchAttackEffect.jsx` (grupo `'punch'` novo).
- **6ª rodada — Modificado**: `view/scene/attackEffects/
  ScratchAttackEffect.jsx` (reescrito — malha `EffCommonScratch` via
  `useAdditiveEffectMesh`, no lugar do impacto procedural),
  `view/scene/attackEffects/registry.js` (`punch: PunchAttackEffect`
  registrado), `core/systems/creatureAttackSystem.js` (`AttackEffect`
  nasce com `Rotation({ y: rot.y })` — antes era `Rotation` padrão, "sem
  uso real"; agora orienta a malha na direção do golpe),
  `view/scene/attackEffects/useAdditiveEffectMesh.js` (`side:
  THREE.DoubleSide` no material — bug real, ver "Bug real, relatado
  jogando" acima).
- **7ª rodada — Novo**: `core/data/attacks/index.js` (+ teste),
  `core/data/attacks/scratch/index.js`, `core/data/attacks/punch/index.js`,
  `core/data/attacks/_template/index.js`.
- **7ª rodada — Modificado**: `core/traits/components/action.js`
  (`cooldownRemaining` em `ActionState`), `core/traits/components/
  attackEffect.js` (`revealDuration` em `AttackEffect`),
  `core/data/audio/attackSound.js` (`resolveAttackSound` resolve via
  `resolveCreatureAttack` em vez de `species.sounds.attackGroup`),
  `core/systems/creatureAttackSystem.js` (`resolveEffectRotation` nova/
  exportada; usa `resolveCreatureAttack`; cooldown decrementado/travado/
  setado; `AttackEffect` ganha `revealDuration`), `core/data/species/
  fox/index.js`, `wolf/index.js`, `001-bulbasaur/index.js`,
  `004-charmander/index.js`, `007-squirtle/index.js` (`actions.attack`/
  `sounds.attackGroup` removidos, `attacks.primary` novo — ver "Dados por
  espécie"), `core/data/species/_template/index.js`/`core/data/
  actionSlots.js` (comentários atualizados pra `attacks.primary`),
  `view/scene/attackEffects/useAdditiveEffectMesh.js` (`options.reveal`,
  shader de revelação progressiva), `view/scene/attackEffects/
  ScratchAttackEffect.jsx` (prop `revealDuration`, `useAdditiveEffectMesh`
  com `reveal: true`), `view/scene/AttackEffectView.jsx` (repassa
  `revealDuration` do trait pro componente), `view/scene/attackEffects/
  registry.js`/`tools/debug/AttackRangeDebugView.jsx` (comentários
  atualizados pra `attacks.primary`/`resolveCreatureAttack`).
- **8ª rodada — Modificado**: `view/scene/attackEffects/
  useAdditiveEffectMesh.js` (bug fix — `vUv.x`→`vMapUv.x` no shader de
  revelação, ver "Correção: revelação não funcionava"),
  `core/data/attacks/scratch/index.js`/`punch/index.js`/`_template/
  index.js` (`visual.scale` novo campo), `core/traits/components/
  attackEffect.js` (`visualScale` em `AttackEffect`),
  `core/systems/creatureAttackSystem.js` (`AttackEffect` ganha
  `visualScale` de `ATTACK.visual.scale`), `view/scene/AttackEffectView.jsx`
  (repassa `visualScale` do trait como prop `scale`),
  `view/scene/attackEffects/ScratchAttackEffect.jsx`/
  `PunchAttackEffect.jsx` (`SCRATCH_SCALE`/`HIT_SCALE`/`SHOCKWAVE_SCALE`
  renomeados pra `*_BASE_SCALE`, prop `scale` nova multiplicada na
  fórmula final); `view/scene/attackEffects/useAdditiveEffectMesh.js`
  (`options.alignForwardTip`, bug fix — ver "Correção: efeito do
  'scratch' atravessando parede"), `view/scene/attackEffects/
  ScratchAttackEffect.jsx` (liga `alignForwardTip: true`).
- **9ª rodada — Novo**: `core/data/attacks/vine-whip/index.js`,
  `core/data/attacks/ember/index.js`, `core/data/attacks/whirlpool/
  index.js` (3 skills novas); `view/scene/attackEffects/
  VineWhipAttackEffect.jsx`, `EmberAttackEffect.jsx`,
  `WhirlpoolAttackEffect.jsx`; `public/assets/effects/vine-whip-cut.glb`,
  `vine-whip-shockwave.glb`, `ember-fire.glb`, `whirlpool.glb` (rips
  convertidos).
- **9ª rodada — Modificado**: `core/data/attacks/index.js` (registro das
  3 skills novas), `core/data/species/001-bulbasaur/index.js`/
  `004-charmander/index.js`/`007-squirtle/index.js` (`attacks.secondary1`
  novo), `core/traits/components/action.js` (`ActionState.
  cooldownRemaining` REMOVIDO — migrado pra `AttackCooldowns`;
  `pendingSlot` ganha um segundo significado, qual slot de ataque
  disparou), `core/traits/components/attackEffect.js`/`core/traits/
  index.js` (`AttackCooldowns`, trait novo, um campo por slot),
  `core/systems/creatureAttackSystem.js` (+ teste — generalizado pra 4
  slots via `ATTACK_SLOTS`, cooldown por slot), `core/data/actionSlots.js`
  (+ teste — `secondary1-3` de `'pokemon'` viram `'skill1'`/`'skill2'`/
  `'skill3'`, papéis genéricos em vez de `null`), `core/data/audio/
  attackSound.js` (docstring — limitação conhecida, só resolve
  `primary`), `tools/debug/AttackRangeDebugView.jsx` (generalizado pra
  desenhar um guia por slot configurado, cores por slot),
  `view/scene/attackEffects/registry.js` (3 grupos novos registrados),
  `view/scene/attackEffects/PunchAttackEffect.jsx` (`alignForwardTip:
  true` na onda de choque — bug igual ao do `'scratch'`, achado por
  inspeção nesta rodada, não relatado jogando);
  `core/systems/summonBallSystem.js` (+ teste — `AttackCooldowns` faltando
  no `world.spawn(...)` de `spawnCreature`, bug REAL relatado jogando
  ("Q não faz nada"), ver "Bug real, relatado jogando" acima).
- **10ª rodada — Novo**: `tools/hud/SkillsHud.jsx` (HUD das skills +
  efeito de recarga), `view/attackColors.js` (`ATTACK_COLORS`, cor por
  skill no HUD).
- **10ª rodada — Modificado**: `tools/shared/SlotPreview.jsx` (+
  `getSlotColor`, terceiro `kind: 'attack'`), `src/app/(auth)/page.js`
  (`<SkillsHud />` montado ao lado de `<PartyHud />`),
  `core/systems/creatureAttackSystem.test.js` (um teste ajustado —
  parou de depender do `cooldown` de verdade de `vine-whip`, que o
  usuário zerou depois da 9ª rodada; passou a simular o cooldown direto
  no trait, testando só o MECANISMO de isolamento entre slots).

## Testes

- `creatureAttackSystem.test.js` — botão esquerdo dispara `'attack'` numa
  criatura controlada **e desconta `staminaCost` uma única vez, resetando
  `staminaRegenDelay`**; sem stamina suficiente, não dispara nem desconta
  nada; sem `primary`, no-op; sem `InputControlled`, no-op (criatura não
  pilotada agora); espécie desconhecida (sem `attacks.primary` pra
  resolver), no-op sem quebrar; sem câmera no world (teste isolado), cai
  no fallback "pra frente" (+Z) — mesmo comportamento de
  `resolveAimDirection`/`resolveAimPoint`; **override por criatura
  (`004-charmander`, `range: 1` em vez do `1.4` base de `'scratch'`) é
  respeitado de ponta a ponta**; a direção do golpe (corpo E área
  efetiva) respeita a câmera — yaw/pitch, não só a `Rotation.y` de antes
  do disparo (reproduz `computeAimRay` de forma independente, mesmo
  padrão de `partySummonSystem.test.js`); **o VFX orienta pela direção 3D
  COMPLETA (`effect.get(Rotation).x` bate com o pitch calculado, não só
  `.y`)**; a ação termina sozinha em `duration`; segurar `primary` não
  reinicia/duplica a ação em andamento; ignora `ActionState` ocupada por
  outra ação (ex.: `'dash'`) sem sobrescrever nem somar `elapsed` por
  cima; **marca `AttackPulse` na CRIATURA exatamente quando o
  `AttackEffect` nasce** (não antes) — ver seção "Som" acima;
  **`AttackCooldowns.primary` trava o disparo do mouse mesmo com stamina
  cheia, é travado em `attack.cooldown` no disparo, decrementa todo tick
  (mesmo sem ação em andamento) e nunca fica negativo**; **8ª rodada:
  `AttackEffect.visualScale` bate com `ATTACK.visual.scale`** (mesmo
  teste "sem câmera... cai no fallback", assert a mais ao lado de
  `effectGroup`/`revealDuration`); **9ª rodada: `secondary1` (tecla Q)
  dispara a skill própria da espécie** (bulbasaur → vine-whip),
  **cooldown de uma skill NÃO trava o ataque comum do mouse (e
  vice-versa) — cada slot com o PRÓPRIO `AttackCooldowns.<slot>`**,
  **segurando mouse+Q juntos, só o mouse dispara (prioridade da lista,
  um slot por tick)**, **espécie sem `secondary1` configurado (ex.: fox),
  tecla Q não dispara nada, sem quebrar**.
  `resolveEffectRotation` (nova, exportada) ganhou seu próprio par de
  testes — sem offset, direção pra frente/nível vira rotação zero; com
  offset, graus convertidos pra radianos e somados; olhando pra
  cima/baixo (`direction.y` ±1), pitch calculado via `atan2` sem
  `NaN`/divisão por zero. `spawnControlledCreature` (helper) ganhou
  `Vitals` (`vitalsFromSpecies`, mesma composição real de
  `summonBallSystem.js`) e, na 9ª rodada, `AttackCooldowns` — a query do
  system passou a exigir os dois traits.
- `core/data/attacks/index.test.js` (novo) — `getAttack`/`listAttacks`
  (mesmo padrão de `items/index.test.js`); `resolveCreatureAttack`: sem
  referência ou id desconhecido devolve `null`; string usa a base sem
  alteração; `{ id }` sem overrides idem; override de campo de TOPO
  substitui só esse campo; override de campo DENTRO de uma seção
  (`visual`/`audio`/`animation`) mescla campo a campo, sem apagar o resto
  da seção; overrides não mutam a definição base nem o registro global
  (`{ ...base, ...overrides }` sempre cria objeto novo).
- `attackEffectSystem.test.js` — mesmo teste de
  `consumeEffectSystem.test.js`: conta `lifetime` pra baixo, destrói ao
  zerar. Não mudou nesta rodada.
- `actionSlots.test.js` — teste de `'pokemon'` reescrito pro novo valor
  resolvido (`primary: 'attack'`, `secondary1-3: null`). Não mudou nesta
  rodada.
- Sem teste automatizado pra `AttackEffectView.jsx`/`ScratchAttackEffect.
  jsx`/`PunchAttackEffect.jsx`/`useAdditiveEffectMesh.js`/
  `AttackRangeDebugView.jsx` (Three.js/visual, mesmo precedente de sempre
  no projeto — inclusive a malha de rip da 6ª rodada). Sem
  teste dedicado pra `resolveAimDirection` (`core/aim.js`) — mesmo
  precedente de `resolveAimPoint`/`resolveHandOrigin`, validadas
  indiretamente via reprodução local nos testes dos systems que as usam,
  não um `aim.test.js` à parte. Sem teste pra `attackAudioSystem.js`
  (consome/toca áudio, Web Audio real) — mesmo precedente de
  `jumpAudioSystem.js`/`summonAudioSystem.js`, nenhum dos dois tem teste
  próprio hoje (o mecanismo de PULSO em si já é coberto pelo teste de
  `creatureAttackSystem.test.js` citado acima).
- **5ª rodada**: `resolveAttackImpactPoint` ganhou seu próprio bloco de
  testes (`describe` separado, mesmo arquivo) — sem física carregada, cai
  no ponto cheio; com física real (`initPhysics`/`createStaticLevel`/
  `stepPhysics`, mesmo padrão de `summonBallSystem.test.js`/
  `projectileSystem.test.js`) e nada no caminho, também cai no ponto
  cheio; **mirando pro CHÃO com um `range` bem maior que a distância real
  até ele (simulando um chicote longo), para no ponto de impacto — não
  atravessa a superfície**. Sem teste novo pra `AttackRangeDebugView.jsx`
  (Three.js/visual, mesmo precedente de sempre).
- `npx eslint src/`/`npx vitest run` batem na mesma baseline
  pré-existente do `develop` (20 erros de lint / 9 testes falhando, todos
  alheios a esta feature) — nada novo introduzido nesta rodada.

## Fora de escopo (de propósito)

- Dano/detecção de acerto contra qualquer alvo (criatura selvagem, outra
  criatura) — decisão explícita do usuário, ver "decisões" no topo. Espera
  o sistema de batalha (`stats`/`moves`) ser desenhado.
- Animação específica por criatura (`clips.attack`) — trabalho em paralelo,
  por fora desta feature; a arquitetura já está pronta pra receber (ver
  seção "Animação" acima).
- **Cooldown VIRA um campo funcional na 7ª rodada** (`attack.cooldown` +
  `ActionState.cooldownRemaining`, ver "Reorganização da config") — todo
  ataque hoje configura `cooldown: 0` (no-op, mesmo comportamento de
  antes: só stamina trava de verdade); um valor real é decisão de
  conteúdo futura, não mecanismo — o mecanismo já está pronto.
- **`Q` (secondary1) ganhou conteúdo de verdade na 9ª rodada** (3 skills,
  uma por Pokémon inicial — ver "Habilidades das 3 espécies iniciais");
  `E`/`R` (`secondary2`/`secondary3`) continuam reservados, sem
  comportamento nenhum — o mecanismo já suporta os dois (`ATTACK_SLOTS`
  já os percorre), só falta CONTEÚDO (nenhuma espécie referencia nada
  neles ainda).
- Som das 3 skills novas (`vine-whip`/`ember`/`whirlpool`) —
  `audio.group: null` de propósito, usuário vai atrás dos arquivos
  separadamente (ver "Som: ainda não" acima); generalizar
  `attackAudioSystem.js`/`resolveAttackSound`/`useAnimatedModel.js` pra
  resolver por SLOT (não só `primary`) é a próxima rodada de áudio.
- Dano das skills novas — mesma decisão de escopo do ataque comum (ver
  primeiro item desta lista); `damage: null` em `vine-whip`/`ember`/
  `whirlpool` também.
- `duration`/`radius`/`staminaCost`/`visual`/`audio` idênticos entre
  `'scratch'`/`'punch'` — só `range` diverge por espécie hoje (exemplos
  reais de override, ver "Dados por espécie"). Golpes com timing/custo
  realmente diferentes (não só alcance) é conteúdo futuro, a ESTRUTURA já
  suporta via override de qualquer campo.
- `EffCommonHitCut`/`HitCutShockWave` e `EffCommonHitFire` (examinados
  desde a 6ª rodada — ver "Efeitos de verdade") viraram os grupos
  `'vine-whip'`/`'ember'` na 9ª rodada; `EffCommonHitElec` (elétrico) e
  `EffCommonMerikomi` (impacto/dust de terra, ver docstring de
  `whirlpool/index.js` pro porquê de não ter sido usado) continuam
  examinados mas sem uso — a ESTRUTURA já suporta um golpe novo pra
  qualquer um dos dois (é só mais um componente + linha no registry,
  mesmo processo de `'punch'`/`'vine-whip'`/`'ember'`/`'whirlpool'`), só
  não foi pedido ainda.
- `secondary2`/`secondary3` (E/R) sem NENHUM Pokémon referenciando —
  falta conteúdo (uma segunda/terceira skill por espécie), não mecanismo
  (`ATTACK_SLOTS` em `creatureAttackSystem.js` já os percorre igual a
  `secondary1`).
- Valores de PARTIDA dos efeitos convertidos: `*_BASE_SCALE` (constante
  de normalização técnica de cada malha, dentro dos componentes de view),
  `visual.scale` (multiplicador por ataque/criatura, `1` em todo ataque
  hoje) e `rotationOffset`/`revealDuration` de cada ataque
  (hoje `{x:0,y:0,z:0}`/`0.2`) — sem validação visual
  completa em jogo (mesma limitação de sempre desta sessão, sem navegador
  funcionando no sandbox); esperado precisar de ajuste fino olhando o
  resultado real, especialmente o `rotationOffset` (a malha pode não
  estar alinhada com a convenção do jogo — é exatamente pra isso que o
  campo existe).
- As texturas de partícula 2D do pacote (`Particles/`, `Adventure
  Particles/`) — não usadas nesta rodada, só as malhas de combate.
- Mira travada por `AimAnchor` considerada na direção do ataque — a
  criatura continua sem âncora própria (`aimAnchorSystem.js` ignora
  `SummonedCreature`); o golpe sempre recalcula a direção da câmera na
  hora do disparo, nunca olha pra um ponto travado.
- **O raycast de `resolveAttackImpactPoint` (5ª rodada) não é detecção de
  acerto** — só decide ONDE o VFX/guia de debug para no meio do caminho.
  Qualquer collider físico no trajeto já para o raycast (parede/obstáculo
  do nível, OU a cápsula de outra criatura/do treinador, já que
  `castRay` não distingue tipo de collider) — mas isso é só
  POSICIONAMENTO visual: nenhum dano é calculado, nenhum evento de
  "atingiu X" é emitido, ninguém lê quem foi tocado. Isso continua fora
  de escopo (ver primeiro item desta lista), esperando o sistema de
  batalha.
- Um segundo grupo de som (ex.: um impacto mais grave/pesado pra
  criaturas maiores) — a ESTRUTURA já suporta (`audio.group` na
  definição do ataque, `ATTACK_SOUND_GROUPS` em `core/data/audio/
  attackSound.js`, mesmo mecanismo de `footstepGroup`), só não foi
  pedido conteúdo novo ainda; `'scratch'`/`'punch'` apontam os dois pro
  mesmo grupo `'punch'` (único pacote de áudio de ataque que existe).
- Rewiring de `core/data/animationStates.js` pra resolver o clipe de
  animação por `animation.clipKey` do ataque ATIVO (em vez do id fixo
  `'attack'`) — `animation.clipKey` já existe na definição de cada
  ataque como INTENÇÃO documentada (ver "Reorganização da config"), mas
  o mecanismo de resolução continua o mesmo de antes; só passa a importar
  quando dois ataques na mesma espécie precisarem de clipes diferentes.
