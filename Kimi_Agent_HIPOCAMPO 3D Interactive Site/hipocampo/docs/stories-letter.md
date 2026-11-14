# Relatos — carta de apresentação

A seção #relatos começa com um envelope de arquivo e o convite “Uma carta para você”. Clicar, tocar ou usar Enter em Abrir carta revela um texto de apresentação em papel claro, com assinatura Hipocampo. Fechar carta ou Escape fecha e retorna o foco ao botão. Os relatos ficam abaixo, na área clara.

O usuário autorizou montar uma carta de apresentação agora, mantendo “Relatos em breve” até receber os depoimentos. O texto é editorial de apresentação; não representa depoimento, autoria ou citação de participante. Nenhum formulário de coleta, contato ou relato fictício foi adicionado.

## Implementação

- public/assets/stories-letter.js: texto e interação da carta.
- public/assets/stories-letter.css: envelope, papel, tipografia e responsividade.
- client-editorial.js monta a carta dentro da seção existente; #relatos e navegação preservados.
- O envelope reaproveita o asset local /images/sobre/envelope.webp com orientação e máscara CSS; sem alteração do original.
- Cabeçalho branco sobre marrom e marrom sobre papel claro, com ranges recalculados ao abrir/fechar.
- Animação CSS curta; movimento reduzido sem animação/rolagem suave. Sem loops contínuos de JavaScript.

## Validação

Build, sintaxe JS e scripts/test-stories-letter.py. Quatro cenários: desktop 1440×1000, mobile 390×844 e 320×640, mobile com movimento reduzido. Verificados abertura/fechamento por teclado e toque, Escape e foco, tema do cabeçalho nos dois campos de cor, ordem carta/relatos, ausência de formulário ou depoimento fictício, dez créditos da equipe preservados, overflow, erros JS e 404. Todos passaram.

Inspeção visual final em 1440×1000 e 390×844; ajustados respiros dos floreios Aquiline e máscara do envelope.

Previews: stories-letter-closed-1440.webp, stories-letter-open-390.webp, stories-letter-text-390.webp.
