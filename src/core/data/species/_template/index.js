/**
 * Molde de uma espécie. Copia esta pasta inteira pra `<dexNumber>-<id>/`
 * (ex.: `001-bulbasaur/`) — um `index.js` com os dados abaixo, mais uma pasta
 * `clips/` com um .json por ação (`idle.json`, `walk.json`, `run.json`, ...).
 * Ver `../fox/` como exemplo completo e funcional.
 *
 * `stats` e `moves` ainda não têm formato fechado — o sistema de batalha
 * ainda não foi desenhado. Preenche do jeito que fizer sentido por enquanto;
 * formalizamos o formato de verdade quando desenharmos batalha, sem precisar
 * migrar nada — são só objetos.
 */
// import IDLE_CLIP from './clips/idle.json'
// import WALK_CLIP from './clips/walk.json'

export const SPECIES_TEMPLATE = {
  id: 'nome-em-minusculo',
  dexNumber: 0,
  // Opcional — nível fixo por ESPÉCIE (não por indivíduo; sem XP/
  // progressão nenhuma por trás), mostrado na etiqueta acima da cabeça
  // (`view/scene/NameplateView.jsx`, docs/features/027-hud-de-status-e-habilidades.md). Ausente = campo simplesmente não aparece na etiqueta
  // (ex.: `../boy/index.js`, treinador — "nível" não faz sentido pra um
  // humano). Valor de PARTIDA quando declarado, sem balanceamento.
  // level: 5,
  // Opcional — retrato/sprite REDONDO (`view/shared/statusDisplay.jsx`,
  // `SpritePortrait`) usado por `tools/hud/StatusHud.jsx`/`PartyHud.jsx`
  // (docs/features/027-hud-de-status-e-habilidades.md, "3ª/4ª rodada").
  // Ausente = cai no placeholder colorido de sempre (`CREATURE_TINTS`,
  // mesma paleta do inventário) — mesmo fallback gracioso de qualquer
  // outro asset opcional deste projeto. `path` aceita URL externa
  // também (não só `/assets/...` local — precisa constar em
  // `images.remotePatterns`, `next.config.js`, senão o `next/image`
  // recusa carregar).
  // sprite: {
  //   path: '/assets/sprites/nome.png',
  //   // Opcional, default 1 — sprites de fontes diferentes variam MUITO
  //   // de quanta margem vazia têm dentro do próprio arquivo (`object-
  //   // cover` sozinho não resolve isso — a margem é pixel de verdade
  //   // da imagem, não espaço "cortável" pelo CSS). Amplia a imagem
  //   // DENTRO do círculo já cortado — ajusta olhando o resultado,
  //   // mesmo "valor de partida" de toda outra config visual sem
  //   // medida exata disponível.
  //   scale: 1,
  // },
  // Opcional — fração de XP (0 a 1, via `current`/`max`) mostrada no
  // anel ao redor do retrato (`SpritePortrait`) — mesmo espírito de
  // `level`: só um NÚMERO de exibição, sem sistema de progressão
  // nenhum por trás ainda. Ausente = anel nasce vazio (0%).
  // xp: { current: 0, max: 100 },
  // 'trainer' | 'pokemon' — que tipo de entidade jogável esta espécie
  // representa (ver docs/features/011-slots-de-acao.md). Opcional — sem
  // isso, resolveSpeciesKind() assume 'trainer'.
  kind: 'pokemon',
  model: {
    path: '/assets/models/nome.glb',
    scale: 1,
    // Opcional — sem isso, usa a própria textura já embutida no `.glb`
    // (se houver). Duas formas (`useAnimatedModel.js`):
    // 1) string — uma textura pra TODO mesh do modelo, pra `.glb` com um
    //    material só (ver `../fox/index.js`):
    // texture: '/assets/textures/nome/diffuse.png',
    // 2) `{ materialIndex: { path, ... } }` — um diffuse por material, pra
    //    `.glb` com vários materiais (corpo/olhos/etc. separados — ver
    //    `../001-bulbasaur/index.js`). `materialIndex` é a ordem de
    //    encontro dos meshes em `cloned.traverse`, conferida visualmente
    //    no navegador, não um metadado do `.glb`. O valor de cada entrada é
    //    SEMPRE um objeto (nunca a string do path direto) — `path` é
    //    obrigatório, o resto é opcional e só faz sentido quando a textura
    //    de verdade é um atlas maior que a região que aquele material deve
    //    mostrar: `center`/`repeat`/`pan` (offset) recortam um pedaço dela,
    //    `rotation` (graus) gira o UV, `flipY` sobrescreve o default (`true`
    //    — ver `textureCache.js`) só pra esta textura específica.
    // texture: {
    //   0: { path: '/assets/textures/nome/body.png' },
    //   1: { path: '/assets/textures/nome/eyes.png', flipY: false },
    // },
    // `pan` acima é uma célula FIXA, pra sempre — pra um atlas de olho com
    // várias expressões (aberto/fechado/dormindo/braba/etc., ver
    // `../001-bulbasaur/index.js`) que precisam ALTERNAR sozinhas
    // (piscar) e mudar conforme o humor da criatura (`core/traits/
    // components/mood.js`, docs/features/023-estado-de-humor-e-piscar-de-
    // olhos.md), troca `pan` por `eyeStates` (mutuamente exclusivos — uma
    // entrada usa um ou outro, nunca os dois): um objeto por humor, cada
    // um com uma célula `open` e uma `closed` (mesmo formato de `pan`).
    // `blink` (opcional, defaults 2-6s aberto / 0.12s fechado) ajusta o
    // ritmo de piscar. `view/systems/eyeBlinkSystem.js` cuida do resto —
    // sem código nenhum além da config.
    // texture: {
    //   1: {
    //     path: '/assets/textures/nome/eyes-atlas.png',
    //     repeat: { x: 1 / 4, y: 1 / 4 },
    //     eyeStates: {
    //       awake: { open: { x: -0.5, y: -0.25 }, closed: { x: -0.25, y: -0.25 } },
    //       sleeping: { open: { x: -0.5, y: -0.5 }, closed: { x: -0.25, y: -0.5 } },
    //     },
    //     blink: { minInterval: 2, maxInterval: 6, closedDuration: 0.12 },
    //   },
    // },
  },
  clips: {
    // idle: IDLE_CLIP,
    // walk: WALK_CLIP,
    // run: RUN_CLIP,
    // `dash`/`fall` (opcionais — mecanismo já pronto, sem clipe autorado
    // em nenhuma espécie ainda): `core/data/animationStates.js` já
    // resolve os dois ids sozinho (`dash` por `ActionState.current ===
    // 'dash'`, ONE-SHOT — mesma convenção de `throw`, `speed` do JSON
    // deveria ser `1/GAME_CONFIG.PLAYER_ACTIONS.dash.DURATION`; `fall`
    // por `!grounded`, CÍCLICO como walk/run, não reinicia o relógio).
    // Sem o clipe, `animationSystem.js` cai no fallback de sempre (pose
    // de descanso) — só declarar aqui quando o JSON existir:
    // dash: DASH_CLIP,
    // fall: FALL_CLIP,
    // `cry` (opcional — ver `../001-bulbasaur/index.js`, docs/features/
    // 023-estado-de-humor-e-piscar-de-olhos.md, seção "Boca sincronizada
    // com o grito") — clipe de boca/cabeça/antena
    // tocado EXATAMENTE enquanto `sounds.voice` está tocando de verdade
    // (não um temporizador próprio — os dois seguem o mesmo evento de
    // áudio, nunca dessincronizam). Mesmo formato de idle/walk/run, mas
    // só precisa animar os ossos da boca pra cima (cabeça/queixo/antenas
    // etc.) — `view/hooks/useAnimatedModel.js` já isola só esses ossos
    // sozinho, não precisa declarar nada a mais aqui. Sem `sounds.voice`
    // configurado também, o clipe simplesmente nunca dispara (precisa dos
    // dois: som pra sincronizar E clipe pra tocar).
    // cry: CRY_CLIP,
  },
  body: {
    // Cápsula de colisão: altura total = 2 * (capsuleRadius + capsuleHalfHeight).
    capsuleRadius: 0.5,
    capsuleHalfHeight: 0.01,
    // 'y' = em pé (humanoide); 'x'/'z' deitam a cápsula pra corpo alongado
    // na horizontal (quadrúpede) — o corpo físico gira com Rotation.y, então
    // a cápsula deitada acompanha a frente da criatura ao virar.
    capsuleAxis: 'y',
    // Onde o model é renderizado em relação ao centro da cápsula (offset
    // local, em unidades de mundo — não escala com `model.scale`). Ajusta
    // junto toda vez que capsuleRadius/capsuleHalfHeight/capsuleAxis mudam.
    modelOffset: [0, 0, 0],
  },
  movement: {
    // Unidades por segundo (1 unidade = 1 metro).
    walkSpeed: 3,
    runSpeed: 7,
    // Fator de suavização do giro em direção ao movimento (rad/s aprox.).
    turnSpeed: 10,
    // Velocidade vertical inicial do pulo (m/s).
    jumpSpeed: 9,
  },
  // Opcional — sem isso, `cameraFollowSystem.js` usa os defaults globais
  // (`GAME_CONFIG.CAMERA.TARGET_HEIGHT`/`.SHOULDER_OFFSET`), os mesmos
  // que todo mundo usava antes desta espécie declarar algo próprio. Faz
  // sentido declarar quando o corpo desta espécie é bem diferente do
  // padrão (humanoide) — uma criatura pequena/quadrúpede com o ponto de
  // mira/enquadramento na altura de um humano fica olhando por cima da
  // cabeça dela, ou pro chão à frente. Pedido do usuário: "preciso que eu
  // possa configurar o posicionamento da câmera em relação ao modelo
  // jogável, para cada espécie, pois em tese vou poder controlar todas"
  // (docs/features/026-preparo-do-treinador-boy.md) — qualquer espécie pode
  // virar `InputControlled`/`CameraTarget` via troca de controle
  // (docs/features/018-troca-de-controle-treinador-criatura.md), não só
  // o treinador.
  camera: {
    // Altura (m, acima de `Position.y` — o CENTRO da cápsula física, não
    // o chão) do ponto que a câmera mira em modo livre e do "olho" usado
    // pro cálculo de yaw/pitch durante o lock-on (`cameraFollowSystem.js`,
    // ver docstring lá) — o principal dos dois campos, o que realmente
    // muda com o tamanho do corpo. Sem uma malha carregada pra medir no
    // navegador, um ponto de partida razoável é `body.capsuleRadius +
    // body.capsuleHalfHeight` (o topo da cápsula, em pé) mais uma folga
    // pequena pra cabeça — ajusta olhando o resultado em jogo, mesmo
    // espírito de todo outro "valor de partida" deste projeto.
    targetHeight: 1.5,
    // Deslocamento lateral (m) do enquadramento "sobre o ombro" durante a
    // mira travada (`AimAnchor`, exclusivo do TREINADOR — ver
    // `aimAnchorSystem.js`, criaturas nunca miram) — na prática só importa
    // pras espécies `kind: 'trainer'`; uma criatura pode omitir isso sem
    // problema nenhum (nunca é lido enquanto ela não mira). Opcional, cai
    // no default global (`GAME_CONFIG.CAMERA.SHOULDER_OFFSET`) se omitido.
    shoulderOffset: 0.4,
  },
  // Opcional — sem isso, o spawn usa os defaults do trait Vitals (100/100,
  // regen 2%/10%, delays/custos abaixo). Só declare se esta criatura
  // precisar de números próprios.
  vitals: {
    maxHp: 100,
    // % do máximo regenerado por segundo (enquanto não está no delay pós-dano).
    hpRegenPercent: 2,
    // Segundos sem regenerar HP depois de tomar dano.
    hpRegenDelayAfterDamage: 5,
    maxStamina: 100,
    staminaRegenPercent: 10,
    // Segundos sem regenerar stamina depois do último uso (correr/dash/pulo).
    staminaRegenDelayAfterUse: 3,
    // Stamina gasta por segundo enquanto realmente correndo.
    runStaminaDrainPerSecond: 2,
    // Custo de stamina do pulo, descontado uma vez no disparo.
    jumpStaminaCost: 3,
  },
  // `actions.throw`/`.consume`/`.summon`/`.recall` e `party` (arremesso,
  // consumo, invocar/recolher, distâncias de seguir o time) são exclusivos
  // do TREINADOR — não declare isso aqui pra uma criatura nova. Ver
  // `../bot/index.js` se algum dia existir uma segunda espécie `kind:
  // 'trainer'`.
  //
  // `attacks` (opcional — ver `../fox/index.js` pro exemplo simples e
  // `../004-charmander/index.js` pro exemplo COM override,
  // docs/features/025-ataque-comum-de-criatura.md) é o INVERSO: exclusivo
  // de criatura, o treinador não tem (sem arma direta no design, ver
  // docs/backlog.md). Botão esquerdo do mouse controlando esta espécie
  // dispara o ataque referenciado em `primary`. Só uma REFERÊNCIA por id
  // — a definição de verdade (duração, alcance, custo, visual, áudio...)
  // mora em `core/data/attacks/<id>/index.js` (registro reutilizável,
  // mesmo princípio de espécie/item — ver `core/data/attacks/_template/
  // index.js` pro que cada campo de lá significa). Sem este bloco, a
  // criatura simplesmente não ataca (`creatureAttackSystem.js` ignora, sem
  // quebrar nada):
  //      attacks: { primary: 'scratch' },        // usa a definição base tal como está
  // Precisa de um valor diferente do padrão só pra ESTA criatura (ex.:
  // alcance maior/menor pro tamanho do corpo)? Não duplica a definição
  // inteira — sobrescreve só o campo que precisa:
  //      attacks: {
  //        primary: { id: 'scratch', overrides: { range: 1, staminaCost: 4 } },
  //      },
  // `clips.attack` (opcional, acima em `clips`) é o clipe de animação do
  // gesto — sem ele, a ação toca com a pose de descanso (mesmo fallback
  // gracioso de `clips.recall`, ver core/data/animationStates.js) até
  // alguém autorar o clipe de verdade pra esta espécie. (O ataque
  // referenciado em `attacks.primary` também tem seu próprio
  // `animation.clipKey`, hoje sempre `'attack'` — ver docstring em
  // `core/data/attacks/_template/index.js`.)
  //
  // `sounds.summon`/`sounds.recall` (abaixo, ver
  // docs/features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Som de
  // invocar/recolher") são igualmente exclusivos do treinador — uma
  // criatura nunca invoca/recolhe outra, não faz sentido configurar isso
  // aqui.
  // Opcional — sem `sounds`, a espécie simplesmente não toca som de passo
  // (ver `resolveFootstepSound`, core/data/audio/footstepGroups.js). Duas
  // formas, escolha uma:
  // 1) Compartilha som/volume/alcance com outras espécies do mesmo grupo
  //    (mais comum — a maioria das criaturas cabe num punhado de grupos,
  //    ver `core/data/audio/footstepGroups.js` pros ids disponíveis):
  //      sounds: { footstepGroup: 'heavy' | 'light' | ... },
  // 2) Som PRÓPRIO, sem grupo — cada campo é um array de variações (toca
  //    uma ao acaso a cada passo, evita repetir sempre o mesmo clique):
  //      sounds: {
  //        footstep: {
  //          walk: ['/assets/audio/footsteps/.../walk-01.ogg', ...],
  //          run: ['/assets/audio/footsteps/.../run-01.ogg', ...],
  //          volume: 0.6, // opcional
  //          refDistance: 5, // opcional
  //        },
  //      },
  // `sounds.voice` (opcional, independente do passo) — vocalização
  // periódica (grito/som ambiente da criatura, tipo "cry"), sorteada
  // entre variações e tocada de novo em intervalos aleatórios (ver
  // `core/data/audio/voiceSound.js`/`../fox/index.js` pro formato de
  // verdade em uso):
  //      sounds: {
  //        voice: {
  //          clips: ['/assets/audio/voices/.../cry-01.ogg', ...],
  //          volume: 0.8, // opcional
  //          refDistance: 8, // opcional
  //          minInterval: 10, // opcional, segundos
  //          maxInterval: 25, // opcional, segundos
  //        },
  //      },
  // `sounds.dashGroup`/`sounds.jumpGroup` (opcionais, mesmo princípio de
  // `footstepGroup` — grupo compartilhado, ver `core/data/audio/
  // dashSound.js`/`jumpSound.js` pros ids disponíveis) — toca no INSTANTE
  // do dash/pulo, não por temporizador nem ciclo de passada. Som de
  // ATAQUE não fica em `sounds` — mora dentro da própria definição do
  // ataque (`audio.group`/`audio.clips` em `core/data/attacks/<id>/
  // index.js`, ver `attacks` acima), já que o som é característica do
  // ATAQUE (compartilhável entre espécies diferentes que usam o mesmo
  // ataque), não da espécie em si:
  //      sounds: { dashGroup: 'default', jumpGroup: 'default' },
  // Som PRÓPRIO de dash/pulo, sem grupo — mesmo formato de `footstep`
  // individual acima, um array de variações cada:
  //      sounds: {
  //        dash: { clips: ['/assets/audio/dash/.../dash-01.wav', ...], volume: 0.6 },
  //        jump: { clips: ['/assets/audio/jump/.../jump-01.wav', ...], volume: 0.6 },
  //      },
  // `sounds.summon`/`sounds.recall` (opcionais, SÓ FAZEM SENTIDO em `../bot/
  // index.js` — ver comentário "exclusivos do TREINADOR" acima; nenhuma
  // criatura nova declara isso) — mesmo formato de `dash`/`jump` acima
  // (sem grupo, um array de variações), tocado no INSTANTE em que a
  // criatura de fato aparece/some (`effectAt` de `actions.summon`/
  // `actions.recall`, não o clique do botão), ver docs/features/023-
  // estado-de-humor-e-piscar-de-olhos.md, seção "Som de invocar/recolher":
  //      sounds: {
  //        summon: { clips: ['/assets/audio/summon/summon-01.wav', ...], volume: 0.6 },
  //        recall: { clips: ['/assets/audio/recall/recall-01.wav', ...], volume: 0.6 },
  //      },
  // `vfx.tailFire` (opcional — ver `../004-charmander/index.js`, docs/
  // features/022-fogo-de-cauda-do-charmander.md) — fogo de partícula
  // encaixado num osso nomeado (`TAIL_BONE_BY_SPECIES`, hardcoded em
  // `useAnimatedModel.js` — nome de osso vem do rig, não é dado de
  // espécie; sem entrada lá pro `id` desta espécie, o campo abaixo não
  // faz nada mesmo se declarado). Todos os campos opcionais — ver
  // `createFlame` em `view/vfx/flameParticles.js` pro que cada um faz:
  //      vfx: {
  //        tailFire: {
  //          shape: 'cone', // 'cone' | 'cylinder' | 'inverseCone' | 'sphere' | 'diamond'
  //          width: 0.25, // multiplicador do raio da base — default calibrado pra fogueira, cauda é bem menor
  //          height: 0.35, // multiplicador da distância de subida
  //          density: 0.35, // multiplicador da quantidade de partícula
  //          turbulence: 1, // multiplicador do balanço lateral
  //          palette: 'fire', // 'fire' | 'greenFlame' | 'blueFlame' | 'purpleFlame'
  //          intensity: 1, // multiplicador de opacidade geral
  //          scale: 1, // multiplicador de escala geral do grupo (por cima da correção de escala do rig, ver tailFireSystem.js)
  //          speed: 1, // multiplicador do delta passado pra flame.update — chama mais rápida/lenta
  //          // Rotação LOCAL fixa (graus), por cima da orientação herdada
  //          // do osso — `bone.add()` faz o fogo herdar a rotação da
  //          // cauda inteira, então o eixo "pra cima" da partícula pode
  //          // sair torto/deitado dependendo de como o rig orienta esse
  //          // osso; ajusta na mão olhando o resultado no jogo (ver
  //          // tailFireSystem.js).
  //          rotation: { x: 0, y: 0, z: 0 },
  //          // Deslocamento LOCAL (unidades de mundo, ex.: 0.1 = 10cm) a
  //          // partir da origem do osso — o osso pode não ficar bem onde
  //          // a chama deveria nascer (ex.: um pouco além da ponta da
  //          // cauda). Ajusta na mão, mesmo espírito de `rotation` acima.
  //          position: { x: 0, y: 0, z: 0 },
  //          // Opcional — `false` (ou `{ enabled: false }`) desliga por
  //          // completo; sem declarar nada, sai com uma luz quente
  //          // moderada default. `THREE.PointLight` de verdade, filha do
  //          // MESMO grupo da chama — já acompanha escala/rotação/posição
  //          // acima de graça, sem configurar posição própria (a menos
  //          // que precise, ver `light.position` abaixo).
  //          light: {
  //            color: '#ff8a3d',
  //            distance: 3, // alcance da luz, unidades de mundo
  //            decay: 2,
  //            baseIntensity: 1.5, // brilho base, antes do flicker
  //            flickerSpeed: 18, // frequência da oscilação senoidal
  //            flickerAmount: 0.15, // amplitude da oscilação senoidal
  //            flickerNoise: 0.1, // amplitude do tremor aleatório por cima
  //            position: { x: 0, y: 0.15, z: 0 }, // offset local dentro do grupo da chama
  //            // false por padrão — sombra de PointLight é cara (cubemap,
  //            // 6 passes), repetida por entidade com fogo. Liga só quem
  //            // quiser pagar o custo.
  //            castShadow: false,
  //            shadowMapSize: 512,
  //          },
  //        },
  //      },
  stats: {},
  moves: [],
}
