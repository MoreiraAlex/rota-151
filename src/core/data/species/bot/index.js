import IDLE_CLIP from './clips/idle.json'
import WALK_CLIP from './clips/walk.json'
import RUN_CLIP from './clips/run.json'
import THROW_CLIP from './clips/throw.json'


export const BOT = {
  id: 'bot',
  dexNumber: null,
  kind: 'trainer',
  model: {
    path: '/assets/models/bot.glb',
    scale: 0.015,
  },
  clips: {
    idle: IDLE_CLIP,
    walk: WALK_CLIP,
    run: RUN_CLIP,
    throw: THROW_CLIP,
  },
  body: {
    capsuleRadius: 0.4,
    capsuleHalfHeight: 0.95,
    capsuleAxis: 'y',
    modelOffset: [0, -1.4, 0],
  },
  movement: {
    walkSpeed: 2.5,
    runSpeed: 6,
    turnSpeed: 10,
    jumpSpeed: 9,
  },
  vitals: {
    maxHp: 100,
    hpRegenPercent: 0.15,
    // Segundos sem regenerar HP depois de tomar dano.
    hpRegenDelayAfterDamage: 5,
    maxStamina: 100,
    staminaRegenPercent: 5,
    // Segundos sem regenerar stamina depois do último uso (correr/dash/pulo).
    staminaRegenDelayAfterUse: 3,
    // Stamina gasta por segundo enquanto realmente correndo.
    runStaminaDrainPerSecond: 2,
    // Custo de stamina do pulo, descontado uma vez no disparo.
    jumpStaminaCost: 10,
  },
  // Exclusivo do treinador (`getPlayerSpecies()`, ver
  // core/data/species/index.js) — arremesso/consumo/invocar/recolher só
  // ele dispara de verdade (item/Party de verdade só existem nele), então
  // não faz sentido uma criatura declarar isso (ver `_template/index.js`).
  actions: {
    throw: {
      // Duração total da ação (segundos) — precisa bater com a duração de
      // verdade do clipe de animação de arremesso (`clips/throw.json`):
      // clipes de AÇÃO (não cíclicos) usam `speed` como `1/duração`
      // (mesma leitura de "ciclos/segundo" dos clipes de locomoção, mas
      // aqui vira "a ação inteira é 1 ciclo" — ver a skill
      // procedural-rig-animation, referências/animations/one-shot-
      // actions.md). O clipe do bot tem `speed: 2.5` → 1/2.5 = 0.4s. Errar
      // esse valor (maior que o real) faz o gesto reiniciar do início e
      // ficar visivelmente "engasgado" antes de cortar pro idle — o motor
      // não trava o clipe no fim (`loop: false` no JSON é só documentação,
      // não é lido em lugar nenhum), ele só repete o mesmo gesto fechado.
      duration: 0.4,
      // Instante (dentro da duração) em que o projétil é de fato spawnado —
      // não é keyframe de clipe, é config da própria ação (ver
      // docs/features/014-arremessar-usar-e-invocar.md). Devia coincidir
      // com o frame em que a MÃO solta o objeto no clipe de animação —
      // isso não dá pra derivar só do `speed` (fica na forma da curva, não
      // no número), então por enquanto é a mesma fração que já estava
      // ajustada antes (0.45/0.5 = 90% da duração antiga), só reescalada
      // pra duração certa (0.4 × 90% = 0.36) — ainda precisa de olho no
      // jogo pra confirmar se bate com a soltura visual de verdade.
      effectAt: 0.3,
      // Origem do arremesso (de onde a trajetória sai e onde o projétil
      // nasce) — aproxima a posição da MÃO a partir de `Position`/
      // `Rotation.y` do jogador, já que o motor não tem acesso ao osso de
      // verdade daqui (isso é conteúdo da view — ver
      // `view/systems/heldItemViewSystem.js`, que só cuida do visual
      // encaixado no osso, não da trajetória/spawn). Componentes somados
      // na direção que o corpo encara (`handForwardOffset`, à frente) e à
      // direita dele (`handSideOffset`) — mesma convenção de forward/right
      // usada em todo o resto (`computeCameraRight`, `movementSystem.js`).
      // `handHeightOffset` substitui o antigo "+1" fixo.
      handForwardOffset: 0.15,
      handSideOffset: -0.25,
      handHeightOffset: 1.25,
      // Velocidade do projétil (m/s). Ainda global por item — só existe um
      // throwable de teste hoje; migra pra config por item quando um
      // segundo precisar de velocidade diferente.
      speed: 45,
      // Segundos até o projétil desaparecer sozinho, mesmo já tendo
      // atingido algo (congelado no ponto do impacto até então).
      lifetime: 1.5,
      // Alcance máximo (m) do raycast de mira, a partir da câmera — nada
      // encontrado dentro dessa distância, mira no ponto mais distante
      // dessa distância mesmo (em vez de mirar no infinito).
      aimRange: 30,
      // Custo de stamina, descontado uma vez no disparo (não por segundo) —
      // mesmo padrão do dash. Sem stamina suficiente, o arremesso
      // simplesmente não dispara.
      staminaCost: 2,
    },
    consume: {
      // Duração total da ação (segundos).
      duration: 0.4,
      // Instante em que o efeito do item (cura, ver `item.consumable`) é
      // de fato aplicado.
      effectAt: 0.2,
      // Quanto tempo o efeito visual de partículas (ConsumeEffect) fica na
      // cena depois de spawnado — independente da duração da ação em si.
      effectVisualDuration: 0.6,
    },
    // Invocar/recolher criatura de time (ver `partySummonSystem.js` e
    // docs/features/017-locomocao-e-recolhimento-de-criaturas.md) — mesmo
    // padrão de ação com duração/efeito-no-meio de dash/throw/consume.
    summon: {
      // Duração total da ação (segundos) — trava movimento e qualquer
      // outra ação até terminar.
      duration: 0.6,
      // Instante em que a `SummonedCreature` de fato nasce.
      effectAt: 0.3,
    },
    recall: {
      // Duração total da ação (segundos).
      duration: 0.6,
      // Instante em que a `SummonedCreature` de fato é destruída.
      effectAt: 0.3,
    },
  },
  // Comportamento de "seguir o treinador" de toda criatura de time — ver
  // `creatureFollowSystem.js` e docs/features/017-locomocao-e-
  // recolhimento-de-criaturas.md. Exclusivo do treinador pelo mesmo motivo
  // de `actions` acima: é sempre em relação a QUEM TEM `Party`.
  party: {
    // Distância inicial (m) da criatura ao nascer (no instante de efeito
    // da ação de invocar), na direção que a CÂMERA está apontando.
    summonOffset: 15,
    // Distância mínima (m) que a criatura mantém do treinador — não chega
    // mais perto que isso, pra não empilhar em cima dele.
    followMinDistance: 4,
    // Distância (m) além da qual a criatura corre (`runSpeed`, por
    // espécie DELA) em vez de andar (`walkSpeed`) pra alcançar o
    // treinador. Entre `followMinDistance` e este valor, anda; abaixo de
    // `followMinDistance`, parada.
    runDistance: 6,
    // Distância (m) abaixo da qual outro personagem (treinador ou outra
    // criatura) conta como "muito perto" — soma repulsão na direção de
    // movimento pra desviar ANTES de esbarrar de verdade (personagens
    // colidem fisicamente de propósito, ver core/physics/colliders.js —
    // isso aqui evita precisar chegar nesse ponto). Maior que a soma dos
    // raios de duas cápsulas típicas.
    avoidanceRadius: 2.5,
    // Peso da repulsão de `avoidanceRadius` em relação à direção principal
    // (waypoint/treinador, sempre vetor unitário) — cada vizinho próximo
    // soma até este tanto na direção final antes de normalizar.
    avoidanceStrength: 1.2,
  },
  stats: {},
  moves: [],
}
