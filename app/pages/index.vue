<script setup lang="ts">
import { onMounted } from 'vue'
import { useEditorStore } from '~/stores/editor'
import { createDemoPresentation } from '~/data/demo'
import EditorShell from '~/components/editor/EditorShell.vue'

const store = useEditorStore()

onMounted(() => {
  if (!store.presentation) {
    store.loadPresentation(createDemoPresentation())
  }
})
</script>

<template>
  <ClientOnly>
    <EditorShell v-if="store.presentation" />
    <div v-else class="flex h-full w-full items-center justify-center text-slate-500">
      Loading editor…
    </div>
  </ClientOnly>
</template>
