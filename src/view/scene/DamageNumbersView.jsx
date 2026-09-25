'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { GAME_CONFIG } from '@/core/gameConfig'
import { damageNumberPool } from '../vfx/damageNumberPool'

const { RISE } = GAME_CONFIG.FEEDBACK.DAMAGE_NUMBER
// Contorno escuro por sombra (o número fica legível em qualquer fundo).
const OUTLINE =
  '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 0 4px #000'
const CRIT_OUTLINE =
  '1px 1px 0 #7a0000, -1px -1px 0 #7a0000, 1px -1px 0 #7a0000, -1px 1px 0 #7a0000, 0 0 8px #ff5a00'

// Fração da vida em que o número começa a sumir.
const FADE_START = 0.6
// Crítico nasce grande e "encaixa" no tamanho final nesse trecho da vida.
const CRIT_POP_END = 0.15
const CRIT_POP_SCALE = 1.7

function applySlotContent(el, slot) {
  const [label, value] = el.children
  value.textContent = slot.text
  label.style.display = slot.critical ? 'block' : 'none'
  value.style.fontSize = slot.critical ? '30px' : '20px'
  value.style.color = slot.critical ? '#ffd23f' : '#ffffff'
  value.style.textShadow = slot.critical ? CRIT_OUTLINE : OUTLINE
  el.dataset.serial = String(slot.serial)
}

/**
 * Números de dano (`damageNumberPool`, alimentado por
 * `damageNumberSystem.js`): um `<Html>` fixo por slot do pool, criados
 * uma vez só — nada de montar/desmontar por número. Cada frame posiciona,
 * faz subir (`RISE`, desacelerando) e apaga no fim da vida. Crítico: maior,
 * amarelo com contorno vermelho, rótulo "CRÍTICO!" e um "salto" de escala
 * ao nascer.
 *
 * `useFrame` aqui é a exceção documentada de componente puramente visual:
 * só LÊ o pool e mexe no próprio DOM/grupo — texto trocado direto no DOM
 * quando o slot muda (`serial`), sem re-render do React por frame.
 */
export function DamageNumbersView() {
  const groupRefs = useRef([])
  const elementRefs = useRef([])

  useFrame(() => {
    damageNumberPool.slots.forEach((slot, i) => {
      const group = groupRefs.current[i]
      const el = elementRefs.current[i]
      if (!group || !el) return

      if (!slot.active) {
        el.style.display = 'none'
        return
      }
      if (el.dataset.serial !== String(slot.serial)) {
        applySlotContent(el, slot)
      }

      const t = slot.age / slot.lifetime
      const eased = 1 - (1 - t) * (1 - t)
      group.position.set(slot.x, slot.y + RISE * eased, slot.z)

      const opacity =
        t < FADE_START ? 1 : 1 - (t - FADE_START) / (1 - FADE_START)
      const pop =
        slot.critical && t < CRIT_POP_END
          ? CRIT_POP_SCALE - (CRIT_POP_SCALE - 1) * (t / CRIT_POP_END)
          : 1
      el.style.display = 'block'
      el.style.opacity = String(opacity)
      el.style.transform = `scale(${pop})`
    })
  })

  return (
    <>
      {damageNumberPool.slots.map((_, i) => (
        <group key={i} ref={(g) => (groupRefs.current[i] = g)}>
          <Html
            center
            transform={false}
            className="pointer-events-none select-none"
            // z-index baixo e fixo, mesmo motivo da `NameplateView.jsx`:
            // sem isso o número passaria por cima de HUD/menu.
            zIndexRange={[1, 1]}
          >
            <div
              ref={(el) => (elementRefs.current[i] = el)}
              style={{
                display: 'none',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              <div
                style={{
                  display: 'none',
                  fontSize: '11px',
                  letterSpacing: '0.08em',
                  color: '#ffb000',
                  textShadow: OUTLINE,
                  marginBottom: '2px',
                }}
              >
                CRÍTICO!
              </div>
              <div />
            </div>
          </Html>
        </group>
      ))}
    </>
  )
}
