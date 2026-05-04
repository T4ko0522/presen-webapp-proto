<script setup lang="ts">
import { useEditorStore } from '~/stores/editor'
import EditorTopBar from './EditorTopBar.vue'
import SlideListPanel from './SlideListPanel.vue'
import EditorCanvas from './EditorCanvas.vue'
import PropertyPanel from './PropertyPanel.vue'

const store = useEditorStore()
</script>

<template>
  <div class="flex h-screen w-screen flex-col bg-slate-100 text-slate-900">
    <EditorTopBar />
    <div class="flex flex-1 min-h-0">
      <aside class="w-56 shrink-0 border-r border-slate-200 bg-white">
        <SlideListPanel />
      </aside>
      <main class="flex-1 min-w-0 bg-slate-100">
        <EditorCanvas v-if="store.currentSlide" :key="store.currentSlide.id + '-' + store.mode" />
      </main>
      <aside class="w-72 shrink-0 border-l border-slate-200 bg-white">
        <PropertyPanel />
      </aside>
    </div>
  </div>
</template>
