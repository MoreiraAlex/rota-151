import { trait } from 'koota'

/**
 * Id do grupo de efeito visual usado quando o ataque resolvido não
 * declara `visual.effectGroup` (não devia acontecer, já que toda entrada
 * de `core/data/skills/` declara — ver `_template/index.js` — mas serve
 * de piso seguro, mesmo espírito de outros fallbacks graciosos do
 * projeto). `'punch'` é o grupo compartilhado por padrão — mesmo
 * princípio de `footstepGroup`/`dashGroup` (`core/data/audio/*.js`):
 * vários ataques podem apontar pro mesmo grupo, em vez de cada um ter sua
 * própria config repetida. Exportado pra `view/scene/attackEffects/
 * registry.js` resolver o COMPONENTE de verdade sem duplicar a string
 * aqui.
 */
export const DEFAULT_ATTACK_EFFECT_GROUP = 'punch'

/**
 * Efeito visual passageiro do ataque de uma criatura (ver
 * docs/features/025-ataque-comum-de-criatura.md) — mesmo formato trivial de
 * `ConsumeEffect`: `Position`/`Rotation` cuidam de onde/pra onde aparece,
 * `lifetime` é quanto tempo (segundos) falta até desaparecer sozinho. Sem
 * movimento, sem gravidade — fica parado no lugar em que nasceu (o CENTRO
 * da área efetiva do ataque, não a posição da criatura — ver
 * `creatureAttackSystem.js`).
 *
 * `radius`/`effectGroup`/`revealDuration` vêm do ataque resolvido
 * (`core/data/skills/`, via `resolveCreatureAttack` — base da espécie +
 * override da criatura, ver docstring de `core/data/skills/index.js`),
 * congelados no spawn:
 * - `radius` dimensiona o efeito, proporcional à área efetiva de
 *   verdade — só visual; a detecção de acerto mora em
 *   `resolveAttackTarget` (`creatureAttackSystem.js`).
 * - `effectGroup` diz QUAL visual usar (`attack.visual.effectGroup`) —
 *   vários ataques podem apontar pro mesmo grupo (`'punch'`/`'tackle'`,
 *   os dois que existem hoje), e a VIEW (`view/scene/AttackEffectView.jsx`,
 *   via `view/scene/attackEffects/registry.js`) escolhe o COMPONENTE
 *   certo por esse id. Core não sabe nada sobre o visual em si (só
 *   carrega o id, texto puro) — a ponte id→componente React mora inteira
 *   na view, mesma separação de sempre (`core/` não importa Three/React).
 * - `revealDuration` (`attack.visual.revealDuration`, segundos) — pedido
 *   do usuário pro grupo `'tackle'`: o efeito não aparece inteiro de
 *   uma vez, é REVELADO progressivamente (uma "fita" indo de 0% a 100%
 *   visível, dando a sensação de golpe partindo de um ponto até outro).
 *   `0` = revelado por inteiro desde o primeiro frame (comportamento de
 *   `'punch'`, que não usa reveal — é um estouro, não um traço). A VIEW
 *   (`tackleAttackEffect.jsx`) decide o que fazer com o valor; o trait só
 *   carrega o número.
 * - `visualScale` (`attack.visual.scale`, multiplicador, padrão `1`) —
 *   pedido explícito do usuário: "uma criatura grande vai ter o efeito
 *   maior do que o de uma criatura pequena, mesmo os 2 usando o mesmo
 *   efeito" — o tamanho do VFX é característica do ATAQUE (com override
 *   por criatura quando o padrão não servir), não uma constante fixa
 *   escondida dentro do componente de view. Multiplicado por cima da
 *   constante de normalização do rip que cada componente já tem
 *   (`*_BASE_SCALE`) e de `radius`.
 * - `length` (metros) — distância da PARTIDA do golpe (de onde ele sai da
 *   criatura, já com `visual.positionOffset`) até o ponto onde esta entidade
 *   nasce. O efeito nasce no
 *   impacto, orientado pela trajetória (+Z local = direção do golpe), então
 *   a criatura fica em (0, 0, -`length`) no espaço local — é o que um VFX
 *   que SAI da criatura (jato de fogo, projétil) precisa saber. Os grupos
 *   que nascem só no impacto (`'punch'`, `'tackle'`) ignoram. `0` = não
 *   informado.
 *
 * - `impactType` — tipo do golpe (`'fire'`, `'water'`...) pro grupo
 *   `'impact'` escolher as partículas (cada tipo tem as suas); `''` = não
 *   informado (cai em `'normal'`). Vem de `attack.visual.impactType` ou,
 *   na falta, de `attack.damage.type`. Os outros grupos ignoram.
 *
 * Dono de escrita: `creatureAttackSystem` (spawna, no instante `effectAt`
 * da ação `'attack'`); `attackEffectSystem` (conta `lifetime` pra baixo,
 * destrói a entidade ao chegar a zero).
 */
export const AttackEffect = trait({
  lifetime: 0,
  radius: 0.5,
  effectGroup: DEFAULT_ATTACK_EFFECT_GROUP,
  revealDuration: 0,
  visualScale: 1,
  length: 0,
  impactType: '',
})

/**
 * Pulso de UM TICK marcando o instante exato do IMPACTO do ataque comum
 * (`effectAt` da ação `'attack'` — o mesmo instante em que `AttackEffect`
 * nasce, ver `creatureAttackSystem.js`) — mesmo princípio de `Jumped`
 * (`core/traits/components/physics.js`)/`SummonPulse`/`RecallPulse`
 * (`core/traits/components/party.js`): a entidade em si não guarda nada,
 * só a PRESENÇA da tag importa pra quem consome. Fica na CRIATURA que
 * atacou (não no `AttackEffect` spawnado) — o som é posicional nela, mesmo
 * nó de áudio que já toca passo/dash/pulo (ver `useAnimatedModel.js`).
 *
 * Dono de escrita: `creatureAttackSystem` (adiciona, no `effectAt`);
 * `attackAudioSystem` (view, remove depois de tocar o som — ou mesmo sem
 * buffer carregado ainda, mesmo motivo de `jumpAudioSystem.js`: a fase
 * `simulation` pode rodar mais de um tick fixo antes da próxima
 * `presentation`, então quem limpa cedo demais arrisca apagar o pulso
 * antes da `presentation` chegar a vê-lo).
 *
 * Carrega `slot` (`primary`/`secondary1-3`/`training`) e `key` (chave do som,
 * `resolveAttackSoundKey`: `'primary'` ou o id do golpe): QUAL ataque
 * disparou, pra o som tocar o do ataque certo (ver `core/data/audio/
 * attackSound.js`). Sem `key`, vale o `slot`.
 */
export const AttackPulse = trait({ slot: 'primary', key: '' })

/**
 * Pulso de UM tick pedindo que a criatura VOCALIZE agora (o grito dela, com a
 * boca sincronizada) — `creatureAttackSystem` o adiciona no `effectAt` de uma
 * skill com `audio.cry: true` (ex.: Growl); `voiceAudioSystem` o consome:
 * toca uma variação da voz da criatura na hora, sem esperar o temporizador
 * da vocalização periódica, e remove a tag. Mesmo princípio de `AttackPulse`.
 */
export const CryPulse = trait()

/**
 * Cooldown restante (segundos) de CADA slot de ataque/skill
 * (`primary`/`secondary1-3`, mesmos rótulos de `resolveActionSlots`/
 * `species.basicAttack`/`species.skills[N]`) — um campo por slot, não um único
 * `cooldownRemaining` compartilhado (era assim até a 9ª rodada, quando só
 * existia o ataque comum em `primary`). Motivo do split (pedido do
 * usuário: "pode fazer as habilidades agora?", ver docs/features/025-
 * ataque-comum-de-criatura.md): skills de verdade (`vine-whip`/`ember`/
 * `whirlpool`) configuram `cooldown` MAIOR que zero, ao contrário do
 * ataque comum (sempre `0` até aqui) — com um campo só compartilhado,
 * usar uma skill travaria o ataque básico do mouse pelo mesmo tempo
 * (e vice-versa), o que não faz sentido nenhum (são recursos
 * independentes, cada um com seu próprio "orçamento").
 *
 * Cada campo decrementa TODO tick, independente de qual ação está em
 * andamento (mesmo comportamento que `ActionState.cooldownRemaining`
 * tinha antes de virar este trait) — travado em
 * `cooldown` do ataque do slot (`basicAttack`/`skills[N]`) quando a AÇÃO
 * daquele slot termina (não no disparo — a contagem só começa depois da
 * `duration`), nunca dos outros três.
 *
 * Dono de escrita/leitura: `creatureAttackSystem.js`.
 */
export const AttackCooldowns = trait({
  primary: 0,
  secondary1: 0,
  secondary2: 0,
  secondary3: 0,
  // Golpe em treino (`Training`, slot interno sem botão).
  training: 0,
})

/**
 * Slot cujo ataque está com o INDICADOR aberto, esperando confirmação
 * (`'primary' | 'secondary1-3'`, ou `null` sem indicador). Só existe pra
 * ataque com `castMode: 'confirm'` (`core/data/skills/<id>/index.js`):
 * apertar o botão abre o indicador; apertar de novo (ou clicar) lança.
 *
 * Dono de escrita: `creatureAttackSystem.js`. Leitor:
 * `view/scene/AttackIndicatorView.jsx` (desenha o indicador).
 */
export const AttackAim = trait({
  slot: null,
})
