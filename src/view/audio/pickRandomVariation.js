/**
 * Escolhe uma variação aleatória de um array (buffers de som de
 * passo/voz) — reaproveitado por `footstepAudioSystem.js` e
 * `voiceAudioSystem.js`, em vez de cada um repetir a própria conta.
 *
 * A quantidade de variações é INDEFINIDA de propósito — uma espécie pode
 * declarar 1 variação só, outra 5 ou mais (`sounds.footstep.walk`/
 * `sounds.voice.clips`, ver `core/data/audio/`); esta função funciona
 * igual pra qualquer tamanho, inclusive 1 (sempre "sorteia" o único
 * item). Sorteio é independente a cada chamada, COM reposição — pode
 * escolher o mesmo item duas vezes seguidas; isso é intencional (pedido
 * explícito do usuário: não precisa evitar repetição consecutiva, só
 * precisa ser de verdade aleatório a cada reprodução).
 */
export function pickRandomVariation(variations) {
  return variations[Math.floor(Math.random() * variations.length)]
}
