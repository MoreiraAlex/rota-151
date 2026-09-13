const ANIMATABLE_PROPERTIES = ['rotation', 'position', 'scale']

/**
 * Resolve todos os ossos de um THREE.Skeleton, indexados pelo próprio nome do
 * osso no rig — sem camada de mapeamento semântico. O clipe JSON referencia o
 * osso pelo nome real do modelo (ver clips/fox-walk.json).
 *
 * Devolve nomeDoOsso → `{ bone, rest }`, onde `rest` guarda uma cópia de
 * `rotation`, `position` e `scale` do osso no momento da resolução — antes de
 * qualquer código de animação tocar nele. É essencial guardar isso aqui: a
 * animação sempre soma um deslocamento a essa pose de descanso, nunca a
 * substitui — cada osso tem sua própria orientação/posição natural.
 */
export function resolveBones(skeleton) {
  const bones = {}
  for (const bone of skeleton.bones) {
    bones[bone.name] = { bone, rest: captureRest(bone) }
  }
  return bones
}

function captureRest(bone) {
  const rest = {}
  for (const property of ANIMATABLE_PROPERTIES) {
    const { x, y, z } = bone[property]
    rest[property] = { x, y, z }
  }
  return rest
}
