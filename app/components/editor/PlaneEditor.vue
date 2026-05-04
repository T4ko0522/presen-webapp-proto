<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideElement } from '~/domain/presentation'
import PlaneElement from './PlaneElement.vue'

const store = useEditorStore()

const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const containerHeight = ref(0)

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!containerRef.value) return
  observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return
    containerWidth.value = entry.contentRect.width
    containerHeight.value = entry.contentRect.height
  })
  observer.observe(containerRef.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

// スライドを表示するスケールを計算（コンテナ内に収まる最大サイズ）
const scale = computed(() => {
  if (!containerWidth.value || !containerHeight.value) return 1
  const sx = containerWidth.value / SLIDE_WIDTH
  const sy = containerHeight.value / SLIDE_HEIGHT
  return Math.min(sx, sy)
})

const slideStyle = computed(() => ({
  width: `${SLIDE_WIDTH * scale.value}px`,
  height: `${SLIDE_HEIGHT * scale.value}px`,
  background: store.currentSlide?.background ?? '#ffffff',
}))

// Z 値が大きい (= 手前) ほど後に描画して上のレイヤーに置く
// ただし 3Dモデル要素は z 値に関係なく常に最前面 (編集中に隠されないため)
// 同じ Z のときは元の配列順を保つ (ES2019+ の Array.sort は stable)
const elements = computed<SlideElement[]>(() => {
  const arr = store.currentSlide?.elements ?? []
  return [...arr].sort((a, b) => {
    if (a.type === 'model' && b.type !== 'model') return 1
    if (a.type !== 'model' && b.type === 'model') return -1
    return a.z - b.z
  })
})

function clearSelection() {
  store.selectElement(null)
}

function onWheel(e: WheelEvent) {
  // プロト段階ではズーム機能は省略
  if (e.ctrlKey) e.preventDefault()
}

onMounted(async () => {
  await nextTick()
  if (containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect()
    containerWidth.value = rect.width
    containerHeight.value = rect.height
  }
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative h-full w-full overflow-hidden"
    @wheel="onWheel"
  >
    <div class="absolute inset-0 flex items-center justify-center">
      <!-- スライド背景 -->
      <div
        class="relative shadow-2xl ring-1 ring-slate-300"
        :style="slideStyle"
        @pointerdown.self="clearSelection"
      >
        <!-- 各要素 -->
        <PlaneElement
          v-for="el in elements"
          :key="el.id"
          :element="el"
          :scale="scale"
        />
      </div>
    </div>

    <!-- モードラベル -->
    <div class="pointer-events-none absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
      平面編集 (X, Y, 幅, 高さ, 回転)
    </div>
    <div class="pointer-events-none absolute right-4 top-4 rounded-md bg-white/80 px-3 py-1 text-xs text-slate-500 shadow-sm">
      Z 軸は 3D 編集モードで調整
    </div>
  </div>
</template>
