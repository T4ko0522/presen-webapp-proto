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
  /** 要素のピクセル幅 (3D編集側と同じ fit ロジックでサイズ感を一致させるために必要) */
  width?: number
  /** 要素のピクセル高さ */
  height?: number
}>(), {
  rotation: () => ({ x: 0, y: 0, z: 0 }),
  orientation: 'front',
  width: 360,
  height: 240,
})

// useDepthScene と同じ単位系
const PX_PER_UNIT = 100

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
  // useDepthScene と同じ世界スケールで見えるよう、要素サイズに合わせてカメラ距離を計算
  const radius = computeCameraRadius()
  const camera = new ArcRotateCamera('cam', ang.alpha, ang.beta, radius, Vector3.Zero(), scene)
  camera.minZ = 0.01
  camera.lowerRadiusLimit = radius * 0.4
  camera.upperRadiusLimit = radius * 4

  new HemisphericLight('hemi', new Vector3(0, 1, 0.2), scene).intensity = 0.65

  const dir = new DirectionalLight('dir', new Vector3(-0.3, -0.8, -0.4), scene)
  dir.position = new Vector3(2, 5, 3)
  dir.intensity = 0.85

  loadModel()

  engine.runRenderLoop(() => scene?.render())
})

watch(() => props.src, () => loadModel())

watch(() => [props.rotation.x, props.rotation.y, props.rotation.z], () => applyRotation(), { deep: true })

// 要素サイズ変更時、カメラ距離と fit スケールを再計算
watch(() => [props.width, props.height], () => {
  if (!scene) return
  const cam = scene.activeCamera as ArcRotateCamera | null
  if (cam && 'radius' in cam) {
    const r = computeCameraRadius()
    cam.radius = r
    cam.lowerRadiusLimit = r * 0.4
    cam.upperRadiusLimit = r * 4
  }
  applyFitScale()
})

function applyFitScale() {
  if (!positionWrapper) return
  // 既存のバウンディング情報からスケールだけ再計算
  const widthU = Math.max(0.5, props.width / PX_PER_UNIT)
  const heightU = Math.max(0.5, props.height / PX_PER_UNIT)
  const targetMax = Math.min(widthU, heightU) * 0.95
  // バウンディングは計算済みではないが、wrapper.scaling だけ再フィットすると
  // 元のモデル長辺は (targetMax_old / scale_old) なので不変
  // → 比率で更新する: new_scale = old_scale * (targetMax_new / targetMax_old)
  // 単純化: (現在のスケール) と (現在のサイズに対する targetMax) を保持して比較
  const currentTargetMax = (positionWrapper.metadata as { targetMax?: number } | null)?.targetMax ?? targetMax
  const currentScale = positionWrapper.scaling.x
  const newScale = currentScale * (targetMax / currentTargetMax)
  positionWrapper.scaling.setAll(newScale)
  positionWrapper.metadata = { targetMax }
}

function applyRotation() {
  if (!rotationContainer) return
  const r = props.rotation
  rotationContainer.rotation.x = (r.x * Math.PI) / 180
  rotationContainer.rotation.y = (r.y * Math.PI) / 180
  rotationContainer.rotation.z = (r.z * Math.PI) / 180
}

/**
 * 要素サイズ (px) と Babylon の FOV に基づき、カメラ距離を算出する。
 * 視野の縦方向が要素の高さ (heightU) ぴったりになる距離にすると、
 * 「世界 1 ユニット = canvas 上の 1 同等 px ピクセル数」が両エディタで一致する。
 */
function computeCameraRadius(): number {
  const heightU = Math.max(0.5, props.height / PX_PER_UNIT)
  const fov = 0.8  // Babylon ArcRotateCamera のデフォルト FOV (rad, vertical)
  return heightU / (2 * Math.tan(fov / 2))
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
      // 短辺ベースの MIN-fit: モデルの長辺が要素の短辺に収まるように
      // (MAX-fit だとアスペクト比が異なる場合に短辺方向で見切れるため)
      const widthU = Math.max(0.5, props.width / PX_PER_UNIT)
      const heightU = Math.max(0.5, props.height / PX_PER_UNIT)
      const targetMax = Math.min(widthU, heightU) * 0.95
      const scale = targetMax / maxDim

      // 内側: モデルの中心が inner の local 原点に来るよう meshes をオフセット
      const center = min.add(size.scale(0.5))
      inner.position = new Vector3(-center.x, -center.y, -center.z)

      // 外側: スケールのみ。位置は (0,0,0) (シーン中央)
      wrapper.scaling.setAll(scale)
      // 後で size 変更時にスケールを再計算するため、現在の targetMax を保存
      wrapper.metadata = { targetMax }

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
