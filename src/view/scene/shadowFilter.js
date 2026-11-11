import * as THREE from 'three'

/**
 * Leitura da sombra mais barata (docs/features/066-revisao-dos-biomas.md,
 * desempenho). O filtro PCF do three lê o mapa de sombra várias vezes por
 * pixel para a borda sair macia; aqui ele ganha um caminho de uma leitura
 * só (ainda com o filtro do hardware, que suaviza um pouco):
 *
 * - nos materiais com `SHADOW_SINGLE_TAP` (a vegetação, `toonMaterial.js`:
 *   nas folhas empilhadas a diferença não aparece e o custo é várias vezes
 *   o do chão);
 * - em tudo, quando a luz pede raio zero (`shadow.radius`, o nível sem
 *   borda macia — `GRAPHICS.SHADOW`, `DayNightView.jsx`). O raio é um
 *   número da luz: troca ao vivo, sem recompilar.
 *
 * Muda o trecho do three (`ShaderChunk`) antes de qualquer shader ser
 * montado — `installShadowFilter` roda ao carregar o módulo de quem
 * desenha a luz. Rodar de novo não muda nada.
 */
const MARKER = '/* rota151: sombra de uma leitura */'
const FILTER_START =
  'float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;'
const FILTER_END = ') * 0.2;'

export function installShadowFilter(chunks = THREE.ShaderChunk) {
  const source = chunks.shadowmap_pars_fragment
  if (source.includes(MARKER)) return true
  const start = source.indexOf(FILTER_START)
  const end = start < 0 ? -1 : source.indexOf(FILTER_END, start)
  if (start < 0 || end < 0) {
    console.warn(
      'shadowFilter: o filtro de sombra do three mudou; ficou o dele.',
    )
    return false
  }
  const filter = source.slice(start, end + FILTER_END.length)
  chunks.shadowmap_pars_fragment =
    source.slice(0, start) +
    `${MARKER}
#ifdef SHADOW_SINGLE_TAP
bool singleTap = true;
#else
bool singleTap = shadowRadius <= 0.0;
#endif
if ( singleTap ) {
  shadow = texture( shadowMap, shadowCoord.xyz );
} else {
  ${filter}
}` +
    source.slice(end + FILTER_END.length)
  return true
}
