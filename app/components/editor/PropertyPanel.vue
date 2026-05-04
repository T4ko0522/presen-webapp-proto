<script setup lang="ts">
import { computed } from 'vue'
import { useEditorStore } from '~/stores/editor'
import type { SlideElement, TextElement, ShapeElement, ModelElement } from '~/domain/presentation'
import { Z_RANGE } from '~/domain/presentation'

const store = useEditorStore()
const el = computed(() => store.selectedElement)

const isPlane = computed(() => store.mode === 'plane')

function update(patch: Partial<SlideElement>) {
  if (!el.value) return
  store.updateElement(el.value.id, patch)
}

function asNum(v: string | number): number {
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : 0
}

function deleteElement() {
  if (!el.value) return
  store.removeElement(el.value.id)
}

function bringForward() {
  if (!el.value) return
  update({ z: Math.min(Z_RANGE.max, el.value.z + 20) })
}
function sendBackward() {
  if (!el.value) return
  update({ z: Math.max(Z_RANGE.min, el.value.z - 20) })
}

function getModelRot(target: SlideElement, axis: 'x' | 'y' | 'z'): number {
  if (target.type !== 'model') return 0
  return target.modelRotation?.[axis] ?? 0
}

function updateModelRot(target: SlideElement, axis: 'x' | 'y' | 'z', value: number) {
  if (target.type !== 'model') return
  const current = target.modelRotation ?? { x: 0, y: 0, z: 0 }
  store.updateElement(target.id, {
    modelRotation: { ...current, [axis]: value },
  } as Partial<SlideElement>)
}

function resetModelRot(target: SlideElement) {
  if (target.type !== 'model') return
  store.updateElement(target.id, {
    modelRotation: { x: 0, y: 0, z: 0 },
  } as Partial<SlideElement>)
}

const slide = computed(() => store.currentSlide)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-slate-200 px-4 py-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Properties</span>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4">
      <!-- 何も選択していないとき: スライド全体のプロパティ -->
      <template v-if="!el && slide">
        <div class="text-xs text-slate-500">スライド設定</div>
        <div class="mt-3 space-y-3">
          <label class="block">
            <span class="text-xs text-slate-600">背景色</span>
            <div class="mt-1 flex items-center gap-2">
              <input
                type="color"
                class="h-8 w-10 cursor-pointer rounded border border-slate-200"
                :value="slide.background"
                @input="(e) => slide && (slide.background = (e.target as HTMLInputElement).value)"
              />
              <input
                type="text"
                class="h-8 flex-1 rounded border border-slate-200 px-2 text-xs"
                :value="slide.background"
                @input="(e) => slide && (slide.background = (e.target as HTMLInputElement).value)"
              />
            </div>
          </label>
          <label class="block">
            <span class="text-xs text-slate-600">カンペ (発表者ノート)</span>
            <textarea
              class="mt-1 h-24 w-full resize-none rounded border border-slate-200 px-2 py-1 text-xs"
              :value="slide.notes"
              @input="(e) => slide && (slide.notes = (e.target as HTMLTextAreaElement).value)"
            />
          </label>
        </div>
        <p class="mt-6 text-xs text-slate-400">要素を選択すると個別プロパティが表示されます。</p>
      </template>

      <!-- 要素選択中 -->
      <template v-else-if="el">
        <div class="flex items-center justify-between">
          <div class="text-xs text-slate-500">{{ ({ text: 'テキスト', shape: '図形', image: '画像', model: '3Dモデル' } as Record<string,string>)[el.type] }}</div>
          <button class="text-xs text-red-500 hover:underline" @click="deleteElement">削除</button>
        </div>

        <!-- 共通: Position -->
        <section class="mt-4">
          <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Transform</div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">X</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                :disabled="!isPlane"
                :value="el.x" @input="(e) => update({ x: asNum((e.target as HTMLInputElement).value) })" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">Y</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                :disabled="!isPlane"
                :value="el.y" @input="(e) => update({ y: asNum((e.target as HTMLInputElement).value) })" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">幅</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                :disabled="!isPlane"
                :value="el.width" @input="(e) => update({ width: asNum((e.target as HTMLInputElement).value) })" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">高さ</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                :disabled="!isPlane"
                :value="el.height" @input="(e) => update({ height: asNum((e.target as HTMLInputElement).value) })" />
            </label>
            <label class="col-span-2 flex flex-col gap-1">
              <span class="text-slate-500">回転 (deg)</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1 disabled:bg-slate-50 disabled:text-slate-400"
                :disabled="!isPlane"
                :value="el.rotation" @input="(e) => update({ rotation: asNum((e.target as HTMLInputElement).value) })" />
            </label>
          </div>
        </section>

        <!-- Z (奥行き) - 3Dモードでのみ編集可能 -->
        <section class="mt-5 rounded-md border bg-slate-50 p-3"
          :class="!isPlane ? 'border-sky-300 bg-sky-50/60' : 'border-slate-200'">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wider"
              :class="!isPlane ? 'text-sky-700' : 'text-slate-400'">奥行き (Z)</span>
            <span class="text-xs font-mono"
              :class="!isPlane ? 'text-sky-700' : 'text-slate-500'">{{ el.z }}</span>
          </div>
          <input
            type="range"
            :min="Z_RANGE.min" :max="Z_RANGE.max" step="5"
            class="w-full disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="isPlane"
            :value="el.z"
            @input="(e) => update({ z: asNum((e.target as HTMLInputElement).value) })"
          />
          <div class="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>奥</span>
            <span>手前</span>
          </div>
          <div v-if="!isPlane" class="mt-2 grid grid-cols-2 gap-2">
            <button class="rounded border border-sky-200 bg-white py-1 text-xs text-sky-700 hover:bg-sky-50"
              @click="sendBackward">奥へ -20</button>
            <button class="rounded border border-sky-200 bg-white py-1 text-xs text-sky-700 hover:bg-sky-50"
              @click="bringForward">手前へ +20</button>
          </div>
          <p v-else class="mt-2 text-[11px] text-slate-400">3D 編集モードで Z を調整できます</p>
        </section>

        <!-- 個別: Text -->
        <section v-if="el.type === 'text'" class="mt-5 space-y-3 text-xs">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Text</div>
          <label class="block">
            <span class="text-slate-500">テキスト</span>
            <textarea
              class="mt-1 h-20 w-full resize-none rounded border border-slate-200 px-2 py-1"
              :value="(el as TextElement).content"
              @input="(e) => update({ content: (e.target as HTMLTextAreaElement).value })"
            />
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">フォントサイズ</span>
              <input type="number" class="rounded border border-slate-200 px-2 py-1"
                :value="(el as TextElement).fontSize"
                @input="(e) => update({ fontSize: asNum((e.target as HTMLInputElement).value) })" />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-slate-500">太さ</span>
              <select class="rounded border border-slate-200 px-2 py-1"
                :value="(el as TextElement).fontWeight"
                @change="(e) => update({ fontWeight: (e.target as HTMLSelectElement).value as 'normal' | 'bold' })">
                <option value="normal">Regular</option>
                <option value="bold">Bold</option>
              </select>
            </label>
          </div>
          <label class="flex flex-col gap-1">
            <span class="text-slate-500">配置</span>
            <select class="rounded border border-slate-200 px-2 py-1"
              :value="(el as TextElement).textAlign"
              @change="(e) => update({ textAlign: (e.target as HTMLSelectElement).value as 'left' | 'center' | 'right' })">
              <option value="left">左</option>
              <option value="center">中央</option>
              <option value="right">右</option>
            </select>
          </label>
          <label class="block">
            <span class="text-slate-500">文字色</span>
            <div class="mt-1 flex items-center gap-2">
              <input type="color" class="h-8 w-10 cursor-pointer rounded border border-slate-200"
                :value="(el as TextElement).fontColor"
                @input="(e) => update({ fontColor: (e.target as HTMLInputElement).value })" />
              <input type="text" class="h-8 flex-1 rounded border border-slate-200 px-2"
                :value="(el as TextElement).fontColor"
                @input="(e) => update({ fontColor: (e.target as HTMLInputElement).value })" />
            </div>
          </label>
        </section>

        <!-- 個別: Shape -->
        <section v-else-if="el.type === 'shape'" class="mt-5 space-y-3 text-xs">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Shape</div>
          <label class="block">
            <span class="text-slate-500">塗りつぶし</span>
            <div class="mt-1 flex items-center gap-2">
              <input type="color" class="h-8 w-10 cursor-pointer rounded border border-slate-200"
                :value="(el as ShapeElement).fillColor"
                @input="(e) => update({ fillColor: (e.target as HTMLInputElement).value })" />
              <input type="text" class="h-8 flex-1 rounded border border-slate-200 px-2"
                :value="(el as ShapeElement).fillColor"
                @input="(e) => update({ fillColor: (e.target as HTMLInputElement).value })" />
            </div>
          </label>
        </section>

        <!-- 個別: Model -->
        <section v-else-if="el.type === 'model'" class="mt-5 space-y-3 text-xs">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">3D Model</div>
          <label class="block">
            <span class="text-slate-500">表示名</span>
            <input type="text" class="mt-1 w-full rounded border border-slate-200 px-2 py-1"
              :value="(el as ModelElement).displayName"
              @input="(e) => update({ displayName: (e.target as HTMLInputElement).value })" />
          </label>
          <div class="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
            ファイル: {{ (el as ModelElement).src.split('/').pop() }}
          </div>

          <!-- モデル本体の3D回転 -->
          <div class="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">モデルの向き (3D 回転)</div>
            <div class="space-y-2">
              <label v-for="axis in (['x','y','z'] as const)" :key="axis" class="block">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-[11px] uppercase text-slate-500">{{ axis }}</span>
                  <span class="font-mono text-[11px] text-slate-600">{{ getModelRot(el, axis) }}°</span>
                </div>
                <input
                  type="range" min="-180" max="180" step="1"
                  class="w-full"
                  :value="getModelRot(el, axis)"
                  @input="(e) => updateModelRot(el, axis, asNum((e.target as HTMLInputElement).value))"
                />
              </label>
            </div>
            <button
              class="mt-2 w-full rounded border border-slate-200 bg-white py-1 text-[11px] text-slate-600 hover:bg-slate-50"
              @click="resetModelRot(el)"
            >向きをリセット</button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
