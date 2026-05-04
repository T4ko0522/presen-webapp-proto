<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEditorStore } from '~/stores/editor'
import type { SlideElement } from '~/domain/presentation'
import ModelPreview3D from './ModelPreview3D.vue'

const props = defineProps<{
  element: SlideElement
  scale: number
}>()

const store = useEditorStore()

const isSelected = computed(() => store.selectedElementId === props.element.id)

const wrapperStyle = computed(() => ({
  left: `${props.element.x * props.scale}px`,
  top: `${props.element.y * props.scale}px`,
  width: `${props.element.width * props.scale}px`,
  height: `${props.element.height * props.scale}px`,
  transform: `rotate(${props.element.rotation}deg)`,
  transformOrigin: 'center',
}))

function startDrag(e: PointerEvent) {
  e.stopPropagation()
  store.selectElement(props.element.id)

  const startX = e.clientX
  const startY = e.clientY
  const elStartX = props.element.x
  const elStartY = props.element.y

  function onMove(ev: PointerEvent) {
    const dx = (ev.clientX - startX) / props.scale
    const dy = (ev.clientY - startY) / props.scale
    store.updateElement(props.element.id, {
      x: Math.round(elStartX + dx),
      y: Math.round(elStartY + dy),
    } as Partial<SlideElement>)
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

function startResize(e: PointerEvent, handle: Handle) {
  e.stopPropagation()
  store.selectElement(props.element.id)

  const startX = e.clientX
  const startY = e.clientY
  const start = { x: props.element.x, y: props.element.y, width: props.element.width, height: props.element.height }

  function onMove(ev: PointerEvent) {
    const dx = (ev.clientX - startX) / props.scale
    const dy = (ev.clientY - startY) / props.scale

    let { x, y, width, height } = start
    if (handle.includes('e')) width = Math.max(20, start.width + dx)
    if (handle.includes('s')) height = Math.max(20, start.height + dy)
    if (handle.includes('w')) {
      width = Math.max(20, start.width - dx)
      x = start.x + (start.width - width)
    }
    if (handle.includes('n')) {
      height = Math.max(20, start.height - dy)
      y = start.y + (start.height - height)
    }
    store.updateElement(props.element.id, {
      x: Math.round(x), y: Math.round(y),
      width: Math.round(width), height: Math.round(height),
    } as Partial<SlideElement>)
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function startRotate(e: PointerEvent) {
  e.stopPropagation()
  store.selectElement(props.element.id)
  const target = (e.currentTarget as HTMLElement).closest('[data-element-wrapper]') as HTMLElement
  const rect = target.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx)
  const startRotation = props.element.rotation

  function onMove(ev: PointerEvent) {
    const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx)
    const delta = (angle - startAngle) * (180 / Math.PI)
    let next = Math.round(startRotation + delta)
    next = ((next % 360) + 360) % 360
    if (next > 180) next -= 360
    store.updateElement(props.element.id, { rotation: next } as Partial<SlideElement>)
  }
  function onUp() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

function onSelect(e: PointerEvent) {
  e.stopPropagation()
  store.selectElement(props.element.id)
}

const isEditingText = ref(false)
function onDoubleClick() {
  if (props.element.type === 'text') isEditingText.value = true
}
function onTextInput(e: Event) {
  const target = e.target as HTMLDivElement
  store.updateElement(props.element.id, { content: target.innerText } as Partial<SlideElement>)
}
function onTextBlur() {
  isEditingText.value = false
}
</script>

<template>
  <div
    class="absolute"
    data-element-wrapper
    :style="wrapperStyle"
    @pointerdown.self="onSelect"
  >
    <!-- 要素本体 -->
    <div
      class="relative h-full w-full select-none"
      :class="{ 'cursor-move': !isEditingText }"
      @pointerdown="startDrag"
      @dblclick="onDoubleClick"
    >
      <template v-if="element.type === 'text'">
        <div
          class="h-full w-full overflow-hidden whitespace-pre-line break-words"
          :contenteditable="isEditingText"
          :style="{
            color: element.fontColor,
            fontSize: element.fontSize * scale + 'px',
            fontFamily: element.fontFamily,
            fontWeight: element.fontWeight,
            textAlign: element.textAlign,
            outline: 'none',
            cursor: isEditingText ? 'text' : 'inherit',
          }"
          @input="onTextInput"
          @blur="onTextBlur"
          @pointerdown="(e) => isEditingText && e.stopPropagation()"
        >{{ element.content }}</div>
      </template>
      <template v-else-if="element.type === 'shape'">
        <div
          class="h-full w-full"
          :style="{
            background: element.fillColor,
            border: element.strokeWidth ? `${element.strokeWidth}px solid ${element.strokeColor}` : 'none',
            borderRadius: element.shape === 'ellipse' ? '50%' : '4px',
          }"
        />
      </template>
      <template v-else-if="element.type === 'image'">
        <img :src="element.src" class="h-full w-full object-cover" :alt="element.alt ?? ''" draggable="false" />
      </template>
      <template v-else-if="element.type === 'model'">
        <div class="relative h-full w-full overflow-hidden rounded border border-dashed border-sky-300 bg-gradient-to-br from-sky-50/40 to-slate-50/40">
          <ClientOnly>
            <ModelPreview3D
              :src="element.src"
              :rotation="element.modelRotation ?? { x: 0, y: 0, z: 0 }"
              :width="element.width"
              :height="element.height"
            />
          </ClientOnly>
          <div class="pointer-events-none absolute left-1 top-1 rounded bg-white/85 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 shadow-sm">
            {{ element.displayName }}
          </div>
        </div>
      </template>
    </div>

    <!-- 選択時のフレーム + ハンドル -->
    <template v-if="isSelected">
      <div class="pointer-events-none absolute -inset-px rounded ring-2 ring-sky-500" />

      <!-- リサイズハンドル -->
      <div
        v-for="h in (['nw','n','ne','e','se','s','sw','w'] as Handle[])"
        :key="h"
        class="absolute z-10 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-sky-600 bg-white"
        :style="{
          left: h === 'w' || h === 'nw' || h === 'sw' ? '0%' : h === 'n' || h === 's' ? '50%' : '100%',
          top: h === 'n' || h === 'nw' || h === 'ne' ? '0%' : h === 'w' || h === 'e' ? '50%' : '100%',
          cursor: ({nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'} as Record<Handle,string>)[h]
        }"
        @pointerdown="(e) => startResize(e, h)"
      />

      <!-- 回転ハンドル -->
      <div
        class="absolute left-1/2 -top-7 z-10 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full border border-sky-600 bg-white"
        @pointerdown="startRotate"
      />
      <div class="pointer-events-none absolute left-1/2 -top-4 h-4 w-px -translate-x-1/2 bg-sky-500/60" />
    </template>
  </div>
</template>
