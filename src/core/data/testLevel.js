/**
 * Nível de teste da física.
 *
 * Fonte única: os colliders (core/physics) e os meshes (view/scene/GameScene)
 * são gerados a partir daqui, então o visível bate com o colidível.
 *
 * - size: dimensões completas [largura(x), altura(y), profundidade(z)], em unidades.
 * - rotation (opcional): giro em um eixo — { axis: 'x' | 'y' | 'z', angle } (rad).
 */
export const TEST_LEVEL = {
  ground: { size: 60, thickness: 1 },
  obstacles: [
    // Parede para esbarrar e deslizar.
    { id: 'wall', type: 'box', position: [0, 1, -7], size: [10, 2, 0.5] },
    // Degrau baixo — transposto sozinho pelo auto-step.
    { id: 'step-low', type: 'box', position: [-6, 0.15, 1], size: [3, 0.3, 3] },
    // Bloco alto — exige pulo.
    {
      id: 'block-high',
      type: 'box',
      position: [-6, 0.75, 5],
      size: [3, 1.5, 3],
    },
    // Rampa subível (~18°): a extremidade -x encosta no chão, a +x sobe.
    {
      id: 'ramp',
      type: 'ramp',
      position: [6, 0.55, 0],
      size: [5, 0.3, 3],
      rotation: { axis: 'z', angle: 0.32 },
    },
    // Plataforma elevada, alcançável pela rampa.
    {
      id: 'platform',
      type: 'box',
      position: [10.5, 0.9, 0],
      size: [4, 1.8, 3],
    },
  ],
}
