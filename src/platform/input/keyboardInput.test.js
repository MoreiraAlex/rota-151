import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fakeEventTarget } from '@/test/fakeEventTarget'
import { createKeyboardInput } from './keyboardInput'

let win

beforeEach(() => {
  win = fakeEventTarget()
  vi.stubGlobal('window', win)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function press(code) {
  win.dispatch('keydown', { code, preventDefault: () => {} })
}

function release(code) {
  win.dispatch('keyup', { code, preventDefault: () => {} })
}

describe('keyboardInput', () => {
  it('sem tecla pressionada, o snapshot vem todo falso', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    expect(keyboard.snapshot()).toEqual({
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      run: false,
      dash: false,
    })
  })

  it('mapeia WASD, setas e espaço para as ações semânticas', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyW')
    press('ArrowRight')
    press('Space')

    expect(keyboard.snapshot()).toMatchObject({
      forward: true,
      right: true,
      jump: true,
      back: false,
      left: false,
    })
  })

  it('segurar Espaço (auto-repeat do SO) não gera novo pulso de jump', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Space')
    expect(keyboard.snapshot().jump).toBe(true)
    // drenado — sem soltar a tecla, a segunda leitura já vem falsa
    expect(keyboard.snapshot().jump).toBe(false)

    win.dispatch('keydown', {
      code: 'Space',
      preventDefault: () => {},
      repeat: true,
    })
    expect(keyboard.snapshot().jump).toBe(false)
  })

  it('soltar Espaço e apertar de novo gera um novo pulso de jump', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Space')
    expect(keyboard.snapshot().jump).toBe(true)

    release('Space')
    press('Space')
    expect(keyboard.snapshot().jump).toBe(true)
  })

  it('keyup libera a ação', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyD')
    expect(keyboard.snapshot().right).toBe(true)

    release('KeyD')
    expect(keyboard.snapshot().right).toBe(false)
  })

  it('perder o foco da janela solta todas as teclas', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyW')
    press('KeyA')
    win.dispatch('blur')

    expect(keyboard.snapshot()).toMatchObject({ forward: false, left: false })
  })

  it('perder o foco descarta pulsos pendentes de jump/dash', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Space')
    press('ControlLeft')
    win.dispatch('blur')

    // sem isso, o pulso sobreviveria escondido e disparia no primeiro
    // snapshot() depois de recuperar o foco, sem tecla nenhuma pressionada
    expect(keyboard.snapshot()).toMatchObject({ jump: false, dash: false })
  })

  it('tecla não mapeada é ignorada', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyZ')

    expect(keyboard.snapshot()).toEqual({
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      run: false,
      dash: false,
    })
  })

  it('ShiftLeft e ShiftRight mapeiam para a ação de correr', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('ShiftLeft')
    expect(keyboard.snapshot().run).toBe(true)

    release('ShiftLeft')
    press('ShiftRight')
    expect(keyboard.snapshot().run).toBe(true)
  })

  it('ControlLeft/ControlRight mapeiam para o pulso de dash, drenado no snapshot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('ControlLeft')
    expect(keyboard.snapshot().dash).toBe(true)
    // drenado — a segunda leitura sem novo keydown vem falsa, mesmo com a
    // tecla ainda fisicamente pressionada
    expect(keyboard.snapshot().dash).toBe(false)

    press('ControlRight')
    expect(keyboard.snapshot().dash).toBe(true)
  })

  it('segurar a tecla de dash (auto-repeat do SO) não gera novo pulso', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    win.dispatch('keydown', {
      code: 'ControlLeft',
      preventDefault: () => {},
      repeat: true,
    })

    expect(keyboard.snapshot().dash).toBe(false)
  })

  it('soltar e apertar de novo gera um novo pulso de dash', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('ControlLeft')
    expect(keyboard.snapshot().dash).toBe(true)

    release('ControlLeft')
    press('ControlLeft')
    expect(keyboard.snapshot().dash).toBe(true)
  })

  it('stop remove os listeners e zera o estado', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()
    press('KeyW')

    keyboard.stop()

    expect(win.count('keydown')).toBe(0)
    expect(win.count('keyup')).toBe(0)
    expect(win.count('blur')).toBe(0)
    expect(keyboard.snapshot().forward).toBe(false)
  })
})
