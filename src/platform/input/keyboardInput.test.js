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
      secondary1: false,
      secondary2: false,
      secondary3: false,
      switchSlot1: false,
      switchSlot2: false,
      switchSlot3: false,
      returnToBot: false,
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
    press('AltLeft')
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
      secondary1: false,
      secondary2: false,
      secondary3: false,
      switchSlot1: false,
      switchSlot2: false,
      switchSlot3: false,
      returnToBot: false,
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

  it('AltLeft mapeia para o pulso de dash, drenado no snapshot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('AltLeft')
    expect(keyboard.snapshot().dash).toBe(true)
    // drenado — a segunda leitura sem novo keydown vem falsa, mesmo com a
    // tecla ainda fisicamente pressionada
    expect(keyboard.snapshot().dash).toBe(false)
  })

  it('segurar a tecla de dash (auto-repeat do SO) não gera novo pulso', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    win.dispatch('keydown', {
      code: 'AltLeft',
      preventDefault: () => {},
      repeat: true,
    })

    expect(keyboard.snapshot().dash).toBe(false)
  })

  it('soltar e apertar de novo gera um novo pulso de dash', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('AltLeft')
    expect(keyboard.snapshot().dash).toBe(true)

    release('AltLeft')
    press('AltLeft')
    expect(keyboard.snapshot().dash).toBe(true)
  })

  it('KeyQ/KeyE/KeyR mapeiam para os pulsos de secondary1/2/3, drenados no snapshot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyQ')
    press('KeyE')
    press('KeyR')
    expect(keyboard.snapshot()).toMatchObject({
      secondary1: true,
      secondary2: true,
      secondary3: true,
    })
    // drenado — segunda leitura sem novo keydown vem falsa
    expect(keyboard.snapshot()).toMatchObject({
      secondary1: false,
      secondary2: false,
      secondary3: false,
    })
  })

  it('segurar KeyQ (auto-repeat do SO) não gera novo pulso de secondary1', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    win.dispatch('keydown', {
      code: 'KeyQ',
      preventDefault: () => {},
      repeat: true,
    })

    expect(keyboard.snapshot().secondary1).toBe(false)
  })

  it('perder o foco descarta pulsos pendentes de secondary1/2/3', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('KeyQ')
    press('KeyE')
    press('KeyR')
    win.dispatch('blur')

    expect(keyboard.snapshot()).toMatchObject({
      secondary1: false,
      secondary2: false,
      secondary3: false,
    })
  })

  it('Digit1/2/3 mapeiam para os pulsos de troca de controle switchSlot1/2/3, drenados no snapshot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Digit1')
    press('Digit2')
    press('Digit3')
    expect(keyboard.snapshot()).toMatchObject({
      switchSlot1: true,
      switchSlot2: true,
      switchSlot3: true,
    })
    // drenado — segunda leitura sem novo keydown vem falsa
    expect(keyboard.snapshot()).toMatchObject({
      switchSlot1: false,
      switchSlot2: false,
      switchSlot3: false,
    })
  })

  it('Digit4 mapeia para o pulso de returnToBot, drenado no snapshot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Digit4')
    expect(keyboard.snapshot().returnToBot).toBe(true)
    expect(keyboard.snapshot().returnToBot).toBe(false)
  })

  it('segurar Digit1 (auto-repeat do SO) não gera novo pulso de switchSlot1', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    win.dispatch('keydown', {
      code: 'Digit1',
      preventDefault: () => {},
      repeat: true,
    })

    expect(keyboard.snapshot().switchSlot1).toBe(false)
  })

  it('perder o foco descarta pulsos pendentes de switchSlot1/2/3 e returnToBot', () => {
    const keyboard = createKeyboardInput()
    keyboard.start()

    press('Digit1')
    press('Digit2')
    press('Digit3')
    press('Digit4')
    win.dispatch('blur')

    expect(keyboard.snapshot()).toMatchObject({
      switchSlot1: false,
      switchSlot2: false,
      switchSlot3: false,
      returnToBot: false,
    })
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
