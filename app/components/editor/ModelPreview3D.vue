<script setup lang="ts">
/**
 * 3Dモデルの小さな実描画プレビュー
 *
 * 用途:
 * - 2D編集モードで、3Dモデル要素をプレースホルダーではなく実物の3Dモデルで表示
 * - 各インスタンスが独自の Babylon.js Engine + Scene を持つ
 *
 * 性能上の注意:
 * - WebGLコンテキストはブラウザで上限がある (~16) ため、表示する3Dモデル数を抑える運用が前提
 * - プロト段階ではスライド数 × モデル数 が小さい想定で、毎要素に1つ持たせる
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArcRotateCamera,
  Color3, Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Mesh,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'

const props = withDefaults(defineProps<{
  src: string
  /** モデル本体の3D回転 (degrees, x/y/z 軸ごと) */
  rotation?: { x: number, y: number, z: number }
  /** カメラの見る向きプリセット (front/back/left/right/top/bottom)。未指定はデフォルト */
  orientation?: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
}>(), {
  rotation: () => ({ x: 0, y: 0, z: 0 }),
  orientation: 'front',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
let engine: Engine | null = null
let scene: Scene | null = null
/** 外側: 位置とスケールを担当 */
let positionWrapper: TransformNode | null = null
/** 内側: モデル本体の回転を担当（モデル中心が pivot） */
let rotationContainer: TransformNode | null = null
let loadToken = 0

onMounted(() => {
  if (!canvasRef.value) return
  engine = new Engine(canvasRef.value, true, { stencil: false, antialias: true, premultipliedAlpha: false, alpha: true })
  scene = new Scene(engine)
  scene.clearColor = new Color4(0, 0, 0, 0)  // 透過背景

  const ang = orientationToAlphaBeta(props.orientation)
  const camera = new ArcRotateCamera('cam', ang.alpha, ang.beta, 3, Vector3.Zero(), scene)
  camera.minZ = 0.05
  camera.lowerRadiusLimit = 1.5
  camera.upperRadiusLimit = 8

  new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene).intensity = 0.65

  const dir = new DirectionalLight('dir', new Vector3(-0.3, -0.8, -0.4), scene)
  dir.position = new Vector3(2, 5, 3)
  dir.intensity = 0.85

  loadModel()

  engine.runRenderLoop(() => scene?.render())
})

watch(() => props.src, () => loadModel())

watch(() => [props.rotation.x, props.rotation.y, props.rotation.z], () => applyRotation(), { deep: true })

function applyRotation() {
  if (!rotationContainer) return
  const r = props.rotation
  rotationContainer.rotation.x = (r.x * Math.PI) / 180
  rotationContainer.rotation.y = (r.y * Math.PI) / 180
  rotationContainer.rotation.z = (r.z * Math.PI) / 180
}

function orientationToAlphaBeta(o: NonNullable<typeof props.orientation>) {
  switch (o) {
    case 'front':  return { alpha: Math.PI / 2 - 0.4, beta: Math.PI / 2 - 0.3 }
    case 'back':   return { alpha: -Math.PI / 2 - 0.4, beta: Math.PI / 2 - 0.3 }
    case 'left':   return { alpha: 0, beta: Math.PI / 2 - 0.3 }
    case 'right':  return { alpha: Math.PI, beta: Math.PI / 2 - 0.3 }
    case 'top':    return { alpha: Math.PI / 2, beta: 0.05 }
    case 'bottom': return { alpha: Math.PI / 2, beta: Math.PI - 0.05 }
  }
}

function loadModel() {
  if (!scene) return

  // 既存モデルを破棄
  if (positionWrapper) {
    positionWrapper.dispose(false)
    positionWrapper = null
    rotationContainer = null
  }

  const myToken = ++loadToken
  const url = props.src
  if (!url) return

  SceneLoader.ImportMeshAsync('', '', url, scene)
    .then(result => {
      if (myToken !== loadToken || !scene) {
        result.meshes.forEach(m => m.dispose())
        return
      }
      // 二段構成: position/scale 用の外側 と モデル中心ピボットの内側
      const wrapper = new TransformNode('preview_wrapper', scene)
      const inner = new TransformNode('preview_inner', scene)
      inner.parent = wrapper

      const meshes: Mesh[] = []
      result.meshes.forEach(m => {
        if (!m.parent) m.parent = inner
        if (m instanceof Mesh) meshes.push(m)
      })

      // バウンディングを集約
      let min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
      let max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)
      meshes.forEach(m => {
        m.computeWorldMatrix(true)
        const bb = m.getBoundingInfo().boundingBox
        min = Vector3.Minimize(min, bb.minimumWorld)
        max = Vector3.Maximize(max, bb.maximumWorld)
      })
      const size = max.subtract(min)
      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const targetMax = 1.4
      const scale = targetMax / maxDim

      // 内側: モデルの中心が inner の local 原点に来るよう meshes をオフセット
      const center = min.add(size.scale(0.5))
      inner.position = new Vector3(-center.x, -center.y, -center.z)

      // 外側: スケールのみ。位置は (0,0,0) (シーン中央)
      wrapper.scaling.setAll(scale)

      positionWrapper = wrapper
      rotationContainer = inner
      applyRotation()
    })
    .catch(err => {
      console.warn('[model-preview] load failed:', url, err)
    })
}

onBeforeUnmount(() => {
  loadToken++
  if (positionWrapper) {
    positionWrapper.dispose(false)
    positionWrapper = null
    rotationContainer = null
  }
  engine?.stopRenderLoop()
  scene?.dispose()
  engine?.dispose()
  engine = null
  scene = null
})
</script>

<template>
  <canvas ref="canvasRef" class="block h-full w-full outline-none" />
</template>
