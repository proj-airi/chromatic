<script setup lang="ts">
import type { ChromaPoint, Model, TunedParams } from './chroma-model'

import { symbolicShadeValues } from '@proj-airi/chromatic'
import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useElementVisibility } from '@vueuse/core'
import { onMounted, onUnmounted, ref, watch } from 'vue'

import { residualColor, residualOf, useChromaModel } from './chroma-model'

const props = defineProps<{
  params: TunedParams
}>()

type ColorBy = 'output' | 'residual'

const model = ref<Model>('tuned')
const colorBy = ref<ColorBy>('residual')
const showGamut = ref(true)
const autoRotate = ref(true)

const { evaluate } = useChromaModel(props.params)

const HUE_STEP = 5
const hues = Array.from({ length: 360 / HUE_STEP + 1 }, (_, i) => i * HUE_STEP)
const shades = symbolicShadeValues
const COLS = hues.length
const ROWS = shades.length

// World-space extents
const SIZE_X = 6
const SIZE_Z = 3.6
const SIZE_Y = 2.4
const C_MAX = 0.32

const xOf = (col: number) => (col / (COLS - 1) - 0.5) * SIZE_X
const zOf = (row: number) => (row / (ROWS - 1) - 0.5) * SIZE_Z
const yOf = (chroma: number) => Math.min(chroma, C_MAX) / C_MAX * SIZE_Y

const mountEl = ref<HTMLDivElement | null>(null)
const stats = ref({ headroom: 0, meanAbs: 0, over: 0 })

let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let renderer: WebGLRenderer | null = null
let controls: OrbitControls | null = null
let frameHandle = 0
let resizeObserver: ResizeObserver | null = null
let surface: Mesh<BufferGeometry, MeshBasicMaterial> | null = null
let gamut: LineSegments<BufferGeometry, LineBasicMaterial> | null = null
let frame: LineSegments<BufferGeometry, LineBasicMaterial> | null = null

function gridIndices(): number[] {
  const indices: number[] = []
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS - 1; c++) {
      const a = r * COLS + c
      const b = a + 1
      const d = a + COLS
      const e = d + 1
      indices.push(a, d, b, b, d, e)
    }
  }
  return indices
}

function wireIndices(): number[] {
  const indices: number[] = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c
      if (c < COLS - 1)
        indices.push(i, i + 1)
      if (r < ROWS - 1)
        indices.push(i, i + COLS)
    }
  }
  return indices
}

function sampleGrid(): ChromaPoint[] {
  const points: ChromaPoint[] = []
  for (const shade of shades) {
    for (const hue of hues)
      points.push(evaluate(model.value, hue, shade))
  }
  return points
}

function updateGeometry() {
  if (!surface || !gamut)
    return

  const points = sampleGrid()
  const surfacePos = surface.geometry.getAttribute('position') as BufferAttribute
  const surfaceColor = surface.geometry.getAttribute('color') as BufferAttribute
  const gamutPos = gamut.geometry.getAttribute('position') as BufferAttribute
  const color = new Color()

  let over = 0
  let headroom = 0
  let absSum = 0

  points.forEach((p, i) => {
    const r = Math.floor(i / COLS)
    const c = i % COLS
    const residual = residualOf(p)

    surfacePos.setXYZ(i, xOf(c), yOf(p.chroma), zOf(r))
    gamutPos.setXYZ(i, xOf(c), yOf(p.maxChroma), zOf(r))
    color.set(colorBy.value === 'output' ? p.hex : residualColor(residual))
    surfaceColor.setXYZ(i, color.r, color.g, color.b)

    if (residual > 0.01)
      over++
    if (residual < -0.25)
      headroom++
    absSum += Math.abs(residual)
  })

  surfacePos.needsUpdate = true
  surfaceColor.needsUpdate = true
  gamutPos.needsUpdate = true
  surface.geometry.computeBoundingSphere()
  gamut.visible = showGamut.value

  stats.value = {
    headroom: headroom / points.length,
    meanAbs: absSum / points.length,
    over: over / points.length,
  }
}

function buildFrame(): LineSegments<BufferGeometry, LineBasicMaterial> {
  const x0 = -SIZE_X / 2
  const x1 = SIZE_X / 2
  const z0 = -SIZE_Z / 2
  const z1 = SIZE_Z / 2
  const vertices: number[] = [
    // floor outline
    x0, 0, z0, x1, 0, z0,
    x1, 0, z0, x1, 0, z1,
    x1, 0, z1, x0, 0, z1,
    x0, 0, z1, x0, 0, z0,
    // chroma axis
    x0, 0, z0, x0, SIZE_Y, z0,
  ]
  // hue ticks every 60°
  for (let hue = 60; hue < 360; hue += 60) {
    const x = (hue / 360 - 0.5) * SIZE_X
    vertices.push(x, 0, z0, x, 0, z1)
  }
  // chroma ticks every 0.08
  for (let chroma = 0.08; chroma <= C_MAX + 1e-6; chroma += 0.08)
    vertices.push(x0, yOf(chroma), z0, x1, yOf(chroma), z0)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  return new LineSegments(geometry, new LineBasicMaterial({ color: 0x888888, opacity: 0.45, transparent: true }))
}

// Only animate while on screen.
const visible = useElementVisibility(mountEl)

function renderLoop() {
  frameHandle = 0
  if (!renderer || !scene || !camera || !controls || !visible.value)
    return

  controls.autoRotate = autoRotate.value
  controls.update()
  renderer.render(scene, camera)
  frameHandle = requestAnimationFrame(renderLoop)
}

function startRenderLoop() {
  if (!frameHandle)
    frameHandle = requestAnimationFrame(renderLoop)
}

watch(visible, (isVisible) => {
  if (isVisible)
    startRenderLoop()
})

function setupRenderer() {
  const el = mountEl.value
  if (!el)
    return

  scene = new Scene()
  camera = new PerspectiveCamera(40, 1, 0.1, 100)
  camera.position.set(-3.2, 4.4, 6.2)

  renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, SIZE_Y / 3, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.autoRotateSpeed = 0.4
  controls.minDistance = 3
  controls.maxDistance = 14

  const count = ROWS * COLS

  const surfaceGeometry = new BufferGeometry()
  surfaceGeometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  surfaceGeometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3))
  surfaceGeometry.setIndex(gridIndices())
  surface = new Mesh(surfaceGeometry, new MeshBasicMaterial({ side: DoubleSide, toneMapped: false, vertexColors: true }))

  const gamutGeometry = new BufferGeometry()
  gamutGeometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  gamutGeometry.setIndex(wireIndices())
  gamut = new LineSegments(gamutGeometry, new LineBasicMaterial({ color: 0x9a9a9a, opacity: 0.55, transparent: true }))

  frame = buildFrame()

  const group = new Group()
  group.add(surface, gamut, frame)
  scene.add(group)

  const resize = () => {
    if (!el || !renderer || !camera)
      return
    const { width, height } = el.getBoundingClientRect()
    if (!width || !height)
      return
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  resize()
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(el)
  updateGeometry()
  startRenderLoop()
}

onMounted(setupRenderer)

watch([() => ({ ...props.params }), model, colorBy, showGamut], updateGeometry)

onUnmounted(() => {
  cancelAnimationFrame(frameHandle)
  resizeObserver?.disconnect()
  controls?.dispose()
  for (const obj of [surface, gamut, frame]) {
    obj?.geometry.dispose()
    obj?.material.dispose()
  }
  renderer?.dispose()
  renderer?.domElement.remove()
})

const segmentClass = (active: boolean) => [
  'px-2 py-0.5 rounded-md transition-colors',
  active ? 'bg-neutral-800 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
]
</script>

<template>
  <div>
    <div mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-mono>
      <div flex items-center gap-1>
        <span mr-1 text="neutral-500 dark:neutral-400">model</span>
        <button :class="segmentClass(model === 'current')" @click="model = 'current'">
          classic
        </button>
        <button :class="segmentClass(model === 'tuned')" @click="model = 'tuned'">
          tuned
        </button>
        <button :class="segmentClass(model === 'tailwind')" @click="model = 'tailwind'">
          tailwind ≈
        </button>
        <button :class="segmentClass(model === 'fitted')" @click="model = 'fitted'">
          fitted
        </button>
      </div>
      <div flex items-center gap-1>
        <span mr-1 text="neutral-500 dark:neutral-400">color by</span>
        <button :class="segmentClass(colorBy === 'residual')" @click="colorBy = 'residual'">
          residual
        </button>
        <button :class="segmentClass(colorBy === 'output')" @click="colorBy = 'output'">
          output
        </button>
      </div>
      <label flex cursor-pointer items-center gap-1.5>
        <input v-model="showGamut" type="checkbox"> sRGB wireframe
      </label>
      <label flex cursor-pointer items-center gap-1.5>
        <input v-model="autoRotate" type="checkbox"> rotate
      </label>
    </div>

    <div relative>
      <div ref="mountEl" class="aspect-[16/10] max-h-[80vh] min-h-360px w-full overflow-hidden rounded-xl" bg="neutral-50 dark:neutral-900/60" />

      <div class="pointer-events-none absolute left-3 top-3 rounded-lg px-3 py-2 text-xs font-mono" bg="white/80 dark:neutral-900/80" backdrop-blur-sm>
        <div>x = hue 0° → 360°</div>
        <div>z = shade 50 → 950</div>
        <div>y = chroma 0 → {{ C_MAX }}</div>
      </div>

      <div class="pointer-events-none absolute bottom-3 right-3 rounded-lg px-3 py-2 text-xs font-mono" bg="white/80 dark:neutral-900/80" backdrop-blur-sm>
        <div flex justify-between gap-4>
          <span>over sRGB</span><span text="red-600 dark:red-400">{{ (stats.over * 100).toFixed(1) }}%</span>
        </div>
        <div flex justify-between gap-4>
          <span>&lt; 75% of sRGB</span><span text="blue-600 dark:blue-400">{{ (stats.headroom * 100).toFixed(1) }}%</span>
        </div>
        <div flex justify-between gap-4>
          <span>mean |residual|</span><span>{{ (stats.meanAbs * 100).toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <div v-if="colorBy === 'residual'" mt-2 flex items-center gap-2 text-xs text="neutral-600 dark:neutral-300">
      <span>−50% headroom</span>
      <span class="residual-scale" inline-block h-2.5 w-40 rounded-sm />
      <span>+50% over sRGB</span>
    </div>
  </div>
</template>

<style scoped>
.residual-scale {
  background: linear-gradient(to right, oklch(0.6 0.17 255), oklch(0.86 0 0), oklch(0.6 0.17 27));
}
</style>
