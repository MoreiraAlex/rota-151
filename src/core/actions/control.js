import { resolveOwner } from './owner'
import { CameraTarget, InputControlled } from '../traits'

/**
 * Se `entity` (uma criatura) está no controle, o controle e a câmera voltam
 * para o treinador DONO dela — não um treinador qualquer. Usado quando ela
 * sai de jogo pilotada: desmaiou (`faint.js`) ou voltou para a bola
 * (`partySummonSystem.js`). Sem controle nela, ou sem dono, não faz nada.
 */
export function devolverControleAoDono(entity) {
  if (!entity.has(InputControlled)) return
  const trainer = resolveOwner(entity)
  if (!trainer || trainer === entity) return
  entity.remove(InputControlled, CameraTarget)
  trainer.add(InputControlled, CameraTarget)
}
