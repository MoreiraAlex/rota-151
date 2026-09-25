import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fakeEventTarget as fakeTarget } from '@/test/fakeEventTarget'
import { createPointerInput } from './pointerInput'

let element
let doc
let win

beforeEach(() => {
  element = fakeTarget({ requestPointerLock: vi.fn() })
  doc = fakeTarget({ pointerLockElement: null, exitPointerLock: vi.fn() })
  win = fakeTarget()
  vi.stubGlobal('document', doc)
  vi.stubGlobal('window', win)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function lock() {
  doc.pointerLockElement = element
  doc.dispatch('pointerlockchange')
}

describe('pointerInput', () => {
  it('não acumula movimento enquanto o ponteiro não está travado', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    doc.dispatch('mousemove', { movementX: 10, movementY: 5 })

    expect(pointer.snapshot()).toMatchObject({ cameraYaw: 0, cameraPitch: 0 })
  })

  it('acumula os deltas do mouse quando travado e os drena no snapshot', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    doc.dispatch('mousemove', { movementX: 8, movementY: -3 })
    doc.dispatch('mousemove', { movementX: 2, movementY: 1 })

    expect(pointer.snapshot()).toMatchObject({ cameraYaw: 10, cameraPitch: -2 })
    // segundo snapshot vem zerado — os deltas foram drenados
    expect(pointer.snapshot()).toMatchObject({ cameraYaw: 0, cameraPitch: 0 })
  })

  it('acumula o zoom da roda em passos de ±1', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('wheel', { deltaY: 120 })
    element.dispatch('wheel', { deltaY: 90 })

    expect(pointer.snapshot().zoom).toBe(2)
  })

  it('clicar no elemento pede o pointer lock', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    element.dispatch('click')

    expect(element.requestPointerLock).toHaveBeenCalled()
  })

  it('o clique que pede o pointer lock não dispara a ação primária', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    element.dispatch('mousedown', { button: 0 })

    expect(pointer.snapshot().primary).toBe(false)
  })

  it('clique esquerdo dispara a ação primária só com o ponteiro travado, uma vez por clique', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 0 })

    expect(pointer.snapshot().primary).toBe(true)
    // segundo snapshot vem drenado — não repete sem novo clique
    expect(pointer.snapshot().primary).toBe(false)
  })

  it('clique direito não dispara a ação primária — só a secundária', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 2 })

    expect(pointer.snapshot().primary).toBe(false)
  })

  it('segurar o botão direito mantém secondaryHeld true em vários snapshots, até soltar', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 2 })

    // diferente de `primary` (pulso, dreno no snapshot) — `secondaryHeld`
    // continua true em quantos snapshots forem, enquanto o botão
    // continuar fisicamente pressionado (sem novo mousedown).
    expect(pointer.snapshot().secondaryHeld).toBe(true)
    expect(pointer.snapshot().secondaryHeld).toBe(true)
    expect(pointer.snapshot().secondaryHeld).toBe(true)
  })

  it('soltar o botão direito pulsa secondaryReleased por um snapshot só, e desliga secondaryHeld', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 2 })
    pointer.snapshot()

    element.dispatch('mouseup', { button: 2 })

    const released = pointer.snapshot()
    expect(released.secondaryHeld).toBe(false)
    expect(released.secondaryReleased).toBe(true)

    // pulso — não repete no snapshot seguinte sem soltar de novo
    expect(pointer.snapshot().secondaryReleased).toBe(false)
  })

  it('clique esquerdo não dispara a ação secundária', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 0 })

    expect(pointer.snapshot().secondaryHeld).toBe(false)
  })

  it('sem o ponteiro travado, clique direito não dispara a ação secundária', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    element.dispatch('mousedown', { button: 2 })

    expect(pointer.snapshot().secondaryHeld).toBe(false)
  })

  it('perder o pointer lock enquanto segura o botão direito desliga secondaryHeld', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    lock()

    element.dispatch('mousedown', { button: 2 })
    expect(pointer.snapshot().secondaryHeld).toBe(true)

    doc.pointerLockElement = null
    doc.dispatch('pointerlockchange')

    expect(pointer.snapshot().secondaryHeld).toBe(false)
  })

  it('suprime o menu de contexto nativo do botão direito', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    const event = { preventDefault: vi.fn() }
    element.dispatch('contextmenu', event)

    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('suprime o menu de contexto também se o evento nascer no document', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    const event = { preventDefault: vi.fn() }
    doc.dispatch('contextmenu', event)

    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('mousedown do botão direito já suprime o menu de contexto (não espera o contextmenu)', () => {
    const pointer = createPointerInput()
    pointer.start(element)

    const event = { button: 2, preventDefault: vi.fn() }
    element.dispatch('mousedown', event)

    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('stop remove os listeners', () => {
    const pointer = createPointerInput()
    pointer.start(element)
    pointer.stop()

    expect(element.count('click')).toBe(0)
    expect(element.count('contextmenu')).toBe(0)
    expect(doc.count('contextmenu')).toBe(0)
    expect(doc.count('mousemove')).toBe(0)
    expect(win.count('blur')).toBe(0)
  })
})
