'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { GAME_CONFIG } from '@/core/gameConfig'
import { regenerarTerreno } from '@/core/actions/terrain'
import { world } from '@/core/world/world'

// Faixas dos controles: [mín, máx, passo]. Só a ferramenta usa.
const CONTROLS = {
  HILL_SIZE: { label: 'Largura dos morros (m)', range: [10, 300, 1] },
  HILL_HEIGHT: { label: 'Altura dos morros (m)', range: [0, 30, 0.1] },
  ROUGHNESS: { label: 'Detalhe miúdo', range: [0, 1, 0.01] },
  FLATNESS: { label: 'Campo plano', range: [0.5, 3, 0.05] },
  WATER_LEVEL: { label: 'Nível da água (m)', range: [-15, 15, 0.1] },
  CHUNK_SIZE: { label: 'Lado do chunk (m)', range: [16, 128, 1] },
  AREA_RADIUS: { label: 'Raio da área (chunks)', range: [0, 4, 1] },
}

// Valores de quando o jogo carregou — o "Voltar ao inicial".
const INITIAL = { seed: GAME_CONFIG.WORLD.SEED, ...GAME_CONFIG.TERRAIN }

const configAsText = () =>
  `WORLD.SEED: ${GAME_CONFIG.WORLD.SEED}\n` +
  Object.keys(CONTROLS)
    .map((key) => `${key}: ${GAME_CONFIG.TERRAIN[key]},`)
    .join('\n')

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel `lil-gui` que
 * ajusta o relevo em tempo real (docs/features/045-terreno-de-um-chunk.md).
 * Mexe direto em `GAME_CONFIG.TERRAIN`/`WORLD.SEED` (só nesta sessão) e chama
 * `regenerarTerreno`. "Copiar valores" leva os números para colar no
 * `gameConfig.js` — é o caminho para o ajuste virar config de verdade.
 *
 * A seed aqui só muda o relevo e o que depende dele: o RNG de gameplay já
 * foi criado com a seed do início.
 */
export function TerrainTuningPanel() {
  useEffect(() => {
    const regenerate = () => regenerarTerreno(world)

    const gui = new GUI({ title: 'Terreno' })
    // Digitar nos campos não pode virar comando do jogo (o teclado do jogo
    // escuta a janela inteira: "1" invocaria o slot 1).
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)
    const seedState = { seed: GAME_CONFIG.WORLD.SEED }
    gui
      .add(seedState, 'seed')
      .name('Seed')
      .step(1)
      .onFinishChange((seed) => {
        GAME_CONFIG.WORLD.SEED = seed
        regenerate()
      })

    for (const [key, { label, range }] of Object.entries(CONTROLS)) {
      gui
        .add(GAME_CONFIG.TERRAIN, key, ...range)
        .name(label)
        .onChange(regenerate)
    }

    gui
      .add(
        {
          copy: () => navigator.clipboard?.writeText(configAsText()),
        },
        'copy',
      )
      .name('Copiar valores')
    gui
      .add(
        {
          reset: () => {
            const { seed, ...terrain } = INITIAL
            GAME_CONFIG.WORLD.SEED = seed
            seedState.seed = seed
            Object.assign(GAME_CONFIG.TERRAIN, terrain)
            gui.controllersRecursive().forEach((c) => c.updateDisplay())
            regenerate()
          },
        },
        'reset',
      )
      .name('Voltar ao inicial')

    return () => gui.destroy()
  }, [])

  return null
}
