import { registerExtraLgpePack } from './lgpeModels'

/**
 * Pacotes de modelos de fora do Let's Go (docs/features/066-revisao-dos-
 * biomas.md): cada um uma pasta no formato do LGPE (`manifest.json`,
 * `props/`, `textures/`), listados no `packs.json` da pasta-mãe.
 *
 * - Os do jogo (`GAME_PACKS_DIR`, no git): só os modelos que os biomas
 *   usam, levados do lab por `scripts/lab/levar-pacotes-para-o-jogo.js`.
 * - Os do laboratório de biomas (`LAB_PACKS_DIR`, fora do git): os pacotes
 *   inteiros, para escolher.
 */
export const GAME_PACKS_DIR = '/assets/vegetation/packs'
export const LAB_PACKS_DIR = '/assets/lab'

/**
 * Lê e registra os pacotes de `dir` (`registerExtraLgpePack`) antes da cena
 * montar. Sem a lista (ou com erro), nenhum: a vegetação fica só com os do
 * LGPE. Devolve `{ id, count, ids }` de cada pacote registrado.
 */
export async function loadVegetationPacks(dir) {
  try {
    const response = await fetch(`${dir}/packs.json`)
    if (!response.ok) return []
    const list = await response.json()
    const packs = []
    for (const id of list) {
      const packDir = `${dir}/${id}`
      const manifest = await (await fetch(`${packDir}/manifest.json`)).json()
      registerExtraLgpePack(manifest, packDir)
      const ids = Object.keys(manifest.props ?? {})
      packs.push({ id, count: ids.length, ids })
    }
    return packs
  } catch {
    return []
  }
}
