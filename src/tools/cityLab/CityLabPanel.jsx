'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { definirHorario } from '@/core/actions'
import { regenerarTerreno } from '@/core/actions/terrain'
import { getBiome } from '@/core/data/biomes'
import { getCityLayout } from '@/core/data/cityLayouts'
import { GAME_CONFIG } from '@/core/gameConfig'
import { hourOf } from '@/core/time/dayCycle'
import { WorldClock } from '@/core/traits'
import { cameraEntity, playerEntity, world } from '@/core/world/world'
import { moverTreinadorPara } from '@/tools/biomeLab/labWorld'
import { TERRAIN_COLOR_LAYERS } from '@/view/terrain/terrainLayers'
import {
  CITY_LAB_CAMERAS,
  LAB_LAYOUT,
  aplicarCameraDaCidade,
  cidadeDoLab,
} from './cityLabWorld'

const HOURS = 24

// [chave, nome, [mín, máx, passo]] de cada controle do chão
// (`FIRST_TOWN.GROUND`). Mudar refaz o mundo.
const TERRACE_CONTROLS = [
  ['step', 'Altura do degrau (m)', [0.25, 5, 0.05]],
  ['cliff', 'Barranco (0 rampa – 1 seco)', [0, 1, 0.01]],
  ['tilt', 'Inclinação no topo', [0, 0.5, 0.01]],
]
// O nome de cada letra do chão do layout (`ground`) no painel.
const GROUND_LABELS = {
  g: 'Grama',
  t: 'Terra batida',
  a: 'Asfalto',
  p: 'Pedras de pisar',
  m: 'Manchas de terra',
}
// O nome de cada rocha da montanha (`paint.mountain`), de baixo para cima.
const MOUNTAIN_LABELS = [
  'Montanha — barranco de baixo',
  'Montanha — barrancos de cima',
]

// As camadas de cor do relevo para escolher: o nome e o arquivo.
const LAYER_OPTIONS = Object.fromEntries(
  TERRAIN_COLOR_LAYERS.map(([layer, file]) => [`${layer} (${file})`, layer]),
)

const MOUNTAIN_CONTROLS = [
  ['height', 'Altura (m)', [0, 40, 0.5]],
  ['rise', 'Subida (m por m)', [0.1, 4, 0.05]],
  ['step', 'Altura do patamar (m)', [0.5, 10, 0.25]],
  ['cliff', 'Barranco (0 rampa – 1 seco)', [0, 1, 0.01]],
  ['tilt', 'Inclinação no topo', [0, 0.5, 0.01]],
]

/**
 * O painel do laboratório da cidade (docs/features/069-revisao-do-bioma-
 * cidade.md): hora, câmeras prontas e a volta para a chegada; o chão da
 * cidade montada à mão — tamanho, degraus, montanha, lago e rampas — e a
 * textura de cada parte dele (cada letra do chão, a borda de terra da rua,
 * o barranco dos degraus e as rochas da montanha; cada mudança refaz o
 * mundo); a beira da rua (a largura da faixa e a repetição da máscara); e
 * "Copiar valores"
 * do chão, para levar ao `CITIES.FIRST_TOWN` do config e ao `paint` do
 * layout.
 *
 * @param {object} props
 * @param {HTMLElement} props.container - a coluna do painel
 */
export function CityLabPanel({ container }) {
  useEffect(() => {
    const firstTown = GAME_CONFIG.CITIES.FIRST_TOWN
    const gui = new GUI({ title: 'Laboratório da cidade', container })
    gui.domElement.style.width = '100%'
    // Digitar nos campos não pode virar comando do jogo.
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)

    const goToArrival = () => {
      const town = cidadeDoLab()
      if (town) moverTreinadorPara(playerEntity, town.spawn)
    }
    const rebuild = () => regenerarTerreno(world)

    // Cena -----------------------------------------------------------------
    const scene = {
      get hour() {
        return hourOf(world.get(WorldClock).time)
      },
      set hour(hour) {
        const { time } = world.get(WorldClock)
        definirHorario(world, Math.floor(time) + hour / HOURS)
      },
    }
    const sceneFolder = gui.addFolder('Cena')
    sceneFolder
      .add(scene, 'hour', 0, HOURS - 0.01, 0.05)
      .name('Hora')
      .listen()
    sceneFolder
      .add({ go: goToArrival }, 'go')
      .name(`Voltar para a chegada (${cidadeDoLab()?.name ?? '?'})`)

    const cameraFolder = gui.addFolder('Câmera')
    for (const [id, { label }] of Object.entries(CITY_LAB_CAMERAS)) {
      cameraFolder
        .add({ go: () => aplicarCameraDaCidade(cameraEntity, id) }, 'go')
        .name(label)
    }

    // Chão -----------------------------------------------------------------
    const size = {
      get scale() {
        return firstTown.SCALE ?? getBiome('city')?.town?.scale ?? 1
      },
      set scale(value) {
        firstTown.SCALE = value
      },
    }
    gui
      .addFolder('Tamanho')
      .add(size, 'scale', 0.5, 4, 0.05)
      .name('Tamanho da cidade (×)')
      .onFinishChange(rebuild)

    const terraceFolder = gui.addFolder('Degraus (platôs)')
    for (const [key, label, range] of TERRACE_CONTROLS) {
      terraceFolder
        .add(firstTown.GROUND.terraces, key, ...range)
        .name(label)
        .onFinishChange(rebuild)
    }

    // O borrão dos níveis (barranco mais largo e de borda arredondada).
    if (firstTown.GROUND.soften) {
      terraceFolder
        .add(firstTown.GROUND.soften, 'radius', 0, 4, 0.1)
        .name('Suavizar barrancos (células)')
        .onFinishChange(rebuild)
      terraceFolder
        .add(firstTown.GROUND.soften, 'keep', 0, 3, 1)
        .name('Folga presa nos objetos (células)')
        .onFinishChange(rebuild)
    }

    const mountainFolder = gui.addFolder('Montanha (paredão)')
    for (const [key, label, range] of MOUNTAIN_CONTROLS) {
      mountainFolder
        .add(firstTown.GROUND.mountain, key, ...range)
        .name(label)
        .onFinishChange(rebuild)
    }

    const otherFolder = gui.addFolder('Lago, rampas e chão')
    otherFolder
      .add(firstTown.GROUND, 'lakeDepth', 0, 6, 0.05)
      .name('Fundo do lago (m)')
      .onFinishChange(rebuild)
    otherFolder
      .add(firstTown.GROUND, 'lakeWater', 0, 6, 0.05)
      .name('Água do lago abaixo do chão (m)')
      .onFinishChange(rebuild)
    otherFolder
      .add(firstTown.GROUND, 'rampEdge', 0, 4, 0.05)
      .name('Beirada das rampas (m)')
      .onFinishChange(rebuild)
    otherFolder
      .add(firstTown.GROUND, 'swell', 0, 0.5, 0.01)
      .name('Ondulação do chão (090)')
      .onFinishChange(rebuild)
    otherFolder
      .add(firstTown, 'BLEND', 0, 60, 1)
      .name('Mistura com o mundo (m)')
      .onFinishChange(rebuild)

    // A beira da rua (a borda de terra e a guia, desenhadas por pixel).
    if (firstTown.GROUND.curb) {
      const curbFolder = gui.addFolder('Beira da rua (guia)')
      curbFolder
        .add(firstTown.GROUND.curb, 'width', 0.05, 2, 0.01)
        .name('Largura da faixa (m do original)')
        .onFinishChange(rebuild)
      curbFolder
        .add(firstTown.GROUND.curb, 'along', 0.02, 1, 0.01)
        .name('Repetição da máscara (por m)')
        .onFinishChange(rebuild)
    }

    // Texturas ---------------------------------------------------------------
    // O lab troca o `paint` do layout direto (como troca o config): o chão
    // lê a camada de cada letra na hora de desenhar.
    const paint = getCityLayout(LAB_LAYOUT)?.paint
    if (paint) {
      const textureFolder = gui.addFolder('Texturas')
      for (const letter of Object.keys(paint.ground)) {
        textureFolder
          .add(paint.ground, letter, LAYER_OPTIONS)
          .name(`${GROUND_LABELS[letter] ?? letter} (${letter})`)
          .onFinishChange(rebuild)
      }
      if (paint.curb) {
        textureFolder
          .add(paint, 'curb', LAYER_OPTIONS)
          .name('Borda de terra da rua')
          .onFinishChange(rebuild)
      }
      if (paint.steps) {
        textureFolder
          .add(paint, 'steps', LAYER_OPTIONS)
          .name('Barranco dos degraus')
          .onFinishChange(rebuild)
      }
      paint.mountain?.forEach((_, band) => {
        textureFolder
          .add(paint.mountain, band, LAYER_OPTIONS)
          .name(MOUNTAIN_LABELS[band] ?? `Montanha — patamar ${band + 1}`)
          .onFinishChange(rebuild)
      })
    }

    gui
      .add(
        {
          copy: () =>
            navigator.clipboard?.writeText(
              JSON.stringify(
                {
                  SCALE: firstTown.SCALE,
                  BLEND: firstTown.BLEND,
                  GROUND: firstTown.GROUND,
                  paint,
                },
                null,
                2,
              ),
            ),
        },
        'copy',
      )
      .name('Copiar valores do chão')

    return () => gui.destroy()
  }, [container])

  return null
}
