import { Suspense, useCallback, useRef, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { useQuery } from 'koota/react'
import { GAME_CONFIG } from '@/core/gameConfig'
import { resolvePokemonBallId } from '@/core/actions/pokemon'
import {
  BallOnGround,
  CaptureBall,
  Pokemon,
  Position,
  Rotation,
} from '@/core/traits'
import { registerView, unregisterView } from '../registry/viewRegistry'
import {
  registerCaptureBall,
  setCaptureBallModel,
  unregisterCaptureBall,
} from '../registry/captureBallRegistry'
import { ItemModel, hasItemModel } from './ItemModel'

const { BALL_RADIUS } = GAME_CONFIG.CAPTURE
const { GLOW_COLOR, STAR_COUNT, BREAK_PIECES } =
  GAME_CONFIG.FEEDBACK.CAPTURE_BALL
// Bola sem modelo: esfera nas cores da Pokébola.
const FALLBACK_BALL_COLOR = '#e53935'
// Tamanho (m) de cada estrelinha/pedaço.
const SPARK_SIZE = 0.04
const SPARK_COUNT = Math.max(STAR_COUNT, BREAK_PIECES)

/** O modelo da bola (`item.model`) ou, sem ele, uma esfera. */
function BallModel({ itemId, onModel }) {
  const sphere = (
    <mesh castShadow>
      <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
      <meshStandardMaterial color={FALLBACK_BALL_COLOR} />
    </mesh>
  )
  if (!hasItemModel(itemId)) return sphere
  return (
    <Suspense fallback={sphere}>
      <ItemModel itemId={itemId} onModel={onModel} />
    </Suspense>
  )
}

/**
 * Pokébola de captura (`CaptureBall`, docs/features/043-captura.md): o
 * modelo da bola num grupo que o `captureBallViewSystem.js` gira (voo),
 * balança e encolhe; o brilho da absorção; e as estrelinhas/pedaços. A
 * `Position` é o centro da bola. Some quando o `captureBallSystem` destrói a
 * entidade.
 */
export function CaptureBallView({ entity }) {
  const groupRef = useRef()
  const spinRef = useRef()
  const glowRef = useRef()
  const sparksRef = useRef()
  const { itemId } = entity.get(CaptureBall) ?? {}
  const onModel = useCallback(
    (model) => setCaptureBallModel(entity, model),
    [entity],
  )

  useLayoutEffect(() => {
    registerView(entity, groupRef.current)
    registerCaptureBall(entity, { spinRef, glowRef, sparksRef })
    return () => {
      unregisterView(entity)
      unregisterCaptureBall(entity)
    }
  }, [entity])

  return (
    <group ref={groupRef}>
      <group ref={spinRef}>
        <BallModel itemId={itemId} onModel={onModel} />
      </group>
      <mesh ref={glowRef} visible={false}>
        <sphereGeometry args={[BALL_RADIUS, 16, 16]} />
        <meshBasicMaterial
          color={GLOW_COLOR}
          transparent
          opacity={0.45}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <group ref={sparksRef}>
        {Array.from({ length: SPARK_COUNT }, (_, index) => (
          <mesh key={index} visible={false}>
            <octahedronGeometry args={[SPARK_SIZE]} />
            <meshBasicMaterial toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Uma `CaptureBallView` por Pokébola de captura na cena. */
export function CaptureBallsView() {
  const balls = useQuery(CaptureBall, Position, Rotation)

  return (
    <>
      {balls.map((entity) => (
        <CaptureBallView key={entity} entity={entity} />
      ))}
    </>
  )
}

/**
 * Pokémon capturado sem lugar no time nem no inventário: a bola fechada,
 * parada no chão onde caiu (`BallOnGround`, o centro dela). Ninguém pega
 * ainda.
 */
export function GroundBallsView() {
  const pokemons = useQuery(Pokemon, BallOnGround)

  return (
    <>
      {pokemons.map((pokemon) => {
        const { x, y, z } = pokemon.get(BallOnGround)
        return (
          <group key={pokemon} position={[x, y, z]}>
            <BallModel itemId={resolvePokemonBallId(pokemon)} />
          </group>
        )
      })}
    </>
  )
}
