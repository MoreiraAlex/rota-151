import { trait } from 'koota'

/**
 * Modo scanner ligado/desligado — pedido do usuário: "para a pokédex,
 * quero que quando equipada, ao clicar com o botão direito a câmera
 * fique em primeira pessoa para eu poder escanear o pokémon alvo, pode
 * mudar a hud inteira para simular o visor da pokédex". `active` é um
 * TOGGLE (não um estado contínuo tipo a mira antiga, `AimAnchor`,
 * removida — ver docs/features/029-*.md): clicar de novo liga/desliga,
 * não precisa segurar.
 *
 * Não é exclusivo de item nenhum por ID — qualquer item de categoria
 * `scanner` (câmera, Pokédex — "uma câmera e uma pokédex vão ter a
 * mesma funcionalidade", pedido do usuário) ativa o mesmo modo, ver
 * `scannerModeSystem.js`. Presente em toda entidade que pode ficar
 * `InputControlled` (treinador e `SummonedCreature`, mesmo padrão que
 * `AimAnchor` já seguia) — só o treinador tem `HeldItem` de verdade
 * equipado com algo, então só ele ativa de fato; numa criatura fica
 * sempre `false`, sem uso.
 *
 * `menuOpenRequests` (novo, docs/features/033-*.md) — pedido do
 * usuário: "ao clicar com o botão esquerdo, abrir o menu principal da
 * Pokédex" (ver seção 1). Contador MONOTÔNICO (não booleano/pulso de um
 * tick só) incrementado por `scannerModeSystem.js` a cada clique
 * esquerdo válido (item scanner equipado, fora do modo scanner) — mesmo
 * mecanismo de "contador que só sobe" de `ScanHistory`
 * (`core/traits/components/scanHistory.js`), aqui pra sinalizar reativo
 * pro React (`useTrait` + `useEffect` reagindo à MUDANÇA do número, não
 * um booleano que ligaria/desligaria no mesmo tick e arriscaria o React
 * nunca ver a borda de subida).
 *
 * Dono de escrita: `scannerModeSystem`. Leem: `view/systems/
 * cameraFollowSystem.js` (câmera em primeira pessoa), `src/app/(auth)/
 * page.js` (troca a HUD inteira pelo visor; abre o menu principal da
 * Pokédex em `menuOpenRequests`).
 */
export const ScanMode = trait({
  active: false,
  menuOpenRequests: 0,
})
