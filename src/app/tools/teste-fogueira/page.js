'use client'

/**
 * Spike de VFX — NÃO faz parte do jogo, mesmo espírito de
 * `/tools/teste-animations`: raiz R3F própria, fora do Canvas/GameLoop do
 * jogo (o `useFrame` de `Campfire.jsx` não viola a regra de "um único
 * useFrame" do projeto, que vale só pro loop de `src/view/loop/GameLoop.jsx`).
 * Só pra ver como uma simulação de fogo (partículas em duas camadas) fica
 * na prática — ver `Campfire.jsx` pro mecanismo e a lista de parâmetros.
 */
import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Campfire } from '@/tools/fireDemo/Campfire'

const SHAPES = ['cone', 'cylinder', 'inverseCone', 'sphere', 'diamond']
const PALETTES = ['fire', 'greenFlame', 'blueFlame', 'purpleFlame']

function Slider({ label, value, onChange, min, max, step }) {
  return (
    <label className="pointer-events-auto flex items-center gap-2">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-10 text-right">{value.toFixed(1)}x</span>
    </label>
  )
}

export default function TesteFoguueiraPage() {
  const [shape, setShape] = useState('cone')
  const [palette, setPalette] = useState('fire')
  const [width, setWidth] = useState(1)
  const [height, setHeight] = useState(1)
  const [density, setDensity] = useState(1)
  const [turbulence, setTurbulence] = useState(1)
  const [intensity, setIntensity] = useState(1)
  const [speed, setSpeed] = useState(1)
  const [scale, setScale] = useState(1)

  return (
    <div className="relative h-screen w-screen bg-neutral-950">
      <Canvas shadows camera={{ position: [1.5, 1.2, 2.5], fov: 50 }}>
        <ambientLight intensity={0.12} />
        <OrbitControls target={[0, 0.3, 0]} />
        <gridHelper args={[10, 10]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#1c1f16" />
        </mesh>
        <Campfire
          shape={shape}
          palette={palette}
          width={width}
          height={height}
          density={density}
          turbulence={turbulence}
          intensity={intensity}
          speed={speed}
          scale={scale}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 w-64 space-y-2 rounded bg-black/60 p-3 text-sm text-white">
        <label className="pointer-events-auto flex items-center gap-2">
          Formato
          <select
            className="flex-1 rounded bg-white/20 px-1 py-0.5"
            value={shape}
            onChange={(event) => setShape(event.target.value)}
          >
            {SHAPES.map((name) => (
              <option key={name} value={name} className="text-black">
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="pointer-events-auto flex items-center gap-2">
          Paleta
          <select
            className="flex-1 rounded bg-white/20 px-1 py-0.5"
            value={palette}
            onChange={(event) => setPalette(event.target.value)}
          >
            {PALETTES.map((name) => (
              <option key={name} value={name} className="text-black">
                {name}
              </option>
            ))}
          </select>
        </label>

        <Slider
          label="Escala"
          value={scale}
          onChange={setScale}
          min="0.2"
          max="3"
          step="0.1"
        />
        <Slider
          label="Largura"
          value={width}
          onChange={setWidth}
          min="0.3"
          max="2.5"
          step="0.1"
        />
        <Slider
          label="Altura"
          value={height}
          onChange={setHeight}
          min="0.3"
          max="2.5"
          step="0.1"
        />
        <Slider
          label="Densidade"
          value={density}
          onChange={setDensity}
          min="0.2"
          max="3"
          step="0.1"
        />
        <Slider
          label="Turbulência"
          value={turbulence}
          onChange={setTurbulence}
          min="0"
          max="3"
          step="0.1"
        />
        <Slider
          label="Intensidade"
          value={intensity}
          onChange={setIntensity}
          min="0.3"
          max="2"
          step="0.1"
        />
        <Slider
          label="Velocidade"
          value={speed}
          onChange={setSpeed}
          min="0.2"
          max="3"
          step="0.1"
        />
      </div>
    </div>
  )
}
