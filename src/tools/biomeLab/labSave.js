import { migrateSave } from '@/core/save/saveFormat'

/**
 * O save do laboratório de biomas (docs/features/066-revisao-dos-
 * biomas.md): o treinador no ponto e na hora pedidos, sem time, sem itens
 * e sem nada mexido no mundo. Montado na primeira versão do formato e
 * levado até a atual pela migração do jogo — o lab nunca grava.
 *
 * @param {{ x: number, z: number, yaw?: number, time: number }} start -
 *   `time` em dias de jogo
 */
export function buildLabSave({ x, z, yaw = 0, time }) {
  const result = migrateSave({
    version: 1,
    trainer: {
      // A altura certa vem do relevo ao nascer; alto para cair no chão.
      position: { x, y: 60, z, yaw },
      heldItemId: null,
      worldTime: time,
      inventory: { counts: {}, positions: {} },
      pokedex: { speciesIds: [], history: [] },
    },
    pokemon: [],
  })
  if (!result.ok) throw new Error(result.error)
  return result.save
}
