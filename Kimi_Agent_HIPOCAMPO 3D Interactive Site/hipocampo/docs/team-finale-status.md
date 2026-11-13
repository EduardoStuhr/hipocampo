# Prévia da última página — Hipocampo

Referência visual: captura fornecida pelo usuário do Readymag, com fotografias em leque atrás de blocos arredondados com letras. A adaptação usa HIPOCAMPO e a paleta existente do projeto.

## Implementado

- Última seção `#informacoes`, mantendo a navegação e o restante do site.
- Nove blocos com as letras de HIPOCAMPO e oito cartões em leque.
- Entrada escalonada, flutuação suave e destaque por mouse, teclado ou toque.
- Seleção pelos oito nomes, retorno com Escape e contato por e-mail.
- Animações pausadas fora da tela e respeito a movimento reduzido.

## Pendência: retratos originais

As fotos foram exibidas na conversa, mas não estão disponíveis como arquivos no workspace. Nenhuma pessoa foi gerada ou substituída por uma fotografia de outra pessoa. Até receber o ZIP, os cartões exibem somente os nomes.

O manifesto editável é `public/assets/team-members.js`. Os campos `portrait` estão explicitamente como `null`, portanto a prévia não faz pedidos a imagens inexistentes.

Ordem fornecida pelo usuário:

| Nome | Arquivo a preparar quando o original chegar |
| --- | --- |
| Mariana | `/images/team/mariana.webp` |
| Heitor | `/images/team/heitor.webp` |
| Guilherme | `/images/team/guilherme.webp` |
| Heloiza | `/images/team/heloiza.webp` |
| Gabriel | `/images/team/gabriel.webp` |
| Lara | `/images/team/lara.webp` |
| Tiago | `/images/team/tiago.webp` |
| Raphael | `/images/team/raphael.webp` |

Os caminhos da tabela são o destino planejado, não arquivos já existentes. Após inserir os originais, atualizar `portrait` no manifesto e repetir a inspeção visual do corte dos rostos. A versão está na branch de prévia `feat/equipe-hipocampo`; a `main` foi preservada enquanto os arquivos estão pendentes.

Vídeo da prévia: `docs/team-finale-motion.mp4`. Os cartões ainda exibem nomes, pois os retratos originais estão pendentes.

## Validação

`npm run build`, `node --check public/assets/team-finale.js` e `python scripts/test-team-finale.py`.

O teste de imagens usa uma fotografia de arquivo apenas em resposta interceptada pelo navegador de testes, para verificar o carregamento e o corte. Esse fixture nunca é escrito no manifesto nem usado na versão de prévia.
