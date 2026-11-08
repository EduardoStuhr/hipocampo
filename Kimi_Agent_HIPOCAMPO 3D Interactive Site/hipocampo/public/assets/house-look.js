// Camera orientation only: page scrolling continues to own the journey.
export function createHouseLook({ THREE, section, stage, canvas, camera, invalidate }) {
  const controls = document.createElement('div')
  controls.className = 'page3-look-controls'
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', 'Explorar a casa')
  controls.hidden = true
  controls.innerHTML = `<button type="button" class="page3-look-toggle" aria-pressed="false" aria-describedby="house-look-hint">olhar ao redor</button>
    <button type="button" class="page3-look-reset" hidden>voltar ao percurso</button>
    <p id="house-look-hint">Arraste para olhar em 360° · role para seguir</p>`
  stage.append(controls)
  const toggle = controls.querySelector('.page3-look-toggle')
  const resetButton = controls.querySelector('.page3-look-reset')
  const hint = controls.querySelector('p')
  const yawRotation = new THREE.Quaternion(), pitchRotation = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0)
  const limit = Math.PI * .42
  let available = false, active = false, drag = null, yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0

  const finishDrag = () => {
    if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id)
    drag = null
    section.classList.remove('is-house-dragging')
  }
  const sync = () => {
    controls.hidden = !available
    section.classList.toggle('has-house-look', available)
    section.classList.toggle('is-house-looking', available && active)
    toggle.setAttribute('aria-pressed', String(active))
    resetButton.hidden = !active
    const touch = window.matchMedia('(pointer: coarse)').matches
    hint.textContent = active
      ? touch ? 'Arraste para olhar · volte ao percurso para rolar' : 'Arraste ou use as setas · role para seguir · Esc para voltar'
      : touch ? 'Toque em olhar ao redor · deslize para seguir' : 'Arraste para olhar em 360° · role para seguir'
  }
  const reset = (immediate = false) => {
    const focused = document.activeElement === resetButton
    finishDrag()
    active = false
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw))
    targetYaw = targetPitch = 0
    if (immediate) yaw = pitch = 0
    sync()
    if (focused && available) toggle.focus({ preventScroll: true })
    invalidate()
  }
  const activate = () => { if (available) { active = true; sync(); invalidate() } }
  const onToggle = () => active ? reset() : activate()
  const onReset = () => reset()
  const onDown = event => {
    if (!available || event.button !== 0 || (event.pointerType === 'touch' && !active)) return
    if (drag) return
    activate()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, sensitivity: Math.PI * 2 / Math.max(640, stage.clientWidth) }
    canvas.setPointerCapture(event.pointerId)
    section.classList.add('is-house-dragging')
    event.preventDefault()
  }
  const onMove = event => {
    if (!drag || drag.id !== event.pointerId) return
    const sensitivity = drag.sensitivity
    targetYaw += (event.clientX - drag.x) * sensitivity
    targetPitch = Math.max(-limit, Math.min(limit, targetPitch + (event.clientY - drag.y) * sensitivity))
    drag.x = event.clientX; drag.y = event.clientY
    invalidate()
  }
  const onUp = event => { if (drag?.id === event.pointerId) finishDrag() }
  const onKey = event => {
    if (!available) return
    if (event.key === 'Escape') { reset(); event.preventDefault(); return }
    if (!active || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'Home') { reset(); return }
    if (event.key === 'ArrowLeft') targetYaw += .12
    if (event.key === 'ArrowRight') targetYaw -= .12
    if (event.key === 'ArrowUp') targetPitch += .1
    if (event.key === 'ArrowDown') targetPitch -= .1
    targetPitch = Math.max(-limit, Math.min(limit, targetPitch))
    invalidate()
  }
  // Escape also works after dragging, without taking keyboard focus from the page.
  const onEscape = event => { if (!event.defaultPrevented && active && event.key === 'Escape') reset() }
  toggle.addEventListener('click', onToggle)
  resetButton.addEventListener('click', onReset)
  controls.addEventListener('keydown', onKey)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('lostpointercapture', onUp)
  window.addEventListener('keydown', onEscape)
  window.addEventListener('blur', finishDrag)

  const suspend = () => {
    available = false
    finishDrag()
    active = false
    yaw = pitch = targetYaw = targetPitch = 0
    sync()
  }
  return {
    update({ progress, visible, reduced, dt }) {
      const next = visible && progress >= .5 && progress <= .85
      if (next !== available) {
        available = next
        if (!next) { finishDrag(); active = false; yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw)); targetYaw = targetPitch = 0 }
        sync()
      }
      const damping = reduced ? 1 : 1 - Math.exp(-dt * 20)
      yaw += (targetYaw - yaw) * damping
      pitch += (targetPitch - pitch) * damping
      if (Math.abs(targetYaw - yaw) < .00001) yaw = targetYaw
      if (Math.abs(targetPitch - pitch) < .00001) pitch = targetPitch
      // Fade manual orientation at the doorway and exit, even on a fast scroll.
      const weight = Math.max(0, Math.min(1, (progress - .46) / .04, (.9 - progress) / .05))
      yawRotation.setFromAxisAngle(up, yaw * weight)
      pitchRotation.setFromAxisAngle(right, pitch * weight)
      camera.quaternion.premultiply(yawRotation).multiply(pitchRotation)
    },
    suspend,
    isSettled: () => !drag && Math.abs(targetYaw - yaw) < .0001 && Math.abs(targetPitch - pitch) < .0001,
    inspect: () => ({ available, active, yaw, pitch, targetYaw, targetPitch, dragging: !!drag }),
    dispose() {
      suspend()
      toggle.removeEventListener('click', onToggle)
      resetButton.removeEventListener('click', onReset)
      controls.removeEventListener('keydown', onKey)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('lostpointercapture', onUp)
      window.removeEventListener('keydown', onEscape)
      window.removeEventListener('blur', finishDrag)
      controls.remove()
    },
  }
}
