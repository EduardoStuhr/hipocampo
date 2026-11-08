// Adapt only the WebGL drawing buffer after sustained slow frames. Textures,
// CSS layout and exported photographs retain their original resolution.
export function createRenderBudget(renderer) {
  let width = 1, height = 1
  let maximum = Math.min(window.devicePixelRatio || 1, 1.25)
  let ratio = maximum, last = 0, slow = 0, fast = 0, changedAt = -Infinity
  let adjustments = 0
  const apply = next => {
    ratio = Math.round(next * 100) / 100
    renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    adjustments++
  }
  return {
    resize(w, h) {
      width = Math.max(1, w); height = Math.max(1, h)
      maximum = Math.min(window.devicePixelRatio || 1, 1.25)
      ratio = Math.min(ratio, maximum)
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      this.reset()
    },
    reset() { last = 0; slow = fast = 0 },
    sample(now) {
      if (!last) { last = now; return false }
      const dt = now - last
      last = now
      if (dt <= 0) return false
      slow = dt > 25 ? slow + 1 : Math.max(0, slow - 1)
      fast = dt < 19 ? fast + 1 : 0
      const minimum = Math.min(maximum, .8)
      if (slow >= 6 && now - changedAt >= 2000 && ratio > minimum) {
        apply(Math.max(minimum, ratio - .15))
        slow = fast = 0; changedAt = now
        return true
      }
      // Recovery is deliberately slower to avoid repeated buffer reallocations.
      if (fast >= 180 && now - changedAt >= 6000 && ratio < maximum) {
        apply(Math.min(maximum, ratio + .15))
        slow = fast = 0; changedAt = now
        return true
      }
      return false
    },
    inspect: () => ({ pixelRatio: ratio, maximum, adjustments }),
  }
}
