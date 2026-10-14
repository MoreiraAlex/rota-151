import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Onde a névoa começa e onde fecha (m, a partir da câmera) para esconder a
 * borda do mundo carregado (docs/features/046-sistema-de-chunks.md).
 *
 * Um chunk que acaba de entrar na fila nasce a pelo menos `loadRadius`
 * chunks do jogador (ele precisa atravessar a borda do próprio chunk para o
 * anel seguinte ser pedido); um que descarrega está mais longe ainda. A
 * câmera fica atrás do jogador, até `cameraMaxDistance` — olhando para a
 * frente, ela está esse tanto mais perto do chunk novo. Então a névoa fecha
 * em `loadRadius × chunkSize − cameraMaxDistance` (nunca menos que
 * `minDistance`) e começa em `startFraction` disso.
 */
export function fogRange({
  loadRadius,
  chunkSize,
  cameraMaxDistance,
  startFraction,
  minDistance,
}) {
  const far = Math.max(loadRadius * chunkSize - cameraMaxDistance, minDistance)
  return { near: far * startFraction, far }
}

const smoothstep = (edge0, edge1, value) => {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Névoa de bruma, com o relevo distante (docs/features/051-montanha.md):
 * a partir de `near` engrossa devagar (`hazeLength`) até `hazeMax` — os
 * morros do fundo continuam como silhueta — e fecha de vez entre
 * `edgeFraction × far` e `far` (a borda do relevo distante). Mesma conta do
 * shader (`hazeFogFragment`). Devolve quanto da cor some na névoa (0 a 1).
 */
export function hazeFactorAt(
  distance,
  { near, far },
  { hazeLength, hazeMax, edgeFraction },
) {
  const haze =
    hazeMax * (1 - Math.exp(-Math.max(distance - near, 0) / hazeLength))
  return Math.max(haze, smoothstep(far * edgeFraction, far, distance))
}

/** Os números da bruma agora (`GAME_CONFIG.FOG`). */
export function hazeParams() {
  const { HAZE_LENGTH, HAZE_MAX, EDGE_FRACTION } = GAME_CONFIG.FOG
  return {
    hazeLength: HAZE_LENGTH,
    hazeMax: HAZE_MAX,
    edgeFraction: EDGE_FRACTION,
  }
}

const glslFloat = (value) => Number(value).toFixed(5)

/**
 * O trecho `fog_fragment` do Three com a conta de `hazeFactorAt` (a névoa
 * normal vira bruma). `fogNear`/`fogFar` são os da névoa da cena.
 */
export function hazeFogFragment({ hazeLength, hazeMax, edgeFraction }) {
  return `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = max(
			${glslFloat(hazeMax)} * ( 1.0 - exp( - max( vFogDepth - fogNear, 0.0 ) / ${glslFloat(hazeLength)} ) ),
			smoothstep( fogFar * ${glslFloat(edgeFraction)}, fogFar, vFogDepth )
		);
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`
}

/**
 * Quanto some na névoa da cena (`{ near, far }`) a esta distância — a mesma
 * conta do shader: bruma com o relevo distante, linear sem ele. Para o que
 * o shader não enevoa (plaquinhas de nome em DOM).
 */
export function fogFactorAt(distance, fog) {
  if (GAME_CONFIG.FAR_TERRAIN.ENABLED) {
    return hazeFactorAt(distance, fog, hazeParams())
  }
  return Math.min(Math.max((distance - fog.near) / (fog.far - fog.near), 0), 1)
}

/**
 * `fogRange` do mundo carregado agora (`GAME_CONFIG`, lado do chunk
 * `chunkSize`): até onde vai o que só existe nos chunks carregados — a
 * grama, por exemplo —, com ou sem a bruma do relevo distante.
 */
export function loadedFogRange(chunkSize) {
  const { TERRAIN, CAMERA, FOG } = GAME_CONFIG
  return fogRange({
    loadRadius: TERRAIN.LOAD_RADIUS,
    chunkSize,
    cameraMaxDistance: CAMERA.MAX_DISTANCE,
    startFraction: FOG.START_FRACTION,
    minDistance: FOG.MIN_DISTANCE,
  })
}
