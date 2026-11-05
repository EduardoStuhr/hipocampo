// Numbering and grouped photographs supplied by Beatriz on 4 November 2026.
// Set image to the client's photograph; it replaces the study mesh as one print.
const entries = [
  ['Casaco, camiseta e bolsa', 'clothes', ['casaco', 'camiseta', 'bolsa']],
  ['Cartão-postal 1', 'postcard'], ['Cartão-postal 2', 'postcard'],
  ['Linha, agulha e tecido', 'sewing', ['linha', 'agulha', 'tecido']],
  ['Carta 1', 'letter'], ['Carta 2', 'letter'], ['Carta 3', 'letter'],
  ['Diário', 'book'], ['Giz', 'chalk'], ['Desenhos', 'drawing'],
  ['Câmera de brinquedo', 'camera'], ['Boneca de espiga de milho', 'doll'],
  ['Lata de comida', 'tin'], ['Toca-discos', 'turntable'],
  ...Array.from({ length: 6 }, (_, i) => [`Vinil ${i + 1}`, 'vinyl']),
  ['Pregador', 'peg'], ['Bicho de pelúcia', 'plush'],
  ['Álbum de fotos', 'book'], ['Fotografias separadas', 'photo'], ['Fotografias reunidas', 'photo'],
  ...Array.from({ length: 5 }, (_, i) => [`Porta-retrato ${i + 1}`, 'frame']),
  ...Array.from({ length: 5 }, (_, i) => [`Livro ${i + 1}`, 'book']),
  ['Relógio', 'clock'], ['Caixa de remédio', 'box'], ['Lata de Amélie', 'tin'],
  ['Câmera', 'camera'], ['Jornal', 'newspaper'], ['Avental de açougueiro', 'apron'],
  ['Toca-fitas', 'player'], ['Fita 1', 'cassette'], ['Fita 2', 'cassette'],
  ...Array.from({ length: 5 }, (_, i) => [`Documento ${i + 1}`, 'document']),
  ['Porta-lápis', 'pencils'], ['Caderno', 'book'], ['Porta-joias', 'box'],
  ['Revista 1', 'magazine'], ['Revista 2', 'magazine'], ['Estatueta', 'statue'],
  ['Frasco de perfume', 'perfume'], ['Broches', 'brooch'], ['Isqueiro', 'lighter'],
  ['Luminária', 'lamp'], ['Talheres', 'cutlery'], ['Lápis e caneta', 'pencil'],
  ['Carteira', 'wallet'], ['Escova de cabelo', 'brush'], ['Óculos', 'glasses'],
  ['Pôsteres', 'poster'], ['Garrafa', 'bottle'],
  ['Santinho 1', 'holy-card'], ['Santinho 2', 'holy-card'],
  ['Par de sapatos de criança', 'shoes', ['sapato esquerdo', 'sapato direito']],
  ['Rádio', 'radio'], ['Xícaras', 'cups'], ['CD', 'cd'], ['Cinzeiro', 'ashtray'],
  ['Porta-chaves', 'keys'], ['Ukulele', 'ukulele'],
]

const past = new Set([1, 41, 57, 62, 63, 64, 69])
const paperKinds = new Set(['postcard', 'letter', 'drawing', 'photo', 'document', 'newspaper', 'poster', 'holy-card'])
const category = { past: 'roupas e acessórios', present: 'livros, fotografias e objetos', fridge: 'químicos' }
let bookIndex = 0, paperIndex = 0, frameIndex = 0, propIndex = 0, pastIndex = 0

export const COLLECTION = entries.map(([label, kind, members], index) => {
  const number = index + 1, island = past.has(number) ? 'past' : 'present'
  const definition = {
    id: `objeto-${String(number).padStart(2, '0')}`, number, label, kind, members: members || [label],
    island, islandLabel: category[island], image: null,
    memory: label + (members ? ' — um único conjunto do acervo.' : ' — objeto do acervo.'),
    angle: ((index % 5) - 2) * .06, sourceScale: .4, tableRotation: [0, 0, 0],
  }
  if (island === 'past') {
    const i = pastIndex++
    definition.position = [.65 + ((i % 3) - 1) * .32, 1.44, .06 + Math.floor(i / 3) * .25]
    definition.sourceScale = .6
    if (number === 1) definition.tableRotation = [-Math.PI / 2, 0, 0]
    if (number === 41) { definition.tableRotation = [-Math.PI / 2, 0, 0]; definition.sourceRotation = [-Math.PI / 2, 0, -.08] }
    if (number === 69) { definition.position = [.65, .035, .78]; definition.sourceScale = .85 }
  } else if (kind === 'book' || kind === 'magazine') {
    const i = bookIndex++
    definition.position = [-.96 + i * .2, 2.82, -.42]
    definition.sourceRotation = [0, 0, Math.PI / 2]
    definition.sourceScale = .65
  } else if (kind === 'frame') {
    definition.position = [-.96 + frameIndex++ * .48, 1.57, -.49]
    definition.tableRotation = [-Math.PI / 2, 0, 0]
    definition.sourceScale = .48
  } else if (paperKinds.has(kind)) {
    const i = paperIndex++
    definition.position = [-.85 + (i % 4) * .56, 1.575 + Math.floor(i / 4) * .008, .43]
    definition.sourceScale = .55
  } else {
    const i = propIndex++
    definition.position = [-1.05 + (i % 7) * .35, 1.57, -.42 + Math.floor(i / 7) * .17]
  }
  if (number >= 5 && number <= 7) definition.sharedSetup = 'cartas'
  // One entry per CD photograph when their final count and images arrive.
  if (number === 72) { definition.photoMode = 'one-per-cd'; definition.variants = [] }
  return definition
})

export function expandCollection(collection) {
  return collection.flatMap(item => item.variants?.length
    ? item.variants.map((variant, i) => ({ ...item, ...variant, position: variant.position || [item.position[0], item.position[1] + i * .008, item.position[2]], id: `${item.id}-${i + 1}`, label: variant.label || `${item.label} ${i + 1}` }))
    : [item])
}

const chemicals = [
  { id: 'frasco-ambar', label: 'Químico em frasco âmbar', color: '#653115', size: .7, position: [.22, .49, .26] },
  { id: 'frasco-claro', label: 'Químico em frasco claro', color: '#8eafa8', size: .62, position: [-.27, .49, .08] },
  { id: 'frasco-quimico-3', label: 'Frasco de químico 3', color: '#69271b', size: .65, position: [-.25, 1.1, .06] },
  { id: 'frasco-quimico-4', label: 'Frasco de químico 4', color: '#918f7c', size: .6, position: [.26, 1.1, .06] },
].map(item => ({ ...item, kind: 'chemical', island: 'fridge', islandLabel: category.fridge, sourceScale: 1, tableRotation: [0, 0, 0], memory: item.label + ' — material do espaço de processamento fotográfico.' }))

export const FRAGMENTS = [...expandCollection(COLLECTION), ...chemicals]
