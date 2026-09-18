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
  },
  clips: {
    // idle: IDLE_CLIP,
    // walk: WALK_CLIP,
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
    jumpStaminaCost: 10,
  },
  // `actions`/`party` (arremesso/consumo/invocar/recolher e distâncias de
  // seguir o time) são exclusivos do TREINADOR — não declare aqui pra uma
  // criatura nova. Ver `../bot/index.js` se algum dia existir uma segunda
  // espécie `kind: 'trainer'`.
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
  // do dash/pulo, não por temporizador nem ciclo de passada:
  //      sounds: { dashGroup: 'default', jumpGroup: 'default' },
  // Som PRÓPRIO de dash/pulo, sem grupo — mesmo formato de `footstep`
  // individual acima, um array de variações cada:
  //      sounds: {
  //        dash: { clips: ['/assets/audio/dash/.../dash-01.wav', ...], volume: 0.6 },
  //        jump: { clips: ['/assets/audio/jump/.../jump-01.wav', ...], volume: 0.6 },
  //      },
  stats: {},
  moves: [],
}
