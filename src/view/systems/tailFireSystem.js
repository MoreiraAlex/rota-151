import * as THREE from 'three'
import { getTailFireEntries } from '@/view/registry/tailFireRegistry'

// Vetor reaproveitado pra não alocar um THREE.Vector3 novo por entidade a
// cada tick só pra ler a escala do osso (mesmo cuidado de
// `heldItemViewSystem.js`).
const worldScale = new THREE.Vector3()

/**
 * Avança a simulação de partícula de cada fogo de cauda registrado
 * (`tailFireRegistry.js`) e corrige a escala do grupo — NÃO recalcula
 * posição nenhuma: `flame.group` já é filho de verdade do osso da cauda
 * (`bone.add`, feito em `useAnimatedModel.js` no momento do registro), o
 * próprio Three.js propaga a matriz do osso animado (`animationSystem`)
 * pra ele a cada frame de graça, mesma técnica de `heldItemViewSystem.js`.
 *
 * Correção de escala: o osso vive dentro da hierarquia do modelo inteiro,
 * renderizado bem menor que 1:1 (`species.model.scale`, ~0.015 pros
 * Pokémon, além de qualquer escala já embutida no rig/armature do `.glb`)
 * — um filho comum herdaria essa escala composta e nasceria minúsculo
 * demais pra aparecer (mesmo bug real que `heldItemViewSystem.js` já
 * documentou ter caído). `getWorldScale` lê a escala composta de verdade
 * direto da matriz do osso — sem precisar saber o número exato nem se ele
 * muda entre espécies/versões do modelo —, e a escala LOCAL do grupo do
 * fogo vira o inverso disso (vezes `config.scale`, ajuste geral opcional
 * da espécie — default 1), cancelando a composição.
 *
 * `config.rotation` (opcional, graus — `{ x?, y?, z? }`) é uma rotação
 * LOCAL fixa aplicada por cima da rotação herdada do osso — existe porque
 * `bone.add()` faz o grupo herdar a orientação da cauda inteira, não só a
 * posição, e o eixo "pra cima" da partícula (onde ela sobe/estreita, ver
 * `flameParticles.js`) pode não bater com a orientação de repouso do osso
 * (bug real, relatado jogando: fogo saindo "deitado" na cauda do
 * Charmander) — sem valor pra ajustar isso na mão, não tinha como
 * corrigir sem mexer em código.
 *
 * `config.position` (opcional, UNIDADES DE MUNDO — `{ x?, y?, z? }`) é um
 * deslocamento LOCAL a partir da origem do osso — o osso pode não ficar
 * exatamente onde a chama deveria nascer (ex.: um pouco além da ponta da
 * cauda, não em cima dela). Dividido por `worldScale` (mesma variável já
 * lida pra correção de escala acima) de propósito: posição de um filho é
 * interpretada no espaço LOCAL do pai (o osso, ainda dentro da hierarquia
 * pequena do rig, ~0.015), então um deslocamento em unidades de mundo
 * "de verdade" (ex.: 0.1 = 10cm) precisa da mesma correção que a escala,
 * senão o valor configurado pareceria não fazer quase nada (0.1 num
 * espaço 0.015x vira 0.0015 de verdade).
 *
 * `config.speed` multiplica o `delta` passado pra `flame.update`, mesmo
 * princípio do `speed` do spike (`Campfire.jsx`).
 *
 * Vive na view (mexe em objeto Three puro). Fase: presentation, perto de
 * `animationSystem`/`heldItemViewSystem` — sem dependência de ordem
 * estrita com eles (só precisa que os ossos já tenham sido registrados
 * alguma hora, não neste exato frame, mesma observação já feita pro item
 * na mão).
 */
export function tailFireSystem(context) {
  const { delta } = context

  for (const [, { flame, bone, config = {} }] of getTailFireEntries()) {
    const scale = config.scale ?? 1

    bone.getWorldScale(worldScale)
    flame.group.scale.set(
      scale / worldScale.x,
      scale / worldScale.y,
      scale / worldScale.z,
    )

    if (config.position) {
      flame.group.position.set(
        (config.position.x ?? 0) / worldScale.x,
        (config.position.y ?? 0) / worldScale.y,
        (config.position.z ?? 0) / worldScale.z,
      )
    }

    if (config.rotation) {
      flame.group.rotation.set(
        THREE.MathUtils.degToRad(config.rotation.x ?? 0),
        THREE.MathUtils.degToRad(config.rotation.y ?? 0),
        THREE.MathUtils.degToRad(config.rotation.z ?? 0),
      )
    }

    flame.update(delta * (config.speed ?? 1))
  }
}
