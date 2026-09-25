/**
 * Molde de um ataque/skill de criatura. Copia esta pasta pra `<id>/`
 * (ex.: `../scratch/`) — um `index.js` só, sem sub-recursos próprios (o
 * visual/áudio de verdade vivem na VIEW, referenciados por id — ver
 * `visual.effectGroup`/`audio.group` abaixo). Ver `../scratch/index.js`/
 * `../punch/index.js` como exemplos completos e funcionais.
 *
 * PRA QUE ISSO EXISTE (ver docs/features/025-ataque-comum-de-criatura.md,
 * seção "reorganização da config"): antes, cada espécie inlinava sua
 * própria cópia de `actions.attack` (duração, alcance, custo, grupo
 * visual, etc.) — cinco espécies, cinco cópias quase idênticas. Um
 * ATAQUE agora é um recurso reutilizável e nomeado (mesmo princípio de
 * `core/data/species/`/`core/data/items/`): esta pasta é a definição
 * BASE, `core/data/attacks/index.js` é o registro, e uma espécie só
 * REFERENCIA o id dela (`species.attacks.primary = 'scratch'`) em vez de
 * duplicar os números. Precisa de um valor diferente do padrão pra UMA
 * criatura específica? Não duplica a definição inteira — referencia com
 * OVERRIDE (ver "Override por criatura" no fim deste arquivo).
 *
 * Pra adicionar um ataque:
 * 1) copia `_template/` pra `<id>/` (ex.: `whip/`)
 * 2) preenche `index.js`
 * 3) importa em `../index.js` e adiciona uma linha no ATTACK_REGISTRY
 * 4) se o visual for novo (não reaproveita `'scratch'`/`'punch'`), cria o
 *    componente em `view/scene/attackEffects/` e registra em
 *    `view/scene/attackEffects/registry.js` (ver docstring lá)
 */
export const ATTACK_TEMPLATE = {
  // Minúsculo, kebab-case — é o que `species.attacks.<slot>` referencia
  // (ver core/data/species/*/index.js) e a chave em ATTACK_REGISTRY.
  id: 'nome-do-ataque',

  // === Mecanismo (creatureAttackSystem.js) ===
  // Duração total do gesto (segundos) — trava a criatura (ActionState)
  // até acabar. Devia bater com a duração de verdade do clipe de
  // animação quando existir (ver `animation.clipKey` abaixo) — clipes de
  // AÇÃO usam `speed` como `1/duração`, mesma convenção de
  // `actions.throw`/`.summon` do bot (core/data/species/bot/index.js).
  duration: 0.5,
  // Instante (dentro de `duration`) em que o efeito de verdade acontece
  // (VFX nasce, som toca) — não é keyframe de clipe, é config do próprio
  // ataque.
  effectAt: 0.25,
  // Alcance (m) da trajetória, medido na HORIZONTAL (combate 2.5D): o
  // golpe anda isso mantendo a mesma altura acima do terreno, e para antes
  // se encontrar parede ou desnível (`resolveAttackImpactPoint`,
  // creatureAttackSystem.js) — não "teleporta" através de nada.
  range: 1.4,
  // Como o golpe mira (`resolveAttackDirection`, core/battle/attackAim.js)
  // — sempre na horizontal, sem mira vertical:
  // - 'melee': giro horizontal da câmera, puxado pro alvo dentro do cone
  //   de `GAME_CONFIG.BATTLE.MELEE_AIM_HALF_ANGLE` quando houver.
  // - 'ranged' (ou ausente): giro horizontal da câmera, sem assistência.
  aim: 'melee',
  // Como o botão lança o golpe (`creatureAttackSystem.js`):
  // - 'confirm': o 1º aperto só mostra o indicador de alcance (leque azul,
  //   `AttackIndicatorView.jsx`); clique ou a mesma tecla de novo lança,
  //   botão direito cancela.
  // - 'instant' (ou ausente): lança assim que aperta.
  // O modo debug (F2) força 'confirm' em todo ataque. Uma criatura pode
  // trocar só pra ela: `attacks.secondary1: { id, overrides: { castMode:
  // 'instant' } }`.
  castMode: 'confirm',
  // Raio (m) da área efetiva — a "grossura" da trajetória inteira do
  // golpe (uma cápsula da origem até o fim do `range`), não só da ponta.
  // Dimensiona o VFX, o indicador de alcance (AttackIndicatorView.jsx) E a
  // detecção de acerto de verdade (`resolveAttackTarget`,
  // creatureAttackSystem.js — geométrica, soma este raio ao
  // `capsuleRadius` do alvo, sem shape-query do Rapier).
  radius: 0.3,
  // Custo de stamina, descontado uma vez no disparo (não por segundo) —
  // mesmo padrão de GAME_CONFIG.PLAYER_ACTIONS.dash.STAMINA_COST/
  // actions.throw.staminaCost do bot. Sem stamina suficiente, o ataque
  // simplesmente não dispara.
  staminaCost: 2,
  // Segundos de espera ALÉM da stamina, contados a partir do disparo —
  // independente de a stamina já ter regenerado (`AttackCooldowns.<slot>`,
  // um campo por slot — `primary`/`secondary1-3` —, decrementado todo
  // tick, ver core/traits/components/attackEffect.js). `0` = sem cooldown
  // (a única trava é ter stamina) — comportamento do ataque comum
  // (`primary`); skills de verdade (`secondary1-3`) tipicamente
  // configuram um valor > 0, já que não competem pelo mesmo "orçamento"
  // do ataque básico (cada slot tem seu PRÓPRIO cooldown).
  cooldown: 0,

  // === Visual (view/scene/attackEffects/*) ===
  visual: {
    // QUAL componente de view desenha o efeito — ver
    // view/scene/attackEffects/registry.js. Vários ataques podem apontar
    // pro MESMO grupo (compartilham o visual), mesmo princípio de
    // `footstepGroup` (core/data/audio/footstepGroups.js).
    effectGroup: 'scratch',
    // Quanto tempo (s) o efeito visual (AttackEffect) fica na cena depois
    // de nascer — independente de `duration` (o gesto pode já ter
    // liberado a criatura antes do VFX sumir).
    effectVisualDuration: 0.35,
    // Multiplicador de TAMANHO do VFX — pedido explícito do usuário: uma
    // criatura grande deve ter o efeito maior que uma pequena, mesmo as
    // duas usando o MESMO ataque/visual. `1` = tamanho de referência
    // desta definição; uma criatura fora do padrão sobrescreve só isto
    // (`attacks.primary.overrides.visual.scale`), sem duplicar o resto.
    // Multiplica por cima da constante de normalização do rip que cada
    // componente de view já tem (`*_BASE_SCALE`, unidade arbitrária do
    // `.obj` de origem) — não a substitui.
    scale: 1,
    // Opcional, só o grupo 'scratch' usa hoje — revelação progressiva do
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
    // Alternativa a `group` — som PRÓPRIO deste ataque, sem grupo (nunca
    // os dois juntos): { clips: ['/assets/audio/attack/.../x.wav', ...],
    // volume: 0.6, refDistance: 6 }.
  },

  // === Animação (futuro — ver docs/features/025-..., seção "Animação")
  animation: {
    // Chave em `species.clips` que este ataque tocaria, quando
    // `core/data/animationStates.js` souber resolver por ataque
    // específico (hoje resolve sempre por `'attack'` fixo, não importa
    // qual ataque de verdade está rodando — mudar isso é trabalho futuro,
    // este campo já deixa a intenção documentada).
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
    // Tipo elemental do golpe (string livre, ex.: 'fire') — usado pro
    // STAB (`resolveStab`) e, quando existir, efetividade de tipo
    // (`resolveTypeEffectivenessMultiplier`). `null` = sem tipo definido
    // ainda; como NENHUMA espécie declara `types` ainda (ver
    // `core/data/species/_template/index.js`), isso hoje não muda nada
    // na prática — estrutura pronta, sem inventar dado agora.
    type: null,
  },

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
// `species.attacks.<slot>` (core/data/species/*/index.js) aceita DUAS
// formas:
//   attacks: { primary: 'scratch' },                    // sem override
//   attacks: { primary: { id: 'scratch', overrides: {   // com override
//     staminaCost: 10,
//     visual: { rotationOffset: { x: 0, y: 90, z: 0 } },
//   } } },
// `resolveCreatureAttack` (core/data/attacks/index.js) mescla a definição
// BASE (esta aqui) com `overrides` — por SEÇÃO (`visual`/`audio`/
// `animation` mesclados campo a campo, não substituídos inteiros; o
// resto dos campos, direto). Só declara o que precisa ser diferente do
// padrão — o resto vem da definição base, sem duplicar nada.
