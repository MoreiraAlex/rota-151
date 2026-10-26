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
  // Descrição pro jogador (slot da HUD, treino e escolha de golpe), no
  // estilo das habilidades do LoL: o que o golpe faz, em linguagem de jogo.
  // Números entram por marcador (`{power}`, `{range:m}`,
  // `{effects.0.duration:s}`...), preenchidos com o golpe RESOLVIDO (grupo e
  // override da espécie) — ver `view/shared/skillDescription.js`. Uma espécie
  // troca o texto inteiro pelos `overrides`. Ausente = sem descrição.
  description: 'O que o golpe faz, com {power} de poder.',
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
  // GRUPO do golpe (docs/features/061-revisao-das-skills.md) — dá o alcance,
  // a forma, a largura e o `aim` da IA, FIXOS por grupo
  // (`GAME_CONFIG.ATTACK_GROUPS`, aplicados em `resolveSkill`): nem o golpe
  // nem a espécie escrevem `range`/`radius`/`aim`/`area`. Pelo alvo do golpe
  // na série (`docs/reference/golpes-dos-151.md`):
  // - 'melee': um alvo, com contato — cápsula curta, a IA encosta.
  // - 'ranged': um alvo, sem contato — cápsula longa e fina, a IA mantém
  //   distância.
  // - 'cone': inimigos em volta — cone pra frente, pega todos dentro.
  // - 'self': só quem usa — círculo nos pés, sem alvo.
  // O `range` conta da BORDA do trigger de quem ataca e a área começa nela
  // (`resolveAttackAreaStart`); o golpe sai sempre na horizontal, pra onde a
  // câmera olha, acompanhando o terreno e parando em parede ou desnível.
  group: 'melee',
  // Modo de execução (opcional; o padrão vem do grupo — 'charge' em 'self',
  // 'instant' no resto), alterável golpe a golpe e por espécie:
  // - 'instant': aperta e o golpe sai, vai até o fim sozinho.
  // - 'charge': segura até o `effectAt` — soltar antes cancela; levar dano
  //   antes dele também (o único modo que o dano interrompe).
  // - 'channel': segura o tempo todo — dano em ticks a cada `damageInterval`
  //   s, do `effectAt` até o fim; soltar encerra. O canal inteiro vale o dano
  //   de um golpe. Na cápsula é FEIXE (só o primeiro corpo leva cada tick, e
  //   a criatura controlada mira o canal inteiro, ex.: Water Gun); no cone,
  //   todos dentro (ex.: Razor Leaf). Ver `core/battle/channelAttack.js`.
  // execution: 'channel',
  // damageInterval: 0.25,
  // Arrancada (opcional): a partir do `effectAt` quem ataca corre na direção
  // do golpe até `distance` m em `duration` s (parando ao encostar no
  // primeiro alvo no caminho), e o ACERTO vem quando ela chega
  // (`effectAt + duration`), de onde chegou — o golpe alcança `distance` a
  // mais que o `range`, e a IA conta isso (`core/battle/attackLunge.js`, ex.:
  // Quick Attack). Visual e som da arrancada: `visual.lungeGroup` e
  // `audio.lungeGroup`.
  // lunge: { distance: 2.5, duration: 0.15 },
  // Vários acertos (opcional): o primeiro acerto num alvo único sorteia
  // quantos vêm (`counts`, pelo peso de cada um em `weights`) e os seguintes
  // vão no mesmo alvo, um a cada `interval` s (escala com a velocidade), sem
  // sortear precisão de novo (`core/battle/multiHit.js`, ex.: Fury Attack).
  // A `duration` precisa caber o último acerto possível.
  // multiHit: { counts: [2, 3], weights: [1, 1], interval: 0.15 },
  // Efeitos em QUEM USA num golpe que não é em si mesmo (opcional, só quando
  // ele acerta alguém — `applySelfEffects`, ex.: Rapid Spin): os mesmos tipos
  // de `effects` e `removeConditions` (tira as condições listadas de quem
  // usa). A IA e o custo contam com eles.
  // selfEffects: [
  //   { type: 'statStage', stat: 'speed', stages: 1, duration: 15 },
  //   { type: 'removeConditions', conditions: ['bound'] },
  // ],
  // Duração total do gesto (segundos) — trava a criatura (ActionState)
  // até acabar. POR ESPÉCIE (cada uma tem a sua animação: `skills[N].
  // overrides`); a do golpe é só o padrão. Devia bater com a duração de
  // verdade do clipe de animação (ver `animation.clipKey` abaixo) — clipes
  // de AÇÃO usam `speed` como `1/duração`, mesma convenção de
  // `actions.throw`/`.summon` do treinador (core/data/species/boy/index.js).
  duration: 1.2,
  // Opcional (na skill, ou por espécie via `skills[N].overrides`):
  // quantos frames da animação EMBUTIDA (`.glb`) tocar, a partir do
  // início — corta um final indesejado; o trecho que sobra é esticado pra
  // caber em `duration`. Ausente/`null` = todos. Contagem de frames de
  // cada animação: `npm run extract:glb-animation -- --file <glb> --list`.
  // animationFrames: 40,
  // Instante (dentro de `duration`) em que o efeito de verdade acontece
  // (VFX nasce, som toca) — não é keyframe de clipe, é config do próprio
  // ataque. Também por espécie; o padrão fica em 40% da `duration`.
  effectAt: 0.5,
  // Mostrar o alcance antes de lançar (o 1º aperto abre o indicador, o 2º
  // lança) é opção do JOGADOR, não do golpe — hoje só o modo debug (F2)
  // liga (`castModeOverride`).
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
    // Opcional — multiplica o `scale` só no acerto com o poder maior
    // (`damage.recentDamageBoost`, ex.: Assurance). Omitido = 1.
    // boostedScale: 1.5,
    // Opcional, só o grupo 'tackle' usa hoje — revelação progressiva do
    // efeito (0% a 100% do "traço" visível ao longo desses segundos, em
    // vez de aparecer inteiro de uma vez). `0` (ou omitido) = revelado
    // por inteiro desde o primeiro frame.
    revealDuration: 0,
    // Opcional — ajuste fino de orientação (GRAUS, mesma convenção de
    // vfx.eatFood.rotation em core/data/species/*/index.js), somado por
    // cima da direção real do golpe (pitch+yaw, calculados a partir da
    // câmera). A malha de origem pode não ter o "forward" alinhado com a
    // convenção do jogo — corrige aqui olhando o resultado em jogo.
    rotationOffset: { x: 0, y: 0, z: 0 },
    // Opcional — de onde o VFX do golpe SAI (METROS a partir do centro do
    // corpo), no referencial do golpe: +Z = direção do golpe, +Y = pra cima,
    // +X = pro lado (esquerda de quem olha na direção do golpe) — ex.: a
    // mordida na boca, a rabada na cauda (`resolveAttackOrigin`, `core/battle/
    // attackGeometry.js`). Só o visual: a área do golpe (acerto e aviso no
    // chão) começa na borda do trigger e o `range` conta dali — empurrar a
    // saída pra frente não muda o alcance. Não depende do `rotationOffset`.
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
    // Opcional — poder × `multiplier` contra quem levou dano há no máximo
    // `window` s, de qualquer fonte (`core/battle/recentDamageBoost.js`, ex.:
    // Assurance). Só no golpe único.
    // recentDamageBoost: { window: 3, multiplier: 2 },
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
  //   // 'sp_atk', 'sp_def', 'accuracy' ou 'speed'), de -6 a +6 (convenção do Pokémon: cada estágio
  //   // multiplica o atributo, -1 = ×2/3, +1 = ×3/2). Dura `duration`
  //   // segundos (jogo em tempo real) e usar de novo ACUMULA o estágio e
  //   // RENOVA o tempo. `speed` muda o tempo dos golpes (o passo de
  //   // andar é das condições, o modificador `movement`).
  //   { type: 'statStage', stat: 'attack', stages: -1, duration: 15 },
  //   // `condition` — aplica uma CONDIÇÃO no alvo (`core/data/conditions/`:
  //   // queimadura, semente...), com `chance` (0-1; omitido = sempre). Os
  //   // valores são da condição; o golpe pode trocar `duration`, `tick` e
  //   // `modifiers` (campo a campo) e `immuneTypes` só pra ele. Num golpe de
  //   // DANO é efeito secundário: só no alvo que levou o dano, sem sortear a
  //   // precisão de novo (no canalizado, uma vez por alvo por lançamento).
  //   // Ex.: o Ember, o Leech Seed. Uma espécie muda os valores pelos
  //   // `overrides` da skill (`effects` inteiro).
  //   { type: 'condition', condition: 'burn', chance: 0.1 },
  // ],
  // Quem é atingido (dano e efeito) sai do `group`: a cápsula ('melee',
  // 'ranged') pega o primeiro corpo no caminho; o cone, todos dentro; 'self'
  // age em QUEM USOU (ex.: Growth, `../growth/`) — os `effects` vão no
  // atacante, sem sorteio de precisão e sem provocar ninguém; sem indicador
  // nem aviso; o VFX nasce nos pés dele.

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
