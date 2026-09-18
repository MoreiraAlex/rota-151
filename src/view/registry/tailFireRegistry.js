/**
 * Registro entidade → fogo de cauda. Mesmo padrão de `viewRegistry.js`/
 * `footstepAudioRegistry.js`: `useAnimatedModel.js` registra no
 * `useEffect` (cria a chama via `view/vfx/flameParticles.js#createFlame` e
 * encaixa no osso da cauda, `bone.add(flame.group)`), desregistra no
 * cleanup; `view/systems/tailFireSystem.js` só lê.
 *
 * Diferente do item na mão (`heldItemViewSystem.js`, SINGLETON de módulo —
 * só o treinador segura item, uma vez) — fogo de cauda é POR ENTIDADE:
 * várias criaturas da mesma espécie (invocada + selvagens) podem existir
 * ao mesmo tempo, cada uma com o próprio fogo, sem compartilhar estado.
 *
 * `bone` fica guardado junto (não só `flame`) porque `tailFireSystem.js`
 * precisa dele todo frame pra corrigir a escala (`bone.getWorldScale`,
 * mesmo motivo de `heldItemViewSystem.js` — cancelar a escala composta do
 * rig/`model.scale`, senão o fogo nasce microscópico).
 *
 * `config` é o `species.vfx.tailFire` resolvido — guardado aqui (não só
 * usado uma vez em `createFlame`) porque `scale`/`speed`/`rotation` são
 * lidos de novo TODO FRAME por `tailFireSystem.js` (ajuste de escala geral/
 * velocidade/orientação do grupo, por cima da correção de escala do rig).
 */
const entries = new Map()

export function registerTailFire(entity, flame, bone, config) {
  entries.set(entity, { flame, bone, config })
}

export function unregisterTailFire(entity) {
  const entry = entries.get(entity)
  if (!entry) return
  entry.bone.remove(entry.flame.group)
  entry.flame.dispose()
  entries.delete(entity)
}

export function getTailFireEntry(entity) {
  return entries.get(entity)
}

/** Todas as entradas registradas — `tailFireSystem.js` itera direto (só
 * entidades com fogo de cauda resolvido entram aqui). */
export function getTailFireEntries() {
  return entries.entries()
}
