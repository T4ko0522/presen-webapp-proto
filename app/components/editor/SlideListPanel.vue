<script setup lang="ts">
import { useEditorStore } from '~/stores/editor'
import SlideThumbnail from './SlideThumbnail.vue'

const store = useEditorStore()
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Slides</span>
      <button
        class="rounded-md border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50"
        @click="store.addSlide()"
      >
        + 追加
      </button>
    </div>
    <div class="flex-1 overflow-y-auto px-3 py-3">
      <ol class="flex flex-col gap-3">
        <li
          v-for="(slide, idx) in store.presentation?.slides ?? []"
          :key="slide.id"
        >
          <button
            class="group relative w-full rounded-md border-2 transition"
            :class="store.currentSlideId === slide.id
              ? 'border-sky-500 ring-2 ring-sky-200'
              : 'border-slate-200 hover:border-slate-300'"
            @click="store.selectSlide(slide.id)"
          >
            <div class="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-white shadow">
              {{ idx + 1 }}
            </div>
            <SlideThumbnail :slide="slide" />
            <button
              v-if="(store.presentation?.slides.length ?? 0) > 1"
              class="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] text-slate-500 opacity-0 shadow ring-1 ring-slate-200 transition hover:bg-red-500 hover:text-white group-hover:opacity-100"
              title="削除"
              @click.stop="store.removeSlide(slide.id)"
            >
              ×
            </button>
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>
