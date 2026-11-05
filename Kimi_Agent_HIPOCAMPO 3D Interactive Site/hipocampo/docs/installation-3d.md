# Instalação 3D — atualizada em 5 de novembro de 2026

A instalação mantém o fundo preto, três mesas, cabideiro, luz dura e geladeira
com luz vermelha. Após os áudios da cliente, a mesa de luz começa vazia e os nomes
flutuantes foram retirados. Roupas/acessórios ficam no cabideiro e mesinha; livros,
fotografias e objetos na escrivaninha; químicos na geladeira. São malhas WebGL reais,
com materiais e sombras; a imagem do conceito não é usada como fundo da cena.
O [brief da cliente](installation-client-brief.md) registra os pedidos, os
materiais pendentes e o ponto de restauração desta atualização.

## Arquivos de entrada

- `index.html`: stylesheet e import map que direciona somente o chunk antigo da
  instalação para o novo módulo. A URL compartilhada de React permanece a mesma.
- `public/assets/installation-room.js`: seção React, controles, memórias e
  alternativa acessível.
- `public/assets/installation-scene.js`: geometria, materiais, luzes, projeção,
  eventos, movimento entre ilhas e liberação de recursos WebGL.
- `public/assets/installation-collection.js`: 75 posições numeradas, conjuntos,
  variantes de CDs e quatro frascos de estudo para os químicos.
- `public/assets/installation-props.js`: representações provisórias do acervo,
  substituídas por impressões quando as fotografias forem fornecidas.
- `public/assets/installation-room.css`: estilos limitados à instalação.
- `public/images/installation/`: texturas locais geradas de madeira e esmalte.
- `public/images/trail/photo-{1,2,3,4}.webp`: fotografias já existentes no projeto.

Os bundles recuperados e as outras seções não foram alterados. Usa-se o Three.js
local já empregado pela transição da casa, sem adicionar dependências de runtime.
O import map é suportado pelos navegadores atuais. A entrada antiga continua
intacta para restauração.

## Interações

- Mouse: arrastar um objeto de qualquer ilha até a mesa de luz; clicar lê sua
  memória. Soltar fora da mesa devolve à ilha. Arrastar o fundo gira a câmera
  em 360° sem limite horizontal. Botão direito, botão do meio ou Shift e arrastar
  desloca a câmera. O zoom permite aproximar-se dos objetos.
- Toque: os alvos ampliados dos objetos aceitam arrastar; tocar lê a memória.
  O fundo mantém a rolagem vertical da página.
- Teclado: Tab encontra objetos; Enter/Espaço leva à mesa; setas deslocam;
  Escape devolve à ilha. “Explorar sem arrastar” lista todos os fragmentos.
- “Recompor a sala” restaura objetos, câmera e porta aberta. “Visão inicial”
  restaura somente a câmera. Abrir/fechar a porta controla a luz vermelha.
  Recompor deixa a mesa de luz vazia, inclusive depois de selecionar todo o acervo.
- “Explorar sem arrastar” permite buscar por nome, número ou integrante de um
  conjunto. As escolhas também funcionam com a cena fora da tela e sem WebGL.
- O arraste mantém a pegada sobre o objeto e testa a soltura contra o tampo real,
  independentemente da altura da origem. As áreas de toque dos objetos têm
  prioridade sobre a porta da geladeira. A apresentação na mesa é calculada
  pelas dimensões de cada objeto; devolver restaura escala, rotação e origem.
- A renderização é por demanda e para fora da tela/aba oculta. DPR limitado a
  1,25, shadow maps atualizados quando necessário e recursos liberados no unmount.
- Com movimento reduzido, as transferências e a porta mudam sem animação. Sem
  WebGL, a leitura de memórias continua disponível na lista de objetos.
- Duplo clique no fundo ou Enter com foco no canvas habilita zoom pela roda, WASD para caminhar, Q/E
  para altura, setas para olhar e toque/pinça para navegar. Escape, novo duplo
  clique/Enter, perda de foco ou saída da seção liberam os gestos. A página nunca
  recebe bloqueio de body ou pin; a rolagem normal leva ao próximo capítulo.
  Os botões “aproximar” e “afastar” ficam no alto da cena. O antigo bloco com
  “explorar a sala em 360°”, “seguir para os fragmentos” e a dica foi removido
  a pedido em 4 de novembro de 2026.

## Correção de entrada e navegação

A criação das malhas é dividida em tarefas ociosas. Texturas, shaders, sombras e
o buffer real são preparados antes da aproximação da sala. Uma GPU fence é
consultada de forma assíncrona, sem `gl.finish()` nem espera bloqueante. O quadro
pronto permanece válido; entrar novamente na seção não força um novo desenho
nem recalcula sombras. Resize no mesmo breakpoint preserva a câmera.

Medição histórica da versão com oito fragmentos, no Chromium com SwiftShader,
viewport 1366 × 768 e
cinco segundos de leitura antes de aproximar-se da sala: maior intervalo de
quadro na entrada de 1283,2 ms para 33,4 ms, sem tarefas longas ou reversões de
scroll na nova versão. São medidas deste ambiente, não uma garantia de FPS em
todo aparelho. O script `tools/installation-entry-profile.py` serve a versão
anterior a partir da tag Git, sem alterar o checkout, e registra os dois runs.

O ajuste no controlador global de scroll é retirar a exceção permanente
para todo canvas da instalação. A reserva de gestos é feita apenas enquanto
o modo explorar tem `data-lenis-prevent`; fora dele, Lenis continua dono da roda.

As fotos reais dos itens ainda não foram fornecidas. Preencha `image` e
`imageAspect` em `installation-collection.js` para substituir cada estudo por
uma impressão. Os conjuntos 1 e 4 permanecem em uma só imagem cada. A posição
72 admite uma variante por fotografia de CD. As imagens existentes no projeto
e os volumes genéricos usados no estudo não são as fotos definitivas do acervo.

## Executar e validar

Na pasta desta aplicação:

```bash
npm run dev
npm run build
```

O servidor usa por padrão `http://127.0.0.1:8443/`; a seção é `/#instalacao`.
`HOST` e `PORT` ajustam o endereço. `dist/` é um produto de build ignorado no Git.
O push no GitHub não comprova uma publicação em `kimi.page` ou outro provedor.

Com Python Playwright e Chromium instalados:

```bash
HOST=0.0.0.0 PORT=4173 npm run dev
python3 tools/installation-qa.py
python3 tools/installation-navigation-qa.py
python3 tools/installation-client-qa.py
python3 tools/installation-entry-profile.py
```

`HIPOCAMPO_QA_URL` e `HIPOCAMPO_CHROME` permitem usar outro endereço e executável.
Capturas e resultados são escritos em `artifacts/installation/` (ignorado).

## Ponto de restauração

- Repositório efetivamente configurado: `EduardoStuhr/hipocampo`.
- Commit anterior: `46f0105d279be59470522ace5d6f044ac939348d`.
- Tag de backup no GitHub: `backup/instalacao-antes-3d-2026-11-03`.
- Tag da nova versão: `release/instalacao-3d-2026-11-03`.
- Branch de trabalho: `feat/instalacao-3d-realista`.
- Backup antes da correção da câmera: `backup/instalacao-antes-camera-2026-11-03`
  → `b8dc907`.
- Correção de entrada/câmera: tag `release/instalacao-camera-2026-11-03`, branch
  `fix/instalacao-entrada-camera`.
- Ajuste dos botões superiores: tag `release/instalacao-zoom-superior-2026-11-04`;
  backup anterior `backup/instalacao-antes-zoom-superior-2026-11-04` → `603c7dc`.
- Orientações dos áudios: tag `release/cliente-audios-2026-11-05`;
  backup exato `backup/antes-audios-cliente-2026-11-05` → `fc98a3f`.

Para “desfazer a última coisa” desta atualização, reverta somente
`release/cliente-audios-2026-11-05`. Isso retorna ao site salvo, com a porta da
casa ajustada. A [descrição da entrega](installation-client-brief.md) detalha a
restauração e os arquivos abrangidos.

Para desfazer esta entrega preservando o histórico posterior, reverta o commit
identificado pela tag correspondente e faça um push normal. Para voltar somente
à sala anterior à correção da câmera, reverta `release/instalacao-camera-2026-11-03`.
Para retornar ao site anterior à instalação, reverta as entregas nesta ordem:

```bash
git revert release/cliente-audios-2026-11-05
git revert release/instalacao-zoom-superior-2026-11-04
git revert release/instalacao-camera-2026-11-03
git revert release/instalacao-3d-2026-11-03
git push origin HEAD:main
```

Se mudanças posteriores gerarem conflito, aplique somente a reversão desta
instalação. Não use reset/force push sobre trabalho posterior. A tag de backup
permite consultar todos os arquivos anteriores. Para desativar somente o novo
runtime, retire do HTML o mapeamento do chunk `Instalacao3D-B1S3w8qj.js` e a
stylesheet `installation-room.css`; o bundle original continua no repositório.
