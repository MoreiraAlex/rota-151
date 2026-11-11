'use client'

import { useEffect, useState } from 'react'
import { useTrait } from 'koota/react'
import { playerEntity } from '@/core/world/world'
import { GraphicsSettings } from '@/core/traits'
import { GAME_CONFIG } from '@/core/gameConfig'
import { fogRange } from '@/core/terrain/fogRange'
import {
  ASPECT_LEVELS,
  SHADOW_LEVELS,
  aspectRatioOf,
  canvasSizeOf,
  definirDistanciaDeVisao,
  definirProporcao,
  definirSombra,
  definirTamanhoDaTela,
  pedirSave,
} from '@/core/actions'

// Nome e explicação de cada nível, por opção.
const SHADOW = {
  off: ['Desligada', 'Sem sombra nenhuma: o mais leve.'],
  low: [
    'Baixa',
    'Sombra mais perto e mais simples, só no chão e nos personagens.',
  ],
  medium: ['Média', 'Sombra em tudo, com a borda mais dura.'],
  high: ['Alta', 'Sombra em tudo, mais longe e com a borda macia.'],
}

const ASPECT = {
  fill: ['Tela', 'O jogo ocupa a janela inteira.'],
  '21:9': [
    '21:9',
    'Bem largo, como cinema: faixas pretas em cima e embaixo numa tela comum, menos área desenhada.',
  ],
  '16:9': ['16:9', 'A proporção da maioria das telas e TVs.'],
  '16:10': ['16:10', 'Um pouco mais alto que 16:9, comum em notebooks.'],
  '4:3': [
    '4:3',
    'Quase quadrado, como as telas antigas: faixas pretas nas laterais numa tela larga, menos área desenhada.',
  ],
}

const PERCENT = 100

/**
 * Tela "Gráficos" do menu de pausa (docs/features/066-revisao-dos-
 * biomas.md): o nível da sombra, a proporção e o tamanho do canvas e a
 * distância de visão.
 * Escolher já muda o desenho e pede um save, pra ficar na conta (como o
 * som). Novas opções de gráficos entram aqui, uma por bloco.
 */
export function GraphicsSettingsPanel() {
  const settings = useTrait(playerEntity, GraphicsSettings)
  const windowSize = useWindowSize()
  if (!settings) return null

  const pick = (definir) => (level) => {
    if (definir(playerEntity, level)) pedirSave(playerEntity)
  }

  return (
    <div className="space-y-3 text-xs">
      <LevelChoice
        title="Sombra"
        levels={SHADOW_LEVELS}
        texts={SHADOW}
        current={settings.shadow}
        onPick={pick(definirSombra)}
      />
      <LevelChoice
        title="Proporção"
        levels={ASPECT_LEVELS}
        texts={ASPECT}
        current={settings.aspect}
        onPick={pick(definirProporcao)}
      />
      <CanvasSizeSlider settings={settings} windowSize={windowSize} />
      <ViewDistanceSlider settings={settings} />
    </div>
  )
}

// Colunas da fileira de botões pelo número de níveis (classes inteiras,
// para o Tailwind achar).
const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }

/** Uma opção: um botão por nível e a explicação do escolhido. */
function LevelChoice({ title, levels, texts, current, onPick }) {
  return (
    <div>
      <span className="text-white/80">{title}</span>
      <div
        className={`mt-1 grid gap-1 ${COLUMNS[levels.length] ?? 'grid-cols-5'}`}
      >
        {levels.map((level) => (
          <button
            key={level}
            type="button"
            className={`rounded px-1 py-1 ${
              current === level
                ? 'bg-white text-neutral-900'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
            onClick={() => onPick(level)}
          >
            {texts[level]?.[0] ?? level}
          </button>
        ))}
      </div>
      <p className="mt-1 text-white/50">{texts[current]?.[1]}</p>
    </div>
  )
}

/**
 * O tamanho do canvas: um controle deslizante, com o tamanho em pixels que
 * o canvas vai ter nesta janela (o jogo ocupa a janela toda — o lab, que
 * tem o painel do lado, fica um pouco menor). Arrastar já muda; soltar
 * pede o save.
 */
function CanvasSizeSlider({ settings, windowSize }) {
  const { MIN, STEP } = GAME_CONFIG.GRAPHICS.CANVAS_SIZE
  const percent = Math.round(settings.canvasScale * PERCENT)
  const { width, height } = canvasSizeOf(
    windowSize.width,
    windowSize.height,
    aspectRatioOf(settings.aspect),
    settings.canvasScale,
  )
  const save = () => pedirSave(playerEntity)

  return (
    <label className="block">
      <span className="flex justify-between text-white/80">
        <span>Tamanho da tela</span>
        <span className="tabular-nums text-white/60">
          {width}×{height} ({percent}%)
        </span>
      </span>
      <input
        type="range"
        min={Math.round(MIN * PERCENT)}
        max={PERCENT}
        step={Math.round(STEP * PERCENT)}
        value={percent}
        className="mt-1 w-full accent-white"
        onChange={(event) =>
          definirTamanhoDaTela(
            playerEntity,
            Number(event.target.value) / PERCENT,
          )
        }
        onPointerUp={save}
        onKeyUp={save}
      />
      <p className="mt-1 text-white/50">
        Diminui o jogo dentro da janela, com preto em volta: menos pixels para
        desenhar, e a imagem continua nítida.
      </p>
    </label>
  )
}

/**
 * A distância de visão: um controle deslizante em chunks, com até onde se
 * vê (onde a névoa fecha) nessa distância. Arrastar já muda (o mundo
 * carrega ou descarrega aos poucos); soltar pede o save.
 */
function ViewDistanceSlider({ settings }) {
  const { MIN, MAX } = GAME_CONFIG.GRAPHICS.VIEW_DISTANCE
  const { TERRAIN, CAMERA, FOG } = GAME_CONFIG
  const reach = Math.round(
    fogRange({
      loadRadius: settings.viewDistance,
      chunkSize: TERRAIN.CHUNK_SIZE,
      cameraMaxDistance: CAMERA.MAX_DISTANCE,
      startFraction: FOG.START_FRACTION,
      minDistance: FOG.MIN_DISTANCE,
    }).far,
  )
  const save = () => pedirSave(playerEntity)

  return (
    <label className="block">
      <span className="flex justify-between text-white/80">
        <span>Distância de visão</span>
        <span className="tabular-nums text-white/60">
          {settings.viewDistance} chunks (~{reach} m)
        </span>
      </span>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={settings.viewDistance}
        className="mt-1 w-full accent-white"
        onChange={(event) =>
          definirDistanciaDeVisao(playerEntity, Number(event.target.value))
        }
        onPointerUp={save}
        onKeyUp={save}
      />
      <p className="mt-1 text-white/50">
        Quanto do mundo fica carregado em volta de você. Mais longe, você vê
        mais longe, mas o jogo fica mais pesado; mais perto, a névoa fecha antes
        e o jogo fica mais leve.
      </p>
    </label>
  )
}

/** Largura e altura da janela, acompanhando o redimensionamento. */
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return size
}
