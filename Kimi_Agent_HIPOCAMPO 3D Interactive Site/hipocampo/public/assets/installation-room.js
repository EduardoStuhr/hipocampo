// Editable entry for the installation. The recovered application supplies React;
// the room uses the same local Three.js distribution as the house transition.
import { o as requireReact } from './index-BXEErpTi.js?v=perf-1'
import { createInstallationRoom, FRAGMENTS } from './installation-scene.js?v=client-1'

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
  const [query, setQuery] = React.useState('')
  const [placed, setPlaced] = React.useState([])
  const [message, setMessage] = React.useState('A mesa de luz começa vazia. Escolha objetos do acervo e aproxime-os para criar relações.')
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const matching = FRAGMENTS.filter(fragment => normalize(`${fragment.number || ''} ${fragment.label} ${fragment.islandLabel} ${(fragment.members || []).join(' ')}`).includes(normalize(query)))

  React.useEffect(() => {
    let disposed = false
    let started = false
    const element = root.current
    const controller = new AbortController()
    let idle = 0
    let timer = 0
    const start = async () => {
      if (started || disposed) return
      started = true
      try {
        const instance = await createInstallationRoom(element, {
          onSelect(fragment, atTable) {
            setSelected(fragment.id)
            setPlaced(previous => atTable ? [...new Set([...previous, fragment.id])] : previous.filter(id => id !== fragment.id))
            setMessage(fragment.memory + (atTable ? ' O fragmento agora faz parte da mesa de luz.' : ''))
          },
          onFridgeChange(open) { setFridgeOpen(open) },
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
    // Prepare during idle time, well before scrolling reaches the room. Heavy
    // geometry/shader work is also split into tasks inside the scene builder.
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(start, { timeout: 1800 })
    else timer = window.setTimeout(start, 250)
    return () => {
      disposed = true
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
      controller.abort()
      room.current?.dispose()
      room.current = null
    }
  }, [])

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
    setMessage('A mesa de luz está vazia. Todos os objetos voltaram aos seus lugares.')
  }

  return h('section', { id: 'instalacao', ref: root, className: 'installation', 'aria-labelledby': 'installation-title' },
    h('div', { className: 'installation-heading' },
      h('div', null,
        h('p', { className: 'installation-kicker' }, '03 — instalação virtual'),
        h('h2', { id: 'installation-title' }, 'uma sala, muitas vidas.'),
      ),
      h('p', { className: 'installation-intro' }, 'Escolha os objetos, leve-os até a mesa de luz e invente outras relações.'),
    ),
    h('div', { className: 'installation-toolbar', role: 'group', 'aria-label': 'Controles da sala' },
      h('p', null, 'arraste os objetos para a mesa de luz'),
      h('div', { className: 'installation-actions' },
        h('button', { type: 'button', onClick: () => room.current?.toggleFridge(), 'aria-pressed': fridgeOpen, disabled: !ready || unavailable, 'data-action': 'fridge' }, fridgeOpen ? 'fechar geladeira' : 'abrir geladeira'),
        h('button', { type: 'button', onClick: () => room.current?.resetView(), disabled: !ready || unavailable }, 'visão inicial'),
        h('button', { type: 'button', onClick: reset, 'data-action': 'reset' }, 'recompor a sala'),
      ),
    ),
    h('div', { className: `installation-stage${navigating ? ' is-exploring' : ''}`, 'aria-busy': !ready && !unavailable },
      h('canvas', { className: 'installation-canvas', tabIndex: 0, 'aria-label': 'Sala 3D. Arraste para girar em 360 graus. Botão direito ou Shift e arrastar desloca a câmera. Duplo clique ou Enter ativa a navegação com roda e WASD; Escape libera a rolagem da página.', role: 'group' }),
      h('div', { className: 'installation-zoom', role: 'group', 'aria-label': 'Distância da câmera' },
        h('button', { type: 'button', onClick: () => room.current?.zoom(-1), disabled: !ready || unavailable }, 'aproximar'),
        h('button', { type: 'button', onClick: () => room.current?.zoom(1), disabled: !ready || unavailable }, 'afastar'),
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
      h('p', null, 'gire 360° pelo fundo · botão direito ou Shift + arrastar desloca a câmera · toque nos objetos para descobrir memórias'),
      h('p', null, 'fotografias, matéria e tempo'),
    ),
    h('div', { className: 'installation-memory' },
      h('p', { className: 'installation-memory-label' }, placed.length ? `${placed.length} ${placed.length === 1 ? 'objeto na mesa de luz' : 'objetos na mesa de luz'}` : 'mesa de luz vazia'),
      h('p', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true, className: 'installation-memory-text' }, message),
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
