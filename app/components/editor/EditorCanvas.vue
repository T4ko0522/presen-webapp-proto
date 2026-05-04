<script setup lang="ts">
import { useEditorStore } from '~/stores/editor'
import PlaneEditor from './PlaneEditor.vue'
import DepthEditor from './DepthEditor.vue'

const store = useEditorStore()
</script>

<template>
  <div class="flex h-full w-full items-center justify-center p-6">
    <div class="relative h-full w-full max-w-[1600px]">
      <PlaneEditor v-if="store.mode === 'plane'" />
      <DepthEditor v-else />
    </div>
  </div>
</template>
