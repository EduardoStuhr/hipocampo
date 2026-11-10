// Editable entry for the installation. The recovered application supplies React;
// the room uses the same local Three.js distribution as the house transition.
import { o as requireReact } from './index-BXEErpTi.js?v=perf-1'
import { createInstallationRoom, FRAGMENTS } from './installation-scene.js?v=client-audio-1'
import { yieldScenePreparation } from './scene-preparation.js?v=scroll-start-1'

const React = requireReact() // Reuse the application's React singleton.
const h = React.createElement

export default function Installation() {
  const root = React.useRef(null)
  const room = React.useRef(null)
  const [ready, setReady] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)
  const [selected, setSelected] = React.useState(null)
  const [fridgeOpen, setFridgeOpen] = React.useState(true)
  const [navigating, setNavigating] = React.useState(false)
  const [topView, setTopView] = React.useState(false)
  const [capturing, setCapturing] = React.useState(false)
  const [photo, setPhoto] = React.useState(null)
  const [photoMessage, setPhotoMessage] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [placed, setPlaced] = React.useState([])
  const [message, setMessage] = React.useState('')
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matching = FRAGMENTS.filter(fragment => normalize(`${fragment.number || ''} ${fragment.label} ${fragment.islandLabel} ${(fragment.members || []).join(' ')}`).includes(normalize(query)))

  React.useEffect(() => {
    let disposed = false
    let started = false
    const element = root.current
    const controller = new AbortController()
    const start = async () => {
      if (started || disposed) return
      started = true
      try {
        await yieldScenePreparation(controller.signal)
        const instance = await createInstallationRoom(element, {
          onSelect(fragment, atTable) {
            setSelected(fragment.id)
            setPlaced(previous => atTable ? [...new Set([...previous, fragment.id])] : previous.filter(id => id !== fragment.id))
            setMessage(fragment.memory + (atTable ? ' O fragmento agora faz parte da mesa de luz.' : ''))
          },
          onFridgeChange(open) { setFridgeOpen(open) },
          onViewChange(active) { if (!disposed) setTopView(active) },
          onNavigationChange(active) { if (!disposed) setNavigating(active) },
          onReady() { if (!disposed) setReady(true) },
          onUnavailable() { if (!disposed) setUnavailable(true) },
        }, { signal: controller.signal })
        if (disposed) instance.dispose()
        else room.current = instance
      } catch (error) {
        if (disposed || error.name === 'AbortError') return
        console.error('Não foi possível iniciar a instalação.', error)
        setUnavailable(true)
      }
    }
    // Start before the visitor reaches the room, after the opening chapters.
    // An idle timeout at page load used to compile this entire second WebGL
    // scene during the white circle, blocking scrolling for over a second.
    const approach = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      approach.disconnect()
      start()
    }, { rootMargin: `${Math.round(window.innerHeight * 3)}px 0px` })
    approach.observe(element)
    return () => {
      disposed = true
      approach.disconnect()
      controller.abort()
      room.current?.dispose()
      room.current = null
    }
  }, [])

  React.useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url) }, [photo])
  const takePhoto = async () => {
    if (!room.current || capturing) return
    setCapturing(true)
    setPhotoMessage('Preparando sua fotografia…')
    try {
      const blob = await room.current.photographTable()
      if (!root.current) return
      const name = `hipocampo-minha-mesa-${new Date().toISOString().replace(/[:.]/g, '-')}.png`
      const url = URL.createObjectURL(blob)
      setPhoto({ url, name })
      const download = document.createElement('a')
      download.href = url
      download.download = name
      document.body.append(download)
      download.click()
      download.remove()
      setPhotoMessage('Foto pronta. O download foi solicitado.')
    } catch (error) {
      setPhotoMessage(error.message || 'Não foi possível fotografar agora. Tente novamente.')
    } finally {
      setCapturing(false)
    }
  }
  const move = (id) => {
    room.current?.moveToTable(id)
    // The accessible path also works when WebGL is unavailable.
    if (!room.current) {
      const fragment = FRAGMENTS.find(item => item.id === id)
      setSelected(id)
      setPlaced(previous => [...new Set([...previous, id])])
      setMessage(fragment.memory + ' O objeto foi incluído na sua seleção.')
    }
  }
  const reset = () => {
    room.current?.reset()
    setSelected(null)
    setFridgeOpen(true)
    setPlaced([])
    setMessage('')
  }

  return h('section', { id: 'instalacao', ref: root, className: 'installation', 'aria-labelledby': 'installation-title' },
    h('div', { className: 'installation-heading' },
      h('div', null,
        h('p', { className: 'installation-kicker' }, '03 — instalação virtual'),
        h('h2', { id: 'installation-title' }, 'uma sala, muitas vidas.'),
      ),
    ),
    h('div', { className: 'installation-toolbar', role: 'group', 'aria-label': 'Controles da sala' },
      h('div', { className: 'installation-actions' },
        h('button', { type: 'button', onClick: () => room.current?.toggleFridge(), 'aria-pressed': fridgeOpen, disabled: !ready || unavailable, 'data-action': 'fridge' }, fridgeOpen ? 'fechar geladeira' : 'abrir geladeira'),
        h('button', { type: 'button', onClick: () => room.current?.resetView(), disabled: !ready || unavailable }, 'visão inicial'),
        h('button', { type: 'button', onClick: reset, 'data-action': 'reset' }, 'recompor a sala'),
      ),
    ),
    h('div', { className: `installation-stage${navigating ? ' is-exploring' : ''}`, 'aria-busy': !ready && !unavailable },
      h('canvas', { className: 'installation-canvas', tabIndex: 0, 'aria-label': 'Sala 3D. Arraste para girar em 360 graus. Botão direito ou Shift e arrastar desloca a câmera. Duplo clique ou Enter ativa a navegação com roda e WASD; Escape libera a rolagem da página.', role: 'group' }),
      h('div', { className: 'installation-zoom', role: 'group', 'aria-label': 'Câmera e fotografia da mesa' },
        h('button', { type: 'button', onClick: () => room.current?.zoom(-1), disabled: !ready || unavailable }, 'aproximar'),
        h('button', { type: 'button', onClick: () => room.current?.zoom(1), disabled: !ready || unavailable }, 'afastar'),
        h('button', { type: 'button', onClick: () => room.current?.setTopView(!topView), 'aria-pressed': topView, disabled: !ready || unavailable, 'data-action': 'top-view' }, topView ? 'voltar à sala' : 'visão de cima'),
        h('button', { type: 'button', onClick: takePhoto, disabled: !ready || unavailable || capturing, 'data-action': 'take-photo' }, capturing ? 'fotografando…' : 'tirar foto'),
      ),
      h('div', { className: 'installation-hit-targets' },
        ...FRAGMENTS.map(fragment => h('button', {
          key: fragment.id, type: 'button', className: 'installation-object',
          'data-object': fragment.id, disabled: !ready || unavailable,
          'aria-label': `${fragment.label}. Enter leva à mesa de luz; setas deslocam; Escape devolve à ilha.`,
          'aria-pressed': selected === fragment.id,
        }, h('span', { className: 'installation-object-caption' }, fragment.label))),
        h('button', { type: 'button', className: 'installation-fridge-hit', 'aria-label': fridgeOpen ? 'Fechar a porta da geladeira' : 'Abrir a porta da geladeira', 'aria-pressed': fridgeOpen, disabled: !ready || unavailable }),
      ),
      !ready && !unavailable && h('p', { className: 'installation-loading', role: 'status' }, 'acendendo as luzes…'),
      unavailable && h('div', { className: 'installation-fallback', role: 'status' },
        h('p', null, 'A sala 3D não está disponível neste navegador.'),
        h('p', null, 'Você pode conhecer os objetos e suas memórias em “explorar sem arrastar”, abaixo.'),
        h('button', { type: 'button', onClick: () => window.location.reload() }, 'tentar novamente'),
      ),
    ),
    h('div', { className: 'installation-caption' },
      h('p', null, 'fotografias, matéria e tempo'),
    ),
    h('div', { className: 'installation-photo-result', role: 'status', 'aria-live': 'polite', 'aria-atomic': true },
      photoMessage && h('p', null, photoMessage),
      photo && h('a', { href: photo.url, download: photo.name }, 'baixar foto da mesa'),
    ),
    h('div', { className: 'installation-memory' },
      h('p', { className: 'installation-memory-label' }, placed.length ? `${placed.length} ${placed.length === 1 ? 'objeto na mesa de luz' : 'objetos na mesa de luz'}` : 'mesa de luz vazia'),
      message && h('p', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true, className: 'installation-memory-text' }, message),
      selected && h('div', { className: 'installation-memory-actions' },
        h('button', { type: 'button', onClick: () => move(selected) }, 'levar à mesa de luz'),
        h('button', { type: 'button', onClick: () => room.current?.returnToIsland(selected) }, 'devolver à ilha'),
      ),
    ),
    h('details', { className: 'installation-accessible' },
      h('summary', null, 'explorar sem arrastar'),
      h('p', null, 'Escolha um fragmento para ler sua memória e levá-lo à mesa central. Nos objetos da cena, Enter leva à mesa, as setas deslocam e Escape devolve à ilha.'),
      h('label', { className: 'installation-search-label', htmlFor: 'installation-search' }, 'buscar no acervo'),
      h('input', { id: 'installation-search', className: 'installation-search', type: 'search', value: query, onChange: event => setQuery(event.target.value), placeholder: 'objeto, número ou conjunto' }),
      h('p', { className: 'installation-search-count', role: 'status' }, `${matching.length} ${matching.length === 1 ? 'objeto' : 'objetos'}`),
      h('ul', null, ...matching.map(fragment => h('li', { key: fragment.id },
        h('button', { type: 'button', onClick: () => move(fragment.id), 'aria-pressed': selected === fragment.id }, fragment.label),
        h('span', null, fragment.number ? `${String(fragment.number).padStart(2, '0')} · ${fragment.islandLabel}` : fragment.islandLabel),
      ))),
    ),
  )
}
