import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryManager } from './history'
import {
  addElementCommand,
  removeElementCommand,
  updateElementCommand,
} from './commands'
import type { TextElement, Slide } from './presentation'
import { createId } from './presentation'

function makeSlide(): Slide {
  return {
    id: 'slide_1',
    order: 0,
    background: '#ffffff',
    elements: [],
    notes: '',
  }
}

function makeText(overrides: Partial<TextElement> = {}): TextElement {
  return {
    id: createId('text'),
    type: 'text',
    x: 100, y: 100, z: 0,
    width: 200, height: 50,
    rotation: 0,
    content: 'hello',
    fontSize: 24,
    fontColor: '#000',
    fontFamily: 'sans-serif',
    fontWeight: 'normal',
    textAlign: 'left',
    ...overrides,
  }
}

describe('element commands with HistoryManager', () => {
  let history: HistoryManager
  let slide: Slide
  let mutator: import('./commands').SlideMutator

  beforeEach(() => {
    history = new HistoryManager()
    slide = makeSlide()
    mutator = {
      insertElement(_, element, atIndex) {
        if (typeof atIndex === 'number') slide.elements.splice(atIndex, 0, element)
        else slide.elements.push(element)
      },
      removeElement(_, elementId) {
        const index = slide.elements.findIndex(e => e.id === elementId)
        if (index === -1) return null
        const [element] = slide.elements.splice(index, 1)
        return { element: element!, index }
      },
      updateElement(_, elementId, patch) {
        const target = slide.elements.find(e => e.id === elementId)
        if (!target) return null
        const before = { ...target }
        Object.assign(target, patch)
        return before
      },
      insertSlide() { throw new Error('not used') },
      removeSlide() { throw new Error('not used') },
      reorderSlides() { throw new Error('not used') },
    }
  })

  it('add → undo → redo roundtrips an element', () => {
    const text = makeText()
    history.execute(addElementCommand(mutator, slide.id, text))
    expect(slide.elements).toHaveLength(1)
    history.undo()
    expect(slide.elements).toHaveLength(0)
    history.redo()
    expect(slide.elements).toHaveLength(1)
    expect(slide.elements[0]?.id).toBe(text.id)
  })

  it('remove preserves index for undo', () => {
    const a = makeText({ id: 'a' })
    const b = makeText({ id: 'b' })
    const c = makeText({ id: 'c' })
    slide.elements.push(a, b, c)

    history.execute(removeElementCommand(mutator, slide.id, 'b'))
    expect(slide.elements.map(e => e.id)).toEqual(['a', 'c'])

    history.undo()
    expect(slide.elements.map(e => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('update reverts only the patched fields', () => {
    const text = makeText({ x: 10, y: 20, content: 'before' })
    slide.elements.push(text)

    history.execute(updateElementCommand<TextElement>(mutator, slide.id, text.id, { x: 999 }))
    expect((slide.elements[0] as TextElement).x).toBe(999)
    expect((slide.elements[0] as TextElement).y).toBe(20)
    expect((slide.elements[0] as TextElement).content).toBe('before')

    history.undo()
    expect((slide.elements[0] as TextElement).x).toBe(10)
  })
})
