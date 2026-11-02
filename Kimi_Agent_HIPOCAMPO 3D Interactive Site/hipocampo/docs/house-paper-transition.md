# Passagem de papel — casa da memória

A transição em `#casa` substitui as portas articuladas por uma abertura de papel.
O exterior e o interior usam câmeras independentes no mesmo contexto WebGL: a
câmera não precisa atravessar a fachada nem a parede de fundo. O shader de
`public/assets/paper-transition.js` mistura as cenas somente durante a abertura.

## Ritmo do scroll

| Progresso | Comportamento |
| --- | --- |
| 0–44% | Aproximação da casa e dispersão dos fragmentos |
| 46–66% | Recorte irregular cresce a partir da porta e revela o interior |
| 66–86% | Avanço suave pela sala, sem rotação lateral da câmera |
| 86–98% | Abertura de papel claro se expande até cobrir a tela |
| Final | O fundo se une ao de `#sobre`; o scroll revela a próxima seção |

A máscara depende do progresso, com contorno fixo, e pode ser percorrida nos dois
sentidos. Os render targets usam pixels CSS para limitar o custo da composição
em celulares. Fora da abertura, só uma cena é renderizada diretamente.

Com movimento reduzido, a sala é uma imagem estática de uma tela de altura, sem
zoom, parallax ou pêndulos. A preferência pode mudar com a página aberta.
Ausência/perda de WebGL ou falha de textura libera a navegação normal e preserva
o mapa da seção anterior. A cena pausa fora da tela e com a aba oculta.

## Verificação realizada

- `node --check` nos dois módulos e `npm run build`.
- Chromium, 1366×768 e 390×844: entrada, interior, saída, próxima seção,
  scroll reverso, âncora `#casa` e recarregamento no interior.
- Chromium, 1600×900 e 375×667: movimento reduzido; pixels da sala permanecem
  iguais com tempo e movimento do mouse; alternância da preferência em execução.
- Redimensionamento durante a abertura, perda de contexto e WebGL indisponível.
- Sem overflow horizontal, exceções JavaScript ou erros de shader da transição.

O ambiente de QA bloqueou requisições preexistentes a `images.unsplash.com` em
outras seções. Os assets locais da casa carregaram normalmente. A validação usou
renderização de software do Chromium; não é uma medição de FPS em aparelho real.

Para revisar manualmente, execute `npm run dev` na pasta da aplicação e abra
`http://127.0.0.1:8443/`. Percorra a casa lentamente e com saltos de scroll, volte
ao mapa, redimensione a janela e habilite a preferência de movimento reduzido.
Os parâmetros `?v=paper-1` em `index.html` invalidam o cache anterior de JS/CSS.
