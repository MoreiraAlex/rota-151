/**
 * Molde de um item. Copia esta pasta inteira pra `<id>/` (ex.: `poke-ball/`)
 * — um `index.js` com os dados abaixo. Ver `../potion/` ou `../razz-berry/`
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
  // Nome e descrição pro jogador (tooltip e detalhes do Inventário). Sem
  // `name`, a tela mostra o id formatado.
  name: 'Nome do item',
  description: 'O que o item faz, em uma ou duas frases.',
  // `category` é um GRUPO de funcionalidade, não só um rótulo — itens da
  // mesma categoria se comportam igual, sem precisar duplicar lógica
  // (pedido do usuário: "cada item vai ter uma funcionalidade
  // diferente... acredito que possa ser por grupo tb, já que uma câmera
  // e uma pokédex vão ter a mesma funcionalidade, assim como itens
  // consumíveis e lançáveis" — ver docs/features/031-*.md). Categorias
  // hoje:
  // - 'throwable' — clique primário arremessa (`playerActionSystem.js`).
  //   Nenhum item da beta usa (o caminho fica pra Pokébola da 043).
  // - 'consumable' — poção: cura na hora (`consumable.healAmount` abaixo).
  //   Clique primário cura o treinador; pelo menu de ações, a criatura
  //   invocada (`usarItemNaCriatura`).
  // - 'berry' — fruta: quem come cura aos poucos e fica parado enquanto
  //   come (`berry` abaixo, `core/actions/eating.js`). Clique primário o
  //   treinador come; pelo menu de ações, a criatura invocada.
  // - 'pokeball' — só catálogo por enquanto (`pokeball` abaixo); usar não
  //   faz nada, a captura é a 043.
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
  // Opcional — `false` pra item que não acumula (ex.: a Pokédex): o
  // inventário não mostra a quantidade. Sem o campo, acumula.
  stackable: true,
  // Só pra category: 'consumable'. Omite se a categoria for outra.
  consumable: {
    healAmount: 30,
  },
  // Só pra category: 'berry'. `healAmount` é a cura TOTAL, espalhada pela
  // `duration` (segundos que leva pra comer).
  berry: {
    healAmount: 10,
    duration: 2,
  },
  // Só pra category: 'pokeball' — multiplica a chance de captura (043).
  pokeball: {
    captureMultiplier: 1,
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
  // `sprite` (ou se a imagem não carregar), cai no ícone padrão da
  // categoria (`tools/shared/ItemFallbackIcon.jsx`).
  sprite: { path: '/assets/sprites/itens/nome-do-arquivo.png' },
  // Opcional — modelo 3D do item (`view/scene/ItemModel.jsx`): hoje a fruta
  // que alguém come ou que caiu no chão. Sem `model`, uma esfera na cor do
  // item.
  // - `path` — o `.glb`.
  // - `texture` — `path` da textura (aplicada em todos os materiais) e
  //   `flipY` (`false` pra textura extraída de dentro de um `.glb`, mesma
  //   regra de `species.model.texture`).
  // - `size` — maior dimensão do modelo, em metros (o `.glb` vem em
  //   qualquer escala; o modelo é redimensionado pra isso).
  // - `eatStages` — só fruta: nomes dos pedaços do modelo, da fruta inteira
  //   à quase acabada. Fica visível um por vez, trocando conforme ela é
  //   comida.
  // - `pivot` — opcional: nome do nó que é o CORPO do item, em volta do qual
  //   ele gira (sem o campo, o primeiro de `eatStages`, ou o modelo
  //   inteiro). O centro da caixa do modelo todo não serve: as folhas da
  //   fruta puxam ele pra fora do corpo.
  model: {
    path: '/assets/models/items/nome-do-arquivo.glb',
    texture: {
      path: '/assets/textures/items/nome-do-arquivo/default/body.png',
      flipY: false,
    },
    size: 0.2,
    eatStages: ['fruit_0', 'fruit_1', 'fruit_2'],
  },
}
