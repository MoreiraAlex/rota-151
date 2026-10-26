import { resolveHitTrigger } from '@/core/battle/hitTrigger'
import { Slider } from '../shared/Slider'
import { formatJs } from './skillLabData'

/**
 * Seção do atacante ou do alvo no laboratório de golpes: mostrar a cápsula
 * da física e o trigger na cena, e o TRIGGER de acerto da espécie
 * (`body.trigger`, `core/battle/hitTrigger.js` — uma pílula 2D no chão) ao
 * vivo, com Copiar.
 *
 * O trigger é da ESPÉCIE: com a mesma espécie no atacante e no alvo, mexer
 * num mexe no outro.
 */

// Deslocamento no chão: pro lado e pra frente.
const OFFSET_AXES = ['x', 'z']
const ANGLE_MAX = 180
// Faixas dos controles (só do laboratório).
const SIZE_MAX = 2
const SIZE_STEP = 0.01
const OFFSET_MAX = 1.5

/** Trecho pra colar dentro de `body` no `index.js` da espécie. */
export function formatTriggerSnippet(trigger) {
  return `    trigger: ${formatJs(trigger, '    ')},`
}

export function CreatureSection({
  title,
  species,
  show,
  onShow,
  onTrigger,
  onRestore,
  onCopy,
  copied,
}) {
  const trigger = resolveHitTrigger(species.body)
  const declared = !!species.body.trigger
  const set = (changes) => onTrigger({ ...trigger, ...changes })

  return (
    <section className="space-y-1">
      <h2 className="font-bold">
        {title} — {species.id}
      </h2>
      <div className="flex flex-wrap gap-4">
        <span className="text-white/70">mostrar</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={show.physics}
            onChange={(event) => onShow({ physics: event.target.checked })}
          />
          <span className="text-sky-400">física</span>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={show.trigger}
            onChange={(event) => onShow({ trigger: event.target.checked })}
          />
          <span className="text-pink-400">trigger</span>
        </label>
      </div>

      <p className="text-white/50">
        Trigger{' '}
        {declared
          ? 'da espécie'
          : '= derivado da cápsula da física (sem body.trigger)'}
      </p>
      <Slider
        label="raio"
        value={trigger.radius}
        min={SIZE_STEP}
        max={SIZE_MAX}
        step={SIZE_STEP}
        unit="m"
        onChange={(radius) => set({ radius })}
      />
      <Slider
        label="meio-comprimento"
        value={trigger.halfLength}
        min={0}
        max={SIZE_MAX}
        step={SIZE_STEP}
        unit="m"
        onChange={(halfLength) => set({ halfLength })}
      />
      <Slider
        label="ângulo"
        value={trigger.angle}
        min={-ANGLE_MAX}
        max={ANGLE_MAX}
        step={1}
        unit="°"
        onChange={(angle) => set({ angle })}
      />
      {OFFSET_AXES.map((axis) => (
        <Slider
          key={axis}
          label={`deslocamento ${axis}`}
          value={trigger.offset[axis]}
          min={-OFFSET_MAX}
          max={OFFSET_MAX}
          step={SIZE_STEP}
          unit="m"
          onChange={(value) =>
            set({ offset: { ...trigger.offset, [axis]: value } })
          }
        />
      ))}
      <p className="text-white/50">
        Pílula no chão (meio-comprimento 0 = círculo). Ângulo 0 = ao longo da
        frente do corpo, 90 = atravessada. Deslocamento no referencial do corpo:
        +Z pra frente, +X pro lado.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onCopy(formatTriggerSnippet(trigger))}
          className="rounded bg-white/20 px-2 py-0.5"
        >
          {copied ? 'copiado!' : 'Copiar trigger'}
        </button>
        <button onClick={onRestore} className="rounded bg-white/20 px-2 py-0.5">
          Restaurar do arquivo
        </button>
      </div>
    </section>
  )
}
