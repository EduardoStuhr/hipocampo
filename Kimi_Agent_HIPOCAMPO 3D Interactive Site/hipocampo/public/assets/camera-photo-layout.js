const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

// Geometry is read once per shot or ResizeObserver update, never on an animation
// frame. Prints stay out of the text, shutter and wordmark, including on mobile.
export function measurePhotoLayout(section, gallery) {
  const rect = gallery.getBoundingClientRect()
  const width = gallery.offsetWidth, height = gallery.offsetHeight
  const sx = rect.width / Math.max(1, width), sy = rect.height / Math.max(1, height)
  const local = r => ({ left: (r.left - rect.left) / sx, top: (r.top - rect.top) / sy, right: (r.right - rect.left) / sx, bottom: (r.bottom - rect.top) / sy })
  const protectedAreas = [...section.querySelectorAll('.page5-text, .page5-camera-control, .page5-camera-hint, .page5-photo-duration, .page5-brand')].map(el => local(el.getBoundingClientRect())).map(r => ({ left: r.left - 12, right: r.right + 12, top: r.top - 12, bottom: r.bottom + 12 }))
  const mobile = matchMedia('(max-width: 760px)').matches
  const left = local(section.querySelector('.page5-left').getBoundingClientRect())
  return {
    width, height, sx, sy, rect, protectedAreas, mobile,
    minX: mobile ? 16 : width * .44,
    minY: mobile ? left.bottom + innerWidth * .08 + 12 : 24,
    visibleTop: Math.max(0, -rect.top / sy),
    visibleBottom: Math.min(height, (innerHeight - rect.top) / sy),
  }
}

export function positionPhoto(layout, size, angle, occupied, sequence) {
  const { width, height, minX, minY } = layout
  const radius = size * (Math.abs(Math.cos(angle * Math.PI / 180)) + Math.abs(Math.sin(angle * Math.PI / 180))) / 2
  const x0 = minX + radius, x1 = Math.max(x0, width - 16 - radius)
  const y0 = minY + radius, y1 = Math.max(y0, height - 16 - radius)
  const viewTop = Math.max(y0, layout.visibleTop + 20 + radius)
  const viewBottom = Math.min(y1, layout.visibleBottom - 20 - radius)
  const low = viewBottom >= viewTop ? viewTop : y0
  const high = viewBottom >= viewTop ? viewBottom : y1
  const anchors = [[0, .08], [1, .13], [1, .92], [0, .85], [.5, .04], [.5, .95], [1, .5], [0, .5]]
  const candidates = anchors.map((_, i) => anchors[(i + sequence) % anchors.length])
  // Extra sample points give narrow viewports alternatives around the wordmark.
  for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) candidates.push([x / 4, y / 4])
  let best = null, bestScore = Infinity
  candidates.forEach(([x, y], i) => {
    const cx = clamp(x0 + x * (x1 - x0) + (i < 8 ? (Math.random() - .5) * 10 : 0), x0, x1)
    const cy = clamp(low + y * (high - low) + (i < 8 ? (Math.random() - .5) * 10 : 0), low, high)
    const bounds = { left: cx - radius, right: cx + radius, top: cy - radius, bottom: cy + radius }
    const blocked = layout.protectedAreas.reduce((sum, area) => sum + overlap(bounds, area), 0)
    const covered = occupied.reduce((sum, area) => sum + overlap(bounds, area), 0)
    const score = blocked * 1000 + covered + i * .01
    if (score < bestScore) { bestScore = score; best = { x: cx, y: cy, bounds } }
  })
  return best
}
