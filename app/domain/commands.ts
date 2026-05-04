/**
 * スライド要素に対する具体コマンド
 *
 * すべてのコマンドはストアの mutate 関数経由で状態を変更する。
 * これにより、Pinia と HistoryManager を疎結合に保ちつつ Undo/Redo を実現する。
 */

import type { Command } from './history'
import type { SlideElement, SlideId, ElementId, Slide } from './presentation'

export interface SlideMutator {
  insertElement(slideId: SlideId, element: SlideElement, atIndex?: number): void
  removeElement(slideId: SlideId, elementId: ElementId): { element: SlideElement, index: number } | null
  updateElement(slideId: SlideId, elementId: ElementId, patch: Partial<SlideElement>): SlideElement | null
  insertSlide(slide: Slide, atIndex: number): void
  removeSlide(slideId: SlideId): { slide: Slide, index: number } | null
  reorderSlides(orderedIds: SlideId[]): SlideId[]
}

export function addElementCommand(
  mutator: SlideMutator,
  slideId: SlideId,
  element: SlideElement,
): Command {
  return {
    label: `add ${element.type}`,
    execute: () => mutator.insertElement(slideId, element),
    undo: () => mutator.removeElement(slideId, element.id),
  }
}

export function removeElementCommand(
  mutator: SlideMutator,
  slideId: SlideId,
  elementId: ElementId,
): Command {
  let snapshot: { element: SlideElement, index: number } | null = null
  return {
    label: 'remove element',
    execute: () => {
      snapshot = mutator.removeElement(slideId, elementId)
    },
    undo: () => {
      if (snapshot) mutator.insertElement(slideId, snapshot.element, snapshot.index)
    },
  }
}

export function updateElementCommand<T extends SlideElement>(
  mutator: SlideMutator,
  slideId: SlideId,
  elementId: ElementId,
  patch: Partial<T>,
): Command {
  let previous: Partial<SlideElement> | null = null
  return {
    label: 'update element',
    execute: () => {
      const before = mutator.updateElement(slideId, elementId, patch)
      if (before && previous === null) {
        previous = pickKeys(before, Object.keys(patch) as (keyof SlideElement)[])
      }
    },
    undo: () => {
      if (previous) mutator.updateElement(slideId, elementId, previous)
    },
  }
}

export function addSlideCommand(
  mutator: SlideMutator,
  slide: Slide,
  atIndex: number,
): Command {
  return {
    label: 'add slide',
    execute: () => mutator.insertSlide(slide, atIndex),
    undo: () => mutator.removeSlide(slide.id),
  }
}

export function removeSlideCommand(
  mutator: SlideMutator,
  slideId: SlideId,
): Command {
  let snapshot: { slide: Slide, index: number } | null = null
  return {
    label: 'remove slide',
    execute: () => {
      snapshot = mutator.removeSlide(slideId)
    },
    undo: () => {
      if (snapshot) mutator.insertSlide(snapshot.slide, snapshot.index)
    },
  }
}

export function reorderSlidesCommand(
  mutator: SlideMutator,
  orderedIds: SlideId[],
): Command {
  let previousOrder: SlideId[] = []
  return {
    label: 'reorder slides',
    execute: () => {
      previousOrder = mutator.reorderSlides(orderedIds)
    },
    undo: () => {
      mutator.reorderSlides(previousOrder)
    },
  }
}

function pickKeys<T extends object>(source: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {}
  for (const key of keys) {
    if (key in source) result[key] = source[key]
  }
  return result
}
