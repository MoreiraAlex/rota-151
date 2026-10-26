'use client'

/**
 * Laboratório de golpes — NÃO faz parte do jogo (página `/tools/lab-golpes`,
 * docs/features/061-revisao-das-skills.md, Parte 1). Escolhe o Pokémon, o
 * golpe e o alvo, e o golpe fica rodando em loop pelo combate de verdade
 * (`skillLabWorld.js`), com todos os campos do golpe ajustáveis ao vivo.
 *
 * Os ajustes mexem nos dados que o jogo lê (`skillLabLive.js`) e voltam ao
 * que veio dos arquivos ao sair da página; "Copiar" dá o trecho pra colar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { WorldProvider } from '@/core/world/WorldProvider'
import { getSkill } from '@/core/data/skills'
import { getSpecies, listSpecies } from '@/core/data/species'
import { listLearnset } from '@/core/data/species/moves'
import { EVENT_TYPES } from '@/core/events'
import { getAudioListener } from '@/view/audio/audioListener'
import { listAttackEffectGroups } from '@/view/scene/attackEffects/registry'
import { CONTINUOUS_EFFECT_GROUPS } from '@/view/scene/ContinuousAttackEffectsView'
import { Slider } from '../shared/Slider'
import { SkillLabScene } from './SkillLabScene'
import { SkillParamsPanel } from './SkillParamsPanel'
import { SkillTimeline } from './SkillTimeline'
import { CreatureSection } from './CreatureSection'
import { buildFieldSections } from './skillLabFields'
import {
  clearLayer,
  diffBase,
  editLayer,
  formatBaseChanges,
  formatSpeciesEntry,
  mergeLayers,
  minimalOverrides,
} from './skillLabData'
import {
  applyLiveBase,
  applyLiveOverrides,
  captureSkillData,
  findSpeciesMove,
  restoreMove,
  restoreSkillData,
  applyLiveTrigger,
  restoreTrigger,
} from './skillLabLive'
import {
  LAB_MAX_TARGETS,
  LabActor,
  readLabGap,
  resolveLabAttack,
  resolveLabReferenceDistance,
  resolveLabRelief,
  resolveTargetZForGap,
} from './skillLabWorld'
import { world } from '@/core/world/world'
import { RELIEF_KINDS } from './labRelief'

const SPECIES = listSpecies()
  .filter((species) => species.kind === 'pokemon' && species.model?.path)
  .sort((a, b) => a.dexNumber - b.dexNumber)

const SPEEDS = [
  { value: 1, label: '1×' },
  { value: 0.5, label: '½×' },
  { value: 0.25, label: '¼×' },
]
const CAMERA_BUTTONS = [
  { view: 'side', label: 'lado' },
  { view: 'front', label: 'frente' },
  { view: 'top', label: 'cima' },
  { view: 'behind', label: 'atrás (jogo)' },
]
// Mudança de som refaz a cena (o som é carregado quando o modelo monta);
// espera parar de mexer no controle antes.
const AUDIO_REBUILD_DELAY = 400
// Quantos acertos recentes o painel mostra.
const RECENT_HITS = 10
// Vão inicial entre os triggers do atacante e do primeiro alvo (m).
const INITIAL_DISTANCE = 2
// Alvo novo: ao lado do último, este tanto (m) em X.
const NEW_TARGET_SPACING = 1.5
// Faixas dos controles de posição do alvo (m).
const TARGET_REACH = 15
const TARGET_HEIGHT_MAX = 5
// Pausa inicial entre um lançamento e outro (s).
const INITIAL_INTERVAL = 0.6

// Cápsulas na cena, de partida: nenhuma.
const INITIAL_CAPSULES = {
  attacker: { physics: false, trigger: false },
  target: { physics: false, trigger: false },
}

// Relevo inicial: nenhum, com valores de partida pra quando ligar.
const INITIAL_RELIEF = { kind: 'none', height: 1, center: 0.5, length: 2 }

function initialLab(species) {
  const target = SPECIES[0]
  return {
    attackerId: species.id,
    moveId: listLearnset(species)[0]?.id ?? null,
    targets: [
      {
        key: 1,
        speciesId: target.id,
        level: target.level ?? 1,
        x: 0,
        y: 0,
        z: resolveTargetZForGap(species, target, INITIAL_DISTANCE),
      },
    ],
    aimAt: 0,
    interval: INITIAL_INTERVAL,
    attackerLevel: species.level ?? 1,
    mastery: 1,
    resetBetween: true,
    relief: INITIAL_RELIEF,
  }
}

// Quem levou: o alvo pelo número dele na lista, ou o próprio atacante.
function describeWho(entity) {
  if (!entity?.has?.(LabActor)) return null
  const { role, index } = entity.get(LabActor)
  return role === 'target' ? `alvo ${index + 1}` : 'atacante'
}

function withWho(event, line) {
  const who = describeWho(event.target)
  return who ? `${who}: ${line}` : line
}

function readLayers(species, moveId) {
  return {
    base: structuredClone(getSkill(moveId)),
    overrides: structuredClone(
      findSpeciesMove(species, moveId)?.reference.overrides ?? null,
    ),
  }
}

const EFFECTIVENESS_LABELS = { super: 'super efetivo', weak: 'pouco efetivo' }

const isHitEvent = (event) =>
  event.type === EVENT_TYPES.ATTACK_RESOLVED ||
  event.type === EVENT_TYPES.ATTACK_FAILED

function describeStage(event) {
  const sign = event.delta > 0 ? '+' : ''
  return `${event.stat} ${sign}${event.delta} (estágio ${event.stage})`
}

function describeHit(event) {
  if (event.type === EVENT_TYPES.ATTACK_FAILED) return 'falhou (domínio)'
  if (event.missed) return 'errou (precisão)'
  if (!event.target) return 'não acertou ninguém'
  if (event.effectiveness === 'immune') return 'não afeta'
  if (event.status) return 'acertou (status)'
  const parts = [`${event.damage.toFixed(1)} de dano`]
  if (event.power != null) parts.push(`poder ${event.power}`)
  if (event.channel) parts.push(`tick ${event.channelTick + 1}`)
  if (event.hitCount > 1) {
    parts.push(`acerto ${event.hitIndex + 1} de ${event.hitCount}`)
  }
  if (event.critical) parts.push('crítico')
  if (event.boosted) parts.push('poder maior (apanhou há pouco)')
  if (EFFECTIVENESS_LABELS[event.effectiveness]) {
    parts.push(EFFECTIVENESS_LABELS[event.effectiveness])
  }
  return parts.join(' · ')
}

/**
 * O vão REAL agora entre os triggers do atacante e do alvo `index`
 * (`readLabGap`), atualizado direto no DOM a cada quadro — com ele igual ao
 * `range`, o golpe encosta.
 */
function LiveGap({ index }) {
  const textRef = useRef()
  useEffect(() => {
    let request = 0
    const tick = () => {
      request = requestAnimationFrame(tick)
      const gap = readLabGap(world, index)
      if (textRef.current) {
        textRef.current.textContent = gap === null ? '—' : `${gap.toFixed(2)} m`
      }
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [index])

  return (
    <p className="text-white/70">
      vão até o atacante agora: <span ref={textRef}>—</span>
    </p>
  )
}

/**
 * Um alvo da lista: espécie, nível e posição — `x`/`z` no chão (atacante na
 * origem olhando +Z) e `y` acima do chão. Todos ficam virados pro atacante.
 */
function TargetCard({ number, target, onChange, onRemove }) {
  return (
    <div className="space-y-1 rounded bg-white/5 p-2">
      <div className="flex items-center justify-between">
        <span className="font-bold">Alvo {number}</span>
        <Button onClick={onRemove}>remover</Button>
      </div>
      <Select
        label="espécie"
        value={target.speciesId}
        onChange={(speciesId) =>
          onChange({
            speciesId,
            level: getSpecies(speciesId).level ?? target.level,
          })
        }
      >
        {SPECIES.map((candidate) => (
          <Option key={candidate.id} value={candidate.id}>
            #{candidate.dexNumber} {candidate.id}
          </Option>
        ))}
      </Select>
      <Slider
        label="nível"
        value={target.level}
        min={1}
        max={50}
        step={1}
        onChange={(level) => onChange({ level })}
      />
      <Slider
        label="x (lado)"
        value={target.x}
        min={-TARGET_REACH}
        max={TARGET_REACH}
        step={0.01}
        unit="m"
        onChange={(x) => onChange({ x })}
      />
      <Slider
        label="y (acima do chão)"
        value={target.y}
        min={0}
        max={TARGET_HEIGHT_MAX}
        step={0.01}
        unit="m"
        onChange={(y) => onChange({ y })}
      />
      <Slider
        label="z (frente)"
        value={target.z}
        min={-TARGET_REACH}
        max={TARGET_REACH}
        step={0.01}
        unit="m"
        onChange={(z) => onChange({ z })}
      />
      <LiveGap index={number - 1} />
    </div>
  )
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-24 text-white/70">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="flex-1 rounded bg-white/10"
      >
        {children}
      </select>
    </label>
  )
}

function Option({ value, children }) {
  return (
    <option value={value} className="text-black">
      {children}
    </option>
  )
}

function Button({ active = false, ...props }) {
  return (
    <button
      {...props}
      className={`rounded px-2 py-0.5 disabled:opacity-40 ${active ? 'bg-white/50' : 'bg-white/20'}`}
    />
  )
}

export function SkillLab() {
  const snapshot = useMemo(() => captureSkillData(), [])
  const [lab, setLab] = useState(() => initialLab(SPECIES[0]))
  const labRef = useRef(lab)
  labRef.current = lab

  const species = getSpecies(lab.attackerId)
  const [layers, setLayers] = useState(() => readLayers(species, lab.moveId))
  const [layer, setLayer] = useState('species')
  const [sceneVersion, setSceneVersion] = useState(0)
  const [hits, setHits] = useState([])
  const [copied, setCopied] = useState(null)
  // Cápsulas exibidas na cena — a cena lê pelo ref, a página pelo estado.
  const [capsules, setCapsules] = useState(INITIAL_CAPSULES)
  const capsulesRef = useRef(capsules)
  capsulesRef.current = capsules
  // O trigger mora na espécie (fora do React): muda → redesenha.
  const [, setTriggerVersion] = useState(0)

  const clockRef = useRef({ speed: 1, step: false })
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [cameraRequest, setCameraRequest] = useState({ view: 'side', id: 0 })

  clockRef.current.speed = paused ? 0 : speed

  // Os dados voltam ao que veio dos arquivos ao sair da página.
  useEffect(() => () => restoreSkillData(snapshot), [snapshot])

  useEffect(() => {
    getAudioListener().setMasterVolume(soundOn ? 1 : 0)
  }, [soundOn])

  const rebuildTimer = useRef(null)
  useEffect(() => () => clearTimeout(rebuildTimer.current), [])
  const scheduleRebuild = () => {
    clearTimeout(rebuildTimer.current)
    rebuildTimer.current = setTimeout(
      () => setSceneVersion((version) => version + 1),
      AUDIO_REBUILD_DELAY,
    )
  }

  const update = (changes) => setLab((current) => ({ ...current, ...changes }))
  const updateTarget = (index, changes) =>
    setLab((current) => ({
      ...current,
      targets: current.targets.map((target, i) =>
        i === index ? { ...target, ...changes } : target,
      ),
    }))
  const addTarget = () =>
    setLab((current) => {
      const last = current.targets.at(-1)
      const speciesId = last?.speciesId ?? SPECIES[0].id
      const key = Math.max(0, ...current.targets.map((t) => t.key)) + 1
      const target = last
        ? { ...last, key, x: last.x + NEW_TARGET_SPACING }
        : {
            key,
            speciesId,
            level: getSpecies(speciesId).level ?? 1,
            x: 0,
            y: 0,
            z: resolveTargetZForGap(
              getSpecies(current.attackerId),
              getSpecies(speciesId),
              INITIAL_DISTANCE,
            ),
          }
      return {
        ...current,
        targets: [...current.targets, target],
        aimAt: current.targets.length === 0 ? 0 : current.aimAt,
      }
    })
  const removeTarget = (index) =>
    setLab((current) => {
      const targets = current.targets.filter((_, i) => i !== index)
      let { aimAt } = current
      if (aimAt !== null && aimAt >= targets.length) {
        aimAt = targets.length > 0 ? targets.length - 1 : null
      } else if (aimAt !== null && aimAt > index) aimAt -= 1
      return { ...current, targets, aimAt }
    })
  const updateRelief = (changes) =>
    setLab((current) => ({
      ...current,
      relief: { ...current.relief, ...changes },
    }))

  const chooseAttacker = (id) => {
    const next = getSpecies(id)
    const moveId = listLearnset(next)[0]?.id ?? null
    update({ attackerId: id, moveId, attackerLevel: next.level ?? 1 })
    setLayers(readLayers(next, moveId))
    setHits([])
  }

  const chooseMove = (moveId) => {
    update({ moveId })
    setLayers(readLayers(species, moveId))
    setHits([])
  }

  const applyLayers = (next, path) => {
    if (next.base !== layers.base) applyLiveBase(lab.moveId, next.base)
    if (next.overrides !== layers.overrides) {
      applyLiveOverrides(species, lab.moveId, next.overrides)
    }
    setLayers(next)
    if (path.startsWith('audio.')) scheduleRebuild()
  }

  const onEdit = (path, value) =>
    applyLayers(editLayer(layers, layer, path, value), path)
  const onClear = (path) => applyLayers(clearLayer(layers, layer, path), path)

  const restoreFromFiles = () => {
    restoreMove(snapshot, species, lab.moveId)
    setLayers(readLayers(species, lab.moveId))
    scheduleRebuild()
  }

  const onEvents = useCallback((events) => {
    const lines = [
      ...events
        .filter(isHitEvent)
        .map((event) => withWho(event, describeHit(event))),
      ...events
        .filter((event) => event.type === EVENT_TYPES.STAT_STAGE_CHANGED)
        .map((event) => withWho(event, describeStage(event))),
    ]
    if (
      lines.length === 0 &&
      events.some((event) => event.type === EVENT_TYPES.ATTACK_USED)
    ) {
      lines.push('lançou (sem acerto nem efeito)')
    }
    if (lines.length === 0) return
    setHits((current) => [...lines.reverse(), ...current].slice(0, RECENT_HITS))
  }, [])

  const sections = useMemo(
    () =>
      buildFieldSections({
        effectGroups: listAttackEffectGroups(),
        continuousGroups: CONTINUOUS_EFFECT_GROUPS,
        clipKeys: Object.keys({
          ...species.nativeAnimations,
          ...species.clips,
        }),
      }),
    [species],
  )

  const learnset = listLearnset(species)
  const written = mergeLayers(layers.base, layers.overrides)
  const effective = lab.moveId ? resolveLabAttack(lab) : null
  const found = findSpeciesMove(species, lab.moveId)

  const baseSnippet = formatBaseChanges(
    lab.moveId,
    diffBase(snapshot.skills[lab.moveId], layers.base),
  )
  const speciesSnippet = found
    ? formatSpeciesEntry({
        id: lab.moveId,
        requires: found.reference.requires,
        overrides: minimalOverrides(layers.base, layers.overrides),
      })
    : ''

  const copy = (which, text) => {
    navigator.clipboard.writeText(text)
    setCopied(which)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <WorldProvider>
      <div className="relative h-screen w-screen bg-neutral-900 text-sm text-white">
        <div className="absolute inset-y-0 left-0 right-0 md:right-[32rem]">
          <Canvas frameloop="never" camera={{ position: [5, 1.5, 1], fov: 45 }}>
            <SkillLabScene
              labRef={labRef}
              clockRef={clockRef}
              cameraRequest={cameraRequest}
              distance={resolveLabReferenceDistance(lab)}
              relief={resolveLabRelief(lab)}
              capsulesRef={capsulesRef}
              sceneKey={[
                lab.attackerId,
                lab.attackerLevel,
                ...lab.targets.map(
                  (target) => `${target.speciesId}:${target.level}`,
                ),
                sceneVersion,
              ].join('|')}
              onEvents={onEvents}
            />
          </Canvas>
        </div>

        <div className="absolute right-0 top-0 h-full w-[32rem] max-w-full space-y-4 overflow-y-auto bg-black/80 p-4">
          <h1 className="text-base font-bold">Laboratório de golpes</h1>

          <section className="space-y-1">
            <Select
              label="Pokémon"
              value={lab.attackerId}
              onChange={chooseAttacker}
            >
              {SPECIES.map((candidate) => (
                <Option key={candidate.id} value={candidate.id}>
                  #{candidate.dexNumber} {candidate.id}
                </Option>
              ))}
            </Select>
            <Select label="golpe" value={lab.moveId} onChange={chooseMove}>
              {learnset.map((move) => (
                <Option key={move.id} value={move.id}>
                  {move.id}
                  {move.requires ? ` (nível ${move.requires.level})` : ' (kit)'}
                </Option>
              ))}
            </Select>
            <Slider
              label="pausa entre golpes"
              value={lab.interval}
              min={0}
              max={3}
              step={0.1}
              unit="s"
              onChange={(interval) => update({ interval })}
            />
            <Slider
              label="nível do Pokémon"
              value={lab.attackerLevel}
              min={1}
              max={50}
              step={1}
              onChange={(attackerLevel) => update({ attackerLevel })}
            />
            <Slider
              label="domínio"
              value={lab.mastery}
              min={0}
              max={1}
              step={0.05}
              onChange={(mastery) => update({ mastery })}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lab.resetBetween}
                onChange={(event) =>
                  update({ resetBetween: event.target.checked })
                }
              />
              zerar entre golpes (vida, estágios e condições)
            </label>
          </section>

          <section className="space-y-2">
            <h2 className="font-bold">Alvos</h2>
            <Select
              label="mirar em"
              value={lab.aimAt === null ? '' : String(lab.aimAt)}
              onChange={(value) =>
                update({ aimAt: value === '' ? null : Number(value) })
              }
            >
              <Option value="">frente (+Z)</Option>
              {lab.targets.map((target, index) => (
                <Option key={target.key} value={String(index)}>
                  alvo {index + 1}
                </Option>
              ))}
            </Select>
            {lab.targets.length === 0 && (
              <p className="text-white/50">Sem alvo: o golpe sai no vazio.</p>
            )}
            {lab.targets.map((target, index) => (
              <TargetCard
                key={target.key}
                number={index + 1}
                target={target}
                onChange={(changes) => updateTarget(index, changes)}
                onRemove={() => removeTarget(index)}
              />
            ))}
            <Button
              disabled={lab.targets.length >= LAB_MAX_TARGETS}
              onClick={addTarget}
            >
              + alvo
            </Button>
            <p className="text-white/50">
              Atacante na origem, olhando pra +Z. Todos os alvos ficam virados
              pro atacante; acima do chão, ficam no ar como quem voa. O vão é da
              borda do trigger do atacante até a do alvo: com ele igual ao
              alcance, o golpe encosta.
            </p>
          </section>

          {[
            { role: 'attacker', title: 'Atacante', creature: species },
            // Um por espécie: o trigger é da espécie, não do alvo.
            ...[...new Set(lab.targets.map((t) => t.speciesId))].map((id) => ({
              role: 'target',
              title: 'Alvos',
              creature: getSpecies(id),
            })),
          ].map(({ role, title, creature }) => (
            <CreatureSection
              key={`${role}-${creature.id}`}
              title={title}
              species={creature}
              show={capsules[role]}
              onShow={(changes) =>
                setCapsules((current) => ({
                  ...current,
                  [role]: { ...current[role], ...changes },
                }))
              }
              onTrigger={(trigger) => {
                applyLiveTrigger(creature, trigger)
                setTriggerVersion((version) => version + 1)
              }}
              onRestore={() => {
                restoreTrigger(snapshot, creature)
                setTriggerVersion((version) => version + 1)
              }}
              onCopy={(text) => copy(`trigger-${role}-${creature.id}`, text)}
              copied={copied === `trigger-${role}-${creature.id}`}
            />
          ))}

          <section className="space-y-1">
            <h2 className="font-bold">Cenário</h2>
            <Select
              label="relevo"
              value={lab.relief.kind}
              onChange={(kind) => updateRelief({ kind })}
            >
              {Object.entries(RELIEF_KINDS).map(([kind, label]) => (
                <Option key={kind} value={kind}>
                  {label}
                </Option>
              ))}
            </Select>
            {lab.relief.kind !== 'none' && (
              <>
                <Slider
                  label="altura"
                  value={lab.relief.height}
                  min={-3}
                  max={3}
                  step={0.05}
                  unit="m"
                  onChange={(height) => updateRelief({ height })}
                />
                <Slider
                  label="onde (atacante → alvo 1)"
                  value={lab.relief.center}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(center) => updateRelief({ center })}
                />
                <Slider
                  label="comprimento"
                  value={lab.relief.length}
                  min={0.1}
                  max={10}
                  step={0.1}
                  unit="m"
                  onChange={(length) => updateRelief({ length })}
                />
                <p className="text-white/50">
                  O relevo atravessa o chão inteiro. No degrau e na rampa, o
                  lado do alvo fica na altura escolhida (negativa = mais baixo).
                </p>
              </>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/70">tempo</span>
              {SPEEDS.map(({ value, label }) => (
                <Button
                  key={value}
                  active={speed === value}
                  onClick={() => setSpeed(value)}
                >
                  {label}
                </Button>
              ))}
              <Button active={paused} onClick={() => setPaused((p) => !p)}>
                {paused ? 'continuar' : 'pausar'}
              </Button>
              <Button
                disabled={!paused}
                onClick={() => {
                  clockRef.current.step = true
                }}
              >
                +1 quadro
              </Button>
              <label className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={soundOn}
                  onChange={(event) => setSoundOn(event.target.checked)}
                />
                som
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-white/70">câmera</span>
              {CAMERA_BUTTONS.map(({ view, label }) => (
                <Button
                  key={view}
                  onClick={() =>
                    setCameraRequest((current) => ({
                      view,
                      id: current.id + 1,
                    }))
                  }
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-white/50">
              Em câmera lenta o som continua na velocidade normal.
            </p>
          </section>

          {effective && (
            <section className="space-y-1">
              <h2 className="font-bold">Linha do tempo</h2>
              <SkillTimeline written={written} effective={effective} />
              <p className="text-white/50">
                Escrito → efetivo: o jogo escala o tempo pela velocidade do
                Pokémon (IV no meio da faixa aqui) e o custo pelo nível e pelo
                domínio.
              </p>
            </section>
          )}

          <section className="space-y-1">
            <h2 className="font-bold">Últimos golpes</h2>
            {hits.length === 0 && <p className="text-white/50">—</p>}
            {hits.map((line, index) => (
              <p key={index} className={index === 0 ? '' : 'text-white/50'}>
                {line}
              </p>
            ))}
          </section>

          {lab.moveId && (
            <section className="space-y-2">
              <h2 className="font-bold">Parâmetros — {lab.moveId}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-white/70">editar em</span>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={layer === 'species'}
                    onChange={() => setLayer('species')}
                  />
                  só no {species.id}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    checked={layer === 'base'}
                    onChange={() => setLayer('base')}
                  />
                  base do golpe (toda espécie)
                </label>
              </div>
              <p className="text-white/50">
                E = override da espécie, B = base do golpe, · = ausente (vale o
                padrão do jogo). O × tira o campo da camada que está sendo
                editada.
              </p>
              <SkillParamsPanel
                sections={sections}
                layers={layers}
                layer={layer}
                onEdit={onEdit}
                onClear={onClear}
              />
            </section>
          )}

          {lab.moveId && (
            <section className="space-y-2">
              <h2 className="font-bold">Copiar</h2>
              <pre className="whitespace-pre-wrap rounded bg-white/5 p-2 text-xs">
                {baseSnippet}
              </pre>
              <pre className="whitespace-pre-wrap rounded bg-white/5 p-2 text-xs">
                {`// ${species.id} — moves\n${speciesSnippet}`}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copy('base', baseSnippet)}>
                  {copied === 'base' ? 'copiado!' : 'Copiar base'}
                </Button>
                <Button onClick={() => copy('species', speciesSnippet)}>
                  {copied === 'species' ? 'copiado!' : 'Copiar espécie'}
                </Button>
                <Button onClick={restoreFromFiles}>Restaurar do arquivo</Button>
              </div>
              <p className="text-white/50">
                Nada é salvo: cole no arquivo ou me mande. Os ajustes ficam
                enquanto a página estiver aberta.
              </p>
            </section>
          )}
        </div>
      </div>
    </WorldProvider>
  )
}
