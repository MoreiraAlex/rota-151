# 🚀 Versão 0.0.20 — Fox selvagens, cena maior e textura por espécie

Item do backlog ("Criaturas selvagens no mundo... adiado até o jogador
estar redondo") puxado pra frente: fox NÃO controláveis vagando pela cena,
sem nenhuma interação com o jogador ainda (isso fica pra depois). Três
requisitos do usuário, um mecanismo novo cada.

> Versionamento e nome do arquivo: ver `docs/development-workflow.md`.

---

## 1. Cena maior + muro de contorno

`TEST_LEVEL` (`core/data/testLevel.js`) já era fonte única pra collider
físico (`core/physics/colliders.js`), grade de pathfinding
(`core/pathfinding.js`) e mesh visível (`GameScene.jsx`) — aumentar
`ground.size` (`60` → `150`) foi mudança de dado só, tudo que consome já
era genérico.

Descoberto lendo `characterPhysicsSystem.js`: sair da borda do chão era
queda livre pro limbo, sem NENHUM collider segurando isso — bug real,
latente desde sempre, só nunca exposto porque o jogador nunca tinha
motivo de ir tão longe. Corrigido com 4 novos `obstacles` `type: 'box'`
(um por lado, altura ~4m — acima do pulo máximo de qualquer espécie hoje),
posicionados na borda de `ground.size`. Mesmo mecanismo de qualquer outro
obstáculo — sem `type` novo, sem código novo em `TestLevelView`/
`colliders.js`/`pathfinding.js`. Mais ~8 blocos ("pedras") espalhados na
área nova, pra ter o que os fox selvagens desviarem.

## 2. Textura por espécie

`species.model` só tinha `{ path, scale }`. O `.glb` da fox
(`fox-debug.glb`) tem exatamente 1 material/1 textura — extraída direto
dos chunks JSON/BIN do arquivo (script Node de uma linha, sem dependência
nova) pra um PNG de verdade: `public/assets/textures/fox/fox-diffuse.png`
(1024×1024), editável pelo usuário por fora.

- `species.model.texture` (opcional, mesmo nível de `path`/`scale`) —
  documentado em `_template/index.js`; `fox/index.js` aponta pro PNG
  extraído.
- `view/textures/textureCache.js` (novo) — `loadTexture(path)`, cache por
  path, mesmo formato de `view/audio/audioBufferCache.js` (erro de carga
  nunca rejeita, resolve `null`, no-op gracioso). `flipY = false` +
  `colorSpace = SRGBColorSpace` setados na mão — a imagem foi extraída de
  dentro do pipeline glTF, que já aplica os dois por baixo dos panos;
  carregando "crua" por fora com `THREE.TextureLoader` puro, sem replicar
  isso a textura aparece invertida/lavada em cima da MESMA geometria/UV
  que antes vinha correta pelo `GLTFLoader`.
- Aplicação em `useAnimatedModel.js` (não só em `CreatureView`, porque é
  config de `species.model` — o treinador ganharia de graça se um dia
  configurar textura própria): clona o material antes de setar `.map`,
  mesmo cuidado que o tint de `CreatureView.jsx` já tinha (`SkeletonUtils.clone`
  reusa material por referência entre instâncias do mesmo `.glb`).
- Sem teste automatizado pra `textureCache.js` — mesmo precedente de
  `audioBufferCache.js` (carregamento de Three.js/browser não testável
  headless).

## 3. Fox selvagens vagando com pathfind

**Não** reaproveita `SummonedCreature`/`creatureFollowSystem.js` — aquele
trait/system são "pertence ao time do treinador" (spawn/despawn por
`partySummonSystem`, sempre persegue quem tem `InputControlled`). Usar
eles faria a fox selvagem ser puxada pro treinador, o oposto do pedido.

- **`WildCreature`** (`core/traits/components/wildCreature.js`) —
  `{ speciesId }`, mesmo papel de `SummonedCreature.speciesId`, sem
  slot/dono de time.
- **`WanderState`** (`core/traits/components/wander.js`) — trait SoA
  `{ homeX, homeZ, targetX, targetZ, pauseTimer, chaseTimer }`. `home` é
  a posição de spawn (destino nunca sorteado mais longe que
  `WILD_WANDER.RADIUS` dali — cada fox vaga por uma área local, não
  atravessa o mapa inteiro). `chaseTimer` é uma trava de segurança:
  destino praticamente inalcançável (reentrância que o pathfinding não
  prevê, mesmo espírito de `MovementBlocked`) faz a fox desistir depois de
  `MAX_CHASE_TIME` em vez de empurrar pra sempre contra o mesmo obstáculo.
- **`wildCreatureSpawnSystem.js`** — lê `TEST_LEVEL.wildCreatures` (novo
  campo, mesmo espírito declarativo de `obstacles`) e spawna cada entrada
  UMA VEZ (idempotência via `queryFirst(WildCreature)` — sem flag global
  dedicado). Corpo físico segue o MESMO padrão de `applySummon`
  (`isPhysicsReady() ? createCharacterBody(...) : placeholder -1/-1` —
  `physicsBootstrapSystem.js` varre toda entidade `CharacterController`+
  `PhysicsBody`, não só o treinador, no tick em que a física fica pronta,
  então o placeholder é preenchido sozinho se o spawn correr antes disso).
  Mesmo conjunto de traits de uma `SummonedCreature`, menos
  `InputState`/`AimAnchor`/`HeldItem` (só fazem sentido pra quem pode ser
  controlado — fox selvagem nunca ganha `InputControlled`).
- **`wildWanderSystem.js`** — reaproveita a MESMA técnica de perseguir um
  ponto que `creatureFollowSystem.js` já usa (`findPath`/`PathState` com
  `REPATH_INTERVAL`, evasão local via `MovementBlocked`/`castRay`,
  `Rotation` suavizada da qual `Velocity` deriva), por CÓPIA direta — não
  por helper compartilhado entre os dois systems (mesmo precedente já
  usado em `footstepGroups.js`/`actionSoundGroups.js`, docs/features/019-
  som-ambiente-e-passos.md: não mexe em código já testado/em produção só
  pra generalizar por generalizar). Sempre `walkSpeed`, sem correr; sem
  evasão entre personagens (`AVOIDANCE_RADIUS`) — fora de escopo por
  enquanto, fox selvagens ainda colidem fisicamente entre si do jeito que
  `characterPhysicsSystem.js` já trata qualquer personagem, só não
  desviam proativamente.
- `GAME_CONFIG.WILD_WANDER` (novo domínio, genérico) — `RADIUS: 12,
  MIN_PAUSE: 3, MAX_PAUSE: 8, ARRIVAL_DISTANCE: 0.6, MAX_CHASE_TIME: 15`.
- Renderização: `CreatureView` (`view/scene/CreatureView.jsx`) generalizado
  pra receber `speciesId` como prop (em vez de ler só de
  `SummonedCreature`) — `CreaturesView` continua igual, nova
  `WildCreaturesView` reusa o MESMO componente visual pra `WildCreature`
  (tint/textura por espécie inclusos de graça, sem duplicar nada).
  `GameScene.jsx` ganha `<WildCreaturesView />` ao lado de `<CreaturesView />`.
- `registerSystems.js`: `wildCreatureSpawnSystem`/`wildWanderSystem` na
  fase `simulation`, junto de `partySummonSystem`/`creatureFollowSystem`.
- `TEST_LEVEL.wildCreatures`: 6 entradas (variando `fox`/`fox-red`/
  `fox-green`/`fox-blue` pra variedade visual de graça via tint já
  existente), espalhadas pela área nova da cena.

## Testes

- `wildCreatureSpawnSystem.test.js` (novo) — spawna uma entidade por
  entrada de `TEST_LEVEL.wildCreatures`; idempotente (rodar de novo não
  duplica); sem física pronta (caso normal em teste), spawna mesmo assim
  com handles placeholder `-1`; `WanderState` nasce centrado na própria
  posição de spawn.
- `wildWanderSystem.test.js` (novo) — parada enquanto `pauseTimer > 0`;
  chegar perto do destino sorteia um novo dentro de `RADIUS` de `home` e
  pausa; persegue o destino atual quando não está pausada/chegou (mesmo
  padrão de convergência de `creatureFollowSystem.test.js`); `chaseTimer`
  estourando `MAX_CHASE_TIME` desiste do destino mesmo sem chegar;
  `MovementBlocked` desvia lateralmente em vez de continuar reto.
- `npm run lint`/`npx vitest run` verdes — mesma baseline pré-existente de
  `items`/`world` (2 falhas, não relacionadas a esta feature).

## Fora de escopo (de propósito)

- Qualquer interação fox selvagem ↔ jogador (captura, combate, fuga) —
  vagam sozinhas, ignoram o jogador por completo por enquanto.
- Evasão entre personagens pra fox selvagem (`AVOIDANCE_RADIUS`) — só
  colisão física normal, sem desvio proativo.
- Recolher/despawnar uma `WildCreature` — nascem uma vez, existem pro
  resto da sessão.
