// App must run on :4173. A same-length edit must invalidate gzip and Brotli.
import assert from 'node:assert/strict'
import http from 'node:http'
import { writeFile, rm } from 'node:fs/promises'
import { gunzipSync, brotliDecompressSync } from 'node:zlib'
const file = new URL(`../public/assets/__cache-test-${process.pid}.js`, import.meta.url)
const path = `/assets/__cache-test-${process.pid}.js`
const a = `/*${'a'.repeat(256)}*/`, b = `/*${'b'.repeat(256)}*/`
async function read(encoding, version) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:4173${path}?v=${version}`, { headers: { 'Accept-Encoding': encoding } }, response => {
      const chunks = []
      response.on('data', c => chunks.push(c))
      response.on('end', () => {
        try {
          assert.equal(response.statusCode, 200)
          assert.equal(response.headers['content-encoding'], encoding)
          const packed = Buffer.concat(chunks)
          resolve((encoding === 'br' ? brotliDecompressSync(packed) : gunzipSync(packed)).toString())
        } catch (error) { reject(error) }
      })
    }).on('error', reject)
  })
}
await writeFile(file, a, { flag: 'wx' })
try {
  for (const encoding of ['gzip', 'br']) {
    await writeFile(file, a)
    assert.equal(await read(encoding, 'before'), a)
    await writeFile(file, b)
    assert.equal(await read(encoding, 'after'), b)
    assert.equal(await read(encoding, 'cached'), b)
  }
  console.log('Same-length source edits invalidate gzip/Brotli; cached responses remain correct')
} finally { await rm(file) }
