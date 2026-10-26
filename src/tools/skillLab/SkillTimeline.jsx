import { useEffect, useRef } from 'react'
import { world } from '@/core/world/world'
import { readLabElapsed } from './skillLabWorld'

/**
 * Linha do tempo do golpe no laboratório: disparo, instante do efeito, fim
 * da ação e fim do VFX, na escala do tempo EFETIVO (o que o jogo usa, já
 * escalado pelo `speed` do atacante). O cursor branco é o golpe em curso.
 */

const format = (seconds) => `${seconds.toFixed(2)} s`

function Row({ label, written, effective }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/70">{label}</span>
      <span>
        {written !== undefined && (
          <span className="text-white/50">{format(written)} → </span>
        )}
        {format(effective)}
      </span>
    </div>
  )
}

export function SkillTimeline({ written, effective }) {
  const cursorRef = useRef()
  const vfxDuration = effective.visual?.effectVisualDuration ?? 0
  const vfxEnd = effective.effectAt + vfxDuration
  const total = Math.max(effective.duration, vfxEnd) || 1
  const percent = (seconds) => `${(seconds / total) * 100}%`

  // Cursor do golpe em curso, direto no DOM (sem re-render a cada quadro).
  useEffect(() => {
    let request = 0
    const tick = () => {
      request = requestAnimationFrame(tick)
      const cursor = cursorRef.current
      if (!cursor) return
      const elapsed = readLabElapsed(world)
      cursor.style.visibility = elapsed === null ? 'hidden' : 'visible'
      if (elapsed !== null)
        cursor.style.left = percent(Math.min(elapsed, total))
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total])

  return (
    <div className="space-y-1">
      <div className="relative h-6 rounded bg-white/10">
        <div
          className="absolute inset-y-0 left-0 rounded-l bg-amber-500/40"
          style={{ width: percent(effective.effectAt) }}
          title="carga (disparo → efeito)"
        />
        <div
          className="absolute inset-y-0 bg-sky-500/40"
          style={{
            left: percent(effective.effectAt),
            width: percent(effective.duration - effective.effectAt),
          }}
          title="depois do efeito, até a ação acabar"
        />
        <div
          className="absolute bottom-0 h-1.5 bg-fuchsia-500"
          style={{
            left: percent(effective.effectAt),
            width: percent(vfxDuration),
          }}
          title="VFX na cena"
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-red-500"
          style={{ left: percent(effective.effectAt) }}
          title="instante do efeito"
        />
        <div
          ref={cursorRef}
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ visibility: 'hidden' }}
        />
      </div>
      <Row
        label="instante do efeito"
        written={written.effectAt}
        effective={effective.effectAt}
      />
      <Row
        label="duração da ação"
        written={written.duration}
        effective={effective.duration}
      />
      <Row label="VFX do golpe até" effective={vfxEnd} />
      <div className="flex justify-between text-white/70">
        <span>energia / recarga</span>
        <span className="text-white">
          {effective.staminaCost.toFixed(1)} / {format(effective.cooldown)}
        </span>
      </div>
    </div>
  )
}
