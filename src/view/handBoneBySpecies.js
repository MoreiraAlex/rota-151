/**
 * Nome do osso da mão, por espécie — puramente visual (nomes vêm do rig
 * 3D, não faz sentido core saber disso), por isso mora aqui, não em
 * core/data/species/<id>/. Só espécies com mão (hoje só o treinador,
 * PLAYER_SPECIES_ID) entram aqui — sem entrada, quem consulta
 * (`heldItemViewSystem.js`, `RecallBeamView.jsx`) simplesmente não mostra
 * nada e não quebra (ex.: o Fox de teste, quadrúpede, não tem mão
 * nenhuma).
 *
 * Extraída de `heldItemViewSystem.js` (onde morava sozinha) quando um
 * segundo consumidor (`RecallBeamView.jsx`, docs/features/024-esfera-de-
 * invocar.md) precisou do mesmo osso — antes só o item na mão precisava
 * saber disso.
 */
export const HAND_BONE_BY_SPECIES = {
  bot: 'mixamorig_RightHand',
}
