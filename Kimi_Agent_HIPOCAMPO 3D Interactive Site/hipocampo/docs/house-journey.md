# Travessia da casa da memória

A casa do mapa conduz a uma galeria com geometria, iluminação e perspectiva.
A mesma câmera se aproxima da fachada, atravessa a porta articulada, passa entre
quadros e fotografias e cruza a abertura iluminada ao fundo. O scroll reverso
recompõe o percurso e fecha a porta.

A fachada fotográfica e os recortes originais permanecem como identidade do
mapa. A passagem e o interior são modelados: batentes profundos, folhas da porta
com espessura, piso de madeira, paredes, teto, trilhos de luz, quadros com suporte,
fotografias penduradas e mesa com uma impressão. A abertura em tela do shader
`paper-transition.js` não é utilizada.

![Entrada, galeria e saída: capturas reais do Three.js](house-journey-preview.webp)

## Ritmo e continuidade

| Progresso aproximado | Acontecimento |
| --- | --- |
| 0–34% | A casa se aproxima; os fios desaparecem antes do enquadramento fechado |
| 29–48% | As duas folhas se abrem em profundidade |
| 34–56% | A câmera alcança e atravessa o batente |
| 56–86% | Percurso suave pela galeria, com discretos olhares laterais e parallax |
| 86–97% | Aproximação da passagem iluminada ao fundo |
| 97–100% | A arquitetura se dissolve na luz e a seção `#sobre` começa a aparecer |

O caminho usa uma spline tridimensional e parâmetros derivados do progresso,
sem trocar de câmera na entrada. As medidas de `#projeto` usam a altura final
do mapa, independente da sua animação inicial de escala. Isso mantém o
enquadramento ao voltar e ao atualizar o layout.

Uma sobreposição de 24svh deixa `#sobre` entrar no clarão final. Ela só é
aplicada enquanto a casa está disponível e o movimento não está reduzido.
Não há bloqueio de rolagem, pin adicional ou alteração dos controles da
instalação interativa mais abaixo na página.

## Arquivos

- `public/assets/page3-house.js`: mapa, câmera contínua, progresso, exposição,
  visibilidade, preferência de movimento e fallback.
- `public/assets/house-interior.js`: arquitetura, porta, piso, coleção, luzes,
  adaptação da largura ao celular e descarte dos recursos.
- `public/assets/page3-house.css`: altura do percurso, viewport sticky, legendas
  e união com a próxima seção.
- `index.html`: versões `?v=depth-1` dos módulos/estilos para invalidar o cache.

Usa o Three.js local, os recortes do mapa e as texturas/fotografias já existentes
no projeto. Nenhuma dependência de runtime foi adicionada. Apenas uma cena é
renderizada; o compositor com dois render targets foi retirado deste fluxo.
DPR limitado a 1,25, anisotropia limitada, um shadow map de 1024 atualizado na
abertura da porta e pausa fora da tela/aba oculta.

Com movimento reduzido, a galeria aparece estática em uma seção compacta, sem
zoom, parallax ou balanço. Falha de WebGL/textura e perda de contexto restauram
o mapa do DOM e removem o trecho sticky para preservar a leitura.

## Revisar e executar

Na pasta da aplicação:

```bash
npm run dev
npm run build
python3 tools/house-journey-qa.py
```

O QA usa `http://127.0.0.1:4173/`; ajuste `HIPOCAMPO_QA_URL` e
`HIPOCAMPO_CHROME` se necessário. Capturas e resultados ficam em
`artifacts/house-depth/`, fora do Git.
`document.querySelector('#casa').houseJourney.inspect()` expõe apenas o estado
da câmera, progresso e renderização para inspeção no navegador.

A validação em Chromium passou em 41 verificações, com viewports de 1366×768 e
390×844: passagem física, continuidade da câmera, reversão, resize, próxima
seção, movimento reduzido, perda de contexto, ausência de WebGL e assets locais.
Esses resultados verificam comportamento e renderização; não medem FPS em
aparelhos reais.

## Restauração

- Versão anterior: `c8a0763`.
- Backup: `backup/casa-antes-travessia-2026-11-04`.
- Nova versão: `release/casa-travessia-2026-11-04`.

Para desfazer apenas esta entrega, use `git revert` na tag da nova versão e
faça um push normal. Não é necessário alterar as correções anteriores da sala
interativa ou da posição dos botões.
