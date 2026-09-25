/**
 * Molde de um item. Copia esta pasta inteira pra `<id>/` (ex.: `pokebola/`)
 * — um `index.js` com os dados abaixo. Ver `../pebble/` ou `../potion/`
 * como exemplos completos.
 *
 * `category` decide o que o item faz quando usado (botão `primary`, ver
 * docs/features/011-slots-de-acao.md e a implementação em
 * docs/features/014-arremessar-usar-e-invocar.md). Config de comportamento
 * é opcional e por categoria: `consumable.healAmount` existe porque cura é
 * claramente por item (uma poção melhor cura mais); velocidade de arremesso
 * (`throwable`) ainda é global (`gameConfig.PLAYER_ACTIONS.throw.SPEED`) —
 * vira por item só quando um segundo `throwable` precisar de valor
 * diferente, mesmo caminho já percorrido por `body`/`movement` de espécie.
 */
export const ITEM_TEMPLATE = {
  id: 'nome-em-minusculo',
  // `category` é um GRUPO de funcionalidade, não só um rótulo — itens da
  // mesma categoria se comportam igual, sem precisar duplicar lógica
  // (pedido do usuário: "cada item vai ter uma funcionalidade
  // diferente... acredito que possa ser por grupo tb, já que uma câmera
  // e uma pokédex vão ter a mesma funcionalidade, assim como itens
  // consumíveis e lançáveis" — ver docs/features/031-*.md). Categorias
  // hoje:
  // - 'throwable' — clique primário arremessa (`playerActionSystem.js`).
  // - 'consumable' — clique primário usa/consome (`consumable.healAmount`
  //   abaixo).
  // - 'scanner' (ex.: `pokedex`) — SEGURAR o botão SECUNDÁRIO (direito)
  //   liga o modo scanner (`scannerModeSystem.js`: câmera em primeira
  //   pessoa + HUD trocada, ver `tools/hud/PokedexVisorHud.jsx`); soltar
  //   desliga e confirma; sem efeito no clique primário enquanto
  //   segurando (docs/features/033-*.md).
  // Sem 'weapon': o treinador não ataca Pokémon nem outro treinador
  // diretamente, não existe essa categoria. Categoria desconhecida (ou
  // omitida) simplesmente não faz nada em nenhum dos dois cliques —
  // mesmo fallback gracioso de sempre; nova categoria = decidir ONDE ela
  // se encaixa (primary, secondary, ou nenhum) quando o primeiro item
  // dela existir, não antes.
  category: 'consumable',
  // Só pra category: 'consumable'. Omite se a categoria for outra.
  consumable: {
    healAmount: 30,
  },
  // Só pra category: 'scanner' (ver `../pokedex/index.js`) — alcance
  // máximo (m) do raycast do scanner (`scannerModeSystem.js`). Sem
  // isso configurado no item, cai em `GAME_CONFIG.SCANNER.RANGE`
  // (fallback global) — mesmo padrão gracioso de `species.camera.
  // targetHeight` caindo no default de `GAME_CONFIG.CAMERA`.
  scanner: {
    range: 40,
  },
  // Opcional, qualquer categoria — ícone de verdade no inventário/HUD
  // (`tools/shared/SlotPreview.jsx`), mesmo formato de `species.sprite`/
  // `attack.sprite` (`path` + `scale` opcional, default 1, pra
  // compensar margem inconsistente dentro da própria imagem). Sem
  // `sprite`, cai no quadrado colorido por categoria (`ITEM_COLORS`,
  // `view/itemColors.js`) — mesmo fallback gracioso de sempre.
  sprite: { path: '/assets/sprites/itens/nome-do-arquivo.png' },
}
