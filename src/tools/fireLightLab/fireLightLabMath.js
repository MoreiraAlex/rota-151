const round = (value) => Number(value.toFixed(3))

/**
 * Trecho pra colar no `index.js` da espécie, dentro de `vfx`: o bloco
 * `fireLight` inteiro, já com os padrões resolvidos (`resolveFireLight`).
 */
export function formatFireLightSnippet(config) {
  const { position, flicker } = config
  return [
    '    fireLight: {',
    `      bone: '${config.bone}',`,
    `      color: '${config.color}',`,
    `      intensity: ${round(config.intensity)},`,
    `      distance: ${round(config.distance)},`,
    `      decay: ${round(config.decay)},`,
    `      faintedIntensity: ${round(config.faintedIntensity)},`,
    `      position: { x: ${round(position.x)}, y: ${round(position.y)}, z: ${round(position.z)} },`,
    `      flicker: { speed: ${round(flicker.speed)}, amount: ${round(flicker.amount)}, noise: ${round(flicker.noise)} },`,
    '    },',
  ].join('\n')
}
