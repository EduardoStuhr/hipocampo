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
python3 tools/installation-navigation-qa.py
python3 tools/installation-entry-profile.py
git diff --check
```

As 30 verificações de regressão do navegador passaram: transferência entre ilhas com mouse
e toque nativo, câmera independente, leitura de memória, Enter/setas/Escape,
porta/luz vermelha, objetos internos fora do foco com porta fechada, reset
completo, alternativa sem arrastar, renderização ociosa/fora da tela, movimento
reduzido e fallback sem WebGL. Sem exceções JavaScript ou falhas de recursos
locais. Viewports adicionais: 1366 × 768, 1600 × 900 e 375 × 667, sem overflow.

O ambiente bloqueia dez URLs Unsplash já referenciadas pelo bundle original,
em outras seções. Elas estão discriminadas em `qa-results.json`; não são usadas
pela nova sala, que carrega fotos, fontes, texturas e Three.js locais.

O chunk antigo da instalação, os bundles recuperados e os layouts das demais
seções estão intactos. Na entrega original, retirar as duas entradas novas do
HTML foi verificado como suficiente para restaurar seu estado anterior. Backup:
`backup/instalacao-antes-3d-2026-11-03` → `46f0105`.

## Revisão de entrada, imersão e saída

- Giro horizontal livre, demonstrado por gesto real de mouse de 16,18 radianos
  (mais de duas voltas), sem mover os fragmentos. Pan por botão direito/meio ou
  Shift, zoom até perto dos móveis e movimento suave por câmera amortecida.
- Modo explorar com roda, WASD/QE/setas e toque; Escape e saída da seção limpam
  as capturas de ponteiro e `data-lenis-prevent`. Nenhum bloqueio de body ou
  pin de scroll foi acrescentado.
- Barra de saída permanece dentro da área visível da sala. A geometria é
  medida no ResizeObserver de layout; o handler de scroll usa o cache local.
  Resize no mesmo breakpoint preserva a posição de câmera escolhida.
- “Seguir para os fragmentos” usa o Lenis existente, evitando disputa entre
  salto nativo e interpolação. O único ajuste em `hero-motion.js` retira a
  exceção permanente para todo canvas da instalação; a reserva passa a valer
  somente no modo explorar. A animação da hero não foi modificada.
- Os 22 checks de navegação também passaram: 360°, pan, zoom, WASD, liberação
  por Escape, rolagem normal após sair, chegada e rolagem na próxima seção,
  resize, saída da tela e passagem no mobile. Total: 52 checks funcionais.
- Evidência: `artifacts/installation-navigation/cached-entry.png`,
  `orbit-360.png`, `next-section.png` e `navigation-results.json`.
- Perfil A/B no mesmo Chromium com SwiftShader e viewport 1366 × 768: quadro
  mais longo da entrada caiu de 1283,2 ms para 33,4 ms; versão atual preparada
  antes da aproximação, sem long tasks ou reversões de scroll. Os dados estão
  em `entry-comparison.json`, `entry-baseline.json` e `entry-current.json`.
  Isso mede esse ambiente, não garante o mesmo FPS em GPUs diferentes.
- A preparação de geometrias é dividida em tarefas ociosas; upload, shaders,
  shadow maps e buffer real são aquecidos antecipadamente, com fence consultada
  sem bloquear. O quadro pronto é mantido, evitando renderização redundante
  na primeira entrada e em reentradas estáticas. A renderização continua
  interrompida fora da tela.
- Backup antes desta correção: `backup/instalacao-antes-camera-2026-11-03`
  → `b8dc907`; nova tag: `release/instalacao-camera-2026-11-03`.

## Refinamentos possíveis

- [P3] Substituir os objetos provisórios por modelos/acervo específico quando
  a cliente enviar as fotografias finais; refinar desgaste e tecido a partir
  desse material. As malhas atuais permitem interagir com toda a experiência.
- [P3] Validação em aparelhos físicos e GPUs variadas; o teste touch foi real
  pelo protocolo do Chromium com emulação mobile, não em um telefone físico.

## Ajuste de controles — 4 de novembro de 2026

“Aproximar” e “afastar” foram movidos para o alto, no lugar do bloco antigo.
Removidos os dois CTAs e a dica mostrados na segunda imagem da solicitação.
O giro 360° e o pan continuam disponíveis. A ativação da navegação avançada
passou para duplo clique/Enter, com Escape para liberar a rolagem.

Validação focada em 1600 × 900 e 390 × 844: ambos os botões visíveis no alto,
aproximar/afastar efetivos, bloco removido, Enter/Escape e duplo clique
funcionando, página rolando após sair, sem exceções JavaScript. Capturas antes
e depois e resultados em `artifacts/installation-controls/`. Build e sintaxe
verificados. A matriz de 52 checks acima registra a entrega anterior; esta
alteração teve verificação focada no comportamento afetado.

## Checklist de entrega

- Cena e detalhes comparados à referência, inclusive no mobile.
- Funcionalidade, teclado, toque, fallback e build verificados.
- Capturas desktop/mobile e conceito salvos para revisão.
- Backup remoto e instruções de reversão documentados.

final result: passed



## Revisão adicional — câmera e recortes geométricos (5/11/2026)

Escopo desta entrega: somente o disparador da câmera na seção Vestígios.
O usuário escolheu a interação da câmera da prévia e pediu fotos existentes,
recortes diferentes por clique e nenhuma ação nova no envelope. O restante da
composição mantém o layout anterior; não se trata de clonar toda a prévia.

### Evidência desta revisão

- Conceito selecionado: `/workspace/generated_images/exec-cd268ac6-af4c-49de-b203-2dd7d1858e6a.png`,
  921×1708 px, mostrado na conversa; referência da interação da metade inferior.
- Fonte de layout: `artifacts/camera-photos/before-1366.png`, captura anterior
  desta mesma seção em viewport CSS 1366×900, deviceScaleFactor 1.
- Implementação: `artifacts/camera-photos/after-desktop-3.png` após três cliques
  reais e `artifacts/camera-photos/after-mobile.png` após toque, em 375×667.
- Antes/depois do desktop: 1366×901 pixels; captura completa da seção móvel:
  375×915 pixels, viewport CSS 375×667 e deviceScaleFactor 1, sem moldura de aparelho.
- Comparação conjunta: `artifacts/camera-photos/comparison.png`. Antes e depois
  da seção foram reduzidos proporcionalmente para até 1000×660 px e colocados
  lado a lado; não se esticaram imagens para forçar alinhamento.
- A prévia conceitual longa não tem o mesmo viewport da seção real. Sua câmera
  e a função de revelar uma nova fotografia foram comparadas por componente;
  o texto menor, o envelope e o gesto de arrastar da prévia não foram adotados.
- As capturas de desktop e mobile foram abertas e inspecionadas; a câmera
  original `public/images/vestigios/camera-topo.webp` também foi inspecionada
  para localizar seu disparador real em 78,9% × 67,8% da imagem.

### Cinco superfícies de fidelidade

- **Tipografia:** preservadas AquilineTwo e SquidBoy locais, título e texto
  existentes. A indicação “gerar fotografia” usa a cursiva azul do projeto.
- **Espaçamento:** câmera, texto e colagem mantêm suas regiões. A nova pilha
  ocupa espaço sobre o filme e deixa a marca azul em primeiro plano. No celular,
  a foto revelada fica visível após tocar no disparador; não há overflow.
- **Cores:** fundo branco, texto marrom e indicação azul preservados. Sombras
  discretas acompanham os recortes de papel.
- **Imagens:** câmera original e nove fotografias locais, sem substitutos
  gerados. Oito máscaras recortam fotografia e papel conforme o pedido. Três
  camadas limitam o acúmulo. As diferenças em relação à moldura retangular da
  prévia são intencionais e seguem a solicitação posterior do usuário.
- **Conteúdo:** texto original preservado. Apenas a ação “gerar fotografia” e
  a descrição acessível da nova fotografia foram adicionadas.

### Histórico e resultado

- Na primeira conferência, a imagem lazy ainda não possuía altura ao medir o
  alvo. Foram reservadas as dimensões reais, 1259×717, e a proporção do controle.
  As capturas pós-correção e o teste da posição do disparador confirmam o ajuste.
- Passaram 24 verificações da câmera: alvo real, áreas inativas, recortes,
  fotografias, teclado, toque, sequência rápida, limite de camadas, movimento
  reduzido, falha/recuperação de imagem, rolagem e próxima seção. Sem exceções
  JavaScript ou falhas de recursos locais nas visitas normais.
- Passaram novamente as 17 verificações da primeira rolagem, com cache
  desabilitado, desktop e viewport móvel com CPU limitada.
- Não há divergência P0/P1/P2 pendente dentro deste escopo. O sorteio pode
  repetir uma forma após completar sua rodada, sempre evitando repetir a anterior.
- Build, sintaxe e comparação visual aprovados. Prévias reais em
  `docs/camera-photos-preview.webp` e `docs/camera-photos-mobile.webp`.

final result: passed

## Revisão adicional — paleta e fotografias passageiras (5/11/2026)

O usuário aprovou a última prévia colorida, pediu que o texto marrom da
apresentação continuasse igual e autorizou espalhar mais as fotografias da câmera,
removendo cada uma após cinco segundos. O escopo mantém as fontes, o texto principal,
o envelope e os controles existentes. A distribuição das fotos é adaptativa;
não há obrigação de copiar as coordenadas fixas do conceito gerado.

### Evidência desta revisão

- Conceito aprovado: `docs/color-story-concept.webp`, 921×1707 px, derivado de
  `/workspace/generated_images/exec-57194bf0-b182-4a67-ae01-ead318b7b7c2.png`.
- Estado anterior: `artifacts/color-story/before-sobre-1366.png` e
  `before-vestigios-1366.png`, composição branca anterior à entrega.
- Capturas reais: `artifacts/color-story/after-sobre-1366.png` e
  `after-vestigios-1366.png`, viewport CSS 1366×900 e deviceScaleFactor 1.
  Foram combinadas verticalmente em `docs/color-story-preview.webp`, 1366×1800.
- Mobile: viewport 390×844 para apresentação, cores e toque; captura da câmera
  em contexto novo de 375×667 em `docs/color-story-mobile.webp`. Desktop adicional
  de 1600×900 para overflow. Capturas sem moldura de aparelho e com escala 1.
- Comparação conjunta aberta e inspecionada em `artifacts/color-story/comparison.png`.
  Conceito e capturas foram reduzidos proporcionalmente, sem esticar para alinhar.
  As capturas finais registram o viewport real: expandir a janela para fotografar
  a seção inteira alterava o estado do ScrollTrigger e foi descartado como evidência.
- A faixa azul foi confirmada também no pixel da captura: RGB 40,40,251, próximo
  de 38,38,252, com a textura visual existente. A câmera foi capturada após três
  cliques e o celular após toque no disparador real.

### Cinco superfícies de fidelidade

- **Tipografia:** AquilineTwo e SquidBoy locais preservadas, incluindo a marca,
  os títulos e os textos existentes. A nova duração usa a fonte de apoio do site.
- **Composição:** apresentação mantém a hierarquia e recebe a faixa azul atrás
  das fotos. Câmera usa campos marrom/amarelo em 42/58 no desktop e verticais no
  celular. As fotos geradas procuram espaço livre sem cobrir texto, câmera,
  instruções ou marca; não interceptam ponteiros nem criam altura no documento.
- **Cores:** amarelo `#f0d756`, azul `#2626fc` e marrom de fundo `#6b311c`.
  O texto original da apresentação permanece `#7a2a17`, conforme a correção do
  usuário. O cabeçalho adapta seu contraste por entrada/saída das seções.
- **Imagens:** câmera, envelope e nove fotografias do acervo local mantidos.
  A paisagem da apresentação passa a usar `images/trail/photo-3.webp`, já no
  projeto, para evitar o fundo branco da montagem antiga sobre a paleta.
- **Conteúdo e movimento:** texto principal intacto, indicação adicional
  “cada imagem dura 5 segundos”. Oito recortes alternados, prazos independentes,
  dissolução nos últimos 450 ms e remoção do elemento aos 5.000 ms. Com movimento
  reduzido, sem voo ou dissolução. A faixa acompanha a rolagem nos dois sentidos.

### Histórico e resultado

- [P2 resolvido] A montagem anterior de montanhas deixava um entorno branco;
  foi substituída pela fotografia enquadrada existente, conferida na captura final.
- [P2 resolvido] A legenda de duração ficava perto demais dos descendentes da
  cursiva; a margem foi ajustada e conferida no desktop e no celular.
- Passaram **27 verificações da câmera**, incluindo oito recortes, separação,
  prazos observados, Enter/Espaço, toque, cliques rápidos, limpeza de animações,
  falha/recuperação, movimento reduzido, rolagem e acesso à próxima seção.
- Passaram **23 verificações da paleta**, incluindo cores computadas, pixel azul,
  faixa 0→0,5→1→0, contraste do cabeçalho, envelope, regiões protegidas, saída
  amarela da casa, resize, ausência de overflow e retorno à abertura.
- Passaram **17 verificações da primeira visita**, com cache desabilitado no
  desktop e no mobile com CPU limitada. Nenhuma reversão inesperada de rolagem.
  O teste usa Chromium/SwiftShader; não equivale a teste em telefone físico.
- **67 verificações aprovadas.** Nenhuma exceção JavaScript ou falha de recurso
  local nas visitas normais. Build e sintaxe aprovados. Não há P0/P1/P2 pendente
  dentro deste escopo. As posições das fotografias variam de forma intencional.
- Backup remoto anterior: `backup/antes-paleta-fotos-efemeras-2026-11-05`,
  apontando para `6c1f822`. Instruções de restauração em `docs/color-story.md`.

final result: passed

## Correção — composição original e fundos simplificados (5/11/2026)

Esta revisão substitui a composição da entrega anterior da paleta. O usuário
identificou alterações indevidas nas fotos/proporções e rejeitou o encontro da
faixa azul, borda amarela e campo marrom. A referência de composição passa a ser
a implementação anterior à paleta, `6c1f822`, junto aos prints da correção.

### Evidência e fidelidade

- Capturas antes/depois em `artifacts/layout-restoration/`, viewports reais
  1600×900 e 390×844, escala 1 e fontes prontas. Comparação conjunta aberta em
  `comparison.png`, reduzida proporcionalmente, sem distorção ou troca de viewport.
- Referência executável: os quatro arquivos originais de página 4/5 de `6c1f822`
  foram servidos somente ao navegador de referência. O site não foi modificado
  para produzir a comparação. Medidas registradas em `geometry-*.json`.
- **Tipografia:** fontes, tamanhos, entrelinhas e espaçamentos iguais à referência
  nas quatro resoluções: 1600×900, 1366×768, 390×844 e 375×667.
- **Geometria:** títulos, textos, envelope, retrato, montanha, câmera, colagem,
  filme e marca têm as posições e dimensões anteriores. Nenhuma diferença acima
  de 0,75 px. A borda e a legenda adicional de duração foram removidas; a região
  móvel da colagem voltou a 110vw. O retrato mantém a travessia da divisa original.
- **Imagens:** restaurados os caminhos e a proporção da montagem de montanhas,
  envelope e retrato. `page4-sobre.js` é o original integral; o único diff do CSS
  correspondente é a cor de fundo. Mantido seu tratamento de mistura original.
- **Cores:** fundo amarelo uniforme na apresentação, texto marrom original.
  Na câmera, campos marrom/amarelo e marca azul. Pixels acima/abaixo da divisa
  confirmam somente amarelo e marrom, sem faixa azul nem borda intermediária.
- **Conteúdo e interação:** textos principais preservados; a troca do envelope
  por setas continua funcionando. Oito recortes, dispersão e prazos individuais
  de cinco segundos mantidos. Fotos geradas retomam o tamanho visual anterior,
  compensando a escala 0,85 da antiga galeria. Câmera sem arraste/seleção acidental.

### Resultado

- **32 verificações de composição/fundos e 27 da câmera aprovadas: 59 no total.**
  Incluem comparação real de geometria/imagens, passagem de cor, contraste,
  dispersão, prazos, teclado, toque, movimento reduzido, resize, rolagem e próxima
  seção. Sem exceções JavaScript ou falhas de recursos locais nas visitas normais.
- Build, sintaxe, comparação visual e ausência de overflow aprovados. As capturas
  mostram o viewport, sem pretensão de documentar a seção inteira. Emulação
  Chromium/SwiftShader; não houve teste em telefone físico nesta revisão.
- Prévia atual em `docs/layout-restoration-preview.webp`, versão móvel em
  `docs/layout-restoration-mobile.webp`. Histórico e restauração em
  `docs/layout-restoration.md`. Backup remoto anterior à correção:
  `backup/antes-restaurar-composicao-2026-11-05` → `95d0d1b`.
- Nenhuma divergência P0/P1/P2 pendente dentro deste escopo.

final result: passed

## Correção — tons naturais do acervo (5/11/2026)

O usuário apontou o amarelado do envelope, da montagem da montanha e do filme.
O escopo desta revisão é a composição de cor dessas imagens; medidas, posições,
fontes, fundos e interações permanecem na composição restaurada.

- **Referência:** os dois prints do usuário e os arquivos originais do acervo,
  preservados no Git. Capturas antes/depois em `artifacts/photo-colors/`, viewports
  reais 1600×900 e 390×844, escala 1, com fontes e imagens carregadas.
- **Comparação visual:** `artifacts/photo-colors/comparison.png`, antes/depois
  reduzidos proporcionalmente lado a lado. Capturas reais também em
  `docs/photo-colors-preview.webp` e `docs/photo-colors-film.webp`.
- **Tipografia e geometria:** verificação contra os quatro arquivos de referência
  de `6c1f822` passou em 1600×900, 1366×768, 390×844 e 375×667. Sem diferenças
  acima de 0,75 px nos elementos existentes e no tamanho visual das fotos geradas.
- **Cores:** retirada a mistura `multiply` do envelope, da montanha e do filme.
  Amostras interiores renderizadas sobre amarelo e sobre branco coincidem no
  desktop e no celular. Fundo amarelo, campo marrom, texto e marca azul mantidos.
- **Imagens:** mesmos arquivos e proporções. O filtro SVG da montanha retira o
  entorno claro da digitalização e protege o papel central, compondo os pixels
  RGB originais. Os quatro cantos medidos mostram o amarelo, sem placa cinza.
  O filme mantém a máscara suave; a foto do envelope continua no recorte original.
- **Conteúdo e interação:** texto principal intacto; setas do envelope, dispersão,
  disparador e preferência de movimento reduzido continuam funcionando. Nenhuma
  alteração no código dos prazos individuais de cinco segundos.
- **Validação:** 16 verificações de cor/renderização e 32 de composição/fundos
  aprovadas, total **48**. Sem exceções JavaScript ou falhas de recursos locais.
  Build, sintaxe e ausência de overflow aprovados. Chromium/SwiftShader emulado;
  sem teste físico de Safari ou de telefone nesta revisão.
- Backup remoto: `backup/antes-cores-naturais-2026-11-05` → `225492c`.
  Documentação atual em `docs/photo-colors.md`. Sem P0/P1/P2 pendente neste escopo.

final result: passed

## Refinamento — recorte do filme e definição da montanha (5/11/2026)

O usuário pediu corrigir a primeira colagem e tentar melhorar a qualidade da
montanha da segunda captura. A intervenção se limita às duas imagens e ao seu
tratamento; os fundos e a composição restaurada permanecem.

- **Referências:** os dois prints do usuário e os arquivos originais
  `images/vestigios/filme.webp` e `images/sobre/montanha.webp`, mantidos intactos.
  Image Gen produziu derivados transparentes a partir desses arquivos, com
  instruções de preservar tema, composição, cores e textura do papel.
- **Evidência:** capturas antes/depois em `artifacts/image-refinement/`, viewports
  CSS reais 1600×900 e 390×844, escala 1. Comparação conjunta em `comparison.png`,
  com redução proporcional. Prévias reais combinadas em
  `docs/image-refinement-preview.webp`, 1600×1800, sem esticar as capturas.
- **Tipografia e geometria:** fontes, entrelinhas, título, texto, retrato,
  envelope, câmera, colagem e marca mantidos. As quatro comparações com a
  composição de `6c1f822` passaram, sem diferenças acima de 0,75 px em 1600×900,
  1366×768, 390×844 e 375×667. O filme reserva a proporção original 960/688.
- **Cores:** mantidos fundo amarelo, campo marrom, texto e marca azul. As amostras
  de envelope, montanha e filme sobre amarelo/branco continuam equivalentes.
- **Imagens:** filme recortado, sem retângulo claro, com transparência real.
  Montanha restaurada de 576×547 para 1287×1222, com rochas laterais opacas e
  contorno contínuo. Removidos filtro de luminosidade e máscara radial antigos.
  Os dois WebPs RGBA totalizam 645.238 bytes e continuam lazy. O restauro assistido
  melhora definição aparente; não constitui recuperação de informação original.
- **Conteúdo/interação:** nenhum texto novo no produto. Troca de fotos do
  envelope e sequência da câmera preservadas. Sem alteração nos prazos de cinco
  segundos ou nos comandos 3D.
- **Validação:** 23 verificações de imagem/renderização e 32 de composição/fundos,
  **55 aprovadas**. Cobrem resolução, transparência, opacidade, cores, medidas,
  teclado, toque, resize, rolagem, próxima seção e ausência de overflow. Sem
  exceções JavaScript ou recursos locais indisponíveis. Build e sintaxe aprovados.
  Chromium/SwiftShader emulado; sem teste físico de aparelhos nesta revisão.
- Backup: `backup/antes-recorte-nitidez-2026-11-05` → `8690275`.
  Restauração e procedência em `docs/image-refinement.md`. Sem P0/P1/P2 pendente
  dentro deste escopo.

final result: passed

## Retorno aos fundos brancos (6/11/2026)

Pedido do usuário: voltar ao fundo branco. Sobre e Vestígios passam a `#fff`;
removidos painel lateral marrom e seu equivalente móvel. As imagens tratadas,
medidas, posições, conteúdo, fontes e prazos das fotografias foram preservados.

- Capturas antes/depois em `artifacts/white-backgrounds/`, viewports reais
  1600×900 e 390×844, escala 1; comparação proporcional em `comparison.png`.
  Prévia atual em `docs/white-backgrounds-preview.webp`, duas capturas de
  1366×900 combinadas verticalmente, sem esticamento.
- Texto marrom original `#7a2a17`; disparador, foco e indicação em azul `#2626fc`.
  Cabeçalho marrom por toda a região branca, sem alterar suas dimensões. Seu
  estado é removido ao sair. Pixels da divisa confirmam branco nos dois lados.
- A transição da casa consulta o fundo seguinte e agora termina em `#ffffff`;
  comportamento medido no renderer real, sem mudar a implementação da casa.
- Nenhum arquivo de imagem foi alterado. Filme transparente e montanha
  restaurada continuam ativos. Troca do envelope, disparador e dispersão mantidos.
- **55 verificações aprovadas:** 32 de composição/fundos e 23 de imagens.
  Comparação de medidas/fontes em 1600×900, 1366×768, 390×844 e 375×667, sem
  diferenças acima de 0,75 px. Cores das imagens, contraste, resize, retorno,
  movimento reduzido e ausência de overflow aprovados. Sem exceções JavaScript
  ou falhas de recursos locais. Build e sintaxe aprovados.
- Revisão visual feita em Chromium/SwiftShader emulado. Sem aparelho físico nesta
  revisão. Nenhum P0/P1/P2 pendente no escopo solicitado.
- Backup remoto: `backup/antes-fundos-brancos-2026-11-06` → `13cc1ec`.

final result: passed

## Fotos enviadas pela cliente — 6/11/2026

Aplicadas as cinco fotografias de `imagens.zip`, sem mudanças de cor ou corte.
As duas primeiras ocupam a primeira moldura de cada parede, ajustadas por
proporção dentro das molduras existentes. Os dois pendentes e as quatro outras
molduras preservam seu acervo. As três seguintes foram acrescentadas ao rastro:
a sequência real passou de nove para doze, sem retirar nenhuma imagem anterior.

Build, sintaxe e 16 verificações focadas aprovados: sequência do mouse, ponteiros,
duas texturas carregadas no renderer, proporções, seis molduras/dois pendentes,
entrada/retorno, seção branca seguinte, overflow, console e recursos. Viewports
1600×900 e 390×844 em Chromium/SwiftShader, sem teste em aparelho físico. Capturas
em `artifacts/client-photos/` abertas para conferência. Texto, fontes, dimensões,
fundos e movimento existentes preservados. Documentação em `docs/client-photos.md`.
Backup remoto: `backup/antes-fotos-cliente-2026-11-06` → `ffb73dd`.

final result: passed

## Fotos nas últimas molduras — 6/11/2026

As duas fotografias da cliente foram movidas para o último par de molduras,
uma em cada parede, em z = -11,15 m, próximo à saída. As peças anteriormente
nessas posições passaram às primeiras molduras. Acervo, pendentes, dimensões,
iluminação, fontes, fundos e rastro do mouse preservados. Captura real da galeria
em `artifacts/client-photos/house-1600-0.72.png` aberta para inspeção.

Build e 18 verificações focadas aprovados em 1600×900 e 390×844, incluindo as
posições mundiais das duas texturas, proporções, entrada/retorno e próxima seção.
Sem erros JavaScript ou recursos locais faltando. Emulação Chromium/SwiftShader.
Backup remoto: `backup/antes-ultimas-molduras-2026-11-06` → `81bdfdc`.

final result: passed

## Encaixe das duas últimas molduras — 6/11/2026

Molduras da cliente ajustadas à proporção original das fotos, com margem uniforme
de 8 cm em cada direção. A primeira passa a horizontal; a segunda fica vertical
mais estreita. Os centros continuam nos mesmos lugares próximos à saída, sem
cortar ou distorcer as fotografias. Outras molduras e pendentes preservados.

Captura anterior em `artifacts/client-fit/before.png`, atual em
`docs/client-frame-fit-preview.webp`, ambas 1600×900. Comparação proporcional em
`artifacts/client-fit/comparison.png`. Conferência visual e 20 verificações
aprovadas em 1600×900 e 390×844: margens medidas no renderer, posições, proporções,
carregamento, passagem/retorno, rastro de doze imagens e seção seguinte. Sem erros
JavaScript, recursos faltando ou overflow. Build e sintaxe aprovados. Teste em
Chromium/SwiftShader emulado. Backup: `backup/antes-encaixe-molduras-2026-11-06`.

final result: passed
