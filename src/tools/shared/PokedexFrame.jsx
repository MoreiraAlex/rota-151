'use client'

/**
 * Moldura vermelha + tira de "luzes" — o "estilo Pokédex" (pedido do
 * usuário na rodada 027: "esse menu vai ser a pokédex no futuro,
 * consegue deixar mais no estilo?"). Extraída de `tools/menu/
 * StatsPanel.jsx` nesta rodada (docs/features/033-*.md) pra virar a
 * moldura do NOVO menu principal da Pokédex (`tools/menu/pokedex/
 * PokedexMenu.jsx`, com abas) — antes só o `StatsPanel.jsx` (uma
 * criatura, sem abas) usava.
 *
 * `tabs` opcional (`{ key, label, active, onClick }[]`) — mesmo botão-
 * de-dispositivo visual que a Pokédex já tinha antes das abas serem
 * removidas na rodada 032 (removidas ali porque só existia UMA
 * criatura pra mostrar; voltam agora pras TRÊS seções do menu
 * principal: Pokémons/Time/Histórico).
 *
 * **Altura travada em 350px (`h-[350px] flex flex-col`)** — pedido do
 * usuário: "preciso que a pokédex por inteira fique dentro de 420px"
 * (de ALTURA, confirmado depois — largura ficou livre em 500px, ver
 * `PauseMenu.jsx`). 350px é o que sobra dos 420px depois do resto do
 * chrome ao redor deste componente, que este arquivo não controla: o
 * `p-4` do `PauseMenu.jsx` (32px) + a barra de título "Pokédex"/"←
 * voltar" do `MenuView` (~30px) — únicos consumidores deste componente
 * hoje — com uma margem de alguns px de folga pra variação real de
 * fonte/line-height do navegador (não verificado visualmente, sandbox
 * sem navegador). A luz superior e a barra de abas são `shrink-0`
 * (tamanho fixo, nunca espremidas); só a caixa de conteúdo (`children`
 * — a aba ativa) é `flex-1 min-h-0 overflow-y-auto`, absorvendo o resto
 * da altura e rolando por conta própria se o conteúdo for mais alto que
 * isso — cada aba (`pokedex/*Tab.jsx`) preenche essa área com `h-full`,
 * sem precisar saber o número exato.
 */
export function PokedexFrame({ tabs, children }) {
  return (
    <div className="flex h-[500px] flex-col">
      <div className="flex shrink-0 items-center gap-1.5 rounded-t border-2 border-b-0 border-red-600 bg-red-700 px-2 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-300 ring-1 ring-white/50" />
        <span className="h-1.5 w-1.5 rounded-full bg-red-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-300" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-300" />
      </div>

      {tabs && tabs.length > 0 && (
        <div className="flex shrink-0 gap-1 border-x-2 border-red-600 bg-neutral-950 px-2 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={tab.onClick}
              className={`rounded-t px-2 py-1 text-[11px] ${
                tab.active
                  ? 'bg-neutral-900 text-white'
                  : 'bg-black/40 text-white/50 hover:bg-black/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-b border-2 border-t-0 border-red-600 bg-neutral-900 p-3">
        {children}
      </div>
    </div>
  )
}
