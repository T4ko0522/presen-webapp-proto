/**
 * プレゼンテーション・スライド・要素のドメイン型定義
 *
 * 設計方針（案A: 全要素統一案）:
 * - すべての要素は (x, y, z, width, height, rotation) を持つ平面要素として扱う
 * - z は手前⇔奥の位置（負: 奥, 正: 手前）
 * - rotation は平面内回転（Z軸周り）のみ。3D回転は持たない
 * - 3Dモデルも「立体的な見た目を持つ平面要素」として配置する
 */

export type ElementId = string
export type SlideId = string
export type AssetId = string

export interface ElementBase {
  id: ElementId
  type: string
  x: number
  y: number
  z: number
  width: number
  height: number
  rotation: number
}

export interface TextElement extends ElementBase {
  type: 'text'
  content: string
  fontSize: number
  fontColor: string
  fontFamily: string
  fontWeight: 'normal' | 'bold'
  textAlign: 'left' | 'center' | 'right'
}

export interface ImageElement extends ElementBase {
  type: 'image'
  assetId: AssetId
  src: string
  alt?: string
}

export interface ModelElement extends ElementBase {
  type: 'model'
  assetId: AssetId
  src: string
  displayName: string
  /**
   * 3Dモデル本体の向き (degrees)。スライド要素全体の `rotation` (画面内Z軸回転) とは別物。
   * 例: modelRotation = { x: 0, y: 45, z: 0 } で Y 軸まわりに 45° 回転
   */
  modelRotation?: { x: number, y: number, z: number }
}

export interface ShapeElement extends ElementBase {
  type: 'shape'
  shape: 'rectangle' | 'ellipse'
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export type SlideElement = TextElement | ImageElement | ModelElement | ShapeElement

export interface Slide {
  id: SlideId
  order: number
  background: string
  elements: SlideElement[]
  notes: string
}

export interface Presentation {
  id: string
  title: string
  slides: Slide[]
  createdAt: string
  updatedAt: string
}

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720
export const Z_RANGE = { min: -500, max: 500 } as const

export function createId(prefix = 'el'): string {
  const random = Math.random().toString(36).slice(2, 10)
  const time = Date.now().toString(36)
  return `${prefix}_${time}${random}`
}
