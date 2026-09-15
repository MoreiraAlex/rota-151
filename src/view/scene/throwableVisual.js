/**
 * Aparência compartilhada de "um throwable genérico" — nenhum item hoje
 * tem modelo 3D próprio (ver core/data/items/pebble/index.js: só
 * `id`/`category`), então tanto o projétil em voo (`ProjectileView.jsx`)
 * quanto o item na mão antes de arremessar (`heldItemViewSystem.js`) usam
 * a mesma esfera cinza simples — um lugar só pra não divergir o visual
 * entre "na mão" e "voando" do mesmo objeto.
 */
export const THROWABLE_RADIUS = 0.085
export const THROWABLE_COLOR = '#8a8a8a'
