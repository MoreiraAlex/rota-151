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
 *
 * `boy` — bug real, relatado jogando ("configurando para ele lançar os
 * objetos no bone do boy, não tá respeitando"): `PLAYER_SPECIES_ID` virou
 * `'boy'` (`core/data/species/index.js`), mas este mapa só tinha `bot`.
 * Sem entrada pra `boy`, `heldItemViewSystem.js` caía direto no fallback
 * "sem osso" (`bone` sempre `undefined` → `hide()`) — o item nunca era
 * anexado a NADA, não importa o que fosse configurado em
 * `actions.throw.handForwardOffset`/etc (esses campos são só a origem da
 * TRAJETÓRIA, calculada no `core/`, sem acesso a osso nenhum — ver
 * comentário completo em `core/data/species/boy/index.js`, `actions.throw`
 * — coisas DIFERENTES: o osso é só o encaixe VISUAL do item na mão antes
 * de soltar). Nome do osso conferido direto no `.glb` (accessor de nós,
 * mesma técnica de inspeção sem navegador de sempre nesta sessão): `boy.glb`
 * usa a MESMA convenção de nome que `bot.glb` (`RHand`/`LHand`), não
 * `mixamorig_RightHand` como um comentário antigo (agora corrigido) em
 * `core/data/species/boy/index.js`/`bot/index.js` especulava.
 */
export const HAND_BONE_BY_SPECIES = {
  boy: 'RHand',
}
