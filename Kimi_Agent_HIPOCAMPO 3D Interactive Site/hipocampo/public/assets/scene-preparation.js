import * as THREE from './vendor/three.module.min.js'

// Background WebGL work must yield to the visitor, even when an idle callback
// times out. In particular, a room far down the page must not freeze the hero.
let lastInput = -Infinity
const noteInput = () => { lastInput = performance.now() }
const inputOptions = { passive: true }
const inputEvents = ['wheel', 'touchmove', 'scroll', 'keydown']
inputEvents.forEach(event => window.addEventListener(event, noteInput, inputOptions))
window.addEventListener('pagehide', () => {
  inputEvents.forEach(event => window.removeEventListener(event, noteInput, inputOptions))
}, { once: true })

export function yieldScenePreparation(signal, { allowDuringScroll = false, priority = false } = {}) {
  return new Promise((resolve, reject) => {
    let idle = 0, timer = 0, frame = 0
    const cancel = () => {
      if (idle) window.cancelIdleCallback(idle)
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      cancel()
      reject(new DOMException('Preparação cancelada', 'AbortError'))
    }
    const schedule = () => {
      if (signal?.aborted) return abort()
      if (priority && !document.hidden) frame = requestAnimationFrame(() => { frame = 0; timer = window.setTimeout(run, 0) })
      else if ('requestIdleCallback' in window) idle = window.requestIdleCallback(run, { timeout: 400 })
      else timer = window.setTimeout(run, 32)
    }
    const run = deadline => {
      idle = timer = 0
      const remaining = allowDuringScroll ? 0 : 160 - (performance.now() - lastInput)
      if (remaining > 0 || document.hidden) {
        timer = window.setTimeout(schedule, Math.max(remaining, 80))
        return
      }
      if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 6) return schedule()
      cancel()
      resolve()
    }
    signal?.addEventListener('abort', abort, { once: true })
    schedule()
  })
}

export async function prepareSceneMaterials(renderer, scene, camera, textures, signal, options) {
  signal?.throwIfAborted()
  // Upload images and submit shader work in short slices. Bounded batches
  // overlap asynchronous compilation without submitting the whole scene at once.
  const uploads = new Set(textures), objects = [], materials = new Set()
  scene.traverse(object => {
    const surfaces = (Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean)
    surfaces.forEach(material => {
      Object.values(material).forEach(value => { if (value?.isTexture) uploads.add(value) })
    })
    if (surfaces.some(material => !materials.has(material))) {
      objects.push(object)
      surfaces.forEach(material => materials.add(material))
    }
  })
  const taskCount = uploads.size + objects.length
  let completedTasks = 0
  const reportCompleted = () => {
    completedTasks++
    if (!signal?.aborted) options?.onProgress?.('materials', completedTasks, taskCount)
  }
  options?.onProgress?.('materials', 0, taskCount)
  let sliceStarted = -Infinity
  const yieldBudget = async () => {
    if (performance.now() - sliceStarted < 4) return
    await yieldScenePreparation(signal, options)
    sliceStarted = performance.now()
  }
  for (const texture of uploads) {
    signal?.throwIfAborted()
    const image = texture.image
    if (image instanceof HTMLImageElement) {
      // Decode off the upload path. texImage2D(HTMLImageElement) can otherwise
      // decode/convert a large transparent photograph synchronously on scroll.
      await image.decode().catch(() => {})
      if ('createImageBitmap' in window) {
        try {
          const bitmap = await createImageBitmap(image, { imageOrientation: texture.flipY ? 'flipY' : 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
          if (signal?.aborted) { bitmap.close(); throw new DOMException('Preparação cancelada', 'AbortError') }
          texture.image = bitmap
          texture.flipY = false
          texture.addEventListener('dispose', () => bitmap.close())
        } catch (error) {
          if (error.name === 'AbortError') throw error
          // Older browsers keep their already-decoded HTML image.
        }
      }
    }
    await yieldBudget()
    signal?.throwIfAborted()
    renderer.initTexture(texture)
    reportCompleted()
  }
  const pending = []
  const batchSize = Math.max(1, options?.compileBatchSize || 1)
  for (const object of objects) {
    await yieldBudget()
    signal?.throwIfAborted()
    const compilation = renderer.compileAsync(object, camera, scene).then(reportCompleted)
    // Attach a handler immediately, including while the next submission yields.
    compilation.catch(() => {})
    pending.push(compilation)
    if (pending.length >= batchSize) await Promise.all(pending.splice(0))
  }
  await Promise.all(pending)
}

export async function waitForSceneGPU(renderer, signal) {
  const gl = renderer.getContext()
  if (!gl.fenceSync) return
  const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  gl.flush()
  try {
    await new Promise((resolve, reject) => {
      const poll = () => {
        if (signal?.aborted) {
          reject(signal.reason || new DOMException('Preparação cancelada', 'AbortError'))
          return
        }
        if (gl.isContextLost()) {
          reject(new Error('A conexão gráfica da casa foi interrompida'))
          return
        }
        const status = gl.clientWaitSync(fence, 0, 0)
        if (status === gl.TIMEOUT_EXPIRED) window.setTimeout(poll, 16)
        else if (status === gl.WAIT_FAILED) reject(new Error('Falha ao preparar o contexto 3D'))
        else resolve()
      }
      poll()
    })
  } finally {
    gl.deleteSync(fence)
  }
}

export async function warmScene(renderer, scene, camera, signal, options) {
  const size = renderer.getSize(new THREE.Vector2())
  const override = scene.overrideMaterial
  const pipelines = new Set(), entries = [], samples = []
  scene.traverse(object => {
    if (!object.material) return
    entries.push({ object, visible: object.visible, frustumCulled: object.frustumCulled })
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const keys = materials.map(material => {
      const program = renderer.properties.get(material).currentProgram
      return [program?.id ?? material.id, material.side, material.transparent, material.blending, material.depthWrite, material.depthTest, material.colorWrite, material.stencilWrite, material.stencilFunc].join(':')
    })
    if (keys.some(key => !pipelines.has(key))) {
      keys.forEach(key => pipelines.add(key))
      samples.push(object)
    }
  })
  const simple = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  // Depth pass + one submission per pipeline; batched mode has one final GPU
  // drain task. Completion of that drain is reported only after its fence.
  const taskCount = samples.length + (options?.batchWarmup ? 2 : 1)
  let completedTasks = 0
  const reportCompleted = () => {
    completedTasks++
    if (!signal?.aborted) options?.onProgress?.('warmup', completedTasks, taskCount)
  }
  options?.onProgress?.('warmup', 0, taskCount)
  try {
    await yieldScenePreparation(signal, options)
    renderer.setSize(64, 64, false)
    // First warm the depth/shadow passes with a cheap colour pass. Submitting
    // every lit material together stalls some GPUs even after compileAsync.
    scene.overrideMaterial = simple
    renderer.shadowMap.needsUpdate = true
    renderer.render(scene, camera)
    await waitForSceneGPU(renderer, signal)
    reportCompleted()
    scene.overrideMaterial = override
    renderer.shadowMap.needsUpdate = false
    entries.forEach(({ object }) => { object.visible = false })
    let sliceStarted = -Infinity
    for (const object of samples) {
      if (!options?.batchWarmup || performance.now() - sliceStarted >= 4) {
        await yieldScenePreparation(signal, options)
        sliceStarted = performance.now()
      }
      signal?.throwIfAborted()
      object.visible = true
      object.frustumCulled = false
      renderer.render(scene, camera)
      if (!options?.batchWarmup) await waitForSceneGPU(renderer, signal)
      object.visible = false
      reportCompleted()
    }
    if (options?.batchWarmup) {
      await waitForSceneGPU(renderer, signal)
      reportCompleted()
    }
  } finally {
    entries.forEach(entry => {
      entry.object.visible = entry.visible
      entry.object.frustumCulled = entry.frustumCulled
    })
    scene.overrideMaterial = override
    if (!signal?.aborted) renderer.setSize(size.x, size.y, false)
    simple.dispose()
  }
}
