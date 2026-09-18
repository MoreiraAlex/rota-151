/**
 * Registro entidade → sincronia de boca com o grito (`species.clips.cry`,
 * ver docs/features/023-estado-de-humor-e-piscar-de-olhos.md, seção "Boca
 * sincronizada com o grito"). Mesmo padrão de
 * `viewRegistry.js`/`tailFireRegistry.js`: `useAnimatedModel.js` registra
 * no `useEffect`, desregistra no cleanup; `view/systems/mouthSyncSystem.js`
 * só lê/mexe.
 *
 * `bones`: SUBCONJUNTO de `getAnimatedBonesEntry(entity).bones` — só os
 * ossos que `species.clips.cry` de fato anima (cabeça/queixo/antenas, por
 * exemplo), resolvido uma vez no registro. Crucial ser um SUBCONJUNTO, não
 * o mapa inteiro: `applyAnimationClip` reseta pra pose de descanso TODO
 * osso do mapa que recebe, não só os mencionados no clipe (ver docstring
 * de `core/animation/applyAnimationClip.js`) — passar o mapa inteiro
 * faria o corpo inteiro (pernas, coluna) saltar pra pose de descanso
 * enquanto o grito toca, perdendo a pose de andar/correr/parado.
 *
 * `clip`: `species.clips.cry` (mesmo formato de idle/walk/run).
 *
 * `elapsed`: relógio PRÓPRIO do grito (não o relógio compartilhado de
 * `animationRegistry.js` — o grito tem fase própria, começa do zero toda
 * vez que o áudio começa a tocar, ver `mouthSyncSystem.js`).
 *
 * `wasPlaying`: se o áudio de voz já estava tocando no tick anterior —
 * detecta a BORDA DE SUBIDA (grito começou agora) pra zerar `elapsed`,
 * mesmo raciocínio de `wasBlocked` em `PathState`.
 */
const entries = new Map()

export function registerMouthSync(entity, sync) {
  entries.set(entity, sync)
}

export function unregisterMouthSync(entity) {
  entries.delete(entity)
}

export function getMouthSync(entity) {
  return entries.get(entity)
}

/** Todas as entradas registradas — `mouthSyncSystem.js` itera direto (só
 * entidades com `clips.cry` resolvido entram aqui). */
export function getMouthSyncEntries() {
  return entries.entries()
}
