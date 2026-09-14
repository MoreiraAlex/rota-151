const ANIMATABLE_PROPERTIES = ['rotation', 'position', 'scale']

/**
 * Resolve todos os ossos de um THREE.Skeleton, indexados pelo próprio nome do
 * osso no rig — sem camada de mapeamento semântico. O clipe JSON referencia o
 * osso pelo nome real do modelo (ver clips/fox-walk.json).
 *
 * Devolve nomeDoOsso → `{ bone, rest, restQuaternion }`. `rest` guarda uma
 * cópia de `rotation`/`position`/`scale` do osso no momento da resolução
 * (rotation aqui é só pra referência/diagnóstico — quem decide a rotação de
 * verdade é `restQuaternion`, ver `applyAnimationClip.js`); `position`/
 * `scale` continuam somando direto em cima de `rest`. `restQuaternion` é a
 * cópia do `bone.quaternion` no mesmo instante — a composição de rotação
 * parte dele, não da tripla de Euler, porque somar escalar em Euler só bate
 * com "girar no eixo local do osso" quando o resto do osso já está na
 * identidade (verdade pro Fox, falso pra um rig como o do Mixamo, cuja coxa
 * descansa a 180° em Z).
 */
export function resolveBones(skeleton) {
  const bones = {}
  for (const bone of skeleton.bones) {
    bones[bone.name] = {
      bone,
      rest: captureRest(bone),
      restQuaternion: captureRestQuaternion(bone),
    }
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

function captureRestQuaternion(bone) {
  const { x, y, z, w } = bone.quaternion
  return { x, y, z, w }
}
