import * as THREE from 'three'
import { GAME_CONFIG } from '@/core/gameConfig'

/**
 * Vento da vegetação em GLSL (docs/features/049-vegetacao-e-floresta.md),
 * portado do `materials/wind.ts` do stylized-scene (lá em TSL/WebGPU). A
 * grama, as flores e as copas incluem este MESMO pedaço e leem os mesmos
 * uniforms (`vegetationUniforms`), então uma rajada que atravessa o campo
 * passa pela grama e pelas árvores ao mesmo tempo.
 *
 * - Rajada que viaja (`vegTravellingGust`): uma onda larga andando na
 *   direção do vento, deformada por ruído (frente orgânica, não uma faixa
 *   reta) e afiada (`pow`) para virar um pulso.
 * - `vegGrassSway`: dobra em arco (a folha curva do pé à ponta, não inclina
 *   como um palito) pela rajada + brisa mínima + agitação, mais o tremor da
 *   ponta. Em espaço local da instância (o giro dela é desfeito em
 *   `vegToLocalFrame`).
 * - `vegCanopySway`: copa em três camadas — o tronco inteiro inclinando
 *   com a rajada, galhos (grupos de folhas) balançando cada um no seu
 *   ritmo, e o tremor das folhas.
 *
 * O ruído é procedural (hash), sem textura. A semente de cada instância
 * vem da posição dela no mundo, não do índice (o índice se repete em cada
 * bloco de grama).
 */
export const WIND_SHADER = /* glsl */ `
uniform float uWindTime;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindAngle;
uniform float uGustScale;
uniform float uTurbulence;
uniform float uFlutter;

float vegHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Ruído de valor suave (0 a 1).
float vegNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = vegHash(cell);
  float b = vegHash(cell + vec2(1.0, 0.0));
  float c = vegHash(cell + vec2(0.0, 1.0));
  float d = vegHash(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// x: distância ao longo do vento; y: a rajada (0 a 1).
vec2 vegTravellingGust(vec2 origin, vec2 windDir) {
  float along = dot(origin, windDir);
  float jitter = (vegNoise(origin * 0.08) - 0.5) * 2.0;
  float phase = along * uGustScale - uWindTime * uWindSpeed * 0.6 + jitter * 1.5;
  return vec2(along, pow(sin(phase) * 0.5 + 0.5, 1.6));
}

// Desfaz o giro da instância (facing = cos/sin do giro) num deslocamento
// horizontal de mundo — o giro aplicado depois o leva de volta para a
// direção certa.
vec3 vegToLocalFrame(vec2 horiz, float dv, vec2 facing) {
  float localX = horiz.x * facing.x - horiz.y * facing.y;
  float localZ = horiz.x * facing.y + horiz.y * facing.x;
  return vec3(localX, dv, localZ);
}

vec3 vegGrassSway(
  float y,
  float height,
  vec2 origin,
  vec2 facing,
  float seed,
  float turbulence,
  float flutter,
  float bendExponent,
  float calmFloor,
  float chopStrength
) {
  float t = clamp(y / height, 0.0, 1.0);
  float phase = seed * 6.28318;
  float ampVar = 0.65 + fract(seed * 7.13) * 0.7;

  float wobble = sin(uWindTime * uWindSpeed * 0.6 + phase) * turbulence * 0.4;
  float angle = uWindAngle + wobble;
  vec2 windDir = vec2(cos(angle), sin(angle));
  vec2 perpDir = vec2(-windDir.y, windDir.x);

  vec2 gust = vegTravellingGust(origin, windDir);
  float chop = sin(gust.x * uGustScale * 2.7 - uWindTime * uWindSpeed * 1.3 + phase) * 0.5 + 0.5;
  float intensity = (calmFloor + gust.y * 0.85 + chop * chopStrength) * ampVar;

  // Ângulo da dobra na ponta (rad), sem passar de ~90°. O mínimo vale para
  // o ângulo e o raio juntos: sem vento nenhum, a folha fica de pé (com
  // a dobra zerada só no ângulo, ela caía no chão).
  float bend = max(clamp(uWindStrength * intensity * 3.0, 0.0, 1.6), 1e-3);
  float a = bend * pow(t, bendExponent);
  float radius = height / bend;
  float u = radius * (1.0 - cos(a));
  float dv = radius * sin(a) - y;

  float flutterMask = smoothstep(0.55, 1.0, t);
  float flutterAmount = sin(uWindTime * 10.0 + phase * 3.0 + gust.x * 0.8)
    * flutter * 0.08 * flutterMask * height;

  vec2 horiz = windDir * u + perpDir * flutterAmount;
  return vegToLocalFrame(horiz, dv, facing);
}

vec3 vegCanopySway(
  vec3 p,
  float baseY,
  float height,
  vec2 origin,
  vec2 facing,
  float seed,
  float amplitude
) {
  float t = clamp((p.y - baseY) / height, 0.0, 1.0);
  float trunkWeight = mix(0.4, 1.0, t);
  float windGate = clamp(uWindStrength * 4.0, 0.0, 1.0);

  // Folhas perto umas das outras balançam juntas (um galho).
  float phase = vegNoise(p.xz * 0.6) * 6.28318 + seed * 6.28318;

  float wobble = sin(uWindTime * uWindSpeed * 0.5 + phase) * uTurbulence * 0.5;
  float angle = uWindAngle + wobble;
  vec2 windDir = vec2(cos(angle), sin(angle));
  vec2 perpDir = vec2(-windDir.y, windDir.x);
  float gust = vegTravellingGust(origin, windDir).y;

  float trunkAmp = clamp(uWindStrength * (gust * 0.8 + 0.35) * amplitude * 2.0, 0.0, 1.0);
  vec2 trunk = windDir * trunkAmp * trunkWeight;

  float branchAlong = sin(uWindTime * uWindSpeed * 1.15 + phase * 3.0);
  float branchAcross = sin(uWindTime * uWindSpeed * 0.85 + phase * 5.0 + 1.7);
  float branchAmp = (0.25 + gust * 0.35) * amplitude * 0.5 * windGate * mix(0.6, 1.0, t);
  vec2 branch = (windDir * branchAlong * 0.6 + perpDir * branchAcross * 0.4) * branchAmp;

  float flutterAmount = sin(uWindTime * 7.0 + phase * 7.0 + p.y * 2.0)
    * uFlutter * 0.06 * windGate * mix(0.3, 1.0, t);

  vec2 horiz = trunk + branch + perpDir * flutterAmount;
  float dv = (sin(uWindTime * uWindSpeed * 0.7 + phase) * 0.05 * amplitude * windGate
    - trunkAmp * 0.12) * trunkWeight;
  return vegToLocalFrame(horiz, dv, facing);
}
`

/**
 * Uniforms do vento e da luz da vegetação — os MESMOS objetos em todos os
 * materiais (grama, flores, copas e a sombra das copas), atualizados uma
 * vez por quadro pelo `VegetationView`.
 */
export const vegetationUniforms = {
  uWindTime: { value: 0 },
  uWindStrength: { value: GAME_CONFIG.WIND.STRENGTH.clear },
  uWindSpeed: { value: GAME_CONFIG.WIND.SPEED },
  uWindAngle: { value: GAME_CONFIG.WIND.DIRECTION },
  uGustScale: { value: GAME_CONFIG.WIND.GUST_SCALE },
  uTurbulence: { value: GAME_CONFIG.WIND.TURBULENCE },
  uFlutter: { value: GAME_CONFIG.WIND.FLUTTER },
  // Direção do sol (mundo) e quanto ele brilha agora (0 à noite) — a luz
  // que passa pela folha.
  uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
  uSunGlow: { value: 1 },
}
