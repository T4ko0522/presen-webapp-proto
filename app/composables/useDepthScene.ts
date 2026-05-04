/**
 * 3D編集モード用の Babylon.js シーン
 *
 * 設計:
 * - スライドは「縦の平面 (壁)」として配置 (XY 平面、Z=0、法線 +Z)
 * - 各要素は元の x, y, w, h を保ちつつ、要素の z 値を 3D 空間の Z (奥行き) に対応させる
 *   - z = 0   → スライド面に貼り付き
 *   - z > 0   → スライドから「手前」(カメラ側) に浮き出す
 *   - z < 0   → スライドから「奥」に沈む
 * - カメラはスライドの正面、少しだけ上から斜めに見下ろす角度で固定 (ユーザー操作で多少回転可)
 * - 3D モデル (.glb) は実際の 3D メッシュとして描画される。スライドから手前/奥に立体的に飛び出す
 * - Z 軸ギズモのみ有効。要素の手前/奥 (= 元の z 値) だけを編集できる
 *
 * 座標変換 (slide → world):
 *   world.x =   (el.x + el.w/2 - SLIDE_W/2) / PX_PER_UNIT
 *   world.y = -((el.y + el.h/2 - SLIDE_H/2) / PX_PER_UNIT)   (slide y は下向き、world y は上向き)
 *   world.z =   el.z / PX_PER_UNIT                            (手前 = +Z = カメラ寄り)
 */

import {
  ArcRotateCamera,
  Color3, Color4,
  CreateGround, CreatePlane,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GizmoManager,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  Scene,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from '@babylonjs/core'
import '@babylonjs/loaders/glTF'
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader'
import type { SlideElement } from '~/domain/presentation'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '~/domain/presentation'

const PX_PER_UNIT = 100
const SLIDE_W = SLIDE_WIDTH / PX_PER_UNIT   // 12.8
const SLIDE_H = SLIDE_HEIGHT / PX_PER_UNIT  // 7.2

export interface DepthSceneCallbacks {
  onSelect(elementId: string | null): void
  onZChanged(elementId: string, z: number): void
}

export interface DepthSceneController {
  syncElements(elements: SlideElement[]): void
  setSelectedElement(id: string | null): void
  resize(): void
  dispose(): void
}

interface MeshRecord {
  pickRoot: Mesh
  elementType: SlideElement['type']
  baseX: number
  baseY: number
  materialKey: string
  modelLoadToken: number
  /** model 要素のとき、回転を適用する内側 TransformNode */
  modelInner: TransformNode | null
}

export function createDepthScene(canvas: HTMLCanvasElement, cb: DepthSceneCallbacks): DepthSceneController {
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: true, antialias: true })
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.94, 0.95, 0.97, 1)

  // ---------- カメラ ----------
  // スライド (XY 平面, 法線 +Z) の正面、少しだけ上から見下ろす
  // alpha = +π/2 で カメラを +Z 方向 (スライドの正面) に置く
  // beta < π/2 で カメラを少し上に持ち上げ、見下ろす角度にする
  const camera = new ArcRotateCamera(
    'camera',
    Math.PI / 2 + 0.18,    // alpha: ほぼ正面、わずかに +X 側からの斜め
    Math.PI / 2 - 0.45,    // beta: 水平より少し上 (約 25° 見下ろす)
    14.5,                  // radius
    new Vector3(0, 0, 0),
    scene,
  )
  camera.attachControl(canvas, true)
  camera.wheelPrecision = 30
  camera.panningSensibility = 80
  camera.lowerBetaLimit = 0.3
  camera.upperBetaLimit = Math.PI / 2 + 0.1  // 真横 ~ 真上の手前まで
  camera.lowerRadiusLimit = 6
  camera.upperRadiusLimit = 40
  camera.minZ = 0.05
  // alpha: 正面まわりだけに制限して、後ろから見ないようにする
  camera.lowerAlphaLimit = Math.PI / 2 - 0.6
  camera.upperAlphaLimit = Math.PI / 2 + 0.6

  // ---------- ライト ----------
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0.3), scene)
  hemi.intensity = 0.55
  hemi.groundColor = new Color3(0.85, 0.88, 0.92)

  // ディレクショナルライト: カメラ側上方から
  const dir = new DirectionalLight('dir', new Vector3(-0.25, -0.7, -0.6), scene)
  dir.position = new Vector3(5, 8, 8)
  dir.intensity = 0.85

  const shadowGen = new ShadowGenerator(2048, dir)
  shadowGen.usePoissonSampling = true
  shadowGen.darkness = 0.55
  shadowGen.bias = 0.0008

  // ---------- スライド (縦) 本体 ----------
  // CreatePlane: XY 平面、法線 +Z
  // 半透明にして、Z<0 の要素 (奥側) もカメラから見えるようにする
  const stage = MeshBuilder.CreatePlane('slide_stage', {
    width: SLIDE_W,
    height: SLIDE_H,
    sideOrientation: Mesh.DOUBLESIDE,
  }, scene)
  stage.position = new Vector3(0, 0, 0)
  const stageMat = new StandardMaterial('stageMat', scene)
  stageMat.diffuseColor = new Color3(1, 1, 1)
  stageMat.alpha = 0.35
  stageMat.specularColor = new Color3(0, 0, 0)
  stageMat.backFaceCulling = false
  stage.material = stageMat
  stage.receiveShadows = true
  stage.isPickable = false

  // スライドの枠線
  const border = MeshBuilder.CreateLines('border', {
    points: [
      new Vector3(-SLIDE_W / 2, -SLIDE_H / 2, 0.001),
      new Vector3(SLIDE_W / 2, -SLIDE_H / 2, 0.001),
      new Vector3(SLIDE_W / 2, SLIDE_H / 2, 0.001),
      new Vector3(-SLIDE_W / 2, SLIDE_H / 2, 0.001),
      new Vector3(-SLIDE_W / 2, -SLIDE_H / 2, 0.001),
    ],
  }, scene)
  border.color = new Color3(0.5, 0.6, 0.85)
  border.isPickable = false

  // 床 (スライドの下に薄く広がる) — 影や接地感のため
  const floor = CreateGround('floor', { width: 30, height: 30, subdivisions: 1 }, scene)
  floor.position.y = -SLIDE_H / 2 - 0.02
  const floorMat = new StandardMaterial('floorMat', scene)
  floorMat.diffuseColor = new Color3(0.93, 0.94, 0.97)
  floorMat.specularColor = new Color3(0, 0, 0)
  floor.material = floorMat
  floor.receiveShadows = true
  floor.isPickable = false

  // 床のグリッド線 (浅め)
  const gridLines: Vector3[][] = []
  const gridSize = 12
  for (let i = -gridSize; i <= gridSize; i++) {
    gridLines.push([
      new Vector3(i, -SLIDE_H / 2 - 0.015, -gridSize),
      new Vector3(i, -SLIDE_H / 2 - 0.015, gridSize),
    ])
    gridLines.push([
      new Vector3(-gridSize, -SLIDE_H / 2 - 0.015, i),
      new Vector3(gridSize, -SLIDE_H / 2 - 0.015, i),
    ])
  }
  const grid = MeshBuilder.CreateLineSystem('grid', { lines: gridLines }, scene)
  grid.color = new Color3(0.78, 0.82, 0.9)
  grid.alpha = 0.5
  grid.isPickable = false

  // ---------- ギズモ (Z 軸 = 要素の手前/奥) ----------
  const gizmoManager = new GizmoManager(scene)
  gizmoManager.positionGizmoEnabled = true
  gizmoManager.rotationGizmoEnabled = false
  gizmoManager.scaleGizmoEnabled = false
  gizmoManager.usePointerToAttachGizmos = false
  if (gizmoManager.gizmos.positionGizmo) {
    gizmoManager.gizmos.positionGizmo.xGizmo.isEnabled = false
    gizmoManager.gizmos.positionGizmo.yGizmo.isEnabled = false
    gizmoManager.gizmos.positionGizmo.zGizmo.isEnabled = true
    gizmoManager.gizmos.positionGizmo.snapDistance = 0.05
    gizmoManager.gizmos.positionGizmo.zGizmo.scaleRatio = 1.4
  }

  // ---------- 座標変換 ----------
  // Babylon LH の ArcRotateCamera を +Z 側に置くと camera の right vector が -X 方向に向く
  // (= world +X が画面 LEFT に出る) ため、world.x を反転して 2D エディタと同じ L/R 関係にする
  function toWorld(el: SlideElement, orderTieBreaker = 0) {
    const cx = (el.x + el.width / 2) - SLIDE_WIDTH / 2
    const cy = (el.y + el.height / 2) - SLIDE_HEIGHT / 2
    return {
      x: -cx / PX_PER_UNIT,
      y: -cy / PX_PER_UNIT,         // スライド y (下向き) → world y (上向き)
      z: el.z / PX_PER_UNIT + orderTieBreaker,
    }
  }

  // ---------- マテリアル ----------
  function elementMaterialKey(el: SlideElement): string {
    if (el.type === 'text') {
      return `text|${el.content}|${el.fontSize}|${el.fontColor}|${el.fontFamily}|${el.fontWeight}|${el.textAlign}|${el.width}x${el.height}`
    }
    if (el.type === 'shape') {
      return `shape|${el.shape}|${el.fillColor}|${el.width}x${el.height}`
    }
    if (el.type === 'image') {
      return `image|${el.src}|${el.width}x${el.height}`
    }
    return `model|${el.src}|${el.width}x${el.height}`
  }

  function buildTextTexture(el: Extract<SlideElement, { type: 'text' }>): DynamicTexture {
    const w = Math.max(64, Math.round(el.width * 2))
    const h = Math.max(64, Math.round(el.height * 2))
    const tex = new DynamicTexture('text_' + el.id, { width: w, height: h }, scene, false)
    tex.hasAlpha = true
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, w, h)
    // canvas 上で 180° 回転して描く: BACKSIDE で +Z 側から見たとき正しい向きで見える
    ctx.save()
    ctx.translate(w, h)
    ctx.scale(-1, -1)
    ctx.fillStyle = el.fontColor
    const fontSize = el.fontSize * 2
    ctx.font = `${el.fontWeight} ${fontSize}px ${el.fontFamily}`
    ctx.textBaseline = 'top'
    const align = el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'right' : 'left'
    ctx.textAlign = align as CanvasTextAlign
    const x = align === 'center' ? w / 2 : align === 'right' ? w - 8 : 8
    const lines = el.content.split('\n')
    lines.forEach((line, i) => {
      ctx.fillText(line, x, i * (fontSize * 1.15) + 4)
    })
    ctx.restore()
    tex.update(false)
    return tex
  }

  function buildShapeTexture(el: Extract<SlideElement, { type: 'shape' }>): DynamicTexture {
    const w = Math.max(64, Math.round(el.width))
    const h = Math.max(64, Math.round(el.height))
    const tex = new DynamicTexture('shape_' + el.id, { width: w, height: h }, scene, false)
    tex.hasAlpha = true
    const ctx = tex.getContext()
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = el.fillColor
    if (el.shape === 'ellipse') {
      ctx.beginPath()
      ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(0, 0, w, h)
    }
    tex.update(false)
    return tex
  }


  function makeMaterial(el: SlideElement): StandardMaterial {
    const mat = new StandardMaterial('mat_' + el.id, scene)
    mat.specularColor = new Color3(0, 0, 0)
    mat.backFaceCulling = false
    if (el.type === 'text') {
      const tex = buildTextTexture(el as Extract<SlideElement, { type: 'text' }>)
      mat.diffuseTexture = tex
      mat.opacityTexture = tex
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor = new Color3(0.4, 0.4, 0.4)
    } else if (el.type === 'shape') {
      const tex = buildShapeTexture(el as Extract<SlideElement, { type: 'shape' }>)
      mat.diffuseTexture = tex
      mat.opacityTexture = tex
      mat.useAlphaFromDiffuseTexture = true
      const e = el as Extract<SlideElement, { type: 'shape' }>
      mat.emissiveColor = Color3.FromHexString(e.fillColor).scale(0.2)
    } else if (el.type === 'image') {
      const e = el as Extract<SlideElement, { type: 'image' }>
      const tex = new Texture(e.src, scene, false, true)
      tex.hasAlpha = true
      mat.diffuseTexture = tex
    }
    return mat
  }

  // ---------- 平面要素 (text/shape/image) の Mesh 作成 ----------
  // Babylon LH の CreatePlane は FRONTSIDE で生成すると法線 +Z (≒カメラ向き) になる
  // ことになっているが、実測では DOUBLESIDE のときカメラ +Z 側から見ると裏面 (U 反転)
  // が表示される。これは Babylon が DOUBLESIDE で生成する 2 面のうち、後段の triangle
  // がカメラを向く順序になるため (頂点インデックス順の影響)。
  // 解決策: BACKSIDE のみで生成すると裏面トライアングルだけが定義されるため、+Z 側から
  // 見たときに UV が反転しない正しい面が表示される。
  function makePlaneForElement(el: SlideElement): Mesh {
    const widthU = el.width / PX_PER_UNIT
    const heightU = el.height / PX_PER_UNIT
    const plane = MeshBuilder.CreatePlane('el_' + el.id, {
      width: widthU,
      height: heightU,
      sideOrientation: Mesh.BACKSIDE,
    }, scene)
    plane.material = makeMaterial(el)
    return plane
  }

  // ---------- 3D モデル要素 (.glb) ----------
  // 構造:
  //   placeholder (pick root, position 反映、L/R 反転対策で X 軸 -180° 回転)
  //     └─ wrapper  (scale 反映)
  //           └─ inner (回転反映、モデル中心を local 原点に置く)
  //                 └─ meshes (glTF から)
  function makeModelMesh(el: Extract<SlideElement, { type: 'model' }>, record: MeshRecord) {
    const widthU = Math.max(0.5, el.width / PX_PER_UNIT)
    const heightU = Math.max(0.5, el.height / PX_PER_UNIT)

    // プレースホルダー: 半透明な薄いキューブ (ロード前のヒット領域)
    const placeholder = MeshBuilder.CreateBox('model_ph_' + el.id, {
      width: widthU,
      height: heightU,
      depth: Math.min(widthU, heightU) * 0.4,
    }, scene)
    const phMat = new StandardMaterial('model_phmat_' + el.id, scene)
    phMat.diffuseColor = new Color3(0.55, 0.75, 0.95)
    phMat.alpha = 0.35
    phMat.specularColor = new Color3(0, 0, 0)
    placeholder.material = phMat
    shadowGen.addShadowCaster(placeholder)

    record.pickRoot = placeholder
    record.modelInner = null

    const url = el.src
    if (!url) return

    const myToken = ++record.modelLoadToken
    SceneLoader.ImportMeshAsync('', '', url, scene)
      .then(result => {
        if (myToken !== record.modelLoadToken) {
          result.meshes.forEach(m => m.dispose())
          return
        }
        const wrapper = new TransformNode('model_wrap_' + el.id, scene)
        const inner = new TransformNode('model_inner_' + el.id, scene)
        inner.parent = wrapper

        const meshes: Mesh[] = []
        result.meshes.forEach(m => {
          if (!m.parent) m.parent = inner
          if (m instanceof Mesh) {
            meshes.push(m)
            shadowGen.addShadowCaster(m)
          }
        })

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
        const targetMax = Math.max(widthU, heightU) * 0.95
        const scale = targetMax / maxDim

        // 内側: モデル中心を local 原点に
        const center = min.add(size.scale(0.5))
        inner.position = new Vector3(-center.x, -center.y, -center.z)

        // 外側 wrapper: スケール
        wrapper.scaling.setAll(scale)
        wrapper.parent = placeholder

        record.modelInner = inner
        applyModelRotation(record, el.modelRotation)

        // プレースホルダー透明化
        phMat.alpha = 0.0
      })
      .catch(err => {
        console.warn('[depth-scene] model load failed:', url, err)
        phMat.diffuseColor = new Color3(0.95, 0.4, 0.4)
        phMat.alpha = 0.6
      })
  }

  function applyModelRotation(record: MeshRecord, rot?: { x: number, y: number, z: number }) {
    if (!record.modelInner) return
    const r = rot ?? { x: 0, y: 0, z: 0 }
    record.modelInner.rotation.x = (r.x * Math.PI) / 180
    record.modelInner.rotation.y = (r.y * Math.PI) / 180
    record.modelInner.rotation.z = (r.z * Math.PI) / 180
  }

  // ---------- mesh 管理 ----------
  const meshMap = new Map<string, MeshRecord>()
  let isUpdatingFromScene = false

  function disposeRecord(record: MeshRecord) {
    record.modelLoadToken++
    record.pickRoot.getChildMeshes(false).forEach(m => m.dispose())
    if (record.pickRoot.material) record.pickRoot.material.dispose(true, true)
    record.pickRoot.dispose(false, true)
  }

  function createRecord(el: SlideElement, orderIndex: number): MeshRecord {
    const world = toWorld(el, orderIndex * 0.003)
    const record: MeshRecord = {
      pickRoot: null as unknown as Mesh,
      elementType: el.type,
      baseX: world.x,
      baseY: world.y,
      materialKey: elementMaterialKey(el),
      modelLoadToken: 0,
      modelInner: null,
    }

    if (el.type === 'model') {
      makeModelMesh(el as Extract<SlideElement, { type: 'model' }>, record)
    } else {
      const plane = makePlaneForElement(el)
      record.pickRoot = plane
      shadowGen.addShadowCaster(plane)
    }

    record.pickRoot.position.set(world.x, world.y, world.z)
    // 平面内回転 (CSS の rotate(deg) と同等) を world Z 軸回転として反映
    record.pickRoot.rotation.z = (el.rotation * Math.PI) / 180
    record.pickRoot.metadata = { elementId: el.id }
    return record
  }

  function syncElements(elements: SlideElement[]) {
    if (isUpdatingFromScene) return
    const liveIds = new Set<string>()
    elements.forEach((el, orderIndex) => {
      liveIds.add(el.id)
      const existing = meshMap.get(el.id)
      const newKey = elementMaterialKey(el)

      if (!existing) {
        const record = createRecord(el, orderIndex)
        meshMap.set(el.id, record)
        return
      }

      if (existing.elementType !== el.type) {
        disposeRecord(existing)
        const record = createRecord(el, orderIndex)
        meshMap.set(el.id, record)
        return
      }

      if (existing.materialKey !== newKey && el.type !== 'model') {
        disposeRecord(existing)
        const record = createRecord(el, orderIndex)
        meshMap.set(el.id, record)
        return
      }

      const world = toWorld(el, orderIndex * 0.003)
      existing.baseX = world.x
      existing.baseY = world.y
      existing.pickRoot.position.set(world.x, world.y, world.z)

      // モデル要素は modelRotation の変更も反映
      if (el.type === 'model') {
        applyModelRotation(existing, (el as Extract<SlideElement, { type: 'model' }>).modelRotation)
      }
    })

    for (const [id, record] of meshMap.entries()) {
      if (!liveIds.has(id)) {
        if (gizmoManager.attachedMesh === record.pickRoot) gizmoManager.attachToMesh(null)
        disposeRecord(record)
        meshMap.delete(id)
      }
    }
  }

  function setSelectedElement(id: string | null) {
    if (!id) {
      gizmoManager.attachToMesh(null)
      return
    }
    const record = meshMap.get(id)
    if (record) gizmoManager.attachToMesh(record.pickRoot)
  }

  // ---------- ピッキング ----------
  scene.onPointerObservable.add((info) => {
    if (info.type !== PointerEventTypes.POINTERPICK) return
    const picked = info.pickInfo?.pickedMesh
    if (!picked) {
      cb.onSelect(null)
      gizmoManager.attachToMesh(null)
      return
    }
    let target: typeof picked | null = picked
    while (target && !target.metadata?.elementId) {
      target = target.parent as typeof picked | null
    }
    if (target?.metadata?.elementId) {
      const elId = target.metadata.elementId as string
      cb.onSelect(elId)
      const record = meshMap.get(elId)
      if (record) gizmoManager.attachToMesh(record.pickRoot)
    } else {
      cb.onSelect(null)
      gizmoManager.attachToMesh(null)
    }
  })

  // ---------- Z ギズモのドラッグ → ストア更新 ----------
  if (gizmoManager.gizmos.positionGizmo?.zGizmo) {
    gizmoManager.gizmos.positionGizmo.zGizmo.dragBehavior.onDragObservable.add(() => {
      const attached = gizmoManager.attachedMesh
      if (!attached || !attached.metadata?.elementId) return
      const elId = attached.metadata.elementId as string
      const record = meshMap.get(elId)
      if (!record) return

      isUpdatingFromScene = true
      const zPx = Math.round(attached.position.z * PX_PER_UNIT)
      cb.onZChanged(elId, zPx)

      // X/Y を baseline に固定 (誤って動かないように)
      attached.position.x = record.baseX
      attached.position.y = record.baseY
      isUpdatingFromScene = false
    })
  }

  engine.runRenderLoop(() => scene.render())

  function resize() {
    engine.resize()
  }

  function dispose() {
    engine.stopRenderLoop()
    for (const record of meshMap.values()) disposeRecord(record)
    meshMap.clear()
    scene.dispose()
    engine.dispose()
  }

  return { syncElements, setSelectedElement, resize, dispose }
}
