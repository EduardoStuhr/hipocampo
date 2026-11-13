# Última página — Hipocampo

Implementação concluída a partir da composição de referência fornecida pelo usuário: nove retratos em leque, atrás de HIPOCAMPO formado por letras brancas grandes e arredondadas. Os antigos blocos com letras pequenas foram retirados.

## Retratos originais

As oito fotografias vieram de `fotos_compactadas.zip`. A ordem do ZIP foi preservada exatamente como o usuário determinou:

| Ordem | Nome | Arquivo local |
| --- | --- | --- |
| 1 | Mariana | `/images/team/mariana.webp` |
| 2 | Heitor | `/images/team/heitor.webp` |
| 3 | Guilherme | `/images/team/guilherme.webp` |
| 4 | Heloiza | `/images/team/heloiza.webp` |
| 5 | Gabriel | `/images/team/gabriel.webp` |
| 6 | Lara | `/images/team/lara.webp` |
| 7 | Tiago | `/images/team/tiago.webp` |
| 8 | Raphael | `/images/team/raphael.webp` |
| 9 | Beatriz | `/images/team/beatriz.webp` |

Beatriz foi acrescentada ao final a partir do ZIP enviado em 13/11/2026.

Os arquivos mantêm a orientação e a proporção originais, sem ampliação. As imagens maiores foram reduzidas para até 960 px e todas foram salvas localmente em WebP. O recorte 3:4 dos cartões é feito por CSS. O manifesto está em `public/assets/team-members.js`.

## Letras e movimento

- HIPOCAMPO usa glifos brancos reais, sem fundos retangulares nem pequenos rótulos entre colchetes. O título permanece acessível como texto.
- Fonte Fredoka condensada, peso 700, instalada localmente e limitada aos glifos usados. Licença em `public/fonts/Fredoka-OFL.txt`.
- Entrada escalonada, flutuação suave e aproximação por mouse, teclado ou toque.
- As letras reagem ao mouse com uma onda de elevação, inclinação e alongamento sutis; voltam ao lugar ao sair. A geometria é armazenada e os frames são solicitados apenas durante os movimentos do ponteiro.
- No celular, tocar em um nome centraliza e amplia o retrato correspondente.
- Animações pausam fora da tela e respeitam a preferência por movimento reduzido.
- A seção conserva `#informacoes`, os links de navegação e o contato existente. As outras páginas e os módulos 3D foram preservados.

## Evidências e validação

Capturas: `docs/team-finale-preview-1440.webp` e `docs/team-finale-preview-390.webp`.
Vídeo: `docs/team-finale-motion.mp4`.

Executados `npm run build`, verificações de sintaxe e `python scripts/test-team-finale.py`. A suíte usa os nove retratos originais, sem mocks, em 1440×900, 390×844, 375×667 e 320×640, mais 390×844 e 1440×900 com movimento reduzido. Foram verificados carregamento, ordem, letras brancas, seleção dos nove nomes, onda nas letras, retorno ao sair, hover/toque, Escape, animação fora da tela, overflow, erros JavaScript e arquivos locais ausentes. Todos passaram.

## Novo envio para publicação — 13/11/2026

O build agora gera nomes com hash de conteúdo para o CSS, JavaScript e manifesto da equipe. O HTML produzido referencia esses nomes e o módulo referencia o manifesto correspondente. Os caminhos anteriores continuam disponíveis. Isso evita reutilização dos assets antigos quando o HTML novo é publicado, mesmo em caches que ignoram parâmetros de URL. A entrada de desenvolvimento também recebeu uma nova versão.

Destino do novo envio: `main` de `EduardoStuhr/hipocampo`. A publicação em `hipocampo.pages.dev` depende da integração Cloudflare; não foi possível consultá-la neste ambiente.

## Diagnóstico da publicação de produção

As capturas do painel Cloudflare confirmam produção configurada na branch `main`. A produção permaneceu em `5b72450`, enquanto `0140e42` só apareceu como pré-visualização em `feat/equipe-hipocampo`. O build remoto terminou em 11 segundos; a pré-visualização ficou na etapa implantar. Novo envio somente à `main`, com marcador HTML `hipocampo-release=beatriz-hover-production-20261113-1`, para distinguir a versão publicada. Não assumir conclusão do deploy apenas com o push.
