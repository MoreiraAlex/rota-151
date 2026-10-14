'use client'

import { useEffect } from 'react'
import GUI from 'lil-gui'
import { GAME_CONFIG } from '@/core/gameConfig'

// Ao lado do painel "Vegetação" (os `lil-gui` nascem no canto direito).
const PANEL_RIGHT = '780px'

// Câmera em terceira pessoa (`GAME_CONFIG.CAMERA`): [mín, máx, passo]. A
// altura do alvo e o ombro ficam de fora: cada espécie tem os seus
// (`camera` da espécie).
const ORBIT_CONTROLS = {
  SMOOTHING: { label: 'Suavização', range: [1, 30, 0.5] },
  COLLISION_MARGIN: { label: 'Folga do chão', range: [0, 1, 0.01] },
  MIN_DISTANCE_AFTER_COLLISION: {
    label: 'Mais perto (no chão)',
    range: [0, 3, 0.05],
  },
}
// Ver através dos objetos (`CAMERA.SEE_THROUGH`).
const SEE_THROUGH_CONTROLS = {
  RADIUS: { label: 'Raio', range: [0, 4, 0.05] },
  EDGE: { label: 'Borda suave', range: [0, 2, 0.05] },
  OPACITY: { label: 'Opacidade', range: [0, 1, 0.01] },
  TARGET_GAP: { label: 'Folga no alvo', range: [0, 3, 0.05] },
}

const addControls = (folder, target, controls) => {
  for (const [key, { label, range }] of Object.entries(controls)) {
    folder.add(target, key, ...range).name(label)
  }
}

function copyValues() {
  const { CAMERA } = GAME_CONFIG
  const orbit = Object.fromEntries(
    Object.keys(ORBIT_CONTROLS).map((key) => [key, CAMERA[key]]),
  )
  const text = [
    `// CAMERA: ${JSON.stringify(orbit, null, 2)}`,
    `SEE_THROUGH: ${JSON.stringify(CAMERA.SEE_THROUGH, null, 2)},`,
  ].join('\n')
  navigator.clipboard?.writeText(text)
}

/**
 * Debug (F2, montado por `src/app/(auth)/page.js`): painel "Câmera" — o
 * ver-através dos objetos (`CAMERA.SEE_THROUGH`, view/materials/
 * seeThrough.js: o que fica entre a câmera e o alvo some em pontilhado) e
 * os números da órbita lidos a cada quadro (`cameraFollowSystem`). Mexe
 * no `GAME_CONFIG` ao vivo (só nesta sessão); "Copiar valores" leva os
 * números para o `gameConfig.js`.
 */
export function CameraPanel() {
  useEffect(() => {
    const { CAMERA } = GAME_CONFIG
    const gui = new GUI({ title: 'Câmera' })
    gui.domElement.style.right = PANEL_RIGHT
    // Digitar nos campos não pode virar comando do jogo.
    const keepKeysInPanel = (event) => event.stopPropagation()
    gui.domElement.addEventListener('keydown', keepKeysInPanel)
    gui.domElement.addEventListener('keyup', keepKeysInPanel)

    const seeFolder = gui.addFolder('Ver através dos objetos')
    seeFolder.add(CAMERA.SEE_THROUGH, 'ENABLED').name('Ligado')
    addControls(seeFolder, CAMERA.SEE_THROUGH, SEE_THROUGH_CONTROLS)

    const orbitFolder = gui.addFolder('Órbita')
    addControls(orbitFolder, CAMERA, ORBIT_CONTROLS)
    orbitFolder.close()

    gui.add({ copiar: copyValues }, 'copiar').name('Copiar valores')
    gui.close()

    return () => gui.destroy()
  }, [])

  return null
}
