import {
  type Presentation,
  type Slide,
  type SlideElement,
  createId,
} from '~/domain/presentation'

function text(opts: Partial<SlideElement> & { content: string }): SlideElement {
  return {
    id: createId('text'),
    type: 'text',
    x: opts.x ?? 80,
    y: opts.y ?? 80,
    z: opts.z ?? 0,
    width: opts.width ?? 600,
    height: opts.height ?? 80,
    rotation: opts.rotation ?? 0,
    content: opts.content,
    fontSize: (opts as { fontSize?: number }).fontSize ?? 36,
    fontColor: (opts as { fontColor?: string }).fontColor ?? '#1f2937',
    fontFamily: (opts as { fontFamily?: string }).fontFamily ?? 'Inter, sans-serif',
    fontWeight: (opts as { fontWeight?: 'normal' | 'bold' }).fontWeight ?? 'normal',
    textAlign: (opts as { textAlign?: 'left' | 'center' | 'right' }).textAlign ?? 'left',
  }
}

function shape(opts: {
  x: number; y: number; z?: number
  width: number; height: number
  fillColor: string
  shape?: 'rectangle' | 'ellipse'
  rotation?: number
}): Extract<SlideElement, { type: 'shape' }> {
  return {
    id: createId('shape'),
    type: 'shape',
    x: opts.x, y: opts.y, z: opts.z ?? 0,
    width: opts.width, height: opts.height,
    rotation: opts.rotation ?? 0,
    shape: opts.shape ?? 'rectangle',
    fillColor: opts.fillColor,
    strokeColor: 'transparent',
    strokeWidth: 0,
  }
}

function model(opts: {
  x: number; y: number; z?: number
  width?: number; height?: number
  src: string
  displayName: string
}): SlideElement {
  return {
    id: createId('model'),
    type: 'model',
    x: opts.x, y: opts.y, z: opts.z ?? 0,
    width: opts.width ?? 320,
    height: opts.height ?? 240,
    rotation: 0,
    assetId: opts.src,
    src: opts.src,
    displayName: opts.displayName,
  }
}

const SLIDE_DEFAULT: Omit<Slide, 'id' | 'order' | 'elements'> = {
  background: '#f8fafc',
  notes: '',
}

function slide(elements: SlideElement[], extra: Partial<Slide> = {}): Slide {
  return {
    ...SLIDE_DEFAULT,
    id: createId('slide'),
    order: 0,
    elements,
    ...extra,
  }
}

export function createDemoPresentation(): Presentation {
  const now = new Date().toISOString()

  const slides: Slide[] = [
    slide([
      shape({ x: 0, y: 0, width: 1280, height: 720, fillColor: '#0f172a' }),
      shape({ x: 80, y: 540, width: 220, height: 8, fillColor: '#38bdf8' }),
      text({
        x: 80, y: 220, width: 1120, height: 120,
        content: '空間プレゼンテーション',
        fontSize: 88, fontColor: '#f8fafc', fontWeight: 'bold',
      }),
      text({
        x: 80, y: 360, width: 1120, height: 60,
        content: '3D × スライド の編集プロト',
        fontSize: 32, fontColor: '#94a3b8',
      }),
      text({
        x: 80, y: 580, width: 600, height: 40,
        content: 'Demo · 案A 全要素統一モデル',
        fontSize: 20, fontColor: '#64748b',
      }),
    ]),
    slide([
      text({
        x: 80, y: 60, width: 1120, height: 80,
        content: '建築モデルの構造を立体的に説明',
        fontSize: 44, fontWeight: 'bold',
      }),
      text({
        x: 80, y: 160, width: 700, height: 120,
        content: 'スライド要素は 平面(X,Y) と 奥行き(Z) を分離して編集します。\n3D編集モードでは Z 位置のみを直感的に調整できます。',
        fontSize: 22, fontColor: '#475569',
      }),
      shape({ x: 820, y: 180, width: 380, height: 380, fillColor: '#0ea5e9', shape: 'ellipse', z: -200 }),
      shape({ x: 60, y: 380, width: 700, height: 280, fillColor: '#e2e8f0', z: -50 }),
      text({
        x: 100, y: 410, width: 620, height: 40,
        content: 'タイトル: 中間 (Z = -50)',
        fontSize: 22, fontColor: '#1f2937', fontWeight: 'bold',
        z: -50,
      }),
      text({
        x: 100, y: 460, width: 620, height: 40,
        content: '本文: 中間 (Z = -50)',
        fontSize: 18, fontColor: '#475569',
        z: -50,
      }),
      text({
        x: 100, y: 510, width: 620, height: 40,
        content: '装飾円: 奥 (Z = -200)',
        fontSize: 18, fontColor: '#475569',
        z: -50,
      }),
      shape({ x: 200, y: 200, width: 200, height: 60, fillColor: '#f97316', z: 150 }),
      text({
        x: 215, y: 215, width: 170, height: 30,
        content: '手前 (Z = +150)',
        fontSize: 18, fontColor: '#ffffff', fontWeight: 'bold',
        z: 150,
      }),
    ], { background: '#ffffff' }),
    slide([
      text({
        x: 80, y: 60, width: 1120, height: 80,
        content: '3Dモデル要素もスライド上に配置',
        fontSize: 44, fontWeight: 'bold',
      }),
      text({
        x: 80, y: 160, width: 1120, height: 100,
        content: '.glb ファイルをドラッグして配置できます。\n3D編集モードでは奥行きスライダ／ドラッグで Z を変更します。',
        fontSize: 22, fontColor: '#475569',
      }),
      shape({ x: 80, y: 300, width: 1120, height: 360, fillColor: '#f1f5f9' }),
      model({
        x: 460, y: 360, z: 80,
        width: 360, height: 240,
        src: '/samples/avocado.glb',
        displayName: 'サンプル: アボカド',
      }),
      text({
        x: 100, y: 320, width: 600, height: 30,
        content: '3Dモデル領域',
        fontSize: 16, fontColor: '#64748b',
      }),
    ], { background: '#ffffff' }),
    slide([
      shape({ x: 0, y: 0, width: 1280, height: 720, fillColor: '#0f172a' }),
      text({
        x: 80, y: 280, width: 1120, height: 80,
        content: 'まとめ',
        fontSize: 64, fontColor: '#f8fafc', fontWeight: 'bold',
      }),
      text({
        x: 80, y: 380, width: 1120, height: 120,
        content: 'XY と Z を分離 → 操作の認知負荷を下げる\n奥行きの直感的な把握 → グリッド + 影 + 軸\n編集アプリとして PowerPoint 並みの操作感',
        fontSize: 24, fontColor: '#cbd5f5',
      }),
    ]),
  ]

  slides.forEach((s, i) => { s.order = i })

  return {
    id: 'demo_presentation',
    title: 'Demo: 3D Presentation Editor',
    slides,
    createdAt: now,
    updatedAt: now,
  }
}
