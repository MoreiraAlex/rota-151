import { trait } from 'koota'

/**
 * Indo de um lugar para o outro pela porta de um prédio (docs/features/068-
 * interior-dos-predios.md) — trait do MUNDO. `phase`: `null` (nada
 * acontecendo), `'out'` (a tela escurecendo; no fim dela o treinador troca
 * de lugar) ou `'in'` (clareando). `action`: `'enter'` ou `'exit'`; para
 * entrar, `door` guarda a porta de fora (`interiorPlacement.js`,
 * `doorOf`) e `interiorId` a sala.
 *
 * Quem escreve: `interiorSystem` (avança e troca a fase) e as actions de
 * `core/actions/interior.js` (começam). `elapsed` avança no próprio objeto,
 * sem avisar quem assina; a troca de fase avisa (`world.set`) — a HUD do
 * escuro assina só isso.
 */
export const InteriorTransition = trait(() => ({
  phase: null,
  elapsed: 0,
  action: null,
  interiorId: null,
  door: null,
}))

/**
 * O treinador está dentro de um prédio (docs/features/068-interior-dos-
 * predios.md): em que sala (`interiorId`), onde ela está no mundo (a
 * origem do modelo, `x`/`y`/`z`, e a escala dele), a porta por onde entrou
 * (`door`, para sair por ela) e o corpo da colisão da sala (`bodyHandle`).
 *
 * Fora do alcance das selvagens (`isActiveCombatant`); o mundo de fora some
 * na tela. Quem escreve: `core/actions/interior.js`.
 */
export const Indoors = trait(() => ({
  interiorId: null,
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  door: null,
  bodyHandle: -1,
}))

/**
 * Tag na entidade da câmera: no próximo quadro ela vai direto para o lugar
 * dela, sem a suavização de sempre (o treinador acabou de trocar de lugar
 * pela porta). Quem põe: `core/actions/interior.js`; quem tira:
 * `cameraFollowSystem`.
 */
export const CameraSnap = trait()
