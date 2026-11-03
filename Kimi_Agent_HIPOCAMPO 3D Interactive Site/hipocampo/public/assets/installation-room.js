// Editable entry for the installation. The recovered application supplies React;
// the room uses the same local Three.js distribution as the house transition.
import { o as requireReact } from './index-BXEErpTi.js?v=perf-1'
import { createInstallationRoom, FRAGMENTS } from './installation-scene.js?v=room-1'

const React = requireReact() // Reuse the application's React singleton.
const h = React.createElement

export default function Installation() {
  const root = React.useRef(null)
  const room = React.useRef(null)
  const [ready, setReady] = React.useState(false)
  const [unavailable, setUnavailable] = React.useState(false)
  const [selected, setSelected] = React.useState(null)
  const [fridgeOpen, setFridgeOpen] = React.useState(true)
  const [message, setMessage] = React.useState('Cada objeto guarda uma memória. Aproxime os fragmentos na mesa de luz.')

  React.useEffect(() => {
    let disposed = false
    let started = false
    const element = root.current
    const start = () => {
      if (started || disposed) return
      started = true
      try {
        room.current = createInstallationRoom(element, {
          onSelect(fragment, atTable) {
            setSelected(fragment.id)
            setMessage(fragment.memory + (atTable ? ' O fragmento agora faz parte da mesa de luz.' : ''))
          },
          onFridgeChange(open) { setFridgeOpen(open) },
          onReady() { if (!disposed) setReady(true) },
          onUnavailable() { if (!disposed) setUnavailable(true) },
        })
      } catch (error) {
        console.error('Não foi possível iniciar a instalação.', error)
        setUnavailable(true)
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start()
    }, { rootMargin: '300px' })
    observer.observe(element)
    return () => {
      disposed = true
      observer.disconnect()
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
      setMessage(fragment.memory)
    }
  }
  const reset = () => {
    room.current?.reset()
    setSelected(null)
    setFridgeOpen(true)
    setMessage('A sala foi recomposta. Cada fragmento voltou à sua ilha.')
  }

  return h('section', { id: 'instalacao', ref: root, className: 'installation', 'aria-labelledby': 'installation-title' },
    h('div', { className: 'installation-heading' },
      h('div', null,
        h('p', { className: 'installation-kicker' }, '03 — instalação virtual'),
        h('h2', { id: 'installation-title' }, 'uma sala, muitas vidas.'),
      ),
      h('p', { className: 'installation-intro' }, 'Quatro ilhas, um lugar de encontro. Leve as memórias até a mesa de luz e invente outras relações.'),
    ),
    h('div', { className: 'installation-toolbar', role: 'group', 'aria-label': 'Controles da sala' },
      h('p', null, 'arraste os objetos para a mesa de luz'),
      h('div', { className: 'installation-actions' },
        h('button', { type: 'button', onClick: () => room.current?.toggleFridge(), 'aria-pressed': fridgeOpen, disabled: !ready || unavailable, 'data-action': 'fridge' }, fridgeOpen ? 'fechar geladeira' : 'abrir geladeira'),
        h('button', { type: 'button', onClick: () => room.current?.resetView(), disabled: !ready || unavailable }, 'visão inicial'),
        h('button', { type: 'button', onClick: reset, 'data-action': 'reset' }, 'recompor a sala'),
      ),
    ),
    h('div', { className: 'installation-stage', 'aria-busy': !ready && !unavailable },
      h('canvas', { className: 'installation-canvas', 'aria-label': 'Instalação tridimensional com três mesas, um cabideiro e uma geladeira. Use os objetos ou os controles abaixo para explorar.', role: 'img' }),
      h('div', { className: 'installation-labels', 'aria-hidden': true },
        ...['passado', 'presente', 'futuros', 'temporalidade'].map(island =>
          h('span', { className: 'installation-island', 'data-island': island, key: island }, island === 'futuros' ? 'ilha dos futuros' : island === 'temporalidade' ? 'ilha da temporalidade' : `ilha do ${island}`),
        ),
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
      h('div', { className: 'installation-zoom', role: 'group', 'aria-label': 'Distância da câmera' },
        h('button', { type: 'button', onClick: () => room.current?.zoom(-1), disabled: !ready || unavailable }, 'aproximar'),
        h('button', { type: 'button', onClick: () => room.current?.zoom(1), disabled: !ready || unavailable }, 'afastar'),
      ),
    ),
    h('div', { className: 'installation-caption' },
      h('p', null, 'arraste o fundo para olhar ao redor · toque em um objeto para descobrir sua memória'),
      h('p', null, 'fotografias, matéria e tempo'),
    ),
    h('div', { className: 'installation-memory' },
      h('p', { className: 'installation-memory-label' }, selected ? 'fragmento selecionado' : 'entre vestígios'),
      h('p', { role: 'status', 'aria-live': 'polite', 'aria-atomic': true, className: 'installation-memory-text' }, message),
      selected && h('div', { className: 'installation-memory-actions' },
        h('button', { type: 'button', onClick: () => move(selected) }, 'levar à mesa de luz'),
        h('button', { type: 'button', onClick: () => room.current?.returnToIsland(selected) }, 'devolver à ilha'),
      ),
    ),
    h('details', { className: 'installation-accessible' },
      h('summary', null, 'explorar sem arrastar'),
      h('p', null, 'Escolha um fragmento para ler sua memória e levá-lo à mesa central. Nos objetos da cena, Enter leva à mesa, as setas deslocam e Escape devolve à ilha.'),
      h('ul', null, ...FRAGMENTS.map(fragment => h('li', { key: fragment.id },
        h('button', { type: 'button', onClick: () => move(fragment.id), 'aria-pressed': selected === fragment.id }, fragment.label),
        h('span', null, fragment.islandLabel),
      ))),
    ),
  )
}
