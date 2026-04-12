<script setup lang="ts">
import type { Shade } from '@proj-airi/chromatic'

import { chromaticColorFrom } from '@proj-airi/chromatic'
import { Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, PerspectiveCamera, Scene, SphereGeometry, WebGLRenderer } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  hue?: number
}>(), {
  hue: 220.25,
})

const mountEl = ref<HTMLDivElement | null>(null)

const shadeValues: Shade[] = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const brightnessValues = Array.from({ length: 10 }, (_, i) => (i + 1) * 10)
const saturationValues = Array.from({ length: 11 }, (_, i) => i * 10)

let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let renderer: WebGLRenderer | null = null
let controls: OrbitControls | null = null
let frameHandle = 0
let resizeObserver: ResizeObserver | null = null
let pointCloud: InstancedMesh | null = null

function toHexColor(shade: Shade, brightness: number, saturation: number, hue: number): string {
  return chromaticColorFrom(hue, {
    shade,
    brightness,
    saturation,
  }).toHex()
}

function updatePointCloudColors(hue: number) {
  if (!pointCloud)
    return

  const color = new Color()
  let i = 0
  for (const shade of shadeValues) {
    for (const brightness of brightnessValues) {
      for (const saturation of saturationValues) {
        color.set(toHexColor(shade, brightness, saturation, hue))
        pointCloud.setColorAt(i, color)
        i++
      }
    }
  }
  pointCloud.instanceColor!.needsUpdate = true
}

function buildPointCloud() {
  const count = shadeValues.length * brightnessValues.length * saturationValues.length
  const geometry = new SphereGeometry(0.12, 10, 10)
  const material = new MeshBasicMaterial({ toneMapped: false })
  const cloud = new InstancedMesh(geometry, material, count)

  const xGap = 0.34
  const yGap = 0.24
  const zGap = 0.34
  const xCenter = (shadeValues.length - 1) / 2
  const yCenter = (brightnessValues.length - 1) / 2
  const zCenter = (saturationValues.length - 1) / 2

  const matrix = new Matrix4()
  let i = 0
  for (let x = 0; x < shadeValues.length; x++) {
    for (let y = 0; y < brightnessValues.length; y++) {
      for (let z = 0; z < saturationValues.length; z++) {
        matrix.makeTranslation(
          (x - xCenter) * xGap,
          (y - yCenter) * yGap,
          (z - zCenter) * zGap,
        )
        cloud.setMatrixAt(i, matrix)
        i++
      }
    }
  }

  cloud.instanceMatrix.needsUpdate = true
  return cloud
}

function renderLoop() {
  if (!renderer || !scene || !camera || !controls)
    return

  controls.update()
  renderer.render(scene, camera)
  frameHandle = requestAnimationFrame(renderLoop)
}

function setupRenderer() {
  const el = mountEl.value
  if (!el)
    return

  scene = new Scene()

  camera = new PerspectiveCamera(45, 1, 0.1, 100)
  camera.position.set(4.5, 5, 3.9)

  renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.55
  controls.minDistance = 2.4
  controls.maxDistance = 10

  const group = new Group()
  pointCloud = buildPointCloud()
  group.add(pointCloud)
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
  updatePointCloudColors(props.hue)
  renderLoop()
}

onMounted(setupRenderer)

watch(() => props.hue, (hue) => {
  updatePointCloudColors(hue)
})

onUnmounted(() => {
  cancelAnimationFrame(frameHandle)
  resizeObserver?.disconnect()
  controls?.dispose()
  pointCloud?.geometry.dispose()
  ;(pointCloud?.material as MeshBasicMaterial | undefined)?.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div
    ref="mountEl"
    class="relative h-400px w-full overflow-hidden rounded-xl sm:h-650px"
  />
</template>
