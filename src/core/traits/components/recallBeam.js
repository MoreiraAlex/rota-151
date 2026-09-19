import { trait } from 'koota'

/**
 * Efeito visual passageiro de "o feixe de luz vermelha puxa a criatura de
 * volta pra dentro da esfera" (ver docs/features/024-esfera-de-invocar.md)
 * — `Position`/`Rotation` (a posição da CRIATURA, ponta de chegada do
 * feixe) cuidam de onde a entidade "está" pro `syncTransformSystem`,
 * `lifetime` conta em segundos até desaparecer sozinho, sem movimento.
 *
 * `fromX/fromY/fromZ`: a posição do TREINADOR (ponta de saída do feixe)
 * no instante do recall, congelada — o feixe vai de onde o treinador
 * estava até onde a criatura estava, não um ponto único. `RecallBeamView.jsx`
 * usa isso pra desenhar um "raio" deformado entre os dois pontos (não um
 * cilindro reto) — pedido explícito do usuário.
 *
 * `speciesId`: a espécie da criatura recolhida — mesma convenção de
 * `SummonBall.speciesId`/`SummonedCreature.speciesId` (trait guarda só o
 * id, quem consome busca `getSpecies(speciesId).body` quando precisa de
 * dado derivado, em vez de duplicar números aqui). `RecallBeamView.jsx`
 * usa isso pra dimensionar o "envelope" genérico que cobre a criatura no
 * instante em que o feixe chega nela (não dá pra usar o formato de
 * verdade da criatura — genérico, mas do TAMANHO dela, ver a view).
 *
 * Dono de escrita: `partySummonSystem` (spawna, no `effectAt` da ação
 * `'recall'` — bem onde a `SummonedCreature` estava, um instante antes de
 * `applyRecall` destruí-la); `summonEffectsSystem` (conta `lifetime` pra
 * baixo, destrói a entidade ao chegar a zero).
 */
export const RecallBeam = trait({
  lifetime: 0,
  fromX: 0,
  fromY: 0,
  fromZ: 0,
  speciesId: null,
})
