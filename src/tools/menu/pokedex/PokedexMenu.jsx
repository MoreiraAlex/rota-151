'use client'

import { useState } from 'react'
import { PokedexFrame } from '../../shared/PokedexFrame'
import { PokemonsTab } from './PokemonsTab'
import { TeamTab } from './TeamTab'
import { HistoryTab } from './HistoryTab'

const TABS = [
  { key: 'pokemons', label: 'Pokémons' },
  { key: 'time', label: 'Time' },
  { key: 'historico', label: 'Histórico' },
]

/**
 * Menu principal da Pokédex, com três abas — pedido do usuário: "o novo
 * menu principal da pokédex terá 3 abas: pokémons, time e histórico...
 * a navegação entre elas deve acontecer sem a necessidade de um hud
 * separado" (ver docs/features/033-*.md). Casca fina: só controla QUAL
 * aba está ativa e delega todo conteúdo pra `PokemonsTab`/`TeamTab`/
 * `HistoryTab`, cada uma dona da própria lógica de seleção/painel
 * lateral — a moldura (`PokedexFrame`, `tools/shared/PokedexFrame.jsx`)
 * já sabe desenhar as abas em si a partir de `tabs`.
 *
 * `initialTab`/`initialHistoryEntryId` vêm de fora — o fluxo de scan
 * (`src/app/(auth)/page.js`, ver seção 4 do pedido do usuário) abre este
 * menu já na aba "Histórico" com o registro recém-escaneado selecionado,
 * sem precisar navegar manualmente. Default (`'pokemons'`, nenhum
 * registro) é o que vale quando o menu é aberto pelo clique esquerdo
 * comum, fora do fluxo de scan.
 */
export function PokedexMenu({
  initialTab = 'pokemons',
  initialHistoryEntryId = null,
}) {
  const [tab, setTab] = useState(initialTab)

  return (
    <PokedexFrame
      tabs={TABS.map((t) => ({
        ...t,
        active: t.key === tab,
        onClick: () => setTab(t.key),
      }))}
    >
      {tab === 'pokemons' && <PokemonsTab />}
      {tab === 'time' && <TeamTab />}
      {tab === 'historico' && (
        <HistoryTab initialEntryId={initialHistoryEntryId} />
      )}
    </PokedexFrame>
  )
}
