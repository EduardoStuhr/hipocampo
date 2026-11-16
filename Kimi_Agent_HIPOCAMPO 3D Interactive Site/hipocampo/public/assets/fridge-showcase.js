import * as THREE from './vendor/three.module.min.js'

// A small, isolated model. Render only on resize, visibility or door movement.
export function mountFridgeShowcase(figure) {
  const photo = figure.querySelector('img')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'fridge-showcase-toggle'
  button.setAttribute('aria-label', 'Abrir geladeira')
  button.setAttribute('aria-pressed', 'false')
  const label = document.createElement('span')
  label.className = 'fridge-showcase-label'
  label.textContent = 'abrir geladeira'
  button.append(label)
  figure.append(button)
  let renderer, scene, camera, model, resize, observer, texture, frame = 0
  let aspect = 1, projectedBounds = null
  let open = false, visible = false, angle = 0, target = 0, previous = 0, disposed = false
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const doors = [], geometries = new Set(), materials = new Set(), maps = new Set()
  const paint = () => {
    if (disposed || !renderer || !visible || document.hidden) return
    const now = performance.now(), dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60
    previous = now
    angle = reduced.matches ? target : angle + (target - angle) * (1 - Math.exp(-7 * dt))
    if (Math.abs(target - angle) < .002) angle = target
    doors.forEach(door => { door.rotation.y = angle })
    // Fit the complete open doors as well as the closed cabinet, without clipping.
    camera.left = -2 * aspect; camera.right = 2 * aspect; camera.top = 2; camera.bottom = -2
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); model.updateMatrixWorld(true)
    const point = new THREE.Vector3()
    let min = Infinity, max = -Infinity
    model.traverse(mesh => {
      if (!mesh.isMesh) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const bounds = mesh.geometry.boundingBox
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera)
        min = Math.min(min, point.x); max = Math.max(max, point.x)
      }
    })
    const center = (min + max) * aspect
    const scale = Math.max(1, (max - min) / 1.8)
    camera.left = center - 2 * aspect * scale; camera.right = center + 2 * aspect * scale
    camera.top = 2 * scale; camera.bottom = -2 * scale
    camera.updateProjectionMatrix()
    projectedBounds = { min: (min - (min + max) / 2) / scale, max: (max - (min + max) / 2) / scale }
    renderer.render(scene, camera)
    frame = angle !== target ? requestAnimationFrame(paint) : 0
    if (!frame) previous = 0
  }
  const request = () => { if (renderer && doors.length && !frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(() => { frame = 0; paint() }) }
  const material = options => { const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m }
  const green = material({ color: '#8d9b53', roughness: .36, metalness: .22 })
  const cream = material({ color: '#eee9d4', roughness: .8 })
  const chrome = material({ color: '#c3c5b8', roughness: .3, metalness: .65 })
  const dark = material({ color: '#576139', roughness: .7 })
  const box = (parent, w, h, d, mat, x = 0, y = 0, z = 0) => {
    const geometry = new THREE.BoxGeometry(w, h, d)
    geometries.add(geometry)
    const mesh = new THREE.Mesh(geometry, mat)
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const setSize = () => {
    if (!renderer) return
    const width = button.clientWidth, height = Math.max(1, button.clientHeight - 24)
    renderer.setSize(width, height, false)
    aspect = width / height
    camera.left = -2 * aspect; camera.right = 2 * aspect
    camera.top = 2; camera.bottom = -2
    camera.updateProjectionMatrix()
    request()
  }
  const fallback = () => {
    figure.classList.remove('is-3d-ready')
    button.disabled = true
    button.setAttribute('aria-label', 'Geladeira antiga verde')
    label.textContent = ''
  }
  const build = async () => {
    if (renderer || disposed) return
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.setClearColor(0xffffff, 0)
      renderer.domElement.className = 'fridge-showcase-canvas'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      button.prepend(renderer.domElement)
      scene = new THREE.Scene()
      camera = new THREE.OrthographicCamera(-1.5, 1.5, 2, -2, .1, 30)
      camera.position.set(2.5, 1.1, 7)
      camera.lookAt(0, 0, .35)
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b29d, 2.5))
      const light = new THREE.DirectionalLight(0xffffff, 2.2)
      light.position.set(-3, 5, 6); scene.add(light)
      const body = new THREE.Group(); model = body; scene.add(body)
      box(body, 1.5, 3, .13, green, 0, 0, -.38)
      box(body, .1, 3, .9, green, -.72, 0, 0)
      box(body, .1, 3, .9, green, .72, 0, 0)
      box(body, 1.5, .1, .9, green, 0, 1.47, 0)
      box(body, 1.5, .1, .9, green, 0, -1.47, 0)
      box(body, 1.3, 2.82, .03, cream, 0, 0, -.29)
      box(body, 1.3, .055, .7, cream, 0, .43, .02)
      for (const y of [-1.18, -.62, -.06, 1.02]) {
        box(body, 1.3, .045, .7, cream, 0, y, .02)
        box(body, 1.3, .035, .035, chrome, 0, y, .39)
      }
      for (const x of [-.57, .57]) box(body, .12, .15, .45, dark, x, -1.55, -.1)
      texture = await new THREE.TextureLoader().loadAsync(photo.src)
      if (disposed) { texture.dispose(); return }
      texture.colorSpace = THREE.SRGBColorSpace
      maps.add(texture)
      for (const [y, h, imageTop, imageHeight] of [[.97, 1, 20, 79], [-.51, 1.9, 99, 143]]) {
        const map = texture.clone()
        map.repeat.set(108 / 146, imageHeight / 248)
        map.offset.set(13 / 146, (248 - imageTop - imageHeight) / 248)
        map.needsUpdate = true; maps.add(map)
        const facade = material({ map, roughness: .48, metalness: .12 })
        const hinge = new THREE.Group(); hinge.position.set(-.72, y, .48)
        body.add(hinge); doors.push(hinge)
        box(hinge, 1.44, h, .105, [green, green, green, green, facade, cream], .72)
        box(hinge, .48, .045, .075, chrome, .38, -h * .25, .095)
        for (const shelfY of [-h * .3, h * .2]) box(hinge, 1.18, .06, .14, cream, .72, shelfY, -.1)
      }
      renderer.domElement.addEventListener('webglcontextlost', lost)
      resize = new ResizeObserver(setSize); resize.observe(button)
      figure.classList.add('is-3d-ready')
      setSize(); request()
    } catch { fallback() }
  }
  const click = () => {
    if (button.disabled) return
    open = !open; target = open ? -1.8 : 0
    button.setAttribute('aria-pressed', String(open))
    button.setAttribute('aria-label', open ? 'Fechar geladeira' : 'Abrir geladeira')
    label.textContent = open ? 'fechar geladeira' : 'abrir geladeira'
    figure.dataset.fridgeOpen = String(open)
    request()
  }
  const lost = event => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; fallback() }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0 } else request() }
  figure.fridgeShowcase = { getDiagnostics: () => ({ open, angle, target, visible, frames: renderer?.info.render.frame || 0, triangles: renderer?.info.render.triangles || 0, ready: figure.classList.contains('is-3d-ready'), projectedBounds }) }
  const cleanup = () => {
    if (disposed) return
    disposed = true; delete figure.fridgeShowcase; cancelAnimationFrame(frame)
    observer?.disconnect(); resize?.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    button.removeEventListener('click', click)
    renderer?.domElement.removeEventListener('webglcontextlost', lost)
    maps.forEach(map => map.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
    renderer?.dispose()
    window.removeEventListener('pagehide', cleanup)
  }
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible) { build(); request() } else { cancelAnimationFrame(frame); frame = 0; previous = 0 }
  }, { rootMargin: '100px 0px' })
  observer.observe(figure)
  button.addEventListener('click', click)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', cleanup, { once: true })
  return cleanup
}
