import { CameraTarget, Party, Position, ScanMode } from '@/core/traits'
import { setSeeThrough } from '@/view/materials/seeThrough'
import { resolveRenderPosition } from '@/view/registry/renderInterpolation'

/**
 * Passa a câmera e o alvo dela para o ver-através dos objetos
 * (`view/materials/seeThrough.js`): o que fica entre os dois some em
 * pontilhado. O alvo é o centro do corpo (`Position`, interpolada como o
 * modelo). Em primeira pessoa (Scan) desliga — não há nada entre o olho e
 * o corpo.
 *
 * Fase: presentation, depois do `cameraFollowSystem` (a câmera já no lugar
 * deste quadro).
 */
export function seeThroughSystem({ world, camera }) {
  if (!camera) return
  const target = world.queryFirst(CameraTarget, Position)
  if (!target) return
  const scanning = target.has(Party) && !!target.get(ScanMode)?.active
  setSeeThrough(camera.position, resolveRenderPosition(target), !scanning)
}
