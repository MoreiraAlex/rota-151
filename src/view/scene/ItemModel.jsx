import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { getItem } from '@/core/data/items'
import { loadTexture } from '../textures/textureCache'
import { setEatStage } from '../itemEatStages'
import { buildItemModel } from '../itemModelBuild'
import { stripRootMotion, trimDeadTail } from '../itemClipCleanup'
import { scalePositionTracks } from '../itemRig'

/**
 * Modelo 3D de um item (`item.model`, ver `core/data/items/_template/`):
 * carrega o `.glb` (cache do `useGLTF`), clona pra esta instância, aplica a
 * textura e redimensiona pra `model.size` (maior dimensão, em metros).
 *
 * **Pivô**: o modelo fica centrado no CORPO do item — o nó `model.pivot`, ou
 * o primeiro pedaço da fruta (`eatStages[0]`), ou o modelo inteiro —, não na
 * caixa do modelo todo (as folhas da fruta puxariam o centro pra cima). É em
 * volta dele que o item gira e aperta: quem anima mexe no grupo `pivot`
 * (recebido por `onModel`), não no de fora. `align` decide onde fica a
 * origem do de fora: `'center'` (no pivô — fruta na mão) ou `'bottom'` (na
 * base do modelo, com o pivô levantado o quanto precisa — fruta no chão).
 *
 * Fruta com `model.eatStages`: só um pedaço fica visível por vez. `eaten`
 * (0–1, quanto já foi comido) escolhe qual; quem atualiza todo frame pode,
 * em vez disso, receber os pedaços por `onModel` e trocar a visibilidade
 * direto (`setEatStage`), sem re-render.
 *
 * Usa `useGLTF` (suspende): quem renderiza põe um `<Suspense>` em volta.
 * Os materiais são cópias desta instância (a textura vem do cache, é
 * compartilhada e não é descartada aqui); o cleanup descarta os materiais.
 */
export function ItemModel({ itemId, align = 'center', eaten = 0, onModel }) {
  const config = getItem(itemId)?.model
  const { scene } = useGLTF(config.path)
  // Clipes de outro item (`clipsFrom`, ex.: as Pokébolas usam os da Poké
  // Bola — `view/itemRig.js`); sem ele, os do próprio `.glb`.
  const clipSource = config.clipsFrom ? getItem(config.clipsFrom)?.model : null
  const source = useGLTF(clipSource?.path ?? config.path)
  const rigSource = clipSource ? source.scene : null
  const model = useMemo(
    () => buildItemModel(scene, config, align, rigSource),
    [scene, config, align, rigSource],
  )
  // Cópias, com o fim corrompido cortado (`trimDeadTail`) — o cache do
  // `useGLTF` é compartilhado, não mexe nos originais. Sem o movimento da
  // raiz (`stripRootMotion`): a posição é do jogo. Clipes de outro item vêm
  // reescalados pro tamanho deste (`scalePositionTracks`).
  const animations = useMemo(() => {
    const rootNames = source.scene.children.map((child) => child.name)
    return source.animations.map((clip) =>
      scalePositionTracks(
        stripRootMotion(trimDeadTail(clip.clone()), rootNames),
        model.rigScale,
      ),
    )
  }, [source, model])

  useEffect(() => {
    let cancelled = false
    const texture = config.texture
    if (texture?.path) {
      loadTexture(texture.path).then((loaded) => {
        if (!loaded || cancelled) return
        if (texture.flipY !== undefined) loaded.flipY = texture.flipY
        loaded.needsUpdate = true
        for (const material of model.materials) {
          material.map = loaded
          material.needsUpdate = true
        }
      })
    }
    return () => {
      cancelled = true
      for (const material of model.materials) material.dispose()
    }
  }, [model, config])

  useEffect(() => {
    setEatStage(model.stages, eaten)
  }, [model, eaten])

  useEffect(() => {
    onModel?.({
      stages: model.stages,
      pivot: model.pivot,
      // Pra tocar os clipes do `.glb` nesta instância (`AnimationMixer` no
      // `root` — os nós do clone têm os mesmos nomes do original).
      root: model.root,
      animations,
    })
    return () => onModel?.(null)
  }, [model, onModel, animations])

  return <primitive object={model.root} />
}

/** O item tem modelo 3D configurado? */
export function hasItemModel(itemId) {
  return !!getItem(itemId)?.model?.path
}
