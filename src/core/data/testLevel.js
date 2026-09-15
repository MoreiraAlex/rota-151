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
    // Pilar isolado perto do spawn — fácil de esbarrar a câmera nele só
    // virando o olhar por perto, pra testar a colisão da órbita
    // (docs/backlog.md → "Câmera orbital com colisão").
    { id: 'pillar', type: 'box', position: [3, 1.5, -1], size: [1, 3, 1] },
    // Corredor estreito (4m de vão) — a distância padrão da câmera não
    // cabe atrás do jogador aqui dentro sem atravessar uma das paredes,
    // então força a colisão da órbita a puxar a distância pra dentro o
    // tempo todo enquanto o jogador atravessa.
    {
      id: 'corridor-wall-left',
      type: 'box',
      position: [-2, 1.25, -14],
      size: [0.5, 2.5, 8],
    },
    {
      id: 'corridor-wall-right',
      type: 'box',
      position: [2, 1.25, -14],
      size: [0.5, 5, 8],
    },
  ],
}
