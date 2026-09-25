import { trait } from 'koota'

// Contador monotônico — id ÚNICO e ORDENÁVEL por entrada do histórico,
// sem `Date.now()` (proibido em `core/`, regra 3.5 de docs/rules/
// README.md) nem `Math.random()`. Só precisa desempatar/identificar
// entradas dentro de uma MESMA sessão de jogo (sem save ainda) — um
// contador incremental de módulo já basta, mesmo raciocínio de
// `core/rng.js` sobre limitações aceitas por enquanto.
let nextEntryId = 1

/**
 * Últimas 10 criaturas escaneadas com sucesso (`entries`, mais recente
 * primeiro) — pedido do usuário: "exibirá o histórico dos últimos 10
 * pokémon escaneados... ao selecionar um registro, exibir os detalhes
 * em um painel lateral, reutilizando a visualização de stats atual,
 * mantendo as informações INDIVIDUAIS" (ver docs/features/033-*.md).
 *
 * Cada entrada é um SNAPSHOT (`{ id, speciesId, individualValues,
 * level }`), não uma referência de entidade viva — uma `SummonedCreature`
 * escaneada pode ser recolhida/destruída bem depois, o que deixaria uma
 * referência de entidade inválida; um snapshot de dados simples não tem
 * esse problema de ciclo de vida. `individualValues` é o MESMO objeto
 * que `IndividualValues` (`core/traits/components/individualValues.js`)
 * guardava na entidade no instante do scan — congelado, igual o resto
 * do sistema de IV já é (docs/features/029-*.md).
 *
 * Dono de escrita: `core/actions/scanning.js` (`registrarScan`).
 */
export const ScanHistory = trait(() => ({
  entries: [],
}))

const MAX_ENTRIES = 10

/**
 * Insere uma entrada nova no TOPO (mais recente) da lista — pedido do
 * usuário: "evitando entradas duplicadas consecutivas ou repetidas na
 * lista" — se a MESMA espécie já está em algum lugar da lista, remove
 * a ocorrência antiga antes de inserir a nova no topo (move pro topo
 * em vez de duplicar), depois corta em `MAX_ENTRIES`. Função pura
 * (recebe a lista atual, devolve uma nova) — sem mexer no trait
 * diretamente, mesmo padrão de `applyDamage`/`applyHeal`
 * (`core/traits/components/vitals.js`).
 */
export function pushScanHistoryEntry(
  entries,
  { speciesId, individualValues, level },
) {
  const withoutDuplicate = entries.filter(
    (entry) => entry.speciesId !== speciesId,
  )
  const entry = { id: nextEntryId++, speciesId, individualValues, level }
  return [entry, ...withoutDuplicate].slice(0, MAX_ENTRIES)
}
