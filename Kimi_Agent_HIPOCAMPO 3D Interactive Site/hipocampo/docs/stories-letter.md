# Relatos — envelope aberto pela rolagem

A seção #relatos contém um envelope em camadas que abre progressivamente conforme a rolagem normal. A animação retira o selo, vira a aba, revela a folha e afasta o envelope. Ao rolar para cima, a sequência se inverte. A folha termina completamente branca, sem carta de apresentação, assinatura ou aviso de relatos em breve; é o espaço reservado para os relatos futuros.

O usuário esclareceu que a referência é o movimento da carta e não o desenho. O link Pinterest não pôde ser visualizado pela rede do ambiente; a imagem do envelope anexada e a descrição explícita orientaram a implementação. Não se afirma reprodução exata do vídeo.

## Implementação

- stories-letter.js monta as superfícies e usa o GSAP/ScrollTrigger já existente: scrub, progresso reversível e geometria recalculada apenas ao inicializar/atualizar o layout.
- stories-letter.css usa sticky nativo e superfícies CSS do envelope; nenhuma imagem de carta ou captura de tela substitui a interação.
- Rolagem não é interceptada, bloqueada ou simulada com temporizadores. Nenhum loop adicional contínuo de JavaScript.
- A fase semântica e aria-hidden só mudam ao atravessar os limites de fechado/abrindo/aberto.
- Com movimento reduzido, a folha branca aparece diretamente e o trecho longo de animação é removido.
- Navegação #relatos permanece e o cabeçalho usa contraste claro sobre o fundo marrom.
- A equipe mantém os créditos e retratos; título alterado para SOBRE NÓS.

## Verificação

npm run build, node --check e scripts/test-stories-letter.py. Desktop 1440×1000 e 1366×768, celulares 390×844 e 320×640, celular com movimento reduzido. Estados 0/20/45/70/100%, reversão, roda do mouse e PageDown nativos, gesto de toque via CDP, ausência de bloqueio ao continuar à equipe, branco puro sem texto/nós internos na folha, viewport sem overflow, imagens e créditos preservados, título SOBRE NÓS, console e recursos ausentes. Todos passaram.

Uma rodada adicional desktop verificou mudança de preferência de movimento e redimensionamento para 390×844: geometria refeita, folha dentro da tela e somente uma timeline ativa.

Capturas finais: docs/stories-scroll-closed-1440.webp, stories-scroll-opening-1440.webp, stories-scroll-open-390.webp. Imagens antigas de stories-letter-* são evidências históricas da versão anterior.
