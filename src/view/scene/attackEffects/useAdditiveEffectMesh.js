import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Carrega um `.glb` de efeito (rip convertido via `obj2gltf`/
 * `gltf-pipeline -d`, ver `public/assets/effects/`) e devolve um CLONE
 * com material reconstruído pra blending ADITIVO (`MeshBasicMaterial`,
 * mesmo princípio de `flameParticles.js`: a textura original é um mapa de
 * brilho em fundo preto, pensada pra somar luz, não ocluir — o material
 * PBR opaco que `obj2gltf` gera por padrão não tem esse conceito, porque
 * não existe no `.mtl` de origem).
 *
 * Segundo consumidor de "carrega efeito + refaz material aditivo"
 * (`ScratchAttackEffect.jsx` foi o primeiro, `PunchAttackEffect.jsx` o
 * segundo) — extraído aqui pra não duplicar o mesmo `useMemo`/traverse.
 *
 * Clonado por INSTÂNCIA (`useMemo`, não o cache de `useGLTF`) — cada
 * ataque simultâneo (criaturas diferentes ao mesmo tempo) anima sua
 * PRÓPRIA opacidade/escala/revelação, sem compartilhar estado com outro.
 *
 * Devolve `{ object, materials, revealUniforms }`: `object` é o que entra
 * num `<primitive object={object} />`; `materials` é a lista achatada
 * (sem precisar re-percorrer a árvore a cada frame) pra quem for animar
 * `opacity` em `useFrame`; `revealUniforms` só existe quando
 * `options.reveal` é `true` (ver abaixo).
 *
 * `side: THREE.DoubleSide` — bug real, relatado jogando (nada aparecia,
 * nem aumentando a escala pra 100 pra descartar tamanho): o `.mtl` de
 * origem marca a malha como `doubleSided: false` (só a face da frente
 * desenha), e sem essa opção o Three.js usa `FrontSide` por padrão — a
 * malha reorientada pela direção do golpe (ver `creatureAttackSystem.js`)
 * podia facilmente acabar de costas pra câmera, sumindo por completo
 * mesmo com geometria/material corretos (confirmados fora do navegador,
 * inspecionando o `.glb` gerado). Um efeito fino sem espessura de
 * verdade não tem "lado de trás" que precise ficar oculto, então
 * desenhar dos dois lados não tem custo conceitual nenhum aqui — só
 * correção.
 *
 * `options.reveal` (opcional, `false` por padrão) — pedido do usuário
 * pro grupo `'scratch'`: em vez de aparecer inteiro de uma vez, o efeito
 * é REVELADO progressivamente (0% a 100% do "traço" visível), dando a
 * sensação de golpe partindo de um ponto até outro. Implementado via
 * `onBeforeCompile` (técnica padrão do Three.js pra ajustar um shader
 * embutido sem reescrever o material inteiro) — injeta um `discard` no
 * fragment shader logo depois de `#include <map_fragment>` (mesmo ponto
 * onde `alphaTest` já descartaria fragmentos, ver `meshbasic.glsl.js` do
 * Three.js instalado): `if (vMapUv.x > uProgress) discard`.
 *
 * **`vMapUv`, não `vUv`** — bug real, relatado jogando (a malha aparecia,
 * mas nunca era revelada progressivamente, sempre inteira). A primeira
 * versão usava `vUv`, que só é declarada quando `USE_UV`/`USE_ANISOTROPY`
 * está definido (ver `uv_pars_fragment.glsl.js` do Three.js instalado) —
 * NENHUM dos dois é o caso pra um `MeshBasicMaterial` só com `map`. A
 * variável de verdade populada nesse caso é `vMapUv` (`USE_MAP`, sempre
 * definida aqui — refatoração do Three.js que dá uma varying de UV por
 * TIPO de mapa, não uma genérica só). Referenciar `vUv` sem ela existir é
 * erro de compilação do shader — silencioso o bastante pra "não fazer
 * nada" em vez de quebrar visivelmente, daí o efeito continuar aparecendo
 * inteiro (o discard nunca executava de verdade). Usa o eixo U da textura
 * (não a posição local do vértice) porque a imagem de origem
 * (`eff_cmn_scrach.png`) já é um traço desenhado ao longo do U — a mesma
 * revelação que o jogo original provavelmente fazia via animação de UV.
 *
 * `revealUniforms` (um `{ value: number }` por material, na mesma ordem
 * de `materials`) é o que `ScratchAttackEffect.jsx` muta em `useFrame`
 * pra controlar a revelação — mutar `.value` direto (não recriar o
 * objeto) é o jeito correto de atualizar um uniform por frame sem forçar
 * recompilação do shader (o Three.js lê `.value` de novo a cada render).
 *
 * `options.alignForwardTip` (opcional, `false` por padrão) — bug real,
 * relatado jogando: "o efeito do Scratch está atravessando o muro".
 * `AttackEffect` nasce no PONTO DE IMPACTO (`impactPoint`,
 * `creatureAttackSystem.js` — já parado na parede/obstáculo mais
 * próximo, se houver um no caminho) e a malha aponta na direção do golpe
 * via `Rotation` (eixo local +Z = direção do golpe, mesma convenção de
 * `resolveEffectRotation`/`rot.y` do corpo). O rip `EffCommonScratch`,
 * porém, NÃO nasce centrado nem "puxado pra trás" da própria origem —
 * conferido inspecionando o `.glb` gerado (accessor de posição:
 * Z ∈ [-0.9, +3.68], a MAIORIA da malha em Z positivo). Como "positivo"
 * aqui É a direção do golpe, a maior parte do traço acaba desenhada
 * ALÉM do ponto de impacto — ou seja, dentro/atravessando a parede que
 * `resolveAttackImpactPoint` devia ter travado antes.
 *
 * Corrige transladando a GEOMETRIA (não `object.position` — precisa
 * escalar junto com `object.scale.setScalar(...)`, que muda todo frame
 * conforme a curva de crescimento/`radius`/`scale` configurável; um
 * offset em unidade de mundo em vez de unidade local ficaria errado
 * assim que a escala mudasse) de modo que a PONTA mais distante
 * (`boundingBox.max.z`) passe a ficar em Z=0 — o resto do traço passa a
 * se estender só em Z negativo, ou seja, sempre PRA TRÁS do ponto de
 * impacto (rumo a quem golpeou), nunca além dele. Aplicado uma única vez
 * por geometria (`userData.forwardTipAligned`, flag) — a geometria vem
 * do `scene` cacheado por `useGLTF` (`object = scene.clone()` clona só a
 * hierarquia/transforms, não a geometria, mesmo comportamento padrão do
 * `Object3D.clone()` do Three.js), então sem a flag cada nova instância
 * (`useMemo` roda de novo por criatura/ataque) transladaria de novo por
 * cima da última, acumulando erro.
 */
export function useAdditiveEffectMesh(path, color, options = {}) {
  const { reveal = false, alignForwardTip = false } = options
  const { scene } = useGLTF(path)

  return useMemo(() => {
    const object = scene.clone()
    const materials = []
    const revealUniforms = []
    object.traverse((child) => {
      if (!child.isMesh) return

      if (alignForwardTip && !child.geometry.userData.forwardTipAligned) {
        child.geometry.computeBoundingBox()
        child.geometry.translate(0, 0, -child.geometry.boundingBox.max.z)
        child.geometry.userData.forwardTipAligned = true
      }

      const material = new THREE.MeshBasicMaterial({
        map: child.material?.map ?? null,
        color: color ?? '#ffffff',
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
      if (reveal) {
        const revealUniform = { value: 1 }
        material.onBeforeCompile = (shader) => {
          shader.uniforms.uProgress = revealUniform
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <common>',
              '#include <common>\nuniform float uProgress;',
            )
            .replace(
              '#include <map_fragment>',
              '#include <map_fragment>\nif (vMapUv.x > uProgress) discard;',
            )
        }
        revealUniforms.push(revealUniform)
      }
      child.material = material
      materials.push(material)
    })
    return { object, materials, revealUniforms }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, reveal, alignForwardTip])
}
