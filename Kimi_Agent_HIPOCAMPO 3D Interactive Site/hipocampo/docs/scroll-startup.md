# Primeira rolagem — 5 de novembro de 2026

Correção do travamento no fechamento do círculo branco e da retomada que
avançava até a casa. A lista do acervo e os ajustes solicitados pela cliente
continuam na versão atual.

## Causas reproduzidas

Na primeira visita, a instalação iniciava a criação de um segundo contexto
WebGL mesmo estando várias seções abaixo da tela. Seus callbacks de preparação
submetiam todos os materiais de uma vez. No registro local inicial, dois desses
callbacks bloquearam a thread principal por 1.552 e 1.341 ms. A casa também
desenhava sua primeira cena enquanto ainda estava atrás da abertura.

`compileAsync(scene)` não torna a submissão inicial de todos os shaders
assíncrona. Tampouco garante que o primeiro desenho de todas as combinações
de material esteja preparado no driver. Depois de um quadro demorado, o relógio
da rolagem consumia uma grande parte da interpolação em um único quadro.

## Correção

- A instalação começa a preparar quando chega a três alturas de tela de
  distância. Os passos de preparação cedem ao scroll e não são iniciados à
  força pelo timeout de um callback ocioso durante a abertura.
- `scene-preparation.js` decodifica as imagens antes do upload, divide a
  submissão dos materiais e prepara as combinações de shader/estado em pequenos
  desenhos de 64×64. Entre desenhos, aguarda a GPU sem bloquear a CPU.
- O canvas permanece oculto até a preparação terminar. Dimensões, visibilidade,
  materiais temporários e descarte dos ImageBitmaps são restaurados corretamente.
- A casa prepara seus recursos antes de assumir o mapa, sem manter um desenho
  em tela cheia atrás do círculo nem executar um refresh global ao terminar.
- O mapa para de animar quando fica coberto pela casa e volta ao retornar.
- O relógio local do Lenis limita a recuperação de um quadro demorado a 50 ms.
  As animações da casa, do círculo e das outras seções mantêm seus relógios.
- Os arquivos alterados receberam novas versões de cache no HTML/importmap.
- O resize agrupa as atualizações globais em vez de recalcular todos os pins
  a cada evento da barra do navegador. Em telas sem a interação das letras,
  não mede centenas de caracteres que não serão usados pelo ponteiro.

Não há bloqueio do `body`, cancelamento dos gestos normais ou intervalo
artificial de carregamento no caminho de rolagem.

## Verificação reproduzível

```bash
npm run build
python3 tools/scroll-startup-qa.py --baseline
python3 tools/scroll-startup-qa.py
python3 tools/house-journey-qa.py
python3 tools/installation-navigation-qa.py
python3 tools/installation-qa.py
```

A rotina de primeira visita inicia os gestos antes de `networkidle`, com cache
desabilitado, em 1366×768 e 390×844. O segundo tamanho usa CPU limitada a 4×.
Registra os quadros e contextos WebGL, testa a reversão com roda e injeta um
quadro de 300 ms para conferir a retomada. Também verifica a âncora Projeto
e a pausa do mapa coberto. `--baseline` serve os fontes do backup através das
rotas do navegador, sem modificar o checkout.

As capturas e JSONs ficam em `artifacts/scroll-startup/`, ignorados pelo Git.
São testes locais em Chromium com GPU por software (SwiftShader), sem
equivalência garantida com FPS ou desempenho de um aparelho real.

Resultado da comparação com os mesmos gestos e condições:

| Primeira visita | Maior intervalo antes | Maior intervalo depois |
| --- | ---: | ---: |
| 1366×768, CPU normal | 1.433,3 ms | 116,7 ms |
| 390×844, CPU 4× | 1.299,9 ms | 466,7 ms |

O intervalo considera o avanço desde a abertura até os primeiros 12% do
percurso da casa. Não é uma medição de FPS de toda a galeria. Não houve inversão
espontânea de scroll nem contexto WebGL da instalação distante na versão nova.
As falhas registradas em `baseline-qa-results.json` são as regressões esperadas
da versão anterior, mantidas como evidência da comparação.

Na versão corrigida passaram 17 verificações de primeira visita, 70 da casa,
23 de navegação da instalação e 30 de interação/fallback dos objetos, sem erros
JavaScript ou falhas de recursos locais nas rotinas correspondentes.
Quatro verificações adicionais passaram para resize repetido durante o círculo,
mudança para mobile, âncora após resize e movimento das letras no retorno ao desktop.

## Backup e reversão

- Estado anterior: `30a2b62`, com as orientações dos áudios e o acervo.
- Backup remoto: `backup/antes-correcao-scroll-2026-11-05`.
- Entrega desta correção: `release/scroll-primeiro-carregamento-2026-11-05`.

Para desfazer apenas esta correção, preservando os pedidos anteriores:

```bash
git revert release/scroll-primeiro-carregamento-2026-11-05
git push origin HEAD:main
```

Preserve trabalho posterior ao resolver eventuais conflitos; não use force push.
