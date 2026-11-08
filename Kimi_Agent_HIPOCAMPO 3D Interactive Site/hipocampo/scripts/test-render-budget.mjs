import assert from 'node:assert/strict'
import { createRenderBudget } from '../public/assets/render-budget.js'
globalThis.window = { devicePixelRatio: 2 }
const calls = []
const renderer = { setPixelRatio(r) { calls.push(r) }, setSize(w, h, style) { assert.equal(style, false); assert.ok(w > 0 && h > 0) } }
const budget = createRenderBudget(renderer)
budget.resize(1366, 768)
let now = 100
const tick = (dt, count) => { for (let i = 0; i < count; i++) { now += dt; budget.sample(now) } }
tick(16.7, 60)
assert.equal(budget.inspect().pixelRatio, 1.25)
tick(120, 1); tick(16.7, 60)
assert.equal(budget.inspect().pixelRatio, 1.25, 'one hiccup must not degrade resolution')
tick(40, 300)
assert.equal(budget.inspect().pixelRatio, .8)
assert.ok(calls.every(r => r >= .8 && r <= 1.25))
const adjustments = budget.inspect().adjustments
budget.reset(); now += 120000; budget.sample(now)
assert.equal(budget.inspect().adjustments, adjustments, 'idle gap must not count as a slow frame')
tick(16.7, 1800)
assert.equal(budget.inspect().pixelRatio, 1.25, 'quality must recover after sustained fast frames')
window.devicePixelRatio = .6
budget.resize(800, 600); tick(100, 90)
assert.equal(budget.inspect().pixelRatio, .6, 'never supersample beyond native DPR')
console.log('Render budget: sustained load, hysteresis, idle reset and recovery passed')
