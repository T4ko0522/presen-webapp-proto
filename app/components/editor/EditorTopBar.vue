<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore, type EditorMode } from '~/stores/editor'
import { createId, type SlideElement } from '~/domain/presentation'

const store = useEditorStore()

const modeLabel = computed(() => store.mode === 'plane' ? 'X / Y 編集モード' : 'Z (奥行き) 編集モード')

function setMode(mode: EditorMode) {
  store.setMode(mode)
}

function addText() {
  const el: SlideElement = {
    id: createId('text'),
    type: 'text',
    x: 200, y: 200, z: 0,
    width: 400, height: 80,
    rotation: 0,
    content: 'テキストを入力',
    fontSize: 28,
    fontColor: '#1f2937',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 'normal',
    textAlign: 'left',
  }
  store.addElement(el)
}

function addRect() {
  const el: SlideElement = {
    id: createId('shape'),
    type: 'shape',
    x: 200, y: 200, z: 0,
    width: 280, height: 160,
    rotation: 0,
    shape: 'rectangle',
    fillColor: '#38bdf8',
    strokeColor: 'transparent',
    strokeWidth: 0,
  }
  store.addElement(el)
}

function addEllipse() {
  const el: SlideElement = {
    id: createId('shape'),
    type: 'shape',
    x: 220, y: 220, z: 0,
    width: 220, height: 220,
    rotation: 0,
    shape: 'ellipse',
    fillColor: '#fb923c',
    strokeColor: 'transparent',
    strokeWidth: 0,
  }
  store.addElement(el)
}

const fileInput = ref<HTMLInputElement | null>(null)

function pickModelFile() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  const el: SlideElement = {
    id: createId('model'),
    type: 'model',
    x: 360, y: 220, z: 0,
    width: 320, height: 240,
    rotation: 0,
    assetId: url,
    src: url,
    displayName: file.name,
  }
  store.addElement(el)
  target.value = ''
}

const SAMPLES = [
  { src: '/samples/duck.glb', name: 'サンプル: Duck' },
  { src: '/samples/avocado.glb', name: 'サンプル: Avocado' },
] as const

function addSample(sample: typeof SAMPLES[number]) {
  const el: SlideElement = {
    id: createId('model'),
    type: 'model',
    x: 360, y: 220, z: 0,
    width: 320, height: 240,
    rotation: 0,
    assetId: sample.src,
    src: sample.src,
    displayName: sample.name,
  }
  store.addElement(el)
  sampleMenuOpen.value = false
}

const sampleMenuOpen = ref(false)
</script>

<template>
  <header class="flex h-12 items-center gap-2 border-b border-slate-200 bg-white px-4">
    <div class="text-sm font-semibold text-slate-700">Presen Editor</div>
    <div class="text-xs text-slate-400">{{ store.presentation?.title }}</div>

    <div class="ml-6 flex items-center gap-1 rounded-md bg-slate-100 p-1 text-xs">
      <button
        class="rounded px-3 py-1 transition"
        :class="store.mode === 'plane' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-900'"
        @click="setMode('plane')"
      >
        2D 編集 (X, Y)
      </button>
      <button
        class="rounded px-3 py-1 transition"
        :class="store.mode === 'depth' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-900'"
        @click="setMode('depth')"
      >
        3D 編集 (Z)
      </button>
    </div>

    <div class="ml-2 text-xs text-slate-400">{{ modeLabel }}</div>

    <div class="ml-auto flex items-center gap-2">
      <div class="flex items-center gap-1 text-xs">
        <button class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50" @click="addText">+ テキスト</button>
        <button class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50" @click="addRect">+ 矩形</button>
        <button class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50" @click="addEllipse">+ 楕円</button>
        <button class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50" @click="pickModelFile">+ 3Dモデル (.glb)</button>
        <input ref="fileInput" type="file" accept=".glb,.gltf" class="hidden" @change="onFileChange" />
        <div class="relative">
          <button
            class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50"
            @click="sampleMenuOpen = !sampleMenuOpen"
          >+ サンプル ▾</button>
          <div
            v-if="sampleMenuOpen"
            class="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          >
            <button
              v-for="s in SAMPLES"
              :key="s.src"
              class="block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"
              @click="addSample(s)"
            >{{ s.name }}</button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-1 text-xs">
        <button
          class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          :disabled="!store.canUndo"
          @click="store.undo()"
        >Undo</button>
        <button
          class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50 disabled:opacity-40"
          :disabled="!store.canRedo"
          @click="store.redo()"
        >Redo</button>
      </div>
    </div>
  </header>
</template>
