// Work-completion progress, not a duration estimate. The phase ranges reserve
// 15% for image loads, 25% for static lighting, 40% for uploads/shaders
// and 19% for pipeline warm-up.
// The last percent belongs exclusively to the caller's successful handoff.
const ranges = { textures: [0, 15], lighting: [15, 40], materials: [40, 80], warmup: [80, 99] }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export function createHousePreparation(project) {
  let element = null, progress = null, percentage = null, observer = null
  let value = 0, stage = 'textures', done = 0, total = 0
  let completed = false, faded = false, disposed = false, hideTimer = 0

  const render = () => {
    if (!element) return
    if (progress.value !== value) progress.value = value
    const text = `${value}%`
    if (percentage.textContent !== text) percentage.textContent = text
    element.classList.toggle('is-complete', completed)
    element.classList.toggle('is-concealed', faded)
  }
  const mount = () => {
    if (disposed || element) return !!element
    const copy = project?.querySelector('.hipocampo-page2-copy')
    if (!copy) return false
    element = document.createElement('div')
    element.className = 'house-preparation'
    progress = document.createElement('progress')
    progress.className = 'house-preparation-bar'
    progress.max = 100
    progress.value = value
    progress.setAttribute('aria-label', 'Preparação da experiência 3D')
    percentage = document.createElement('span')
    percentage.className = 'house-preparation-percentage'
    percentage.setAttribute('aria-hidden', 'true')
    element.append(progress, percentage)
    let slot = copy.querySelector('[data-house-preparation-slot]')
    if (!slot) {
      slot = document.createElement('div')
      slot.setAttribute('data-house-preparation-slot', '')
      copy.append(slot)
    }
    slot.append(element)
    render()
    observer?.disconnect()
    observer = null
    project.dispatchEvent(new Event('hipocampo:preparation-mounted'))
    return true
  }
  if (!mount() && project) {
    observer = new MutationObserver(mount)
    observer.observe(project, { childList: true, subtree: true })
  }

  return {
    update(nextStage, completedTasks, totalTasks) {
      if (disposed || completed || !ranges[nextStage]) return
      if (!Number.isFinite(completedTasks) || !Number.isFinite(totalTasks) || totalTasks < 0) return
      stage = nextStage
      done = Math.max(0, completedTasks)
      total = totalTasks
      const fraction = total ? clamp(done / total, 0, 1) : 1
      const [start, end] = ranges[stage]
      // Different image/compile callbacks may resolve out of order. Only a
      // deliberate retry can move the indicator backwards.
      value = Math.max(value, Math.min(99, Math.floor(start + (end - start) * fraction)))
      render()
    },
    complete() {
      if (disposed || completed) return
      completed = true
      value = 100
      render()
      // This timer only retires the finished indicator; it never advances work.
      hideTimer = window.setTimeout(() => {
        hideTimer = 0
        faded = true
        render()
      }, 800)
    },
    retry() {
      if (disposed) return
      window.clearTimeout(hideTimer)
      hideTimer = 0
      value = done = total = 0
      stage = 'textures'
      completed = faded = false
      render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      window.clearTimeout(hideTimer)
      observer?.disconnect()
      observer = null
      element?.remove()
      element = progress = percentage = null
    },
    inspect: () => ({ value, stage, done, total, completed, faded, mounted: !!element, disposed }),
  }
}
