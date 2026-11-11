import { trait } from 'koota'
import { GAME_CONFIG } from '../../gameConfig'

/**
 * Gráficos escolhidos pelo jogador (docs/features/066-revisao-dos-
 * biomas.md): o nível da sombra (`shadow`, uma das chaves de
 * `GAME_CONFIG.GRAPHICS.SHADOW.LEVELS`), a proporção do canvas (`aspect`,
 * de `GRAPHICS.ASPECT.LEVELS`) e o tamanho dele (`canvasScale`, fração do
 * lado, `GRAPHICS.CANVAS_SIZE`) e a distância de visão (`viewDistance`, o
 * raio carregado em chunks, `GRAPHICS.VIEW_DISTANCE`). Vive no treinador porque é da conta
 * (vai no save dele, como o som). O core só guarda a escolha; quem aplica
 * no desenho é a view (`DayNightView.jsx`, `VegetationView.jsx`,
 * `GameCanvas.jsx`); a distância de visão, o `chunkStreamingSystem`.
 *
 * Donos de escrita: `definirSombra` / `definirProporcao` /
 * `definirTamanhoDaTela` / `definirDistanciaDeVisao`
 * (`core/actions/graphicsSettings.js`, o menu) e `restoreTrainer` (save).
 */
export const GraphicsSettings = trait(() => ({
  shadow: GAME_CONFIG.GRAPHICS.SHADOW.DEFAULT,
  aspect: GAME_CONFIG.GRAPHICS.ASPECT.DEFAULT,
  canvasScale: GAME_CONFIG.GRAPHICS.CANVAS_SIZE.DEFAULT,
  viewDistance: GAME_CONFIG.GRAPHICS.VIEW_DISTANCE.DEFAULT,
}))
