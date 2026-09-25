import { trait } from 'koota'

/**
 * TODA espécie já escaneada alguma vez (`speciesIds`, sem repetição) —
 * pedido do usuário: "conforme o jogador escanear uma espécie,
 * habilitar seu registro [na grade dos 151] e exibir o sprite
 * correspondente" (ver docs/features/033-*.md, aba "Pokémons" do novo
 * menu da Pokédex). Diferente de `ScanHistory` (só os 10 mais
 * recentes, pode perder espécies antigas) — este trait nunca encolhe,
 * é a "coleção" completa pra sempre.
 *
 * Dono de escrita: `core/actions/scanning.js` (`registrarScan`), sempre
 * junto com `ScanHistory` — as duas atualizam na mesma confirmação de
 * scan, nunca uma sem a outra.
 */
export const PokedexEntries = trait(() => ({
  speciesIds: [],
}))
