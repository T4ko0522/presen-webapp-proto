<script setup lang="ts">
import { computed } from 'vue'
import type { Slide, SlideElement } from '~/domain/presentation'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '~/domain/presentation'

const props = defineProps<{
  slide: Slide
}>()

const ratio = computed(() => SLIDE_HEIGHT / SLIDE_WIDTH)

// PlaneEditor と同様: Z 値ソート + model は常に最前面
const sortedElements = computed<SlideElement[]>(() => {
  return [...props.slide.elements].sort((a, b) => {
    if (a.type === 'model' && b.type !== 'model') return 1
    if (a.type !== 'model' && b.type === 'model') return -1
    return a.z - b.z
  })
})

function elStyle(el: SlideElement) {
  return {
    left: `${(el.x / SLIDE_WIDTH) * 100}%`,
    top: `${(el.y / SLIDE_HEIGHT) * 100}%`,
    width: `${(el.width / SLIDE_WIDTH) * 100}%`,
    height: `${(el.height / SLIDE_HEIGHT) * 100}%`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    transformOrigin: 'center',
  }
}
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded"
    :style="{ paddingTop: `${ratio * 100}%`, background: slide.background, containerType: 'inline-size' }"
  >
    <div class="absolute inset-0">
      <div
        v-for="el in sortedElements"
        :key="el.id"
        class="absolute"
        :style="elStyle(el)"
      >
        <template v-if="el.type === 'text'">
          <span
            class="block w-full overflow-hidden whitespace-pre-line leading-tight"
            :style="{
              color: el.fontColor,
              fontSize: `${(el.fontSize / SLIDE_WIDTH) * 100 * 1.5}cqw`,
              fontWeight: el.fontWeight,
              textAlign: el.textAlign,
              fontFamily: el.fontFamily,
            }"
          >{{ el.content }}</span>
        </template>
        <template v-else-if="el.type === 'shape'">
          <div
            class="h-full w-full"
            :style="{
              background: el.fillColor,
              borderRadius: el.shape === 'ellipse' ? '50%' : '2px',
            }"
          />
        </template>
        <template v-else-if="el.type === 'image'">
          <img :src="el.src" class="h-full w-full object-cover" :alt="el.alt ?? ''" />
        </template>
        <template v-else-if="el.type === 'model'">
          <div class="flex h-full w-full items-center justify-center rounded border border-dashed border-slate-400 bg-slate-200/60 text-[8px] text-slate-500">
            3D
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
