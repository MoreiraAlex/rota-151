import { trait } from 'koota'

/**
 * Vida/energia de cada criatura do time DENTRO DA BOLA, por slot, no
 * treinador — a criatura recolhida deixa de existir como entidade
 * (`applyRecall`, `partySummonSystem.js`), então o `Vitals` dela é
 * guardado aqui e devolvido na próxima invocação (`summonBallSystem.js`),
 * em vez de ela sair sempre cheia. Mesmo formato de
 * `PartyIndividualValues` (um valor por slot):
 * - `null`: cheia (nunca saiu, ou criatura nova no slot);
 * - cópia do `Vitals` (mesmos campos): como ela estava ao ser recolhida.
 *
 * Dentro da bola continua regenerando pela MESMA regra de fora
 * (`regenerateVitals`, `vitalsRegenSystem.js`) — exceto desmaiada
 * (`PartyFaint`), igual em campo.
 *
 * Donos de escrita: `applyRecall` (guarda), `vitalsRegenSystem.js`
 * (regenera), `faintSystem.js` (HP de quem acorda, ao reanimar na bola),
 * `summonBallSystem.js` (devolve e limpa ao invocar) e `equiparCriatura`
 * (limpa ao trocar a criatura do slot).
 */
export const PartyVitals = trait({
  slot1: null,
  slot2: null,
  slot3: null,
})
