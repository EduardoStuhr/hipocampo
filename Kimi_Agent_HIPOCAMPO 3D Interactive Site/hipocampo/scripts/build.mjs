import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.dirname(scriptsDirectory)
const publicRoot = path.join(projectRoot, 'public')
const outputRoot = path.join(projectRoot, 'dist')

rmSync(outputRoot, { force: true, recursive: true })
mkdirSync(outputRoot, { recursive: true })
cpSync(publicRoot, outputRoot, { recursive: true })

// Keep source URLs available for development and older HTML, while each new
// production page loads team assets by content hash (including its manifest).
function writeVersionedAsset(name, contents) {
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 12)
  const extension = path.extname(name)
  const versionedName = `${path.basename(name, extension)}-${hash}${extension}`
  writeFileSync(path.join(outputRoot, 'assets', versionedName), contents)
  return versionedName
}
const manifest = writeVersionedAsset('team-members.js', readFileSync(path.join(publicRoot, 'assets/team-members.js'), 'utf8'))
const teamSource = readFileSync(path.join(publicRoot, 'assets/team-finale.js'), 'utf8')
  .replace(/\.\/team-members\.js(?:\?[^'"]*)?/, `./${manifest}`)
const teamScript = writeVersionedAsset('team-finale.js', teamSource)
const teamStyles = writeVersionedAsset('team-finale.css', readFileSync(path.join(publicRoot, 'assets/team-finale.css'), 'utf8'))
const html = readFileSync(path.join(projectRoot, 'index.html'), 'utf8')
  .replace(/\/assets\/team-finale\.js(?:\?[^"]*)?/, `/assets/${teamScript}`)
  .replace(/\/assets\/team-finale\.css(?:\?[^"]*)?/, `/assets/${teamStyles}`)
writeFileSync(path.join(outputRoot, 'index.html'), html)

console.log('Build estático criado em ' + outputRoot)
