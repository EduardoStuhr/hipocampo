# Sobre nós — Hipocampo

Com o título “Sobre nós”, a seção `#informacoes` usa uma grade inspirada no print de equipe fornecido em 14/11/2026: título centralizado, introdução em duas colunas, fotografias inclinadas recortadas por uma linha horizontal e nome/funções abaixo. Substitui o leque com a palavra gigante. Mantém o azul original #2626fc e o contato existente.

## Créditos em ordem alfabética

| Pessoa | Funções | Retrato |
| --- | --- | --- |
| Beatriz Rangel | Direção de Som; Assistência de Produção | beatriz-66b7eb26e08c.webp |
| Gabriel Orlando | Direção de Arte; Cenografia | gabriel-a9179d8a2137.webp |
| Guilherme Brandão | Direção de Experiência; Mediação; Assistência de Produção | guilherme-cbae9f8d76ee.webp |
| Heitor Lopes | Direção de Fotografia; Documentação | heitor-8a253cab9b3c.webp |
| Heloiza Miranda | Direção de Fotografia; Documentação; Assistência de Produção | heloisa-e8a49fc5db72.webp |
| Lara Sanchez | Direção de Arte; Cenografia | lara-cdd50bedccc0.webp |
| Marcos Bonavita | Assistência de Som; Trilha Sonora | marcos-a006a67ceead.webp |
| Mariana Teixeira | Direção Criativa; Direção de Produção | mariana-130c88ae8ddc.webp |
| Raphael Cardoso | Direção de Experiência; Mediação | raphael-fffa415da17b.webp |
| Tiago Chaves | Assistência de Som; Trilha Sonora | tiago-a57068011063.webp |

Os dez retratos vêm do ZIP fotos.zip recebido em 14/11/2026 e foram associados pelos nomes dos arquivos. Todos foram substituídos, incluindo o retrato de Marcos Bonavita que faltava. Papéis repetidos da lista foram reunidos por pessoa; grafia dos nomes conforme a lista atual do usuário.

## Layout e movimento

- Quatro colunas no desktop, três no tablet e duas no celular.
- Título Sobre nós em AquilineTwo e nomes, funções e demais textos da seção em SquidBoy local; nomes em amarelo #f0d756, maiores e com mais separação das funções em branco; textos sem truncamento.
- Entrada suave por fotografia, flutuação local enquanto visível, revelação da foto inteira ao passar o mouse, focar ou tocar, sem zoom nem recorte da proporção original.
- Toque alterna a posição; Escape retorna. Botões possuem nome acessível e estado aria-pressed.
- Movimento reduzido desativa flutuação e deslocamentos. Animações pausam fora da tela e na aba oculta.
- Créditos ficam fora do processamento de títulos editoriais, impedindo máscaras antigas de esconder os nomes.
- Nenhum loop JavaScript por frame nem alterações nos módulos 3D.

## Validação e publicação

Build, sintaxe JS e suíte Playwright no diretório `dist`, servido pela porta 4182: desktop 1440×1000, celulares 390×844 e 320×640, além de desktop e celular com movimento reduzido. Verificados os dez nomes/funções, dez retratos nomeados, incluindo Marcos, mouse, clique/toque, Escape, colunas, overflow, pausa fora de tela, console e arquivos ausentes. Todos passaram.

Previews atuais: `docs/team-finale-preview-1440.webp` e `docs/team-finale-preview-390.webp`. O vídeo `team-finale-motion.mp4` é um registro histórico do leque anterior.

Produção: Cloudflare Pages conectado ao repositório `EduardoStuhr/hipocampo`, branch `main`. Enviar somente à `main` e acompanhar o check do Cloudflare; pré-visualizações de outras branches não comprovam publicação em hipocampo.pages.dev. Os assets da equipe usam nomes com hash de conteúdo no build.

## Ajuste de enquadramento — 14/11/2026

Retirado o zoom e o object-fit cover dos retratos. As fotos preservam a proporção original com contain; no estado ativo ficam inteiramente dentro da área disponível. O movimento de flutuação para ao interagir, para não cortar o topo. Em movimento reduzido, os retratos já aparecem inteiros. Regressão verifica limites geométricos, contain e escala 1 nas dez imagens em PC, celular e movimento reduzido, incluindo Lara.

## Fotos fornecidas pelo usuário

O acesso à pasta Drive foi bloqueado pela rede. O usuário enviou fotos.zip, com dez JPEGs nomeados; a atualização foi concluída a partir desse arquivo. As imagens foram convertidas para WebP 720×960, preservando orientação e proporção. Novos caminhos com hash de conteúdo impedem reutilização das fotos antigas em cache. Os caminhos antigos permanecem disponíveis para versões anteriores da página. Mapeamento auditável em docs/team-photo-import.json.
