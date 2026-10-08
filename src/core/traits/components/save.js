import { trait } from 'koota'

/**
 * Relógio do salvamento automático do treinador (docs/features/044-salvar-o-
 * jogo.md): segundos desde o último pedido de save. Ao passar de
 * `GAME_CONFIG.SAVE.AUTOSAVE_INTERVAL`, vira um pedido (`SaveRequested`) e
 * volta a zero.
 *
 * Dono de escrita: `autosaveSystem.js`.
 */
export const SaveClock = trait({
  elapsed: 0,
})

/**
 * Pedido de save pendente (tag no treinador). O core só pede; quem grava é a
 * plataforma (`platform/persistence/autosave.js`), que tira a tag ao montar o
 * save. Pedir de novo com um pendente não acumula.
 *
 * Donos de escrita: `pedirSave` (`core/actions/save.js`, põe) e o adapter de
 * persistência (tira).
 */
export const SaveRequested = trait()

/**
 * O treinador já foi preparado: carregado do save ou com o kit inicial
 * (`prepararTreinador`). Impede preparar duas vezes (efeito do React rodando
 * de novo, por exemplo).
 *
 * Dono de escrita: `prepararTreinador` (`core/actions/save.js`).
 */
export const TrainerReady = trait()
