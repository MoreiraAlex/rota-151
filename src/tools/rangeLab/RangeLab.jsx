'use client'

/**
 * Laboratório de alcance (docs/features/062-spawn-estilo-cobblemon.md): testa
 * som e etiqueta de uma selvagem a uma distância exata, sem depender de spawn
 * nem de andar pelo mundo. A selvagem, o som e a etiqueta são os do jogo; a
 * saída de áudio é medida, para o estalo não depender só do ouvido.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { resolveFootstepSound } from '@/core/data/audio/footstepGroups'
import { resolveVoiceSound } from '@/core/data/audio/voiceSound'
import { getSpecies, listSpecies } from '@/core/data/species'
import { GAME_CONFIG } from '@/core/gameConfig'
import { WorldProvider } from '@/core/world/WorldProvider'
import { getAudioListener } from '@/view/audio/audioListener'
import {
  DEFAULT_FOOTSTEP_MAX_DISTANCE,
  DEFAULT_FOOTSTEP_REF_DISTANCE,
  SOUND_FALLOFF,
  distanceGain,
} from '@/view/audio/soundRanges'
import {
  NAMEPLATE_FADE_DISTANCE,
  NAMEPLATE_SHOW_DISTANCE,
  nameplateRangeOpacity,
} from '@/view/scene/nameplateRange'
import { Slider } from '../shared/Slider'
import {
  RANGE_LAB_CAMERA_HEIGHT,
  RANGE_LAB_FOV,
  RangeLabScene,
  SILENCE_THRESHOLD,
} from './RangeLabScene'
import { comparatorVolume } from './CryComparator'
import {
  buildRangeRings,
  describeBearing,
  equalPowerPan,
  resolveSoundRange,
  rightShare,
  volumeChanges,
} from './rangeLabData'
import {
  createRangeLabState,
  resolveVoiceRange,
  resolveVoiceVolume,
} from './rangeLabWorld'

const SPECIES = listSpecies().filter((species) => species.spawn)
// Quem tem grito, para o comparador (inclusive quem não nasce no mundo).
const VOICED = listSpecies().filter(
  (species) => resolveVoiceSound(species)?.clips?.length,
)
const VOICED_IDS = VOICED.map((species) => species.id)
const configVolumeOf = (id) => resolveVoiceVolume(getSpecies(id))
const MAX_COMPARE_VOLUME = 1.5
const COMPARE_MODES = [
  { label: 'Alternar', mode: 'alternate' },
  { label: 'Só A', mode: 'a' },
  { label: 'Só B', mode: 'b' },
  { label: 'Parar', mode: 'off' },
]

function pickVoiced(name, fallback) {
  return VOICED.find((species) => species.id.includes(name))?.id ?? fallback
}
const MAX_DISTANCE = 100
const LIVE_REFRESH_MS = 100
const LOG_SIZE = 12
// O "atravessar" vai deste tanto antes até este tanto depois do limite.
const CROSS_SPAN = 6
const MAP_SIZE = 220
// O mapa mostra até aqui (m); além disso, a selvagem fica na borda.
const MAP_RADIUS = 60
const INITIAL_ZOOM = 3
const MAX_ZOOM = 8
const INITIAL_CURVE = SOUND_FALLOFF.CURVE
const MAX_CURVE = 4
const CHART_WIDTH = 220
const CHART_HEIGHT = 110
const CHART_PAD = 18
const CHART_STEPS = 80
// Até quantos graus do eixo ainda conta como "à frente"/"atrás".
const BEARING_TOLERANCE = 5
const SIDES = [
  { label: 'Frente', angle: 0 },
  { label: 'Esquerda', angle: -90 },
  { label: 'Direita', angle: 90 },
  { label: 'Atrás', angle: 180 },
]

const COLORS = {
  voice: '#7dd3fc',
  footstep: '#fbbf24',
  nameplate: '#6ee7b7',
  spawn: '#e5e7eb',
}

function resolveRanges(species) {
  return {
    voice: resolveVoiceRange(species),
    footstep: resolveSoundRange(resolveFootstepSound(species), {
      refDistance: DEFAULT_FOOTSTEP_REF_DISTANCE,
      maxDistance: DEFAULT_FOOTSTEP_MAX_DISTANCE,
    }),
  }
}

function resolveLimits(ranges) {
  return [
    {
      radius: ranges.voice.maxDistance,
      label: 'voz some',
      color: COLORS.voice,
    },
    {
      radius: ranges.footstep.maxDistance,
      label: 'passos somem',
      color: COLORS.footstep,
    },
    {
      radius: NAMEPLATE_SHOW_DISTANCE,
      label: 'etiqueta some',
      color: COLORS.nameplate,
    },
    {
      radius: NAMEPLATE_SHOW_DISTANCE - NAMEPLATE_FADE_DISTANCE,
      label: 'etiqueta começa a sumir',
      color: COLORS.nameplate,
    },
    {
      radius: GAME_CONFIG.WILD_SPAWN.MIN_RADIUS,
      label: 'spawn mais perto',
      color: COLORS.spawn,
    },
  ]
}

function Button({ active = false, ...props }) {
  return (
    <button
      {...props}
      className={`rounded px-2 py-0.5 disabled:opacity-40 ${active ? 'bg-white/50' : 'bg-white/20'}`}
    />
  )
}

function Reading({ label, value, color }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/70" style={color ? { color } : undefined}>
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

/**
 * Mapa visto de cima, do jeito da câmera: ela no centro olhando para cima,
 * a selvagem onde ela a vê (esquerda no mapa = esquerda no som).
 */
function RangeMap({ rings, distance, bearing }) {
  const scale = MAP_SIZE / 2 / MAP_RADIUS
  const center = MAP_SIZE / 2
  return (
    <svg
      viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
      className="mx-auto w-full max-w-[220px]"
      role="img"
      aria-label="Mapa da distância entre a câmera e a selvagem"
    >
      {rings.map((ring) => (
        <circle
          key={ring.radius}
          cx={center}
          cy={center}
          r={ring.radius * scale}
          fill="none"
          stroke={ring.color}
          strokeOpacity={0.7}
        />
      ))}
      <polygon
        points={`${center},${center - 9} ${center - 5},${center + 4} ${center + 5},${center + 4}`}
        fill="white"
      />
      {distance !== null && bearing !== null && (
        <circle
          cx={
            center +
            Math.sin((bearing * Math.PI) / 180) *
              Math.min(distance, MAP_RADIUS) *
              scale
          }
          cy={
            center -
            Math.cos((bearing * Math.PI) / 180) *
              Math.min(distance, MAP_RADIUS) *
              scale
          }
          r={4}
          fill="#f87171"
        />
      )}
    </svg>
  )
}

/**
 * Volume por distância das duas curvas (voz e passos), com a reta de antes
 * tracejada e a selvagem marcada onde está agora.
 */
function FalloffChart({ ranges, curve, distance }) {
  const span = Math.max(ranges.voice.maxDistance, ranges.footstep.maxDistance)
  const toX = (d) => CHART_PAD + (d / span) * (CHART_WIDTH - 2 * CHART_PAD)
  const toY = (gain) =>
    CHART_HEIGHT - CHART_PAD + gain * (2 * CHART_PAD - CHART_HEIGHT)
  const line = (range, exponent) =>
    Array.from({ length: CHART_STEPS + 1 }, (_, i) => {
      const d = (i / CHART_STEPS) * span
      return `${toX(d).toFixed(1)},${toY(distanceGain(d, range, exponent)).toFixed(1)}`
    }).join(' ')
  const here = distance === null ? null : Math.min(distance, span)
  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      className="mx-auto w-full max-w-[220px]"
      role="img"
      aria-label="Volume da voz e dos passos pela distância"
    >
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(span)}
        y2={toY(0)}
        stroke="white"
        strokeOpacity={0.3}
      />
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(0)}
        y2={toY(1)}
        stroke="white"
        strokeOpacity={0.3}
      />
      <polyline
        points={line(ranges.voice, 1)}
        fill="none"
        stroke={COLORS.voice}
        strokeOpacity={0.4}
        strokeDasharray="3 3"
      />
      <polyline
        points={line(ranges.footstep, curve)}
        fill="none"
        stroke={COLORS.footstep}
        strokeWidth={1.5}
      />
      <polyline
        points={line(ranges.voice, curve)}
        fill="none"
        stroke={COLORS.voice}
        strokeWidth={2}
      />
      {here !== null && (
        <line
          x1={toX(here)}
          y1={toY(0)}
          x2={toX(here)}
          y2={toY(1)}
          stroke="#f87171"
        />
      )}
      <text x={toX(0)} y={CHART_HEIGHT - 4} fill="white" fontSize={9}>
        0 m
      </text>
      <text
        x={toX(span)}
        y={CHART_HEIGHT - 4}
        fill="white"
        fontSize={9}
        textAnchor="end"
      >
        {span} m
      </text>
      <text x={toX(0) + 3} y={toY(1) + 8} fill="white" fontSize={9}>
        100%
      </text>
    </svg>
  )
}

/** Uma barra: quanto do som sai em cada lado (esquerda | direita). */
function PanBar({ label, share }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 text-white/70">{label}</span>
      <span className="w-9 text-right font-mono">
        {share === null ? '—' : `${Math.round((1 - share) * 100)}%`}
      </span>
      <div className="relative h-3 flex-1 rounded bg-white/10">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/40" />
        {share !== null && (
          <div
            className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded bg-red-400"
            style={{ left: `${share * 100}%` }}
          />
        )}
      </div>
      <span className="w-9 font-mono">
        {share === null ? '—' : `${Math.round(share * 100)}%`}
      </span>
    </div>
  )
}

function describeLog(entry) {
  if (entry.kind === 'compare') {
    return `${entry.slot.toUpperCase()} · ${entry.speciesId} (volume ${entry.volume}) a ${entry.distance.toFixed(1)} m: pico ${entry.peak.toFixed(3)}`
  }
  const where = `${entry.distance.toFixed(1)} m, ${describeBearing(entry.bearing, BEARING_TOLERANCE)}`
  const peak = entry.peak.toFixed(3)
  if (entry.clicked) {
    const what = entry.kind === 'voice' ? 'voz' : 'passo'
    return `ESTALO: ${what} fora do alcance, a ${where} (pico ${peak})`
  }
  const share = rightShare(entry)
  const sides =
    share === null
      ? ''
      : ` · E ${Math.round((1 - share) * 100)}% D ${Math.round(share * 100)}%`
  return `Grito a ${where}: pico ${peak}${sides}`
}

function SpeciesSelect({ label, value, options, onChange }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-32 text-white/70">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 rounded bg-white/10"
      >
        {options.map((candidate) => (
          <option
            key={candidate.id}
            value={candidate.id}
            className="text-black"
          >
            #{candidate.dexNumber} {candidate.id}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Um lado do comparador: a espécie e o volume dela. */
function CompareSlot({ name, compare, onSpecies, onVolume }) {
  const species = getSpecies(compare[name])
  const volume = comparatorVolume(species, compare.volumes)
  const config = resolveVoiceVolume(species)
  return (
    <div className="space-y-1 rounded bg-white/5 p-2">
      <SpeciesSelect
        label={name.toUpperCase()}
        value={species.id}
        options={VOICED}
        onChange={onSpecies}
      />
      <Slider
        label="Volume"
        value={volume}
        min={0}
        max={MAX_COMPARE_VOLUME}
        step={0.05}
        onChange={(value) => onVolume(species.id, value)}
      />
      <div className="flex items-center justify-between text-white/60">
        <span>No config: {config}</span>
        <Button
          disabled={volume === config}
          onClick={() => onVolume(species.id, config)}
        >
          Voltar ao config
        </Button>
      </div>
    </div>
  )
}

export function RangeLab() {
  const [lab, setLab] = useState(() => ({
    speciesId: SPECIES[0].id,
    mode: 'still',
    distance: NAMEPLATE_SHOW_DISTANCE + CROSS_SPAN,
    angle: 0,
    orbitSpeed: 30,
    from: NAMEPLATE_SHOW_DISTANCE - CROSS_SPAN,
    to: NAMEPLATE_SHOW_DISTANCE + CROSS_SPAN,
    speed: SPECIES[0].movement.walkSpeed,
    respawnEvery: 2,
    cryEvery: 0,
  }))
  const labRef = useRef(lab)
  labRef.current = lab
  const [compare, setCompare] = useState(() => ({
    mode: 'off',
    gap: 1,
    a: pickVoiced('ekans', VOICED_IDS[0]),
    b: pickVoiced('pidgey', VOICED_IDS[1] ?? VOICED_IDS[0]),
    volumes: {},
  }))
  const compareRef = useRef(compare)
  compareRef.current = compare
  const changes = volumeChanges(compare.volumes, configVolumeOf, VOICED_IDS)
  const updateCompare = (patch) =>
    setCompare((current) => ({ ...current, ...patch }))
  const setVolume = (id, value) =>
    setCompare((current) => ({
      ...current,
      volumes: { ...current.volumes, [id]: value },
    }))
  const changesText = changes
    .map(({ speciesId, from, to }) => `${speciesId}: volume ${from} → ${to}`)
    .join('\n')
  const copyChanges = () => {
    try {
      navigator.clipboard?.writeText(changesText)
    } catch {
      // Sem área de transferência: o texto continua na tela.
    }
  }
  const stateRef = useRef(null)
  stateRef.current ??= createRangeLabState()
  const liveRef = useRef({
    distance: null,
    bearing: null,
    peak: 0,
    left: 0,
    right: 0,
  })
  const [live, setLive] = useState(liveRef.current)
  const [log, setLog] = useState([])
  const [zoom, setZoom] = useState(INITIAL_ZOOM)
  const [curve, setCurve] = useState(INITIAL_CURVE)

  // A curva é a do jogo: o lab mexe nela ao vivo e devolve ao sair.
  const changeCurve = (value) => {
    SOUND_FALLOFF.CURVE = value
    setCurve(value)
  }
  useEffect(
    () => () => {
      SOUND_FALLOFF.CURVE = INITIAL_CURVE
    },
    [],
  )

  const species = getSpecies(lab.speciesId)
  const ranges = useMemo(() => resolveRanges(species), [species])
  const rings = useMemo(() => buildRangeRings(resolveLimits(ranges)), [ranges])

  useEffect(() => {
    const timer = setInterval(
      () => setLive({ ...liveRef.current }),
      LIVE_REFRESH_MS,
    )
    return () => clearInterval(timer)
  }, [])

  // O navegador só libera o som depois de um gesto na página.
  useEffect(() => {
    const resume = () => getAudioListener().context.resume()
    window.addEventListener('pointerdown', resume)
    return () => window.removeEventListener('pointerdown', resume)
  }, [])

  const onLog = useCallback((entry) => {
    setLog((current) =>
      [{ ...entry, id: Math.random() }, ...current].slice(0, LOG_SIZE),
    )
  }, [])

  const update = (changes) => setLab((current) => ({ ...current, ...changes }))
  const command = (name) => stateRef.current.commands.push(name)
  const crossLimit = (radius) =>
    update({
      mode: 'shuttle',
      from: Math.max(0, radius - CROSS_SPAN),
      to: radius + CROSS_SPAN,
    })

  const { distance, bearing, peak } = live
  const heard = peak > SILENCE_THRESHOLD ? rightShare(live) : null
  const expected = bearing === null ? null : rightShare(equalPowerPan(bearing))
  const voiceGain =
    distance === null ? 0 : distanceGain(distance, ranges.voice, curve)
  const footstepGain =
    distance === null ? 0 : distanceGain(distance, ranges.footstep, curve)
  const plate = distance === null ? 0 : nameplateRangeOpacity(distance)

  return (
    <WorldProvider>
      <div className="relative h-screen w-screen bg-neutral-900 text-sm text-white">
        <div className="absolute inset-y-0 left-0 right-0 md:right-[26rem]">
          <Canvas
            camera={{
              position: [0, RANGE_LAB_CAMERA_HEIGHT, 0],
              fov: RANGE_LAB_FOV,
            }}
          >
            <RangeLabScene
              labRef={labRef}
              stateRef={stateRef}
              liveRef={liveRef}
              compareRef={compareRef}
              ranges={ranges}
              rings={rings}
              zoom={zoom}
              onLog={onLog}
            />
          </Canvas>
        </div>

        <div className="absolute right-0 top-0 h-full w-[26rem] max-w-full space-y-4 overflow-y-auto bg-black/80 p-4">
          <h1 className="text-base font-bold">Laboratório de alcance</h1>
          <p className="text-white/60">
            A câmera fica parada; arraste a cena para girar. Som e etiqueta
            medem a distância a partir dela. O zoom só aproxima a imagem: não
            muda a distância.
          </p>

          <section className="space-y-1">
            <label className="flex items-center gap-2">
              <span className="w-32 text-white/70">Pokémon</span>
              <select
                value={lab.speciesId}
                onChange={(event) => update({ speciesId: event.target.value })}
                className="flex-1 rounded bg-white/10"
              >
                {SPECIES.map((candidate) => (
                  <option
                    key={candidate.id}
                    value={candidate.id}
                    className="text-black"
                  >
                    #{candidate.dexNumber} {candidate.id}
                  </option>
                ))}
              </select>
            </label>
            <Slider
              label="Distância"
              value={lab.distance}
              min={0}
              max={MAX_DISTANCE}
              step={0.5}
              unit="m"
              onChange={(value) => update({ distance: value, mode: 'still' })}
            />
            <Slider
              label="Zoom"
              value={zoom}
              min={1}
              max={MAX_ZOOM}
              step={0.5}
              onChange={setZoom}
            />
          </section>

          <section className="space-y-1">
            <h2 className="font-semibold">Agora</h2>
            <RangeMap rings={rings} distance={distance} bearing={bearing} />
            <Reading
              label="Distância da câmera"
              value={distance === null ? '—' : `${distance.toFixed(1)} m`}
            />
            <Reading
              label="De onde vem (da câmera)"
              value={
                bearing === null
                  ? '—'
                  : describeBearing(bearing, BEARING_TOLERANCE)
              }
            />
            <Reading
              label={`Voz (some em ${ranges.voice.maxDistance} m)`}
              value={`${Math.round(voiceGain * 100)}%`}
              color={COLORS.voice}
            />
            <Reading
              label={`Passos (somem em ${ranges.footstep.maxDistance} m)`}
              value={`${Math.round(footstepGain * 100)}%`}
              color={COLORS.footstep}
            />
            <Reading
              label={`Etiqueta (some em ${NAMEPLATE_SHOW_DISTANCE} m)`}
              value={`${Math.round(plate * 100)}%`}
              color={COLORS.nameplate}
            />
            <Reading
              label="Som saindo agora (pico)"
              value={peak > SILENCE_THRESHOLD ? peak.toFixed(3) : 'silêncio'}
            />
          </section>

          <section className="space-y-1">
            <h2 className="font-semibold">Queda do volume</h2>
            <FalloffChart ranges={ranges} curve={curve} distance={distance} />
            <Slider
              label="Curva"
              value={curve}
              min={1}
              max={MAX_CURVE}
              step={0.1}
              onChange={changeCurve}
            />
            <p className="text-white/60">
              Na curva 1, o volume cai em reta (a tracejada, como era antes): o
              ouvido sente quase igual por boa parte do caminho e então corta.
              Mais alta, cai desde perto e chega ao fim baixinho. Vale para
              todos os sons do lab; use Ir e voltar com Gritar a cada para
              ouvir. O padrão do jogo é {INITIAL_CURVE}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Esquerda / direita</h2>
            <PanBar label="Saindo" share={heard} />
            <PanBar label="Esperado" share={expected} />
            <p className="text-white/60">
              Saindo = o que o medidor lê em cada canal enquanto há som;
              esperado = a conta do pan do jogo para o lado em que a selvagem
              está. Os dois têm que andar juntos. O pan só separa esquerda de
              direita: atrás soa igual à frente.
            </p>
            <Slider
              label="Ângulo"
              value={lab.angle}
              min={-180}
              max={180}
              step={5}
              unit="°"
              onChange={(value) => update({ angle: value })}
            />
            <div className="flex flex-wrap gap-2">
              {SIDES.map((side) => (
                <Button
                  key={side.label}
                  active={lab.mode !== 'orbit' && lab.angle === side.angle}
                  onClick={() =>
                    update({
                      angle: side.angle,
                      mode: lab.mode === 'orbit' ? 'still' : lab.mode,
                    })
                  }
                >
                  {side.label}
                </Button>
              ))}
              <Button
                onClick={() => stateRef.current.viewCommands.push('lookAhead')}
              >
                Olhar para a frente
              </Button>
            </div>
            <p className="text-white/60">
              O ângulo conta da frente do lab; se você girou a câmera, use Olhar
              para a frente. Para ouvir de fone: Dar a volta (em Movimento) com
              Gritar a cada.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Comparar gritos</h2>
            <p className="text-white/60">
              Dois Pokémon gritam no mesmo ponto (distância e ângulo de cima),
              pelo mesmo caminho de som do jogo. Ajuste o volume até soarem
              iguais; o que mudar do config aparece embaixo. A selvagem sai,
              para não gritar junto.
            </p>
            <CompareSlot
              name="a"
              compare={compare}
              onSpecies={(id) => updateCompare({ a: id })}
              onVolume={setVolume}
            />
            <CompareSlot
              name="b"
              compare={compare}
              onSpecies={(id) => updateCompare({ b: id })}
              onVolume={setVolume}
            />
            <div className="flex flex-wrap gap-2">
              {COMPARE_MODES.map(({ label, mode }) => (
                <Button
                  key={mode}
                  active={compare.mode === mode}
                  onClick={() => {
                    if (mode !== 'off') command('remove')
                    updateCompare({ mode })
                  }}
                >
                  {label}
                </Button>
              ))}
            </div>
            <Slider
              label="Pausa entre gritos"
              value={compare.gap}
              min={0}
              max={5}
              step={0.25}
              unit="s"
              onChange={(value) => updateCompare({ gap: value })}
            />
            {changes.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-white/70">Para o config</h3>
                <pre className="whitespace-pre-wrap rounded bg-white/10 p-2 font-mono text-xs">
                  {changesText}
                </pre>
                <Button onClick={copyChanges}>Copiar</Button>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Testar o estalo</h2>
            <p className="text-white/60">
              Uma selvagem nova nasce fora do alcance e grita pela primeira vez.
              Tem que sair mudo: o registro abaixo mostra o pico.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => command('clickTest')}>
                Rodar o teste do estalo
              </Button>
              <Button onClick={() => command('cry')}>Gritar agora</Button>
            </div>
            <Slider
              label="Gritar a cada"
              value={lab.cryEvery}
              min={0}
              max={10}
              step={0.5}
              unit="s"
              onChange={(value) => update({ cryEvery: value })}
            />
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold">Movimento</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                active={lab.mode === 'still'}
                onClick={() => update({ mode: 'still' })}
              >
                Parado
              </Button>
              <Button
                active={lab.mode === 'shuttle'}
                onClick={() => update({ mode: 'shuttle' })}
              >
                Ir e voltar
              </Button>
              <Button
                active={lab.mode === 'orbit'}
                onClick={() => update({ mode: 'orbit' })}
              >
                Dar a volta
              </Button>
              <Button
                active={lab.mode === 'respawn'}
                onClick={() => update({ mode: 'respawn' })}
              >
                Nascer em loop
              </Button>
            </div>
            {lab.mode === 'orbit' && (
              <Slider
                label="Velocidade da volta"
                value={lab.orbitSpeed}
                min={-90}
                max={90}
                step={5}
                unit="°/s"
                onChange={(value) => update({ orbitSpeed: value })}
              />
            )}
            {lab.mode === 'shuttle' && (
              <div className="space-y-1">
                <Slider
                  label="De"
                  value={lab.from}
                  min={0}
                  max={MAX_DISTANCE}
                  step={0.5}
                  unit="m"
                  onChange={(value) => update({ from: value })}
                />
                <Slider
                  label="Até"
                  value={lab.to}
                  min={0}
                  max={MAX_DISTANCE}
                  step={0.5}
                  unit="m"
                  onChange={(value) => update({ to: value })}
                />
                <Slider
                  label="Velocidade"
                  value={lab.speed}
                  min={0.5}
                  max={15}
                  step={0.5}
                  unit="m/s"
                  onChange={(value) => update({ speed: value })}
                />
                <div className="flex flex-wrap gap-2">
                  {rings.map((ring) => (
                    <Button
                      key={ring.radius}
                      onClick={() => crossLimit(ring.radius)}
                    >
                      Atravessar {ring.radius} m
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {lab.mode === 'respawn' && (
              <div className="space-y-1">
                <Slider
                  label="Nascer a cada"
                  value={lab.respawnEvery}
                  min={0.5}
                  max={10}
                  step={0.5}
                  unit="s"
                  onChange={(value) => update({ respawnEvery: value })}
                />
                <p className="text-white/60">
                  Para ver a piscada da etiqueta: deixe a distância além de{' '}
                  {NAMEPLATE_SHOW_DISTANCE} m. Ela não pode aparecer.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => command('respawn')}>Nascer de novo</Button>
              <Button onClick={() => command('remove')}>Tirar</Button>
            </div>
          </section>

          <section className="space-y-1">
            <h2 className="font-semibold">Registro</h2>
            {log.length === 0 && (
              <p className="text-white/60">Nenhum grito ainda.</p>
            )}
            <ul className="space-y-0.5 font-mono text-xs">
              {log.map((entry) => (
                <li
                  key={entry.id}
                  className={entry.clicked ? 'text-red-300' : 'text-white/80'}
                >
                  {describeLog(entry)}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </WorldProvider>
  )
}
