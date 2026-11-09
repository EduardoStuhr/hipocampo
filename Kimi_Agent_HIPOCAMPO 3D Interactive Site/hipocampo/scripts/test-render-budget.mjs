import assert from 'node:assert/strict'
import { createRenderBudget } from '../public/assets/render-budget.js'
globalThis.window = { devicePixelRatio: 2 }

function fixture(options) {
  const calls = []
  const renderer = {
    setPixelRatio(ratio) { calls.push(ratio) },
    setSize(w, h, style) { assert.equal(style, false); assert.ok(w > 0 && h > 0) },
  }
  const budget = createRenderBudget(renderer, options)
  budget.resize(1366, 768)
  let now = 0
  budget.sample(now)
  return {
    budget, calls,
    tick(dt, count = 1, rendered = true) {
      for (let i = 0; i < count; i++) { now += dt; budget.sample(now, rendered) }
    },
  }
}

const sustained = fixture()
sustained.tick(16.7, 60)
sustained.tick(120)
sustained.tick(16.7, 60)
assert.equal(sustained.budget.inspect().pixelRatio, 1.25, 'one hiccup must not degrade resolution')
sustained.tick(40, 300)
assert.equal(sustained.budget.inspect().pixelRatio, .8, 'sustained render load must lower quality')
assert.ok(sustained.calls.every(r => r >= .8 && r <= 1.25))

// A held, stationary gesture still schedules RAFs, but renders no scene.
// It must neither recover quality nor contribute old idle time to the next dt.
sustained.tick(16.7, 900, false)
assert.equal(sustained.budget.inspect().pixelRatio, .8, 'idle RAFs must not count as fast renders')
sustained.tick(16.7, 179)
assert.equal(sustained.budget.inspect().pixelRatio, .8, 'recovery needs 180 rendered fast frames')
sustained.tick(16.7)
assert.equal(sustained.budget.inspect().pixelRatio, .95, '180 real fast frames must permit recovery')
sustained.tick(16.7, 179)
sustained.tick(6000, 1, false)
sustained.tick(16.7)
assert.equal(sustained.budget.inspect().pixelRatio, .95, 'idle frame breaks the recovery streak')

const slowAcrossIdle = fixture()
slowAcrossIdle.tick(40, 5)
slowAcrossIdle.tick(6000, 1, false)
assert.equal(slowAcrossIdle.budget.inspect().pixelRatio, 1.25, 'idle RAF must not trigger an adjustment')
slowAcrossIdle.tick(16.7)
assert.equal(slowAcrossIdle.budget.inspect().pixelRatio, 1.25, 'idle gap must not inflate the next rendered interval')
slowAcrossIdle.tick(40, 2)
assert.equal(slowAcrossIdle.budget.inspect().pixelRatio, 1.1, 'idle RAF must preserve prior slow-frame evidence')

const paused = fixture()
paused.tick(40, 5)
paused.budget.reset()
paused.tick(120000)
paused.tick(40)
assert.equal(paused.budget.inspect().pixelRatio, 1.25, 'reset must ignore pause and clear stale slow-frame evidence')

const islands = fixture({ maxPixelRatio: 1, minPixelRatio: .65 })
assert.equal(islands.budget.inspect().pixelRatio, 1, 'islands can cap DPR independently')
islands.tick(40, 300)
assert.equal(islands.budget.inspect().pixelRatio, .65, 'islands can use a lower floor under sustained load')
assert.ok(islands.calls.every(r => r >= .65 && r <= 1))
islands.tick(16.7, 1800)
assert.equal(islands.budget.inspect().pixelRatio, 1, 'recovery must respect configured maximum')

window.devicePixelRatio = .6
islands.budget.resize(800, 600)
islands.tick(100, 90)
assert.equal(islands.budget.inspect().pixelRatio, .6, 'never supersample beyond native DPR even below the configured floor')
console.log('Render budget: sustained load, rendered-only recovery, idle clock, reset and per-scene bounds passed')
