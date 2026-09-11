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
