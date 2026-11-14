# Equipe — Hipocampo

A seção `#informacoes` usa uma grade inspirada no print de equipe fornecido em 14/11/2026: título centralizado, introdução em duas colunas, fotografias inclinadas recortadas por uma linha horizontal e nome/funções abaixo. Substitui o leque com a palavra gigante. Mantém o azul original #2626fc e o contato existente.

## Créditos em ordem alfabética

| Pessoa | Funções | Retrato |
| --- | --- | --- |
| Beatriz Rangel | Direção de Som; Assistência de Produção | beatriz.webp |
| Gabriel Orlando | Direção de Arte; Cenografia | gabriel.webp |
| Guilherme Brandão | Direção de Experiência; Mediação; Assistência de Produção | guilherme.webp |
| Heitor Lopes | Direção de Fotografia; Documentação | heitor.webp |
| Heloísa Miranda | Direção de Fotografia; Documentação; Assistência de Produção | heloiza.webp |
| Lara Sanchez | Direção de Arte; Cenografia | lara.webp |
| Marcos Bonavita | Assistência de Som; Trilha Sonora | Não recebido; crédito em texto |
| Mariana Teixeira | Direção Criativa; Direção de Produção | mariana.webp |
| Raphael Cardoso | Direção de Experiência; Mediação | raphael.webp |
| Tiago Chaves | Assistência de Som; Trilha Sonora | tiago.webp |

Os nove retratos recebidos permanecem associados às mesmas pessoas. Nenhum retrato foi inventado para Marcos. Papéis repetidos da lista foram reunidos por pessoa; grafia dos nomes conforme a lista atual do usuário.

## Layout e movimento

- Quatro colunas no desktop, três no tablet e duas no celular.
- Fonte monoespaçada em nomes e funções, como no print; textos sem truncamento.
- Entrada suave por fotografia, flutuação local enquanto visível, elevação e alinhamento ao passar o mouse, focar ou tocar.
- Toque alterna a posição; Escape retorna. Botões possuem nome acessível e estado aria-pressed.
- Movimento reduzido desativa flutuação e deslocamentos. Animações pausam fora da tela e na aba oculta.
- Créditos ficam fora do processamento de títulos editoriais, impedindo máscaras antigas de esconder os nomes.
- Nenhum loop JavaScript por frame nem alterações nos módulos 3D.

## Validação e publicação

Build, sintaxe JS e suíte Playwright no diretório `dist`, servido pela porta 4180: desktop 1440×1000, celulares 390×844 e 320×640, além de desktop e celular com movimento reduzido. Verificados os dez nomes/funções, nove imagens, ausência de retrato inventado para Marcos, mouse, clique/toque, Escape, colunas, overflow, pausa fora de tela, console e arquivos ausentes. Todos passaram.

Previews atuais: `docs/team-finale-preview-1440.webp` e `docs/team-finale-preview-390.webp`. O vídeo `team-finale-motion.mp4` é um registro histórico do leque anterior.

Produção: Cloudflare Pages conectado ao repositório `EduardoStuhr/hipocampo`, branch `main`. Enviar somente à `main` e acompanhar o check do Cloudflare; pré-visualizações de outras branches não comprovam publicação em hipocampo.pages.dev. Os assets da equipe usam nomes com hash de conteúdo no build.
