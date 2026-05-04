<script setup lang="ts">
/**
 * 3D編集モード (Babylon.js 版)
 *
 * - スライドを水平に置き、上から見下ろす俯瞰カメラで表示
 * - 各要素の z 値を「高さ」として 3D で可視化
 * - 3Dモデル (.glb) は実物として描画される
 * - Y 軸ギズモのみ有効。要素の高さ (= z 値) だけ編集可能
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { createDepthScene, type DepthSceneController } from '~/composables/useDepthScene'

const store = useEditorStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
let controller: DepthSceneController | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!canvasRef.value || !containerRef.value) return

  controller = createDepthScene(canvasRef.value, {
    onSelect(id) { store.selectElement(id) },
    onZChanged(id, z) { store.updateElement(id, { z }) },
  })

  if (store.currentSlide) controller.syncElements(store.currentSlide.elements)
  controller.setSelectedElement(store.selectedElementId)

  resizeObserver = new ResizeObserver(() => controller?.resize())
  resizeObserver.observe(containerRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  controller?.dispose()
  controller = null
})

// スライド切り替え or 要素変更で再同期
watch(
  () => store.currentSlide?.elements.map(e => ({ ...e })),
  (els) => {
    if (controller && els) controller.syncElements(els as never)
  },
  { deep: true },
)

watch(() => store.currentSlideId, () => {
  if (controller && store.currentSlide) controller.syncElements(store.currentSlide.elements)
})

watch(() => store.selectedElementId, (id) => {
  controller?.setSelectedElement(id)
})
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-100 to-slate-200">
    <canvas ref="canvasRef" class="h-full w-full outline-none touch-none" />

    <div class="pointer-events-none absolute left-4 top-4 rounded-md bg-white/90 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
      奥行き編集 (Z 軸のみ)
    </div>
    <div class="pointer-events-none absolute right-4 top-4 max-w-xs rounded-md bg-white/85 px-3 py-2 text-xs text-slate-600 shadow-sm">
      <div class="font-medium text-slate-700">操作</div>
      <ul class="mt-1 list-inside list-disc space-y-0.5 text-slate-500">
        <li>クリック: 要素を選択</li>
        <li>青のギズモ ↔ : Z 位置 (手前/奥) をドラッグ</li>
        <li>右ドラッグ: 視点を少し回転 / ホイール: ズーム</li>
        <li>右パネルのスライダでも編集可</li>
      </ul>
    </div>
    <div class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-white/90 px-3 py-1.5 text-[11px] text-slate-500 shadow-sm">
      スライドを正面斜め上から見下ろし、Z 値で「手前/奥」を表現
    </div>
  </div>
</template>
