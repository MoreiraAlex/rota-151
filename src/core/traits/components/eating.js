import { trait } from 'koota'

/**
 * Comendo uma fruta (docs/features/042-itens-da-beta.md) — o treinador ou
 * uma criatura invocada. Anda junto da ação `'eat'` no `ActionState`: é ela
 * que deixa quem come ocupado (sem andar, atacar, dash, pular nem usar
 * item — todo mundo que iniciaria outra ação já respeita `ActionState.
 * current !== null`) e que decide a animação; este trait guarda o que só a
 * comida precisa.
 *
 * - `itemId` — a fruta (pra comida caída saber o que mostrar).
 * - `duration` — quanto tempo leva pra comer (`berry.duration`).
 * - `healTotal` — cura total da fruta (`berry.healAmount`), espalhada pela
 *   duração.
 * - `healed` — quanto já curou (nunca passa de `healTotal`).
 *
 * Dono de escrita: `core/actions/eating.js` (põe/tira) e `eatingSystem`
 * (avança `healed`).
 */
export const Eating = trait({
  itemId: null,
  duration: 0,
  healTotal: 0,
  healed: 0,
})

/**
 * Comida derrubada no chão por quem foi interrompido comendo
 * (`derrubarComida`) — só visual: ninguém pega de volta. `lifetime` é quanto
 * falta (s) pra sumir, pra não acumular na cena. `eaten` (0–1) é quanto já
 * tinha sido comido — a view mostra o pedaço certo da fruta.
 *
 * Física (só visual, com `Velocity`): `floorY` é o chão de quem derrubou
 * (fallback quando não dá pra consultar o terreno), `resting` diz se já
 * parou, e `landings` conta as batidas fortes no chão — um pulso que a view
 * compara com o último que viu pra respingar.
 *
 * Dono de escrita: `derrubarComida` (spawna) e `droppedFoodSystem` (física,
 * `lifetime` e destrói).
 */
export const DroppedFood = trait({
  itemId: null,
  lifetime: 0,
  eaten: 0,
  floorY: 0,
  resting: false,
  landings: 0,
})
