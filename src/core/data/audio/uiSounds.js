/**
 * Sons de aviso pro jogador (docs/features/067-campo-de-treino-e-avisos-de-
 * nivel.md) — tocados sem posição no mundo (o Pokémon pode estar na bola),
 * no canal de efeitos. Arquivos do Cobblemon (`public/assets/audio/ui/`).
 *
 * - `levelUp`: um Pokémon do time subiu de nível (o `gui/levelup` dele);
 * - `moveUnlocked`: um golpe novo ficou apto a ser treinado (o
 *   `evolution/evolution_notification` dele). Vindo junto com o de nível,
 *   toca depois dele, com o atraso `delayAfterLevelUp` (s).
 *
 * Mesmo formato dos outros sons: `files` (variações; uma é sorteada) e
 * `volume` (0-1).
 */
const BASE = '/assets/audio/ui'

export const UI_SOUNDS = {
  levelUp: { files: [`${BASE}/level-up.ogg`], volume: 0.6 },
  moveUnlocked: {
    files: [`${BASE}/move-unlocked.ogg`],
    volume: 1,
    delayAfterLevelUp: 0.9,
  },
}
