# QA — instalação HIPOCAMPO

Escopo: implementar a direção artística aprovada como sala WebGL manipulável,
preservando o restante do site. A referência é um conceito de instalação, não
uma captura de uma interface existente que deva substituir a página inteira.

## Evidência e normalização

- Fonte visual: `docs/installation-concept.webp`, 1487 × 1058 px, proporção
  original da imagem gerada nesta conversa.
- Implementação: `docs/installation-preview.webp` e
  `docs/installation-mobile.webp`, capturas reais do canvas no Chromium.
- Desktop: viewport CSS 1592 × 1132, deviceScaleFactor 1; estágio de
  aproximadamente 1496,5 × 960 CSS px. A captura arredonda limites fracionários
  para aproximadamente 1498 × 961 px.
- Mobile: viewport CSS 390 × 844, deviceScaleFactor 1, isMobile/hasTouch;
  estágio de aproximadamente 354 × 670 CSS px.
- Estado comparado: câmera inicial, geladeira aberta, objetos nas ilhas de
  origem. A imagem conceitual foi mantida em sua proporção. Não se distorceu
  nenhuma captura para simular igualdade entre câmera, densidade ou viewport.
- Comparação conjunta: `artifacts/installation/comparison-desktop.png`;
  detalhes de geladeira, mesa de luz e escrivaninha em
  `artifacts/installation/comparison-details.png`.
- Capturas complementares: `desktop-section.png`, `mobile-section.png`,
  `desktop-dragged.png`, `desktop-closed.png`, `hero-before.png`, `hero-after.png`.
  Os artefatos de teste ficam fora do Git e são recriados pelo script de QA.

## Revisão visual

- **Fontes e tipografia:** rótulos dourados em AquilineTwo local; título e
  linguagem manuscrita do projeto preservados; texto de apoio em Georgia,
  controles com foco visível. Rótulos são texto HTML legível e acompanham a
  projeção 3D, sem depender de texto rasterizado na imagem de referência.
- **Espaçamento e composição:** geladeira ao fundo, passado à esquerda,
  presente à direita e mesa de luz central em primeiro plano. Aumentado o
  intervalo entre geladeira e mesa. No mobile, rótulos laterais ficam acima
  dos móveis para não cruzar o vidro claro da mesa. Controles ficam fora dos
  objetos e não interceptam a rolagem do fundo.
- **Cores:** fundo preto; vidro marfim luminoso; madeira marrom; luz fria na
  ilha do passado; âmbar no presente; vermelho no interior da geladeira.
  O vermelho apaga ao fechar a porta. Sombras de contato e focos direcionados
  dão profundidade sem transformar o fundo em uma sala clara.
- **Imagens e materiais:** fotos analógicas existentes no acervo do projeto;
  texturas locais geradas de madeira e esmalte; malhas com espessura, bevels,
  superfícies e sombras reais. A imagem conceitual não é um cenário plano.
  O acabamento é uma adaptação em tempo real: a fotografia cinematográfica do
  conceito não é apresentada como uma reprodução pixel a pixel.
- **Conteúdo:** quatro nomes de ilhas preservados; instruções descrevem as
  interações realmente implementadas; cada fragmento tem uma memória; há
  caminho explícito para explorar sem arrastar e em navegadores sem WebGL.

O cabeçalho global e as outras seções continuam pertencendo ao site existente.
A nova sala não duplica a wordmark nem injeta a navegação da imagem conceitual.

## Histórico de correções

1. `desktop-stage-v1.png`: fotos/negativos da mesa estavam abaixo do vidro
   [P1] e cabideiro/casaco pouco legíveis [P2]. Corrigidos altura dos objetos,
   luz frontal de preenchimento e material do tecido.
2. `stage-1592-v2.png`: ajustados enquadramento, material de esmalte, luz
   vermelha residual com porta fechada e acabamento dos móveis. Trocada a
   tipografia dos rótulos por uma cursiva mais próxima da referência.
3. Comparação de detalhes: rótulos laterais do mobile cruzavam o tampo claro
   [P2] e o rótulo da geladeira ficava próximo demais da mesa [P2]. Corrigidos
   posição dos rótulos no mobile e afastamento da geladeira no desktop.
   Evidência pós-correção: as duas prévias em `docs/`.
4. Teste com reduced motion revelou dependência de um próximo frame para
   alterar a porta [P2]. A mudança de estado passou a ser imediata; o teste
   voltou a passar. Também corrigido o deslocamento por setas durante uma
   transferência, para não deixar o objeto suspenso.

## Verificação funcional

Comandos executados:

```text
node --check public/assets/installation-room.js
node --check public/assets/installation-scene.js
npm run build
python3 tools/installation-qa.py
git diff --check
```

As 30 verificações do navegador passaram: transferência entre ilhas com mouse
e toque nativo, câmera independente, leitura de memória, Enter/setas/Escape,
porta/luz vermelha, objetos internos fora do foco com porta fechada, reset
completo, alternativa sem arrastar, renderização ociosa/fora da tela, movimento
reduzido e fallback sem WebGL. Sem exceções JavaScript ou falhas de recursos
locais. Viewports adicionais: 1366 × 768, 1600 × 900 e 375 × 667, sem overflow.

O ambiente bloqueia dez URLs Unsplash já referenciadas pelo bundle original,
em outras seções. Elas estão discriminadas em `qa-results.json`; não são usadas
pela nova sala, que carrega fotos, fontes, texturas e Three.js locais.

Os arquivos originais das demais seções e o chunk antigo da instalação estão
intactos. Retirar as duas entradas novas do HTML foi verificado como suficiente
para restaurar o HTML anterior byte a byte. Backup remoto:
`backup/instalacao-antes-3d-2026-11-03` → `46f0105`.

## Refinamentos possíveis

- [P3] Substituir os objetos provisórios por modelos/acervo específico quando
  a cliente enviar as fotografias finais; refinar desgaste e tecido a partir
  desse material. As malhas atuais permitem interagir com toda a experiência.
- [P3] Validação em aparelhos físicos e GPUs variadas; o teste touch foi real
  pelo protocolo do Chromium com emulação mobile, não em um telefone físico.

## Checklist de entrega

- Cena e detalhes comparados à referência, inclusive no mobile.
- Funcionalidade, teclado, toque, fallback e build verificados.
- Capturas desktop/mobile e conceito salvos para revisão.
- Backup remoto e instruções de reversão documentados.

final result: passed
