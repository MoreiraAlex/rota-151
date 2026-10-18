/** Controle deslizante com caixa de número, dos laboratórios (`tools/`). */
export function Slider({ label, value, min, max, step, onChange, unit = '' }) {
  return (
    <label className="grid grid-cols-[8rem_1fr_4.5rem] items-center gap-2">
      <span className="text-white/70">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full rounded bg-white/10 px-1 text-right"
        />
        {unit}
      </span>
    </label>
  )
}
