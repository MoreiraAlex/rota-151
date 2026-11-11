import { TEST_LEVEL } from '@/core/data/testLevel'
import { GAME_CONFIG } from '@/core/gameConfig'
import { verticalClearance } from '@/core/physics/capsule'
import { teleportCharacterBody } from '@/core/physics/colliders'
import {
  CharacterController,
  OrbitCamera,
  PhysicsBody,
  Position,
  Velocity,
} from '@/core/traits'

/**
 * O que o laboratório de biomas (docs/features/066-revisao-dos-biomas.md)
 * faz no mundo do jogo: levar o treinador a um ponto e pôr a câmera numa
 * posição pronta. Ferramenta, fora do loop do jogo.
 */

/**
 * As câmeras prontas (o `OrbitCamera` do jogo): `baixa` perto do ombro,
 * como no Scarlet/Violet; `alta`, de cima e de longe, como no Let's Go;
 * `jogo`, a inicial do jogo.
 */
export const LAB_CAMERAS = {
  baixa: { label: 'Baixa (Scarlet/Violet)', pitch: 0.08, distance: 5 },
  alta: { label: "Alta (Let's Go)", pitch: 0.75, distance: 16 },
  jogo: {
    label: 'A do jogo',
    pitch: GAME_CONFIG.CAMERA.INITIAL_PITCH,
    distance: GAME_CONFIG.CAMERA.INITIAL_DISTANCE,
  },
}

/** Põe a câmera do jogo (`cameraEntity`) numa das prontas. */
export function aplicarCameraDoLab(cameraEntity, id) {
  const preset = LAB_CAMERAS[id]
  if (!preset || !cameraEntity.has(OrbitCamera)) return
  const { pitch, distance } = preset
  cameraEntity.set(OrbitCamera, {
    ...cameraEntity.get(OrbitCamera),
    pitch,
    distance,
  })
}

/** Gira a câmera em volta do alvo (`delta` em radianos). */
export function girarCameraDoLab(cameraEntity, delta) {
  if (!cameraEntity.has(OrbitCamera)) return
  const camera = cameraEntity.get(OrbitCamera)
  cameraEntity.set(OrbitCamera, { ...camera, yaw: camera.yaw + delta })
}

/**
 * Leva o treinador para `(x, z)`, em pé no relevo (os chunks de lá
 * carregam sozinhos em volta dele), parado.
 */
export function moverTreinadorPara(trainer, { x, z }) {
  if (!trainer.has(Position)) return
  const controller = trainer.get(CharacterController)
  const ground = TEST_LEVEL.terrain.heightAt(x, z)
  const y =
    ground +
    (controller ? verticalClearance(controller) : 0) +
    GAME_CONFIG.TERRAIN.SPAWN_HEIGHT
  trainer.set(Position, { x, y, z })
  if (trainer.has(Velocity)) trainer.set(Velocity, { x: 0, y: 0, z: 0 })
  if (trainer.has(PhysicsBody)) {
    teleportCharacterBody(trainer.get(PhysicsBody).bodyHandle, { x, y, z })
  }
}

/**
 * Vira a câmera (`cameraEntity`) para olhar de `from` na direção de `to`
 * (a frente da câmera é `(-sin yaw, -cos yaw)`, `core/camera/orbitCamera.js`).
 */
export function olharDoLabPara(cameraEntity, from, to) {
  if (!cameraEntity.has(OrbitCamera)) return
  const yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z))
  cameraEntity.set(OrbitCamera, { ...cameraEntity.get(OrbitCamera), yaw })
}
