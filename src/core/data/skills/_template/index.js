/**
 * Molde de um GOLPE (skill) de criatura — o único tipo de ataque delas (não
 * existe ataque básico, docs/features/039-tipos-e-combate-classico.md, Parte 5).
 * Copia esta pasta pra `<id>/`
 * (ex.: `../tackle/`) — um `index.js` só, sem sub-recursos próprios (o
 * visual/áudio de verdade vivem na VIEW, referenciados por id — ver
 * `visual.effectGroup`/`audio.group` abaixo). Ver `../tackle/index.js`/
 * `../punch/index.js` como exemplos completos e funcionais.
 *
 * PRA QUE ISSO EXISTE (ver docs/features/025-ataque-comum-de-criatura.md,
 * seção "reorganização da config"): antes, cada espécie inlinava sua
 * própria cópia de `actions.attack` (duração, alcance, custo, grupo
 * visual, etc.) — cinco espécies, cinco cópias quase idênticas. Um
 * ATAQUE agora é um recurso reutilizável e nomeado (mesmo princípio de
 * `core/data/species/`/`core/data/items/`): esta pasta é a definição
 * BASE, `core/data/skills/index.js` é o registro, e uma espécie só
 * REFERENCIA o id dela nos slots Q/E/R (`species.skills[1] =
 * 'tackle'`) em vez de duplicar os números. Precisa de um valor diferente do padrão pra UMA
 * criatura específica? Não duplica a definição inteira — referencia com
 * OVERRIDE (ver "Override por criatura" no fim deste arquivo).
 *
 * Pra adicionar um ataque:
 * 1) copia `_template/` pra `<id>/` (ex.: `whip/`)
 * 2) preenche `index.js`
 * 3) importa em `../index.js` e adiciona uma linha no SKILL_REGISTRY
 * 4) se o visual for novo (não reaproveita `'tackle'`/`'punch'`), cria o
 *    componente em `view/scene/attackEffects/` e registra em
 *    `view/scene/attackEffects/registry.js` (ver docstring lá)
 */
export const SKILL_TEMPLATE = {
  // Minúsculo, kebab-case — é o que `species.skills[N]` referencia
  // (ver core/data/species/*/index.js) e a chave em SKILL_REGISTRY.
  id: 'nome-do-ataque',
  // Tipo elemental do golpe — um id de `core/data/types/index.js` ('fire',
  // 'water'...). Todo golpe tem, inclusive os de status. Golpe de dano: STAB
  // (`resolveStab`) e efetividade contra os tipos do alvo (tabela da Gen 1);
  // golpe de status ignora a tabela. Também escolhe o impacto genérico
  // (`visual.impactType` vence). Ausente = 'normal'.
  type: 'normal',
  // Opcional — tipos do ALVO em que este golpe de STATUS não pega (regra
  // pontual, ex.: Leech Seed não pega em Planta). Golpe de dano usa a tabela.
  // immuneTypes: ['grass'],

  // === Mecanismo (creatureAttackSystem.js) ===
  // Duração total do gesto (segundos) — trava a criatura (ActionState)
  // até acabar. Devia bater com a duração de verdade do clipe de
  // animação quando existir (ver `animation.clipKey` abaixo) — clipes de
  // AÇÃO usam `speed` como `1/duração`, mesma convenção de
  // `actions.throw`/`.summon` do treinador (core/data/species/boy/index.js).
  duration: 0.5,
  // Opcional (na skill, ou por espécie via `skills[N].overrides`):
  // quantos frames da animação EMBUTIDA (`.glb`) tocar, a partir do
  // início — corta um final indesejado; o trecho que sobra é esticado pra
  // caber em `duration`. Ausente/`null` = todos. Contagem de frames de
  // cada animação: `npm run extract:glb-animation -- --file <glb> --list`.
  // animationFrames: 40,
  // Instante (dentro de `duration`) em que o efeito de verdade acontece
  // (VFX nasce, som toca) — não é keyframe de clipe, é config do próprio
  // ataque.
  effectAt: 0.25,
  // Alcance (m) da trajetória, medido na HORIZONTAL (combate 2.5D): o
  // golpe anda isso mantendo a mesma altura acima do terreno, e para antes
  // se encontrar parede ou desnível (`resolveAttackImpactPoint`,
  // creatureAttackSystem.js) — não "teleporta" através de nada.
  range: 1.4,
  // Corpo a corpo ou à distância — o golpe sai sempre na horizontal, pra
  // onde a câmera olha (`resolveAttackDirection`, core/battle/attackAim.js),
  // sem assistência de mira. Quem lê é a IA (`aiMovement.js`): com golpe
  // 'ranged' ela mantém distância em vez de encostar.
  // - 'melee' / 'ranged' (ou ausente = 'ranged').
  // Na criatura controlada, a direção acompanha a câmera
  // enquanto o aviso carrega (do disparo até o `effectAt`) e trava no golpe
  // (`GAME_CONFIG.BATTLE.ATTACK_WINDUP_STEERING`).
  aim: 'melee',
  // Como o botão lança o golpe (`creatureAttackSystem.js`):
  // - 'confirm': o 1º aperto só mostra o indicador de alcance (leque azul,
  //   `AttackIndicatorView.jsx`); clique ou a mesma tecla de novo lança,
  //   botão direito cancela.
  // - 'instant' (ou ausente): lança assim que aperta.
  // O modo debug (F2) força 'confirm' em todo ataque. Uma criatura pode
  // trocar só pra ela: `skills[1]: { id, overrides: { castMode:
  // 'instant' } }`.
  castMode: 'instant',
  // Raio (m) da área efetiva — a "grossura" da trajetória inteira do
  // golpe (uma cápsula da origem até o fim do `range`), não só da ponta.
  // Dimensiona o VFX, o indicador de alcance (AttackIndicatorView.jsx) E a
  // detecção de acerto de verdade (`resolveAttackTarget`,
  // creatureAttackSystem.js — geométrica, soma este raio ao
  // `capsuleRadius` do alvo, sem shape-query do Rapier).
  radius: 0.3,
  // Custo de energia (descontado uma vez no disparo) e recarga (segundos,
  // contados a partir do FIM da ação — `AttackCooldowns.<slot>`, um campo
  // por slot, decrementado todo tick): NÃO se escrevem — saem da fórmula
  // (`core/battle/actionCost.js`, docs/features/035-balanceamento-
  // de-acoes-e-correcoes.md) pelo PESO do golpe (`damage.power` + o peso de cada efeito,
  // × bônus de cone e de alcance):
  //   custo   = (2·nível/5 + 2) × peso / ACTION_COST.COST_DIVISOR
  //   recarga = peso × ACTION_COST.COOLDOWN_PER_WEIGHT × fator de speed
  // `duration`/`effectAt` também escalam pelo `speed` da criatura. Pra
  // fugir da fórmula numa skill, escreva o valor aqui (ou no override da
  // espécie, `skills[N].overrides`) — escrito sempre ganha:
  // staminaCost: 2,
  // cooldown: 3,
  // Horas de TREINO pra aprender o golpe (docs/features/038-*) — pela mesma
  // régua: peso ÷ 100 × MOVES.TRAINING.LEARN_HOURS_PER_100_WEIGHT (mínimo
  // MIN_LEARN_HOURS); dominar treinando leva MASTERY_HOURS_MULTIPLIER vezes
  // isso. Escrito aqui (ou no override) ganha da fórmula:
  // trainingHours: 8,
  //
  // `ai.weight` (mais abaixo) mexe só na nota da IA, não no preço.
  // Como o dano é aplicado:
  // - ausente/`'impact'` (padrão): UMA vez, no `effectAt`, no primeiro alvo
  //   da trajetória (`resolveAttackTarget`).
  // - `'channel'`: em TODOS os alvos dentro do cone (mesmo leque do
  //   indicador) a cada `damageInterval` segundos, do `effectAt` até o fim
  //   da `duration`. Exige SEGURAR o botão do slot até o fim — soltar
  //   cancela a ação (e o cooldown começa). Ver `core/battle/channelAttack.js`.
  //   Com `area: 'line'` (abaixo) vira FEIXE: só o primeiro corpo na linha leva
  //   cada tick, e a criatura controlada mira o canal inteiro (ex.: Water Gun).
  // damageMode: 'channel',
  // damageInterval: 0.25,

  // === Visual (view/scene/attackEffects/*) ===
  visual: {
    // QUAL componente de view desenha o efeito — ver
    // view/scene/attackEffects/registry.js. Vários ataques podem apontar
    // pro MESMO grupo (compartilham o visual), mesmo princípio de
    // `footstepGroup` (core/data/audio/footstepGroups.js).
    // 'none' = sem efeito visual de impacto (nenhum `AttackEffect` nasce) — um
    // golpe de status como o Growl, mostrado por texto + tremor do alvo.
    effectGroup: 'tackle',
    // Quanto tempo (s) o efeito visual (AttackEffect) fica na cena depois
    // de nascer — independente de `duration` (o gesto pode já ter
    // liberado a criatura antes do VFX sumir).
    effectVisualDuration: 0.35,
    // Multiplicador de TAMANHO do VFX — pedido explícito do usuário: uma
    // criatura grande deve ter o efeito maior que uma pequena, mesmo as
    // duas usando o MESMO ataque/visual. `1` = tamanho de referência
    // desta definição; uma criatura fora do padrão sobrescreve só isto
    // (`skills[N].overrides.visual.scale`), sem duplicar o resto.
    // Multiplica por cima da constante de normalização do rip que cada
    // componente de view já tem (`*_BASE_SCALE`, unidade arbitrária do
    // `.obj` de origem) — não a substitui.
    scale: 1,
    // Opcional, só o grupo 'tackle' usa hoje — revelação progressiva do
    // efeito (0% a 100% do "traço" visível ao longo desses segundos, em
    // vez de aparecer inteiro de uma vez). `0` (ou omitido) = revelado
    // por inteiro desde o primeiro frame.
    revealDuration: 0,
    // Opcional — ajuste fino de orientação (GRAUS, mesma convenção de
    // vfx.tailFire.rotation em core/data/species/*/index.js), somado por
    // cima da direção real do golpe (pitch+yaw, calculados a partir da
    // câmera). A malha de origem pode não ter o "forward" alinhado com a
    // convenção do jogo — corrige aqui olhando o resultado em jogo.
    rotationOffset: { x: 0, y: 0, z: 0 },
    // Opcional — desloca o PONTO DE PARTIDA do VFX (METROS), no
    // referencial do golpe: +Z = direção do golpe, +Y = pra cima, +X = pro
    // lado (esquerda de quem olha na direção do golpe). Só a saída do golpe
    // anda (ex.: subir a boca do jato); o ponto de IMPACTO continua o do
    // `range`, e o efeito se reorienta/estica da nova partida até ele. Não
    // muda dano nem alcance (só o visual) nem depende do `rotationOffset`.
    positionOffset: { x: 0, y: 0, z: 0 },
    // Opcional — só pro grupo `'impact'` (impacto genérico por tipo): o tipo
    // do golpe, que escolhe as partículas ('normal', 'fire', 'water',
    // 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying',
    // 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'fairy',
    // 'steel'). Sem ele cai no `type` do golpe; sem os dois, 'normal'.
    // impactType: 'fire',
    // Opcional — grupo de VFX que nasce em CADA alvo atingido por um golpe de
    // efeito (ex.: a fumaça no corpo de quem levou o Smokescreen), além do
    // `effectGroup` (o visual do golpe em si). `targetEffectVisualDuration` =
    // quanto ele dura (s).
    // targetEffectGroup: 'smokescreen-target',
    // targetEffectVisualDuration: 3,
    // Opcional — efeito de CARGA: roda em volta da criatura do disparo até o
    // `effectAt` (a janela do aviso no chão) e acaba no efeito ou se o golpe
    // for interrompido. Grupos em `view/scene/ContinuousAttackEffectsView.jsx`
    // ('absorb' = orbes verdes se fechando no corpo). Usa `radius` e `scale`.
    // chargeGroup: 'absorb',
    // Opcional — só no canalizado: efeito do CANAL, do `effectAt` até a ação
    // acabar, saindo da boca e seguindo a mira (`'water-jet'`, mesmos grupos da
    // carga); e `channelHitGroup` = o efeito de CADA tick do feixe, onde ele
    // bate (`channelHitVisualDuration` = quanto dura).
    // channelGroup: 'water-jet',
    // channelHitGroup: 'water-gun-hit',
    // channelHitVisualDuration: 0.9,
    // Opcional — efeito da AÇÃO: do `effectAt` até a ação acabar (qualquer
    // golpe, não só canalizado), preso à criatura e virado pra onde ela olha
    // (`'tail-whip'`, mesmos grupos da carga). Aqui `positionOffset` desloca o
    // pivô do efeito (na frente do corpo), `rotationOffset.y` gira o efeito em
    // volta do PRÓPRIO pivô (não sai do lugar) e `rotationOffset.z` gira as
    // partículas no plano da tela. Combina com
    // `effectGroup: 'none'` quando o golpe não tem visual de impacto.
    // actionGroup: 'tail-whip',
  },

  // === Áudio (core/data/audio/attackSound.js) ===
  audio: {
    // Grupo compartilhado (ver ATTACK_SOUND_GROUPS em
    // core/data/audio/attackSound.js) — vários ataques podem tocar o
    // MESMO som. Toca no instante `effectAt` (AttackPulse), não no
    // início do gesto. `null` = sem som configurado ainda (ex.: skill
    // nova, som ainda não definido/gravado) — `resolveAttackSound`
    // devolve `null` graciosamente, sem tocar nada.
    group: 'punch',
    // `group: 'impact'` — o som de impacto do TIPO do golpe (8 variações por
    // tipo, o mesmo tipo do visual `effectGroup: 'impact'`: `visual.impactType`,
    // senão o `type` do golpe, senão 'normal').
    // Grupos COMPOSTOS (`ATTACK_SOUND_COMPOSITES`, ex.: 'ember', 'flamethrower')
    // tocam VÁRIOS sons por golpe, cada um com o seu atraso (atacante na hora,
    // alvo no impacto).
    // `cry: true` — a criatura VOCALIZA no `effectAt` (o grito da espécie, com a
    // boca sincronizada), em vez de tocar um som de ataque. Combina com
    // `group: null` (ex.: Growl).
    // cry: true,
    // Opcional — som de CARGA, em LOOP do disparo até o `effectAt` (para no
    // efeito ou se o golpe for interrompido). Um grupo simples de
    // ATTACK_SOUND_GROUPS (ex.: 'absorb-charge', o do Growth).
    // chargeGroup: 'absorb-charge',
    // Opcional — som da AÇÃO, em LOOP do `effectAt` até a ação acabar
    // (cortado no fim da `duration`; para se o golpe for interrompido). Combina
    // com `group: null` (ex.: 'tail-whip', o do Tail Whip).
    // actionGroup: 'tail-whip',
    // Alternativa a `group` — som PRÓPRIO deste ataque, sem grupo (nunca
    // os dois juntos): { clips: ['/assets/audio/attack/.../x.wav', ...],
    // volume: 0.6, refDistance: 6 }.
  },

  // === Animação
  animation: {
    // Chave em `species.nativeAnimations` (ou `clips`) que este ataque
    // toca — ex.: `'attackRanged'` pra uma skill à distância. A espécie
    // que não tiver essa chave toca a `'attack'` (padrão). Caminho:
    // `creatureAttackSystem` grava em `ActionState.animationKey` no
    // disparo, e o `animationSystem` troca a animação do estado `attack`
    // por ela (docs/features/033-skills-de-combate-e-vfx.md).
    clipKey: 'attack',
  },

  // === Dano (core/battle/calculateDamage.js) ===
  // `null` = ataque sem dano configurado ainda — `creatureAttackSystem.js`
  // detecta o alvo dentro da área efetiva mas não aplica nada (mesmo
  // fallback gracioso de sempre). Preenchendo:
  damage: {
    // Poder do golpe — entra direto na fórmula de dano. Ataques SEM poder
    // definido usam `1` (default do parâmetro em `calculateDamage`).
    power: 40,
    // 'physical' (usa `attack`/`defense` da criatura) ou 'special' (usa
    // `sp_atk`/`sp_def`) — decide qual par de status a fórmula usa. Sem
    // este campo, `resolveDamageAmount` assume 'physical'.
    category: 'physical',
  },

  // === Precisão (core/battle/accuracy.js) ===
  // Opcional — chance base (%) de o golpe acertar, a regra do Pokémon: o
  // sorteio usa `accuracy × multiplicador do estágio de PRECISÃO de quem
  // ataca` (Smokescreen baixa esse estágio). Omitido = 100 (só erra se a
  // precisão do atacante estiver baixa); `null` = nunca erra. Vale pro golpe
  // normal e pros de status; o canalizado (tick a tick) não sorteia.
  // accuracy: 100,

  // === Efeitos de STATUS (core/battle/statStages.js) ===
  // O que o golpe MUDA no alvo, separado do dano: uma skill pode ter `damage`,
  // `effects` ou os dois. Uma skill de status pura (ex.: `growl`) tem
  // `damage: null` — ninguém "apanha" — e só `effects`. Omitido = sem efeitos.
  // Cada efeito é aplicado em cada alvo atingido, no `effectAt`:
  // effects: [
  //   // `statStage`: soma `stages` ao estágio do `stat` ('attack', 'defense',
  //   // 'sp_atk', 'sp_def' ou 'accuracy'), de -6 a +6 (convenção do Pokémon: cada estágio
  //   // multiplica o atributo, -1 = ×2/3, +1 = ×3/2). Dura `duration`
  //   // segundos (jogo em tempo real) e usar de novo ACUMULA o estágio e
  //   // RENOVA o tempo.
  //   { type: 'statStage', stat: 'attack', stages: -1, duration: 15 },
  //   // `leechSeed` — planta uma semente no alvo: a cada `interval` segundos
  //   // drena `fraction` do HP máximo dele e cura quem plantou o mesmo valor,
  //   // por `duration` segundos (renovável). Ex.: o Leech Seed.
  //   { type: 'leechSeed', fraction: 1 / 8, interval: 2, duration: 10 },
  //   // `burn` — QUEIMA o alvo com `chance` (0-1): a cada `interval` segundos
  //   // tira `fraction` do HP máximo, por `duration` segundos (renovável), e o
  //   // Ataque de quem está queimado é multiplicado por `attackMultiplier`
  //   // (só golpe físico). `immuneTypes`: tipos que não queimam. Num golpe de
  //   // DANO é efeito secundário: só no alvo que levou o dano, sem sortear a
  //   // precisão de novo (no canalizado, uma vez por alvo por lançamento).
  //   // Ex.: o Ember. Uma espécie muda os valores pelos `overrides` da skill
  //   // (`effects` inteiro).
  //   { type: 'burn', chance: 0.1, fraction: 1 / 16, interval: 2, duration: 8,
  //     attackMultiplier: 0.5, immuneTypes: ['fire'] },
  // ],
  // Quem é atingido por um golpe SÓ de efeito: `area: 'cone'` (abaixo) = todos
  // os inimigos no cone à frente; sem ele, o primeiro corpo no caminho.
  // `area: 'cone'` — o golpe atinge um CONE (indicador, aviso vermelho e alvos
  // com a mesma forma do canalizado, aberto por `radius / range`) em vez da
  // cápsula; um canalizado já é cone, a menos que seja `'line'`.
  // `area: 'line'` — só pro canalizado: FEIXE em vez de cone (a cápsula do golpe
  // normal, primeiro corpo só, mirando durante o canal — `isBeamAttack`).
  // `area: 'self'` — o golpe age em QUEM USOU (ex.: Growth, `../growth/`): os
  // `effects` vão no atacante, sem sorteio de precisão e sem provocar
  // ninguém; sem indicador nem aviso; o VFX nasce nos pés dele.
  // area: 'cone',

  // === IA (core/battle/aiAttackChoice.js) ===
  // Opcional — a IA (selvagens e time fora do controle) dá nota a cada golpe
  // só pelos campos acima (poder, área, efeitos), sem nada por skill. `weight`
  // multiplica essa nota: ajuste fino de UMA skill que pareça usada demais
  // (< 1) ou de menos (> 1) em jogo. Uma espécie pode mudar só pra ela via
  // `skills[N].overrides.ai`. Omitido = 1.
  // ai: { weight: 1 },

  // === Visual do HUD (view/shared/statusDisplay.jsx, `AttackIcon`) ===
  // Opcional — sem isto, o ícone do slot (SkillsHud.jsx Q/E/R e
  // ActionSlotHud.jsx clique, quando é a criatura no controle) cai no
  // quadrado colorido de sempre (`ATTACK_COLORS`, view/attackColors.js).
  // Mesmo formato/raciocínio de `species.sprite` (core/data/species/
  // _template/index.js): `path` é a imagem de verdade; `scale` (opcional,
  // default 1) compensa margem/padding inconsistente dentro do próprio
  // arquivo de origem — cada ataque ajusta o valor olhando o resultado.
  // sprite: { path: '/assets/sprites/attacks/<id>.png', scale: 1 },
}

// === Override por criatura ===
// `species.skills[N]` (core/data/species/*/index.js) aceita DUAS
// formas:
//   skills: { 1: 'tackle' },                    // sem override
//   skills: { 1: { id: 'tackle', overrides: {   // com override
//     staminaCost: 10,                      // foge da fórmula de custo
//     visual: { rotationOffset: { x: 0, y: 90, z: 0 }, positionOffset: { x: 0, y: 0.2, z: 0 } },
//   } } },
// `resolveSkill` (core/data/skills/index.js) mescla a definição
// BASE (esta aqui) com `overrides` — por SEÇÃO (`visual`/`audio`/
// `animation` mesclados campo a campo, não substituídos inteiros; o
// resto dos campos, direto). Só declara o que precisa ser diferente do
// padrão — o resto vem da definição base, sem duplicar nada.
