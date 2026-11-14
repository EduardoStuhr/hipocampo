# Relatos — envelope físico em 3D

A experiência de relatos usa agora um modelo Three.js com quatro abas articuladas, papel com espessura e fibras, sombras projetadas e selo de cera irregular em relevo. O selo, seus aros e a inicial H são geometria; o selo acompanha a aba superior. A rolagem gira cada dobradiça e aproxima a câmera para o interior. Ao terminar, o branco preenche a viewport com “Em breve, relatos”. Reverter a rolagem fecha o envelope.

## Modelo e materiais

- stories-envelope-3d.js compartilha o Three.js local já utilizado pelo projeto.
- Papel: malhas extrudadas com bordas, mapa de fibras e relevo de material gerados numericamente; não usa foto/PNG de envelope.
- Cera: contorno irregular extrudado, borda arredondada, aros e H em relevo, material físico com brilho controlado.
- Iluminação hemisférica e direcional com sombras; abas giram em torno das próprias bordas.
- A entrada na carta é movimento real da câmera até a superfície interna, acompanhado pela camada branca de leitura para texto nítido.

## Ciclo de vida e desempenho

Carrega somente ao chegar a 700 px da seção, sem mensagem de carregamento. O modelo inicial tem 4550 triângulos e 16 chamadas de desenho no renderer. Renderiza sob demanda na rolagem ou resize; não há loop contínuo de renderização. Para fora da tela, aba oculta e trecho final coberto pela área de leitura.

DPR limitado a 1,5 no desktop e 1,25 em ponteiro touch. Sombra 1024 no desktop e 512 no celular. Geometria de enquadramento é cacheada no resize. Materiais, texturas, sombras, observers e renderer são liberados na desmontagem/troca de preferência.

Com movimento reduzido, exibe diretamente a área branca sem criar WebGL. Sem WebGL2, mantém a abertura CSS funcional. Se perder o contexto, mostra essa alternativa até restaurar o renderer. Os elementos do canvas não interceptam toque ou mouse.

## Verificação

Build e sintaxe JS; Playwright em 1440×1000, 1366×768, 390×844, 320×640 e movimento reduzido. Confirmados modelo pronto, triângulos/chamadas/DPR, ausência de renders contínuos e fora de tela, rotação de abas e câmera, progresso/reversão, roda/PageDown/toque, branco cobrindo viewport, aviso e cabeçalho legíveis, dez retratos/créditos e fontes preservados, resize e troca de preferência sem duplicar a timeline. Perda/restauração de contexto testada e cenário adicional força WebGL indisponível para confirmar a alternativa.

Capturas: stories-envelope-closed.webp, stories-envelope-opening.webp e stories-envelope-open-mobile.webp. Vídeo de navegação com roda do mouse: stories-envelope-physical.mp4. O vídeo foi capturado no Chromium com renderer de software e não serve como medição de FPS de dispositivos reais.
