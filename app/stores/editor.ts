import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import {
  HistoryManager,
  type Command,
} from '~/domain/history'
import {
  addElementCommand,
  addSlideCommand,
  removeElementCommand,
  removeSlideCommand,
  reorderSlidesCommand,
  updateElementCommand,
  type SlideMutator,
} from '~/domain/commands'
import {
  type ElementId,
  type Presentation,
  type Slide,
  type SlideElement,
  type SlideId,
  createId,
} from '~/domain/presentation'

export type EditorMode = 'plane' | 'depth'

export const useEditorStore = defineStore('editor', () => {
  const presentation = ref<Presentation | null>(null)
  const currentSlideId = ref<SlideId | null>(null)
  const selectedElementId = ref<ElementId | null>(null)
  const mode = ref<EditorMode>('plane')

  const history = shallowRef(new HistoryManager({ capacity: 200 }))
  const historyVersion = ref(0)

  const mutator: SlideMutator = reactive({
    insertElement(slideId, element, atIndex) {
      const slide = findSlide(slideId)
      if (!slide) return
      if (typeof atIndex === 'number') slide.elements.splice(atIndex, 0, element)
      else slide.elements.push(element)
      selectedElementId.value = element.id
    },
    removeElement(slideId, elementId) {
      const slide = findSlide(slideId)
      if (!slide) return null
      const index = slide.elements.findIndex(e => e.id === elementId)
      if (index === -1) return null
      const [removed] = slide.elements.splice(index, 1)
      if (selectedElementId.value === elementId) selectedElementId.value = null
      return removed ? { element: removed, index } : null
    },
    updateElement(slideId, elementId, patch) {
      const slide = findSlide(slideId)
      if (!slide) return null
      const target = slide.elements.find(e => e.id === elementId)
      if (!target) return null
      const before = { ...target } as SlideElement
      Object.assign(target, patch)
      return before
    },
    insertSlide(slide, atIndex) {
      if (!presentation.value) return
      presentation.value.slides.splice(atIndex, 0, slide)
      reindex()
      currentSlideId.value = slide.id
    },
    removeSlide(slideId) {
      if (!presentation.value) return null
      const index = presentation.value.slides.findIndex(s => s.id === slideId)
      if (index === -1) return null
      const [removed] = presentation.value.slides.splice(index, 1)
      reindex()
      if (currentSlideId.value === slideId) {
        const fallback = presentation.value.slides[Math.max(0, index - 1)]
        currentSlideId.value = fallback?.id ?? null
      }
      return removed ? { slide: removed, index } : null
    },
    reorderSlides(orderedIds) {
      if (!presentation.value) return []
      const previous = presentation.value.slides.map(s => s.id)
      const lookup = new Map(presentation.value.slides.map(s => [s.id, s]))
      presentation.value.slides = orderedIds
        .map(id => lookup.get(id))
        .filter((s): s is Slide => Boolean(s))
      reindex()
      return previous
    },
  }) as SlideMutator

  function findSlide(slideId: SlideId): Slide | undefined {
    return presentation.value?.slides.find(s => s.id === slideId)
  }

  function reindex() {
    if (!presentation.value) return
    presentation.value.slides.forEach((s, i) => { s.order = i })
  }

  const currentSlide = computed<Slide | null>(() => {
    if (!presentation.value || !currentSlideId.value) return null
    return presentation.value.slides.find(s => s.id === currentSlideId.value) ?? null
  })

  const selectedElement = computed<SlideElement | null>(() => {
    if (!currentSlide.value || !selectedElementId.value) return null
    return currentSlide.value.elements.find(e => e.id === selectedElementId.value) ?? null
  })

  function loadPresentation(p: Presentation) {
    presentation.value = p
    currentSlideId.value = p.slides[0]?.id ?? null
    selectedElementId.value = null
    history.value.clear()
    bumpVersion()
  }

  function setMode(next: EditorMode) {
    mode.value = next
  }

  function selectSlide(slideId: SlideId) {
    currentSlideId.value = slideId
    selectedElementId.value = null
  }

  function selectElement(elementId: ElementId | null) {
    selectedElementId.value = elementId
  }

  function dispatch(command: Command) {
    history.value.execute(command)
    bumpVersion()
  }

  function undo() {
    history.value.undo()
    bumpVersion()
  }

  function redo() {
    history.value.redo()
    bumpVersion()
  }

  function bumpVersion() {
    historyVersion.value += 1
  }

  function addElement(element: SlideElement) {
    if (!currentSlideId.value) return
    dispatch(addElementCommand(mutator, currentSlideId.value, element))
  }

  function removeElement(elementId: ElementId) {
    if (!currentSlideId.value) return
    dispatch(removeElementCommand(mutator, currentSlideId.value, elementId))
  }

  function updateElement(elementId: ElementId, patch: Partial<SlideElement>) {
    if (!currentSlideId.value) return
    dispatch(updateElementCommand(mutator, currentSlideId.value, elementId, patch))
  }

  function addSlide() {
    if (!presentation.value) return
    const slide: Slide = {
      id: createId('slide'),
      order: presentation.value.slides.length,
      background: '#ffffff',
      elements: [],
      notes: '',
    }
    dispatch(addSlideCommand(mutator, slide, presentation.value.slides.length))
  }

  function removeSlide(slideId: SlideId) {
    if (!presentation.value || presentation.value.slides.length <= 1) return
    dispatch(removeSlideCommand(mutator, slideId))
  }

  function reorderSlides(orderedIds: SlideId[]) {
    dispatch(reorderSlidesCommand(mutator, orderedIds))
  }

  const canUndo = computed(() => historyVersion.value >= 0 && history.value.canUndo())
  const canRedo = computed(() => historyVersion.value >= 0 && history.value.canRedo())

  return {
    presentation,
    currentSlideId,
    selectedElementId,
    mode,
    currentSlide,
    selectedElement,
    canUndo,
    canRedo,
    loadPresentation,
    setMode,
    selectSlide,
    selectElement,
    addElement,
    removeElement,
    updateElement,
    addSlide,
    removeSlide,
    reorderSlides,
    undo,
    redo,
  }
})
