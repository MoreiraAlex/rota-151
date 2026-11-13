import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { InputControlled, Position } from '@/core/traits'
import { world } from '@/core/world/world'
import { assignLampSlots, nearestLampLights } from './lampLights'
import { toonUniforms } from './toonMaterial'

/**
 * A luz de verdade dos postes à noite (docs/features/069-revisao-do-bioma-
 * cidade.md): `LGPE.LAMP_LIGHT.COUNT` luzes pontuais, sem sombra, sempre na
 * cena (o número fixo não recompila os materiais quando a noite chega),
 * nos postes mais perto de quem o jogador controla (`nearestLampLights` —
 * não da câmera: girar a câmera não troca os postes). Cada luz fica no
 * poste dela enquanto ele segue entre os mais perto (`assignLampSlots`); a
 * que troca de poste apaga e acende aos poucos (`FADE`). A força segue a
 * noite do vidro (`uNightGlow`, as estrelas do ciclo).
 *
 * `useFrame` aqui é a exceção das regras (3.4): componente só visual, que
 * só LÊ o nível e o ECS.
 */
export function StreetLampLights({ models }) {
  const { LAMP_LIGHT } = GAME_CONFIG.LGPE
  const lights = useMemo(
    () =>
      Array.from({ length: LAMP_LIGHT.COUNT }, () => {
        const light = new THREE.PointLight()
        light.castShadow = false
        light.intensity = 0
        return light
      }),
    [LAMP_LIGHT.COUNT],
  )
  useEffect(() => () => lights.forEach((light) => light.dispose()), [lights])
  const slots = useRef(null)
  const sinceRefresh = useRef(Infinity)

  useFrame(({ camera }, delta) => {
    if (slots.current?.length !== lights.length) {
      slots.current = lights.map(() => ({ lamp: null, level: 0, target: 0 }))
    }
    sinceRefresh.current += delta
    if (sinceRefresh.current >= LAMP_LIGHT.REFRESH) {
      sinceRefresh.current = 0
      const controlled = world.queryFirst(InputControlled, Position)
      const from = controlled?.get(Position) ?? camera.position
      slots.current = assignLampSlots(
        slots.current,
        nearestLampLights(
          TEST_LEVEL.terrain.loadedChunks(),
          models.lgpe,
          from,
          lights.length,
        ),
      )
    }
    const night = toonUniforms.uNightGlow.value
    const step = LAMP_LIGHT.FADE > 0 ? delta / LAMP_LIGHT.FADE : 1
    lights.forEach((light, index) => {
      const slot = slots.current[index]
      slot.level =
        slot.target > slot.level
          ? Math.min(slot.target, slot.level + step)
          : Math.max(slot.target, slot.level - step)
      light.color.set(LAMP_LIGHT.COLOR)
      light.distance = LAMP_LIGHT.DISTANCE
      light.decay = LAMP_LIGHT.DECAY
      light.intensity = slot.lamp
        ? LAMP_LIGHT.INTENSITY * night * slot.level
        : 0
      if (slot.lamp) {
        light.position.set(slot.lamp.x, slot.lamp.y, slot.lamp.z)
      }
    })
  })

  return (
    <>
      {lights.map((light, index) => (
        <primitive key={index} object={light} />
      ))}
    </>
  )
}
